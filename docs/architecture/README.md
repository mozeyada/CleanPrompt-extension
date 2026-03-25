# Architecture Docs

This folder contains the Gate 0 foundation documents for the CleanPrompt enterprise build.

These documents are intentionally written against the current repository state:

- extension runtime: `manifest.json`
- endpoint UI and interception: `content.js`
- local policy and audit storage: `background.js`
- popup surface: `popup.html` and `popup.js`
- redaction engine: `engine/redactor.js`

## Documents

- `TARGET_ARCHITECTURE.md`
  - Defines the target enterprise architecture and how the current prototype maps into it.
- `THREAT_MODEL.md`
  - Defines trust boundaries, assets, attacker goals, and required mitigations.
- `TELEMETRY_CONTRACT.md`
  - Defines what metadata may leave the endpoint and what may never leave.
- `IDENTITY_RBAC.md`
  - Defines enterprise identity, user lifecycle, and role-based access control.

## How To Use These

1. Approve these documents before major backend implementation.
2. Use them to guide shared schemas, APIs, and rollout design.
3. Update them whenever trust boundaries or data flows change.

## Current Implementation Anchors

- Current policy bundle seed: `background.js`
- Current endpoint enforcement flow: `content.js`
- Current metadata event summarization: `engine/redactor.js`
- Current extension wiring: `manifest.json`
