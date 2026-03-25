const test = require('node:test');
const assert = require('node:assert/strict');

const sharedSchemas = require('../packages/shared-schemas/src/runtime.js');
const controlPlaneValidators = require('../control-plane/src/validators');
const { createChromeStub, loadScript } = require('./helpers/load-script-context');

function createPolicyBundle() {
  return {
    schema_version: '1.0.0',
    policy_version: '2026.03.22-dev',
    org_id: 'org_acme_msp',
    org_name: 'Acme Managed Services',
    team_id: 'helpdesk',
    team_name: 'Helpdesk',
    app_scopes: ['chatgpt.com'],
    rules: {
      active_rule_ids: null,
      bundle_version: '1.2.0-local',
      local_bundle_version: '1.2.0-local',
      total_rules: 61,
      remote_updates_enabled: false,
      stage2_ner_enabled: false,
      fallback_mode: 'bundled_only',
    },
    intent_rules: {
      other: 'warn',
      log_analysis: 'redact',
    },
    actions: {
      default: 'warn',
      by_category: {
        Credential: 'justify',
      },
    },
    justification_required: ['Credential'],
    metadata_analytics: {
      enabled: true,
      raw_prompt_retention: false,
      user_level_drilldown: false,
      aggregation_thresholds: {
        min_events: 5,
        min_distinct_actors: 3,
      },
      rotating_actor_window_days: 30,
    },
    strict_mode: false,
  };
}

test('control-plane validators are sourced from the shared schema runtime', () => {
  assert.equal(controlPlaneValidators.validatePolicyBundle, sharedSchemas.validatePolicyBundle);
  assert.equal(controlPlaneValidators.validateAuditEvent, sharedSchemas.validateAuditEvent);
  assert.equal(controlPlaneValidators.validateDeviceEnrollmentRequest, sharedSchemas.validateDeviceEnrollmentRequest);
  assert.equal(sharedSchemas.validatePolicyBundle(createPolicyBundle()), null);
});

test('shared schema runtime validates rule manifests and rollout state', () => {
  const validRuleManifest = {
    schema_version: '1.0.0',
    manifest_version: '2026.03.22-demo',
    published_at: '2026-03-22T10:00:00.000Z',
    compatible_extension_versions: ['1.2.0', '1.2.x'],
    rules: [
      {
        id: 'GENERIC_SECRET',
        label: 'Generic Secret',
        category: 'Credential',
        risk: 'high',
        color: '#f97316',
        pattern: '(?:sk|pk)-[a-z0-9]+',
        flags: 'gi',
      },
    ],
    signature: 'demo-signature',
  };

  const validRolloutState = {
    schema_version: '1.0.0',
    artifact_type: 'rule_manifest',
    artifact_version: '2026.03.22-demo',
    rollout_stage: 'canary',
    rollout_percentage: 10,
    emergency_blocked: false,
  };

  assert.equal(sharedSchemas.validateRuleManifest(validRuleManifest), null);
  assert.equal(sharedSchemas.validateRolloutState(validRolloutState), null);

  assert.equal(
    sharedSchemas.validateRuleManifest({
      ...validRuleManifest,
      rules: [{ ...validRuleManifest.rules[0], risk: 'urgent' }],
    }),
    'invalid_rule_risk_0'
  );
  assert.equal(
    sharedSchemas.validateRolloutState({
      ...validRolloutState,
      rollout_percentage: 150,
    }),
    'invalid_rollout_percentage_range'
  );
});

test('background policy sync rejects invalid remote policy through shared schema validation', async () => {
  const chrome = createChromeStub();
  chrome.storage.local.set({
    logclean_policy_sync_enabled: true,
    logclean_control_plane_base_url: 'http://127.0.0.1:8787',
    logclean_enrollment_token: 'enroll-demo-token',
  });

  const background = loadScript('background.js', {
    chrome,
    navigator: {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
    },
    fetch: async (url) => {
      if (url.endsWith('/api/device-enrollment')) {
        return {
          ok: true,
          async json() {
            return {
              schema_version: '1.0.0',
              device_id: 'device-shared-123',
              org_id: 'org_acme_msp',
              policy_version: '2026.03.22-dev',
              rules_version: '1.2.0-local',
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
              schema_version: '1.0.0',
              policy_version: '2026.04.01-bad',
              org_id: 'org_acme_msp',
              org_name: 'Acme Managed Services',
              rules: {
                active_rule_ids: null,
                local_bundle_version: '1.2.0-local',
              },
              intent_rules: {
                other: 'ship_it',
              },
              actions: {
                default: 'warn',
                by_category: {},
              },
              justification_required: [],
              strict_mode: false,
            },
          };
        },
      };
    },
  });

  const result = await background.syncPolicyBundleFromControlPlane();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_policy_bundle');
  assert.equal(result.error, 'invalid_intent_rule_other');
  assert.equal(chrome.storage.local._state.logclean_last_sync_result.status, 'invalid_policy_bundle');
  assert.equal(chrome.storage.local._state.logclean_last_sync_result.validation_error, 'invalid_intent_rule_other');
});

test('background audit upload rejects invalid payloads through shared schema validation before fetch', async () => {
  const chrome = createChromeStub();
  chrome.storage.local.set({
    logclean_policy_sync_enabled: true,
    logclean_control_plane_base_url: 'http://127.0.0.1:8787',
    logclean_device_enrollment: {
      device_id: 'device-shared-456',
      enrolled_at: '2026-03-22T10:15:00.000Z',
    },
    logclean_policy_bundle: createPolicyBundle(),
  });

  let fetchCalled = false;
  const background = loadScript('background.js', {
    chrome,
    fetch: async () => {
      fetchCalled = true;
      throw new Error('should_not_fetch_invalid_payload');
    },
  });

  const result = await background.uploadAuditEventToControlPlane({
    schema_version: '1.0.0',
    org_id: 'org_acme_msp',
    device_id: 'device-shared-456',
    extension_version: '1.2.0-test',
    action: 'redact',
    intent_label: 'log_analysis',
    intent_confidence_bucket: 'medium',
    sensitivity_categories: ['Credential'],
    rule_ids: ['GENERIC_SECRET'],
    count_summary: {
      total: 1,
      by_category: { Credential: 1 },
      by_risk: { high: 1 },
    },
    prompt_size_bucket: 'medium',
    timestamp_bucket: new Date().toISOString(),
    raw_text_absent: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_payload');
  assert.equal(result.error, 'invalid_site');
  assert.equal(fetchCalled, false);
  assert.equal(chrome.storage.local._state.logclean_last_audit_upload_result.status, 'invalid_payload');
  assert.equal(chrome.storage.local._state.logclean_last_audit_upload_result.validation_error, 'invalid_site');
});
