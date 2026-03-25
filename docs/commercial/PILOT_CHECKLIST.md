# Pilot Checklist

## Goal

Use this checklist to run a controlled pilot that tests product value, privacy posture, and buyer fit.

## Before Pilot Start

- Define pilot owner on the customer side.
- Define the target user group.
- Choose a narrow initial workflow:
  - ticket summarization
  - log analysis
  - incident response drafting
  - client communication drafting
- Confirm supported browser and AI tool usage.
- Decide whether strict mode should be enabled.
- Agree on what owner/admin metadata will be reviewed.

## Technical Readiness

- Control plane starts successfully.
- Extension loads in Chrome or Edge.
- Extension `Managed` tab can reset and re-prepare the demo/pilot state without manual browser cleanup.
- Device enrollment works.
- Policy sync works.
- Managed metadata events appear in the admin console.
- Demo policy behavior is understood by pilot users.

## Trust Readiness

- Customer understands that raw prompt text stays on endpoint in the default enterprise mode.
- Customer understands that admin visibility is metadata-only.
- Customer understands current prototype limits:
  - no production auth
  - no production tenant isolation
  - no signed release flow

## Success Metrics

Track:

- employee willingness to use AI with the extension enabled
- reduction in manual prompt rewriting
- false positive rate
- whether policy actions feel too strict or too loose
- whether metadata-only admin insight is sufficient
- whether the buyer sees this as an enablement tool rather than a blocker

## Pilot Review Questions

- Did employees feel safer using AI with CleanPrompt?
- Did admins get useful visibility without seeing prompt content?
- Which rules were noisy?
- Which workflows were most valuable?
- Did strict mode or managed mode better fit the customer?
- What proof would the buyer need before paid rollout?

## Exit Criteria For A Strong Pilot

- repeated employee usage during normal work
- owner/admin sees meaningful risk/adoption insight
- privacy story is understood and appreciated
- buyer asks for deployment, packaging, or procurement next steps

## If The Pilot Struggles

Check:

- unsupported AI-site selector drift
- excessive false positives
- unclear policy messaging
- insufficient buyer value in the owner dashboard
- mismatch between promised trust model and customer expectations
