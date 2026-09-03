import type {
  IntegrationProvider,
} from './provider';


// ============================================================
// PROVIDER REGISTRY
//
// Providers register themselves here.
//
// Growth OS services never need giant:
//
// if provider === 'meta'
// if provider === 'google'
// ...
//
// Instead:
//
// getProvider('meta_ads')
//      ↓
// IntegrationProvider
// ============================================================


const providers =
  new Map<
    string,
    IntegrationProvider
  >();


// ============================================================
// REGISTER
// ============================================================

export function registerProvider(
  provider: IntegrationProvider
) {

  if (
    providers.has(
      provider.id
    )
  ) {

    throw new Error(
      `Integration provider already registered: ${provider.id}`
    );

  }


  providers.set(
    provider.id,
    provider
  );

}


// ============================================================
// GET
// ============================================================

export function getProvider(
  providerId: string
) {

  const provider =
    providers.get(
      providerId
    );


  if (!provider) {

    throw new Error(
      `Unknown integration provider: ${providerId}`
    );

  }


  return provider;

}


// ============================================================
// OPTIONAL GET
// ============================================================

export function findProvider(
  providerId: string
) {

  return (
    providers.get(
      providerId
    )
    ||
    null
  );

}


// ============================================================
// LIST
// ============================================================

export function listProviders() {

  return Array.from(
    providers.values()
  );

}