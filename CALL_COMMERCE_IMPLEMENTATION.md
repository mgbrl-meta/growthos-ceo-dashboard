# Growth OS Call Commerce V1

## Locked product decisions
- Module ID: `call-commerce`
- Dedicated operational dataset: `growthos_call_commerce`
- Region: inherited from `GCP_BQ_LOCATION`, default `asia-south1`
- Canonical tenant identity: existing Growth OS `workspace_id` + `brand_id`
- No Shopify dependency
- No product catalogue dependency
- Product / service remains free text
- Purchase remains manually confirmed by the agent with order/reference ID + amount
- Calling integration is generic; MSG91 is only the first preset
- Meta outbound events use call-specific names:
  - `ConnectedCallLead`
  - `QualifiedCallLead`
  - `UnqualifiedCallLead`
  - `ConvertedCallLead`

## Call Commerce tabs
- Summary
- Calls
- Meta Events
- Archive
- Reports
- System Status

## Calling integration
Settings -> Integrations -> Calling Platform

A connection gets an opaque webhook URL and secret. During testing, incoming payloads are captured and their JSON fields are discovered. Mapping is activated after mapping provider fields to the canonical event.

MSG91 preset maps common fields including `uuid`, `source`, `eventName`, `status`, `duration`, `agentName`, `startTime`, and `endTime`.

## Meta Events integration
Settings -> Integrations -> Meta Events

This is intentionally separate from Meta Ads reporting. It stores the CAPI access token in Secret Manager and the Dataset / Pixel ID in the Growth OS integration connection. Call Commerce queues namespaced call-lead events and processes them through this connection.

## Data tables
Created automatically in `growthos_call_commerce` on first Call Commerce use:
- calling_connections
- calling_mapping_versions
- calling_test_events
- raw_call_events
- call_attempts
- call_leads
- activity_log
- meta_event_queue
- meta_event_log
- module_settings

## Access control
`call-commerce` is inserted as an independently entitleable Growth OS module during capability-control migration. It is seeded Draft + Plan-controlled so Admin decides when and for whom it launches.

Submodules:
- summary
- calls
- meta-events
- archive
- reports
- system-status

## Production rollout
1. Install dependencies: `npm ci`
2. Run the existing Growth OS capability/control-plane migration/bootstrap so `call-commerce` and its submodules are registered.
3. Run `npm run build`.
4. From Admin Modules, enable/release Call Commerce for the target workspace/brand/plan.
5. In client Settings -> Integrations -> Calling Platform, create the calling connection.
6. Configure provider webhook with the generated URL/secret.
7. Send a test event, confirm/adjust field + value mappings, then activate the mapping.
8. Optional: connect Settings -> Integrations -> Meta Events with Meta Dataset/Pixel ID and CAPI token.
9. Test an answered call, repeated call, qualification, follow-up, unqualification, purchase and closed-lost flow before switching production traffic.

## Notes
- Ringing events are retained in raw data but do not create/update operational call leads.
- Repeated calls attach to active `NEW`, `QUALIFIED`, or `FOLLOW_UP` lead threads; terminal leads have the current 30-minute grace behavior.
- Purchase fields are not editable through normal lead detail updates; they are written only by the Purchase workflow action.
- Meta is optional. If Meta Events is not connected, Call Commerce does not create an undeliverable Meta queue entry.
