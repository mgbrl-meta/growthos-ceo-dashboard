// ============================================================
// META PROVIDER
//
// Provider-specific Meta logic lives here.
//
// UI and Growth OS modules should never call Meta directly.
// ============================================================


// ============================================================
// CONFIG
// ============================================================

const META_APP_ID =
  process.env.META_APP_ID
  ||
  '';


const META_APP_SECRET =
  process.env.META_APP_SECRET
  ||
  '';


const META_API_VERSION =
  process.env.META_GRAPH_API_VERSION
  ||
  '';


const APP_URL =
  process.env.GROWTHOS_APP_URL
  ||
  '';


// ============================================================
// VALIDATION
// ============================================================

function validateMetaConfig() {

  const missing: string[] =
    [];


  if (!META_APP_ID) {

    missing.push(
      'META_APP_ID'
    );

  }


  if (!META_APP_SECRET) {

    missing.push(
      'META_APP_SECRET'
    );

  }


  if (!META_API_VERSION) {

    missing.push(
      'META_GRAPH_API_VERSION'
    );

  }


  if (!APP_URL) {

    missing.push(
      'GROWTHOS_APP_URL'
    );

  }


  if (
    missing.length
  ) {

    throw new Error(
      `Meta configuration missing: ${missing.join(', ')}`
    );

  }

}


// ============================================================
// CALLBACK URL
// ============================================================

export function getMetaCallbackUrl() {

  validateMetaConfig();


  return (
    `${APP_URL}/api/integrations/meta/callback`
  );

}


// ============================================================
// BUILD OAUTH URL
// ============================================================

export function buildMetaOAuthUrl(
  state: string
) {

  validateMetaConfig();


  const params =
    new URLSearchParams({

      client_id:
        META_APP_ID,

      redirect_uri:
        getMetaCallbackUrl(),

      state,

      response_type:
        'code',

      scope:
        [
          'ads_read',
          'business_management',
        ].join(','),

    });


  return (
    `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params.toString()}`
  );

}


// ============================================================
// EXCHANGE AUTHORIZATION CODE
// ============================================================

export async function exchangeMetaAuthorizationCode(
  code: string
) {

  validateMetaConfig();


  const params =
    new URLSearchParams({

      client_id:
        META_APP_ID,

      client_secret:
        META_APP_SECRET,

      redirect_uri:
        getMetaCallbackUrl(),

      code,

    });


  const response =
    await fetch(

      `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?${params.toString()}`,

      {
        cache:
          'no-store',
      }

    );


  const raw =
    await response.text();


  let json: any;


  try {

    json =
      JSON.parse(
        raw
      );

  } catch {

    throw new Error(
      `Meta OAuth returned ${response.status} instead of JSON`
    );

  }


  if (
    !response.ok ||
    !json?.access_token
  ) {

    throw new Error(
      json?.error?.message
      ||
      'Meta OAuth token exchange failed'
    );

  }


  return {

    accessToken:
      String(
        json.access_token
      ),

    tokenType:
      json.token_type
      ||
      null,

    expiresIn:
      json.expires_in
      ||
      null,

  };

}


// ============================================================
// LONG-LIVED TOKEN
// ============================================================

export async function exchangeForLongLivedMetaToken(
  accessToken: string
) {

  validateMetaConfig();


  const params =
    new URLSearchParams({

      grant_type:
        'fb_exchange_token',

      client_id:
        META_APP_ID,

      client_secret:
        META_APP_SECRET,

      fb_exchange_token:
        accessToken,

    });


  const response =
    await fetch(

      `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?${params.toString()}`,

      {
        cache:
          'no-store',
      }

    );


  const raw =
    await response.text();


  let json: any;


  try {

    json =
      JSON.parse(
        raw
      );

  } catch {

    /*
     * Original token remains valid.
     */
    return {

      accessToken,

      expiresIn:
        null,

    };

  }


  if (
    !response.ok ||
    !json?.access_token
  ) {

    return {

      accessToken,

      expiresIn:
        null,

    };

  }


  return {

    accessToken:
      String(
        json.access_token
      ),

    expiresIn:
      json.expires_in
      ||
      null,

  };

}


// ============================================================
// CURRENT META USER
// ============================================================

export async function fetchMetaUser(
  accessToken: string
) {

  validateMetaConfig();


  const params =
    new URLSearchParams({

      fields:
        'id,name',

      access_token:
        accessToken,

    });


  const response =
    await fetch(

      `https://graph.facebook.com/${META_API_VERSION}/me?${params.toString()}`,

      {
        cache:
          'no-store',
      }

    );


  const json =
    await response.json();


  if (!response.ok) {

    throw new Error(
      json?.error?.message
      ||
      'Unable to verify Meta user'
    );

  }


  return {

    id:
      String(
        json.id
      ),

    name:
      String(
        json.name
        ||
        ''
      ),

  };

}

// ============================================================
// META AD ACCOUNT
// ============================================================

export type MetaAdAccount = {

  id: string;

  account_id: string;

  name: string;

  currency?: string | null;

  timezone_name?: string | null;

  account_status?: number | null;

};


// ============================================================
// GET META AD ACCOUNTS
//
// Returns every ad account available to the authorized
// Meta user.
//
// Handles Graph API pagination automatically.
//
// Token remains server-side.
// ============================================================

export async function getMetaAdAccounts(
  accessToken: string
):
  Promise<MetaAdAccount[]> {

  validateMetaConfig();


  if (!accessToken) {

    throw new Error(
      'Meta access token is required'
    );

  }


  const accounts:
    MetaAdAccount[] = [];


  const params =
    new URLSearchParams({

      fields:
        [
          'id',
          'account_id',
          'name',
          'currency',
          'timezone_name',
          'account_status',
        ].join(','),

      limit:
        '100',

      access_token:
        accessToken,

    });


  let nextUrl:
    string | null =
      (
        `https://graph.facebook.com/` +
        `${META_API_VERSION}/me/adaccounts?` +
        params.toString()
      );


  // ==========================================================
  // PAGINATION
  // ==========================================================

  while (nextUrl) {

    const response =
      await fetch(
        nextUrl,
        {
          cache:
            'no-store',
        }
      );


    let json:
      any;


    try {

      json =
        await response.json();

    } catch {

      throw new Error(
        `Meta ad accounts returned ${response.status} instead of JSON`
      );

    }


    if (
      !response.ok
      ||
      json?.error
    ) {

      throw new Error(
        json?.error?.message
        ||
        'Unable to load Meta ad accounts'
      );

    }


    const rows =
      Array.isArray(
        json?.data
      )
        ? json.data
        : [];


    for (
      const row of rows
    ) {

      const id =
        String(
          row?.id
          ||
          ''
        ).trim();


      const accountId =
        String(
          row?.account_id
          ||
          ''
        ).trim();


      if (
        !id
        ||
        !accountId
      ) {

        continue;

      }


      accounts.push({

        id,

        account_id:
          accountId,

        name:
          String(
            row?.name
            ||
            accountId
          ),

        currency:
          row?.currency
            ? String(
                row.currency
              )
            : null,

        timezone_name:
          row?.timezone_name
            ? String(
                row.timezone_name
              )
            : null,

        account_status:
          Number.isFinite(
            Number(
              row?.account_status
            )
          )
            ? Number(
                row.account_status
              )
            : null,

      });

    }


    const next =
      String(
        json?.paging?.next
        ||
        ''
      ).trim();


    nextUrl =
      next
        ? next
        : null;

  }


  return accounts;

}