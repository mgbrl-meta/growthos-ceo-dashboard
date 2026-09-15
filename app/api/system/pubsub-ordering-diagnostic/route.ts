import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  getPubSubClient,
  getPubSubProjectId,
} from '@/lib/queue/pubsub';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


export async function POST(
  _request: NextRequest
) {

  const projectId =
    getPubSubProjectId();


  const orderingKey =
    'shopify:brillare:brillare:shopify:gid://shopify/Shop/44356501671:customers:gid://shopify/Customer/6196646412465';


  try {

    // ========================================================
    // IMPORTANT
    //
    // Use the exact same Growth OS Pub/Sub client as the live
    // Shopify webhook publisher.
    //
    // This means Vercel uses:
    //
    // GCP_CLIENT_EMAIL
    // GCP_PRIVATE_KEY
    //
    // rather than Application Default Credentials.
    // ========================================================

    const pubsub =
      getPubSubClient();


    const topic =
      pubsub.topic(
        'growthos-ordering-test',
        {
          messageOrdering:
            true,
        }
      );


    const messageId =
      await topic.publishMessage({

        data:
          Buffer.from(
            JSON.stringify({
              test:
                'vercel-growthos-client-ordering',

              createdAt:
                new Date()
                  .toISOString(),
            }),
            'utf8'
          ),

        attributes: {

          purpose:
            'vercel-growthos-client-ordering',

        },

        orderingKey,

      });


    return NextResponse.json({

      ok:
        true,

      projectId,

      messageId,

      orderingKey,

    });


  } catch (
    error: any
  ) {

    return NextResponse.json(
      {

        ok:
          false,

        projectId,

        error: {

          name:
            String(
              error?.name
              ??
              ''
            ),

          code:
            error?.code
            ??
            null,

          message:
            String(
              error?.message
              ??
              'UNKNOWN_ERROR'
            ),

          details:
            String(
              error?.details
              ??
              ''
            ),

        },

      },
      {
        status:
          500,
      }
    );

  }

}