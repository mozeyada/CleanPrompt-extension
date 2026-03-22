# LogClean Implementation Plan (Owner: AI/Repo Maintainer)

## 1. Canonical roadmap

- `ENTERPRISE_ROADMAP.md` is the single source of truth going forward.
- `PRODUCTION_ROADMAP.md` is archived as legacy and not referenced in docs.

## 2. Immediate repo housekeeping (done)

- Added affirmation to `README.md` pointing to `ENTERPRISE_ROADMAP.md`.
- Verified `PRODUCTION_ROADMAP.md` is removed.
- Confirmed working tree is clean before and after all actions.

## 3. Next technical tasks (owners could be same) 

1. Add automation test framework:
   - unit tests for `engine/redactor.js`, policy actions and `engine/rules.json` coverage
   - e2e tests for ext flow on 3 AI providers
2. Add control plane API skeleton in `control-plane/src`
   - policy CRUD
   - device enrollment
   - audit ingest
3. Implement extension policy sync:
   - fetch policy bundle from `/policy/:org` in runtime
   - fallback to local
4. Rule delivery cycle:
   - tag + sign `rules.json`
   - CDN + rollback
5. Governance docs:
   - `SECURITY.md`, `SUPPLY_CHAIN.md`, `COMPLIANCE.md`

## 4. Immediate process tasks

- Create issues for each major phase in issue tracker.
- Split roadmap chapters in a kanban board:
  - `prototype-stabilization`
  - `control-plane-mvp`
  - `enterprise-readiness`

## 5. Communication

- Post a summary update in the team channel:
  - `Roadmap canonicalized to ENTERPRISE_ROADMAP.md`
  - `legacy roadmap removed`
  - `Implementation plan established`.
