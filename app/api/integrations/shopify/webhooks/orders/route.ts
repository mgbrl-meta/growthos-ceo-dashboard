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
// ORDER GID
//
// Webhook payload may contain:
//
// admin_graphql_api_id
//
// OR
//
// numeric REST order id.
//
// We normalize everything into:
//
// gid://shopify/Order/123
// ============================================================

function resolveOrderGid(
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
      'gid://shopify/Order/'
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
      'SHOPIFY_WEBHOOK_ORDER_ID_INVALID'
    );

  }


  return (
    `gid://shopify/Order/${legacyId}`
  );

}


// ============================================================
// ORDERS CREATE / UPDATED WEBHOOK
//
// Shopify
//    ↓
// HMAC
//    ↓
// resolve tenant/account
//    ↓
// tiny Pub/Sub identity message
//    ↓
// Cloud Run
//    ↓
// fetch canonical GraphQL Order
//    ↓
// existing canonical warehouse writer
//
// The REST-style webhook payload itself is NOT written into
// the canonical Shopify warehouse.
// ============================================================

export async function POST(
  request: NextRequest
) {

  const startedAt =
    Date.now();


  try {

    // ========================================================
    // RAW BODY FIRST
    // ========================================================

    const rawBody =
      await request.text();


    // ========================================================
    // HMAC
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
    // SHOP
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
    // TOPIC
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

        'orders/create',
        'orders/updated',

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
    // PARSE VERIFIED BODY
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
    // CANONICAL ORDER ID
    // ========================================================

    const orderId =
      resolveOrderGid(
        payload
      );


    // ========================================================
    // TENANT / ACCOUNT
    // ========================================================

    const account =
      await getShopifyIntegrationAccountByDomain(
        shopDomain
      );


    if (!account) {

      console.warn(
        'SHOPIFY_ORDER_WEBHOOK_ACCOUNT_NOT_FOUND',
        {

          shopDomain,

          webhookTopic,

          orderId,

        }
      );


      // Do not create an endless Shopify retry loop for an
      // already-removed Growth OS installation.
      return NextResponse.json({

        ok:
          true,

        handled:
          false,

      });

    }


    // ========================================================
    // WEBHOOK ID
    //
    // Shopify gives each webhook delivery an identifier.
    //
    // Reuse it as our job identity when present.
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
    // PUBLISH SMALL CANONICAL JOB
    //
    // NO access tokens.
    // NO client secret.
    // NO full webhook payload.
    // ========================================================

    const job = {

      schemaVersion:
        1,

      eventType:
        'shopify.order.webhook',

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
        'orders',

      orderId,

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
            'shopify.order.webhook',

          workspaceId:
            job.workspaceId,

          brandId:
            job.brandId,

          entity:
            'orders',

          webhookTopic,

        },

      });


    console.log(
      'SHOPIFY_ORDER_WEBHOOK_QUEUED',
      {

        jobId,

        webhookId:
          webhookId
          ||
          null,

        shopDomain,

        webhookTopic,

        orderId,

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
        'Shopify Orders webhook failed'
      );


    console.error(
      'SHOPIFY_ORDER_WEBHOOK_FAILED',
      {

        message,

        durationMs:
          Date.now()
          -
          startedAt,

      }
    );


    // Returning 500 intentionally allows Shopify to retry a
    // transient failure such as Pub/Sub or BigQuery outage.
    return NextResponse.json(
      {

        ok:
          false,

        error:
          'SHOPIFY_ORDER_WEBHOOK_FAILED',

      },
      {

        status:
          500,

      }
    );

  }

}