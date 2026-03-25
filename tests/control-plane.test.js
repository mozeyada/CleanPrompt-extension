const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const test = require('node:test');
const assert = require('node:assert/strict');

const { createServer } = require('../control-plane/src/server');

function createResponseCapture() {
  return {
    statusCode: null,
    headers: null,
    body: '',
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk) {
      if (chunk) this.body += chunk;
    },
  };
}

async function dispatch(app, method, url, body) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost' };
  const res = createResponseCapture();
  const promise = app(req, res);
  if (body !== undefined) {
    req.emit('data', JSON.stringify(body));
  }
  req.emit('end');
  await promise;
  const contentType = res.headers && res.headers['content-type'] || '';
  return {
    statusCode: res.statusCode,
    headers: res.headers,
    body: res.body,
    json: contentType.includes('application/json') ? JSON.parse(res.body) : null,
  };
}

function createTempConfig() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanprompt-control-plane-'));
  return {
    CLEANPROMPT_CONTROL_PLANE_DATA_DIR: dataDir,
    CLEANPROMPT_CONTROL_PLANE_DATA_FILE: path.join(dataDir, 'state.json'),
    CLEANPROMPT_CONTROL_PLANE_PORT: '8791',
  };
}

test('control plane rejects invalid audit event payloads', async () => {
  const instance = createServer(createTempConfig());
  const result = await dispatch(instance.server.listeners('request')[0], 'POST', '/api/audit/events', {
    schema_version: '1.0.0',
    org_id: 'org_acme_msp',
    device_id: 'device-123',
    extension_version: '1.2.0-test',
    site: 'chatgpt.com',
    action: 'redact',
    intent_label: 'log_analysis',
    intent_confidence_bucket: 'medium',
    sensitivity_categories: [],
    rule_ids: [],
    count_summary: { total: 1, by_category: {}, by_risk: {} },
    prompt_size_bucket: 'medium',
    timestamp_bucket: new Date().toISOString(),
    raw_text_absent: false,
  });

  assert.equal(result.statusCode, 400);
  assert.equal(result.json.error, 'raw_text_absent_must_be_true');
});

test('control plane rejects prohibited raw-content fields in audit payloads', async () => {
  const instance = createServer(createTempConfig());
  const result = await dispatch(instance.server.listeners('request')[0], 'POST', '/api/audit/events', {
    schema_version: '1.0.0',
    org_id: 'org_acme_msp',
    device_id: 'device-123',
    extension_version: '1.2.0-test',
    site: 'chatgpt.com',
    action: 'redact',
    intent_label: 'log_analysis',
    intent_confidence_bucket: 'medium',
    sensitivity_categories: [],
    rule_ids: [],
    count_summary: { total: 1, by_category: {}, by_risk: {} },
    prompt_size_bucket: 'medium',
    timestamp_bucket: new Date().toISOString(),
    raw_text_absent: true,
    raw_prompt_text: 'super secret prompt',
  });

  assert.equal(result.statusCode, 400);
  assert.equal(result.json.error, 'prohibited_field_raw_prompt_text');
});

test('control plane persists accepted audit events and device enrollments', async () => {
  const config = createTempConfig();
  const instance = createServer(config);
  const app = instance.server.listeners('request')[0];

  const enrollment = await dispatch(app, 'POST', '/api/device-enrollment', {
    schema_version: '1.0.0',
    enrollment_token: 'enroll-demo-token',
    extension_version: '1.2.0-test',
    browser_family: 'chrome',
    os_family: 'linux',
    managed_device: true,
  });

  assert.equal(enrollment.statusCode, 201);
  assert.equal(enrollment.json.org_id, 'org_acme_msp');

  const audit = await dispatch(app, 'POST', '/api/audit/events', {
    schema_version: '1.0.0',
    org_id: 'org_acme_msp',
    device_id: enrollment.json.device_id,
    extension_version: '1.2.0-test',
    policy_version: '2026.03.22-dev',
    rules_version: '1.2.0-local',
    site: 'chatgpt.com',
    action: 'redact',
    intent_label: 'log_analysis',
    intent_confidence_bucket: 'medium',
    sensitivity_categories: ['Credential'],
    rule_ids: ['GENERIC_SECRET'],
    count_summary: { total: 1, by_category: { Credential: 1 }, by_risk: { high: 1 } },
    prompt_size_bucket: 'medium',
    timestamp_bucket: new Date().toISOString(),
    raw_text_absent: true,
  });

  assert.equal(audit.statusCode, 202);
  assert.equal(audit.json.accepted, true);

  const persisted = JSON.parse(fs.readFileSync(config.CLEANPROMPT_CONTROL_PLANE_DATA_FILE, 'utf8'));
  assert.equal(persisted.devices.length, 1);
  assert.equal(persisted.auditEvents.length, 1);
  assert.equal(persisted.auditEvents[0].event.raw_text_absent, true);
});

test('control plane exposes metadata-only owner summary and device registry', async () => {
  const instance = createServer(createTempConfig());
  const app = instance.server.listeners('request')[0];

  const enrollment = await dispatch(app, 'POST', '/api/device-enrollment', {
    schema_version: '1.0.0',
    enrollment_token: 'enroll-demo-token',
    extension_version: '1.2.0-test',
    browser_family: 'chrome',
    os_family: 'windows',
    managed_device: true,
  });

  await dispatch(app, 'POST', '/api/audit/events', {
    schema_version: '1.0.0',
    org_id: 'org_acme_msp',
    device_id: enrollment.json.device_id,
    extension_version: '1.2.0-test',
    policy_version: '2026.03.22-dev',
    rules_version: '1.2.0-local',
    site: 'chatgpt.com',
    action: 'justify',
    intent_label: 'client_comms',
    intent_confidence_bucket: 'medium',
    sensitivity_categories: ['Credential', 'PII'],
    rule_ids: ['GENERIC_SECRET', 'EMAIL'],
    count_summary: { total: 2, by_category: { Credential: 1, PII: 1 }, by_risk: { high: 1, medium: 1 } },
    prompt_size_bucket: 'medium',
    timestamp_bucket: new Date().toISOString(),
    raw_text_absent: true,
  });

  const summary = await dispatch(app, 'GET', '/api/admin/summary');
  assert.equal(summary.statusCode, 200);
  assert.equal(summary.json.summary.device_count, 1);
  assert.equal(summary.json.summary.audit_event_count, 1);
  assert.equal(summary.json.summary.action_counts.justify, 1);
  assert.equal(summary.json.summary.category_counts.Credential, 1);
  assert.equal(summary.json.summary.category_counts.PII, 1);
  assert.equal(summary.json.summary.intent_counts.client_comms, 1);
  assert.equal(summary.json.summary.metadata_only, true);
  assert.equal(summary.json.summary.raw_prompt_retention, false);

  const devices = await dispatch(app, 'GET', '/api/admin/devices');
  assert.equal(devices.statusCode, 200);
  assert.equal(devices.json.devices.length, 1);
  assert.equal(devices.json.devices[0].device_id, enrollment.json.device_id);
});

test('control plane serves admin console assets', async () => {
  const instance = createServer(createTempConfig());
  const app = instance.server.listeners('request')[0];

  const adminPage = await dispatch(app, 'GET', '/admin');
  assert.equal(adminPage.statusCode, 200);
  assert.match(adminPage.headers['content-type'], /text\/html/);
  assert.match(adminPage.body, /CleanPrompt Control Plane/);

  const adminScript = await dispatch(app, 'GET', '/admin/app.js');
  assert.equal(adminScript.statusCode, 200);
  assert.match(adminScript.headers['content-type'], /application\/javascript/);
  assert.match(adminScript.body, /refreshDashboard/);
});

test('control plane publishes policy updates and records admin actions', async () => {
  const config = createTempConfig();
  const instance = createServer(config);
  const app = instance.server.listeners('request')[0];

  const currentPolicy = await dispatch(app, 'GET', '/api/policies/default');
  const nextPolicy = {
    ...currentPolicy.json.policy,
    policy_version: '2026.03.30-demo',
    strict_mode: true,
    actions: {
      ...currentPolicy.json.policy.actions,
      default: 'redact',
      by_category: {
        ...currentPolicy.json.policy.actions.by_category,
        Network: 'redact',
      },
    },
  };

  const publish = await dispatch(app, 'POST', '/api/admin/policies/default', {
    policy: nextPolicy,
  });

  assert.equal(publish.statusCode, 200);
  assert.equal(publish.json.policy_version, '2026.03.30-demo');

  const refreshed = await dispatch(app, 'GET', '/api/policies/default');
  assert.equal(refreshed.json.policy.policy_version, '2026.03.30-demo');
  assert.equal(refreshed.json.policy.strict_mode, true);
  assert.equal(refreshed.json.policy.actions.default, 'redact');

  const actions = await dispatch(app, 'GET', '/api/admin/actions');
  assert.equal(actions.statusCode, 200);
  assert.equal(actions.json.actions.length, 1);
  assert.equal(actions.json.actions[0].action_type, 'policy_publish');

  const persisted = JSON.parse(fs.readFileSync(config.CLEANPROMPT_CONTROL_PLANE_DATA_FILE, 'utf8'));
  assert.equal(persisted.adminActions.length, 1);
  assert.equal(persisted.policyBundle.policy_version, '2026.03.30-demo');
});

test('control plane can seed and reset demo state for repeatable demos', async () => {
  const config = createTempConfig();
  const instance = createServer(config);
  const app = instance.server.listeners('request')[0];

  const seeded = await dispatch(app, 'POST', '/api/demo/seed');
  assert.equal(seeded.statusCode, 200);
  assert.equal(seeded.json.mode, 'seed');
  assert.equal(seeded.json.summary.device_count, 3);
  assert.equal(seeded.json.summary.audit_event_count, 3);
  assert.equal(instance.state.devices.length, 3);
  assert.equal(instance.state.auditEvents.length, 3);
  assert.equal(instance.state.adminActions.length, 1);

  const summary = await dispatch(app, 'GET', '/api/admin/summary');
  assert.equal(summary.statusCode, 200);
  assert.equal(summary.json.summary.device_count, 3);
  assert.equal(summary.json.summary.audit_event_count, 3);

  const reset = await dispatch(app, 'POST', '/api/demo/reset');
  assert.equal(reset.statusCode, 200);
  assert.equal(reset.json.mode, 'reset');
  assert.equal(reset.json.summary.device_count, 0);
  assert.equal(reset.json.summary.audit_event_count, 0);
  assert.equal(instance.state.devices.length, 0);
  assert.equal(instance.state.auditEvents.length, 0);
  assert.equal(instance.state.adminActions.length, 0);

  const persisted = JSON.parse(fs.readFileSync(config.CLEANPROMPT_CONTROL_PLANE_DATA_FILE, 'utf8'));
  assert.equal(persisted.devices.length, 0);
  assert.equal(persisted.auditEvents.length, 0);
  assert.equal(persisted.adminActions.length, 0);
});
