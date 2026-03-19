/**
 * LogClean Background Service Worker (MV3)
 * Handles: local policy bundle, metadata-safe audit events, and bundled rule status.
 */

var BUNDLED_RULES_VERSION = '1.2.0-local';

function createDefaultPolicyBundle() {
  return {
    policy_version: '2026.03.18-local',
    org_id: 'org_acme_msp',
    org_name: 'Acme Managed Services',
    team_id: 'helpdesk',
    team_name: 'Helpdesk',
    app_scopes: ['chatgpt.com', 'chat.openai.com', 'claude.ai', 'copilot.microsoft.com', 'gemini.google.com'],
    rules: {
      active_rule_ids: null,
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
    logclean_policy_bundle: createDefaultPolicyBundle(),
  };
}

function getRotatingActorId(seed) {
  var now = new Date();
  var bucket = now.getUTCFullYear() + '-' + String(now.getUTCMonth() + 1).padStart(2, '0');
  return seed + '-' + bucket;
}

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

chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    chrome.storage.local.set(createDefaultSettings());
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') + '?welcome=true' });
  }
});

chrome.runtime.onStartup.addListener(function() {
  chrome.storage.local.get(['logclean_policy_bundle'], function(data) {
    if (!data.logclean_policy_bundle) {
      chrome.storage.local.set(createDefaultSettings());
    }
  });
});

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.local.get([
      'logclean_enabled',
      'logclean_plan',
      'logclean_intercept_enabled',
      'logclean_rules_version',
      'logclean_policy_bundle',
      'logclean_actor_seed',
    ], function(result) {
      result.rotating_actor_id = getRotatingActorId(result.logclean_actor_seed || 'actor-local');
      sendResponse(result);
    });
    return true;
  }

  if (msg.type === 'GET_CURRENT_POLICY') {
    chrome.storage.local.get(['logclean_policy_bundle'], function(result) {
      sendResponse(result.logclean_policy_bundle || createDefaultPolicyBundle());
    });
    return true;
  }

  if (msg.type === 'PUBLISH_POLICY') {
    chrome.storage.local.set({ logclean_policy_bundle: msg.policy || createDefaultPolicyBundle() }, function() {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'LOG_AUDIT') {
    chrome.storage.local.get(['logclean_audit_log', 'logclean_device_events', 'logclean_training_signals', 'logclean_actor_seed'], function(data) {
      var auditLog = data.logclean_audit_log || [];
      var deviceEvents = data.logclean_device_events || [];
      var trainingSignals = data.logclean_training_signals || [];
      var eventSummary = msg.event_summary || {
        site: msg.url,
        action: msg.action || 'warn',
        intent_label: msg.intent_label || 'other',
        sensitivity_categories: msg.categories || [],
        count_summary: {
          total: msg.redacted_count || 0,
          by_category: {},
          by_risk: msg.risk_summary || {},
        },
        prompt_size_bucket: msg.prompt_size_bucket || 'medium',
        rotating_actor_id: getRotatingActorId(data.logclean_actor_seed || 'actor-local'),
        raw_text_absent: true,
      };

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
