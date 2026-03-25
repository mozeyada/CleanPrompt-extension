# Demo Script

## Goal

Show both sides of the product in one short flow:

- employee uses AI faster without rewriting sensitive prompts
- owner gets useful visibility without receiving prompt text

## Demo Setup

Before the demo:

1. Start the local control plane.
2. Seed the control-plane demo state with `npm run demo:seed`.
3. Load the extension unpacked in Chrome or Edge.
4. Open the extension popup `Managed` tab.
5. Click `Prepare managed demo`.
6. Confirm the popup shows managed enrollment and policy sync as complete.
7. Open the admin console at `/admin`.

Recommended windows:

- browser window with ChatGPT or another supported AI app
- extension popup
- admin console

## Demo Narrative

Use this story:

"Employees want to use AI for ticket summaries, incident analysis, and client communications, but companies do not want secrets, credentials, or client identifiers pasted into public models. CleanPrompt sits in the browser, cleans sensitive content locally, and gives admins only metadata-safe insight."

## Demo Flow

### Part 1: Employee Value

1. Open a supported AI app.
2. Show the injected `Clean` button.
3. Paste a prompt that contains obvious sensitive data:
   - email
   - secret/token
   - IP or device identifier
4. Click `Clean`.
5. Show:
   - sensitive findings
   - sanitized output
   - workflow guidance
   - Safe Compose prompt
6. Mention that the extension was reset and re-prepared from the popup before the demo, so the owner view you show later is generated from this session rather than stale test data.

Key line:

"The employee still gets help from AI, but they do not have to manually rewrite the prompt."

### Part 2: Policy Value

1. Show a case that triggers `justify` or `block`.
2. Explain that the policy model can warn, redact, justify, or block.
3. If using the intercept flow, show the review modal.

Key line:

"The company does not have to choose between full freedom and a full ban. It can guide usage with policy."

### Part 3: Owner Value

1. Open the admin console.
2. Refresh the dashboard.
3. Show:
   - action counts
   - category counts
   - recent metadata events
   - device visibility
4. Open the extension popup `Platforms` tab and show that supported-host compatibility is now based on captured attachment evidence rather than a static checklist.
   Mention that the popup now also shows whether the host matched on a primary or fallback selector path.
5. Point out what is missing on purpose:
   - no raw prompt text
   - no revealed secrets
   - no copied justification text

Key line:

"The owner gets visibility into adoption and risk patterns without receiving the sensitive prompt content itself."

### Part 4: Trust Value

1. Open the privacy/security docs if needed.
2. Point to strict mode and metadata-only rules.
3. Explain that the upload path is both allowlisted in the extension and validated on the backend.

Key line:

"This is not just a UI promise. The trust boundary is enforced in code and covered by tests."

## Demo Close

Close with:

"CleanPrompt is the AI adoption layer for companies that want employees to move faster without leaking secrets into AI tools."

## Common Questions

If asked "Do you store prompts?"

- "Not in the default enterprise mode. The current managed flow keeps raw prompt text on the endpoint and uploads metadata-only summaries."

If asked "Can admins see exactly what employees wrote?"

- "Not in the default trust model shown here."

If asked "Is this production-ready?"

- "This repo is pilot-ready for a controlled demo, not yet a finished enterprise SaaS platform."

## Between Demo Runs

If you need to re-run the same pitch flow:

1. Click `Reset extension demo` in the popup `Managed` tab.
2. Use `Prepare managed demo` again.
3. Re-seed the control plane only if you want the owner dashboard returned to its known demo baseline.
