import {
  NextResponse,
} from 'next/server';

import {
  resolveTenantContext,
} from '@/lib/tenancy/context';

import {
  ensureIntegrationControlPlane,
} from '@/lib/integrations/control-plane';

import {
  bootstrapDevelopmentTenant,
} from '@/lib/tenancy/control-plane';


export const dynamic =
  'force-dynamic';


export async function GET() {

  try {

    // ========================================================
    // BOOTSTRAP TENANT INFRASTRUCTURE
    //
    // Setup/bootstrap only.
    // Not executed during normal application requests.
    // ========================================================

    await bootstrapDevelopmentTenant();


    // ========================================================
    // INTEGRATION CONTROL PLANE
    // ========================================================

    const controlPlane =
      await ensureIntegrationControlPlane();


    // ========================================================
    // VERIFY TENANT
    // ========================================================

    const tenant =
      await resolveTenantContext();


    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      {

        ok:
          true,

        data: {

          tenant,

          controlPlane,

        },

        meta: {

          bootstrap:
            'complete',

          safeToRerun:
            true,

        },

      }
    );


  } catch (
    error: any
  ) {

    console.error(
      'INTEGRATION_BOOTSTRAP_ERROR',
      error
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          error?.message
          ||
          'Growth OS integration bootstrap failed',

      },
      {
        status:
          500,
      }
    );

  }

}