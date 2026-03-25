const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

const { createChromeStub, loadScript } = require('./helpers/load-script-context');
const { createServer } = require('../control-plane/src/server');

function createPolicyBundle() {
  return {
    schema_version: '1.0.0',
    policy_version: '2026.03.18-local',
    org_id: 'org_acme_msp',
    org_name: 'Acme Managed Services',
    team_id: 'helpdesk',
    team_name: 'Helpdesk',
    app_scopes: ['chatgpt.com'],
    rules: {
      active_rule_ids: null,
      bundle_version: '1.2.0-local',
      local_bundle_version: '1.2.0-local',
      total_rules: 44,
      remote_updates_enabled: false,
      stage2_ner_enabled: false,
      fallback_mode: 'bundled_only',
    },
    intent_rules: {
      log_analysis: 'redact',
      ticket_summary: 'warn',
      incident_response: 'redact',
      scripting: 'warn',
      client_comms: 'justify',
      documentation: 'warn',
      reporting: 'redact',
      research: 'allow',
      other: 'warn',
    },
    actions: {
      default: 'warn',
      by_category: {
        Credential: 'justify',
        PII: 'redact',
        Financial: 'block',
        Network: 'warn',
        MSP: 'warn',
      },
    },
    justification_required: ['Credential', 'client_comms'],
    strict_mode: false,
  };
}

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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanprompt-runtime-contracts-'));
  return {
    CLEANPROMPT_CONTROL_PLANE_DATA_DIR: dataDir,
    CLEANPROMPT_CONTROL_PLANE_DATA_FILE: path.join(dataDir, 'state.json'),
    CLEANPROMPT_CONTROL_PLANE_PORT: '8792',
  };
}

test('background policy normalization upgrades legacy bundle fields', () => {
  const chrome = createChromeStub();
  const background = loadScript('background.js', { chrome });

  const legacyPolicy = {
    policy_version: '2026.03.18-local',
    org_id: 'org_acme_msp',
    org_name: 'Acme Managed Services',
    rules: {
      active_rule_ids: null,
      local_bundle_version: '1.2.0-local',
    },
    intent_rules: {
      other: 'warn',
    },
    actions: {
      default: 'warn',
      by_category: {},
    },
    justification_required: [],
    strict_mode: false,
  };

  const normalized = background.ensurePolicyBundleShape(legacyPolicy);
  assert.equal(normalized.schema_version, '1.0.0');
  assert.equal(normalized.rules.bundle_version, '1.2.0-local');
  assert.equal(normalized.rules.local_bundle_version, '1.2.0-local');

  const patch = background.buildSettingsUpgradePatch({
    logclean_policy_bundle: legacyPolicy,
  });
  assert.ok(patch.logclean_device_id);
  assert.equal(patch.logclean_policy_bundle.schema_version, '1.0.0');
  assert.equal(patch.logclean_policy_bundle.rules.bundle_version, '1.2.0-local');
});

test('background sync stores normalized policy from control plane payload', async () => {
  const chrome = createChromeStub();
  chrome.storage.local.set({
    logclean_policy_sync_enabled: true,
    logclean_control_plane_base_url: 'http://127.0.0.1:8787',
    logclean_enrollment_token: 'enroll-demo-token',
  });

  const fetchCalls = [];
  const background = loadScript('background.js', {
    chrome,
    navigator: {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
    },
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url.endsWith('/api/device-enrollment')) {
        return {
          ok: true,
          async json() {
            return {
              schema_version: '1.0.0',
              device_id: 'device-enrolled-123',
              org_id: 'org_acme_msp',
              policy_version: '2026.03.25-remote',
              rules_version: '1.3.0-remote',
            };
          },
        };
      }

      return {
        ok: true,
        async json() {
          return {
            ok: true,
            policy: {
              policy_version: '2026.03.25-remote',
              org_id: 'org_acme_msp',
              org_name: 'Acme Managed Services',
              team_id: 'helpdesk',
              team_name: 'Helpdesk',
              rules: {
                active_rule_ids: null,
                local_bundle_version: '1.3.0-remote',
              },
              intent_rules: { other: 'warn' },
              actions: { default: 'warn', by_category: {} },
              justification_required: [],
              strict_mode: false,
            },
          };
        },
      };
    },
  });

  const result = await background.syncPolicyBundleFromControlPlane();
  assert.equal(result.ok, true);
  const storedPolicy = chrome.storage.local._state.logclean_policy_bundle;
  assert.equal(storedPolicy.schema_version, '1.0.0');
  assert.equal(storedPolicy.policy_version, '2026.03.25-remote');
  assert.equal(storedPolicy.rules.bundle_version, '1.3.0-remote');
  assert.equal(chrome.storage.local._state.logclean_device_enrollment.device_id, 'device-enrolled-123');
  assert.equal(chrome.storage.local._state.logclean_last_enrollment_result.status, 'ok');
  assert.equal(chrome.storage.local._state.logclean_last_sync_result.status, 'ok');
  assert.equal(fetchCalls.length, 2);
  assert.match(fetchCalls[0].url, /\/api\/device-enrollment$/);
  assert.match(fetchCalls[1].url, /\/api\/policies\/default$/);
});

test('background can enroll explicitly and persists enrollment metadata', async () => {
  const chrome = createChromeStub();
  chrome.storage.local.set({
    logclean_control_plane_base_url: 'http://127.0.0.1:8787',
    logclean_enrollment_token: 'enroll-demo-token',
  });

  const background = loadScript('background.js', {
    chrome,
    navigator: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
    },
    fetch: async (url, options = {}) => {
      assert.match(url, /\/api\/device-enrollment$/);
      const payload = JSON.parse(options.body);
      assert.equal(payload.schema_version, '1.0.0');
      assert.equal(payload.browser_family, 'chrome');
      assert.equal(payload.os_family, 'macos');
      return {
        ok: true,
        async json() {
          return {
            schema_version: '1.0.0',
            device_id: 'device-explicit-456',
            org_id: 'org_acme_msp',
            policy_version: '2026.03.22-dev',
            rules_version: '1.2.0-local',
          };
        },
      };
    },
  });

  const result = await background.enrollDeviceWithControlPlane();
  assert.equal(result.ok, true);
  assert.equal(result.enrollment.device_id, 'device-explicit-456');
  assert.equal(chrome.storage.local._state.logclean_device_id, 'device-explicit-456');
  assert.equal(chrome.storage.local._state.logclean_last_enrollment_result.status, 'ok');
});

test('background resetExtensionDemoState clears local demo state but preserves connection settings', async () => {
  const chrome = createChromeStub();
  chrome.storage.local.set({
    logclean_policy_sync_enabled: true,
    logclean_control_plane_base_url: 'http://127.0.0.1:9797',
    logclean_enrollment_token: 'custom-demo-token',
    logclean_device_enrollment: {
      device_id: 'device-old-123',
      enrolled_at: '2026-03-21T10:15:00.000Z',
    },
    logclean_last_enrollment_result: {
      status: 'ok',
      ts: '2026-03-21T10:15:00.000Z',
    },
    logclean_last_sync_result: {
      status: 'ok',
      ts: '2026-03-21T10:16:00.000Z',
    },
    logclean_last_audit_upload_result: {
      status: 'ok',
      ts: '2026-03-21T10:17:00.000Z',
    },
    logclean_audit_log: [{ action: 'redact' }],
    logclean_device_events: [{ action: 'redact' }],
    logclean_training_signals: [{ type: 'justification' }],
    logclean_active_rules: ['GENERIC_SECRET'],
    logclean_rules_override: [{ id: 'GENERIC_SECRET' }],
  });

  const background = loadScript('background.js', { chrome });
  const result = await background.resetExtensionDemoState({
    preserveManagedConfig: true,
    enableManagedSync: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.sync_enabled, false);
  assert.equal(chrome.storage.local._state.logclean_control_plane_base_url, 'http://127.0.0.1:9797');
  assert.equal(chrome.storage.local._state.logclean_enrollment_token, 'custom-demo-token');
  assert.equal(chrome.storage.local._state.logclean_policy_sync_enabled, false);
  assert.equal(chrome.storage.local._state.logclean_device_enrollment, null);
  assert.equal(chrome.storage.local._state.logclean_last_enrollment_result, null);
  assert.equal(chrome.storage.local._state.logclean_last_sync_result, null);
  assert.equal(chrome.storage.local._state.logclean_last_audit_upload_result, null);
  assert.deepEqual(Array.from(chrome.storage.local._state.logclean_audit_log), []);
  assert.deepEqual(Array.from(chrome.storage.local._state.logclean_device_events), []);
  assert.deepEqual(Array.from(chrome.storage.local._state.logclean_training_signals), []);
  assert.equal(chrome.storage.local._state.logclean_active_rules, null);
  assert.equal(chrome.storage.local._state.logclean_rules_override, null);
});

test('background prepareManagedDemoState resets locally, enrolls, and syncs policy', async () => {
  const chrome = createChromeStub();
  chrome.storage.local.set({
    logclean_policy_sync_enabled: false,
    logclean_control_plane_base_url: 'http://127.0.0.1:8787',
    logclean_enrollment_token: 'enroll-demo-token',
    logclean_audit_log: [{ action: 'warn' }],
    logclean_device_events: [{ action: 'warn' }],
  });

  const fetchCalls = [];
  const background = loadScript('background.js', {
    chrome,
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
    },
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url.endsWith('/api/device-enrollment')) {
        return {
          ok: true,
          async json() {
            return {
              schema_version: '1.0.0',
              device_id: 'device-demo-789',
              org_id: 'org_acme_msp',
              policy_version: '2026.03.30-demo-seeded',
              rules_version: '1.3.0-demo',
            };
          },
        };
      }

      return {
        ok: true,
        async json() {
          return {
            ok: true,
            policy: {
              policy_version: '2026.03.30-demo-seeded',
              org_id: 'org_acme_msp',
              org_name: 'Acme Managed Services',
              team_id: 'helpdesk',
              team_name: 'Helpdesk',
              rules: {
                active_rule_ids: null,
                local_bundle_version: '1.3.0-demo',
              },
              intent_rules: { other: 'warn' },
              actions: { default: 'warn', by_category: {} },
              justification_required: [],
              strict_mode: false,
            },
          };
        },
      };
    },
  });

  const result = await background.prepareManagedDemoState();
  assert.equal(result.ok, true);
  assert.equal(result.step, 'ready');
  assert.equal(result.device_id, 'device-demo-789');
  assert.equal(result.policy_version, '2026.03.30-demo-seeded');
  assert.equal(chrome.storage.local._state.logclean_policy_sync_enabled, true);
  assert.equal(chrome.storage.local._state.logclean_device_enrollment.device_id, 'device-demo-789');
  assert.equal(chrome.storage.local._state.logclean_last_enrollment_result.status, 'ok');
  assert.equal(chrome.storage.local._state.logclean_last_sync_result.status, 'ok');
  assert.deepEqual(Array.from(chrome.storage.local._state.logclean_audit_log), []);
  assert.deepEqual(Array.from(chrome.storage.local._state.logclean_device_events), []);
  assert.equal(fetchCalls.length, 2);
  assert.match(fetchCalls[0].url, /\/api\/device-enrollment$/);
  assert.match(fetchCalls[1].url, /\/api\/policies\/default$/);
});

test('background stores normalized platform health reports by host', async () => {
  const chrome = createChromeStub();
  const background = loadScript('background.js', { chrome });

  const report = await background.updatePlatformHealthReport({
    host: 'chatgpt.com',
    platform_key: 'chatgpt',
    platform_name: 'ChatGPT',
    input_detected: true,
    toolbar_detected: true,
    send_button_detected: false,
    trigger_attached: true,
    sidebar_ready: true,
    detection_reason: 'trigger_attached',
    input_selector: '#prompt-textarea',
    input_selector_rank: 1,
    toolbar_strategy: 'closest(form)',
    send_selector: 'button[data-testid="send-button"]',
    send_selector_rank: 1,
    attachment_container_tag: 'form',
    compatibility_confidence: 'primary_path',
    ts: '2026-03-22T10:30:00.000Z',
  });

  assert.equal(report.host, 'chatgpt.com');
  assert.equal(report.platform_key, 'chatgpt');
  assert.equal(report.input_detected, true);
  assert.equal(report.send_button_detected, false);
  assert.equal(report.input_selector, '#prompt-textarea');
  assert.equal(report.toolbar_strategy, 'closest(form)');
  assert.equal(report.compatibility_confidence, 'primary_path');
  assert.equal(chrome.storage.local._state.logclean_platform_health['chatgpt.com'].trigger_attached, true);
  assert.equal(chrome.storage.local._state.logclean_platform_health['chatgpt.com'].detection_reason, 'trigger_attached');
});

test('background uploads metadata-safe audit events to control plane in managed mode', async () => {
  const chrome = createChromeStub();
  chrome.storage.local.set({
    logclean_policy_sync_enabled: true,
    logclean_control_plane_base_url: 'http://127.0.0.1:8787',
    logclean_device_enrollment: {
      device_id: 'device-enrolled-123',
      enrolled_at: '2026-03-22T10:15:00.000Z',
    },
    logclean_policy_bundle: createPolicyBundle(),
  });

  const fetchCalls = [];
  const background = loadScript('background.js', {
    chrome,
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        async json() {
          return { ok: true, accepted: true };
        },
      };
    },
  });

  const result = await background.uploadAuditEventToControlPlane({
    schema_version: '1.0.0',
    org_id: 'org_acme_msp',
    team_id: 'helpdesk',
    device_id: 'device-enrolled-123',
    extension_version: '1.2.0-test',
    policy_version: '2026.03.18-local',
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

  assert.equal(result.ok, true);
  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0].url, /\/api\/audit\/events$/);
  const payload = JSON.parse(fetchCalls[0].options.body);
  assert.equal(payload.raw_text_absent, true);
  assert.equal(payload.device_id, 'device-enrolled-123');
  assert.equal(chrome.storage.local._state.logclean_last_audit_upload_result.status, 'ok');
});

test('extension/control-plane contract strips prohibited raw fields before upload', async () => {
  const instance = createServer(createTempConfig());
  const app = instance.server.listeners('request')[0];
  const chrome = createChromeStub();
  chrome.storage.local.set({
    logclean_policy_sync_enabled: true,
    logclean_control_plane_base_url: 'http://127.0.0.1:8792',
    logclean_device_enrollment: {
      device_id: 'device-contract-123',
      enrolled_at: '2026-03-22T10:15:00.000Z',
    },
    logclean_policy_bundle: createPolicyBundle(),
  });

  let capturedPayload = null;
  const background = loadScript('background.js', {
    chrome,
    fetch: async (url, options = {}) => {
      capturedPayload = JSON.parse(options.body);
      const result = await dispatch(app, options.method || 'POST', new URL(url).pathname, capturedPayload);
      return {
        ok: result.statusCode >= 200 && result.statusCode < 300,
        status: result.statusCode,
        async json() {
          return result.json;
        },
      };
    },
  });

  const result = await background.uploadAuditEventToControlPlane({
    schema_version: '1.0.0',
    org_id: 'org_acme_msp',
    team_id: 'helpdesk',
    device_id: 'device-contract-123',
    extension_version: '1.2.0-test',
    policy_version: '2026.03.18-local',
    rules_version: '1.2.0-local',
    site: 'chatgpt.com',
    action: 'justify',
    intent_label: 'client_comms',
    intent_confidence_bucket: 'medium',
    sensitivity_categories: ['Credential'],
    rule_ids: ['GENERIC_SECRET'],
    count_summary: { total: 1, by_category: { Credential: 1 }, by_risk: { high: 1 } },
    prompt_size_bucket: 'medium',
    timestamp_bucket: new Date().toISOString(),
    raw_text_absent: true,
    raw_prompt_text: 'super secret client prompt',
    sanitized_prompt: 'redacted prompt',
    reveal_map: { '[GENERIC_SECRET_1]': 'supersecret123' },
    justification_text: 'contains copied sensitive prompt content',
    full_url: 'https://chatgpt.com/?token=secret',
  });

  assert.equal(result.ok, true);
  assert.ok(capturedPayload);
  assert.equal(capturedPayload.raw_text_absent, true);
  assert.equal(capturedPayload.device_id, 'device-contract-123');
  assert.equal(Object.prototype.hasOwnProperty.call(capturedPayload, 'raw_prompt_text'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(capturedPayload, 'sanitized_prompt'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(capturedPayload, 'reveal_map'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(capturedPayload, 'justification_text'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(capturedPayload, 'full_url'), false);
  assert.equal(instance.state.auditEvents.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(instance.state.auditEvents[0].event, 'raw_prompt_text'), false);
});

test('background skips control-plane upload when strict mode is enabled', async () => {
  const chrome = createChromeStub();
  const strictPolicy = createPolicyBundle();
  strictPolicy.strict_mode = true;

  chrome.storage.local.set({
    logclean_policy_sync_enabled: true,
    logclean_control_plane_base_url: 'http://127.0.0.1:8787',
    logclean_device_enrollment: {
      device_id: 'device-enrolled-123',
      enrolled_at: '2026-03-22T10:15:00.000Z',
    },
    logclean_policy_bundle: strictPolicy,
  });

  let fetchCalled = false;
  const background = loadScript('background.js', {
    chrome,
    fetch: async () => {
      fetchCalled = true;
      throw new Error('should_not_fetch');
    },
  });

  const result = await background.uploadAuditEventToControlPlane({
    device_id: 'device-enrolled-123',
    site: 'chatgpt.com',
    action: 'redact',
    intent_label: 'log_analysis',
    intent_confidence_bucket: 'medium',
    sensitivity_categories: [],
    rule_ids: [],
    count_summary: { total: 0, by_category: {}, by_risk: {} },
    prompt_size_bucket: 'small',
    timestamp_bucket: new Date().toISOString(),
    raw_text_absent: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'strict_mode');
  assert.equal(fetchCalled, false);
  assert.equal(chrome.storage.local._state.logclean_last_audit_upload_result.status, 'strict_mode');
});

test('redactor builds schema-aligned audit metadata for credential findings', async () => {
  const redactor = loadScript('engine/redactor.js', {
    chrome: { runtime: { getURL(resource) { return resource; } } },
  });
  const policyBundle = createPolicyBundle();

  const result = await redactor.logcleanRedact(
    'Please help with this incident. Contact alice@example.com and token=supersecret123',
    null,
    {
      policyBundle,
      org_id: 'org_acme_msp',
      org_name: 'Acme Managed Services',
      team_id: 'helpdesk',
      team_name: 'Helpdesk',
      site: 'chatgpt.com',
      device_id: 'device-123',
      extension_version: '1.2.0-test',
      policy_version: policyBundle.policy_version,
      rules_version: policyBundle.rules.bundle_version,
      rotating_actor_id: 'actor-2026-03',
      strict_mode: false,
    }
  );

  assert.match(result.sanitized, /\[EMAIL_1\]/);
  assert.match(result.sanitized, /\[GENERIC_SECRET_1\]/);
  assert.equal(result.policy_action, 'justify');
  assert.equal(result.event_summary.schema_version, '1.0.0');
  assert.equal(result.event_summary.device_id, 'device-123');
  assert.equal(result.event_summary.extension_version, '1.2.0-test');
  assert.equal(result.event_summary.policy_version, '2026.03.18-local');
  assert.equal(result.event_summary.rules_version, '1.2.0-local');
  assert.equal(result.event_summary.raw_text_absent, true);
  assert.equal(result.event_summary.justification_required, true);
  assert.ok(result.event_summary.rule_ids.includes('EMAIL'));
  assert.ok(result.event_summary.rule_ids.includes('GENERIC_SECRET'));
});

test('policy resolution escalates financial findings to block', async () => {
  const redactor = loadScript('engine/redactor.js', {
    chrome: { runtime: { getURL(resource) { return resource; } } },
  });
  const policyBundle = createPolicyBundle();

  const result = await redactor.logcleanRedact(
    'Can you summarize this payment issue for card 4111111111111111?',
    null,
    {
      policyBundle,
      org_id: 'org_acme_msp',
      org_name: 'Acme Managed Services',
      team_id: 'helpdesk',
      team_name: 'Helpdesk',
      site: 'chatgpt.com',
      device_id: 'device-456',
      extension_version: '1.2.0-test',
      policy_version: policyBundle.policy_version,
      rules_version: policyBundle.rules.bundle_version,
    }
  );

  assert.equal(result.policy_action, 'block');
  assert.ok(result.event_summary.sensitivity_categories.includes('Financial'));
  assert.equal(result.event_summary.raw_text_absent, true);
});
