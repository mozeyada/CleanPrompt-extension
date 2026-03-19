# Identity And RBAC

## Purpose

Define the enterprise identity model for the LogClean control plane and managed extension fleet.

## 1. Identity Principles

1. Enterprise-managed identity first
   Customers should use their own identity provider where possible.

2. Least privilege
   Roles grant the minimum access needed for the task.

3. Full admin auditability
   Every privileged action must be attributable.

4. Fast lifecycle enforcement
   Joiner, mover, and leaver changes must propagate quickly.

## 2. Identity Actors

### Tenant user

A human end user who runs the extension and is associated with an organization and optionally a team.

### Tenant admin

A customer administrator who can manage product settings within a tenant scope.

### Support admin

An internal operator with tightly constrained support access.

### Service principal

A non-human identity used for system-to-system actions such as publishing signed manifests or processing export jobs.

## 3. Authentication Model

### Control plane

Required:

- OIDC support
- session management with secure cookies or equivalent
- MFA inherited from customer IdP where available

Recommended:

- SAML support for enterprise contracts
- SCIM for user and group lifecycle

### Extension

Required:

- enrolled device identity
- tenant binding
- version-aware auth context

Recommended:

- per-device credential or asymmetric key pair
- token rotation support

## 4. Role Model

### `org_admin`

Can:

- manage org settings
- manage teams and users
- approve policy changes
- view and export audit data
- revoke devices

Cannot:

- bypass immutable admin audit logs

### `policy_admin`

Can:

- create and edit policy drafts
- manage rule rollout state
- view policy impact analytics

Cannot:

- manage billing
- manage support access
- perform unrestricted audit export unless explicitly granted

### `auditor`

Can:

- view audit data
- run searches and approved exports
- review admin action history

Cannot:

- change policies
- manage users or devices

### `member`

Can:

- use the extension
- view only their own allowed local settings and status

Cannot:

- administer tenant resources

### `support_admin`

Can:

- perform approved support diagnostics
- view narrow operational metadata when just-in-time approved

Cannot:

- access tenant content broadly
- export tenant audit data by default
- change tenant policy without explicit tracked approval

## 5. Scope Model

Authorization must support:

- org scope
- team scope
- user scope
- device scope

Policy resolution order should eventually support:

- user override
- team override
- org baseline
- platform default

## 6. Lifecycle Requirements

### Joiner

- user created via SCIM or admin invite
- team assignment applied
- eligible for managed extension enrollment

### Mover

- team or role change updates authorization
- policy scope updates on next sync or sooner if push/refresh is available

### Leaver

- control plane access disabled
- extension enrollment revoked
- device tokens invalidated

## 7. Required Audit Events

The system must record:

- admin login
- failed admin login
- role change
- user invite
- user revoke
- device enroll
- device revoke
- policy draft create/update
- policy publish
- rule rollout change
- export request
- export completion
- support access approval and use

## 8. Mapping To Current Repo

Current repo status:

- `background.js` has local org/team placeholders but no real enterprise identity.
- `content.js` reads policy context but does not yet have enrolled user/device identity.
- no server-side RBAC exists yet.

This means the current local identifiers should be treated as prototype placeholders, not durable enterprise identity objects.

## 9. Decisions Needed Next

1. Will SCIM be in MVP or post-MVP?
2. Will device identity use issued opaque tokens, public-key credentials, or hybrid auth?
3. Will policy publish require dual approval for high-sensitivity tenants?
4. Will support access be customer-approved per incident?

## 10. Exit Criteria

This identity model is approved when:

- product and engineering agree on enterprise-first auth direction
- security approves the role model and support-access stance
- backend implementation can proceed with stable auth and authorization assumptions
