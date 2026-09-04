import crypto from 'crypto';

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  resolveRequestTenantContext,
} from '@/lib/tenancy/request-context';

import {
  buildMetaOAuthUrl,
} from '@/lib/integrations/providers/meta';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// META CONNECT
//
// GET /api/integrations/meta/connect
//
// 1. Authenticate current Growth OS request
// 2. Resolve active workspace + brand from signed session
// 3. Generate anti-CSRF state
// 4. Bind state + workspace + brand in HttpOnly cookies
// 5. Redirect to Meta OAuth
//
// IMPORTANT:
//
// This route does NOT use:
//
// GROWTHOS_DEFAULT_WORKSPACE_ID
// GROWTHOS_DEFAULT_BRAND_ID
//
// Therefore Meta authorization always begins for the
// currently active Growth OS brand.
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. AUTHENTICATED TENANT
    // ========================================================

    const {
      tenant,
    } =
      await resolveRequestTenantContext(
        request
      );


    // ========================================================
    // 2. ANTI-CSRF STATE
    // ========================================================

    const state =
      crypto
        .randomBytes(
          32
        )
        .toString(
          'hex'
        );


    // ========================================================
    // 3. META AUTHORIZATION URL
    // ========================================================

    const oauthUrl =
      buildMetaOAuthUrl(
        state
      );


    const response =
      NextResponse.redirect(
        oauthUrl
      );


    // ========================================================
    // 4. TEMPORARY OAUTH COOKIE OPTIONS
    //
    // Cookies survive the external Meta redirect and return
    // to the callback.
    //
    // They expire quickly and are cleared after callback.
    // ========================================================

    const cookieOptions = {

      httpOnly:
        true,

      secure:
        process.env.NODE_ENV ===
        'production',

      sameSite:
        'lax' as const,

      path:
        '/',

      maxAge:
        10 * 60,

    };


    // ========================================================
    // 5. FREEZE OAUTH TENANT CONTEXT
    //
    // This is critical for multi-brand Growth OS.
    //
    // Example:
    //
    // user active brand = Brand B
    //
    // Meta authorization starts
    //        ↓
    // these cookies freeze:
    //
    // workspace = Brand B workspace
    // brand     = Brand B
    //
    // callback MUST use these exact values.
    //
    // It must not use the user's later active session or
    // environment defaults.
    // ========================================================

    response.cookies.set(
      'growthos_meta_state',
      state,
      cookieOptions
    );


    response.cookies.set(
      'growthos_meta_workspace',
      tenant.workspaceId,
      cookieOptions
    );


    response.cookies.set(
      'growthos_meta_brand',
      tenant.brandId,
      cookieOptions
    );


    return response;


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Unable to start Meta authorization'
      );


    console.error(
      'META_CONNECT_ERROR',
      {
        message,
      }
    );


    // ========================================================
    // AUTHENTICATION FAILURE
    // ========================================================

    if (
      message ===
      'UNAUTHENTICATED'
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'UNAUTHENTICATED',

        },
        {
          status:
            401,
        }
      );

    }


    // ========================================================
    // INVALID ACTIVE TENANT
    // ========================================================

    if (
      message ===
        'AUTHENTICATED_TENANT_CONTEXT_MISSING'
      ||
      message.includes(
        'Growth OS tenant could not be resolved'
      )
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'TENANT_CONTEXT_INVALID',

        },
        {
          status:
            403,
        }
      );

    }


    // ========================================================
    // INTERNAL FAILURE
    // ========================================================

    return NextResponse.json(
      {

        ok:
          false,

        error:
          'Unable to start Meta authorization',

      },
      {
        status:
          500,
      }
    );

  }

}