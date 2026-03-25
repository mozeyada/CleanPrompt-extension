(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  }
  root.CLEANPROMPT_SHARED_SCHEMAS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  var VALID_ACTIONS = ['allow', 'warn', 'redact', 'justify', 'block'];
  var VALID_CONFIDENCE_BUCKETS = ['low', 'medium', 'high'];
  var VALID_PROMPT_SIZE_BUCKETS = ['small', 'medium', 'large'];
  var VALID_BROWSER_FAMILIES = ['chrome', 'edge', 'other'];
  var VALID_OS_FAMILIES = ['windows', 'macos', 'linux', 'other'];
  var VALID_RULE_FALLBACK_MODES = ['bundled_only', 'last_known_good', 'remote_only'];
  var VALID_RULE_RISKS = ['critical', 'high', 'medium', 'low'];
  var VALID_ARTIFACT_TYPES = ['policy_bundle', 'rule_manifest'];
  var VALID_ROLLOUT_STAGES = ['draft', 'canary', 'partial', 'full', 'rollback'];
  var PROHIBITED_AUDIT_FIELDS = [
    'raw_prompt',
    'raw_prompt_text',
    'prompt_text',
    'sanitized_prompt',
    'sanitized_text',
    'tokens',
    'token_map',
    'reveal_map',
    'revealed_tokens',
    'justification_text',
    'clipboard',
    'dom_html',
    'full_url',
    'url',
  ];
  var POLICY_BUNDLE_KEYS = [
    'schema_version',
    'policy_version',
    'org_id',
    'org_name',
    'team_id',
    'team_name',
    'app_scopes',
    'rules',
    'intent_rules',
    'actions',
    'justification_required',
    'ui_copy_version',
    'metadata_analytics',
    'strict_mode',
  ];
  var POLICY_RULE_KEYS = [
    'active_rule_ids',
    'bundle_version',
    'local_bundle_version',
    'total_rules',
    'remote_updates_enabled',
    'stage2_ner_enabled',
    'fallback_mode',
  ];
  var METADATA_ANALYTICS_KEYS = [
    'enabled',
    'raw_prompt_retention',
    'user_level_drilldown',
    'aggregation_thresholds',
    'rotating_actor_window_days',
  ];
  var AGGREGATION_THRESHOLD_KEYS = ['min_events', 'min_distinct_actors'];
  var POLICY_ACTION_KEYS = ['default', 'by_category'];
  var AUDIT_EVENT_KEYS = [
    'schema_version',
    'org_id',
    'org_name',
    'team_id',
    'team_name',
    'user_id',
    'device_id',
    'extension_version',
    'policy_version',
    'rules_version',
    'site',
    'action',
    'intent_label',
    'intent_confidence_bucket',
    'sensitivity_categories',
    'rule_ids',
    'count_summary',
    'prompt_size_bucket',
    'timestamp_bucket',
    'raw_text_absent',
    'rotating_actor_id',
    'strict_mode',
    'justification_required',
    'justification_provided',
  ];
  var COUNT_SUMMARY_KEYS = ['total', 'by_category', 'by_risk'];
  var DEVICE_ENROLLMENT_KEYS = [
    'schema_version',
    'enrollment_token',
    'extension_version',
    'browser_family',
    'os_family',
    'managed_device',
  ];
  var RULE_MANIFEST_KEYS = [
    'schema_version',
    'manifest_version',
    'published_at',
    'compatible_extension_versions',
    'rules',
    'signature',
  ];
  var RULE_MANIFEST_ITEM_KEYS = [
    'id',
    'label',
    'category',
    'risk',
    'color',
    'pattern',
    'flags',
  ];
  var ROLLOUT_STATE_KEYS = [
    'schema_version',
    'artifact_type',
    'artifact_version',
    'rollout_stage',
    'rollout_percentage',
    'emergency_blocked',
  ];

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function isStringArray(value) {
    return Array.isArray(value) && value.every(function(item) {
      return typeof item === 'string';
    });
  }

  function isNumberRecord(value) {
    if (!isPlainObject(value)) return false;
    return Object.keys(value).every(function(key) {
      return typeof value[key] === 'number' && Number.isFinite(value[key]);
    });
  }

  function unexpectedPropertyError(input, allowedKeys, prefix) {
    var keys = Object.keys(input || {});
    for (var i = 0; i < keys.length; i += 1) {
      if (allowedKeys.indexOf(keys[i]) === -1) {
        return prefix + keys[i];
      }
    }
    return null;
  }

  function validateActionMap(record, invalidDefaultError, invalidMapError, invalidValuePrefix) {
    if (!isPlainObject(record)) return invalidMapError;
    var unexpected = unexpectedPropertyError(record, POLICY_ACTION_KEYS, 'unexpected_property_');
    if (unexpected) return unexpected;
    if (VALID_ACTIONS.indexOf(record.default) === -1) return invalidDefaultError;
    if (!isPlainObject(record.by_category)) return invalidMapError;
    var categories = Object.keys(record.by_category);
    for (var i = 0; i < categories.length; i += 1) {
      if (VALID_ACTIONS.indexOf(record.by_category[categories[i]]) === -1) {
        return invalidValuePrefix + categories[i];
      }
    }
    return null;
  }

  function validatePolicyBundle(input) {
    if (!isPlainObject(input)) return 'invalid_policy_bundle';
    var unexpected = unexpectedPropertyError(input, POLICY_BUNDLE_KEYS, 'unexpected_property_');
    if (unexpected) return unexpected;
    if (typeof input.schema_version !== 'string') return 'invalid_policy_schema_version';
    if (typeof input.policy_version !== 'string' || !input.policy_version.trim()) return 'invalid_policy_version';
    if (typeof input.org_id !== 'string' || !input.org_id.trim()) return 'invalid_org_id';
    if (typeof input.org_name !== 'string' || !input.org_name.trim()) return 'invalid_org_name';
    if (input.team_id != null && typeof input.team_id !== 'string') return 'invalid_team_id';
    if (input.team_name != null && typeof input.team_name !== 'string') return 'invalid_team_name';
    if (input.app_scopes != null && !isStringArray(input.app_scopes)) return 'invalid_app_scopes';
    if (!isPlainObject(input.rules)) return 'invalid_rules';

    unexpected = unexpectedPropertyError(input.rules, POLICY_RULE_KEYS, 'unexpected_rule_property_');
    if (unexpected) return unexpected;
    if (!(input.rules.active_rule_ids === null || isStringArray(input.rules.active_rule_ids))) return 'invalid_active_rule_ids';
    if (typeof input.rules.bundle_version !== 'string' || !input.rules.bundle_version.trim()) return 'invalid_rules_bundle_version';
    if (input.rules.local_bundle_version != null && typeof input.rules.local_bundle_version !== 'string') return 'invalid_rules_local_bundle_version';
    if (input.rules.total_rules != null && typeof input.rules.total_rules !== 'number') return 'invalid_rules_total_rules';
    if (input.rules.remote_updates_enabled != null && typeof input.rules.remote_updates_enabled !== 'boolean') return 'invalid_rules_remote_updates_enabled';
    if (input.rules.stage2_ner_enabled != null && typeof input.rules.stage2_ner_enabled !== 'boolean') return 'invalid_rules_stage2_ner_enabled';
    if (input.rules.fallback_mode != null && VALID_RULE_FALLBACK_MODES.indexOf(input.rules.fallback_mode) === -1) return 'invalid_rules_fallback_mode';

    if (!isPlainObject(input.intent_rules)) return 'invalid_intent_rules';
    var intents = Object.keys(input.intent_rules);
    for (var i = 0; i < intents.length; i += 1) {
      if (VALID_ACTIONS.indexOf(input.intent_rules[intents[i]]) === -1) {
        return 'invalid_intent_rule_' + intents[i];
      }
    }

    var actionError = validateActionMap(
      input.actions,
      'invalid_default_action',
      'invalid_category_actions',
      'invalid_category_action_'
    );
    if (actionError) return actionError;

    if (!isStringArray(input.justification_required)) return 'invalid_justification_required';
    if (input.ui_copy_version != null && typeof input.ui_copy_version !== 'string') return 'invalid_ui_copy_version';

    if (input.metadata_analytics != null) {
      if (!isPlainObject(input.metadata_analytics)) return 'invalid_metadata_analytics';
      unexpected = unexpectedPropertyError(input.metadata_analytics, METADATA_ANALYTICS_KEYS, 'unexpected_metadata_analytics_property_');
      if (unexpected) return unexpected;
      if (typeof input.metadata_analytics.enabled !== 'boolean') return 'invalid_metadata_analytics_enabled';
      if (typeof input.metadata_analytics.raw_prompt_retention !== 'boolean') return 'invalid_metadata_analytics_raw_prompt_retention';
      if (typeof input.metadata_analytics.user_level_drilldown !== 'boolean') return 'invalid_metadata_analytics_user_level_drilldown';
      if (input.metadata_analytics.aggregation_thresholds != null) {
        if (!isPlainObject(input.metadata_analytics.aggregation_thresholds)) return 'invalid_aggregation_thresholds';
        unexpected = unexpectedPropertyError(input.metadata_analytics.aggregation_thresholds, AGGREGATION_THRESHOLD_KEYS, 'unexpected_aggregation_threshold_property_');
        if (unexpected) return unexpected;
        if (typeof input.metadata_analytics.aggregation_thresholds.min_events !== 'number') return 'invalid_aggregation_threshold_min_events';
        if (typeof input.metadata_analytics.aggregation_thresholds.min_distinct_actors !== 'number') return 'invalid_aggregation_threshold_min_distinct_actors';
      }
      if (input.metadata_analytics.rotating_actor_window_days != null && typeof input.metadata_analytics.rotating_actor_window_days !== 'number') {
        return 'invalid_rotating_actor_window_days';
      }
    }

    if (typeof input.strict_mode !== 'boolean') return 'invalid_strict_mode';
    return null;
  }

  function validateAuditEvent(input) {
    if (!isPlainObject(input)) return 'invalid_body';
    for (var i = 0; i < PROHIBITED_AUDIT_FIELDS.length; i += 1) {
      if (Object.prototype.hasOwnProperty.call(input, PROHIBITED_AUDIT_FIELDS[i])) {
        return 'prohibited_field_' + PROHIBITED_AUDIT_FIELDS[i];
      }
    }

    var unexpected = unexpectedPropertyError(input, AUDIT_EVENT_KEYS, 'unexpected_property_');
    if (unexpected) return unexpected;
    if (typeof input.schema_version !== 'string') return 'invalid_schema_version';
    if (typeof input.org_id !== 'string' || !input.org_id.trim()) return 'invalid_org_id';
    if (input.org_name != null && typeof input.org_name !== 'string') return 'invalid_org_name';
    if (input.team_id != null && typeof input.team_id !== 'string') return 'invalid_team_id';
    if (input.team_name != null && typeof input.team_name !== 'string') return 'invalid_team_name';
    if (input.user_id != null && typeof input.user_id !== 'string') return 'invalid_user_id';
    if (typeof input.device_id !== 'string' || !input.device_id.trim()) return 'invalid_device_id';
    if (typeof input.extension_version !== 'string' || !input.extension_version.trim()) return 'invalid_extension_version';
    if (input.policy_version != null && typeof input.policy_version !== 'string') return 'invalid_policy_version';
    if (input.rules_version != null && typeof input.rules_version !== 'string') return 'invalid_rules_version';
    if (typeof input.site !== 'string' || !input.site.trim()) return 'invalid_site';
    if (VALID_ACTIONS.indexOf(input.action) === -1) return 'invalid_action';
    if (typeof input.intent_label !== 'string' || !input.intent_label.trim()) return 'invalid_intent_label';
    if (VALID_CONFIDENCE_BUCKETS.indexOf(input.intent_confidence_bucket) === -1) return 'invalid_intent_confidence_bucket';
    if (!isStringArray(input.sensitivity_categories)) return 'invalid_sensitivity_categories';
    if (!isStringArray(input.rule_ids)) return 'invalid_rule_ids';
    if (!isPlainObject(input.count_summary)) return 'invalid_count_summary';
    unexpected = unexpectedPropertyError(input.count_summary, COUNT_SUMMARY_KEYS, 'unexpected_count_summary_property_');
    if (unexpected) return unexpected;
    if (typeof input.count_summary.total !== 'number' || !Number.isFinite(input.count_summary.total)) return 'invalid_count_summary_total';
    if (!isNumberRecord(input.count_summary.by_category)) return 'invalid_count_summary_by_category';
    if (!isNumberRecord(input.count_summary.by_risk)) return 'invalid_count_summary_by_risk';
    if (VALID_PROMPT_SIZE_BUCKETS.indexOf(input.prompt_size_bucket) === -1) return 'invalid_prompt_size_bucket';
    if (typeof input.timestamp_bucket !== 'string' || !input.timestamp_bucket.trim()) return 'invalid_timestamp_bucket';
    if (input.raw_text_absent !== true) return 'raw_text_absent_must_be_true';
    if (input.rotating_actor_id != null && typeof input.rotating_actor_id !== 'string') return 'invalid_rotating_actor_id';
    if (input.strict_mode != null && typeof input.strict_mode !== 'boolean') return 'invalid_strict_mode';
    if (input.justification_required != null && typeof input.justification_required !== 'boolean') return 'invalid_justification_required';
    if (input.justification_provided != null && typeof input.justification_provided !== 'boolean') return 'invalid_justification_provided';
    return null;
  }

  function validateDeviceEnrollmentRequest(input) {
    if (!isPlainObject(input)) return 'invalid_body';
    var unexpected = unexpectedPropertyError(input, DEVICE_ENROLLMENT_KEYS, 'unexpected_property_');
    if (unexpected) return unexpected;
    if (typeof input.schema_version !== 'string') return 'invalid_schema_version';
    if (typeof input.enrollment_token !== 'string' || !input.enrollment_token.trim()) return 'invalid_enrollment_token';
    if (typeof input.extension_version !== 'string' || !input.extension_version.trim()) return 'invalid_extension_version';
    if (VALID_BROWSER_FAMILIES.indexOf(input.browser_family) === -1) return 'invalid_browser_family';
    if (VALID_OS_FAMILIES.indexOf(input.os_family) === -1) return 'invalid_os_family';
    if (typeof input.managed_device !== 'boolean') return 'invalid_managed_device';
    return null;
  }

  function validateRuleManifest(input) {
    if (!isPlainObject(input)) return 'invalid_rule_manifest';
    var unexpected = unexpectedPropertyError(input, RULE_MANIFEST_KEYS, 'unexpected_property_');
    if (unexpected) return unexpected;
    if (typeof input.schema_version !== 'string') return 'invalid_schema_version';
    if (typeof input.manifest_version !== 'string' || !input.manifest_version.trim()) return 'invalid_manifest_version';
    if (typeof input.published_at !== 'string' || !input.published_at.trim()) return 'invalid_published_at';
    if (!isStringArray(input.compatible_extension_versions)) return 'invalid_compatible_extension_versions';
    if (!Array.isArray(input.rules)) return 'invalid_rules';
    if (typeof input.signature !== 'string' || !input.signature.trim()) return 'invalid_signature';

    for (var i = 0; i < input.rules.length; i += 1) {
      var rule = input.rules[i];
      if (!isPlainObject(rule)) return 'invalid_rule_item_' + i;
      unexpected = unexpectedPropertyError(rule, RULE_MANIFEST_ITEM_KEYS, 'unexpected_rule_property_');
      if (unexpected) return unexpected;
      if (typeof rule.id !== 'string' || !rule.id.trim()) return 'invalid_rule_id_' + i;
      if (typeof rule.label !== 'string' || !rule.label.trim()) return 'invalid_rule_label_' + i;
      if (typeof rule.category !== 'string' || !rule.category.trim()) return 'invalid_rule_category_' + i;
      if (VALID_RULE_RISKS.indexOf(rule.risk) === -1) return 'invalid_rule_risk_' + i;
      if (typeof rule.color !== 'string' || !rule.color.trim()) return 'invalid_rule_color_' + i;
      if (typeof rule.pattern !== 'string' || !rule.pattern.trim()) return 'invalid_rule_pattern_' + i;
      if (rule.flags != null && typeof rule.flags !== 'string') return 'invalid_rule_flags_' + i;
    }

    return null;
  }

  function validateRolloutState(input) {
    if (!isPlainObject(input)) return 'invalid_rollout_state';
    var unexpected = unexpectedPropertyError(input, ROLLOUT_STATE_KEYS, 'unexpected_property_');
    if (unexpected) return unexpected;
    if (typeof input.schema_version !== 'string') return 'invalid_schema_version';
    if (VALID_ARTIFACT_TYPES.indexOf(input.artifact_type) === -1) return 'invalid_artifact_type';
    if (typeof input.artifact_version !== 'string' || !input.artifact_version.trim()) return 'invalid_artifact_version';
    if (VALID_ROLLOUT_STAGES.indexOf(input.rollout_stage) === -1) return 'invalid_rollout_stage';
    if (typeof input.rollout_percentage !== 'number' || !Number.isFinite(input.rollout_percentage)) return 'invalid_rollout_percentage';
    if (input.rollout_percentage < 0 || input.rollout_percentage > 100) return 'invalid_rollout_percentage_range';
    if (typeof input.emergency_blocked !== 'boolean') return 'invalid_emergency_blocked';
    return null;
  }

  return {
    PROHIBITED_AUDIT_FIELDS: PROHIBITED_AUDIT_FIELDS.slice(),
    VALID_ACTIONS: VALID_ACTIONS.slice(),
    VALID_ARTIFACT_TYPES: VALID_ARTIFACT_TYPES.slice(),
    VALID_BROWSER_FAMILIES: VALID_BROWSER_FAMILIES.slice(),
    VALID_CONFIDENCE_BUCKETS: VALID_CONFIDENCE_BUCKETS.slice(),
    VALID_OS_FAMILIES: VALID_OS_FAMILIES.slice(),
    VALID_PROMPT_SIZE_BUCKETS: VALID_PROMPT_SIZE_BUCKETS.slice(),
    VALID_ROLLOUT_STAGES: VALID_ROLLOUT_STAGES.slice(),
    VALID_RULE_RISKS: VALID_RULE_RISKS.slice(),
    validateAuditEvent: validateAuditEvent,
    validateDeviceEnrollmentRequest: validateDeviceEnrollmentRequest,
    validatePolicyBundle: validatePolicyBundle,
    validateRolloutState: validateRolloutState,
    validateRuleManifest: validateRuleManifest,
  };
});
