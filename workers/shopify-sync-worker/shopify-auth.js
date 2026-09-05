import {
  SecretManagerServiceClient,
} from '@google-cloud/secret-manager';


const PROJECT_ID =
  String(
    process.env.GCP_PROJECT_ID
    ||
    process.env.GOOGLE_CLOUD_PROJECT
    ||
    ''
  ).trim();


const SHOPIFY_CLIENT_ID =
  String(
    process.env.SHOPIFY_CLIENT_ID
    ||
    ''
  ).trim();


const SHOPIFY_CLIENT_SECRET =
  String(
    process.env.SHOPIFY_CLIENT_SECRET
    ||
    ''
  ).trim();


const secretManager =
  new SecretManagerServiceClient({

    projectId:
      PROJECT_ID,

  });


// ============================================================
// REQUIRED VALUE
// ============================================================

function requireValue(
  value,
  errorCode
) {

  const normalized =
    String(
      value
      ??
      ''
    ).trim();


  if (!normalized) {

    throw new Error(
      errorCode
    );

  }


  return normalized;

}


// ============================================================
// EXPIRY
// ============================================================

function createExpiry(
  expiresIn
) {

  const seconds =
    Number(
      expiresIn
    );


  if (
    !Number.isFinite(
      seconds
    )
    ||
    seconds <= 0
  ) {

    return null;

  }


  return new Date(
    Date.now()
    +
    seconds * 1000
  ).toISOString();

}


// ============================================================
// STORE NEW TOKEN VERSION
//
// Secret Manager logical secret remains unchanged.
//
// Refresh:
//
// version 1
//    ↓
// version 2
//    ↓
// version 3
//
// connection.secret_name never changes.
// ============================================================

async function storeRefreshedCredential(
  secretName,
  credential
) {

  const name =
    requireValue(
      secretName,
      'SHOPIFY_REFRESH_SECRET_NAME_MISSING'
    );


  await secretManager
    .addSecretVersion({

      parent:
        name,

      payload: {

        data:
          Buffer.from(
            JSON.stringify(
              credential
            ),
            'utf8'
          ),

      },

    });

}


// ============================================================
// REFRESH OFFLINE TOKEN
// ============================================================

async function refreshCredential(
  runtime
) {

  requireValue(
    SHOPIFY_CLIENT_ID,
    'SHOPIFY_WORKER_CLIENT_ID_MISSING'
  );


  requireValue(
    SHOPIFY_CLIENT_SECRET,
    'SHOPIFY_WORKER_CLIENT_SECRET_MISSING'
  );


  const refreshToken =
    requireValue(
      runtime
        .credential
        .refreshToken,
      'SHOPIFY_REFRESH_TOKEN_MISSING'
    );


  if (
    runtime
      .credential
      .refreshTokenExpired
  ) {

    throw new Error(
      'SHOPIFY_REFRESH_REAUTH_REQUIRED'
    );

  }


  const shopDomain =
    runtime
      .credential
      .shopDomain;


  const response =
    await fetch(

      `https://${shopDomain}/admin/oauth/access_token`,

      {

        method:
          'POST',

        headers: {

          'Content-Type':
            'application/x-www-form-urlencoded',

          'Accept':
            'application/json',

        },

        body:
          new URLSearchParams({

            client_id:
              SHOPIFY_CLIENT_ID,

            client_secret:
              SHOPIFY_CLIENT_SECRET,

            grant_type:
              'refresh_token',

            refresh_token:
              refreshToken,

          }),

      }

    );


  const raw =
    await response.text();


  let json;


  try {

    json =
      JSON.parse(
        raw
      );

  } catch {

    throw new Error(
      'SHOPIFY_REFRESH_RESPONSE_INVALID'
    );

  }


  if (!response.ok) {

    console.error(
      'SHOPIFY_WORKER_REFRESH_FAILED',
      {

        status:
          response.status,

        error:
          json?.error
          ??
          null,

      }
    );


    if (
      response.status ===
        401
    ) {

      throw new Error(
        'SHOPIFY_REFRESH_REAUTH_REQUIRED'
      );

    }


    throw new Error(
      `SHOPIFY_REFRESH_FAILED_${response.status}`
    );

  }


  const accessToken =
    requireValue(
      json?.access_token,
      'SHOPIFY_REFRESH_ACCESS_TOKEN_MISSING'
    );


  const newRefreshToken =
    requireValue(
      json?.refresh_token,
      'SHOPIFY_REFRESH_TOKEN_ROTATION_MISSING'
    );


  const now =
    new Date()
      .toISOString();


  const refreshedCredential = {

    schema_version:
      1,

    credential_type:
      'shopify_offline_expiring',

    provider:
      'shopify',

    shop_id:
      runtime
        .credential
        .shopId,

    shop_domain:
      runtime
        .credential
        .shopDomain,

    shop_name:
      runtime
        .credential
        .shopName
      ??
      null,

    access_token:
      accessToken,

    refresh_token:
      newRefreshToken,

    scope:
      String(
        json?.scope
        ||
        runtime
          .credential
          .scope
        ||
        ''
      ),

    issued_at:
      now,

    access_token_expires_at:
      createExpiry(
        json?.expires_in
      ),

    refresh_token_expires_at:
      createExpiry(
        json?.refresh_token_expires_in
      ),

    updated_at:
      now,

  };


  // ==========================================================
  // STORE NEW PAIR BEFORE USING IT
  // ==========================================================

  await storeRefreshedCredential(

    runtime
      .connection
      .secret_name,

    refreshedCredential

  );


  return {

    accessToken,

    refreshed:
      true,

  };

}


// ============================================================
// GET VALID ACCESS TOKEN
// ============================================================

export async function getValidShopifyAccessToken(
  runtime,
  options = {}
) {

  const forceRefresh =
    Boolean(
      options.forceRefresh
    );


  if (
    !forceRefresh
    &&
    !runtime
      .credential
      .accessTokenExpired
  ) {

    return {

      accessToken:
        runtime
          .credential
          .accessToken,

      refreshed:
        false,

    };

  }


  return refreshCredential(
    runtime
  );

}