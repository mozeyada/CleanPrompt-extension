const test = require('node:test');
const assert = require('node:assert/strict');

const sharedSchemas = require('../src/runtime.js');

test('shared-schemas package validates active and scaffolded contracts', () => {
  const policyBundle = {
    schema_version: '1.0.0',
    policy_version: '2026.03.22-dev',
    org_id: 'org_acme_msp',
    org_name: 'Acme Managed Services',
    team_id: 'helpdesk',
    team_name: 'Helpdesk',
    rules: {
      active_rule_ids: null,
      bundle_version: '1.2.0-local',
      local_bundle_version: '1.2.0-local',
      fallback_mode: 'bundled_only',
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

  const auditEvent = {
    schema_version: '1.0.0',
    org_id: 'org_acme_msp',
    device_id: 'device-123',
    extension_version: '1.2.0-test',
    site: 'chatgpt.com',
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
    timestamp_bucket: '2026-03-22T10:00:00.000Z',
    raw_text_absent: true,
  };

  const enrollmentRequest = {
    schema_version: '1.0.0',
    enrollment_token: 'enroll-demo-token',
    extension_version: '1.2.0',
    browser_family: 'chrome',
    os_family: 'windows',
    managed_device: true,
  };

  const ruleManifest = {
    schema_version: '1.0.0',
    manifest_version: '2026.03.22-demo',
    published_at: '2026-03-22T10:00:00.000Z',
    compatible_extension_versions: ['1.2.0'],
    rules: [
      {
        id: 'GENERIC_SECRET',
        label: 'Generic Secret',
        category: 'Credential',
        risk: 'high',
        color: '#f97316',
        pattern: '(?:sk|pk)-[a-z0-9]+',
      },
    ],
    signature: 'demo-signature',
  };

  const rolloutState = {
    schema_version: '1.0.0',
    artifact_type: 'rule_manifest',
    artifact_version: '2026.03.22-demo',
    rollout_stage: 'canary',
    rollout_percentage: 10,
    emergency_blocked: false,
  };

  assert.equal(sharedSchemas.validatePolicyBundle(policyBundle), null);
  assert.equal(sharedSchemas.validateAuditEvent(auditEvent), null);
  assert.equal(sharedSchemas.validateDeviceEnrollmentRequest(enrollmentRequest), null);
  assert.equal(sharedSchemas.validateRuleManifest(ruleManifest), null);
  assert.equal(sharedSchemas.validateRolloutState(rolloutState), null);
});

test('shared-schemas package rejects drift in scaffolded contracts', () => {
  assert.equal(
    sharedSchemas.validateRuleManifest({
      schema_version: '1.0.0',
      manifest_version: '2026.03.22-demo',
      published_at: '2026-03-22T10:00:00.000Z',
      compatible_extension_versions: ['1.2.0'],
      rules: [
        {
          id: 'GENERIC_SECRET',
          label: 'Generic Secret',
          category: 'Credential',
          risk: 'high',
          color: '#f97316',
          pattern: '(?:sk|pk)-[a-z0-9]+',
          extra_field: true,
        },
      ],
      signature: 'demo-signature',
    }),
    'unexpected_rule_property_extra_field'
  );

  assert.equal(
    sharedSchemas.validateRolloutState({
      schema_version: '1.0.0',
      artifact_type: 'policy_bundle',
      artifact_version: '2026.03.22-demo',
      rollout_stage: 'everywhere',
      rollout_percentage: 10,
      emergency_blocked: false,
    }),
    'invalid_rollout_stage'
  );
});
