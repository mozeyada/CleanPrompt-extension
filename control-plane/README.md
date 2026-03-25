# Control Plane

This package hosts the enterprise SaaS control plane.

Current status:

- runnable Node service skeleton now exists in `src/server.js`
- local file-backed policy, device, and audit state exists for development
- shared-schema-backed request validation exists for enrollment and audit ingest
- local admin console shell now exists at `/admin`
- repeatable demo seed/reset flow now exists through API endpoints, admin-console actions, and CLI scripts
- package-local backend tests now exist under `test/`
- TypeScript-backed static checking now exists for the backend runtime through `tsc --noEmit` plus local workspace integrity checks
- not yet production-ready
- no database or auth yet, and tenant isolation enforcement is still only implicit in the local demo model

Current endpoints:

- `GET /admin`
- `GET /health`
- `GET /api/policies/default`
- `GET /api/audit/events`
- `GET /api/admin/summary`
- `GET /api/admin/devices`
- `GET /api/admin/actions`
- `POST /api/device-enrollment`
- `POST /api/audit/events`
- `POST /api/admin/policies/default`
- `POST /api/demo/seed`
- `POST /api/demo/reset`

Useful local commands:

- `npm run demo:seed --workspace @cleanprompt/control-plane`
- `npm run demo:reset --workspace @cleanprompt/control-plane`
- `npm run build --workspace @cleanprompt/control-plane`
- `npm run lint --workspace @cleanprompt/control-plane`
- `npm run test --workspace @cleanprompt/control-plane`
- `npm run typecheck --workspace @cleanprompt/control-plane`
- `npm run package:pilot` from the repo root to generate an evaluator kit that includes this control-plane slice

Planned responsibilities beyond the current skeleton:

- tenant-aware policy APIs
- audit ingestion APIs
- device enrollment and registry
- rule rollout coordination
- admin-facing services
