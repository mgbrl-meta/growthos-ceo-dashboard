import 'server-only';

import {
  GrowthOSRuntimeAccessError,
} from '@/lib/auth/runtime-guard';


const LEGACY_BRILLARE_BRAND_ID =
  process.env.GROWTHOS_LEGACY_BRILLARE_BRAND_ID
  ||
  'brillare';


export function requireLegacyBrillareDataScope(
  brandId:
    string
) {

  if (
    String(
      brandId ||
      ''
    ).trim()
    !==
    LEGACY_BRILLARE_BRAND_ID
  ) {

    throw new GrowthOSRuntimeAccessError(
      'DATA_TENANT_NOT_ROUTED',
      'This tenant has not yet been migrated to the canonical Growth OS data layer',
      403
    );

  }

}