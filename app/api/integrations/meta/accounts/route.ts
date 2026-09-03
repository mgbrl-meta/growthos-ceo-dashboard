import {
  NextResponse,
} from 'next/server';

import {
  getMetaAdAccounts,
} from '@/lib/integrations/providers/meta';

import {
  readIntegrationSecret,
} from '@/lib/integrations/secrets';

import {
  resolveTenantContext,
} from '@/lib/tenancy/context';

import {
  getIntegrationConnection,
} from '@/lib/integrations/store';


export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';


// ============================================================
// META AD ACCOUNTS
//
// Current Growth OS tenant
//        ↓
// Meta connection
//        ↓
// Secret Manager token
//        ↓
// Meta /me/adaccounts
// ============================================================

export async function GET() {

  try {

    // ========================================================
    // TENANT
    // ========================================================

    const tenant =
      await resolveTenantContext();


    // ========================================================
    // META CONNECTION
    // ========================================================

    const connection =
      await getIntegrationConnection(

        tenant.workspaceId,

        tenant.brandId,

        'meta_ads'

      );


    if (
      !connection
      ||
      !connection.secret_name
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          error:
            'Meta is not authorized',

        },
        {
          status:
            404,
        }
      );

    }


    // ========================================================
    // SECRET MANAGER
    // ========================================================

    const secret =
      await readIntegrationSecret<{

        access_token:
          string;

      }>(
        connection.secret_name
      );


    if (
      !secret.access_token
    ) {

      throw new Error(
        'Meta credential contains no access token'
      );

    }


    // ========================================================
    // META AD ACCOUNTS
    // ========================================================

    const accounts =
      await getMetaAdAccounts(
        secret.access_token
      );


    return NextResponse.json({

      ok:
        true,

      data: {

        accounts,

      },

    });


  } catch (
    error: any
  ) {

    const message =
      String(
        error?.message
        ||
        'Unable to load Meta accounts'
      );


    console.error(
      'META_ACCOUNTS_ERROR',
      {
        message,
      }
    );


    return NextResponse.json(
      {

        ok:
          false,

        error:
          message,

      },
      {
        status:
          500,
      }
    );

  }

}