# Control Plane Source

Current implemented files:

- `config.js`
- `validators.js`
- `persistence.js`
- `state.js`
- `server.js`

Current service behavior:

- starts a local HTTP server
- serves a local admin console shell at `/admin`
- serves a health endpoint
- returns a sample policy bundle
- returns a metadata-only owner summary
- returns a device registry for local admin workflows
- records admin policy-publish actions
- can seed and reset repeatable demo state for founder demos and pilot walkthroughs
- accepts device enrollment
- accepts metadata-only audit events into in-memory state
- validates enrollment and audit payload shape
- persists local state to a JSON file for development

Suggested next layout as the backend grows:

- `api/`
- `auth/`
- `devices/`
- `policies/`
- `rules/`
- `audit/`
- `shared/`
