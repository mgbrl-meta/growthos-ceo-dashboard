import 'server-only';

// ============================================================
// GROWTH OS AUTH CONFIG
// ============================================================

function env(
  name: string
): string {

  return String(
    process.env[name] || ''
  ).trim();

}


function requiredEnv(
  name: string
): string {

  const value =
    env(name);


  if (!value) {

    throw new Error(
      `Missing required environment variable: ${name}`
    );

  }


  return value;

}


// ============================================================
// PUBLIC GROWTH OS SESSION
// ============================================================

export const SESSION_COOKIE_NAME =
  'growthos_session';

export const SESSION_ISSUER =
  'growthos';

export const SESSION_AUDIENCE =
  'growthos-web';

export const SESSION_TTL_SECONDS =
  60 * 60 * 24 * 7;


// ============================================================
// SESSION SECRET
// ============================================================

export function getSessionSecret() {

  const secret =
    requiredEnv(
      'GROWTHOS_SESSION_SECRET'
    );


  if (
    secret.length < 32
  ) {

    throw new Error(
      'GROWTHOS_SESSION_SECRET must be at least 32 characters'
    );

  }


  return secret;

}


// ============================================================
// PUBLIC LOGIN
// ============================================================

export function getPublicAdminEmail() {

  return requiredEnv(
    'GROWTHOS_ADMIN_EMAIL'
  )
    .toLowerCase();

}


export function getPublicAdminPasswordHash() {

  return requiredEnv(
    'GROWTHOS_ADMIN_PASSWORD_HASH'
  );

}


export function getPublicAdminTenantId() {

  return (
    env(
      'GROWTHOS_ADMIN_TENANT_ID'
    )
    ||
    'brillare'
  );

}


// ============================================================
// SHOPIFY APP
// ============================================================

export function getShopifyClientId() {

  return requiredEnv(
    'SHOPIFY_CLIENT_ID'
  );

}


export function getShopifyClientSecret() {

  return requiredEnv(
    'SHOPIFY_CLIENT_SECRET'
  );

}


/*
 * September 2026 current stable Admin API version.
 */
export function getShopifyApiVersion() {

  return (
    env(
      'SHOPIFY_API_VERSION'
    )
    ||
    '2026-07'
  );

}


// ============================================================
// PRIMARY SHOPIFY TENANT
//
// V1 = one Shopify store.
//
// Later this will move into a proper tenant registry table.
// ============================================================

export function getPrimaryShopifyTenantId() {

  return (
    env(
      'SHOPIFY_PRIMARY_TENANT_ID'
    )
    ||
    'brillare'
  );

}


export function getPrimaryShopifyShopDomain() {

  return normalizeShopDomain(
    requiredEnv(
      'SHOPIFY_PRIMARY_SHOP_DOMAIN'
    )
  );

}


/*
 * During initial bootstrap this may temporarily be empty.
 *
 * Once we resolve the real Shopify Shop ID, this MUST
 * be populated before normal Shopify authorization.
 */
export function getPrimaryShopifyShopId() {

  return env(
    'SHOPIFY_PRIMARY_SHOP_ID'
  );

}


// ============================================================
// DOMAIN NORMALIZATION
// ============================================================

export function normalizeShopDomain(
  value: string
) {

  let result =
    String(
      value || ''
    )
      .trim()
      .toLowerCase();


  if (!result) {

    return '';

  }


  try {

    if (
      result.startsWith(
        'https://'
      )
      ||
      result.startsWith(
        'http://'
      )
    ) {

      result =
        new URL(
          result
        ).hostname;

    }

  } catch {

    return '';

  }


  result =
    result
      .replace(
        /^https?:\/\//,
        ''
      )
      .replace(
        /\/.*$/,
        ''
      )
      .replace(
        /\.$/,
        '');


  return result;

}