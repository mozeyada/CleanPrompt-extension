const test = require('node:test');
const assert = require('node:assert/strict');

const { loadScript } = require('./helpers/load-script-context');

function loadPopupHooks() {
  const popup = loadScript('popup.js', {
    chrome: {
      storage: {
        local: {
          get() {},
        },
      },
      runtime: {},
    },
    document: {
      querySelectorAll() {
        return [];
      },
    },
    LOGCLEAN_RULES: [],
    LOGCLEAN_PROTECTION: {},
  });

  return popup.__cleanpromptPopup;
}

test('popup managed view model describes local-only posture clearly', () => {
  const hooks = loadPopupHooks();
  const view = hooks.buildManagedViewModel({
    logclean_policy_sync_enabled: false,
    logclean_control_plane_base_url: 'http://127.0.0.1:8787',
    logclean_policy_bundle: {
      org_name: 'Acme Managed Services',
      policy_version: '2026.03.18-local',
    },
    device_id: 'device-local-123',
    extension_version: '1.2.0-test',
    rules_version: '1.2.0-local',
  });

  assert.equal(view.modeLabel, 'Local-only mode');
  assert.equal(view.enrollmentLabel, 'Enrollment optional');
  assert.equal(view.syncLabel, 'Sync disabled');
  assert.match(view.uploadDetail, /stays local-only/i);
  assert.match(view.insightSummary, /no owner insight/i);
  assert.match(view.demoNextStep, /prepare managed demo/i);
  assert.match(view.demoResetNote, /keeping the control-plane base URL/i);
});

test('popup managed view model reflects enrolled managed state', () => {
  const hooks = loadPopupHooks();
  const view = hooks.buildManagedViewModel({
    logclean_policy_sync_enabled: true,
    logclean_control_plane_base_url: 'http://127.0.0.1:8787',
    logclean_policy_bundle: {
      org_name: 'Acme Managed Services',
      policy_version: '2026.03.25-remote',
    },
    logclean_device_enrollment: {
      device_id: 'device-enrolled-123',
      enrolled_at: '2026-03-22T10:15:00.000Z',
    },
    logclean_last_sync_result: {
      status: 'ok',
      ts: '2026-03-22T10:16:00.000Z',
    },
    logclean_last_audit_upload_result: {
      status: 'ok',
      ts: '2026-03-22T10:17:00.000Z',
    },
    device_id: 'device-enrolled-123',
    extension_version: '1.2.0-test',
    rules_version: '1.3.0-remote',
  });

  assert.equal(view.modeLabel, 'Managed sync enabled');
  assert.equal(view.enrollmentLabel, 'Device enrolled');
  assert.equal(view.syncLabel, 'Ok');
  assert.equal(view.deviceId, 'device-enrolled-123');
  assert.match(view.enrollmentDetail, /2026-03-22 10:15 UTC/);
  assert.match(view.syncDetail, /Policy sync completed/);
  assert.match(view.uploadDetail, /Latest metadata event uploaded/);
  assert.match(view.demoNextStep, /managed demo is ready/i);
  assert.match(view.demoFlowNote, /re-enrolls the browser/i);
});

test('popup platform coverage model turns stored host health into compatibility evidence', () => {
  const hooks = loadPopupHooks();
  const coverage = hooks.buildPlatformCoverageModel({
    logclean_platform_health: {
      'chatgpt.com': {
        host: 'chatgpt.com',
        platform_key: 'chatgpt',
        platform_name: 'ChatGPT',
        input_detected: true,
        toolbar_detected: true,
        send_button_detected: true,
        trigger_attached: true,
        sidebar_ready: true,
        input_selector: '#prompt-textarea',
        toolbar_strategy: 'closest(form)',
        send_selector: 'button[data-testid="send-button"]',
        compatibility_confidence: 'primary_path',
        ts: '2026-03-22T10:20:00.000Z',
      },
      'claude.ai': {
        host: 'claude.ai',
        platform_key: 'claude',
        platform_name: 'Claude',
        input_detected: true,
        toolbar_detected: true,
        send_button_detected: true,
        trigger_attached: true,
        sidebar_ready: true,
        input_selector: 'div[contenteditable="true"]',
        toolbar_strategy: 'parentElement',
        send_selector: 'button[aria-label="Send message"]',
        compatibility_confidence: 'fallback_path',
        ts: '2026-03-22T10:22:00.000Z',
      },
    },
  });

  const chatgpt = coverage.find((item) => item.host === 'chatgpt.com');
  const claude = coverage.find((item) => item.host === 'claude.ai');

  assert.equal(chatgpt.statusLabel, 'Verified');
  assert.equal(chatgpt.statusTone, 'ok');
  assert.match(chatgpt.detail, /#prompt-textarea/);
  assert.match(chatgpt.detail, /closest\(form\)/);
  assert.equal(claude.statusLabel, 'Fallback verified');
  assert.equal(claude.statusTone, 'warn');
  assert.match(claude.detail, /button\[aria-label="Send message"\]/);
});
