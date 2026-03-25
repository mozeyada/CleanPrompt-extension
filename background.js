/**
 * CleanPrompt Background Service Worker (MV3)
 * Handles: local policy bundle, metadata-safe audit events, and bundled rule status.
 */

/** @typedef {import('./packages/shared-schemas/src/audit-event').AuditEvent} AuditEvent */
/** @typedef {import('./packages/shared-schemas/src/policy-bundle').PolicyBundle} PolicyBundle */
/** @typedef {import('./packages/shared-schemas/src/device-enrollment').DeviceEnrollmentRequest} DeviceEnrollmentRequest */
/** @typedef {import('./types/extension-runtime').EnrollmentRecord} EnrollmentRecord */
/** @typedef {import('./types/extension-runtime').LocalSettings} LocalSettings */
/** @typedef {import('./types/extension-runtime').PlatformHealthReport} PlatformHealthReport */
/** @typedef {import('./types/extension-runtime').SharedSchemaRuntime} SharedSchemaRuntime */
/** @typedef {import('./types/extension-runtime').StatusResult} StatusResult */
/** @typedef {import('./types/extension-runtime').UploadDecisionBlocked} UploadDecisionBlocked */
/** @typedef {import('./types/extension-runtime').UploadDecision} UploadDecision */

var BUNDLED_RULES_VERSION = '1.2.0-local';
var POLICY_BUNDLE_SCHEMA_VERSION = '1.0.0';
var AUDIT_EVENT_SCHEMA_VERSION = '1.0.0';
var DEVICE_ENROLLMENT_SCHEMA_VERSION = '1.0.0';
var EXTENSION_VERSION = chrome.runtime.getManifest().version;
var POLICY_SYNC_ALARM_NAME = 'cleanprompt-policy-sync';
var SHARED_SCHEMA_RUNTIME = loadSharedSchemaRuntime();
var ALLOWED_AUDIT_UPLOAD_FIELDS = [
  'schema_version',
  'org_id',
  'org_name',
  'team_id',
  'team_name',
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
  'rotating_actor_id',
  'strict_mode',
  'raw_text_absent',
  'justification_required',
  'justification_provided',
  'timestamp_bucket',
];

/** @returns {SharedSchemaRuntime | null} */
function loadSharedSchemaRuntime() {
  try {
    if (globalThis.CLEANPROMPT_SHARED_SCHEMAS) {
      return globalThis.CLEANPROMPT_SHARED_SCHEMAS;
    }
    if (typeof importScripts === 'function') {
      importScripts('packages/shared-schemas/src/runtime.js');
      if (globalThis.CLEANPROMPT_SHARED_SCHEMAS) {
        return globalThis.CLEANPROMPT_SHARED_SCHEMAS;
      }
    }
  } catch (error) {
    return globalThis.CLEANPROMPT_SHARED_SCHEMAS || null;
  }
  return null;
}

/**
 * @param {PolicyBundle} policyBundle
 * @returns {string | null}
 */
function validatePolicyBundleWithSharedSchema(policyBundle) {
  if (!SHARED_SCHEMA_RUNTIME || typeof SHARED_SCHEMA_RUNTIME.validatePolicyBundle !== 'function') {
    return null;
  }
  return SHARED_SCHEMA_RUNTIME.validatePolicyBundle(policyBundle);
}

/**
 * @param {AuditEvent} eventSummary
 * @returns {string | null}
 */
function validateAuditEventWithSharedSchema(eventSummary) {
  if (!SHARED_SCHEMA_RUNTIME || typeof SHARED_SCHEMA_RUNTIME.validateAuditEvent !== 'function') {
    return null;
  }
  return SHARED_SCHEMA_RUNTIME.validateAuditEvent(eventSummary);
}

/** @returns {string} */
function createLocalDeviceId() {
  return 'device-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}

/** @returns {PolicyBundle} */
function createDefaultPolicyBundle() {
  return {
    schema_version: '1.0.0',
    policy_version: '2026.03.18-local',
    org_id: 'org_acme_msp',
    org_name: 'Acme Managed Services',
    team_id: 'helpdesk',
    team_name: 'Helpdesk',
    app_scopes: ['chatgpt.com', 'chat.openai.com', 'claude.ai', 'copilot.microsoft.com', 'gemini.google.com'],
    rules: {
      active_rule_ids: null,
      bundle_version: BUNDLED_RULES_VERSION,
      local_bundle_version: BUNDLED_RULES_VERSION,
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
    ui_copy_version: '2026.03.18',
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

/** @returns {LocalSettings} */
function createDefaultSettings() {
  return {
    logclean_enabled: true,
    logclean_intercept_enabled: true,
    logclean_plan: 'managed-demo',
    logclean_rules_version: BUNDLED_RULES_VERSION,
    logclean_rules_override: null,
    logclean_audit_log: [],
    logclean_device_events: [],
    logclean_training_signals: [],
    logclean_actor_seed: 'actor-' + Math.random().toString(36).slice(2, 10),
    logclean_device_id: createLocalDeviceId(),
    logclean_policy_sync_enabled: false,
    logclean_control_plane_base_url: 'http://127.0.0.1:8787',
    logclean_enrollment_token: 'enroll-demo-token',
    logclean_device_enrollment: null,
    logclean_last_enrollment_result: null,
    logclean_last_sync_result: null,
    logclean_last_audit_upload_result: null,
    logclean_platform_health: {},
    logclean_policy_bundle: createDefaultPolicyBundle(),
  };
}

/**
 * @param {Partial<PolicyBundle> | null | undefined} policyBundle
 * @returns {PolicyBundle}
 */
function ensurePolicyBundleShape(policyBundle) {
  var defaultPolicy = createDefaultPolicyBundle();
  var bundle = /** @type {Partial<PolicyBundle>} */ (Object.assign({}, policyBundle || {}));
  var sourceRules = /** @type {Partial<PolicyBundle['rules']>} */ (bundle.rules || {});
  var rules = Object.assign({}, defaultPolicy.rules, sourceRules);

  if (!sourceRules.bundle_version) {
    rules.bundle_version = sourceRules.local_bundle_version || rules.bundle_version || defaultPolicy.rules.bundle_version;
  }
  if (!sourceRules.local_bundle_version) {
    rules.local_bundle_version = rules.bundle_version;
  }

  return Object.assign({}, defaultPolicy, bundle, {
    schema_version: bundle.schema_version || POLICY_BUNDLE_SCHEMA_VERSION,
    rules: rules,
  });
}

/**
 * @param {Partial<LocalSettings>} existing
 * @returns {Partial<LocalSettings>}
 */
function buildSettingsUpgradePatch(existing) {
  var defaults = createDefaultSettings();
  var patch = {};
  var currentPolicy = existing.logclean_policy_bundle || null;
  var normalizedPolicy = ensurePolicyBundleShape(currentPolicy);

  if (!existing.logclean_device_id) patch.logclean_device_id = defaults.logclean_device_id;
  if (!existing.logclean_actor_seed) patch.logclean_actor_seed = defaults.logclean_actor_seed;
  if (!existing.logclean_rules_version) patch.logclean_rules_version = defaults.logclean_rules_version;
  if (!existing.logclean_plan) patch.logclean_plan = defaults.logclean_plan;
  if (typeof existing.logclean_policy_sync_enabled !== 'boolean') patch.logclean_policy_sync_enabled = defaults.logclean_policy_sync_enabled;
  if (!existing.logclean_control_plane_base_url) patch.logclean_control_plane_base_url = defaults.logclean_control_plane_base_url;
  if (!existing.logclean_enrollment_token) patch.logclean_enrollment_token = defaults.logclean_enrollment_token;
  if (!existing.logclean_last_audit_upload_result) patch.logclean_last_audit_upload_result = defaults.logclean_last_audit_upload_result;
  if (!existing.logclean_platform_health || typeof existing.logclean_platform_health !== 'object') {
    patch.logclean_platform_health = defaults.logclean_platform_health;
  }
  if (!currentPolicy || JSON.stringify(currentPolicy) !== JSON.stringify(normalizedPolicy)) {
    patch.logclean_policy_bundle = normalizedPolicy;
  }

  return patch;
}

/**
 * @param {string} seed
 * @returns {string}
 */
function getRotatingActorId(seed) {
  var now = new Date();
  var bucket = now.getUTCFullYear() + '-' + String(now.getUTCMonth() + 1).padStart(2, '0');
  return seed + '-' + bucket;
}

/**
 * @param {AuditEvent} eventSummary
 * @returns {import('./types/extension-runtime').TrainingSignal[]}
 */
function appendTrainingSignal(eventSummary) {
  var signals = [];
  if (eventSummary.action === 'justify') {
    signals.push({
      ts: new Date().toISOString(),
      type: 'justification',
      intent_label: eventSummary.intent_label,
      categories: eventSummary.sensitivity_categories,
    });
  }
  if ((eventSummary.count_summary && eventSummary.count_summary.total || 0) >= 5) {
    signals.push({
      ts: new Date().toISOString(),
      type: 'high_redaction_volume',
      intent_label: eventSummary.intent_label,
      categories: eventSummary.sensitivity_categories,
    });
  }
  return signals;
}

/** @returns {void} */
function setSyncAlarm() {
  chrome.alarms.create(POLICY_SYNC_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: 15,
  });
}

/**
 * @param {string} status
 * @param {Partial<StatusResult>} [extra]
 * @returns {StatusResult}
 */
function buildSyncResult(status, extra) {
  return Object.assign({
    status: status,
    ts: new Date().toISOString(),
  }, extra || {});
}

/**
 * @param {string | undefined} userAgent
 * @returns {DeviceEnrollmentRequest['browser_family']}
 */
function inferBrowserFamily(userAgent) {
  var ua = (userAgent || '').toLowerCase();
  if (ua.indexOf('edg/') !== -1) return 'edge';
  if (ua.indexOf('chrome/') !== -1) return 'chrome';
  return 'other';
}

/**
 * @param {string | undefined} userAgent
 * @returns {DeviceEnrollmentRequest['os_family']}
 */
function inferOsFamily(userAgent) {
  var ua = (userAgent || '').toLowerCase();
  if (ua.indexOf('win') !== -1) return 'windows';
  if (ua.indexOf('mac os') !== -1 || ua.indexOf('macintosh') !== -1) return 'macos';
  if (ua.indexOf('linux') !== -1) return 'linux';
  return 'other';
}

/**
 * @param {string} status
 * @param {Partial<StatusResult>} [extra]
 * @returns {StatusResult}
 */
function buildEnrollmentResult(status, extra) {
  return Object.assign({
    status: status,
    ts: new Date().toISOString(),
  }, extra || {});
}

/**
 * @param {string} status
 * @param {Partial<StatusResult>} [extra]
 * @returns {StatusResult}
 */
function buildAuditUploadResult(status, extra) {
  return Object.assign({
    status: status,
    ts: new Date().toISOString(),
  }, extra || {});
}

/**
 * @param {Partial<PlatformHealthReport> | null | undefined} report
 * @returns {PlatformHealthReport}
 */
function normalizePlatformHealthReport(report) {
  var source = report || {};
  return {
    host: source.host || 'unknown',
    platform_key: source.platform_key || 'unknown',
    platform_name: source.platform_name || 'Unknown',
    input_detected: Boolean(source.input_detected),
    toolbar_detected: Boolean(source.toolbar_detected),
    send_button_detected: Boolean(source.send_button_detected),
    trigger_attached: Boolean(source.trigger_attached),
    sidebar_ready: Boolean(source.sidebar_ready),
    detection_reason: source.detection_reason || 'runtime',
    input_selector: source.input_selector || null,
    input_selector_rank: source.input_selector_rank || null,
    toolbar_strategy: source.toolbar_strategy || null,
    send_selector: source.send_selector || null,
    send_selector_rank: source.send_selector_rank || null,
    attachment_container_tag: source.attachment_container_tag || null,
    compatibility_confidence: source.compatibility_confidence || 'needs_review',
    ts: source.ts || new Date().toISOString(),
  };
}

/**
 * @param {Partial<PlatformHealthReport> | null | undefined} report
 * @returns {Promise<PlatformHealthReport>}
 */
function updatePlatformHealthReport(report) {
  var normalized = normalizePlatformHealthReport(report);
  return readLocalStorage(['logclean_platform_health']).then(function(data) {
    var current = data.logclean_platform_health || {};
    var next = Object.assign({}, current, {});
    next[normalized.host] = normalized;

    return writeLocalStorage({
      logclean_platform_health: next,
    }).then(function() {
      return normalized;
    });
  });
}

/**
 * @param {null | string | string[] | Record<string, unknown>} keys
 * @returns {Promise<Record<string, any>>}
 */
function readLocalStorage(keys) {
  return new Promise(function(resolve) {
    chrome.storage.local.get(keys, function(data) {
      resolve(data || {});
    });
  });
}

/**
 * @param {object} patch
 * @returns {Promise<void>}
 */
function writeLocalStorage(patch) {
  return new Promise(function(resolve) {
    chrome.storage.local.set(patch, function() {
      resolve();
    });
  });
}

/**
 * @param {Partial<LocalSettings>} existing
 * @param {LocalSettings} defaults
 * @returns {Pick<LocalSettings, 'logclean_control_plane_base_url' | 'logclean_enrollment_token'>}
 */
function snapshotManagedConnection(existing, defaults) {
  return {
    logclean_control_plane_base_url: existing.logclean_control_plane_base_url || defaults.logclean_control_plane_base_url,
    logclean_enrollment_token: existing.logclean_enrollment_token || defaults.logclean_enrollment_token,
  };
}

/**
 * @param {{ preserveManagedConfig?: boolean, enableManagedSync?: boolean } | undefined} options
 * @returns {Promise<{ ok: true, sync_enabled: boolean, control_plane_base_url: string }>}
 */
function resetExtensionDemoState(options) {
  options = options || {};

  return readLocalStorage(null).then(function(existing) {
    var defaults = createDefaultSettings();
    var patch = Object.assign({}, defaults, {
      logclean_policy_sync_enabled: Boolean(options.enableManagedSync),
      logclean_device_enrollment: null,
      logclean_last_enrollment_result: null,
      logclean_last_sync_result: null,
      logclean_last_audit_upload_result: null,
      logclean_rules_override: null,
      logclean_active_rules: null,
    });

    if (options.preserveManagedConfig !== false) {
      Object.assign(patch, snapshotManagedConnection(existing || {}, defaults));
    }

    return writeLocalStorage(patch).then(function() {
      return {
        ok: true,
        sync_enabled: Boolean(patch.logclean_policy_sync_enabled),
        control_plane_base_url: patch.logclean_control_plane_base_url,
      };
    });
  });
}

/**
 * @returns {Promise<{ ok: boolean, step: string, reason?: string, device_id?: string | null, policy_version?: string | null, control_plane_base_url?: string }>}
 */
async function prepareManagedDemoState() {
  var resetResult = await resetExtensionDemoState({
    preserveManagedConfig: true,
    enableManagedSync: true,
  });
  var enrollmentResult = await enrollDeviceWithControlPlane();

  if (!enrollmentResult.ok) {
    return {
      ok: false,
      step: 'enrollment',
      reason: enrollmentResult.reason || 'enrollment_failed',
      control_plane_base_url: resetResult.control_plane_base_url,
    };
  }

  var syncResult = await syncPolicyBundleFromControlPlane();
  if (!syncResult.ok) {
    return {
      ok: false,
      step: 'policy_sync',
      reason: syncResult.reason || 'sync_failed',
      control_plane_base_url: resetResult.control_plane_base_url,
    };
  }

  return {
    ok: true,
    step: 'ready',
    device_id: enrollmentResult.enrollment && enrollmentResult.enrollment.device_id || null,
    policy_version: syncResult.policy && syncResult.policy.policy_version || null,
    control_plane_base_url: resetResult.control_plane_base_url,
  };
}

/**
 * @param {PolicyBundle | null | undefined} policyBundle
 * @param {boolean} syncEnabled
 * @returns {UploadDecision}
 */
function shouldUploadAuditEvent(policyBundle, syncEnabled) {
  var policy = ensurePolicyBundleShape(policyBundle || createDefaultPolicyBundle());
  if (!syncEnabled) return { allowed: false, reason: 'sync_disabled' };
  if (policy.strict_mode) return { allowed: false, reason: 'strict_mode' };
  if (!policy.metadata_analytics || policy.metadata_analytics.enabled === false) {
    return { allowed: false, reason: 'metadata_analytics_disabled' };
  }
  return { allowed: true, policy: policy };
}

/**
 * @param {AuditEvent | null | undefined} eventSummary
 * @param {PolicyBundle} policy
 * @param {EnrollmentRecord | null | undefined} enrollment
 * @returns {AuditEvent}
 */
function sanitizeAuditEventForUpload(eventSummary, policy, enrollment) {
  var payload = /** @type {Partial<AuditEvent>} */ ({});
  var source = eventSummary || {};

  ALLOWED_AUDIT_UPLOAD_FIELDS.forEach(function(field) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      payload[field] = source[field];
    }
  });

  payload.schema_version = payload.schema_version || '1.0.0';
  payload.device_id = enrollment && enrollment.device_id || payload.device_id;
  payload.org_id = payload.org_id || policy.org_id;
  payload.org_name = payload.org_name || policy.org_name;
  payload.team_id = payload.team_id || policy.team_id;
  payload.team_name = payload.team_name || policy.team_name;
  payload.policy_version = payload.policy_version || policy.policy_version;
  payload.rules_version = payload.rules_version || policy.rules.bundle_version;
  payload.raw_text_absent = true;

  return /** @type {AuditEvent} */ (payload);
}

/**
 * @returns {Promise<{ ok: boolean, reason?: string, code?: number, enrollment?: EnrollmentRecord }>}
 */
function enrollDeviceWithControlPlane() {
  return new Promise(function(resolve) {
    chrome.storage.local.get([
      'logclean_control_plane_base_url',
      'logclean_enrollment_token',
      'logclean_device_id',
      'logclean_device_enrollment',
    ], async function(data) {
      var baseUrl = (data.logclean_control_plane_base_url || 'http://127.0.0.1:8787').replace(/\/+$/, '');
      var endpoint = baseUrl + '/api/device-enrollment';
      var enrollmentToken = data.logclean_enrollment_token || '';

      if (!enrollmentToken) {
        chrome.storage.local.set({
          logclean_last_enrollment_result: buildEnrollmentResult('missing_enrollment_token', {
            endpoint: endpoint,
          }),
        }, function() {
          resolve({ ok: false, reason: 'missing_enrollment_token' });
        });
        return;
      }

      try {
        var response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
          },
          body: JSON.stringify({
            schema_version: DEVICE_ENROLLMENT_SCHEMA_VERSION,
            enrollment_token: enrollmentToken,
            extension_version: EXTENSION_VERSION,
            browser_family: inferBrowserFamily(typeof navigator !== 'undefined' ? navigator.userAgent : ''),
            os_family: inferOsFamily(typeof navigator !== 'undefined' ? navigator.userAgent : ''),
            managed_device: true,
          }),
        });

        if (!response.ok) {
          chrome.storage.local.set({
            logclean_last_enrollment_result: buildEnrollmentResult('http_error', {
              endpoint: endpoint,
              code: response.status,
            }),
          }, function() {
            resolve({ ok: false, reason: 'http_error', code: response.status });
          });
          return;
        }

        var payload = /** @type {{ schema_version?: string, device_id?: string, org_id?: string | null, policy_version?: string | null, rules_version?: string | null }} */ (await response.json());
        var enrollment = /** @type {EnrollmentRecord} */ ({
          schema_version: payload.schema_version || DEVICE_ENROLLMENT_SCHEMA_VERSION,
          device_id: payload.device_id || data.logclean_device_id || createLocalDeviceId(),
          org_id: payload.org_id || null,
          policy_version: payload.policy_version || null,
          rules_version: payload.rules_version || null,
          enrolled_at: new Date().toISOString(),
        });

        chrome.storage.local.set({
          logclean_device_id: enrollment.device_id,
          logclean_device_enrollment: enrollment,
          logclean_last_enrollment_result: buildEnrollmentResult('ok', {
            endpoint: endpoint,
            device_id: enrollment.device_id,
          }),
        }, function() {
          resolve({ ok: true, enrollment: enrollment });
        });
      } catch (error) {
        chrome.storage.local.set({
          logclean_last_enrollment_result: buildEnrollmentResult('network_error', {
            endpoint: endpoint,
            message: error && error.message ? error.message : 'unknown_error',
          }),
        }, function() {
          resolve({ ok: false, reason: 'network_error' });
        });
      }
    });
  });
}

/**
 * @returns {Promise<{ ok: boolean, reason?: string, code?: number, error?: string, enrollment_reason?: string, policy?: PolicyBundle }>}
 */
function syncPolicyBundleFromControlPlane() {
  return new Promise(function(resolve) {
    chrome.storage.local.get([
      'logclean_policy_sync_enabled',
      'logclean_control_plane_base_url',
      'logclean_policy_bundle',
      'logclean_device_enrollment',
    ], async function(data) {
      if (!data.logclean_policy_sync_enabled) {
        resolve({ ok: false, reason: 'sync_disabled' });
        return;
      }

      var enrollment = data.logclean_device_enrollment || null;
      if (!enrollment || !enrollment.device_id) {
        var enrollmentResult = await enrollDeviceWithControlPlane();
        if (!enrollmentResult.ok) {
          resolve({ ok: false, reason: 'enrollment_required', enrollment_reason: enrollmentResult.reason });
          return;
        }
        enrollment = enrollmentResult.enrollment;
      }

      var baseUrl = (data.logclean_control_plane_base_url || 'http://127.0.0.1:8787').replace(/\/+$/, '');
      var endpoint = baseUrl + '/api/policies/default';

      try {
        var response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
          },
        });

        if (!response.ok) {
          var failedResult = buildSyncResult('http_error', {
            code: response.status,
            endpoint: endpoint,
          });
          chrome.storage.local.set({ logclean_last_sync_result: failedResult });
          resolve({ ok: false, reason: 'http_error', code: response.status });
          return;
        }

        var payload = /** @type {{ policy?: Partial<PolicyBundle> | null }} */ (await response.json());
        var incomingPolicy = payload && payload.policy ? payload.policy : null;
        if (!incomingPolicy) {
          var invalidResult = buildSyncResult('invalid_payload', {
            endpoint: endpoint,
          });
          chrome.storage.local.set({ logclean_last_sync_result: invalidResult });
          resolve({ ok: false, reason: 'invalid_payload' });
          return;
        }

        var normalizedPolicy = ensurePolicyBundleShape(incomingPolicy);
        var policyValidationError = validatePolicyBundleWithSharedSchema(normalizedPolicy);
        if (policyValidationError) {
          var invalidPolicyResult = buildSyncResult('invalid_policy_bundle', {
            endpoint: endpoint,
            validation_error: policyValidationError,
          });
          chrome.storage.local.set({ logclean_last_sync_result: invalidPolicyResult });
          resolve({ ok: false, reason: 'invalid_policy_bundle', error: policyValidationError });
          return;
        }

        chrome.storage.local.set({
          logclean_policy_bundle: normalizedPolicy,
          logclean_last_sync_result: buildSyncResult('ok', {
            endpoint: endpoint,
            device_id: enrollment.device_id,
            policy_version: normalizedPolicy.policy_version,
          }),
        }, function() {
          resolve({ ok: true, policy: normalizedPolicy });
        });
      } catch (error) {
        chrome.storage.local.set({
          logclean_last_sync_result: buildSyncResult('network_error', {
            endpoint: endpoint,
            message: error && error.message ? error.message : 'unknown_error',
          }),
        }, function() {
          resolve({ ok: false, reason: 'network_error' });
        });
      }
    });
  });
}

/**
 * @param {AuditEvent} eventSummary
 * @returns {Promise<{ ok: boolean, reason?: string, code?: number, error?: string, enrollment_reason?: string }>}
 */
function uploadAuditEventToControlPlane(eventSummary) {
  return new Promise(function(resolve) {
    chrome.storage.local.get([
      'logclean_policy_sync_enabled',
      'logclean_control_plane_base_url',
      'logclean_device_enrollment',
      'logclean_policy_bundle',
    ], async function(data) {
      var uploadDecision = shouldUploadAuditEvent(data.logclean_policy_bundle, data.logclean_policy_sync_enabled);
      if (!uploadDecision.allowed) {
        var blockedDecision = /** @type {UploadDecisionBlocked} */ (uploadDecision);
        chrome.storage.local.set({
          logclean_last_audit_upload_result: buildAuditUploadResult(blockedDecision.reason, {
            device_id: eventSummary && eventSummary.device_id || null,
          }),
        }, function() {
          resolve({ ok: false, reason: blockedDecision.reason });
        });
        return;
      }

      var enrollment = data.logclean_device_enrollment || null;
      if (!enrollment || !enrollment.device_id) {
        var enrollmentResult = await enrollDeviceWithControlPlane();
        if (!enrollmentResult.ok) {
          chrome.storage.local.set({
            logclean_last_audit_upload_result: buildAuditUploadResult('enrollment_required', {
              device_id: eventSummary && eventSummary.device_id || null,
              enrollment_reason: enrollmentResult.reason,
            }),
          }, function() {
            resolve({ ok: false, reason: 'enrollment_required', enrollment_reason: enrollmentResult.reason });
          });
          return;
        }
        enrollment = enrollmentResult.enrollment;
      }

      var baseUrl = (data.logclean_control_plane_base_url || 'http://127.0.0.1:8787').replace(/\/+$/, '');
      var endpoint = baseUrl + '/api/audit/events';
      var payload = sanitizeAuditEventForUpload(eventSummary, uploadDecision.policy, enrollment);
      var payloadValidationError = validateAuditEventWithSharedSchema(payload);
      if (payloadValidationError) {
        chrome.storage.local.set({
          logclean_last_audit_upload_result: buildAuditUploadResult('invalid_payload', {
            endpoint: endpoint,
            device_id: payload.device_id,
            validation_error: payloadValidationError,
          }),
        }, function() {
          resolve({ ok: false, reason: 'invalid_payload', error: payloadValidationError });
        });
        return;
      }

      try {
        var response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          chrome.storage.local.set({
            logclean_last_audit_upload_result: buildAuditUploadResult('http_error', {
              endpoint: endpoint,
              code: response.status,
              device_id: payload.device_id,
            }),
          }, function() {
            resolve({ ok: false, reason: 'http_error', code: response.status });
          });
          return;
        }

        chrome.storage.local.set({
          logclean_last_audit_upload_result: buildAuditUploadResult('ok', {
            endpoint: endpoint,
            device_id: payload.device_id,
            action: payload.action,
            site: payload.site,
          }),
        }, function() {
          resolve({ ok: true });
        });
      } catch (error) {
        chrome.storage.local.set({
          logclean_last_audit_upload_result: buildAuditUploadResult('network_error', {
            endpoint: endpoint,
            device_id: payload.device_id,
            message: error && error.message ? error.message : 'unknown_error',
          }),
        }, function() {
          resolve({ ok: false, reason: 'network_error' });
        });
      }
    });
  });
}

chrome.runtime.onInstalled.addListener(function(details) {
  setSyncAlarm();
  if (details.reason === 'install') {
    chrome.storage.local.set(createDefaultSettings());
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') + '?welcome=true' });
  } else {
    chrome.storage.local.get(null, function(existing) {
      var patch = buildSettingsUpgradePatch(existing || {});
      if (Object.keys(patch).length > 0) {
        chrome.storage.local.set(patch);
      }
    });
  }
});

chrome.runtime.onStartup.addListener(function() {
  setSyncAlarm();
  chrome.storage.local.get(null, function(data) {
    if (!data || !data.logclean_policy_bundle) {
      chrome.storage.local.set(createDefaultSettings());
      return;
    }

    var patch = buildSettingsUpgradePatch(data);
    if (Object.keys(patch).length > 0) {
      chrome.storage.local.set(patch);
    }
  });
  syncPolicyBundleFromControlPlane();
});

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (!alarm || alarm.name !== POLICY_SYNC_ALARM_NAME) return;
  syncPolicyBundleFromControlPlane();
});

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === 'GET_SETTINGS') {
    readLocalStorage([
      'logclean_enabled',
      'logclean_plan',
      'logclean_intercept_enabled',
      'logclean_rules_version',
      'logclean_policy_bundle',
      'logclean_actor_seed',
      'logclean_device_id',
      'logclean_policy_sync_enabled',
      'logclean_control_plane_base_url',
      'logclean_enrollment_token',
      'logclean_device_enrollment',
      'logclean_last_enrollment_result',
      'logclean_last_sync_result',
      'logclean_last_audit_upload_result',
      'logclean_platform_health',
    ]).then(function(result) {
      result.logclean_policy_bundle = ensurePolicyBundleShape(result.logclean_policy_bundle || createDefaultPolicyBundle());
      result.rotating_actor_id = getRotatingActorId(result.logclean_actor_seed || 'actor-local');
      result.extension_version = EXTENSION_VERSION;
      result.device_id = result.logclean_device_id || createLocalDeviceId();
      result.policy_version = result.logclean_policy_bundle.policy_version || null;
      result.rules_version = result.logclean_rules_version || BUNDLED_RULES_VERSION;
      sendResponse(result);
    });
    return true;
  }

  if (msg.type === 'ENROLL_DEVICE_NOW') {
    enrollDeviceWithControlPlane().then(function(result) {
      sendResponse(result);
    });
    return true;
  }

  if (msg.type === 'SYNC_POLICY_NOW') {
    syncPolicyBundleFromControlPlane().then(function(result) {
      sendResponse(result);
    });
    return true;
  }

  if (msg.type === 'RESET_EXTENSION_DEMO_STATE') {
    resetExtensionDemoState({
      preserveManagedConfig: msg.preserve_managed_config !== false,
      enableManagedSync: Boolean(msg.enable_managed_sync),
    }).then(function(result) {
      sendResponse(result);
    });
    return true;
  }

  if (msg.type === 'PREPARE_MANAGED_DEMO') {
    prepareManagedDemoState().then(function(result) {
      sendResponse(result);
    });
    return true;
  }

  if (msg.type === 'GET_CURRENT_POLICY') {
    chrome.storage.local.get(['logclean_policy_bundle'], function(result) {
      var policy = ensurePolicyBundleShape(result.logclean_policy_bundle || createDefaultPolicyBundle());
      var validationError = validatePolicyBundleWithSharedSchema(policy);
      if (validationError) {
        sendResponse(createDefaultPolicyBundle());
        return;
      }
      sendResponse(policy);
    });
    return true;
  }

  if (msg.type === 'REPORT_PLATFORM_HEALTH') {
    updatePlatformHealthReport(msg.report).then(function(report) {
      sendResponse({ ok: true, report: report });
    });
    return true;
  }

  if (msg.type === 'PUBLISH_POLICY') {
    var nextPolicy = ensurePolicyBundleShape(msg.policy || createDefaultPolicyBundle());
    var publishValidationError = validatePolicyBundleWithSharedSchema(nextPolicy);
    if (publishValidationError) {
      sendResponse({ ok: false, error: publishValidationError });
      return true;
    }
    chrome.storage.local.set({ logclean_policy_bundle: nextPolicy }, function() {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'LOG_AUDIT') {
    chrome.storage.local.get([
      'logclean_audit_log',
      'logclean_device_events',
      'logclean_training_signals',
      'logclean_actor_seed',
      'logclean_device_id',
      'logclean_policy_bundle',
      'logclean_rules_version',
      'logclean_policy_sync_enabled',
    ], function(data) {
      var auditLog = data.logclean_audit_log || [];
      var deviceEvents = data.logclean_device_events || [];
      var trainingSignals = data.logclean_training_signals || [];
      var currentPolicy = ensurePolicyBundleShape(data.logclean_policy_bundle || createDefaultPolicyBundle());
      var deviceId = data.logclean_device_id || createLocalDeviceId();
      var eventSummary = msg.event_summary || {
        schema_version: AUDIT_EVENT_SCHEMA_VERSION,
        org_id: currentPolicy.org_id,
        org_name: currentPolicy.org_name,
        team_id: currentPolicy.team_id,
        team_name: currentPolicy.team_name,
        device_id: deviceId,
        extension_version: EXTENSION_VERSION,
        policy_version: currentPolicy.policy_version,
        rules_version: data.logclean_rules_version || BUNDLED_RULES_VERSION,
        site: msg.url,
        action: msg.action || 'warn',
        intent_label: msg.intent_label || 'other',
        intent_confidence_bucket: 'medium',
        sensitivity_categories: msg.categories || [],
        rule_ids: [],
        count_summary: {
          total: msg.redacted_count || 0,
          by_category: {},
          by_risk: msg.risk_summary || {},
        },
        prompt_size_bucket: msg.prompt_size_bucket || 'medium',
        rotating_actor_id: getRotatingActorId(data.logclean_actor_seed || 'actor-local'),
        strict_mode: Boolean(currentPolicy.strict_mode),
        raw_text_absent: true,
        justification_required: msg.action === 'justify',
        justification_provided: false,
        timestamp_bucket: new Date().toISOString().slice(0, 13) + ':00:00.000Z',
      };
      eventSummary.schema_version = eventSummary.schema_version || AUDIT_EVENT_SCHEMA_VERSION;
      eventSummary.device_id = eventSummary.device_id || deviceId;
      eventSummary.extension_version = eventSummary.extension_version || EXTENSION_VERSION;
      eventSummary.policy_version = eventSummary.policy_version || currentPolicy.policy_version;
      eventSummary.rules_version = eventSummary.rules_version || data.logclean_rules_version || BUNDLED_RULES_VERSION;
      if (eventSummary.justification_required == null) {
        eventSummary.justification_required = eventSummary.action === 'justify';
      }

      auditLog.unshift({
        ts: new Date().toISOString(),
        url: msg.url || eventSummary.site,
        redacted_count: msg.redacted_count || eventSummary.count_summary.total,
        categories: msg.categories || eventSummary.sensitivity_categories,
        risk_summary: msg.risk_summary || eventSummary.count_summary.by_risk,
        action: eventSummary.action,
        intent_label: eventSummary.intent_label,
      });

      deviceEvents.unshift({
        ts: new Date().toISOString(),
        org_id: eventSummary.org_id || 'org_acme_msp',
        org_name: eventSummary.org_name || 'Acme Managed Services',
        team_id: eventSummary.team_id || 'helpdesk',
        team_name: eventSummary.team_name || 'Helpdesk',
        site: eventSummary.site,
        action: eventSummary.action,
        intent_label: eventSummary.intent_label,
        intent_confidence_bucket: eventSummary.intent_confidence_bucket || 'medium',
        sensitivity_categories: eventSummary.sensitivity_categories,
        rule_ids: eventSummary.rule_ids || [],
        count_summary: eventSummary.count_summary,
        prompt_size_bucket: eventSummary.prompt_size_bucket,
        rotating_actor_id: eventSummary.rotating_actor_id || getRotatingActorId(data.logclean_actor_seed || 'actor-local'),
        strict_mode: Boolean(eventSummary.strict_mode),
        raw_text_absent: eventSummary.raw_text_absent !== false,
        justification_provided: Boolean(eventSummary.justification_provided),
      });

      trainingSignals = appendTrainingSignal(eventSummary).concat(trainingSignals).slice(0, 100);

      chrome.storage.local.set({
        logclean_audit_log: auditLog.slice(0, 200),
        logclean_device_events: deviceEvents.slice(0, 300),
        logclean_training_signals: trainingSignals,
        logclean_device_id: deviceId,
      }, function() {
        uploadAuditEventToControlPlane(eventSummary);
      });
    });
  }

  if (msg.type === 'GET_AUDIT_LOG') {
    chrome.storage.local.get(['logclean_audit_log'], function(data) {
      sendResponse(data.logclean_audit_log || []);
    });
    return true;
  }

  if (msg.type === 'GET_DEVICE_EVENTS') {
    chrome.storage.local.get(['logclean_device_events'], function(data) {
      sendResponse(data.logclean_device_events || []);
    });
    return true;
  }
});
