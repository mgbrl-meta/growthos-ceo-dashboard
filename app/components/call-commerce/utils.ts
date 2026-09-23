export function n(value: unknown) {
  return Number(value || 0);
}
export function integer(value: unknown) {
  return n(value).toLocaleString('en-IN');
}
export function currency(value: unknown) {
  return `₹${n(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
export function percent(value: unknown, digits = 1) {
  return `${n(value).toFixed(digits)}%`;
}
export function duration(value: unknown) {
  const seconds = Math.max(0, Math.round(n(value)));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remaining}s`;
  return `${remaining}s`;
}
export function formatDateTime(value: unknown) {
  if (!value) return '—';
  const raw = (value as any)?.value ?? value;
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) return String(raw);
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
export function shortDate(value: unknown) {
  if (!value) return '—';
  const raw = (value as any)?.value ?? value;
  const date = new Date(String(raw).length === 10 ? `${raw}T00:00:00` : String(raw));
  if (Number.isNaN(date.getTime())) return String(raw);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
export function timeAgo(value: unknown) {
  if (!value) return 'No calls yet';
  const raw = (value as any)?.value ?? value;
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) return '—';
  const diff = Math.max(0, Date.now() - date.getTime());
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
export function initials(value: unknown) {
  const parts = String(value || 'NA').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'NA';
}
export function normalizeDisplayPhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '—';
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return `+${digits}`;
}
export function callOutcome(value: any) {
  const status = String(value?.call_status ?? value?.latest_call_status ?? '').toUpperCase();
  const endReason = String(value?.end_reason ?? value?.latest_end_reason ?? '').toUpperCase();
  const party = String(value?.disconnect_party ?? value?.latest_disconnect_party ?? '').toUpperCase();

  if (status === 'ANSWERED') {
    if (endReason === 'AGENT_DISCONNECTED' || party === 'AGENT') {
      return { key: 'ANSWERED_AGENT_END', label: 'Answered', detail: 'Agent ended call', tone: 'emerald' };
    }
    if (endReason === 'CUSTOMER_DISCONNECTED' || party === 'CUSTOMER') {
      return { key: 'ANSWERED_CUSTOMER_END', label: 'Answered', detail: 'Customer ended call', tone: 'emerald' };
    }
    if (endReason === 'NETWORK_FAILURE') {
      return { key: 'ANSWERED_NETWORK_END', label: 'Answered', detail: 'Connection ended by network', tone: 'emerald' };
    }
    return { key: 'ANSWERED', label: 'Answered', detail: 'Connected call', tone: 'emerald' };
  }
  if (endReason === 'CALLER_DROPPED_BEFORE_ANSWER') {
    return { key: 'CALLER_DROPPED', label: 'Caller Dropped', detail: 'Before connection', tone: 'amber' };
  }
  if (endReason === 'USER_UNREACHABLE') {
    return { key: 'USER_UNREACHABLE', label: 'No Answer', detail: 'User unreachable', tone: 'rose' };
  }
  if (endReason === 'UNANSWERED' || party === 'BUSINESS_ROUTING') {
    return { key: 'NO_ANSWER', label: 'No Answer', detail: 'Agent/team did not answer', tone: 'rose' };
  }
  if (status === 'FAILED') {
    return { key: 'FAILED', label: 'Failed', detail: endReason === 'NETWORK_FAILURE' ? 'Network failure' : 'Provider failure', tone: 'rose' };
  }
  if (status === 'RINGING') {
    return { key: 'RINGING', label: 'Ringing', detail: 'Call in progress', tone: 'blue' };
  }
  if (status === 'MANUAL_CREATED') {
    return { key: 'MANUAL_CREATED', label: 'Manual', detail: 'Manual call record', tone: 'violet' };
  }
  return { key: 'UNKNOWN', label: 'Unknown', detail: 'Insufficient call data', tone: 'slate' };
}
