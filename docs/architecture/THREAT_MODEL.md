# Threat Model

## Purpose

Identify the highest-value assets, trust boundaries, attacker goals, and minimum mitigations for the enterprise implementation of CleanPrompt.

## 1. Primary Assets

### Endpoint assets

- raw prompt text before redaction
- sanitized prompt output
- token mappings used for reveal behavior
- cached policy bundle
- cached rule manifest
- enrollment token and device identity

### Platform assets

- tenant policy definitions
- rule publishing keys and trust roots
- admin credentials and sessions
- audit events
- device inventory
- export jobs

## 2. Threat Actors

### External attacker

Goals:

- compromise the update path
- steal audit data
- gain admin access
- enumerate tenants or devices

### Malicious tenant admin

Goals:

- over-export data
- bypass governance
- abuse support or exception workflows

### Insider or support operator

Goals:

- access customer data outside role
- make policy changes without auditability

### Local power user on endpoint

Goals:

- tamper with extension storage
- bypass enforcement
- replay stale policy or rule state

### Hostile or changing third-party page

Goals:

- break interception flow
- manipulate injected UI behavior
- trigger unsafe DOM assumptions

## 3. High-Risk Abuse Cases

1. Rule-channel compromise
   An attacker publishes malicious or downgraded rules to weaken redaction.

2. Policy replay
   An old but valid policy bundle is replayed to remove newer protections.

3. Cross-tenant query bug
   An authorization error exposes audit or policy data across organizations.

4. Admin-console privilege escalation
   A lower-privilege user gains policy-edit or export powers.

5. Raw text telemetry leak
   A client or service accidentally sends raw prompt text to backend logs or audit stores.

6. Device token theft
   A stolen token is used to impersonate a valid extension instance.

7. DOM breakage leading to unsafe send behavior
   A platform UI change bypasses warning, block, or justify behavior.

8. Support access abuse
   Internal staff gain direct access to tenant content or exports without approval.

## 4. Trust Boundaries

### Boundary 1: Browser page DOM vs extension code

The page is not trusted. DOM content, event shape, and selectors must be treated as unstable and potentially adversarial.

### Boundary 2: Extension local state vs control plane

The extension is trusted only as a managed client with signed-state validation. Cached local state may be tampered with by advanced local users.

### Boundary 3: Public API edge vs internal services

All incoming requests must be authenticated, authorized, schema-validated, rate-limited, and tenant-scoped.

### Boundary 4: Admin users vs support/internal operators

Support access must be separate from tenant admin access, with just-in-time approval and full auditability.

## 5. Required Mitigations

### For rule and policy delivery

- signed artifacts
- trusted root embedded in extension
- expiry and version metadata
- monotonic version handling or explicit rollback authorization
- emergency revocation support

### For identity and access

- OIDC/SAML integration
- strict RBAC
- admin action audit logs
- short-lived sessions and token rotation
- support access approval flow

### For tenant isolation

- tenant-aware middleware
- tenant-scoped data access layer
- automated isolation tests
- explicit export authorization checks

### For raw text protection

- frozen outbound event schema
- schema validation on client and server
- privacy tests that fail on raw-text fields
- log scrubbing in backend services

### For endpoint resilience

- last-known-good cache
- compatibility metadata for supported extension versions
- graceful degraded mode
- selector abstraction and compatibility test harness

## 6. Security Design Decisions Needed Before Implementation

1. Device identity model
   Decide whether device auth uses per-device asymmetric keys, issued tokens, or both.

2. Artifact signing model
   Decide root/intermediate key structure and rotation workflow.

3. Audit immutability level
   Decide whether customer-facing audit is append-only at application level or backed by WORM-style storage patterns.

4. Support access workflow
   Decide whether support access is entirely disabled by default or just-in-time approved by tenant admin.

5. Degraded mode policy
   Decide whether endpoint defaults to last-known-good enforcement or stricter local fallback when sync fails.

## 7. Threats That Must Be Explicitly Tested

- replay of stale policy bundle
- invalid signature on rule manifest
- cross-tenant access attempts
- unauthorized export attempts
- extension sync while offline or partially degraded
- raw prompt text appearing in outbound payloads
- DOM selector failures on supported AI sites

## 8. Exit Criteria

This threat model is approved when:

- engineering has named mitigations for all high-risk abuse cases
- security agrees the update path is defensible
- privacy agrees raw-text leakage paths are covered
- QA has a threat-informed test list for the next phase
