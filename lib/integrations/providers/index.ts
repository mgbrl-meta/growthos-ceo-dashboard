import {
  registerProvider,
} from '../provider-registry';

import {
  metaDevelopmentProvider,
  googleDevelopmentProvider,
  shopifyDevelopmentProvider,
} from './development';

import {
  bigQueryProvider,
} from './bigquery';


let registered =
  false;


// ============================================================
// REGISTER BUILT-IN PROVIDERS
//
// Idempotent.
//
// Safe under Next.js hot reload.
// ============================================================

export function registerBuiltInProviders() {

  if (registered) {

    return;

  }


  registerProvider(
    shopifyDevelopmentProvider
  );


  registerProvider(
    metaDevelopmentProvider
  );


  registerProvider(
    googleDevelopmentProvider
  );


  registerProvider(
    bigQueryProvider
  );


  registered =
    true;

}