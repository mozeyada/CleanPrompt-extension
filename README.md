# LogClean Browser Extension Prototype

This folder contains the core product artifact: a Manifest V3 browser extension that sanitizes prompts locally before they are sent to AI chat tools.

## Intended Flow

1. User pastes content into ChatGPT, Claude, Gemini, or Copilot.
2. The content script injects a `Clean` action near the prompt box.
3. The extension redacts sensitive values locally and classifies the likely workflow intent.
4. The user gets a review step, an explanation, and a Safe Compose prompt.
5. Only metadata-safe aggregate events are stored locally for admin-style insight.

## Main Pieces

- `manifest.json`: extension definition, permissions, and match patterns
- `content.js`: page integration, review/send flow, safe compose, and policy-aware interception
- `background.js`: local policy bundle, audit/event storage, and trust settings
- `popup.html` and `popup.js`: extension popup
- `engine/redactor.js`: regex rule engine, intent classification, safe-compose generation, and event summaries
- `engine/rules.json`: bundled rules data

## Important Caveats

- DOM selectors for AI sites are fragile and may require regular maintenance.
- Audit and insight data still stays inside extension storage in this repo; it is not yet synced to the Next admin console.
- The local policy bundle is real for prototype use, but there is no production admin delivery path yet.
- Stage-2 NER is intentionally disabled in this build to avoid remote model ambiguity.

## Permissions Review

Current permissions include:

- active tab scripting/storage access
- host access to supported AI sites

This build removes the earlier external rule/model hosts so the trust story is cleaner.

## Testing

Use the unpacked extension flow in [LOGCLEAN_TEST_PLAN.md](/home/zee/DataAnn/LOGCLEAN_TEST_PLAN.md).

No automated extension test suite was found in this workspace.
