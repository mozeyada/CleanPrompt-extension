# Security Overview

## Security Story In One Sentence

CleanPrompt reduces AI data-leak risk by cleaning sensitive content locally before AI submission and limiting managed visibility to metadata-only event summaries.

## Current Security-Relevant Controls

Implemented now:

- local-first prompt handling
- policy-aware actions such as warn, redact, justify, and block
- allowlisted outbound audit upload shape
- backend rejection of prohibited raw-content audit fields
- CI verification for syntax and automated tests
- first-pass contract, privacy, and browser smoke tests

Related references:

- [SECURITY.md](../../SECURITY.md)
- [SUPPLY_CHAIN.md](../../SUPPLY_CHAIN.md)
- [docs/architecture/THREAT_MODEL.md](../architecture/THREAT_MODEL.md)

## Security Boundaries

Endpoint boundary:

- sensitive prompts are processed locally first

Upload boundary:

- only metadata-safe audit events may be uploaded in managed mode

Control-plane boundary:

- audit payload validation rejects prohibited raw-content fields

## What This Security Overview Is Not

This is not a statement of:

- formal certification
- production SaaS hardening completeness
- third-party audit completion
- penetration-test completion

## Appropriate Buyer Language

Safe language:

- "privacy-first"
- "local-first enforcement"
- "metadata-only owner insight"
- "prototype with trust controls already present in code and tests"

Unsafe language:

- "fully enterprise-hardened"
- "certified secure"
- "zero-risk"

## Biggest Security Gaps Still Open

- auth and RBAC for the control plane
- tenant isolation enforcement
- release signing and provenance
- browser E2E coverage
- production incident/operations processes
