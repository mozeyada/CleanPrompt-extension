const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const test = require('node:test');
const assert = require('node:assert/strict');

const { createServer } = require('../control-plane/src/server');
const {
  createChromeStub,
  dispatchRuntimeMessage,
  loadScript,
} = require('./helpers/load-script-context');
const { createContentSmokeEnv } = require('./helpers/content-smoke-env');

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
  req.headers = { host: '127.0.0.1:8793' };
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanprompt-managed-journey-'));
  return {
    CLEANPROMPT_CONTROL_PLANE_DATA_DIR: dataDir,
    CLEANPROMPT_CONTROL_PLANE_DATA_FILE: path.join(dataDir, 'state.json'),
    CLEANPROMPT_CONTROL_PLANE_PORT: '8793',
  };
}

function createFetchBridge(app) {
  return async function fetchBridge(url, options = {}) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : undefined;
    const result = await dispatch(app, method, new URL(url).pathname, body);
    return {
      ok: result.statusCode >= 200 && result.statusCode < 300,
      status: result.statusCode,
      async json() {
        return result.json;
      },
    };
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setPromptInputValue(input, value) {
  if (!input) return;
  if (String(input.tagName || '').toUpperCase() === 'TEXTAREA') {
    input.value = value;
    return;
  }
  input.innerText = value;
  input.textContent = value;
}

function createRuntimeBridge(chrome) {
  return function handleRuntimeMessage(message) {
    return dispatchRuntimeMessage(chrome, message, {
      tab: { id: 1, url: 'https://chatgpt.com/' },
    });
  };
}

function buildManagedResult(runtimeContext, scenario) {
  return {
    sanitized: scenario.sanitized,
    findings: scenario.findings,
    policy_action: scenario.policyAction,
    intent_label: scenario.intentLabel,
    employee_explanation: scenario.explanation,
    safe_compose_prompt: scenario.safeComposePrompt || 'safe compose prompt',
    tokens: scenario.tokens,
    event_summary: {
      schema_version: '1.0.0',
      org_id: runtimeContext.org_id,
      org_name: runtimeContext.org_name,
      team_id: runtimeContext.team_id,
      team_name: runtimeContext.team_name,
      device_id: runtimeContext.device_id,
      extension_version: runtimeContext.extension_version,
      policy_version: runtimeContext.policy_version,
      rules_version: runtimeContext.rules_version,
      site: runtimeContext.site,
      action: scenario.policyAction,
      intent_label: scenario.intentLabel,
      intent_confidence_bucket: scenario.intentConfidenceBucket || 'medium',
      sensitivity_categories: scenario.sensitivityCategories,
      rule_ids: scenario.ruleIds,
      count_summary: scenario.countSummary,
      prompt_size_bucket: scenario.promptSizeBucket || 'medium',
      rotating_actor_id: runtimeContext.rotating_actor_id,
      strict_mode: runtimeContext.strict_mode,
      raw_text_absent: true,
      justification_required: scenario.policyAction === 'justify',
      timestamp_bucket: scenario.timestampBucket || '2026-03-22T10:00:00.000Z',
    },
  };
}

function createManagedTestRuntime(options = {}) {
  const instance = createServer(createTempConfig());
  const app = instance.server.listeners('request')[0];
  const chrome = createChromeStub();
  const fetchImpl = options.fetch || createFetchBridge(app);
  const background = loadScript('background.js', {
    chrome,
    fetch: fetchImpl,
    navigator: {
      userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
    },
  });

  chrome.storage.local.set(background.createDefaultSettings());
  if (options.settingsPatch) {
    chrome.storage.local.set(options.settingsPatch);
  }

  return {
    instance,
    app,
    chrome,
    background,
  };
}

async function runManagedContentScenario(chrome, scenario) {
  const env = createContentSmokeEnv({
    hostname: scenario.hostname || 'chatgpt.com',
    fixture: scenario.fixture || 'chatgpt',
    chrome,
    handleRuntimeMessage: createRuntimeBridge(chrome),
    logcleanGetSummary() {
      return {
        total: scenario.countSummary.total,
        byCategory: scenario.countSummary.by_category,
        byRisk: scenario.countSummary.by_risk,
      };
    },
    async logcleanRedact(raw, enabledIds, runtimeContext) {
      return buildManagedResult(runtimeContext, scenario);
    },
  });

  const content = loadScript('content.js', env.additions);
  await wait(25);

  const hooks = content.__cleanpromptContentTest;
  setPromptInputValue(env.input, scenario.rawPrompt);
  hooks.attachSendInterceptor();
  const initialClickCount = env.sendButton.clickCount;
  env.sendButton.click();
  await wait(25);

  if (scenario.policyAction === 'justify') {
    env.document.getElementById('lc-intercept-justification').value = scenario.justification || 'Business justification';
    env.document.getElementById('lc-intercept-allow').click();
    await wait(80);
  } else if (scenario.policyAction === 'block') {
    env.document.getElementById('lc-intercept-block').click();
    await wait(50);
  } else if (scenario.policyAction === 'warn') {
    env.document.getElementById('lc-intercept-allow').click();
    await wait(80);
  } else {
    await wait(80);
  }

  return {
    env,
    hooks,
    initialClickCount,
    finalClickCount: env.sendButton.clickCount,
  };
}

test('managed browser journey flows from interception to owner summary without raw prompt upload', async () => {
  const instance = createServer(createTempConfig());
  const app = instance.server.listeners('request')[0];
  const chrome = createChromeStub();
  const fetchBridge = createFetchBridge(app);
  const background = loadScript('background.js', {
    chrome,
    fetch: fetchBridge,
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
    },
  });

  chrome.storage.local.set(background.createDefaultSettings());
  chrome.storage.local.set({
    logclean_policy_sync_enabled: true,
    logclean_control_plane_base_url: 'http://127.0.0.1:8793',
    logclean_enrollment_token: 'enroll-demo-token',
  });

  const prepared = await background.prepareManagedDemoState();
  assert.equal(prepared.ok, true);
  assert.equal(prepared.step, 'ready');
  assert.equal(instance.state.devices.length, 1);
  assert.equal(chrome.storage.local._state.logclean_last_sync_result.status, 'ok');

  const env = createContentSmokeEnv({
    hostname: 'chatgpt.com',
    fixture: 'chatgpt',
    chrome,
    handleRuntimeMessage(message) {
      return createRuntimeBridge(chrome)(message);
    },
    logcleanGetSummary() {
      return {
        total: 2,
        byCategory: { Credential: 1, PII: 1 },
        byRisk: { high: 1, medium: 1 },
      };
    },
    async logcleanRedact(raw, enabledIds, runtimeContext) {
      return {
        sanitized: 'Please draft a client-safe version for [EMAIL_1] and [GENERIC_SECRET_1].',
        findings: [
          { category: 'PII', count: 1, label: 'Email address', risk: 'medium' },
          { category: 'Credential', count: 1, label: 'API key', risk: 'high' },
        ],
        policy_action: 'justify',
        intent_label: 'client_comms',
        employee_explanation: 'A short justification is required before a one-time send.',
        safe_compose_prompt: 'safe compose prompt',
        tokens: {
          '[EMAIL_1]': 'alice@example.com',
          '[GENERIC_SECRET_1]': 'sk-live-secret',
        },
        event_summary: {
          schema_version: '1.0.0',
          org_id: runtimeContext.org_id,
          org_name: runtimeContext.org_name,
          team_id: runtimeContext.team_id,
          team_name: runtimeContext.team_name,
          device_id: runtimeContext.device_id,
          extension_version: runtimeContext.extension_version,
          policy_version: runtimeContext.policy_version,
          rules_version: runtimeContext.rules_version,
          site: runtimeContext.site,
          action: 'justify',
          intent_label: 'client_comms',
          intent_confidence_bucket: 'medium',
          sensitivity_categories: ['Credential', 'PII'],
          rule_ids: ['GENERIC_SECRET', 'EMAIL'],
          count_summary: {
            total: 2,
            by_category: { Credential: 1, PII: 1 },
            by_risk: { high: 1, medium: 1 },
          },
          prompt_size_bucket: raw.length > 40 ? 'medium' : 'small',
          rotating_actor_id: runtimeContext.rotating_actor_id,
          strict_mode: runtimeContext.strict_mode,
          raw_text_absent: true,
          justification_required: true,
          timestamp_bucket: '2026-03-22T10:00:00.000Z',
        },
      };
    },
  });

  const content = loadScript('content.js', env.additions);
  await wait(25);

  const hooks = content.__cleanpromptContentTest;
  setPromptInputValue(env.input, 'Send alice@example.com and sk-live-secret to the AI for a client email draft.');
  hooks.attachSendInterceptor();
  env.sendButton.click();
  await wait(25);

  assert.equal(hooks.getInterceptState().open, true);
  assert.equal(hooks.getInterceptState().pendingAction, 'justify');
  assert.equal(hooks.getInterceptState().justificationVisible, true);
  assert.equal(env.input.value, 'Please draft a client-safe version for [EMAIL_1] and [GENERIC_SECRET_1].');

  env.document.getElementById('lc-intercept-justification').value = 'One-time client communication review for an active ticket.';
  env.document.getElementById('lc-intercept-allow').click();
  await wait(80);

  assert.equal(hooks.getInterceptState().open, false);
  assert.ok(env.sendButton.clickCount >= 2);
  assert.equal(chrome.storage.local._state.logclean_audit_log.length, 1);
  assert.equal(chrome.storage.local._state.logclean_audit_log[0].action, 'justify');
  assert.equal(chrome.storage.local._state.logclean_device_events.length, 1);
  assert.equal(chrome.storage.local._state.logclean_device_events[0].raw_text_absent, true);
  assert.equal(chrome.storage.local._state.logclean_last_audit_upload_result.status, 'ok');
  assert.equal(chrome.storage.local._state.logclean_platform_health['chatgpt.com'].trigger_attached, true);

  assert.equal(instance.state.auditEvents.length, 1);
  assert.equal(instance.state.auditEvents[0].event.action, 'justify');
  assert.equal(instance.state.auditEvents[0].event.justification_provided, true);
  assert.equal(instance.state.auditEvents[0].event.device_id, prepared.device_id);
  assert.equal(instance.state.auditEvents[0].event.raw_text_absent, true);
  assert.equal(
    Object.prototype.hasOwnProperty.call(instance.state.auditEvents[0].event, 'raw_prompt_text'),
    false
  );

  const summary = await dispatch(app, 'GET', '/api/admin/summary');
  assert.equal(summary.statusCode, 200);
  assert.equal(summary.json.summary.device_count, 1);
  assert.equal(summary.json.summary.audit_event_count, 1);
  assert.equal(summary.json.summary.action_counts.justify, 1);
  assert.equal(summary.json.summary.category_counts.Credential, 1);
  assert.equal(summary.json.summary.category_counts.PII, 1);
  assert.equal(summary.json.summary.intent_counts.client_comms, 1);
  assert.equal(summary.json.summary.browser_counts.chrome, 1);
  assert.equal(summary.json.summary.raw_prompt_retention, false);
});

test('managed browser journey coverage spans supported hosts and action branches', async () => {
  const { instance, app, chrome, background } = createManagedTestRuntime({
    settingsPatch: {
      logclean_policy_sync_enabled: true,
      logclean_control_plane_base_url: 'http://127.0.0.1:8793',
      logclean_enrollment_token: 'enroll-demo-token',
    },
  });

  const prepared = await background.prepareManagedDemoState();
  assert.equal(prepared.ok, true);

  const scenarios = [
    {
      hostname: 'chatgpt.com',
      fixture: 'chatgpt',
      policyAction: 'justify',
      expectedAuditAction: 'justify',
      intentLabel: 'client_comms',
      explanation: 'A short justification is required before a one-time send.',
      rawPrompt: 'Draft a client email using alice@example.com and sk-live-secret.',
      sanitized: 'Draft a client email using [EMAIL_1] and [GENERIC_SECRET_1].',
      findings: [
        { category: 'PII', count: 1, label: 'Email address', risk: 'medium' },
        { category: 'Credential', count: 1, label: 'API key', risk: 'high' },
      ],
      sensitivityCategories: ['Credential', 'PII'],
      ruleIds: ['GENERIC_SECRET', 'EMAIL'],
      countSummary: {
        total: 2,
        by_category: { Credential: 1, PII: 1 },
        by_risk: { high: 1, medium: 1 },
      },
      tokens: {
        '[EMAIL_1]': 'alice@example.com',
        '[GENERIC_SECRET_1]': 'sk-live-secret',
      },
      justification: 'Approved client-facing one-time draft.',
      expectReplay: true,
      expectModal: true,
    },
    {
      hostname: 'claude.ai',
      fixture: 'claude',
      policyAction: 'redact',
      expectedAuditAction: 'redact',
      intentLabel: 'log_analysis',
      explanation: 'Credentials are removed before the prompt is sent.',
      rawPrompt: 'Review these logs with svc-account secret sk-prod-secret.',
      sanitized: 'Review these logs with svc-account secret [GENERIC_SECRET_1].',
      findings: [
        { category: 'Credential', count: 1, label: 'Service secret', risk: 'high' },
      ],
      sensitivityCategories: ['Credential'],
      ruleIds: ['GENERIC_SECRET'],
      countSummary: {
        total: 1,
        by_category: { Credential: 1 },
        by_risk: { high: 1 },
      },
      tokens: {
        '[GENERIC_SECRET_1]': 'sk-prod-secret',
      },
      expectReplay: true,
      expectModal: false,
    },
    {
      hostname: 'copilot.microsoft.com',
      fixture: 'copilot',
      policyAction: 'block',
      expectedAuditAction: 'block',
      intentLabel: 'reporting',
      explanation: 'Financial records cannot be sent to AI from this workflow.',
      rawPrompt: 'Summarize this card number 4111 1111 1111 1111 for finance.',
      sanitized: 'Summarize this card number [CREDIT_CARD_1] for finance.',
      findings: [
        { category: 'Financial', count: 1, label: 'Payment card', risk: 'critical' },
      ],
      sensitivityCategories: ['Financial'],
      ruleIds: ['CREDIT_CARD'],
      countSummary: {
        total: 1,
        by_category: { Financial: 1 },
        by_risk: { critical: 1 },
      },
      tokens: {
        '[CREDIT_CARD_1]': '4111 1111 1111 1111',
      },
      expectReplay: false,
      expectModal: true,
    },
    {
      hostname: 'gemini.google.com',
      fixture: 'gemini',
      policyAction: 'warn',
      expectedAuditAction: 'allow',
      intentLabel: 'documentation',
      explanation: 'Review the cleaned prompt before allowing a one-time send.',
      rawPrompt: 'Document this internal hostname corp-db-01.example.local.',
      sanitized: 'Document this internal hostname [HOSTNAME_1].',
      findings: [
        { category: 'Network', count: 1, label: 'Internal host', risk: 'medium' },
      ],
      sensitivityCategories: ['Network'],
      ruleIds: ['HOSTNAME'],
      countSummary: {
        total: 1,
        by_category: { Network: 1 },
        by_risk: { medium: 1 },
      },
      tokens: {
        '[HOSTNAME_1]': 'corp-db-01.example.local',
      },
      expectReplay: true,
      expectModal: true,
    },
  ];

  for (const scenario of scenarios) {
    const run = await runManagedContentScenario(chrome, scenario);

    if (scenario.expectModal) {
      assert.equal(
        run.hooks.getInterceptState().pendingAction,
        null,
        'expected intercept flow to complete for ' + scenario.hostname
      );
    }

    if (scenario.expectReplay) {
      assert.ok(
        run.finalClickCount >= run.initialClickCount + 2,
        'expected replay send for ' + scenario.hostname
      );
    } else {
      assert.equal(
        run.finalClickCount,
        run.initialClickCount + 1,
        'expected blocked send for ' + scenario.hostname
      );
    }

    const latestAudit = chrome.storage.local._state.logclean_audit_log[0];
    assert.equal(latestAudit.url, scenario.hostname);
    assert.equal(latestAudit.action, scenario.expectedAuditAction);
    assert.equal(
      chrome.storage.local._state.logclean_platform_health[scenario.hostname].trigger_attached,
      true
    );
  }

  assert.equal(chrome.storage.local._state.logclean_audit_log.length, 4);
  assert.equal(chrome.storage.local._state.logclean_device_events.length, 4);
  assert.equal(chrome.storage.local._state.logclean_last_audit_upload_result.status, 'ok');

  assert.equal(instance.state.devices.length, 1);
  assert.equal(instance.state.auditEvents.length, 4);
  assert.deepEqual(
    instance.state.auditEvents.map((entry) => entry.event.site).sort(),
    ['chatgpt.com', 'claude.ai', 'copilot.microsoft.com', 'gemini.google.com'].sort()
  );

  instance.state.auditEvents.forEach((entry) => {
    assert.equal(entry.event.device_id, prepared.device_id);
    assert.equal(entry.event.raw_text_absent, true);
    assert.equal(Object.prototype.hasOwnProperty.call(entry.event, 'raw_prompt_text'), false);
  });

  const summary = await dispatch(app, 'GET', '/api/admin/summary');
  assert.equal(summary.statusCode, 200);
  assert.equal(summary.json.summary.device_count, 1);
  assert.equal(summary.json.summary.audit_event_count, 4);
  assert.equal(summary.json.summary.action_counts.justify, 1);
  assert.equal(summary.json.summary.action_counts.redact, 1);
  assert.equal(summary.json.summary.action_counts.block, 1);
  assert.equal(summary.json.summary.action_counts.allow, 1);
  assert.equal(summary.json.summary.category_counts.Credential, 2);
  assert.equal(summary.json.summary.category_counts.PII, 1);
  assert.equal(summary.json.summary.category_counts.Financial, 1);
  assert.equal(summary.json.summary.category_counts.Network, 1);
  assert.equal(summary.json.summary.intent_counts.client_comms, 1);
  assert.equal(summary.json.summary.intent_counts.log_analysis, 1);
  assert.equal(summary.json.summary.intent_counts.reporting, 1);
  assert.equal(summary.json.summary.intent_counts.documentation, 1);
  assert.equal(summary.json.summary.browser_counts.chrome, 1);
  assert.equal(summary.json.summary.raw_prompt_retention, false);
});

test('managed browser journey keeps metadata local when strict mode is enabled', async () => {
  const { instance, app, chrome, background } = createManagedTestRuntime({
    settingsPatch: {
      logclean_policy_sync_enabled: true,
      logclean_control_plane_base_url: 'http://127.0.0.1:8793',
      logclean_enrollment_token: 'enroll-demo-token',
    },
  });

  const prepared = await background.prepareManagedDemoState();
  assert.equal(prepared.ok, true);

  const strictPolicy = {
    ...chrome.storage.local._state.logclean_policy_bundle,
    strict_mode: true,
  };
  chrome.storage.local.set({
    logclean_policy_bundle: strictPolicy,
  });

  const run = await runManagedContentScenario(chrome, {
    hostname: 'chatgpt.com',
    fixture: 'chatgpt',
    policyAction: 'redact',
    intentLabel: 'log_analysis',
    explanation: 'Credentials are removed locally before send.',
    rawPrompt: 'Review this secret key sk-strict-secret from the latest incident.',
    sanitized: 'Review this secret key [GENERIC_SECRET_1] from the latest incident.',
    findings: [
      { category: 'Credential', count: 1, label: 'API key', risk: 'high' },
    ],
    sensitivityCategories: ['Credential'],
    ruleIds: ['GENERIC_SECRET'],
    countSummary: {
      total: 1,
      by_category: { Credential: 1 },
      by_risk: { high: 1 },
    },
    tokens: {
      '[GENERIC_SECRET_1]': 'sk-strict-secret',
    },
  });

  assert.ok(run.finalClickCount >= run.initialClickCount + 2);
  assert.equal(chrome.storage.local._state.logclean_audit_log.length, 1);
  assert.equal(chrome.storage.local._state.logclean_device_events.length, 1);
  assert.equal(chrome.storage.local._state.logclean_device_events[0].raw_text_absent, true);
  assert.equal(chrome.storage.local._state.logclean_last_audit_upload_result.status, 'strict_mode');
  assert.equal(instance.state.devices.length, 1);
  assert.equal(instance.state.auditEvents.length, 0);

  const summary = await dispatch(app, 'GET', '/api/admin/summary');
  assert.equal(summary.statusCode, 200);
  assert.equal(summary.json.summary.device_count, 1);
  assert.equal(summary.json.summary.audit_event_count, 0);
  assert.equal(summary.json.summary.raw_prompt_retention, false);
});

test('managed browser journey stays local-only when sync is disabled', async () => {
  const { instance, app, chrome } = createManagedTestRuntime({
    settingsPatch: {
      logclean_policy_sync_enabled: false,
      logclean_control_plane_base_url: 'http://127.0.0.1:8793',
      logclean_enrollment_token: 'enroll-demo-token',
    },
  });

  const run = await runManagedContentScenario(chrome, {
    hostname: 'chatgpt.com',
    fixture: 'chatgpt',
    policyAction: 'redact',
    intentLabel: 'log_analysis',
    explanation: 'Credentials are removed locally before send.',
    rawPrompt: 'Summarize this token sk-sync-off-secret without remote upload.',
    sanitized: 'Summarize this token [GENERIC_SECRET_1] without remote upload.',
    findings: [
      { category: 'Credential', count: 1, label: 'API key', risk: 'high' },
    ],
    sensitivityCategories: ['Credential'],
    ruleIds: ['GENERIC_SECRET'],
    countSummary: {
      total: 1,
      by_category: { Credential: 1 },
      by_risk: { high: 1 },
    },
    tokens: {
      '[GENERIC_SECRET_1]': 'sk-sync-off-secret',
    },
  });

  assert.ok(run.finalClickCount >= run.initialClickCount + 2);
  assert.equal(chrome.storage.local._state.logclean_audit_log.length, 1);
  assert.equal(chrome.storage.local._state.logclean_device_events.length, 1);
  assert.equal(chrome.storage.local._state.logclean_last_audit_upload_result.status, 'sync_disabled');
  assert.equal(chrome.storage.local._state.logclean_last_enrollment_result, null);
  assert.equal(instance.state.devices.length, 0);
  assert.equal(instance.state.auditEvents.length, 0);

  const summary = await dispatch(app, 'GET', '/api/admin/summary');
  assert.equal(summary.statusCode, 200);
  assert.equal(summary.json.summary.device_count, 0);
  assert.equal(summary.json.summary.audit_event_count, 0);
});

test('managed browser journey preserves local protection when enrollment fails', async () => {
  const { instance, app, chrome } = createManagedTestRuntime({
    settingsPatch: {
      logclean_policy_sync_enabled: true,
      logclean_control_plane_base_url: 'http://127.0.0.1:8793',
      logclean_enrollment_token: 'enroll-demo-token',
    },
    fetch: async (url, options = {}) => {
      if (new URL(url).pathname === '/api/device-enrollment') {
        return {
          ok: false,
          status: 503,
          async json() {
            return { ok: false, error: 'service_unavailable' };
          },
        };
      }
      return createFetchBridge(app)(url, options);
    },
  });

  const run = await runManagedContentScenario(chrome, {
    hostname: 'chatgpt.com',
    fixture: 'chatgpt',
    policyAction: 'redact',
    intentLabel: 'log_analysis',
    explanation: 'Credentials are removed locally before send.',
    rawPrompt: 'Inspect this secret sk-enrollment-fail without remote enrollment.',
    sanitized: 'Inspect this secret [GENERIC_SECRET_1] without remote enrollment.',
    findings: [
      { category: 'Credential', count: 1, label: 'API key', risk: 'high' },
    ],
    sensitivityCategories: ['Credential'],
    ruleIds: ['GENERIC_SECRET'],
    countSummary: {
      total: 1,
      by_category: { Credential: 1 },
      by_risk: { high: 1 },
    },
    tokens: {
      '[GENERIC_SECRET_1]': 'sk-enrollment-fail',
    },
  });

  assert.ok(run.finalClickCount >= run.initialClickCount + 2);
  assert.equal(chrome.storage.local._state.logclean_audit_log.length, 1);
  assert.equal(chrome.storage.local._state.logclean_device_events.length, 1);
  assert.equal(chrome.storage.local._state.logclean_last_enrollment_result.status, 'http_error');
  assert.equal(chrome.storage.local._state.logclean_last_audit_upload_result.status, 'enrollment_required');
  assert.equal(instance.state.devices.length, 0);
  assert.equal(instance.state.auditEvents.length, 0);
});

test('managed demo preparation surfaces policy sync failure after enrollment', async () => {
  const { instance, chrome, background, app } = createManagedTestRuntime({
    settingsPatch: {
      logclean_policy_sync_enabled: true,
      logclean_control_plane_base_url: 'http://127.0.0.1:8793',
      logclean_enrollment_token: 'enroll-demo-token',
    },
    fetch: async (url, options = {}) => {
      if (new URL(url).pathname === '/api/policies/default') {
        return {
          ok: false,
          status: 503,
          async json() {
            return { ok: false, error: 'policy_service_unavailable' };
          },
        };
      }
      return createFetchBridge(app)(url, options);
    },
  });

  const result = await background.prepareManagedDemoState();
  assert.equal(result.ok, false);
  assert.equal(result.step, 'policy_sync');
  assert.equal(result.reason, 'http_error');
  assert.equal(chrome.storage.local._state.logclean_last_enrollment_result.status, 'ok');
  assert.equal(chrome.storage.local._state.logclean_last_sync_result.status, 'http_error');
  assert.ok(chrome.storage.local._state.logclean_device_enrollment);
  assert.equal(instance.state.devices.length, 1);
  assert.equal(instance.state.auditEvents.length, 0);
});
