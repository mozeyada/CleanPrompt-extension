# Compliance And Trust Notes

## Purpose

This document explains the current compliance posture of CleanPrompt in honest repo terms.

## What We Can Truthfully Say Today

The current prototype supports a privacy-forward product story because:

- prompt cleaning happens locally in the browser extension
- managed audit upload is metadata-only by default
- raw prompt text is excluded from the outbound audit path
- the control plane rejects prohibited raw-content audit fields
- strict mode can keep analytics local-only

Supporting references:

- [docs/architecture/TELEMETRY_CONTRACT.md](docs/architecture/TELEMETRY_CONTRACT.md)
- [background.js](background.js)
- [control-plane/src/validators.js](control-plane/src/validators.js)

## What We Should Not Claim Yet

Do not claim that this repository is currently:

- SOC 2 certified
- ISO 27001 certified
- HIPAA-ready
- production-ready for regulated workloads
- fully multi-tenant secure
- independently penetration tested

Those claims would require controls and evidence that do not yet exist in this workspace.

## Current Evidence In Repo

Evidence available now:

- automated tests for redaction and policy behavior
- privacy regressions for outbound audit uploads
- contract tests across the extension/control-plane audit boundary
- browser-surface smoke coverage for content-script injection and managed audit messaging
- CI automation that runs syntax and automated tests

## Buyer-Facing Positioning Guidance

Use language like:

- "privacy-first prototype with metadata-only enterprise insight"
- "local-first sensitive-data cleaning before AI submission"
- "raw prompt text does not leave the endpoint in the default enterprise mode"

Avoid language like:

- "certified secure"
- "fully compliant"
- "enterprise-ready at any scale"

## Gaps To Close Before Stronger Compliance Claims

- production authentication and authorization
- tenant-isolation controls and tests
- retention and deletion policy implementation
- secure release and signing pipeline
- deployment and operational runbooks
- legal/commercial privacy terms
- external security review

## Near-Term Compliance Pack

The next useful buyer-facing pack should include:

- deployment guide for managed Chrome and Edge environments
- privacy overview
- security overview
- pilot checklist
- demo narrative showing owner insight without prompt retention
