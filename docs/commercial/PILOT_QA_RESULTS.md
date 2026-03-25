# Pilot QA Results

**Date:** 2026-03-25  
**Pass Type:** Pilot-readiness QA kickoff  
**Scope:** Owner/admin baseline plus environment readiness for browser-side manual testing

## What Was Verified

### Repo and release baseline

- `npm run qa:pilot` passed
- `npm run verify` passed
- `npm run release:check` passed

### Demo-state baseline

- `npm run demo:seed` passed
- Seeded state reported:
  - `policy_version=2026.03.30-demo-seeded`
  - `device_count=3`
  - `audit_event_count=3`

### Owner/admin service baseline

The local control plane was started successfully and the owner-side endpoints responded:

- `GET /health`
  - service status was `ok`
  - environment was `development`
  - demo state reported `device_count=3`
  - demo state reported `audit_event_count=3`

- `GET /api/admin/summary`
  - returned `metadata_only=true`
  - returned `raw_prompt_retention=false`
  - returned action counts for `redact`, `justify`, and `block`
  - returned category, intent, browser, and device-version summaries

- `GET /api/admin/devices`
  - returned 3 enrolled demo devices
  - showed browser family, OS family, and version metadata

- `GET /api/admin/actions`
  - returned the seeded `demo_seed` admin action

### Owner/admin UI surface baseline

- `GET /admin` returned the admin console HTML shell
- `GET /admin/app.js` returned the admin console client script
- `GET /admin/styles.css` returned the admin console stylesheet

## What Is Still Pending

### Browser-side manual pass

The full extension walkthrough is still pending for:

- ChatGPT managed happy path
- justify flow
- block flow
- strict-mode validation in the browser
- local-only mode validation in the browser
- supported-host sweep across ChatGPT, Claude, Copilot, and Gemini
- popup `Managed` and `Platforms` tab visual checks

## Current Blockers

### Environment blocker

`P1`: no browser binary was available in this execution environment path, so the extension UI could not be clicked through directly from here.

Impact:

- owner/admin baseline is verified
- extension-side browser pass still needs a real Chrome or Edge session

## Browser Feedback Fixes Ready For Re-test

The following UX issue was reported and fixed in code, but still needs browser re-test:

- normal `Clean` click previously opened the sidebar and forced a second paste step
- sidebar insert actions could auto-submit the form and contributed to a freeze-like experience

Expected behavior after the fix:

- normal `Clean` click replaces the live prompt with cleaned text directly
- `Shift+Click` on `Clean` opens the detailed sidebar flow
- sidebar insert actions replace text without auto-submitting

## Recommended Next Step

Run the browser-side part of [MANUAL_QA_PLAN.md](MANUAL_QA_PLAN.md) in a real Chrome or Edge session with the unpacked extension loaded, starting with:

1. `npm run demo:seed`
2. start the local control plane
3. load the extension unpacked
4. click `Prepare managed demo`
5. run the ChatGPT managed happy path first
