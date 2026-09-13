import bcrypt from 'bcryptjs';

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  createGrowthOSAccountRequest,
  listGrowthOSAccountRequests,
} from '@/lib/account/store';

import {
  writeGrowthOSAuditEventSafe,
} from '@/lib/audit';

import {
  authenticateRequest,
} from '@/lib/auth/request-auth';

import {
  getGrowthOSUserById,
} from '@/lib/auth/user-store';

import {
  getBillingAccount,
} from '@/lib/billing/store';

import {
  getGrowthOSWorkspaceSubscriptionSnapshot,
} from '@/lib/admin/control-plane';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// HELPERS
// ============================================================

function tenantFromIdentity(
  identity:
    NonNullable<
      Awaited<
        ReturnType<
          typeof authenticateRequest
        >
      >
    >
) {

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

    return null;

  }


  return {
    workspaceId,
    brandId,
  };

}


function canManageAccount(
  role:
    string | undefined
) {

  return (
    role ===
      'owner'
    ||
    role ===
      'admin'
  );

}


function canRequestDeletion(
  identity:
    NonNullable<
      Awaited<
        ReturnType<
          typeof authenticateRequest
        >
      >
    >
) {

  return (
    identity.role ===
      'owner'
    ||
    (
      identity.authMethod ===
        'shopify'
      &&
      identity.role ===
        'admin'
    )
  );

}


// ============================================================
// GET DATA & ACCOUNT SNAPSHOT
// ============================================================

export async function GET(
  request:
    NextRequest
) {

  try {

    const identity =
      await authenticateRequest(
        request
      );


    if (!identity) {

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


    const tenant =
      tenantFromIdentity(
        identity
      );


    if (!tenant) {

      return NextResponse.json(
        {
          ok:
            false,
          error:
            'ACTIVE_BRAND_REQUIRED',
        },
        {
          status:
            400,
        }
      );

    }


    const [
      requests,
      billingAccount,
      subscription,
    ] =
      await Promise.all([

        listGrowthOSAccountRequests(
          tenant.workspaceId,
          tenant.brandId
        ),

        getBillingAccount(
          tenant.workspaceId,
          tenant.brandId
        ),

        getGrowthOSWorkspaceSubscriptionSnapshot(
          tenant.workspaceId,
          tenant.brandId
        ),

      ]);


    return NextResponse.json({

      ok:
        true,

      workspace: {

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        dataRegion:
          process.env.GCP_BQ_LOCATION
          ||
          'asia-south1',

        retentionDays:
          process.env.GROWTHOS_DATA_RETENTION_DAYS
            ? Number(
                process.env.GROWTHOS_DATA_RETENTION_DAYS
              )
            : null,

      },

      permissions: {

        canRequestExport:
          canManageAccount(
            identity.role
          ),

        canRequestDeletion:
          canRequestDeletion(
            identity
          ),

      },

      security: {

        deletionReauth:
          identity.authMethod ===
            'password'
            ? 'password'
            : 'verified_session',

      },

      subscription: {

        configured:
          Boolean(
            subscription.configured
          ),

        status:
          subscription.subscription?.status
          ??
          null,

        planName:
          subscription.plan?.name
          ??
          null,

      },

      billing: billingAccount
        ? {

            channel:
              billingAccount.channel,

            provider:
              billingAccount.provider,

            status:
              billingAccount.status,

          }
        : null,

      requests,

    });

  } catch (
    error
  ) {

    console.error(
      'GROWTHOS_DATA_ACCOUNT_READ_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,
        error:
          'DATA_ACCOUNT_READ_FAILED',
      },
      {
        status:
          500,
      }
    );

  }

}


// ============================================================
// POST REQUEST
//
// V1 never hard-deletes workspace data.
// It records an auditable support/admin request.
// ============================================================

export async function POST(
  request:
    NextRequest
) {

  try {

    const identity =
      await authenticateRequest(
        request
      );


    if (!identity) {

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


    const tenant =
      tenantFromIdentity(
        identity
      );


    if (!tenant) {

      return NextResponse.json(
        {
          ok:
            false,
          error:
            'ACTIVE_BRAND_REQUIRED',
        },
        {
          status:
            400,
        }
      );

    }


    const body =
      await request.json();


    const action =
      String(
        body?.action
        ||
        ''
      ).trim();


    // ========================================================
    // DATA EXPORT
    // ========================================================

    if (
      action ===
        'request_export'
    ) {

      if (
        !canManageAccount(
          identity.role
        )
      ) {

        return NextResponse.json(
          {
            ok:
              false,
            error:
              'ACCOUNT_MANAGER_ACCESS_REQUIRED',
          },
          {
            status:
              403,
          }
        );

      }


      const accountRequest =
        await createGrowthOSAccountRequest({

          workspaceId:
            tenant.workspaceId,

          brandId:
            tenant.brandId,

          requestType:
            'data_export',

          requestedBy:
            identity.userId,

          requestedByEmail:
            identity.email
            ??
            null,

          reason:
            body?.reason
              ? String(
                  body.reason
                ).slice(
                  0,
                  2000
                )
              : null,

          metadata: {
            source:
              'settings_data_account',
          },

        });


      await writeGrowthOSAuditEventSafe({

        request,

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        category:
          'workspace',

        action:
          'workspace.data_export_requested',

        actorUserId:
          identity.userId,

        actorEmail:
          identity.email
          ??
          null,

        actorRole:
          identity.role
          ??
          null,

        targetType:
          'workspace',

        targetId:
          tenant.workspaceId,

        targetLabel:
          tenant.brandId,

        metadata: {
          requestId:
            accountRequest.requestId,
        },

      });


      return NextResponse.json({

        ok:
          true,

        request:
          accountRequest,

      });

    }


    // ========================================================
    // WORKSPACE DELETION REQUEST
    // ========================================================

    if (
      action ===
        'request_deletion'
    ) {

      if (
        !canRequestDeletion(
          identity
        )
      ) {

        return NextResponse.json(
          {
            ok:
              false,
            error:
              'OWNER_ACCESS_REQUIRED',
          },
          {
            status:
              403,
          }
        );

      }


      const expectedConfirmation =
        `DELETE ${tenant.brandId}`;


      if (
        String(
          body?.confirmation
          ||
          ''
        ).trim()
        !==
        expectedConfirmation
      ) {

        return NextResponse.json(
          {
            ok:
              false,
            error:
              'DELETION_CONFIRMATION_REQUIRED',
            expectedConfirmation,
          },
          {
            status:
              400,
          }
        );

      }


      // Password-auth users must re-authenticate.
      if (
        identity.authMethod ===
          'password'
      ) {

        const password =
          String(
            body?.currentPassword
            ||
            ''
          );


        if (!password) {

          return NextResponse.json(
            {
              ok:
                false,
              error:
                'CURRENT_PASSWORD_REQUIRED',
            },
            {
              status:
                400,
            }
          );

        }


        const user =
          await getGrowthOSUserById(
            identity.userId
          );


        if (
          !user?.password_hash
        ) {

          return NextResponse.json(
            {
              ok:
                false,
              error:
                'PASSWORD_LOGIN_NOT_CONFIGURED',
            },
            {
              status:
                409,
            }
          );

        }


        const validPassword =
          await bcrypt.compare(
            password,
            user.password_hash
          );


        if (!validPassword) {

          return NextResponse.json(
            {
              ok:
                false,
              error:
                'CURRENT_PASSWORD_INVALID',
            },
            {
              status:
                403,
            }
          );

        }

      }


      const accountRequest =
        await createGrowthOSAccountRequest({

          workspaceId:
            tenant.workspaceId,

          brandId:
            tenant.brandId,

          requestType:
            'workspace_deletion',

          requestedBy:
            identity.userId,

          requestedByEmail:
            identity.email
            ??
            null,

          reason:
            body?.reason
              ? String(
                  body.reason
                ).slice(
                  0,
                  2000
                )
              : null,

          metadata: {
            source:
              'settings_data_account',
            supportAssisted:
              true,
          },

        });


      await writeGrowthOSAuditEventSafe({

        request,

        workspaceId:
          tenant.workspaceId,

        brandId:
          tenant.brandId,

        category:
          'workspace',

        action:
          'workspace.deletion_requested',

        actorUserId:
          identity.userId,

        actorEmail:
          identity.email
          ??
          null,

        actorRole:
          identity.role
          ??
          null,

        targetType:
          'workspace',

        targetId:
          tenant.workspaceId,

        targetLabel:
          tenant.brandId,

        metadata: {
          requestId:
            accountRequest.requestId,
          supportAssisted:
            true,
        },

      });


      return NextResponse.json({

        ok:
          true,

        request:
          accountRequest,

      });

    }


    return NextResponse.json(
      {
        ok:
          false,
        error:
          'INVALID_ACCOUNT_ACTION',
      },
      {
        status:
          400,
      }
    );

  } catch (
    error
  ) {

    console.error(
      'GROWTHOS_DATA_ACCOUNT_ACTION_ERROR',
      error
    );


    return NextResponse.json(
      {
        ok:
          false,
        error:
          'DATA_ACCOUNT_ACTION_FAILED',
      },
      {
        status:
          500,
      }
    );

  }

}
