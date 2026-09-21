import 'server-only';

import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
);

export async function verifyCallCommercePubSubRequest(request: NextRequest) {
  const authorization = String(request.headers.get('authorization') || '').trim();
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    throw new Error('PUBSUB_OIDC_TOKEN_MISSING');
  }

  const token = authorization.slice(7).trim();
  if (!token) throw new Error('PUBSUB_OIDC_TOKEN_MISSING');

  const url = new URL(request.url);
  const expectedAudience = String(
    process.env.CALL_COMMERCE_PUBSUB_AUDIENCE || `${url.origin}${url.pathname}`
  ).trim();

  const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: expectedAudience,
  });

  const expectedServiceAccount = String(
    process.env.CALL_COMMERCE_PUBSUB_SERVICE_ACCOUNT || ''
  ).trim().toLowerCase();

  const tokenEmail = String(payload.email || '').trim().toLowerCase();
  if (expectedServiceAccount && tokenEmail !== expectedServiceAccount) {
    throw new Error('PUBSUB_OIDC_SERVICE_ACCOUNT_MISMATCH');
  }

  if (payload.email_verified === false) {
    throw new Error('PUBSUB_OIDC_EMAIL_NOT_VERIFIED');
  }

  return payload;
}
