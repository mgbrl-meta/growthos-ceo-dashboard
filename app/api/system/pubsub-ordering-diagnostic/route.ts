import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  PubSub,
} from '@google-cloud/pubsub';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


export async function POST(
  _request: NextRequest
) {

  const projectId =
    String(
      process.env.GOOGLE_CLOUD_PROJECT
      ||
      process.env.GCLOUD_PROJECT
      ||
      'shopify-colab'
    ).trim();


  const orderingKey =
    'shopify:brillare:brillare:shopify:gid://shopify/Shop/44356501671:customers:gid://shopify/Customer/6196646412465';


  const pubsub =
    new PubSub({
      projectId,
    });


  try {

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
                'vercel-ordering-diagnostic',

              createdAt:
                new Date()
                  .toISOString(),
            }),
            'utf8'
          ),

        attributes: {

          purpose:
            'vercel-ordering-diagnostic',

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


  } finally {

    await pubsub
      .close()
      .catch(
        () => {}
      );

  }

}