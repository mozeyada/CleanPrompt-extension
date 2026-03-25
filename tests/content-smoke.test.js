const test = require('node:test');
const assert = require('node:assert/strict');

const { loadScript } = require('./helpers/load-script-context');
const { createContentSmokeEnv } = require('./helpers/content-smoke-env');

function createManagedSettings() {
  return {
    logclean_policy_bundle: {
      org_id: 'org_acme_msp',
      org_name: 'Acme Managed Services',
      team_id: 'helpdesk',
      team_name: 'Helpdesk',
      strict_mode: false,
      rules: {
        active_rule_ids: null,
      },
    },
    rotating_actor_id: 'actor-2026-03',
    device_id: 'device-smoke-123',
    extension_version: '1.2.0-test',
    policy_version: '2026.03.22-dev',
    rules_version: '1.2.0-local',
  };
}

test('content smoke injects trigger and sidebar on a supported AI host', () => {
  const env = createContentSmokeEnv({
    hostname: 'chatgpt.com',
    settings: createManagedSettings(),
  });

  const content = loadScript('content.js', env.additions);

  assert.equal(content.__cleanpromptContentBootstrap.detectPlatform().name, 'ChatGPT');
  assert.ok(env.document.getElementById('logclean-trigger-wrap'));
  assert.ok(env.document.getElementById('logclean-sidebar'));
  assert.ok(env.document.getElementById('lc-intercept-overlay'));
  assert.ok(env.messages.some((message) => message.type === 'GET_SETTINGS'));
  assert.ok(env.messages.some((message) => message.type === 'REPORT_PLATFORM_HEALTH'));

  const trigger = env.document.getElementById('logclean-trigger');
  trigger.click();
  assert.equal(content.__cleanpromptContentTest.isSidebarOpen(), true);
  assert.equal(content.__cleanpromptContentTest.getCompatibilityReport('test').platform_key, 'chatgpt');
  assert.equal(content.__cleanpromptContentTest.getCompatibilityReport('test').trigger_attached, true);
  assert.equal(content.__cleanpromptContentTest.getCompatibilityReport('test').input_selector, '#prompt-textarea');
  assert.equal(content.__cleanpromptContentTest.getCompatibilityReport('test').toolbar_strategy, 'closest(form)');
  assert.equal(content.__cleanpromptContentTest.getCompatibilityReport('test').send_selector, 'button[data-testid="send-button"]');
  assert.equal(content.__cleanpromptContentTest.getCompatibilityReport('test').compatibility_confidence, 'primary_path');
});

test('content smoke emits managed audit metadata from the injected surface', () => {
  const env = createContentSmokeEnv({
    hostname: 'chatgpt.com',
    settings: createManagedSettings(),
  });

  const content = loadScript('content.js', env.additions);
  const hooks = content.__cleanpromptContentTest;
  const runtimeSettings = hooks.getRuntimeSettings();

  assert.equal(hooks.getPlatformName(), 'ChatGPT');
  assert.equal(runtimeSettings.deviceId, 'device-smoke-123');
  assert.equal(runtimeSettings.policyVersion, '2026.03.22-dev');
  assert.equal(runtimeSettings.rulesVersion, '1.2.0-local');

  hooks.logMetadataEvent({
    event_summary: {
      schema_version: '1.0.0',
      org_id: 'org_acme_msp',
      team_id: 'helpdesk',
      device_id: 'device-smoke-123',
      extension_version: '1.2.0-test',
      policy_version: '2026.03.22-dev',
      rules_version: '1.2.0-local',
      site: 'chatgpt.com',
      action: 'justify',
      intent_label: 'client_comms',
      intent_confidence_bucket: 'medium',
      sensitivity_categories: ['Credential'],
      rule_ids: ['GENERIC_SECRET'],
      count_summary: { total: 1, by_category: { Credential: 1 }, by_risk: { high: 1 } },
      prompt_size_bucket: 'medium',
      raw_text_absent: true,
      justification_required: true,
      timestamp_bucket: '2026-03-22T10:00:00.000Z',
    },
  }, 'justify', true);

  const auditMessages = env.messages.filter((message) => message.type === 'LOG_AUDIT');
  assert.equal(auditMessages.length, 1);
  assert.equal(auditMessages[0].url, 'chatgpt.com');
  assert.equal(auditMessages[0].event_summary.justification_provided, true);
  assert.equal(auditMessages[0].event_summary.raw_text_absent, true);
  assert.equal(auditMessages[0].event_summary.device_id, 'device-smoke-123');
});

test('content trigger cleans the live prompt in place by default when text already exists', async () => {
  const env = createContentSmokeEnv({
    hostname: 'chatgpt.com',
    fixture: 'chatgpt',
    settings: createManagedSettings(),
    logcleanGetSummary() {
      return { total: 1, byCategory: { Credential: 1 }, byRisk: { high: 1 } };
    },
    async logcleanRedact(raw) {
      return {
        sanitized: 'please summarize [GENERIC_SECRET_1] safely',
        findings: [{ category: 'Credential', count: 1, label: 'API key', risk: 'high' }],
        policy_action: 'warn',
        intent_label: 'log_analysis',
        employee_explanation: 'Credential removed before send.',
        safe_compose_prompt: 'safe compose prompt',
        tokens: { '[GENERIC_SECRET_1]': 'sk-live-secret' },
        event_summary: {
          schema_version: '1.0.0',
          org_id: 'org_acme_msp',
          team_id: 'helpdesk',
          device_id: 'device-smoke-123',
          extension_version: '1.2.0-test',
          policy_version: '2026.03.22-dev',
          rules_version: '1.2.0-local',
          site: 'chatgpt.com',
          action: 'warn',
          intent_label: 'log_analysis',
          intent_confidence_bucket: 'medium',
          sensitivity_categories: ['Credential'],
          rule_ids: ['GENERIC_SECRET'],
          count_summary: { total: 1, by_category: { Credential: 1 }, by_risk: { high: 1 } },
          prompt_size_bucket: 'medium',
          raw_text_absent: true,
          justification_required: false,
          timestamp_bucket: '2026-03-22T10:00:00.000Z',
        },
      };
    },
  });

  const content = loadScript('content.js', env.additions);
  env.input.value = 'please summarize sk-live-secret safely';
  env.document.getElementById('logclean-trigger').click();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(env.input.value, 'please summarize [GENERIC_SECRET_1] safely');
  assert.equal(content.__cleanpromptContentTest.isSidebarOpen(), false);
  assert.equal(env.sendButton.clickCount, 0);
});

test('content sidebar insert replaces the prompt without auto-submitting', async () => {
  const env = createContentSmokeEnv({
    hostname: 'chatgpt.com',
    fixture: 'chatgpt',
    settings: createManagedSettings(),
    logcleanGetSummary() {
      return { total: 1, byCategory: { Credential: 1 }, byRisk: { high: 1 } };
    },
    async logcleanRedact(raw) {
      return {
        sanitized: 'sanitized prompt [GENERIC_SECRET_1]',
        findings: [{ category: 'Credential', count: 1, label: 'API key', risk: 'high' }],
        policy_action: 'warn',
        intent_label: 'log_analysis',
        employee_explanation: 'Credential removed before send.',
        safe_compose_prompt: 'safe compose prompt',
        tokens: { '[GENERIC_SECRET_1]': 'sk-live-secret' },
        event_summary: {
          schema_version: '1.0.0',
          org_id: 'org_acme_msp',
          team_id: 'helpdesk',
          device_id: 'device-smoke-123',
          extension_version: '1.2.0-test',
          policy_version: '2026.03.22-dev',
          rules_version: '1.2.0-local',
          site: 'chatgpt.com',
          action: 'warn',
          intent_label: 'log_analysis',
          intent_confidence_bucket: 'medium',
          sensitivity_categories: ['Credential'],
          rule_ids: ['GENERIC_SECRET'],
          count_summary: { total: 1, by_category: { Credential: 1 }, by_risk: { high: 1 } },
          prompt_size_bucket: 'medium',
          raw_text_absent: true,
          justification_required: false,
          timestamp_bucket: '2026-03-22T10:00:00.000Z',
        },
      };
    },
  });

  loadScript('content.js', env.additions);
  env.document.getElementById('logclean-trigger').click();
  env.document.getElementById('lc-raw-input').value = 'please summarize sk-live-secret safely';
  env.document.getElementById('lc-redact-btn').click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  env.document.getElementById('lc-insert-btn').click();
  await new Promise((resolve) => setTimeout(resolve, 250));

  assert.equal(env.input.value, 'sanitized prompt [GENERIC_SECRET_1]');
  assert.equal(env.sendButton.clickCount, 0);
});

[
  { hostname: 'chatgpt.com', fixture: 'chatgpt', expectedName: 'ChatGPT', expectedKey: 'chatgpt', inputSelector: '#prompt-textarea', toolbarStrategy: 'closest(form)', sendSelector: 'button[data-testid="send-button"]', confidence: 'primary_path' },
  { hostname: 'claude.ai', fixture: 'claude', expectedName: 'Claude', expectedKey: 'claude', inputSelector: 'div[contenteditable="true"]', toolbarStrategy: 'parentElement', sendSelector: 'button[aria-label="Send message"]', confidence: 'fallback_path' },
  { hostname: 'copilot.microsoft.com', fixture: 'copilot', expectedName: 'Copilot', expectedKey: 'copilot', inputSelector: 'textarea#searchbox', toolbarStrategy: 'parentElement', sendSelector: 'button[type="submit"]', confidence: 'fallback_path' },
  { hostname: 'gemini.google.com', fixture: 'gemini', expectedName: 'Gemini', expectedKey: 'gemini', inputSelector: 'rich-textarea div[contenteditable="true"]', toolbarStrategy: 'parentElement', sendSelector: 'button[aria-label="Send"]', confidence: 'fallback_path' },
].forEach((scenario) => {
  test('content smoke verifies host fixture for ' + scenario.expectedName, () => {
    const env = createContentSmokeEnv({
      hostname: scenario.hostname,
      fixture: scenario.fixture,
      settings: createManagedSettings(),
    });

    const content = loadScript('content.js', env.additions);
    const hooks = content.__cleanpromptContentTest;
    const report = hooks.getCompatibilityReport('fixture_check');

    assert.equal(content.__cleanpromptContentBootstrap.detectPlatform().name, scenario.expectedName);
    assert.equal(hooks.getPlatformName(), scenario.expectedName);
    assert.equal(report.platform_key, scenario.expectedKey);
    assert.equal(report.input_detected, true);
    assert.equal(report.toolbar_detected, true);
    assert.equal(report.send_button_detected, true);
    assert.equal(report.trigger_attached, true);
    assert.equal(report.input_selector, scenario.inputSelector);
    assert.equal(report.toolbar_strategy, scenario.toolbarStrategy);
    assert.equal(report.send_selector, scenario.sendSelector);
    assert.equal(report.compatibility_confidence, scenario.confidence);
    assert.ok(env.document.getElementById('logclean-trigger-wrap'));
  });
});

test('content bootstrap ignores unsupported hosts', () => {
  const env = createContentSmokeEnv({
    hostname: 'example.com',
    fixture: 'chatgpt',
    settings: createManagedSettings(),
  });

  const content = loadScript('content.js', env.additions);
  assert.equal(content.__cleanpromptContentBootstrap.detectPlatform(), null);
  assert.equal(content.__cleanpromptContentTest, undefined);
  assert.equal(env.document.getElementById('logclean-trigger-wrap'), null);
});

test('content smoke tolerates extension context invalidation without uncaught runtime errors', () => {
  const invalidationError = new Error('Extension context invalidated.');
  const env = createContentSmokeEnv({
    hostname: 'chatgpt.com',
    fixture: 'chatgpt',
    chrome: {
      storage: {
        local: {
          get() {
            throw invalidationError;
          },
        },
      },
      runtime: {
        getURL(resource) {
          return resource;
        },
        sendMessage() {
          throw invalidationError;
        },
      },
    },
  });

  const content = loadScript('content.js', env.additions);
  const hooks = content.__cleanpromptContentTest;

  assert.ok(env.document.getElementById('logclean-trigger-wrap'));
  assert.ok(env.document.getElementById('logclean-sidebar'));
  assert.equal(hooks.isExtensionContextActive(), false);

  assert.doesNotThrow(() => {
    hooks.logMetadataEvent({
      event_summary: {
        count_summary: { total: 1, by_risk: {} },
        sensitivity_categories: ['Credential'],
        intent_label: 'other',
      },
    }, 'warn', false);
  });

  env.document.getElementById('logclean-trigger').click();
  assert.equal(hooks.isSidebarOpen(), true);
});

test('content smoke intercepts send and auto-redacts before replaying submission', async () => {
  const env = createContentSmokeEnv({
    hostname: 'chatgpt.com',
    fixture: 'chatgpt',
    settings: createManagedSettings(),
    logcleanGetSummary() {
      return { total: 1, byCategory: { Credential: 1 }, byRisk: { high: 1 } };
    },
    async logcleanRedact(raw) {
      return {
        sanitized: 'sanitized prompt [GENERIC_SECRET_1]',
        findings: [{ category: 'Credential', count: 1, label: 'API key', risk: 'high' }],
        policy_action: 'redact',
        intent_label: 'log_analysis',
        employee_explanation: 'Credential removed before send.',
        safe_compose_prompt: 'safe compose',
        tokens: { '[GENERIC_SECRET_1]': 'sk-live-secret' },
        event_summary: {
          schema_version: '1.0.0',
          org_id: 'org_acme_msp',
          org_name: 'Acme Managed Services',
          team_id: 'helpdesk',
          team_name: 'Helpdesk',
          device_id: 'device-smoke-123',
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
          raw_text_absent: true,
          justification_required: false,
          timestamp_bucket: '2026-03-22T10:00:00.000Z',
        },
      };
    },
  });

  const content = loadScript('content.js', env.additions);
  const hooks = content.__cleanpromptContentTest;

  env.input.value = 'please summarize this secret token sk-live-secret for me';
  hooks.attachSendInterceptor();
  env.sendButton.click();
  await new Promise((resolve) => setTimeout(resolve, 250));

  const auditMessages = env.messages.filter((message) => message.type === 'LOG_AUDIT');
  assert.equal(auditMessages.length, 1);
  assert.equal(auditMessages[0].event_summary.action, 'redact');
  assert.equal(env.input.value, 'sanitized prompt [GENERIC_SECRET_1]');
  assert.ok(env.sendButton.clickCount >= 2);
});

test('content smoke replays a clean send without recursively freezing on the interceptor', async () => {
  const env = createContentSmokeEnv({
    hostname: 'chatgpt.com',
    fixture: 'chatgpt',
    settings: createManagedSettings(),
    logcleanGetSummary() {
      return { total: 0, byCategory: {}, byRisk: {} };
    },
    async logcleanRedact() {
      return {
        sanitized: 'safe prompt without findings',
        findings: [],
        policy_action: 'allow',
        intent_label: 'other',
        employee_explanation: 'No sensitive content detected.',
        safe_compose_prompt: 'safe compose',
        tokens: {},
        event_summary: null,
      };
    },
  });

  const content = loadScript('content.js', env.additions);
  const hooks = content.__cleanpromptContentTest;

  env.input.value = 'safe prompt without findings';
  hooks.attachSendInterceptor();
  env.sendButton.click();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(hooks.getInterceptState().open, false);
  assert.equal(env.input.value, 'safe prompt without findings');
  assert.equal(env.messages.filter((message) => message.type === 'LOG_AUDIT').length, 0);
  assert.equal(env.sendButton.clickCount, 2);
});

test('content smoke requires justification before allowing a justify path to replay send', async () => {
  const env = createContentSmokeEnv({
    hostname: 'chatgpt.com',
    fixture: 'chatgpt',
    settings: createManagedSettings(),
    logcleanGetSummary() {
      return { total: 1, byCategory: { Credential: 1 }, byRisk: { high: 1 } };
    },
    async logcleanRedact() {
      return {
        sanitized: 'sanitized justify prompt [GENERIC_SECRET_1]',
        findings: [{ category: 'Credential', count: 1, label: 'API key', risk: 'high' }],
        policy_action: 'justify',
        intent_label: 'client_comms',
        employee_explanation: 'A business reason is required before a one-time send.',
        safe_compose_prompt: 'safe compose',
        tokens: { '[GENERIC_SECRET_1]': 'sk-live-secret' },
        event_summary: {
          schema_version: '1.0.0',
          org_id: 'org_acme_msp',
          org_name: 'Acme Managed Services',
          team_id: 'helpdesk',
          team_name: 'Helpdesk',
          device_id: 'device-smoke-123',
          extension_version: '1.2.0-test',
          policy_version: '2026.03.22-dev',
          rules_version: '1.2.0-local',
          site: 'chatgpt.com',
          action: 'justify',
          intent_label: 'client_comms',
          intent_confidence_bucket: 'medium',
          sensitivity_categories: ['Credential'],
          rule_ids: ['GENERIC_SECRET'],
          count_summary: { total: 1, by_category: { Credential: 1 }, by_risk: { high: 1 } },
          prompt_size_bucket: 'medium',
          raw_text_absent: true,
          justification_required: true,
          timestamp_bucket: '2026-03-22T10:00:00.000Z',
        },
      };
    },
  });

  const content = loadScript('content.js', env.additions);
  const hooks = content.__cleanpromptContentTest;

  env.input.value = 'send this credential to AI please';
  hooks.attachSendInterceptor();
  env.sendButton.click();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(hooks.getInterceptState().open, true);
  assert.equal(hooks.getInterceptState().pendingAction, 'justify');
  assert.equal(hooks.getInterceptState().justificationVisible, true);
  assert.equal(env.input.value, 'sanitized justify prompt [GENERIC_SECRET_1]');

  env.document.getElementById('lc-intercept-allow').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(hooks.getInterceptState().open, true);
  assert.equal(env.messages.filter((message) => message.type === 'LOG_AUDIT').length, 0);
  assert.equal(env.sendButton.clickCount, 1);

  env.document.getElementById('lc-intercept-justification').value = 'Customer escalation requires one-time context.';
  env.document.getElementById('lc-intercept-allow').click();
  await new Promise((resolve) => setTimeout(resolve, 10));

  const auditMessages = env.messages.filter((message) => message.type === 'LOG_AUDIT');
  assert.equal(hooks.getInterceptState().open, false);
  assert.equal(auditMessages.length, 1);
  assert.equal(auditMessages[0].event_summary.action, 'justify');
  assert.equal(auditMessages[0].event_summary.justification_provided, true);
  assert.ok(env.sendButton.clickCount >= 2);
});

test('content smoke blocks a risky send without replaying the submission', async () => {
  const env = createContentSmokeEnv({
    hostname: 'chatgpt.com',
    fixture: 'chatgpt',
    settings: createManagedSettings(),
    logcleanGetSummary() {
      return { total: 1, byCategory: { Financial: 1 }, byRisk: { critical: 1 } };
    },
    async logcleanRedact() {
      return {
        sanitized: 'sanitized blocked prompt [CARD_NUMBER_1]',
        findings: [{ category: 'Financial', count: 1, label: 'Card number', risk: 'critical' }],
        policy_action: 'block',
        intent_label: 'reporting',
        employee_explanation: 'This content is blocked from direct submission.',
        safe_compose_prompt: 'safe compose',
        tokens: { '[CARD_NUMBER_1]': '4111111111111111' },
        event_summary: {
          schema_version: '1.0.0',
          org_id: 'org_acme_msp',
          org_name: 'Acme Managed Services',
          team_id: 'helpdesk',
          team_name: 'Helpdesk',
          device_id: 'device-smoke-123',
          extension_version: '1.2.0-test',
          policy_version: '2026.03.22-dev',
          rules_version: '1.2.0-local',
          site: 'chatgpt.com',
          action: 'block',
          intent_label: 'reporting',
          intent_confidence_bucket: 'medium',
          sensitivity_categories: ['Financial'],
          rule_ids: ['CARD_NUMBER'],
          count_summary: { total: 1, by_category: { Financial: 1 }, by_risk: { critical: 1 } },
          prompt_size_bucket: 'medium',
          raw_text_absent: true,
          justification_required: false,
          timestamp_bucket: '2026-03-22T10:00:00.000Z',
        },
      };
    },
  });

  const content = loadScript('content.js', env.additions);
  const hooks = content.__cleanpromptContentTest;

  env.input.value = 'send this payment card to AI';
  hooks.attachSendInterceptor();
  env.sendButton.click();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(hooks.getInterceptState().open, true);
  assert.equal(hooks.getInterceptState().pendingAction, 'block');
  assert.equal(env.document.getElementById('lc-intercept-allow').style.display, 'none');

  env.document.getElementById('lc-intercept-block').click();
  await new Promise((resolve) => setTimeout(resolve, 10));

  const auditMessages = env.messages.filter((message) => message.type === 'LOG_AUDIT');
  assert.equal(hooks.getInterceptState().open, false);
  assert.equal(auditMessages.length, 1);
  assert.equal(auditMessages[0].event_summary.action, 'block');
  assert.equal(env.sendButton.clickCount, 1);
});

test('content smoke reports drift when a supported host no longer exposes a prompt surface', () => {
  const env = createContentSmokeEnv({
    hostname: 'chatgpt.com',
    fixture: 'chatgpt-drift',
    settings: createManagedSettings(),
  });

  const content = loadScript('content.js', env.additions);
  const reports = env.messages.filter((message) => message.type === 'REPORT_PLATFORM_HEALTH');
  const lastReport = reports[reports.length - 1].report;

  assert.equal(content.__cleanpromptContentBootstrap.detectPlatform().name, 'ChatGPT');
  assert.equal(env.document.getElementById('logclean-trigger-wrap'), null);
  assert.equal(lastReport.input_detected, false);
  assert.equal(lastReport.toolbar_detected, false);
  assert.equal(lastReport.compatibility_confidence, 'needs_review');
  assert.match(lastReport.detection_reason, /attach_container_missing|init_retry_pending/);
});
