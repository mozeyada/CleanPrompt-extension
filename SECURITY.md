# Security Policy

## Scope

This repository contains the CleanPrompt browser extension prototype, a local control-plane MVP, and supporting schemas and docs.

Current implemented security posture:

- prompt cleaning happens on-device first
- managed audit upload is metadata-only by default
- outbound audit upload is allowlisted in code
- the control plane rejects prohibited raw-content fields in audit payloads
- first-pass contract, privacy, and browser-surface smoke tests exist in the repo

Current limits:

- this is not yet a production-hardened SaaS platform
- there is no formal authentication or tenant-isolation layer yet
- there is no signed release pipeline yet
- browser E2E automation is not yet in place

## Reporting A Vulnerability

Please do not open a public GitHub issue with exploit details.

For now, report security concerns privately to the project owner through an agreed private channel. Include:

- affected file or feature
- impact and severity
- reproduction steps
- whether raw prompt data, device identity, or policy controls are involved

If no private channel is available, open a minimal public issue that only says a security report needs a private follow-up and does not include exploit details.

## Response Expectations

Target handling for serious reports:

- acknowledge receipt within 3 business days
- triage severity and affected scope
- reproduce and patch when confirmed
- update tests or controls so the issue does not silently return

## Secure Development Expectations

Changes that touch redaction, audit upload, or policy sync should preserve these rules:

- raw prompt text must not leave the endpoint in default enterprise mode
- token maps and revealed values must not be uploaded
- freeform justification text stays local
- server-side boundaries should reject prohibited raw-content fields
- trust claims must be backed by tests and docs

## Sensitive Areas

Pay extra attention to:

- [background.js](background.js)
- [content.js](content.js)
- [engine/redactor.js](engine/redactor.js)
- [control-plane/src/validators.js](control-plane/src/validators.js)
- [docs/architecture/TELEMETRY_CONTRACT.md](docs/architecture/TELEMETRY_CONTRACT.md)

## Security Status

Implemented now:

- metadata-only audit boundary checks
- contract and privacy regression tests
- CI verification for syntax and tests

Not implemented yet:

- formal secret scanning in CI
- signed release artifacts
- production auth and RBAC enforcement
- tenant-isolation tests
