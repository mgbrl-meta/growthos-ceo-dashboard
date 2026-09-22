export type CallLeadStatus =
  | 'NEW'
  | 'QUALIFIED'
  | 'FOLLOW_UP'
  | 'PURCHASED'
  | 'UNQUALIFIED'
  | 'CLOSED_LOST';

export type CanonicalCallEventType =
  | 'RINGING'
  | 'STARTED'
  | 'ANSWERED'
  | 'UPDATED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED';

export type CanonicalCallStatus =
  | 'RINGING'
  | 'ANSWERED'
  | 'MISSED'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'REJECTED'
  | 'FAILED'
  | 'UNKNOWN';

export type CanonicalDirection =
  | 'INBOUND'
  | 'OUTBOUND'
  | 'UNKNOWN';


export type CanonicalDisconnectParty =
  | 'CUSTOMER'
  | 'AGENT'
  | 'BUSINESS_ROUTING'
  | 'SYSTEM'
  | 'UNKNOWN';

export type CanonicalCallEndReason =
  | 'CALLER_DROPPED_BEFORE_ANSWER'
  | 'CUSTOMER_DISCONNECTED'
  | 'AGENT_DISCONNECTED'
  | 'UNANSWERED'
  | 'USER_UNREACHABLE'
  | 'NETWORK_FAILURE'
  | 'PROVIDER_FAILURE'
  | 'UNKNOWN';

export type CanonicalCallEvent = {
  workspaceId: string;
  brandId: string;
  connectionId: string;
  callingProvider: string;
  providerCallId: string;
  providerEventId?: string | null;
  eventType: CanonicalCallEventType;
  callStatus: CanonicalCallStatus;
  direction: CanonicalDirection;
  customerPhone: string;
  businessNumber?: string | null;
  agentId?: string | null;
  agentName?: string | null;
  agentPhone?: string | null;
  startedAt?: string | null;
  answeredAt?: string | null;
  endedAt?: string | null;
  updatedAt?: string | null;
  durationSeconds?: number | null;
  disconnectedBy?: string | null;
  disconnectParty?: CanonicalDisconnectParty | null;
  endReason?: CanonicalCallEndReason | null;
  outcomeSource?: string | null;
  recordingUrl?: string | null;
  reason?: string | null;
  ivrInputs?: unknown;
  rawEventType?: string | null;
  rawStatus?: string | null;
  rawPayload: unknown;
};

export type CallingFieldMapping = {
  canonicalField: string;
  sourcePath: string;
  transform?: string | null;
  transformConfig?: Record<string, unknown> | null;
  required?: boolean;
};

export type CallingValueMapping = {
  mappingType: 'EVENT_TYPE' | 'CALL_STATUS' | 'DIRECTION';
  sourceValue: string;
  canonicalValue: string;
};

export type CallingConnection = {
  connectionId: string;
  workspaceId: string;
  brandId: string;
  connectionName: string;
  providerKey: string;
  status: 'draft' | 'testing' | 'active' | 'disabled' | 'needs_attention';
  webhookSecret: string;
  mappingVersionId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
