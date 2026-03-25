# Target Architecture

## Purpose

Define the enterprise target architecture for CleanPrompt while preserving the strongest parts of the current prototype.

## 1. Current-State Starting Point

The current repository already provides a useful endpoint prototype:

- `manifest.json`
  - MV3 extension wiring, content script injection, popup surface, and service worker registration.
- `content.js`
  - In-page UI injection, send interception, policy-aware review flow, and audit tab rendering.
- `background.js`
  - Local policy bundle seed, local settings, and metadata-safe audit/event storage.
- `engine/redactor.js`
  - Detection rules, redaction pipeline, intent classification, policy resolution, and event summarization.
- `popup.html` and `popup.js`
  - Local control surface for rule toggles, manual redaction, and trust messaging.

This means the enterprise architecture should extend the prototype rather than replace it.

## 2. Target Architecture Summary

The target system has four layers:

1. Endpoint Layer
   Browser extension running locally in Chrome or Edge, enforcing local detection and user-facing policy flows.

2. Control Plane
   Multi-tenant SaaS used by admins to manage policies, rule rollout, users, teams, devices, and audit review.

3. Delivery Plane
   Signed, versioned distribution path for rule manifests, policy bundles, compatibility metadata, and release artifacts.

4. Data Plane
   Metadata-only ingestion and analytics path with tenant partitioning, retention controls, and export support.

## 3. Component Model

### 3.1 Endpoint Layer

Primary responsibilities:

- detect supported AI sites
- inject local UI
- classify and redact locally
- enforce policy action locally
- cache last-known-good rules and policy
- operate safely in degraded mode

Current code that maps here:

- `manifest.json`
- `content.js`
- `background.js`
- `engine/redactor.js`
- `popup.html`
- `popup.js`
- `sidebar.css`

Future production additions:

- enrollment client
- signed artifact verifier
- local compatibility/version guard
- managed deployment config handling
- local cache manager for policy/rules

### 3.2 Control Plane

Primary responsibilities:

- org, team, user, and device administration
- policy authoring and approval workflow
- rule rollout configuration
- audit review and export
- support tooling with least privilege

Suggested services:

- identity service integration
- policy service
- rule manifest service
- audit service
- device registry service
- admin console frontend

### 3.3 Delivery Plane

Primary responsibilities:

- publish signed policy bundles
- publish signed rule manifests
- manage rollout stages
- support rollback and revocation
- store compatibility metadata by extension version

Required properties:

- no executable code delivery to the extension
- only signed data artifacts
- versioned manifests
- staged rollout and emergency block support

### 3.4 Data Plane

Primary responsibilities:

- ingest metadata-safe events only
- partition by tenant
- support retention and deletion policies
- support search, export, and aggregated analytics

Must not do:

- store raw prompt text in default enterprise mode
- infer identity from prompt payloads
- accept arbitrary unvalidated event blobs

## 4. Core Architectural Principles

### Local-first enforcement

The endpoint must remain useful even when the network or control plane is unavailable. Redaction and core enforcement continue locally using the last-known-good state.

### Data minimization

Only explicitly approved metadata may leave the endpoint. Raw prompt text is excluded in the default enterprise mode.

### Tenant isolation

All server-side storage and APIs must enforce organization boundaries by design, not by convention.

### Signed delivery

Rules and policies are data artifacts that are signed, versioned, staged, and rollback-safe.

### Managed deployment

The product must support enterprise browser management policies for Chrome and Edge.

## 5. Trust Boundaries

### Boundary A: User Browser Runtime

Contains:

- content scripts
- page DOM interaction
- popup
- service worker

Risks:

- hostile page DOM changes
- unsupported platform markup changes
- local storage tampering by advanced local users

### Boundary B: Extension-Control Plane API Boundary

Contains:

- enrollment requests
- policy fetches
- rule manifest fetches
- metadata event submission

Risks:

- spoofed clients
- replay of old bundles
- cross-tenant leakage

### Boundary C: Control Plane Internal Service Boundary

Contains:

- admin console
- API services
- database
- queue/cache

Risks:

- broken authorization
- support overreach
- data export misuse

## 6. Mapping The Current Prototype To The Target State

### Keep and harden

- `engine/redactor.js`
  - Keep as the endpoint detection and policy evaluation core.
- `content.js`
  - Keep as the basis for in-page enforcement and review UX.
- `background.js`
  - Keep as the seed for local cache, enrollment state, and sync orchestration.
- `popup.*`
  - Keep as a local utility surface, not the enterprise control plane.

### Refactor

- policy storage format
- audit event schema
- settings initialization
- sync and version compatibility logic
- rule override handling

### Add net-new

- control plane backend
- admin console
- signed artifact publishing pipeline
- identity integration
- fleet/device registry
- observability stack

## 7. Service Contracts Required Next

The following shared schemas should be implemented next:

- policy bundle schema
- rule manifest schema
- event summary schema
- device enrollment schema
- rollout state schema
- extension compatibility schema

## 8. Recommended Repository Direction

Suggested future top-level structure:

- `extension/`
- `control-plane/`
- `packages/shared-schemas/`
- `infra/`
- `docs/architecture/`

The current flat prototype can remain in place until the shared schemas and production scaffolding are ready.

## 9. Exit Criteria For This Architecture

This architecture document is approved when:

- product agrees on local-first versus central modes
- engineering agrees on the four-layer architecture
- security approves signed-delivery and tenant-isolation direction
- platform scope is fixed for the next implementation step
