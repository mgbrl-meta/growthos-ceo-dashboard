import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  publishJsonMessage,
} from '@/lib/queue/pubsub';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


export async function POST(
  _request: NextRequest
) {

  const orderingKey =
    'shopify:brillare:brillare:shopify:gid://shopify/Shop/44356501671:customers:gid://shopify/Customer/6196646412465';


  try {

    const result =
      await publishJsonMessage({

        topic:
          'growthos-ordering-test',

        payload: {

          test:
            'publish-json-message-ordering-diagnostic',

          createdAt:
            new Date()
              .toISOString(),

        },

        orderingKey,

        attributes: {

          purpose:
            'publish-json-message-ordering-diagnostic',

        },

      });


    return NextResponse.json({

      ok:
        true,

      result,

    });


  } catch (
    error: any
  ) {

    return NextResponse.json(
      {

        ok:
          false,

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