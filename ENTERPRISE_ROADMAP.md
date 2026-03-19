# LogClean Enterprise Roadmap v2
**Status:** Active working plan  
**Date:** 2026-03-20  
**Scope:** Browser extension + control plane + enterprise operating model

---

## 0. Delivery Status

### Completed so far

#### Step 1: Gate 0 architecture docs

Completed outputs:

- `docs/architecture/README.md`
- `docs/architecture/TARGET_ARCHITECTURE.md`
- `docs/architecture/THREAT_MODEL.md`
- `docs/architecture/TELEMETRY_CONTRACT.md`
- `docs/architecture/IDENTITY_RBAC.md`

Outcome:

- enterprise target architecture documented against the current prototype
- trust boundaries and high-risk abuse cases documented
- outbound telemetry restrictions defined
- identity and RBAC direction documented

#### Step 2: Production repo structure and shared schema skeleton

Completed outputs:

- `package.json`
- `extension/README.md`
- `control-plane/README.md`
- `control-plane/package.json`
- `control-plane/src/README.md`
- `packages/shared-schemas/README.md`
- `packages/shared-schemas/package.json`
- `packages/shared-schemas/src/*`
- `packages/shared-schemas/schemas/*`
- `infra/README.md`

Outcome:

- production lanes created without disturbing the working prototype
- shared contract package created for policy, rules, audit, enrollment, and rollout
- infra and control-plane scaffolds added for next implementation steps

### Current state

- prototype extension remains the live implementation at the repository root
- enterprise foundation documents now exist
- enterprise workspace skeleton now exists
- Step 3 should harden the shared schemas and reconcile them with the current extension model

---

## 1. Executive Summary

LogClean has a useful prototype, but it is not yet enterprise-ready. The current repository proves the core concept:

- detect sensitive content locally inside supported AI chat tools
- redact before prompt submission
- store metadata-safe local audit events
- guide the user toward a safer prompt

To reach enterprise standard, the program must shift from a feature roadmap to a controlled platform program with explicit gates for:

- tenant isolation
- identity and access management
- signed policy and rule delivery
- compliance and privacy governance
- software supply chain security
- observability and SRE
- managed endpoint deployment

This document is the production-grade roadmap. It should be treated as the source of truth for enterprise planning. The older prototype roadmap can remain as historical context, but this plan should govern delivery, staffing, and go-live criteria.

---

## 2. Current-State Assessment

### What is already strong

- Manifest V3 extension foundation exists.
- Local redaction engine exists with meaningful category coverage.
- Local policy object and policy-aware UI states already exist.
- The product is already oriented around local-first privacy.

### What is not enterprise-ready yet

- No verified automated test baseline.
- No control plane for organizations, policy, fleet, or audit administration.
- No enterprise identity model.
- No signed update channel for rules or policy bundles.
- No formal outbound data contract for metadata sent off-device.
- No SRE model, SLOs, or incident response operating standard.
- No documented compliance operating model.
- No managed browser deployment strategy.

### Planning correction

The prototype should be described as:

`functional prototype with promising local controls`

It should not be described as:

`production-ready engine`

until automated quality, security, and performance evidence exists.

---

## 3. Market And Standards Signals To Build Around

These signals affect the target architecture and operating model:

1. Chrome extension governance is increasingly enterprise-controlled.
   Enterprise admins can allowlist, blocklist, and centrally manage extension installation and policy scope. This means LogClean must support managed deployment, not just self-serve installation.

2. Manifest V3 remains the required baseline.
   MV3 emphasizes service workers, tighter permissions, and no remotely hosted executable code. Rule and policy delivery must therefore distribute data, not executable logic.

3. Enterprise AI governance is moving toward local enforcement plus centralized oversight.
   Buyers increasingly want local DLP-like controls at the user edge, with a central control plane for policies, analytics, exceptions, and audit.

4. Secure software supply chain expectations are rising.
   Enterprise buyers and regulated customers now expect evidence aligned to NIST SSDF, signed artifacts, dependency controls, and auditable release processes.

5. Generative AI governance is being evaluated as risk management, not just feature enablement.
   The product must be defensible under privacy, legal, and model-governance review, especially around prompt handling and organizational policy enforcement.

---

## 4. Enterprise Product Principles

All design and implementation work must follow these principles:

1. Local-first by default
   Raw prompt content must not leave the endpoint unless a separately approved product mode explicitly allows it.

2. Centralized governance
   Policies, rule versions, rollout state, exceptions, and audit administration are managed from a control plane.

3. Signed, reversible delivery
   Policy bundles and rules are versioned, signed, staged, observable, and rollback-safe.

4. Managed enterprise deployment
   The product must work in Chrome and Edge managed environments with force-install and org-scoped policy.

5. Tenant isolation as a first-class control
   Every service, database query, queue, and object-store path must preserve tenant boundaries.

6. Compliance by design
   Retention, deletion, encryption, legal basis, data export, and auditability are built into the design, not added near launch.

7. Secure-by-default engineering
   Release pipelines, dependencies, secrets, and runtime hardening must meet modern software supply chain expectations.

---

## 5. Target Enterprise Architecture

### 5.1 Product Layers

1. Endpoint Layer
   Browser extension running on managed Chrome or Edge, enforcing local detection, redaction, and policy-aware user flows.

2. Control Plane
   Multi-tenant SaaS for policy administration, rule management, audit review, rollout control, and fleet visibility.

3. Delivery Plane
   Signed artifact publishing path for rules, policy bundles, metadata schemas, and extension release channels.

4. Data Plane
   Strictly scoped metadata ingestion, audit storage, analytics aggregation, and export APIs.

### 5.2 Reference Components

- Extension
  - `background.js` service worker
  - content scripts for supported AI properties
  - local storage and cache
  - enrollment and sync client

- Identity and Access
  - OIDC/SAML SSO
  - SCIM provisioning
  - RBAC and scoped admin permissions
  - admin action audit trail

- Policy Service
  - tenant-aware policy bundle API
  - team and user overrides
  - staged rollout controls
  - version history and rollback

- Rule Service
  - signed rule manifests
  - schema validation
  - compatibility metadata
  - canary percentages and revocation support

- Audit and Analytics
  - event ingestion API
  - append-only audit store
  - tenant-partitioned analytics store
  - export and retention controls

- Platform Services
  - queue for async processing
  - cache for hot policy reads
  - secrets manager
  - centralized observability

### 5.3 Non-Negotiable Architecture Decisions

- No remotely hosted executable extension code.
- Rules and policies are data artifacts only.
- All update artifacts are signed and versioned.
- Every extension request is scoped to tenant, device, user, and version.
- Raw prompt content is excluded from telemetry in the default enterprise product mode.
- Admin actions are immutable and auditable.

---

## 6. Control Requirements

### 6.1 Identity And Access

Must have before enterprise pilot:

- OIDC support for SSO
- SAML support on enterprise plan or equivalent roadmap commitment
- SCIM user lifecycle support
- RBAC roles: `org_admin`, `policy_admin`, `auditor`, `support_admin`, `member`
- Just-in-time access approval for internal support staff
- audit logs for admin login, policy change, export, rollback, and device revoke

### 6.2 Data Governance

Must define in writing before backend implementation:

- exact outbound event schema
- prohibited fields list
- retention schedule by data type
- deletion and export workflows
- customer-configurable retention where commercially required
- regional data residency stance
- DPA/BAA support boundaries

### 6.3 Supply Chain Security

Must have before production:

- CI with signed builds
- dependency scanning and license policy
- SBOM generation
- branch protection and reviewed releases
- secrets scanning
- provenance/attestation for release artifacts

### 6.4 Update Channel Security

Must have before OTA rollout:

- artifact signing with offline root or HSM-backed keys
- extension-embedded trust root
- key rotation process
- revocation and emergency block mechanism
- staged rollout percentages
- rollback within minutes, not days

### 6.5 Reliability And Operations

Must have before customer pilot:

- defined SLIs/SLOs
- alerting on sync failure, policy API latency, ingestion failures, and auth errors
- runbooks for degraded mode and rollback
- tested backups and disaster recovery
- named on-call owner

---

## 7. Program Gates

The project should not advance by feature completion alone. It advances by gates.

### Gate 0: Architecture And Governance
**Exit criteria**

- approved target architecture
- approved threat model
- approved outbound data contract
- approved identity model
- approved compliance scope
- approved ADRs for update channel, tenant isolation, and audit model

### Gate 1: Platform Foundation
**Exit criteria**

- control plane service skeleton live in dev and staging
- tenant-aware database schema in place
- SSO foundation implemented
- CI/CD, IaC, secrets, and observability baseline operational
- signed artifact pipeline running in non-prod

### Gate 2: Managed Extension Foundation
**Exit criteria**

- extension enrollment flow implemented
- managed browser deployment guide validated
- policy fetch, cache, rollback, and offline mode implemented
- version compatibility contract enforced
- endpoint telemetry contract tested for raw-text exclusion

### Gate 3: Control Plane MVP
**Exit criteria**

- policy editor with approval workflow
- audit viewer with scoped search and export
- device registry and revoke flow
- rollout control for policies and rules
- immutable admin action logs

### Gate 4: Assurance
**Exit criteria**

- automated test suite at agreed coverage thresholds
- security testing completed
- performance budgets met
- privacy verification passed
- release process attested against internal secure-SDLC standard

### Gate 5: Pilot Readiness
**Exit criteria**

- staging-to-prod promotion tested
- runbooks rehearsed
- support model defined
- enterprise documentation complete
- customer pilot checklist passed

---

## 8. Delivery Workstreams

### Workstream A: Extension Productization

Deliver:

- hardened MV3 extension structure
- enrollment, sync, rollback, and local cache
- policy-aware send interception
- compatibility framework for supported AI platforms
- managed-deployment documentation for Chrome and Edge admins

Acceptance:

- degraded mode works safely if control plane is unavailable
- unsupported policy or rule versions are rejected safely
- extension remains usable offline with last-known-good policy

### Workstream B: Control Plane

Deliver:

- org, team, user, and device model
- policy authoring and approval workflow
- rule rollout controls
- audit search and export
- support tooling with least-privilege access

Acceptance:

- no cross-tenant reads in automated tests
- policy publish-to-device propagation observable end to end
- every admin action attributable to a human or service principal

### Workstream C: Identity And Tenant Governance

Deliver:

- SSO
- SCIM
- RBAC
- tenant lifecycle management
- support access controls

Acceptance:

- joiner/mover/leaver workflows validated
- disabled users lose access promptly
- role changes reflected in API and UI authorization

### Workstream D: Security And Compliance

Deliver:

- threat model
- data classification and retention standard
- encryption and key management design
- vendor and dependency review process
- incident response and customer notification process

Acceptance:

- security review signed off
- privacy review signed off
- customer-facing trust documentation approved

### Workstream E: Reliability Engineering

Deliver:

- metrics, logs, traces
- dashboards and alerts
- SLOs and error budgets
- backup and restore automation
- chaos and rollback drills

Acceptance:

- restore drill proven
- critical alerts route to accountable owner
- release rollback tested under time constraint

### Workstream F: QA And Certification

Deliver:

- unit, integration, contract, and E2E coverage
- browser/platform compatibility suite
- performance and memory benchmarks
- security and privacy regression suite

Acceptance:

- release candidate passes defined quality gate
- known issues documented and risk-accepted formally

---

## 9. Revised Phase Plan

### Phase 1: Foundations
**Duration:** 4-6 weeks

Deliverables:

- target architecture and ADR pack
- threat model
- outbound telemetry contract
- tenant data model
- identity strategy
- non-prod platform baseline

Do not start customer-facing backend development until this phase exits cleanly.

### Phase 2: Secure Platform Build
**Duration:** 6-8 weeks

Deliverables:

- control plane backend
- tenant-aware persistence
- SSO and RBAC foundation
- signed rule/policy publishing pipeline
- observability and CI/CD baseline

### Phase 3: Extension Enrollment And Policy Sync
**Duration:** 4-6 weeks

Deliverables:

- device enrollment
- policy sync with last-known-good cache
- signed rule consumption
- rollout, rollback, and compatibility checks
- enterprise-managed deployment guide

### Phase 4: Admin Console And Audit
**Duration:** 4-6 weeks

Deliverables:

- policy editor
- rollout controls
- audit search and export
- device registry
- admin action logging

### Phase 5: Assurance And Operational Readiness
**Duration:** 4-6 weeks

Deliverables:

- automated test suite
- privacy and security verification
- performance certification
- runbooks, DR, support readiness
- pilot release checklist

### Phase 6: Enterprise Pilot
**Duration:** 4 weeks

Deliverables:

- limited pilot with 1-3 design partners
- weekly governance review
- measured adoption and false-positive review
- rollback and support rehearsal

---

## 10. Quality And Security Standards

### Minimum automated coverage goals

- redaction engine: 90% branch coverage
- policy resolution: 95% branch coverage
- tenant authorization: 100% critical-path integration coverage
- rule signing and verification: 100% critical-path integration coverage
- extension enrollment and sync: E2E coverage for happy path and degraded path

### Required test layers

- unit tests
- schema validation tests
- contract tests between extension and APIs
- browser E2E tests
- compatibility tests for supported AI sites
- performance tests on large prompts
- privacy tests verifying raw prompt exclusion from telemetry
- security regression tests for auth, tenant isolation, and update signing

### Release gate

Every release candidate must include:

- changelog
- signed artifacts
- passing quality gate
- rollback plan
- migration notes if schemas changed

---

## 11. SLOs And Operational Targets

Initial production targets:

- policy fetch API availability: 99.9%
- audit ingestion API availability: 99.9%
- policy fetch p95 latency: under 500 ms
- policy publish to device visibility: under 15 minutes for standard rollout
- emergency rollback propagation: under 10 minutes
- extension local redaction p95 for standard prompt sizes: under 1.5 seconds

If these cannot be met in staging, do not proceed to pilot.

---

## 12. Enterprise Documentation Pack

The program is not pilot-ready until these documents exist:

- architecture overview
- admin deployment guide
- browser managed-install guide
- security overview
- privacy and data handling guide
- API reference
- support runbook
- incident response runbook
- disaster recovery runbook
- customer pilot guide

---

## 13. Staffing Model

Minimum recommended team for serious delivery:

- 1 product/technical program lead
- 1 staff or senior backend lead
- 1 senior extension engineer
- 1 frontend/full-stack engineer for admin console
- 1 platform/DevOps engineer
- 1 QA automation engineer
- fractional security and privacy support

If budget is constrained, reduce scope before reducing controls.

---

## 14. Top Risks And Required Mitigations

| Risk | Why it matters | Required mitigation |
|---|---|---|
| AI platform DOM changes | Core in-page flow can break silently | compatibility harness, selector abstraction, rapid patch channel |
| Unsigned or weakly controlled updates | Compromise of rules or policy channel | signed artifacts, key rotation, revocation, staged rollout |
| Cross-tenant access bug | Enterprise blocker | tenant-scoped query layer, automated isolation tests, audit review |
| Telemetry creep | Trust and compliance failure | frozen outbound schema, privacy tests, approval process for schema changes |
| False positives harming usability | adoption risk | rule analytics, policy tuning, canary rollout, exception workflow |
| Weak enterprise identity | sales blocker | OIDC/SAML, SCIM, RBAC, admin audit trail |
| Lack of operational maturity | pilot failure | SLOs, runbooks, on-call, DR drills |

---

## 15. Executive Recommendation

Proceed only if the program is reset around enterprise gates rather than feature accumulation.

Recommended immediate actions for the next 2 weeks:

1. Freeze new product features outside security and platform-critical work.
2. Approve Gate 0 deliverables: target architecture, threat model, data contract, identity model.
3. Create ADRs for signed rule delivery, tenant isolation, and audit storage.
4. Stand up CI/CD, SBOM, dependency scanning, and baseline observability before backend scale-out.
5. Define the enterprise deployment model for managed Chrome and Edge environments.

The right goal is not "ship faster." The right goal is:

`be deployable, governable, auditable, and supportable in a real enterprise environment`

---

## 16. External References Used For Market Alignment

- Chrome for Developers, Manifest V3 overview
- Chrome Enterprise Help, extension allow/block and centralized admin controls
- NIST AI RMF: Generative AI Profile
- NIST SSDF materials and current revision activity

These references informed the plan direction around managed deployment, MV3 constraints, secure software delivery, and enterprise AI governance.
