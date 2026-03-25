# CleanPrompt

CleanPrompt is a privacy-first browser extension that helps users clean sensitive data from prompts before sending them to AI tools.

The current repository includes:

- a Manifest V3 extension for ChatGPT, Claude, Copilot, and Gemini
- a local redaction engine with policy-aware review and send interception
- a demo control plane for metadata-only audit and managed-mode workflows
- shared schemas, verification scripts, and automated tests

## Highlights

- Local-first prompt cleaning with structured findings and tokenized redaction
- Policy actions such as `allow`, `warn`, `redact`, `justify`, and `block`
- In-page review flow plus popup-based cleaning and managed-mode controls
- Metadata-only audit logging designed to avoid raw prompt retention
- Compatibility reporting for supported AI surfaces
- Packaging and verification flows for controlled evaluation kits

## Repository Layout

- [`manifest.json`](manifest.json): browser extension manifest
- [`content.js`](content.js): page integration, prompt interception, and review UI
- [`background.js`](background.js): extension runtime, settings, sync, and audit handling
- [`popup.html`](popup.html) and [`popup.js`](popup.js): extension popup UI
- [`engine/redactor.js`](engine/redactor.js): redaction engine and event-summary generation
- [`control-plane/`](control-plane): local demo control plane and admin console
- [`packages/shared-schemas/`](packages/shared-schemas): shared contracts and validators
- [`tests/`](tests): root verification and browser-surface smoke coverage

## Quick Start

1. Install dependencies with `npm install`.
2. Run the local verification suite with `npm run test:root`.
3. Load the extension unpacked in Chrome or Edge from this repository root.
4. Optionally start the demo control plane with `node control-plane/src/server.js`.
5. Seed demo data with `npm run demo:seed`.

Local control-plane state is created under `control-plane/data/dev-state.json` and is intentionally ignored by Git.

## Common Commands

```bash
npm run test:root
npm run typecheck
npm run assets:verify
npm run qa:pilot
npm run package:pilot
npm run artifact:verify
npm run release:check
```

## Supported Surfaces

- ChatGPT
- Claude
- Microsoft Copilot
- Google Gemini

## Project Status

This repository is an actively developed prototype with meaningful runtime behavior, verification coverage, and evaluation tooling. It is suitable for controlled demos and technical evaluation, but it is not presented as a production SaaS release.

- [`STATUS.md`](STATUS.md)
- [`ROADMAP.md`](ROADMAP.md)

## Documentation

- [`SECURITY.md`](SECURITY.md)
- [`SUPPLY_CHAIN.md`](SUPPLY_CHAIN.md)
- [`COMPLIANCE.md`](COMPLIANCE.md)
- [`docs/commercial/README.md`](docs/commercial/README.md)
- [`docs/commercial/DEPLOYMENT_GUIDE.md`](docs/commercial/DEPLOYMENT_GUIDE.md)
- [`docs/commercial/PRIVACY_OVERVIEW.md`](docs/commercial/PRIVACY_OVERVIEW.md)
- [`docs/commercial/SECURITY_OVERVIEW.md`](docs/commercial/SECURITY_OVERVIEW.md)
- [`docs/commercial/DEMO_SCRIPT.md`](docs/commercial/DEMO_SCRIPT.md)
- [`docs/commercial/PILOT_CHECKLIST.md`](docs/commercial/PILOT_CHECKLIST.md)
- [`docs/commercial/MANUAL_QA_PLAN.md`](docs/commercial/MANUAL_QA_PLAN.md)

## Notes

- `dist/` and `node_modules/` are not committed.
- Demo/runtime state is kept out of Git.
- Some internal storage keys still use legacy `logclean_*` names for compatibility.
