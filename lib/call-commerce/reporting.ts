import 'server-only';

import { isCallCommercePostgres } from '@/lib/operational-postgres/store';
import * as bigqueryStore from './reporting-bigquery';
import * as postgresStore from './reporting-postgres';

export type {
  CallCommerceReportType,
  CallCommerceReportInput,
} from './reporting-bigquery';

import type { CallCommerceReportInput } from './reporting-bigquery';

export function getArchiveFacets(workspaceId: string, brandId: string) {
  return isCallCommercePostgres()
    ? postgresStore.getArchiveFacets(workspaceId, brandId)
    : bigqueryStore.getArchiveFacets(workspaceId, brandId);
}

export function getCallCommerceReportRaw(input: CallCommerceReportInput) {
  return isCallCommercePostgres()
    ? postgresStore.getCallCommerceReportRaw(input)
    : bigqueryStore.getCallCommerceReportRaw(input);
}
