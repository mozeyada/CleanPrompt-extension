# LogClean Extension – Production Roadmap v1.0
**Status:** In Progress | **Last Updated:** 2026-03-19 | **Owner:** [Your Team]

---

## 📋 Executive Summary

LogClean is a browser extension that redacts sensitive data locally before users send prompts to AI tools. This document outlines the path from **prototype → production-ready MSP deployment**.

**Current State:** Functional prototype with core redaction engine, basic UI, and local audit logging.  
**Target State:** Enterprise-grade extension with admin console, multi-tenant policies, OTA rule delivery, comprehensive testing, and MSP workflow integration.

**Estimated Timeline:** 4-6 months (phased, iterative)  
**Next Milestone:** Phase 1 (Weeks 1-4) – Admin Console & Enhanced Policy Management

---

## 🔍 Current State Analysis

### A. What Works ✅

| Component | Status | Quality |
|-----------|--------|---------|
| **Core Redaction Engine** | Production-ready | High – 40+ regex rules, well-tested |
| **Multi-platform Support** | 5 platforms live | Good – UI injection/DOM selectors work |
| **Local Rule Bundle** | Bundled in extension | Solid – Rules updated manually in rules.json |
| **Audit Logging** | Basic local storage | Functional – Metadata-safe events recorded |
| **Policy Engine** | Defined, partially implemented | Medium – Policy bundle structure exists but incomplete |
| **Intent Classification** | 9 workflow intents defined | Medium – Rules defined, not fully tested |
| **UI/UX (Sidebar)** | Functional | Medium – Works but needs polish |

### B. What's Missing / Broken ❌

| Gap | Impact | Priority |
|-----|--------|----------|
| **Admin Console** | No way to manage policies, view audit logs, or configure rules | 🔴 CRITICAL |
| **OTA Rule Delivery** | Rules can't be updated without releasing new extension version | 🔴 CRITICAL |
| **Multi-tenant Policy** | All installations identical; no org/user-level customization | 🔴 CRITICAL |
| **DOM Selector Fragility** | Breaks when ChatGPT/Claude updates their UI | 🟠 HIGH |
| **No Test Suite** | Quality assurance manual only; high regression risk | 🟠 HIGH |
| **Policy Enforcement** | Definitions exist but don't actually block/warn/redact | 🟡 MEDIUM |
| **Encrypted Storage** | Audit logs stored plaintext in browser storage | 🟡 MEDIUM |
| **Performance** | No profiling; potential slowness on large logs | 🟡 MEDIUM |
| **Deployment Pipeline** | Manual build/release; no CI/CD | 🟡 MEDIUM |
| **Documentation** | README exists, needs API docs + deployment guide | 🟡 MEDIUM |

### C. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser Extension (Manifest V3)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │  background.js   │  │  content.js      │  │  popup.js    │   │
│  │ (Service Worker) │  │ (Page Injection) │  │  (Settings)  │   │
│  └──────────────────┘  └──────────────────┘  └──────────────┘   │
│         │                      │                      │          │
│    Policy Bundle         Redaction Engine      Rule Management   │
│    Audit Storage         UI Sidebar            Settings UI       │
│    Trust Settings        Auto-Submit           Audit View        │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ engine/redactor.js                                        │   │
│  │ - Core redaction: pattern matching, intent classification│   │
│  │ - Safe-compose generation (clean prompt synthesis)       │   │
│  │ - Event summarization (metadata-safe audit)              │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ engine/rules.json (40+ regex rules)                       │   │
│  │ + Network, Credentials, PII, Financial, MSP vendors       │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ Chrome Storage API (Local Audit / Policy / Settings)      │   │
│  │ - Metadata-only events                                    │   │
│  │ - No raw prompt retention                                 │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Production Components (NEW)                                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────┐  ┌─────────────────┐  ┌────────────────┐    │
│  │ Admin Console  │  │ Policy Server   │  │ Rule Delivery  │    │
│  │ (Next.js SPA)  │  │ (Node.js/REST)  │  │ Service (CDN)  │    │
│  └────────────────┘  └─────────────────┘  └────────────────┘    │
│         │                     │                    │             │
│    Dashboard           Multi-tenant Policy    OTA Rule Push      │
│    Audit Log Viewer    Organization Config   Version Control     │
│    Rule Management     User Assignments      Rollback Strategy   │
│    Settings UI         API Keys              Analytics Backend   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Production Readiness Criteria

**Success = Extension passes these gates:**

- ✅ Admin console can push policies to 10+ orgs simultaneously
- ✅ Rules can be updated OTA without version bump (rollback safe)
- ✅ Multi-user organization support (user ↔ org ↔ policy mapping)
- ✅ 95%+ rule match accuracy (validated against test datasets)
- ✅ Zero crashes on 100MB+ logs
- ✅ <2s redaction latency (user experience acceptable)
- ✅ 100% platform coverage (ChatGPT/Claude/Gemini/Copilot/Bing tested monthly)
- ✅ Full audit trail with encryption at rest
- ✅ Compliance ready: GDPR (data minimization), SOC2 (audit), HIPAA (encryption)
- ✅ Documented API for admin integrations

---

## 📈 Phased Roadmap

### **PHASE 1: Admin Console & Policy Foundation (Weeks 1-4)**
*Goal: Enable centralized policy management and org setup*

#### 1.1 Admin Console Backend (Node.js REST API)
- [ ] **Setup**
  - Node.js/Express server scaffolding
  - PostgreSQL database schema (orgs, users, policies, audit)
  - JWT authentication + API key management
  - Docker containerization for deployment

- [ ] **Core Endpoints** (REST API)
  - `POST /orgs` – Create new organization
  - `GET /orgs/:id/policies` – Fetch current policy bundle
  - `PATCH /orgs/:id/policies` – Update policy (push to all users)
  - `GET /orgs/:id/audit` – Paginated audit log export
  - `POST /users` – Invite user to org
  - `GET /users/:id/devices` – List enrolled extension instances
  - `DELETE /orgs/:id/users/:uid` – Revoke member access

- [ ] **Database Schema**
  ```sql
  -- Abbreviated; full schema in IMPLEMENTATION.md
  organizations (id, name, domain, created_at, admin_user_id)
  users (id, email, org_id, role, created_at)
  devices (id, user_id, org_id, extension_version, last_seen)
  policies (id, org_id, version, rules_active, intent_rules, actions, created_at)
  audit_events (id, org_id, device_id, event_summary, created_at)
  ```

#### 1.2 Admin Console Frontend (Next.js SPA)
- [ ] **Pages**
  - Login / Signup
  - Organization Dashboard (overview, stats)
  - Policy Editor (visual rule toggle, intent mapping)
  - Audit Log Viewer (search, filter, export)
  - User Management (invite, revoke, role assignment)
  - Device Registry (enrolled extensions, version tracking)

- [ ] **UI Components**
  - RuleToggleCard (checkbox + info for each rule)
  - PolicyPreview (before/after redaction samples)
  - AuditTable (paginated, searchable event history)
  - OrgStats (chart: events/day, top rules triggered, etc.)

#### 1.3 Extension Updates for Console
- [ ] **Connect to Admin Console**
  - New message `GET_ORG_POLICY` → fetches policy from `console.logclean.io/<org_id>`
  - Auto-retry with exponential backoff (3 attempts, 5m timeout)
  - Fallback to bundled policy if console unreachable

- [ ] **Device Registration**
  - On first launch: POST `/devices/register` with device info (org_key, version, platform)
  - Receive `device_id` + auth token for future requests
  - Store in `logclean_device_id` and `logclean_auth_token`

- [ ] **Policy Sync**
  - Fetch org policy every 6 hours (background sync)
  - Compare versions; download if stale
  - Decrypt policy (use device-specific key for endpoint protection)
  - Fallback gracefully if sync fails

**Deliverables:**
- Working admin console accessible at `console.logclean.io`
- Extension fetches policy from console API
- Org + user + device management UI complete
- Basic audit log viewer

**Success Metrics:**
- Admin can create org, invite users, push policy changes
- Extension enrolls and receives policy within 30s
- Audit events are correctly attributed to org/user/device

**Owner & Team Size:**
- Backend: 2-3 engineers (1 lead, 1-2 junior)
- Frontend: 2 engineers
- QA: 1 tester (manual API + UI testing)

---

### **PHASE 2: OTA Rule Delivery & Policy Enforcement (Weeks 5-8)**
*Goal: Push rule updates without version bump; enforce policy actions*

#### 2.1 Rule Delivery Service
- [ ] **Rule Versioning & CDN**
  - Git-based rule versioning (rules.json in repo, tagged releases)
  - Build step: compile rules → JSON schema validation → sign
  - Upload to CloudFlare CDN: `cdn.logclean.io/rules/v1.2.1.min.json`
  - Maintain rollback capability (store last 10 rule versions)

- [ ] **Extension Rule Sync**
  - Fetch `/rules/latest-meta.json` every 12 hours (or on demand)
  - Compare hash; if new, download from CDN
  - Validate signature (RSA verify with admin's public key)
  - Deserialize regexes; replace `LOGCLEAN_RULES` in-place
  - Store cache in `logclean_cached_rules_v2` + timestamp

- [ ] **Rollback Capability**
  - If rule sync fails > 3x, revert to previous version
  - Admin can manually trigger rollback in console: `POST /rules/{version}/rollback`
  - Notify users: "Rule update reverted; using v1.2.0 (was v1.2.1)"

#### 2.2 Policy Enforcement Engine
- [ ] **Extend redactor.js**
  - Fetch `logclean_policy_bundle` from storage
  - Apply `actions.by_category` mapping: "Credential" → "justify" (require user explanation)
  - Implement 3 action modes:
    - **allow**: Don't redact, pass through
    - **warn**: Redact with warning badge
    - **justify**: Redact + require user justification before sending
    - **block**: Redact, prevent send (show error)
    - **redact**: Remove without warning
  - Add policy check before `insertIntoInput()`

- [ ] **Justification Flow**
  - When user hits "Send," check redacted categories for policy.justification_required
  - If found: show modal overlay "Justify your use of [Category]"
  - User provides reason (free text: "debugging issue X", "client inquiry", etc.)
  - Append reason to audit event; then proceed with send

- [ ] **Policy-Aware Sidebar**
  - Display policy enforcement status: "This org requires justification for Credentials"
  - Show warning tone for "warn" actions, error tone for "block"
  - Sample: "🟡 Credential detected – Your org policy requires explanation (you can provide in the next step)"

#### 2.3 Dashboard Analytics
- [ ] **Rule Analytics**
  - Chart: "Top 10 Rules Triggered This Week" (bar chart)
  - Chart: "Policy Violations by Category" (pie)
  - Trend: "Events/Day over 30 days" (line)
  - Table: "Recent Redactions" (paginated, org-level aggregate)

- [ ] **Policy Compliance Dashboard**
  - Cards: "Justifications Provided / Required", "Blocks Triggered", "Device Compliance %"
  - Alert: "Rule X has 0 matches in 7 days – may be stale"

**Deliverables:**
- Rule versioning + CDN delivery in place
- OTA rule sync tested on extension
- Policy enforcement (allow/warn/justify/block) live in redactor.js
- Justification modal + audit capture
- Admin console shows policy enforcement analytics

**Success Metrics:**
- Admin can push rule update; extension receives within 12 hours
- Justification flow captures user intent correctly
- Policy enforcement doesn't cause crashes

**Owner & Team Size:**
- Backend: 1 senior engineer (lead OTA architecture)
- Frontend: 1 engineer (dashboard chart work)
- Extension: 1 engineer (integration)
- QA: 2 testers (extensive testing of sync/rollback scenarios)

---

### **PHASE 3: Multi-tenant Architecture & User Management (Weeks 9-12)**
*Goal: Support multiple teams/departments within one org; granular access control*

#### 3.1 Organizational Hierarchy
- [ ] **Data Model**
  - Organization → Team → User → Device
  - Example: "Acme Corp" (org) → "Helpdesk" + "Finance" (teams) → Users → Extension instances

- [ ] **Policy Inheritance**
  - Org-level policy (default for all teams)
  - Team-level policy (override org policy for specific team)
  - User-level exceptions (admin can exempt user from certain rules)
  - Resolution order: User > Team > Org > Fallback

- [ ] **RBAC**
  - Roles: Admin (all), PolicyEditor (rules only), Auditor (read-only logs), Member (use extension)
  - Permissions matrix in database
  - Enforce via JWT scopes: `policy:write`, `audit:read`, etc.

#### 3.2 Admin Console Enhancements
- [ ] **Team Management UI**
  - Create/delete teams
  - Assign users to teams
  - Set team-specific policies

- [ ] **Policy Hierarchy Editor**
  - Visual UI showing: Org policy → Team override → User exception
  - Drag-drop rule assignment by team
  - Diff viewer: "How does Finance team policy differ from org default?"

#### 3.3 Device Enrollment at Scale
- [ ] **Device Linking**
  - User enrolls device via admin console invite link (one-time token)
  - Extension receives device-specific token
  - Can link one user to multiple devices (laptop, desktop, etc.)

- [ ] **Device Status Dashboard**
  - Show device version, last sync time, compliance status
  - Ability to force sync / revoke device remotely
  - Bulk actions: "Revoke all devices for user X"

**Deliverables:**
- Multi-level org structure (org → team → user) fully supported
- RBAC implemented and enforced
- Team policy override UI in console
- Device linking workflow

**Success Metrics:**
- Admin can create teams and assign users
- Team-level policy overrides work correctly
- Device sync respects team policies

**Owner & Team Size:**
- Backend: 2 engineers (RBAC, policy hierarchy)
- Frontend: 1 engineer (team/device management UI)
- QA: 1 tester

---

### **PHASE 4: Testing & Quality Assurance (Weeks 13-16)**
*Goal: Comprehensive quality gates before MSP launch*

#### 4.1 Automated Test Suite
- [ ] **Unit Tests** (Jest)
  - Redactor engine: 50+ test cases for rule matching accuracy
  - Rule false positive / negative analysis
  - Intent classifier: validate workflow intent detection
  - Policy enforcement: each action mode tested
  - Coverage target: 85%+

- [ ] **Integration Tests** (Playwright)
  - End-to-end: user logs in → creates org → invites user → syncs policy → redacts log
  - Cross-platform: test DOM selectors on ChatGPT/Claude/Gemini/Copilot/Bing
  - OTA rule sync tested with network delays
  - Policy push to 100 concurrent devices

- [ ] **Regression Tests**
  - Run on every rule update
  - Compare redaction output against golden dataset
  - Alert if accuracy drops below 95%

- [ ] **Performance Tests**
  - Redact 100MB log: must complete < 5s, memory < 500MB
  - Policy sync with 10K rules: should fetch < 2s
  - Admin console render 10K audit events: < 3s

#### 4.2 Security Audit
- [ ] **Code Review**
  - Manual review: redactor.js (regex DoS risk), API endpoints (injection)
  - Third-party dependency scan (npm audit, Snyk)

- [ ] **Penetration Testing**
  - Admin console: SQL injection, XSS, CSRF tests
  - API: unauthorized access, token replay, rate limiting
  - Extension: CSP bypass attempts, storage tampering

- [ ] **Data Privacy**
  - Verify no raw prompts retained in audit log
  - Audit encryption at rest (in storage)
  - Check GDPR: data deletion capability, export API

#### 4.3 Platform Stability Testing
- [ ] **Monthly Regression** (automated)
  - Run suite against latest ChatGPT, Claude, Gemini, Copilot, Bing
  - DOM selector verification (capture screenshots, diff against baseline)
  - Auto-report any selector breakage

- [ ] **User UAT**
  - Recruit 5-10 beta MSP users
  - Real-world logs (Datto, ConnectWise, SentinelOne)
  - Feedback on UI, false positives, performance

**Deliverables:**
- 100+ automated tests passing
- Security audit report + fixes
- Monthly regression framework
- UAT feedback summary

**Success Metrics:**
- 95%+ test pass rate
- No critical security findings
- <2 DOM selector breakages per month (acceptable)

**Owner & Team Size:**
- QA Lead: 1 senior QA engineer
- QA Engineers: 2 (manual + automation)
- Security: 1 consultant (audit)
- DevOps: 1 (CI/CD pipeline, test infrastructure)

---

### **PHASE 5: Deployment Infrastructure & Documentation (Weeks 17-20)**
*Goal: Production-grade infrastructure, monitoring, and runbooks*

#### 5.1 Infrastructure
- [ ] **Deployment Environments**
  - Dev (localhost)
  - Staging (staging.logclean.io, test policies/users)
  - Production (console.logclean.io)
  - All using Docker + Kubernetes (or AWS ECS)

- [ ] **Database & Backups**
  - PostgreSQL (production: replicated, HA)
  - Daily backups to S3 (encrypted)
  - Disaster recovery test monthly (restore from backup)

- [ ] **Monitoring & Alerting**
  - Prometheus + Grafana (metrics)
  - Alert thresholds: API error rate > 1%, response time > 5s, sync failures > 5%
  - Slack/email notifications for on-call

- [ ] **CDN for Rule Distribution**
  - CloudFlare or AWS CloudFront
  - Global edge caching (rules.json)
  - 99.9% uptime SLA

#### 5.2 CI/CD Pipeline
- [ ] **GitHub Actions Workflow**
  - On PR: lint, test, build, SAST (SonarQube)
  - On merge to main: deploy to staging
  - Manual promotion button: staging → production
  - Include database migration safety checks
  - Rollback capability: one-click revert

- [ ] **Extension Build & Release**
  - Auto-build extension on new tag
  - Sign with private key (code signing)
  - Upload to Chrome Web Store (automated or semi-automated)
  - Maintain version history

#### 5.3 Documentation
- [ ] **Admin Guide** (for MSP customers)
  - Getting started: create org, invite users
  - Policy management: rule toggle, intent mapping, team overrides
  - Audit log interpretation + export
  - Troubleshooting: extension not syncing, policy not applied

- [ ] **API Documentation** (for integrations)
  - OpenAPI/Swagger spec for all endpoints
  - Auth examples (JWT, API key)
  - Rate limiting policy
  - Example integrations (e.g., ServiceNow → LogClean sync)

- [ ] **Deployment Runbook** (for ops team)
  - Pre-flight checks
  - Database schema migration steps
  - Rollback procedure
  - Health check dashboard
  - Incident response (API down, rule sync fail, etc.)

- [ ] **Developer Docs** (for customer dev teams using API)
  - Architecture overview
  - SDK/library (if applicable)
  - Webhook events (if applicable)
  - Code examples (Python, JavaScript)

**Deliverables:**
- Production infrastructure deployed & tested
- CI/CD pipeline fully automated
- Comprehensive documentation (admin, API, runbook, dev)
- Monitoring dashboard live

**Success Metrics:**
- Zero downtime during initial rollout
- New deployment takes < 15 min
- Rollback < 5 min
- All runbooks tested

**Owner & Team Size:**
- DevOps/SRE: 2 engineers
- Tech Writer: 1
- Product Lead: 1 (doc review)

---

### **PHASE 6: Launch Prep & MSP Onboarding (Weeks 21-24)**
*Goal: Ready for closed-environment test with MSP partner*

#### 6.1 Customer Onboarding Flow
- [ ] **Signup Experience**
  - Self-serve org creation (email verification)
  - Pre-populated MSP industry defaults (Datto, ConnectWise, SentinelOne rules active)
  - Sample audit data for first-time tour

- [ ] **Onboarding Checklist**
  - Create org ✓
  - Invite 3-5 test users ✓
  - Download extension ✓
  - Enroll device ✓
  - Test redaction on sample log ✓
  - Review audit log ✓

#### 6.2 Pre-Launch Validation Checklist
- [ ] **Functional**
  - [ ] All CRUD operations on console working
  - [ ] Policy push to 100 devices < 30s
  - [ ] Rule update syncs correctly
  - [ ] Audit events correctly attributed
  - [ ] Redaction accuracy > 95%
  - [ ] No crashes on real MSP logs

- [ ] **Performance**
  - [ ] Console load time < 3s (P99)
  - [ ] API response time < 200ms (P99)
  - [ ] Redaction latency < 2s for 50MB log
  - [ ] Database query time < 100ms (P99)

- [ ] **Security**
  - [ ] All secrets in environment variables (no hardcoded)
  - [ ] HTTPS enforced (no HTTP)
  - [ ] CORS configured correctly
  - [ ] Rate limiting active
  - [ ] API key rotation tested
  - [ ] Database encrypted at rest

- [ ] **Compliance**
  - [ ] Privacy policy published
  - [ ] Terms of service published
  - [ ] GDPR data deletion API tested
  - [ ] SOC2 audit checklist completed

#### 6.3 MSP Closed Test Plan
- [ ] **5-7 Day Pilot**
  - MSP runs extension with 3-5 sample users
  - Process 100-500 real MSP logs (Datto, ConnectWise, SentinelOne, etc.)
  - Admin reviews audit logs, policies
  - Feedback collection: usability, false positives, performance

- [ ] **Success Criteria**
  - [ ] No crashes during pilot
  - [ ] Rule accuracy 95%+ (false positives acceptable < 5%)
  - [ ] Admin console usable by non-technical staff
  - [ ] Rules cover 90%+ of MSP entity types (tickets, credentials, etc.)
  - [ ] Feedback: NPS score > 7/10 or clear action items

- [ ] **Feedback Loops**
  - Daily standups with MSP test lead
  - Slack channel for bug reports
  - Weekly retrospective

#### 6.4 Go/No-Go Decision Criteria

**Go to Production IF:**
- All Phase 1-5 deliverables complete
- UAT feedback positive (NPS 7+, no blockers)
- Security audit clean (no critical issues)
- Performance benchmarks met
- Documentation complete & reviewed

**No-Go IF:**
- Redaction accuracy < 90%
- Critical security vuln found
- Crashes or data loss in UAT
- Rules don't cover top 5 MSP entity types

**Conditional Go IF:**
- Minor issues (UI polish, non-critical features) → fix within 2 weeks post-launch
- Known DOM fragility → accept risk, commit to monthly checks

**Deliverables:**
- Closed UAT completed with feedback summary
- Go/no-go decision documented
- Incident response playbook ready
- Customer support workflow defined

**Success Metrics:**
- MSP confirms readiness to launch
- All pre-flight checks pass
- Risk register reviewed

---

## 📊 Cross-Phase Dependencies

```
Phase 1:  Admin Console
           ↓
Phase 2:  OTA + Policy Enforcement  ←── depends on Phase 1 API
           ↓
Phase 3:  Multi-tenant              ←── depends on Phase 1-2 foundation
           ↓
Phase 4:  QA & Testing              ←── can run in parallel with Phase 3 late stage
           ↓
Phase 5:  Deployment & Monitoring   ←── can start after Phase 1
           ↓
Phase 6:  MSP Launch                ←── only after 1-5 complete + UAT pass
```

**Parallel Work:**
- Phase 5 (Infrastructure) can start immediately, independent of Phase 2-3
- Phase 4 (QA setup) can start after Phase 1, building test automation as phases complete

---

## 👥 Team Structure & Hiring

### Recommended Team by Role

**Permanent Roles (Week 1):**
1. **Backend Lead** (Sr. Full Stack or Backend) – Architecture, policy engine, API design
2. **Full Stack Engineer** (Mid-level) – Admin console, frontend + backend
3. **Extension Engineer** (Mid-level) – Redactor.js, content script, device enrollment
4. **QA Lead** (Sr. QA) – Test strategy, automation framework
5. **DevOps/SRE** (Mid-level) – Infrastructure, CI/CD, monitoring
6. **Product Manager** (PM) – Roadmap, stakeholder alignment, feature prioritization

**Wave 2 Hires (Week 4):**
- 1 Junior Backend Engineer
- 1 Junior QA Engineer
- 1 Frontend Engineer (dedicated to console UI)

**Contract Resources (Ongoing):**
- Security auditor (4-8 weeks, PHASE 4)
- Technical writer (4 weeks, PHASE 5)
- UX/Design consultant (2 weeks, PHASE 1-2 polish)

### Org Chart

```
Product Manager (1)
├── Backend Lead (1)
│   ├── Sr. BE Engineer (you/lead)
│   └── Jr. BE Engineer (hired week 4)
├── Extension Engineer (1)
│   ├── Supporting backend
│   └── Cross-functional with design
├── Frontend/Console Engineer (1) [hired week 4]
├── QA Lead (1)
│   ├── QA Engineer (1)
│   └── Jr. QA (hired week 4)
└── DevOps/SRE (1)

Total Core Team: 7-8 FTE
Contract: Security + Writer: 1-2 FTE (part-time, phased)
```

---

## 💾 Database Schema (High-Level)

```sql
-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'starter',  -- starter, professional, enterprise
  created_at TIMESTAMP DEFAULT NOW(),
  admin_user_id UUID REFERENCES users(id)
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  org_id UUID REFERENCES organizations(id),
  role VARCHAR(50) DEFAULT 'member',  -- admin, policy_editor, auditor, member
  created_at TIMESTAMP DEFAULT NOW()
);

-- Devices (enrolled extension instances)
CREATE TABLE devices (
  id UUID PRIMARY KEY,
  device_id_hash VARCHAR(255),  -- hash of device fingerprint
  user_id UUID REFERENCES users(id),
  org_id UUID REFERENCES organizations(id),
  extension_version VARCHAR(20),
  platform VARCHAR(50),  -- chatgpt, claude, gemini
  last_seen TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Policy Bundles (org-level policies)
CREATE TABLE policies (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  version VARCHAR(50),  -- e.g., 1.2.0
  rules_active JSONB,  -- {rule_ids: [rule1, rule2, ...]}
  intent_rules JSONB,  -- {log_analysis: 'redact', ...}
  actions JSONB,  -- {default: 'warn', by_category: {...}}
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(org_id, version)
);

-- Audit Events (metadata-only logging)
CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  device_id UUID REFERENCES devices(id),
  event_summary JSONB,  -- {action: 'redact', categories: [...], count: N}
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX(org_id, created_at)
);

-- Rule Master (future: versioned rule updates)
CREATE TABLE rules (
  id VARCHAR(50) PRIMARY KEY,
  version VARCHAR(50),
  label VARCHAR(255),
  category VARCHAR(50),
  pattern VARCHAR(1000),
  risk VARCHAR(20),
  created_at TIMESTAMP
);
```

---

## 🚀 Success Criteria by Phase

| Phase | Success Metric | Owner | Target |
|-------|-----------------|-------|--------|
| 1 | Admin console live, 5+ test orgs created, policy sync working | PM | Week 4 |
| 2 | OTA sync in place, 10+ concurrent rule updates, no failures | Backend | Week 8 |
| 3 | Multi-tenant access control tested, team policies override correctly | Backend | Week 12 |
| 4 | 100+ automated tests, 95%+ pass rate, UAT complete | QA Lead | Week 16 |
| 5 | Infrastructure live, 99.9% uptime, all docs published | DevOps | Week 20 |
| 6 | MSP UAT complete, go/no-go decision made | PM | Week 24 |

---

## 🔴 Key Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|-----------|
| DOM selectors break on platform updates | Extension stops working | High | Monthly regression tests, fast response team |
| Policy API becomes bottleneck at scale | Latency > 5s for 100K+ users | Medium | Redis caching, CDN for policy JSON, load testing |
| Regex DoS vulnerability in rules | Security issue, denial of service | Medium | Code review, fuzz testing, rule execution timeouts |
| Team turnover | Project delays | Medium | Good documentation, knowledge transfer playbooks |
| MSP demands integrations (ServiceNow, Jira, etc.) | Scope creep | High | Clearly define Phase 1 scope, defer integrations post-launch |
| Encrypted audit logs slow down queries | Performance impact | Low | Test early, optimize indexes, consider async processing |

---

## 📝 How to Use This Roadmap

1. **Weekly Sync:** Review this doc each Monday; update progress, blockers, timeline
2. **New Agent/Model Handoff:** Copy this doc to new context; agent can jump in without ramp-up
3. **Stakeholder Updates:** Extract Phase 1-2 for MSP owner review each sprint
4. **Code Check-ins:** Link PRs to specific roadmap items (e.g., "Implements PHASE 2.1 rule delivery")
5. **Risk Reviews:** Monthly risk register update (add, remove, re-prioritize risks)

---

## 📎 Appendices

### A. File Inventory (Current)
```
background.js              -- Service worker, policy + audit storage
content.js                 -- Page injection, redaction UI, sending
popup.js/html              -- Extension settings + rules UI
engine/
  ├── redactor.js          -- Core redaction engine + intent classifier
  ├── rules.json           -- 40+ bundled redaction rules
  ├── ner-worker.js        -- NER model (disabled in v1.2.0)
  └── transformers.min.js  -- ML library (unused, can remove)
manifest.json              -- Extension config (MV3)
sidebar.css                -- Redaction sidebar styling
icons/                     -- Extension icons
README.md                  -- Current documentation
```

### B. Glossary
- **OTA:** Over-the-air (device auto-receives updates without user action)
- **Policy Bundle:** JSON object defining which rules to apply + how (redact/warn/block)
- **Intent Classification:** Logic to identify what user is doing (e.g., "log analysis" vs "documentation")
- **Audit Event:** Metadata-safe record of a redaction (no actual prompts stored)
- **Device Enrollment:** Linking an extension instance to an organization + user
- **DOM Selector:** CSS/JS query to find AI chat input on webpage (fragile)

### C. References
- [Chrome Extension MV3 Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [Next.js Documentation](https://nextjs.org/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Playwright Testing Docs](https://playwright.dev/)
- [Swagger/OpenAPI Spec](https://swagger.io/specification/)

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-19  
**Next Review:** 2026-03-26 (weekly)  
**Maintained By:** [Your Name]
