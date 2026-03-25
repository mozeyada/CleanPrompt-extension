# Managed Browser Deployment Guide

## Purpose

This guide explains how to deploy the current CleanPrompt prototype in a controlled pilot environment for Chrome or Edge managed browsers.

This is a pilot/deployment guide for the current repo state, not a production enterprise rollout manual.

## What Exists Today

Current repo-supported deployment pieces:

- Manifest V3 browser extension at repo root
- local policy bundle inside the extension
- optional managed-mode enrollment and policy sync to the local control plane
- local control-plane demo service with policy, device, audit, and admin console endpoints

Current limits:

- no signed production extension package
- no managed extension update channel
- no production authentication or tenant isolation
- no production cloud hosting stack

## Pilot Deployment Shape

Recommended pilot topology:

1. Run the control plane locally or in a pilot dev environment.
2. Load the extension as an unpacked extension for pilot testing.
3. Enable managed mode only for pilot evaluators.
4. Use metadata-only demo events to validate the owner workflow.

## Local Control Plane Startup

From the repo root:

```bash
npm run start --workspace @cleanprompt/control-plane
npm run demo:seed
npm run package:pilot
npm run artifact:verify
```

Default local endpoint:

- `http://127.0.0.1:8787`

Available pilot endpoints:

- `/health`
- `/api/policies/default`
- `/api/device-enrollment`
- `/api/audit/events`
- `/api/admin/summary`
- `/api/admin/devices`
- `/api/admin/actions`
- `/admin`

If you want to hand the prototype to an evaluator without giving them the full source tree, generate the packaged evaluation kit in `dist/` with `npm run package:pilot`. That kit includes the unpacked extension, the runnable local control-plane slice, helper scripts, a package manifest, checksums, and the current pilot/trust docs.

Before sharing that kit, run `npm run artifact:verify` so the handoff package is checked against its packaged manifest and checksum inventory.

## Extension Loading For Pilot Use

Chrome:

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Choose `Load unpacked`.
4. Select the repo root folder.

Edge:

1. Open `edge://extensions`.
2. Turn on Developer mode.
3. Choose `Load unpacked`.
4. Select the repo root folder.

## Managed-Mode Settings

Current managed-mode defaults live in:

- [background.js](../../background.js)

Important local settings:

- control-plane base URL defaults to `http://127.0.0.1:8787`
- policy sync is available but disabled by default
- enrollment token defaults to a demo token for local development

For a pilot demo, confirm:

- the extension can reach the control plane
- enrollment succeeds
- policy sync succeeds
- metadata events appear in the admin console

For a repeatable founder or pilot setup, use the extension popup `Managed` tab:

- `Prepare managed demo` to clear local extension state, enable sync, enroll the device, and pull the current managed policy
- `Reset extension demo` to return the extension to a clean local baseline while preserving the configured control-plane base URL and enrollment token

For buyer-facing proof during a pilot, the extension popup `Platforms` tab now shows compatibility evidence captured from real host attachment checks, such as whether the prompt surface, trigger injection, and send-button path were recently verified on a supported host.

## Recommended Pilot Rollout Pattern

Start small:

1. Founder-only or internal evaluation.
2. Small trusted team such as helpdesk or solutions engineering.
3. Narrow use cases such as ticket summarization, log analysis, and client-comms drafting.

Track:

- false positives
- usability friction
- whether strict mode is required
- whether metadata-only owner visibility is sufficient

## Demo Reset Commands

To make a founder demo repeatable, use:

```bash
npm run demo:seed
npm run demo:reset
```

The admin console also exposes matching seed/reset buttons for live demo prep. On the extension side, use the popup `Managed` tab to run `Prepare managed demo` before each pitch and `Reset extension demo` between runs when you want a clean local baseline.

For the actual founder or pilot browser pass, use [MANUAL_QA_PLAN.md](MANUAL_QA_PLAN.md) as the step-by-step checklist.

## What A Production Deployment Would Still Need

Before broad enterprise rollout, add:

- signed extension packaging
- managed extension distribution guidance for Chrome and Edge admin consoles
- production control-plane hosting
- auth and tenant isolation
- release/versioning policy
- support and rollback guidance

## Honest Positioning

Use this guide to say:

- "We can run a controlled pilot today."

Do not use this guide to say:

- "This repo is already a production-managed browser deployment product."
