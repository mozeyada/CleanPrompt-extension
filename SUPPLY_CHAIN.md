# Supply Chain Baseline

## Purpose

This document records the current software-supply-chain posture for CleanPrompt and the controls that already exist versus the ones still missing.

## Current Baseline

What is true today:

- the core prototype uses mostly built-in Node.js runtime features for tests and backend scaffolding
- the repo now includes a minimal dev-only static-analysis toolchain through `typescript` and `@types/node`
- the repo now has a root `package-lock.json` for that current toolchain baseline
- the repo now uses that toolchain for workspace checks plus scoped extension/runtime-helper typechecks on `background.js`, `content.js`, `popup.js`, `engine/redactor.js`, and `engine/ner-worker.js`
- the repo now also verifies shipped extension assets at release time, including manifest file references and bundled rules integrity
- the packaged evaluation kit is now also checked against the current source tree so packaged-delivery drift fails verification
- the shipped popup and sidebar surfaces are now also checked for structural hook drift at verification time
- the shipped content-script DOM contract is now also checked so runtime-referenced ids must be created by the injected UI layer
- the shipped supported-host matrix is now also checked so manifest, popup, and content-runtime surfaces cannot silently disagree about supported AI hosts
- the shipped presentation layer is now also checked so packaged icon files and core brand/privacy strings remain coherent across visible surfaces
- the shipped popup and sidebar surfaces no longer fetch Google Fonts at runtime and now rely on local font stacks only
- the shipped runtime surface is now also checked so unexpected remote URL dependencies fail verification outside the supported AI hosts and local control-plane path
- the shipped runtime surface is now also checked so popup/content message types cannot silently drift away from background handlers
- the shipped managed-runtime surface is now also checked so background status-result builders cannot silently drift away from popup managed-result helpers or the shared extension type contract
- the shipped managed popup surface is now also checked so managed-view helpers cannot silently drift away from the Managed-tab DOM contract or shared popup type contract
- the shipped popup platform surface is now also checked so coverage-item helpers cannot silently drift away from the Platforms-tab DOM contract or shared popup type contract
- the shipped popup clean surface is now also checked so result/guidance helpers cannot silently drift away from the clean-panel DOM contract or shared popup type contract
- the shipped popup rules surface is now also checked so the rules renderer cannot silently drift away from the rules-panel DOM contract or shared popup metadata types
- the shipped content review surface is now also checked so in-page review, audit, and intercept helpers cannot silently drift away from the sidebar/intercept DOM contract or shared content/audit types
- extension logic is shipped from repo-controlled files, not from remotely hosted executable code
- managed policy and audit flows are data-driven, not remote-code-driven
- the repo now has a repeatable evaluation-kit packaging flow with a package manifest and SHA-256 checksums
- the repo now has artifact verification for the packaged evaluation kit
- CI now runs the release-grade verification flow, including packaging and artifact integrity checks

## Design Principles

CleanPrompt should preserve these supply-chain rules:

1. Extension behavior should come from packaged extension code only.
2. Policies and rules may be delivered as signed data artifacts in the future, not executable scripts.
3. Browser clients should not download arbitrary remote JavaScript to alter runtime behavior.
4. Trust-sensitive boundaries should have regression tests before new dependencies or delivery paths are introduced.

## Current Risk Areas

- there is no signed release process yet
- there is no dependency-review gate yet
- there is no SBOM generation yet
- there is no provenance attestation yet
- the repo now has a lockfile, but there is still no dependency-review or provenance gate around it

## Current Verification

The repo currently verifies:

- syntax of critical runtime files
- scoped TypeScript-backed checking for the extension background trust path, content/runtime messaging path, popup/runtime settings path, shared redaction engine, and shipped optional worker boundary, plus package-local typechecks in the active workspaces
- manifest and bundled-rules integrity for the shipped extension asset layer
- popup hook/tab integrity and critical sidebar selector coverage for the shipped UI surface
- content-script runtime-id integrity for the injected in-page UI surface
- supported-host surface integrity across shipped extension entry points
- presentation-surface integrity for packaged icons and core branding/privacy copy
- runtime URL allowlist integrity across shipped browser files
- runtime message-contract integrity across shipped browser files
- runtime storage/settings-contract integrity across shipped browser files
- runtime response-contract integrity across shipped browser files
- runtime redaction-result integrity across shipped browser files
- bundled-rule metadata integrity across shipped browser files
- platform-health payload integrity across shipped browser files
- managed status-result integrity across shipped browser files
- managed popup view-model integrity across shipped browser files
- popup platform-coverage item integrity across shipped browser files
- popup clean-result surface integrity across shipped browser files
- popup rules-panel integrity across shipped browser files
- root test suite for redaction, contract, privacy, popup, control-plane, and content smoke flows
- evaluator-kit package manifest, checksum integrity, and source-sync drift checks for the latest packaged handoff artifact

Source of truth:

- [package.json](package.json)
- [.github/workflows/ci.yml](.github/workflows/ci.yml)

## Release Expectations For A Sellable Product

Before claiming production readiness, add:

- dependency review in CI
- artifact signing or attestations
- published release provenance beyond local verification and checksums
- release notes tied to tested versions
- reproducible packaging for the extension
- integrity checks for policy or rule delivery artifacts

## Operational Rule

If a future change introduces:

- new third-party runtime dependencies
- remote model providers
- remote rule delivery
- build-time code generation

that change should also update this document, the CI policy, and the roadmap/inventory docs if the trust posture changes.
