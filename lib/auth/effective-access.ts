import 'server-only';

import type {
  AuthIdentity,
} from './request-auth';

import {
  getActiveBrandMembershipFast,
} from './user-store';

import {
  getGrowthOSWorkspaceSubscriptionSnapshot,
  listGrowthOSUserModulePermissionsFast,
  listGrowthOSUserSubmodulePermissionsFast,
} from '@/lib/admin/control-plane';

import {
  GROWTHOS_SUBMODULES,
} from './submodule-registry';


// ============================================================
// TYPES
// ============================================================

export type GrowthOSEffectivePermission =
  | 'disabled'
  | 'viewer'
  | 'editor';


export type GrowthOSConfiguredPermission =
  | 'inherit'
  | 'viewer'
  | 'editor'
  | 'disabled';


export type GrowthOSEffectiveRole =
  | 'owner'
  | 'admin'
  | 'analyst'
  | 'viewer';


export type GrowthOSEffectiveSubmoduleAccess = {

  moduleId:
    string;

  submoduleId:
    string;

  label:
    string;

  configuredPermission:
    GrowthOSConfiguredPermission |
    null;

  effectivePermission:
    GrowthOSEffectivePermission;

};


export type GrowthOSEffectiveModuleAccess = {

  moduleId:
    string;

  name:
    string | null;

  category:
    string | null;

  routeKey:
    string | null;

  moduleStatus:
    string | null;

  planEnabled:
    boolean;

  brandOverride:
    string;

  brandEnabled:
    boolean;

  configuredPermission:
    GrowthOSConfiguredPermission |
    null;

  effectivePermission:
    GrowthOSEffectivePermission;

  submodules:
    Record<
      string,
      GrowthOSEffectiveSubmoduleAccess
    >;

};


export type GrowthOSEffectiveAccessSnapshot = {

  userId:
    string;

  membershipId:
    string;

  workspaceId:
    string;

  brandId:
    string;

  role:
    GrowthOSEffectiveRole;

  authMethod:
    string | null;

  syntheticMembership:
    boolean;

  subscriptionConfigured:
    boolean;

  planId:
    string | null;

  planName:
    string | null;

  modules:
    Record<
      string,
      GrowthOSEffectiveModuleAccess
    >;

};


// ============================================================
// ACCESS ERROR
// ============================================================

export class GrowthOSEffectiveAccessError
  extends Error {

  code:
    string;


  constructor(
    code:
      string,
    message:
      string
  ) {

    super(
      message
    );

    this.name =
      'GrowthOSEffectiveAccessError';

    this.code =
      code;

  }

}


// ============================================================
// PERMISSION HELPERS
// ============================================================

function permissionRank(
  permission:
    GrowthOSEffectivePermission
) {

  switch (
    permission
  ) {

    case 'editor':
      return 2;

    case 'viewer':
      return 1;

    default:
      return 0;

  }

}


function capPermission(

  requested:
    GrowthOSEffectivePermission,

  maximum:
    GrowthOSEffectivePermission

):
  GrowthOSEffectivePermission {

  return permissionRank(
    requested
  ) <= permissionRank(
    maximum
  )
    ? requested
    : maximum;

}


function normalizeConfiguredPermission(
  value:
    unknown
):
  GrowthOSConfiguredPermission |
  null {

  if (
    value === 'inherit'
    ||
    value === 'viewer'
    ||
    value === 'editor'
    ||
    value === 'disabled'
  ) {

    return value;

  }

  return null;

}


function normalizeRole(
  value:
    unknown
):
  GrowthOSEffectiveRole {

  if (
    value === 'owner'
    ||
    value === 'admin'
    ||
    value === 'analyst'
    ||
    value === 'viewer'
  ) {

    return value;

  }

  return 'viewer';

}


function roleDefaultPermission(
  role:
    GrowthOSEffectiveRole
):
  GrowthOSEffectivePermission {

  return role === 'viewer'
    ? 'viewer'
    : 'editor';

}


// ============================================================
// MODULE RESOLUTION
// ============================================================

function resolveModulePermission({

  brandEnabled,
  configuredPermission,
  role,
  syntheticMembership,

}: {

  brandEnabled:
    boolean;

  configuredPermission:
    GrowthOSConfiguredPermission |
    null;

  role:
    GrowthOSEffectiveRole;

  syntheticMembership:
    boolean;

}):
  GrowthOSEffectivePermission {

  if (!brandEnabled) {

    return 'disabled';

  }


  // Verified Shopify session:
  //
  // no brand_memberships row exists.
  //
  // Commercial entitlement still caps access.

  if (syntheticMembership) {

    return roleDefaultPermission(
      role
    );

  }


  // Normal user = fail closed.

  if (!configuredPermission) {

    return 'disabled';

  }


  switch (
    configuredPermission
  ) {

    case 'disabled':
      return 'disabled';

    case 'viewer':
      return 'viewer';

    case 'editor':
      return 'editor';

    case 'inherit':
      return roleDefaultPermission(
        role
      );

    default:
      return 'disabled';

  }

}


// ============================================================
// SUBMODULE RESOLUTION
// ============================================================

function resolveSubmodulePermission({

  parentPermission,
  configuredPermission,
  syntheticMembership,

}: {

  parentPermission:
    GrowthOSEffectivePermission;

  configuredPermission:
    GrowthOSConfiguredPermission |
    null;

  syntheticMembership:
    boolean;

}):
  GrowthOSEffectivePermission {

  if (
    parentPermission === 'disabled'
  ) {

    return 'disabled';

  }


  if (syntheticMembership) {

    return parentPermission;

  }


  if (!configuredPermission) {

    return 'disabled';

  }


  switch (
    configuredPermission
  ) {

    case 'disabled':
      return 'disabled';

    case 'inherit':
      return parentPermission;

    case 'viewer':

      return capPermission(
        'viewer',
        parentPermission
      );

    case 'editor':

      return capPermission(
        'editor',
        parentPermission
      );

    default:
      return 'disabled';

  }

}


// ============================================================
// CANONICAL EFFECTIVE ACCESS RESOLVER
// ============================================================

export async function resolveGrowthOSEffectiveAccess(
  identity:
    AuthIdentity
):

  Promise<
    GrowthOSEffectiveAccessSnapshot
  > {

  const userId =
    String(
      identity.userId ||
      ''
    ).trim();


  const workspaceId =
    String(
      identity.workspaceId ||
      ''
    ).trim();


  const brandId =
    String(
      identity.brandId ||
      ''
    ).trim();


  if (!userId) {

    throw new GrowthOSEffectiveAccessError(
      'USER_REQUIRED',
      'Authenticated user is required'
    );

  }


  if (
    !workspaceId
    ||
    !brandId
  ) {

    throw new GrowthOSEffectiveAccessError(
      'ACTIVE_BRAND_REQUIRED',
      'Active workspace and brand are required'
    );

  }


  // ==========================================================
  // SHOPIFY SYNTHETIC SESSION
  // ==========================================================

  const syntheticMembership =
    identity.authMethod ===
      'shopify';


  let membershipId =
    '';


  let role:
    GrowthOSEffectiveRole;


  if (syntheticMembership) {

    membershipId =
      `shopify-session:${userId}`;


    role =
      normalizeRole(
        identity.role ||
        'admin'
      );

  } else {

    // ========================================================
    // NORMAL PASSWORD USER
    //
    // Re-check membership so this resolver is safe even when
    // called independently.
    // ========================================================

    const membership =
      await getActiveBrandMembershipFast(
        userId,
        workspaceId,
        brandId
      );


    if (!membership) {

      throw new GrowthOSEffectiveAccessError(
        'ACTIVE_MEMBERSHIP_REQUIRED',
        'Active Growth OS membership is required'
      );

    }


    membershipId =
      String(
        membership.membership_id ||
        ''
      ).trim();


    if (!membershipId) {

      throw new GrowthOSEffectiveAccessError(
        'MEMBERSHIP_ID_REQUIRED',
        'Active membership could not be resolved'
      );

    }


    role =
      normalizeRole(
        membership.role
      );

  }


  // ==========================================================
  // CONTROL PLANE
  // ==========================================================

  const subscriptionPromise =
    getGrowthOSWorkspaceSubscriptionSnapshot(
      workspaceId,
      brandId
    );


  const modulePermissionPromise =
    syntheticMembership

      ? Promise.resolve([])

      : listGrowthOSUserModulePermissionsFast(
          membershipId
        );


  const submodulePermissionPromise =
    syntheticMembership

      ? Promise.resolve([])

      : listGrowthOSUserSubmodulePermissionsFast(
          membershipId
        );


  const [
    subscription,
    modulePermissions,
    submodulePermissions,
  ] =
    await Promise.all([

      subscriptionPromise,
      modulePermissionPromise,
      submodulePermissionPromise,

    ]);


  // ==========================================================
  // LOOKUPS
  // ==========================================================

  const modulePermissionMap =
    new Map<
      string,
      GrowthOSConfiguredPermission
    >();


  for (
    const permission
    of modulePermissions as any[]
  ) {

    const moduleId =
      String(
        permission.module_id ||
        ''
      ).trim();


    const normalized =
      normalizeConfiguredPermission(
        permission.permission
      );


    if (
      moduleId
      &&
      normalized
    ) {

      modulePermissionMap.set(
        moduleId,
        normalized
      );

    }

  }


  const submodulePermissionMap =
    new Map<
      string,
      GrowthOSConfiguredPermission
    >();


  for (
    const permission
    of submodulePermissions as any[]
  ) {

    const moduleId =
      String(
        permission.module_id ||
        ''
      ).trim();


    const submoduleId =
      String(
        permission.submodule_id ||
        ''
      ).trim();


    const normalized =
      normalizeConfiguredPermission(
        permission.permission
      );


    if (
      moduleId
      &&
      submoduleId
      &&
      normalized
    ) {

      submodulePermissionMap.set(
        `${moduleId}:${submoduleId}`,
        normalized
      );

    }

  }


  // ==========================================================
  // RESOLVE
  // ==========================================================

  const resolvedModules:
    Record<
      string,
      GrowthOSEffectiveModuleAccess
    > = {};


  for (
    const module
    of subscription.modules || []
  ) {

    const moduleId =
      String(
        module.moduleId ||
        ''
      ).trim();


    if (!moduleId) {

      continue;

    }


    const brandEnabled =
      Boolean(
        module.enabled
      )
      &&
      module.status ===
        'active';


    const configuredPermission =
      syntheticMembership

        ? 'inherit'

        : (
            modulePermissionMap.get(
              moduleId
            )
            ??
            null
          );


    const effectivePermission =
      resolveModulePermission({

        brandEnabled,
        configuredPermission,
        role,
        syntheticMembership,

      });


    const resolvedSubmodules:
      Record<
        string,
        GrowthOSEffectiveSubmoduleAccess
      > = {};


    for (
      const submodule
      of GROWTHOS_SUBMODULES.filter(
        item =>
          item.moduleId ===
            moduleId
      )
    ) {

      const key =
        `${moduleId}:${submodule.submoduleId}`;


      const configuredSubmodulePermission =
        syntheticMembership

          ? 'inherit'

          : (
              submodulePermissionMap.get(
                key
              )
              ??
              null
            );


      const effectiveSubmodulePermission =
        resolveSubmodulePermission({

          parentPermission:
            effectivePermission,

          configuredPermission:
            configuredSubmodulePermission,

          syntheticMembership,

        });


      resolvedSubmodules[
        submodule.submoduleId
      ] = {

        moduleId,

        submoduleId:
          submodule.submoduleId,

        label:
          submodule.label,

        configuredPermission:
          configuredSubmodulePermission,

        effectivePermission:
          effectiveSubmodulePermission,

      };

    }


    resolvedModules[
      moduleId
    ] = {

      moduleId,

      name:
        module.name ?? null,

      category:
        module.category ?? null,

      routeKey:
        module.routeKey ?? null,

      moduleStatus:
        module.status ?? null,

      planEnabled:
        Boolean(
          module.planEnabled
        ),

      brandOverride:
        String(
          module.brandOverride ||
          'default'
        ),

      brandEnabled,

      configuredPermission,

      effectivePermission,

      submodules:
        resolvedSubmodules,

    };

  }


  return {

    userId,

    membershipId,

    workspaceId,

    brandId,

    role,

    authMethod:
      identity.authMethod ??
      null,

    syntheticMembership,

    subscriptionConfigured:
      Boolean(
        subscription.configured
      ),

    planId:
      subscription.plan?.planId ??
      null,

    planName:
      subscription.plan?.name ??
      null,

    modules:
      resolvedModules,

  };

}


// ============================================================
// READ EFFECTIVE PERMISSION
// ============================================================

export function getGrowthOSEffectiveModulePermission(

  access:
    GrowthOSEffectiveAccessSnapshot,

  moduleId:
    string

):
  GrowthOSEffectivePermission {

  return (
    access.modules[
      String(
        moduleId ||
        ''
      ).trim()
    ]?.effectivePermission
    ??
    'disabled'
  );

}


export function getGrowthOSEffectiveSubmodulePermission(

  access:
    GrowthOSEffectiveAccessSnapshot,

  moduleId:
    string,

  submoduleId:
    string

):
  GrowthOSEffectivePermission {

  return (
    access.modules[
      String(
        moduleId ||
        ''
      ).trim()
    ]
      ?.submodules[
        String(
          submoduleId ||
          ''
        ).trim()
      ]
      ?.effectivePermission
    ??
    'disabled'
  );

}


// ============================================================
// ACCESS CHECK
// ============================================================

export function hasGrowthOSAccess({

  access,
  moduleId,
  submoduleId,
  required =
    'viewer',

}: {

  access:
    GrowthOSEffectiveAccessSnapshot;

  moduleId:
    string;

  submoduleId?:
    string;

  required?:
    'viewer' |
    'editor';

}) {

  const actual =
    submoduleId

      ? getGrowthOSEffectiveSubmodulePermission(
          access,
          moduleId,
          submoduleId
        )

      : getGrowthOSEffectiveModulePermission(
          access,
          moduleId
        );


  return (
    permissionRank(
      actual
    )
    >=
    permissionRank(
      required
    )
  );

}