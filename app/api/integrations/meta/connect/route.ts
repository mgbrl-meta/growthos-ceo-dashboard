import crypto from 'crypto';

import {
  NextResponse,
} from 'next/server';

import {
  resolveTenantContext,
} from '@/lib/tenancy/context';

import {
  buildMetaOAuthUrl,
} from '@/lib/integrations/providers/meta';


export const dynamic =
  'force-dynamic';


// ============================================================
// META CONNECT
//
// GET /api/integrations/meta/connect
//
// 1. Resolve current tenant
// 2. Generate anti-CSRF state
// 3. Bind state to workspace + brand in HttpOnly cookies
// 4. Redirect to Meta
// ============================================================

export async function GET() {

  try {

    const tenant =
      await resolveTenantContext();


    const state =
      crypto
        .randomBytes(
          32
        )
        .toString(
          'hex'
        );


    const oauthUrl =
      buildMetaOAuthUrl(
        state
      );


    const response =
      NextResponse.redirect(
        oauthUrl
      );


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
    // SECURITY
    //
    // We bind authorization to the tenant that initiated it.
    //
    // Later these values come from authenticated session state,
    // but callback behavior remains the same.
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

    console.error(
      'META_CONNECT_ERROR',
      error
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          error?.message
          ||
          'Unable to start Meta authorization',

      },
      {
        status:
          500,
      }
    );

  }

}