# Commercial Readiness Pack

This folder holds the buyer-facing and pilot-facing material that sits on top of the current technical prototype.

Current contents:

- `DEPLOYMENT_GUIDE.md`
- `PRIVACY_OVERVIEW.md`
- `SECURITY_OVERVIEW.md`
- `DEMO_SCRIPT.md`
- `PILOT_CHECKLIST.md`
- `MANUAL_QA_PLAN.md`
- `PILOT_QA_RESULTS.md`

Related packaging support in the repo:

- `npm run package:pilot`
- generated evaluator bundle at `dist/cleanprompt-evaluation-kit-v<version>/`

Purpose:

- explain how CleanPrompt would be introduced into a managed browser environment
- explain the privacy and security posture in plain language
- make the current repo easier to demo without improvising the product story
- give pilot customers a concrete evaluation path

Important scope note:

These documents describe the current prototype honestly. They should be used to support a pilot or pitch conversation, not to imply that the repo is already a production SaaS platform.
