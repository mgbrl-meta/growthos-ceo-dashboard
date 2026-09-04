import {
  NextResponse,
} from 'next/server';

import {
  ensureIntegrationControlPlane,
} from '@/lib/integrations/control-plane';

import {
  bootstrapDevelopmentTenant,
} from '@/lib/tenancy/control-plane';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// GROWTH OS DEVELOPMENT / SYSTEM BOOTSTRAP
//
// IMPORTANT:
//
// This is NOT a normal tenant-runtime endpoint.
//
// It exists only to:
//
// 1. bootstrap explicitly configured development tenant
// 2. ensure integration control-plane infrastructure
//
// Environment defaults are intentionally allowed here:
//
// GROWTHOS_DEFAULT_WORKSPACE_ID
// GROWTHOS_DEFAULT_BRAND_ID
//
// Normal dashboard/API routes must instead use:
//
// resolveRequestTenantContext(request)
//
// This endpoint should never be used to determine the active
// tenant for a normal Growth OS user request.
// ============================================================

export async function GET() {

  try {

    // ========================================================
    // 1. BOOTSTRAP EXPLICIT DEVELOPMENT TENANT
    //
    // bootstrapDevelopmentTenant() itself reads the configured
    // development/default tenant values and returns the exact
    // tenant it created/resolved.
    //
    // Therefore there is no need to call:
    //
    // again afterward.
    // ========================================================

    const tenant =
      await bootstrapDevelopmentTenant();


    // ========================================================
    // 2. ENSURE INTEGRATION CONTROL PLANE
    // ========================================================

    const controlPlane =
      await ensureIntegrationControlPlane();


    // ========================================================
    // 3. RESPONSE
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

          mode:
            'development_bootstrap',

          safeToRerun:
            true,

        },

      }
    );


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Growth OS integration bootstrap failed'
      );


    console.error(
      'INTEGRATION_BOOTSTRAP_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Growth OS integration bootstrap failed',

      },
      {
        status:
          500,
      }
    );

  }

}