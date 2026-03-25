# Privacy Overview

## Core Promise

CleanPrompt is designed around one product promise:

`Raw prompt text does not leave the endpoint in the default enterprise mode.`

## How The Current Prototype Supports That Promise

In the current repo:

- prompts are cleaned locally in the browser extension
- redaction happens before managed audit upload exists
- managed audit upload is metadata-only
- outbound audit payloads are allowlisted before send
- the control plane rejects prohibited raw-content fields
- strict mode can keep analytics local-only

Supporting code paths:

- [engine/redactor.js](../../engine/redactor.js)
- [background.js](../../background.js)
- [control-plane/src/validators.js](../../control-plane/src/validators.js)
- [docs/architecture/TELEMETRY_CONTRACT.md](../architecture/TELEMETRY_CONTRACT.md)

## What Admins Can See

In the current managed-mode design, admins can see:

- device counts
- policy versions
- rules versions
- action counts
- intent labels
- sensitivity categories
- metadata-only recent event summaries

Admins do not receive:

- raw prompt text
- sanitized prompt text
- reveal token maps
- original secret values
- copied justification text

## What Stays Local

The following stays on the endpoint in the default enterprise mode:

- raw prompt content
- redacted token source values
- reveal-state mappings
- copied justification text

## Strict Mode

Strict mode is the most privacy-conservative operating mode in the current prototype.

In strict mode:

- the extension still cleans locally
- managed metadata upload is suppressed
- the endpoint remains local-only for analytics behavior

## Honest Limitations

This repo does not yet prove:

- legal retention enforcement at SaaS scale
- tenant-isolated production storage controls
- production deletion workflows
- external privacy review

So the correct claim today is:

- "privacy-first prototype with metadata-only owner insight"

Not:

- "fully audited production privacy platform"
