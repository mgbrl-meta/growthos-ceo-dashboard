import 'server-only';

import * as postgres from './settings-store-postgres';
import * as bigquery from './settings-store-bigquery';
import { isCallCommercePostgres } from '@/lib/operational-postgres/store';

const impl = (isCallCommercePostgres() ? postgres : bigquery) as typeof postgres;

export type { CallCommerceSettings } from './settings-store-postgres';
export const CALL_COMMERCE_SETTINGS_DEFAULTS = impl.CALL_COMMERCE_SETTINGS_DEFAULTS;
export const getCallCommerceSettings = impl.getCallCommerceSettings;
export const getCallCommerceSettingsCached = impl.getCallCommerceSettingsCached;
export const updateCallCommerceSettings = impl.updateCallCommerceSettings;
