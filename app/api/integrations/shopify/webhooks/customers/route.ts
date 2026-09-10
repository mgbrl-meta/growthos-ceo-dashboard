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
// IMPORTANT:
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
// CUSTOMER GID
//
// Shopify webhook payload may contain:
//
// admin_graphql_api_id
//
// OR
//
// numeric REST-style Customer id.
//
// Normalize everything into:
//
// gid://shopify/Customer/123
// ============================================================

function resolveCustomerGid(
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
      'gid://shopify/Customer/'
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
      'SHOPIFY_WEBHOOK_CUSTOMER_ID_INVALID'
    );

  }


  return (
    `gid://shopify/Customer/${legacyId}`
  );

}


// ============================================================
// CUSTOMERS CREATE / UPDATE WEBHOOK
//
// Shopify
//    ↓
// HMAC verification
//    ↓
// resolve exact tenant/account from shop domain
//    ↓
// tiny Pub/Sub identity message
//    ↓
// Cloud Run Shopify worker
//    ↓
// canonical GraphQL Customer refetch
//    ↓
// canonical Customer warehouse writer
//    ↓
// RAW → STATE → CURRENT
//
// IMPORTANT:
//
// The Shopify webhook JSON itself is NOT written into the
// canonical Customer warehouse.
//
// Webhook payload is used only to identify which Customer
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
    // 3. SHOP
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

        'customers/create',
        'customers/update',

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
    // 6. CANONICAL CUSTOMER ID
    // ========================================================

    const customerId =
      resolveCustomerGid(
        payload
      );


    // ========================================================
    // 7. TENANT / ACCOUNT
    //
    // Shop domain is authoritative.
    //
    // No workspace/brand value is accepted from the webhook
    // payload itself.
    // ========================================================

    const account =
      await getShopifyIntegrationAccountByDomain(
        shopDomain
      );


    if (!account) {

      console.warn(
        'SHOPIFY_CUSTOMER_WEBHOOK_ACCOUNT_NOT_FOUND',
        {

          shopDomain,

          webhookTopic,

          customerId,

        }
      );


      // ======================================================
      // Do not create an endless Shopify retry loop for a
      // removed / disconnected Growth OS installation.
      // ======================================================

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
    // Shopify gives each delivery an identifier.
    //
    // Reuse it as our job ID where available.
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
    // 9. PUBLISH SMALL CUSTOMER IDENTITY JOB
    //
    // NO:
    //
    // access token
    // client secret
    // webhook HMAC
    // full Customer webhook payload
    //
    // Worker resolves credential independently from the
    // Growth OS control plane.
    // ========================================================

    const job = {

      schemaVersion:
        1,

      eventType:
        'shopify.customer.webhook',

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
        'customers',

      customerId,

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
    // 10. PUB/SUB
    // ========================================================

    const published =
      await publishJsonMessage({

        topic:
          getShopifySyncTopicName(),

        payload:
          job,

        attributes: {

          schemaVersion:
            '1',

          provider:
            'shopify',

          eventType:
            'shopify.customer.webhook',

          workspaceId:
            job.workspaceId,

          brandId:
            job.brandId,

          entity:
            'customers',

          webhookTopic,

        },

      });


    // ========================================================
    // 11. RESULT
    // ========================================================

    console.log(
      'SHOPIFY_CUSTOMER_WEBHOOK_QUEUED',
      {

        jobId,

        webhookId:
          webhookId
          ||
          null,

        shopDomain,

        webhookTopic,

        customerId,

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
        'Shopify Customer webhook failed'
      );


    console.error(
      'SHOPIFY_CUSTOMER_WEBHOOK_FAILED',
      {

        message,

        durationMs:
          Date.now()
          -
          startedAt,

      }
    );


    // ========================================================
    // Return 500 for genuine transient failures so Shopify can
    // retry delivery.
    // ========================================================

    return NextResponse.json(
      {

        ok:
          false,

        error:
          'SHOPIFY_CUSTOMER_WEBHOOK_FAILED',

      },
      {

        status:
          500,

      }
    );

  }

}