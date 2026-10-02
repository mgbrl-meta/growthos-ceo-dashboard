# Growth OS Call Commerce — Identity & Lifecycle Contract V2

## Scope

Call Commerce is a multi-brand, multi-connector, multi-business-number operational CRM. PostgreSQL is the operational source of truth. BigQuery is downstream analytics/history.

The core engine is provider-neutral. Known providers such as MSG91 may have an adapter/preset at the mapping boundary, but CRM lead/attempt resolution must not contain provider-specific branching.

## Identity model

Three identities are intentionally separate:

1. **Customer/contact** — normalized customer phone within one `workspace_id + brand_id`.
2. **Lead** — one business opportunity/lifecycle (`lead_id`).
3. **Call attempt/leg** — one physical provider call, identified by:
   `workspace_id + brand_id + connection_id + provider_call_id`.

Connector and business number are call-attempt attributes. They do not split the customer into separate leads inside the same brand.

## Universal lead resolution

Resolution order is fixed platform behavior; it is not configurable per brand in V2.

1. If the scoped provider call identity already exists, update that exact attempt and keep its existing `lead_id` — even when the lead later becomes terminal.
2. If this is a new provider call ID, resolve the customer by normalized phone within the same workspace + brand.
3. If an open lead exists (`NEW`, `QUALIFIED`, `FOLLOW_UP`), create a new call attempt under that lead.
4. If no open lead exists, create a new `NEW` lead and attach the new attempt.
5. Terminal statuses (`PURCHASED`, `UNQUALIFIED`, `CLOSED_LOST`) are never auto-reopened by a new physical call.
6. When a previously unseen call arrives late and provides a reliable `startedAt`, Growth OS uses the physical call start time to place that call inside the correct historical lead lifecycle. A call that actually happened before terminalization may therefore be attached to the historical terminal lead without reopening it.

A unique PostgreSQL invariant allows only one non-archived open lead for the same normalized phone in a workspace + brand.

## Ringing and attempt state

`RINGING` is operational, not raw-only.

Example:

```text
Call ABC -> RINGING
Call ABC -> ANSWERED
```

Both events update the same call-attempt row.

A later new call ID creates a new leg:

```text
Lead L1
  ABC -> ANSWERED
  XYZ -> RINGING
```

The Calls front shows the canonical status of the chronologically latest attempt (`XYZ -> RINGING`).

## Latest call projection

Lead-level fields such as `latest_attempt_id` and `latest_call_status` are a denormalized projection from `call_attempts`.

The latest attempt is selected by:

1. `COALESCE(call_started_at, created_at)` descending;
2. provider/update time descending;
3. deterministic creation/attempt tie-breakers.

Webhook arrival order must not make an older call become the latest call.

If the latest attempt has no mapped canonical status, the front displays `UNKNOWN`.

## Call status vs provider event vs end reason

These fields are separate:

- **Provider event:** `ringing`, `completed`, `failed`, etc.
- **Canonical call status:** `RINGING`, `ANSWERED`, `NO_ANSWER`, `MISSED`, `BUSY`, `REJECTED`, `FAILED`, `UNKNOWN`.
- **End reason:** `CALLER_DROPPED_BEFORE_ANSWER`, `USER_UNREACHABLE`, `CUSTOMER_DISCONNECTED`, `AGENT_DISCONNECTED`, etc.
- **Lead workflow status:** `NEW`, `QUALIFIED`, `FOLLOW_UP`, `PURCHASED`, `UNQUALIFIED`, `CLOSED_LOST`.

`completed` is never treated as synonymous with `ANSWERED` by the universal CRM layer. Positive duration alone is never answer evidence.

`CALLER_DROPPED_BEFORE_ANSWER` is an end reason under `NO_ANSWER`, not a separate primary call status.

## Same-attempt state reconciliation

Status precedence is used only inside one scoped provider call identity to reconcile duplicate/out-of-order webhooks.

- `RINGING` can resolve to a terminal status.
- `NO_ANSWER` may upgrade to `ANSWERED` when a later fallback leg explicitly connects.
- An already `ANSWERED` attempt is not downgraded by stale lower-confidence events.
- A newer terminal provider lifecycle event with no mapped business outcome clears stale `RINGING` to `UNKNOWN`; Growth OS does not guess an answer/no-answer outcome.

Status precedence never compares two separate physical call attempts. The newer physical call controls the lead's latest-call projection.

## Inbound and outbound

Inbound and outbound use exactly the same lead resolver.

Direction is a call-attempt property only:

```text
direction = INBOUND | OUTBOUND | UNKNOWN
```

Known provider adapters normalize customer/business sides before the universal engine. For MSG91:

- inbound customer: `source`
- outbound customer: `destination`
- business number: `callerId`

A new outbound call to a customer with an open lead becomes another leg on that same lead. A new outbound call after a terminal lifecycle creates a new lead, just like inbound.

## Multi-brand, multi-connector, multi-business-number behavior

- Customer/lead lookup is always scoped by `workspace_id + brand_id`.
- Same phone in another brand is a separate CRM lifecycle.
- Attempt identity includes `connection_id`, so the same provider call ID on two connectors does not collide.
- A customer can contact different business numbers/connectors and still remain on the same open lead in that brand.
- `business_number` and `connection_id` remain available for filtering, analytics and diagnostics.

## Provider integration boundary

Every provider connection maps provider data into the canonical event contract:

```text
providerCallId
providerEventId
customerPhone
businessNumber
direction
providerEvent/eventType
callStatus
startedAt
answeredAt
endedAt
updatedAt
durationSeconds
agentId/agentName/agentPhone
disconnectedBy
disconnectParty
endReason
recordingUrl
reason
```

Custom connectors can map event type, call status, direction, disconnect party and end reason values. Known provider adapters may add semantic interpretation only at this boundary.

## Lead terminality and Meta

Terminal lead statuses are:

- `PURCHASED`
- `UNQUALIFIED`
- `CLOSED_LOST`

A genuinely new call after terminalization starts a new lead. This protects funnel history, lifecycle timestamps and Meta conversion semantics.

Admin status correction is a separate audited action. It may correct a mistaken terminal status back to an open status, requires a reason, does not emit a duplicate conversion event, and is blocked if another open lead already exists for that customer in the same brand.

## Settings

Brand settings continue to control call-quality thresholds, workflow-required fields and archive policy.

Lead reuse/reopen/grace rules are **not** exposed to brands. The legacy `reopen_grace_minutes` storage column is retained only for compatibility and has no operational effect.

## Storage

PostgreSQL operational tables include:

- `calling_connections`
- `calling_mapping_versions`
- `calling_test_events`
- `raw_call_events`
- `call_attempts`
- `call_leads`
- `activity_log`
- `meta_event_queue`
- `meta_event_log`
- `settings`
- `analytics_outbox`

BigQuery receives downstream append-only analytics events and remains the warehouse/history plane.
