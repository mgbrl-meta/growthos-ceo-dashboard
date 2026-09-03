import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
} from './lib/auth/request-auth';


// ============================================================
// PUBLIC PAGES
//
// These pages must load before authentication.
//
// /login
//   Public/direct Growth OS authentication.
//
// /shopify
//   Embedded Shopify bootstrap.
//   Shopify authentication happens through App Bridge +
//   authenticated backend fetch requests.
// ============================================================

const PUBLIC_PAGES = new Set([
  '/login',
  '/shopify',
]);


// ============================================================
// PUBLIC AUTH APIs
//
// These endpoints must remain reachable before authentication.
//
// NOTE:
// /api/auth/shopify/resolve-shop performs its OWN Shopify
// ID-token verification and is intentionally excluded from
// normal tenant authentication until the canonical Shop ID
// has been discovered.
// ============================================================

const PUBLIC_API_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/shopify/resolve-shop',
  '/api/auth/shopify/bootstrap',
  '/api/integrations/shopify/install',
  '/api/integrations/shopify/callback',
]);


// ============================================================
// HELPERS
// ============================================================

function isPublicPage(
  pathname: string
) {

  return PUBLIC_PAGES.has(
    pathname
  );

}


function isPublicApi(
  pathname: string
) {

  return PUBLIC_API_PATHS.has(
    pathname
  );

}


function isApiRequest(
  pathname: string
) {

  return pathname.startsWith(
    '/api/'
  );

}


// ============================================================
// PROXY
//
// Authentication sources:
//
// 1. Shopify Admin ID token
//    Authorization: Bearer <jwt>
//
// 2. Growth OS public session
//    growthos_session HttpOnly cookie
//
// Both are resolved through authenticateRequest().
// ============================================================

export default async function proxy(
  request: NextRequest
) {

  const {
    pathname,
    search,
  } =
    request.nextUrl;


  // ==========================================================
  // 1. PUBLIC ROUTES
  // ==========================================================

  if (
    isPublicPage(
      pathname
    )
    ||
    isPublicApi(
      pathname
    )
  ) {

    return NextResponse.next();

  }


  // ==========================================================
  // 2. AUTHENTICATE REQUEST
  // ==========================================================

  const identity =
    await authenticateRequest(
      request
    );


  // ==========================================================
  // 3. AUTHENTICATED
  // ==========================================================

  if (identity) {

    /*
     * Pass trusted identity information downstream.
     *
     * IMPORTANT:
     * These headers are set by our server-side proxy,
     * not trusted directly from the browser.
     *
     * Later API routes can read them if required.
     */

    const requestHeaders =
      new Headers(
        request.headers
      );


    requestHeaders.set(
      'x-growthos-auth-source',
      identity.authSource
    );


    requestHeaders.set(
      'x-growthos-user-id',
      identity.userId
    );


    requestHeaders.set(
      'x-growthos-tenant-id',
      identity.tenantId
    );


    if (
      identity.shopId
    ) {

      requestHeaders.set(
        'x-growthos-shop-id',
        identity.shopId
      );

    }


    if (
      identity.shopDomain
    ) {

      requestHeaders.set(
        'x-growthos-shop-domain',
        identity.shopDomain
      );

    }


    return NextResponse.next(
      {

        request: {
          headers:
            requestHeaders,
        },

      }
    );

  }


  // ==========================================================
  // 4. UNAUTHENTICATED API REQUEST
  //
  // APIs MUST return JSON.
  //
  // Never redirect an API to /login because frontend fetch()
  // would receive HTML and then produce:
  //
  // Unexpected token '<' ...
  //
  // which we already encountered elsewhere.
  // ==========================================================

  if (
    isApiRequest(
      pathname
    )
  ) {

    return NextResponse.json(
      {

        ok:
          false,

        authenticated:
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


  // ==========================================================
  // 5. UNAUTHENTICATED PAGE REQUEST
  //
  // Public/direct browser:
  //
  // / → /login
  //
  // Preserve requested page so we can support deep-link
  // restoration later.
  // ==========================================================

  const loginUrl =
    new URL(
      '/login',
      request.url
    );


  const requestedPath =
    `${pathname}${search}`;


  if (
    requestedPath !==
    '/'
  ) {

    loginUrl.searchParams.set(
      'next',
      requestedPath
    );

  }


  return NextResponse.redirect(
    loginUrl
  );

}


// ============================================================
// MATCHER
//
// Run on application routes and APIs.
//
// Skip:
// - Next.js static assets
// - image optimizer
// - favicon
// - common public assets
// ============================================================

export const config = {

  matcher: [

    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf)$).*)',

  ],

};