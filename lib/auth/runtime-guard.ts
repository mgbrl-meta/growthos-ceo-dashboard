import 'server-only';

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  authenticateRequest,
  type AuthIdentity,
} from './request-auth';

import {
  hasGrowthOSAccess,
  resolveGrowthOSEffectiveAccess,
  type GrowthOSEffectiveAccessSnapshot,
} from './effective-access';

import {
  resolveGrowthOSApiPolicy,
} from './runtime-api-policy';


// ============================================================
// TYPES
// ============================================================

export type GrowthOSRequiredPermission =
  | 'viewer'
  | 'editor';


export type GrowthOSRuntimeContext = {

  identity:
    AuthIdentity;

  access:
    GrowthOSEffectiveAccessSnapshot;

  workspaceId:
    string;

  brandId:
    string;

};


// ============================================================
// AUTHORIZATION ERROR
// ============================================================

export class GrowthOSRuntimeAccessError
  extends Error {

  code:
    string;

  status:
    number;


  constructor(
    code:
      string,
    message:
      string,
    status:
      number
  ) {

    super(
      message
    );


    this.name =
      'GrowthOSRuntimeAccessError';


    this.code =
      code;


    this.status =
      status;

  }

}


// ============================================================
// REQUIRE MODULE / SUBMODULE ACCESS
// ============================================================

export async function requireGrowthOSAccess({

  request,

  moduleId,

  submoduleId,

  required =
    'viewer',

}: {

  request:
    NextRequest |
    Request;

  moduleId:
    string;

  submoduleId?:
    string;

  required?:
    GrowthOSRequiredPermission;

}):

  Promise<
    GrowthOSRuntimeContext
  > {

  // ==========================================================
  // 1. AUTHENTICATE
  // ==========================================================

  const identity =
    await authenticateRequest(
      request as NextRequest
    );


  if (!identity) {

    throw new GrowthOSRuntimeAccessError(
      'UNAUTHENTICATED',
      'Authentication is required',
      401
    );

  }


  // ==========================================================
  // 2. RESOLVE LIVE EFFECTIVE ACCESS
  // ==========================================================

  const access =
    await resolveGrowthOSEffectiveAccess(
      identity
    );


  // ==========================================================
  // 3. CHECK REQUIRED ACCESS
  // ==========================================================

  const allowed =
    hasGrowthOSAccess({

      access,

      moduleId,

      submoduleId,

      required,

    });


  if (!allowed) {

    throw new GrowthOSRuntimeAccessError(
      'ACCESS_DENIED',
      'You do not have access to this Growth OS resource',
      403
    );

  }


  // ==========================================================
  // 4. RETURN TRUSTED RUNTIME CONTEXT
  // ==========================================================

  return {

    identity,

    access,

    workspaceId:
      access.workspaceId,

    brandId:
      access.brandId,

  };

}


// ============================================================
// HTTP METHOD → REQUIRED PERMISSION
//
// GET / HEAD
// → Viewer OR Editor
//
// POST / PUT / PATCH / DELETE
// → Editor only
// ============================================================

export function requiredPermissionForRequest(
  request:
    Request
):

  GrowthOSRequiredPermission {

  const method =
    String(
      request.method
      ||
      'GET'
    )
      .trim()
      .toUpperCase();


  if (
    method ===
      'GET'
    ||
    method ===
      'HEAD'
  ) {

    return 'viewer';

  }


  return 'editor';

}


// ============================================================
// REQUIRE ACCESS FOR CURRENT API ROUTE
//
// Uses:
//
// URL
// +
// HTTP method
//
// to resolve:
//
// module
// submodule
// required permission
//
// Example:
//
// GET /api/retention-os/action-tracker
//
// → retention
// → action-tracker
// → viewer
//
// POST /api/retention-os/action-tracker
//
// → retention
// → action-tracker
// → editor
// ============================================================

export async function requireGrowthOSApiAccess(
  request:
    NextRequest |
    Request
):

  Promise<
    GrowthOSRuntimeContext
  > {

  // ==========================================================
  // 1. RESOLVE API POLICY
  // ==========================================================

  const policy =
    resolveGrowthOSApiPolicy(
      request
    );


  // ==========================================================
  // FAIL CLOSED
  //
  // If an OS API does not have a policy, it must not silently
  // become accessible.
  // ==========================================================

  if (!policy) {

    throw new GrowthOSRuntimeAccessError(
      'API_ACCESS_POLICY_MISSING',
      'No Growth OS authorization policy exists for this API route',
      403
    );

  }


  // ==========================================================
  // 2. GET VIEWER / EDITOR REQUIREMENT FROM HTTP METHOD
  // ==========================================================

  const required =
    requiredPermissionForRequest(
      request
    );


  // ==========================================================
  // 3. ENFORCE
  // ==========================================================

  return requireGrowthOSAccess({

    request,

    moduleId:
      policy.moduleId,

    submoduleId:
      policy.submoduleId,

    required,

  });

}


// ============================================================
// SAFE ACCESS ERROR RESPONSE
//
// Route handlers can do:
//
// const accessResponse =
//   runtimeAccessErrorResponse(error);
//
// if (accessResponse) {
//   return accessResponse;
// }
//
// Expected authorization failures therefore do not become
// generic HTTP 500 responses.
// ============================================================

export function runtimeAccessErrorResponse(
  error:
    unknown
) {

  if (
    error instanceof
      GrowthOSRuntimeAccessError
  ) {

    return NextResponse.json(
      {

        ok:
          false,

        error:
          error.code,

      },
      {
        status:
          error.status,
      }
    );

  }


  return null;

}