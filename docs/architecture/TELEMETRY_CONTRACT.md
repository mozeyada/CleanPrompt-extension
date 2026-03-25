# Telemetry And Data Contract

## Purpose

Define what data may leave the endpoint in the default enterprise product mode, and what data is explicitly prohibited from leaving the endpoint.

## 1. Product Position

The current prototype is local-first and stores metadata-safe events in extension storage. The enterprise build preserves that principle.

Default enterprise mode:

- raw prompt text does not leave the endpoint
- raw token values do not leave the endpoint
- reveal-state mappings do not leave the endpoint
- only approved metadata summaries may be sent to the control plane

## 2. Prohibited Outbound Data

The following fields must never be sent off-device in the default enterprise mode:

- raw prompt text
- sanitized prompt text
- original token values
- reveal token map
- freeform justification text containing copied prompt content
- page DOM content
- clipboard contents
- full URL query strings or fragments if they may contain sensitive data

## 3. Allowed Outbound Event Families

### 3.1 Device enrollment event

Allowed examples:

- org enrollment token reference
- extension version
- browser family
- OS family
- managed-device indicator

Must not include:

- browsing history
- prompt contents

### 3.2 Policy sync heartbeat

Allowed examples:

- device id
- current extension version
- current policy version
- current rules version
- last sync timestamp
- compatibility status

### 3.3 Metadata-safe audit event

Allowed examples:

- tenant identifiers
- device identifier
- policy action applied
- intent label
- intent confidence bucket
- sensitivity categories triggered
- triggered rule ids
- count summary by category
- count summary by risk/protection
- prompt size bucket
- site family
- timestamp bucket
- whether justification was required
- whether justification was provided

## 4. Allowed Audit Event Shape

Required fields:

- `org_id`
- `team_id`
- `device_id`
- `extension_version`
- `site`
- `action`
- `intent_label`
- `intent_confidence_bucket`
- `sensitivity_categories`
- `rule_ids`
- `count_summary`
- `prompt_size_bucket`
- `timestamp_bucket`
- `raw_text_absent`

Optional fields:

- `user_id`
- `policy_version`
- `rules_version`
- `justification_required`
- `justification_provided`

Hard requirements:

- `raw_text_absent` must always be `true` in default enterprise mode
- all fields must be schema validated before send
- event types must be versioned

## 5. Justification Handling

Freeform justification creates a data-leak risk.

Default enterprise rule:

- justification text stays local unless a customer-approved advanced mode exists
- control plane receives boolean or structured categorical metadata instead of free text

If freeform justification ever needs backend sync in a future mode, it requires:

- separate product mode
- separate privacy review
- separate retention policy
- content filtering and legal approval

## 6. Logging Rules For Backend Services

Backend application logs must not include:

- request bodies for audit event ingestion
- raw auth headers
- unredacted export payload samples

Allowed logging:

- request id
- tenant id
- route name
- response code
- latency
- payload schema version

## 7. Schema Governance

Any new outbound field requires:

1. schema update
2. privacy review
3. security review if field changes trust assumptions
4. regression tests proving raw text still cannot leave

## 8. Mapping To Current Code

The current prototype already points in the right direction:

- `engine/redactor.js`
  - builds event summaries from metadata rather than raw text
- `background.js`
  - stores metadata-oriented audit and device event structures
  - now sanitizes outbound audit uploads to an allowlisted metadata-only shape
- `control-plane/src/validators.js`
  - now rejects prohibited raw-content audit fields at the API boundary

The enterprise implementation should continue formalizing this as shared schemas rather than ad hoc objects, but the first privacy enforcement path is now implemented in code and covered by regression tests.

## 9. Exit Criteria

This contract is approved when:

- product approves the default enterprise data-minimization stance
- engineering implements shared event schemas from this contract
- privacy approves the prohibited-field list
- QA adds regression tests for outbound raw-text exclusion
