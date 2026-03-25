# Manual QA Plan

## Goal

Run a founder-grade pilot-readiness pass against the real extension flow, not just automated checks.

This plan is for:

- unpacked extension validation in Chrome or Edge
- founder demos
- controlled pilot walkthroughs
- blocker logging before broader customer testing

## Exit Criteria

Manual QA is good enough to start pilot conversations when all of these are true:

- managed demo prep works from the popup without manual browser cleanup
- ChatGPT happy path works end to end
- at least one `justify` flow works
- at least one `block` flow works
- strict mode prevents metadata upload
- local-only mode still cleans prompts correctly
- owner/admin console reflects metadata-only activity without raw prompt text
- supported-host compatibility is checked on ChatGPT, Claude, Copilot, and Gemini

## Preflight

Before starting the browser pass:

1. Run `npm run verify`.
2. Run `npm run demo:seed`.
3. Start the local control plane.
4. Load the extension unpacked in Chrome or Edge.
5. Open the popup `Managed` tab.
6. Click `Prepare managed demo`.
7. Confirm managed enrollment and policy sync show success.

## Test Matrix

### 1. Managed Happy Path

Target host:

- ChatGPT first

Steps:

1. Open the AI host.
2. Confirm the `Clean` trigger appears.
3. Paste a prompt containing obvious sensitive data.
4. Click `Clean` once.
5. Confirm the live AI prompt is replaced directly with cleaned text without forcing a second paste step.
6. If you want the detailed review panel, use `Shift+Click` on `Clean` and confirm the sidebar opens with the current prompt prefilled.
7. Open the admin console and confirm the owner view updates with metadata-only insight.

Expected result:

- prompt is cleaned locally
- prompt is replaced directly in the live AI input by default
- raw prompt text is not shown in owner/admin surfaces
- owner summary reflects action/category activity

### 2. Justify Path

Target host:

- ChatGPT or Claude

Steps:

1. Use content that triggers `justify`.
2. Attempt `Allow once` without a reason.
3. Confirm replay does not continue.
4. Enter a short business reason.
5. Confirm replay continues after justification.

Expected result:

- reason is required before replay
- owner/admin surfaces do not show the raw prompt
- owner/admin surfaces do not depend on copied justification text

### 3. Block Path

Target host:

- any supported host

Steps:

1. Use content that triggers `block`.
2. Trigger the intercept modal.
3. Confirm `Allow once` is hidden.
4. Click `Block`.

Expected result:

- prompt is not replayed
- metadata-safe event logging still occurs

### 4. Strict Mode

Steps:

1. Enable or publish a strict-mode policy.
2. Repeat a sensitive prompt flow.
3. Check popup managed upload state.
4. Check owner/admin console.

Expected result:

- cleaning still works locally
- managed metadata upload remains off
- no raw prompt text appears anywhere

### 5. Local-Only Mode

Steps:

1. Disable managed sync.
2. Run a clean flow in the sidebar or intercept path.
3. Confirm the popup shows local-only mode.

Expected result:

- local redaction still works
- no dependency on control-plane availability

### 6. Supported Host Sweep

Check each:

- ChatGPT
- Claude
- Copilot
- Gemini

For each host, confirm:

- trigger attaches
- sidebar opens
- at least one clean flow works
- Platforms tab shows attachment evidence

### 7. Owner/Admin Review

In the admin console, confirm:

- action counts update
- category counts update
- recent events are metadata-only
- device registry is populated
- no raw prompt text is visible

## Evidence To Capture

Capture these during the pass:

- host tested
- scenario tested
- expected result
- actual result
- screenshot or short note when useful
- blocker severity

Use this blocker severity:

- `P0`: core flow broken, cannot demo
- `P1`: trust or UX issue that weakens pilot credibility
- `P2`: minor friction or polish issue

## Suggested Run Order

1. Managed happy path on ChatGPT
2. Justify path
3. Block path
4. Owner/admin review
5. Strict mode
6. Local-only mode
7. Supported-host sweep

## Blocker Log Template

Use this format:

```text
Host:
Scenario:
Severity:
Expected:
Actual:
Notes:
```

## Related Docs

- [DEMO_SCRIPT.md](DEMO_SCRIPT.md)
- [PILOT_CHECKLIST.md](PILOT_CHECKLIST.md)
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
