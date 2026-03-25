var validatePolicyBundle = require('./validators').validatePolicyBundle;

/** @typedef {import('../../packages/shared-schemas/src/policy-bundle').PolicyBundle} PolicyBundle */
/** @typedef {import('./types').AdminSummary} AdminSummary */
/** @typedef {import('./types').ControlPlaneConfig} ControlPlaneConfig */
/** @typedef {import('./types').ControlPlaneState} ControlPlaneState */

/**
 * @param {ControlPlaneConfig} config
 * @returns {PolicyBundle}
 */
function createDefaultPolicyBundle(config) {
  return {
    schema_version: '1.0.0',
    policy_version: config.policyVersion,
    org_id: config.orgId,
    org_name: config.orgName,
    team_id: config.teamId,
    team_name: config.teamName,
    app_scopes: ['chatgpt.com', 'chat.openai.com', 'claude.ai', 'copilot.microsoft.com', 'gemini.google.com'],
    rules: {
      active_rule_ids: null,
      bundle_version: config.rulesVersion,
      local_bundle_version: config.rulesVersion,
      total_rules: 61,
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
    ui_copy_version: config.policyVersion,
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

/**
 * @param {ControlPlaneConfig} config
 * @returns {ControlPlaneState}
 */
function createDefaultState(config) {
  return {
    policyBundle: createDefaultPolicyBundle(config),
    auditEvents: [],
    devices: [],
    adminActions: [],
  };
}

/**
 * @param {ControlPlaneConfig} config
 * @returns {ControlPlaneState}
 */
function createDemoState(config) {
  var demoPolicy = createDefaultPolicyBundle(config);
  demoPolicy.policy_version = '2026.03.30-demo-seeded';
  demoPolicy.ui_copy_version = '2026.03.30-demo-seeded';
  demoPolicy.actions.default = 'warn';
  demoPolicy.actions.by_category.Network = 'redact';

  return {
    policyBundle: demoPolicy,
    devices: [
      {
        schema_version: '1.0.0',
        device_id: 'device-demo-001',
        org_id: config.orgId,
        policy_version: demoPolicy.policy_version,
        rules_version: demoPolicy.rules.bundle_version,
        extension_version: '1.2.0',
        browser_family: 'chrome',
        os_family: 'windows',
        managed_device: true,
        enrolled_at: '2026-03-22T08:15:00.000Z',
      },
      {
        schema_version: '1.0.0',
        device_id: 'device-demo-002',
        org_id: config.orgId,
        policy_version: demoPolicy.policy_version,
        rules_version: demoPolicy.rules.bundle_version,
        extension_version: '1.2.0',
        browser_family: 'edge',
        os_family: 'windows',
        managed_device: true,
        enrolled_at: '2026-03-22T08:32:00.000Z',
      },
      {
        schema_version: '1.0.0',
        device_id: 'device-demo-003',
        org_id: config.orgId,
        policy_version: demoPolicy.policy_version,
        rules_version: demoPolicy.rules.bundle_version,
        extension_version: '1.2.0',
        browser_family: 'chrome',
        os_family: 'macos',
        managed_device: true,
        enrolled_at: '2026-03-22T09:05:00.000Z',
      },
    ],
    auditEvents: [
      {
        received_at: '2026-03-22T08:45:00.000Z',
        event: {
          schema_version: '1.0.0',
          org_id: config.orgId,
          org_name: config.orgName,
          team_id: config.teamId,
          team_name: config.teamName,
          device_id: 'device-demo-001',
          extension_version: '1.2.0',
          policy_version: demoPolicy.policy_version,
          rules_version: demoPolicy.rules.bundle_version,
          site: 'chatgpt.com',
          action: 'redact',
          intent_label: 'log_analysis',
          intent_confidence_bucket: 'medium',
          sensitivity_categories: ['Network', 'Credential'],
          rule_ids: ['IPV4', 'GENERIC_SECRET'],
          count_summary: {
            total: 2,
            by_category: { Network: 1, Credential: 1 },
            by_risk: { high: 1, medium: 1 },
          },
          prompt_size_bucket: 'medium',
          rotating_actor_id: 'actor-demo-2026-03',
          strict_mode: false,
          raw_text_absent: true,
          justification_required: false,
          justification_provided: false,
          timestamp_bucket: '2026-03-22T08:00:00.000Z',
        },
      },
      {
        received_at: '2026-03-22T09:12:00.000Z',
        event: {
          schema_version: '1.0.0',
          org_id: config.orgId,
          org_name: config.orgName,
          team_id: config.teamId,
          team_name: config.teamName,
          device_id: 'device-demo-002',
          extension_version: '1.2.0',
          policy_version: demoPolicy.policy_version,
          rules_version: demoPolicy.rules.bundle_version,
          site: 'claude.ai',
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
          prompt_size_bucket: 'medium',
          rotating_actor_id: 'actor-demo-2026-03',
          strict_mode: false,
          raw_text_absent: true,
          justification_required: true,
          justification_provided: true,
          timestamp_bucket: '2026-03-22T09:00:00.000Z',
        },
      },
      {
        received_at: '2026-03-22T09:40:00.000Z',
        event: {
          schema_version: '1.0.0',
          org_id: config.orgId,
          org_name: config.orgName,
          team_id: config.teamId,
          team_name: config.teamName,
          device_id: 'device-demo-003',
          extension_version: '1.2.0',
          policy_version: demoPolicy.policy_version,
          rules_version: demoPolicy.rules.bundle_version,
          site: 'copilot.microsoft.com',
          action: 'block',
          intent_label: 'reporting',
          intent_confidence_bucket: 'high',
          sensitivity_categories: ['Financial'],
          rule_ids: ['CREDIT_CARD'],
          count_summary: {
            total: 1,
            by_category: { Financial: 1 },
            by_risk: { critical: 1 },
          },
          prompt_size_bucket: 'small',
          rotating_actor_id: 'actor-demo-2026-03',
          strict_mode: false,
          raw_text_absent: true,
          justification_required: false,
          justification_provided: false,
          timestamp_bucket: '2026-03-22T09:00:00.000Z',
        },
      },
    ],
    adminActions: [
      {
        ts: '2026-03-22T08:05:00.000Z',
        action_type: 'demo_seed',
        actor: 'local_admin',
        policy_version: demoPolicy.policy_version,
        rules_version: demoPolicy.rules.bundle_version,
        metadata_only: true,
        details: {
          seeded_devices: 3,
          seeded_events: 3,
        },
      },
    ],
  };
}

/**
 * @param {Record<string, number>} target
 * @param {string | undefined | null} key
 * @returns {void}
 */
function incrementCount(target, key) {
  if (!key) return;
  target[key] = (target[key] || 0) + 1;
}

/**
 * @param {ControlPlaneState} state
 * @returns {AdminSummary}
 */
function buildAdminSummary(state) {
  var actionCounts = /** @type {Record<string, number>} */ ({});
  var categoryCounts = /** @type {Record<string, number>} */ ({});
  var intentCounts = /** @type {Record<string, number>} */ ({});
  var deviceVersionCounts = /** @type {Record<string, number>} */ ({});
  var browserCounts = /** @type {Record<string, number>} */ ({});
  var latestEventAt = null;
  var latestEnrollmentAt = null;

  (state.auditEvents || []).forEach(function(entry) {
    var event = entry && entry.event ? entry.event : null;
    if (!event) return;

    incrementCount(actionCounts, event.action || 'unknown');
    incrementCount(intentCounts, event.intent_label || 'unknown');

    (event.sensitivity_categories || []).forEach(function(category) {
      incrementCount(categoryCounts, category);
    });

    var eventTs = entry.received_at || event.timestamp_bucket || null;
    if (eventTs && (!latestEventAt || eventTs > latestEventAt)) {
      latestEventAt = eventTs;
    }
  });

  (state.devices || []).forEach(function(device) {
    incrementCount(deviceVersionCounts, device && device.extension_version || 'unknown');
    incrementCount(browserCounts, device && device.browser_family || 'other');
    if (device && device.enrolled_at && (!latestEnrollmentAt || device.enrolled_at > latestEnrollmentAt)) {
      latestEnrollmentAt = device.enrolled_at;
    }
  });

  return {
    generated_at: new Date().toISOString(),
    org_id: state.policyBundle && state.policyBundle.org_id || null,
    org_name: state.policyBundle && state.policyBundle.org_name || null,
    policy_version: state.policyBundle && state.policyBundle.policy_version || null,
    rules_version: state.policyBundle && state.policyBundle.rules && state.policyBundle.rules.bundle_version || null,
    device_count: (state.devices || []).length,
    audit_event_count: (state.auditEvents || []).length,
    action_counts: actionCounts,
    category_counts: categoryCounts,
    intent_counts: intentCounts,
    device_version_counts: deviceVersionCounts,
    browser_counts: browserCounts,
    latest_event_at: latestEventAt,
    latest_enrollment_at: latestEnrollmentAt,
    metadata_only: true,
    raw_prompt_retention: false,
  };
}

/**
 * @param {ControlPlaneConfig} config
 * @param {ControlPlaneState | null | undefined} snapshot
 * @returns {ControlPlaneState}
 */
function normalizeState(config, snapshot) {
  var fallback = createDefaultState(config);
  if (!snapshot || typeof snapshot !== 'object') return fallback;

  var nextState = {
    policyBundle: snapshot.policyBundle || fallback.policyBundle,
    auditEvents: Array.isArray(snapshot.auditEvents) ? snapshot.auditEvents : fallback.auditEvents,
    devices: Array.isArray(snapshot.devices) ? snapshot.devices : fallback.devices,
    adminActions: Array.isArray(snapshot.adminActions) ? snapshot.adminActions : fallback.adminActions,
  };

  if (validatePolicyBundle(nextState.policyBundle)) {
    nextState.policyBundle = fallback.policyBundle;
  }

  return nextState;
}

module.exports = {
  buildAdminSummary,
  createDemoState,
  createDefaultPolicyBundle,
  createDefaultState,
  normalizeState,
};
