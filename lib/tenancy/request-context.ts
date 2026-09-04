import 'server-only';

import type {
  NextRequest,
} from 'next/server';

import {
  authenticateRequest,
  type AuthIdentity,
} from '@/lib/auth/request-auth';

import {
  resolveTenantContextById,
} from '@/lib/tenancy/context';

import type {
  TenantContext,
} from '@/lib/tenancy/types';


// ============================================================
// AUTHENTICATED RUNTIME TENANT
//
// This is the canonical resolver for NORMAL Growth OS
// application requests.
//
// Request
//    ↓
// signed Growth OS session / Shopify auth
//    ↓
// workspaceId + brandId
//    ↓
// control-plane validation
//    ↓
// TenantContext
//
// IMPORTANT:
//
// This resolver NEVER uses:
//
// GROWTHOS_DEFAULT_WORKSPACE_ID
// GROWTHOS_DEFAULT_BRAND_ID
//
// Environment tenant defaults are allowed only for:
//
// development bootstrap
// explicit migration compatibility
// installation-time legacy adoption
// ============================================================

export type AuthenticatedTenantContext = {

  identity:
    AuthIdentity;

  tenant:
    TenantContext;

};


// ============================================================
// REQUIRE AUTHENTICATED TENANT
// ============================================================

export async function resolveRequestTenantContext(
  request: NextRequest
):

  Promise<
    AuthenticatedTenantContext
  > {

  // ==========================================================
  // 1. AUTHENTICATE REQUEST
  // ==========================================================

  const identity =
    await authenticateRequest(
      request
    );


  if (!identity) {

    throw new Error(
      'UNAUTHENTICATED'
    );

  }


  // ==========================================================
  // 2. REQUIRE ACTIVE TENANT CLAIMS
  //
  // V2 Growth OS sessions must contain both.
  // ==========================================================

  const workspaceId =
    String(
      identity.workspaceId
      ||
      ''
    ).trim();


  const brandId =
    String(
      identity.brandId
      ||
      ''
    ).trim();


  if (
    !workspaceId
    ||
    !brandId
  ) {

    throw new Error(
      'AUTHENTICATED_TENANT_CONTEXT_MISSING'
    );

  }


  // ==========================================================
  // 3. VERIFY AGAINST CONTROL PLANE
  //
  // Never use session IDs blindly.
  //
  // This also verifies:
  //
  // workspace exists
  // brand exists
  // workspace is active
  // brand is active
  // brand belongs to workspace
  // ==========================================================

  const tenant =
    await resolveTenantContextById(

      workspaceId,

      brandId

    );


  // ==========================================================
  // 4. RETURN AUTH + TENANT
  // ==========================================================

  return {

    identity,

    tenant,

  };

}