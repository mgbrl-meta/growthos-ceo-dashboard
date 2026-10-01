import 'server-only';

import * as postgres from './repository-postgres';
import * as bigquery from './repository-bigquery';
import { isCallCommercePostgres } from '@/lib/operational-postgres/store';

const impl = (isCallCommercePostgres() ? postgres : bigquery) as typeof postgres;

export const listCallingConnections = impl.listCallingConnections;
export const getCallingConnectionById = impl.getCallingConnectionById;
export const getCallingConnectionByIdFast = impl.getCallingConnectionByIdFast;
export const createCallingConnection = impl.createCallingConnection;
export const deleteCallingConnection = impl.deleteCallingConnection;
export const saveMappingVersion = impl.saveMappingVersion;
export const storeTestEvent = impl.storeTestEvent;
export const getLatestTestEvent = impl.getLatestTestEvent;
export const listLeads = impl.listLeads;
export const getLeadHistory = impl.getLeadHistory;
export const updateLeadWorkflow = impl.updateLeadWorkflow;
export const createManualLead = impl.createManualLead;
export const getSummary = impl.getSummary;
export const getSystemStatus = impl.getSystemStatus;
export const archiveEligibleLeads = impl.archiveEligibleLeads;
