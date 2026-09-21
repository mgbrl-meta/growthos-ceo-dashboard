import {
  NextRequest,
  NextResponse,
} from 'next/server';

import crypto from 'crypto';

import {
  getShopifyClientSecret,
  normalizeShopDomain,
} from '@/lib/auth/config';

import {
  getShopifyIntegrationAccountByDomain,
} from '@/lib/integrations/store';

import {
  getShopifySyncTopicName,
  publishJsonMessage,
} from '@/lib/queue/pubsub';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// VERIFY SHOPIFY WEBHOOK HMAC
//
// HMAC-SHA256(
//   exact raw body,
//   Shopify client secret
// )
//
// Shopify sends Base64 HMAC.
//
// Verification MUST happen against the exact raw request body
// before JSON parsing.
// ============================================================

function verifyWebhookHmac(
  rawBody: string,
  receivedHmac: string
) {

  if (
    !rawBody
    ||
    !receivedHmac
  ) {

    return false;

  }


  const calculated =
    crypto
      .createHmac(
        'sha256',
        getShopifyClientSecret()
      )
      .update(
        rawBody,
        'utf8'
      )
      .digest(
        'base64'
      );


  const left =
    Buffer.from(
      calculated,
      'utf8'
    );


  const right =
    Buffer.from(
      receivedHmac,
      'utf8'
    );


  if (
    left.length !==
      right.length
  ) {

    return false;

  }


  return crypto.timingSafeEqual(
    left,
    right
  );

}


// ============================================================
// PRODUCT GID
//
// Shopify webhook payload may contain:
//
// admin_graphql_api_id
//
// OR
//
// numeric REST-style Product id.
//
// Normalize everything into:
//
// gid://shopify/Product/123
// ============================================================

function resolveProductGid(
  payload: any
) {

  const graphqlId =
    String(
      payload?.admin_graphql_api_id
      ??
      ''
    ).trim();


  if (
    graphqlId.startsWith(
      'gid://shopify/Product/'
    )
  ) {

    return graphqlId;

  }


  const legacyId =
    String(
      payload?.id
      ??
      ''
    ).trim();


  if (
    !legacyId
    ||
    !/^\d+$/.test(
      legacyId
    )
  ) {

    throw new Error(
      'SHOPIFY_WEBHOOK_PRODUCT_ID_INVALID'
    );

  }


  return (
    `gid://shopify/Product/${legacyId}`
  );

}


// ============================================================
// PRODUCTS CREATE / UPDATE WEBHOOK
//
// Shopify
//    ↓
// HMAC verification
//    ↓
// resolve exact tenant/account from shop domain
//    ↓
// tiny Pub/Sub Product identity message
//    ↓
// Cloud Run Shopify worker
//    ↓
// canonical GraphQL Product refetch
//    ↓
// canonical Product warehouse writer
//    ↓
// RAW → STATE → CURRENT
//
// IMPORTANT:
//
// The Shopify webhook JSON itself is NOT written into the
// canonical Product warehouse.
//
// Webhook payload is used only to identify which Product
// changed.
// ============================================================

export async function POST(
  request: NextRequest
) {

  const startedAt =
    Date.now();


  try {

    // ========================================================
    // 1. RAW BODY FIRST
    // ========================================================

    const rawBody =
      await request.text();


    // ========================================================
    // 2. HMAC
    // ========================================================

    const receivedHmac =
      String(
        request.headers.get(
          'x-shopify-hmac-sha256'
        )
        ||
        ''
      );


    if (
      !verifyWebhookHmac(
        rawBody,
        receivedHmac
      )
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SHOPIFY_WEBHOOK_HMAC_INVALID',

        },
        {

          status:
            401,

        }
      );

    }


    // ========================================================
    // 3. SHOP DOMAIN
    // ========================================================

    const shopDomain =
      normalizeShopDomain(
        String(
          request.headers.get(
            'x-shopify-shop-domain'
          )
          ||
          ''
        )
      );


    if (
      !shopDomain
      ||
      !shopDomain.endsWith(
        '.myshopify.com'
      )
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SHOPIFY_WEBHOOK_SHOP_INVALID',

        },
        {

          status:
            400,

        }
      );

    }


    // ========================================================
    // 4. TOPIC
    // ========================================================

    const webhookTopic =
      String(
        request.headers.get(
          'x-shopify-topic'
        )
        ||
        ''
      )
        .trim()
        .toLowerCase();


    const allowedTopics =
      new Set([

        'products/create',
        'products/update',

      ]);


    if (
      !allowedTopics.has(
        webhookTopic
      )
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SHOPIFY_WEBHOOK_TOPIC_UNSUPPORTED',

        },
        {

          status:
            400,

        }
      );

    }


    // ========================================================
    // 5. PARSE VERIFIED BODY
    // ========================================================

    let payload:
      any;


    try {

      payload =
        JSON.parse(
          rawBody
        );

    } catch {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'SHOPIFY_WEBHOOK_BODY_INVALID',

        },
        {

          status:
            400,

        }
      );

    }


    // ========================================================
    // 6. CANONICAL PRODUCT ID
    // ========================================================

    const productId =
      resolveProductGid(
        payload
      );


    // ========================================================
    // 7. TENANT / ACCOUNT
    //
    // Shop domain is authoritative.
    //
    // No workspace or brand identity is trusted from the
    // Shopify payload.
    // ========================================================

    const account =
      await getShopifyIntegrationAccountByDomain(
        shopDomain
      );


    if (!account) {

      console.warn(
        'SHOPIFY_PRODUCT_WEBHOOK_ACCOUNT_NOT_FOUND',
        {

          shopDomain,

          webhookTopic,

          productId,

        }
      );


      // Removed/disconnected installation.
      //
      // Return success so Shopify does not retry forever.
      return NextResponse.json({

        ok:
          true,

        handled:
          false,

      });

    }


    // ========================================================
    // 8. WEBHOOK ID
    //
    // Shopify provides a stable delivery ID.
    //
    // Reuse it as job identity when available.
    // ========================================================

    const webhookId =
      String(
        request.headers.get(
          'x-shopify-webhook-id'
        )
        ||
        ''
      ).trim();


    const jobId =
      webhookId
      ||
      crypto.randomUUID();


    // ========================================================
    // 9. SMALL CANONICAL PRODUCT JOB
    //
    // NO:
    //
    // access token
    // refresh token
    // Shopify client secret
    // full webhook payload
    //
    // Worker resolves credentials independently.
    // ========================================================

    const job = {

      schemaVersion:
        1,

      eventType:
        'shopify.product.webhook',

      jobId,

      provider:
        'shopify',

      workspaceId:
        String(
          account.workspace_id
        ),

      brandId:
        String(
          account.brand_id
        ),

      connectionId:
        String(
          account.connection_id
        ),

      integrationAccountId:
        String(
          account.integration_account_id
        ),

      providerAccountId:
        String(
          account.provider_account_id
        ),

      entity:
        'products',

      productId,

      webhookTopic,

      webhookId:
        webhookId
        ||
        null,

      shopDomain,

      webhookTriggeredAt:
        String(
          request.headers.get(
            'x-shopify-triggered-at'
          )
          ||
          ''
        )
        ||
        null,

      requestedAt:
        new Date()
          .toISOString(),

      requestedBy:
        'shopify_webhook',

    };


    // ========================================================
    // ORDERING KEY
    //
    // Changes for the same Product remain serialized through
    // Pub/Sub when ordering is enabled.
    // ========================================================

    const orderingKey =
      [

        'shopify',

        job.integrationAccountId,

        'products',

        productId,

      ].join(
        ':'
      );


    // ========================================================
    // 10. PUB/SUB
    // ========================================================

    const published =
      await publishJsonMessage({

        topic:
          getShopifySyncTopicName(),

        payload:
          job,

        orderingKey,

        attributes: {

          schemaVersion:
            '1',

          provider:
            'shopify',

          eventType:
            'shopify.product.webhook',

          workspaceId:
            job.workspaceId,

          brandId:
            job.brandId,

          entity:
            'products',

          webhookTopic,

        },

      });


    // ========================================================
    // 11. RESULT
    // ========================================================

    console.log(
      'SHOPIFY_PRODUCT_WEBHOOK_QUEUED',
      {

        jobId,

        webhookId:
          webhookId
          ||
          null,

        shopDomain,

        webhookTopic,

        productId,

        workspaceId:
          job.workspaceId,

        brandId:
          job.brandId,

        integrationAccountId:
          job.integrationAccountId,

        messageId:
          published.messageId,

        durationMs:
          Date.now()
          -
          startedAt,

      }
    );


    return NextResponse.json({

      ok:
        true,

      queued:
        true,

    });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Shopify Product webhook failed'
      );


    console.error(
      'SHOPIFY_PRODUCT_WEBHOOK_FAILED',
      {

        message,

        durationMs:
          Date.now()
          -
          startedAt,

      }
    );


    // Real transient failures return 500 so Shopify can retry.
    return NextResponse.json(
      {

        ok:
          false,

        error:
          'SHOPIFY_PRODUCT_WEBHOOK_FAILED',

      },
      {

        status:
          500,

      }
    );

  }

}