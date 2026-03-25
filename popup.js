/**
 * CleanPrompt Extension Popup Script
 */
(function () {
  'use strict';

  /** @typedef {import('./types/extension-runtime').PlatformHealthReport} PlatformHealthReport */
  /** @typedef {import('./types/popup-runtime').PopupManagedSettings} PopupManagedSettings */
  /** @typedef {import('./types/popup-runtime').PopupManagedViewModel} PopupManagedViewModel */

  var CAT_COLORS = {
    Network:    { bg: 'rgba(56,189,248,0.15)', border: '#38bdf8', text: '#38bdf8' },
    Credential: { bg: 'rgba(249,115,22,0.15)', border: '#f97316', text: '#fb923c' },
    PII:        { bg: 'rgba(52,211,153,0.15)', border: '#34d399', text: '#34d399' },
    Financial:  { bg: 'rgba(250,204,21,0.15)', border: '#facc15', text: '#facc15' },
    MSP:        { bg: 'rgba(232,121,249,0.15)', border: '#e879f9', text: '#e879f9' },
  };

  var SUPPORTED_PLATFORMS = [
    { icon: '🤖', key: 'chatgpt', name: 'ChatGPT', host: 'chatgpt.com', url: 'https://chatgpt.com' },
    { icon: '🟠', key: 'chatgpt', name: 'ChatGPT (OpenAI)', host: 'chat.openai.com', url: 'https://chat.openai.com' },
    { icon: '🟣', key: 'claude', name: 'Claude', host: 'claude.ai', url: 'https://claude.ai' },
    { icon: '🔷', key: 'copilot', name: 'Microsoft Copilot', host: 'copilot.microsoft.com', url: 'https://copilot.microsoft.com' },
    { icon: '🟦', key: 'copilot', name: 'Microsoft Copilot (Bing)', host: 'www.bing.com', url: 'https://www.bing.com/copilot' },
    { icon: '🔵', key: 'gemini', name: 'Google Gemini', host: 'gemini.google.com', url: 'https://gemini.google.com' },
  ];

  var currentResult = null;
  var revealedTokens = {};
  var currentPolicyBundle = null;
  var managedSettings = null;
  var runtimeContext = {
    device_id: 'popup-local',
    extension_version: '0.0.0',
    policy_version: null,
    rules_version: null,
  };

  // ── Tabs ───────────────────────────────────────────────────────────────
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  // ── Load OTA rule overrides from storage ─────────────────────────────────
  chrome.storage.local.get(['logclean_rules_override', 'logclean_policy_bundle', 'logclean_device_id', 'logclean_rules_version'], function(data) {
    if (data.logclean_rules_override && Array.isArray(data.logclean_rules_override)) {
      var overrideRules = data.logclean_rules_override.map(function(r) {
        return {
          id: r.id,
          label: r.label,
          category: r.category,
          risk: r.risk || 'medium',
          color: r.color || '#94a3b8',
          pattern: new RegExp(r.pattern, r.flags || 'g'),
        };
      });
      LOGCLEAN_RULES.length = 0;
      overrideRules.forEach(function(r) { LOGCLEAN_RULES.push(r); });
    }
    currentPolicyBundle = data.logclean_policy_bundle || null;
    runtimeContext.device_id = data.logclean_device_id || runtimeContext.device_id;
    runtimeContext.rules_version = data.logclean_rules_version || runtimeContext.rules_version;
    runtimeContext.policy_version = currentPolicyBundle && currentPolicyBundle.policy_version || null;
    if (chrome.runtime && chrome.runtime.getManifest) {
      runtimeContext.extension_version = chrome.runtime.getManifest().version || runtimeContext.extension_version;
    }
    initPopup();
  });

  function sendRuntimeMessage(message) {
    return new Promise(function(resolve) {
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        resolve({ ok: false, reason: 'runtime_unavailable' });
        return;
      }

      chrome.runtime.sendMessage(message, function(response) {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve({
            ok: false,
            reason: 'runtime_error',
            message: chrome.runtime.lastError.message,
          });
          return;
        }
        resolve(response || null);
      });
    });
  }

  function humanizeStatus(value) {
    if (!value) return 'Unknown';
    return String(value).replace(/_/g, ' ').replace(/\b\w/g, function(letter) {
      return letter.toUpperCase();
    });
  }

  function formatTimestamp(value) {
    if (!value) return 'Never';
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }

  function describeResult(result, successText, emptyText) {
    if (!result || !result.status) return emptyText;
    if (result.status === 'ok') {
      return successText + ' on ' + formatTimestamp(result.ts);
    }

    var parts = [humanizeStatus(result.status)];
    if (typeof result.code === 'number') parts.push('HTTP ' + result.code);
    if (result.message) parts.push(result.message);
    if (result.ts) parts.push(formatTimestamp(result.ts));
    return parts.join(' · ');
  }

  /**
   * @param {PopupManagedSettings | null | undefined} settings
   * @returns {PopupManagedViewModel}
   */
  function buildManagedViewModel(settings) {
    settings = settings || {};

    var policyBundle = settings.logclean_policy_bundle || null;
    var enrollment = settings.logclean_device_enrollment || null;
    var enrollmentResult = settings.logclean_last_enrollment_result || null;
    var syncResult = settings.logclean_last_sync_result || null;
    var auditUploadResult = settings.logclean_last_audit_upload_result || null;
    var syncEnabled = Boolean(settings.logclean_policy_sync_enabled);
    var hasEnrollment = Boolean(enrollment && enrollment.device_id);
    var policyAllowsMetadata = !policyBundle || !policyBundle.metadata_analytics || policyBundle.metadata_analytics.enabled !== false;
    var strictMode = Boolean(policyBundle && policyBundle.strict_mode);
    var enrollmentTone = hasEnrollment ? 'ok' : (syncEnabled ? 'warn' : 'muted');
    var syncTone = syncEnabled ? (syncResult && syncResult.status && syncResult.status !== 'ok' ? 'warn' : 'info') : 'muted';
    var uploadTone = 'muted';

    if (syncResult && syncResult.status === 'ok') {
      syncTone = 'ok';
    }
    if (auditUploadResult && auditUploadResult.status === 'ok') {
      uploadTone = 'ok';
    } else if (auditUploadResult && auditUploadResult.status && auditUploadResult.status !== 'sync_disabled') {
      uploadTone = strictMode ? 'muted' : 'warn';
    } else if (syncEnabled && policyAllowsMetadata && !strictMode) {
      uploadTone = 'info';
    }

    var demoNextStep = 'Seed the control plane, click Prepare managed demo, then open the admin console to show metadata-safe owner insight.';
    if (syncEnabled && hasEnrollment && syncResult && syncResult.status === 'ok') {
      demoNextStep = 'Managed demo is ready. Open a supported AI app, trigger Clean, then open the admin console to show metadata-only owner insight.';
    } else if (syncEnabled && !hasEnrollment) {
      demoNextStep = 'Managed mode is on, but this device still needs enrollment. Prepare managed demo will reset locally, enroll the device, and pull policy in one step.';
    } else if (syncEnabled && hasEnrollment) {
      demoNextStep = 'This device is enrolled. Run Sync policy to confirm the latest managed policy before the pitch, then open the admin console.';
    }

    return {
      syncEnabled: syncEnabled,
      baseUrl: settings.logclean_control_plane_base_url || 'Not configured',
      orgName: policyBundle && policyBundle.org_name || 'Unknown',
      deviceId: hasEnrollment ? enrollment.device_id : (settings.device_id || settings.logclean_device_id || runtimeContext.device_id),
      extensionVersion: settings.extension_version || runtimeContext.extension_version,
      policyVersion: settings.policy_version || (policyBundle && policyBundle.policy_version) || 'Unknown',
      rulesVersion: settings.rules_version || runtimeContext.rules_version || 'Unknown',
      modeLabel: syncEnabled ? 'Managed sync enabled' : 'Local-only mode',
      modeTone: syncEnabled ? 'info' : 'muted',
      enrollmentLabel: hasEnrollment ? 'Device enrolled' : (syncEnabled ? 'Enrollment needed' : 'Enrollment optional'),
      enrollmentTone: enrollmentTone,
      syncLabel: syncEnabled ? (syncResult && syncResult.status ? humanizeStatus(syncResult.status) : 'Awaiting sync') : 'Sync disabled',
      syncTone: syncTone,
      enrollmentDetail: hasEnrollment
        ? 'Enrolled on ' + formatTimestamp(enrollment.enrolled_at)
        : describeResult(enrollmentResult, 'Enrollment completed', syncEnabled ? 'No enrollment attempt recorded.' : 'Managed enrollment is optional while sync stays off.'),
      syncDetail: syncEnabled
        ? describeResult(syncResult, 'Policy sync completed', 'No policy sync attempt recorded.')
        : 'Managed policy sync is disabled. The extension will keep using local policy data.',
      uploadDetail: strictMode
        ? 'Strict mode is enabled, so no metadata is uploaded off-device.'
        : !syncEnabled
          ? 'Managed sync is disabled, so audit metadata stays local-only.'
          : !policyAllowsMetadata
            ? 'Policy metadata analytics are disabled, so owner insight upload is off.'
            : describeResult(auditUploadResult, 'Latest metadata event uploaded', 'No metadata event upload recorded yet.'),
      uploadLabel: strictMode ? 'Upload off' : (auditUploadResult && auditUploadResult.status ? humanizeStatus(auditUploadResult.status) : 'Awaiting upload'),
      uploadTone: uploadTone,
      insightSummary: syncEnabled
        ? 'Owners can review device coverage, policy versions, and metadata-only risk trends without seeing raw prompt text.'
        : 'Local-first mode is active. Prompt cleaning still works, but no owner insight is being sent to a control plane.',
      demoNextStep: demoNextStep,
      demoResetNote: 'Reset extension demo clears local audit history, enrollment state, upload/sync results, and rule toggles while keeping the control-plane base URL and enrollment token.',
      demoFlowNote: 'Prepare managed demo starts from a clean local state, enables managed sync, re-enrolls the browser, and pulls the latest control-plane policy.',
    };
  }

  function setChip(id, label, tone) {
    var element = document.getElementById(id);
    if (!element) return;
    element.className = 'status-chip tone-' + (tone || 'muted');
    element.textContent = label;
  }

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  function setManagedFeedback(message, tone) {
    var element = document.getElementById('managed-action-feedback');
    if (!element) return;
    element.textContent = message || '';
    element.style.color = tone === 'danger'
      ? '#f87171'
      : tone === 'ok'
        ? '#34d399'
        : '#94a3b8';
  }

  /**
   * @param {PopupManagedSettings | null | undefined} settings
   * @returns {import('./types/popup-runtime').PopupPlatformCoverageItem[]}
   */
  function buildPlatformCoverageModel(settings) {
    settings = settings || {};
    var healthMap = settings.logclean_platform_health || {};

    return SUPPORTED_PLATFORMS.map(function(platform) {
      /** @type {PlatformHealthReport | null} */
      var report = null;
      Object.keys(healthMap).forEach(function(host) {
        var candidate = healthMap[host];
        if (!report && candidate && candidate.platform_key === platform.key) {
          report = candidate;
        }
      });

      var statusLabel = 'Not verified yet';
      var statusTone = 'muted';
      var detail = 'No compatibility signal captured yet from this host.';

      if (report && report.input_detected && report.trigger_attached) {
        if (report.compatibility_confidence === 'fallback_path') {
          statusLabel = 'Fallback verified';
          statusTone = 'warn';
        } else {
          statusLabel = report.send_button_detected ? 'Verified' : 'Input verified';
          statusTone = report.send_button_detected ? 'ok' : 'info';
        }
        detail = 'Last seen on ' + report.host + ' at ' + formatTimestamp(report.ts) + '.';
        if (report.input_selector || report.toolbar_strategy || report.send_selector) {
          detail += ' Path: ' + [
            report.input_selector || 'unknown input',
            report.toolbar_strategy || 'unknown toolbar',
            report.send_selector || 'no send selector',
          ].join(' -> ') + '.';
        }
      } else if (report && report.input_detected) {
        statusLabel = 'Drift risk';
        statusTone = 'warn';
        detail = 'Input was found on ' + report.host + ', but attachment was incomplete.';
        if (report.input_selector) {
          detail += ' Input selector: ' + report.input_selector + '.';
        }
      } else if (report) {
        statusLabel = 'Needs review';
        statusTone = 'warn';
        detail = 'Host responded, but the prompt surface was not confirmed on ' + report.host + '.';
      }

      return {
        icon: platform.icon,
        name: platform.name,
        host: platform.host,
        url: platform.url,
        statusLabel: statusLabel,
        statusTone: statusTone,
        detail: detail,
      };
    });
  }

  function renderPlatformCoverage(settings) {
    var platformList = document.getElementById('platform-list');
    if (!platformList) return;

    platformList.innerHTML = '';
    buildPlatformCoverageModel(settings).forEach(function(platform) {
      var div = document.createElement('div');
      div.className = 'platform-card';
      div.innerHTML =
        '<span class="platform-icon">' + platform.icon + '</span>' +
        '<div><div class="platform-name">' + platform.name + '</div>' +
        '<div style="font-size:11px;color:#475569">' + platform.host + '</div>' +
        '<div style="font-size:10px;color:#64748b;margin-top:4px">' + platform.detail + '</div></div>' +
        '<span class="platform-status tone-' + platform.statusTone + '">' + platform.statusLabel + '</span>';
      div.style.cursor = 'pointer';
      div.addEventListener('click', function() { chrome.tabs.create({ url: platform.url }); });
      platformList.appendChild(div);
    });
  }

  function renderManagedStatus(settings) {
    managedSettings = settings || {};
    currentPolicyBundle = managedSettings.logclean_policy_bundle || currentPolicyBundle;
    runtimeContext.device_id = managedSettings.device_id || runtimeContext.device_id;
    runtimeContext.extension_version = managedSettings.extension_version || runtimeContext.extension_version;
    runtimeContext.policy_version = managedSettings.policy_version || runtimeContext.policy_version;
    runtimeContext.rules_version = managedSettings.rules_version || runtimeContext.rules_version;
    renderPlatformCoverage(managedSettings);

    var view = buildManagedViewModel(managedSettings);
    setChip('managed-mode-chip', view.modeLabel, view.modeTone);
    setChip('managed-enrollment-chip', view.enrollmentLabel, view.enrollmentTone);
    setChip('managed-sync-chip', view.syncLabel, view.syncTone);

    setText('managed-base-url', view.baseUrl);
    setText('managed-org', view.orgName);
    setText('managed-device-id', view.deviceId || 'Unknown');
    setText('managed-extension-version', view.extensionVersion || 'Unknown');
    setText('managed-policy-version', view.policyVersion || 'Unknown');
    setText('managed-rules-version', view.rulesVersion || 'Unknown');
    setText('managed-enrollment-detail', view.enrollmentDetail);
    setText('managed-sync-detail', view.syncDetail);
    setText('managed-upload-detail', view.uploadDetail);
    setText('managed-insight-summary', view.insightSummary);
    setText('managed-demo-next-step', view.demoNextStep);
    setText('managed-demo-reset-note', view.demoResetNote);
    setText('managed-demo-flow-note', view.demoFlowNote);

    var syncButton = document.getElementById('managed-sync-btn');
    if (syncButton) syncButton.disabled = !view.syncEnabled;

    ['managed-open-policy', 'managed-open-overview', 'managed-open-devices'].forEach(function(id) {
      var button = document.getElementById(id);
      if (button) button.disabled = !view.baseUrl || view.baseUrl === 'Not configured';
    });
  }

  function loadManagedStatus() {
    return sendRuntimeMessage({ type: 'GET_SETTINGS' }).then(function(settings) {
      if (!settings || settings.ok === false && settings.reason === 'runtime_unavailable') {
        setManagedFeedback('Managed status is unavailable in this environment.', 'danger');
        return null;
      }

      renderManagedStatus(settings);
      return settings;
    });
  }

  function runManagedAction(buttonId, pendingLabel, message, copy) {
    var button = document.getElementById(buttonId);
    if (!button) return Promise.resolve(null);

    var originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = pendingLabel;
    setManagedFeedback('', 'muted');

    return sendRuntimeMessage(message).then(function(result) {
      return loadManagedStatus().then(function() {
        var success = Boolean(result && result.ok);
        setManagedFeedback(
          success
            ? (copy && copy.success || 'Action completed.')
            : (copy && copy.failurePrefix || 'Action finished with ') + humanizeStatus(result && (result.reason || result.status) || 'unknown') + '.',
          success ? 'ok' : 'danger'
        );

        button.textContent = success ? '✓ Done' : (copy && copy.retryLabel || 'Retry');
        setTimeout(function() {
          button.textContent = originalLabel;
          button.disabled = false;
          if (buttonId === 'managed-sync-btn' && managedSettings && managedSettings.logclean_policy_sync_enabled === false) {
            button.disabled = true;
          }
        }, 1500);
        return result;
      });
    }).catch(function(error) {
      setManagedFeedback('Action failed: ' + (error && error.message ? error.message : 'unknown error'), 'danger');
      button.textContent = originalLabel;
      button.disabled = false;
      return null;
    });
  }

  function openManagedEndpoint(path) {
    if (!managedSettings || !managedSettings.logclean_control_plane_base_url) return;
    var url = managedSettings.logclean_control_plane_base_url.replace(/\/+$/, '') + path;
    chrome.tabs.create({ url: url });
  }

  function wireManagedActions() {
    var prepareDemoButton = document.getElementById('managed-prepare-demo-btn');
    if (prepareDemoButton) {
      prepareDemoButton.addEventListener('click', function() {
        runManagedAction(
          'managed-prepare-demo-btn',
          'Preparing…',
          { type: 'PREPARE_MANAGED_DEMO' },
          {
            success: 'Managed demo is ready. Enrollment and policy sync completed.',
            failurePrefix: 'Managed demo prep finished with ',
            retryLabel: 'Try again',
          }
        );
      });
    }

    var resetDemoButton = document.getElementById('managed-reset-demo-btn');
    if (resetDemoButton) {
      resetDemoButton.addEventListener('click', function() {
        runManagedAction(
          'managed-reset-demo-btn',
          'Resetting…',
          {
            type: 'RESET_EXTENSION_DEMO_STATE',
            preserve_managed_config: true,
            enable_managed_sync: false,
          },
          {
            success: 'Extension demo state reset. Local logs and enrollment state were cleared.',
            failurePrefix: 'Reset finished with ',
          }
        );
      });
    }

    var enrollButton = document.getElementById('managed-enroll-btn');
    if (enrollButton) {
      enrollButton.addEventListener('click', function() {
        runManagedAction('managed-enroll-btn', 'Enrolling…', { type: 'ENROLL_DEVICE_NOW' }, {
          success: 'Device enrollment completed.',
        });
      });
    }

    var syncButton = document.getElementById('managed-sync-btn');
    if (syncButton) {
      syncButton.addEventListener('click', function() {
        if (syncButton.disabled) return;
        runManagedAction('managed-sync-btn', 'Syncing…', { type: 'SYNC_POLICY_NOW' }, {
          success: 'Policy sync completed.',
        });
      });
    }

    var policyButton = document.getElementById('managed-open-policy');
    if (policyButton) {
      policyButton.addEventListener('click', function() {
        openManagedEndpoint('/api/policies/default');
      });
    }

    var overviewButton = document.getElementById('managed-open-overview');
    if (overviewButton) {
      overviewButton.addEventListener('click', function() {
        openManagedEndpoint('/admin');
      });
    }

    var devicesButton = document.getElementById('managed-open-devices');
    if (devicesButton) {
      devicesButton.addEventListener('click', function() {
        openManagedEndpoint('/api/admin/devices');
      });
    }
  }

  function initPopup() {

  // ── Populate platforms ───────────────────────────────────────────────────
  renderPlatformCoverage({});

  // ── Populate rules ───────────────────────────────────────────────────────
  var rulesList = document.getElementById('rules-list');
  var rulesByCategory = {};
  LOGCLEAN_RULES.forEach(function(r) {
    if (!rulesByCategory[r.category]) rulesByCategory[r.category] = [];
    rulesByCategory[r.category].push(r);
  });

  chrome.storage.local.get(['logclean_active_rules'], function(data) {
    var activeIds = data.logclean_active_rules || LOGCLEAN_RULES.map(function(r){ return r.id; });

    Object.entries(rulesByCategory).forEach(function(entry) {
      var cat = entry[0], rules = entry[1];
      var c = CAT_COLORS[cat] || CAT_COLORS.Network;
      var section = document.createElement('div');
      section.className = 'settings-section';
      var title = document.createElement('div');
      title.className = 'settings-title';
      title.innerHTML = '<span style="color:' + c.text + '">' + cat + '</span>';
      section.appendChild(title);
      rules.forEach(function(rule) {
        var row = document.createElement('label');
        row.className = 'rule-row';
        var checked = activeIds.indexOf(rule.id) !== -1;
        var r = (typeof LOGCLEAN_PROTECTION !== 'undefined' && LOGCLEAN_PROTECTION[rule.risk]) || { emoji:'⚪', color:'#94a3b8', bg:'rgba(148,163,184,0.1)', border:'rgba(148,163,184,0.3)', label: rule.risk };
        
        row.innerHTML =
          '<input type="checkbox" id="rule_' + rule.id + '"' + (checked ? ' checked' : '') + '/>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;flex:1">' +
            '<span style="color:' + (checked ? '#e2e8f0' : '#475569') + '">' + rule.label + '</span>' +
            '<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:12px;border:1px solid ' + r.border + ';background:' + r.bg + ';color:' + r.color + '">' + r.emoji + ' ' + r.label + '</span>' +
          '</div>';
        var checkbox = row.querySelector('input');
        checkbox.addEventListener('change', function() {
          var ids = LOGCLEAN_RULES.map(function(r){ return r.id; }).filter(function(id) {
            var el = document.getElementById('rule_' + id);
            return el ? el.checked : true;
          });
          chrome.storage.local.set({ logclean_active_rules: ids });
        });
        section.appendChild(row);
      });
      rulesList.appendChild(section);
    });
  });

  wireManagedActions();
  loadManagedStatus();

  // ── Char count ────────────────────────────────────────────────────────────
  var rawInput = document.getElementById('p-raw');
  rawInput.addEventListener('input', function() {
    document.getElementById('p-char-count').textContent = rawInput.value.length.toLocaleString() + ' chars';
  });

  // ── Sample ────────────────────────────────────────────────────────────────
  document.getElementById('p-sample').addEventListener('click', function() {
    rawInput.value = [
      '[Datto RMM] Device-Id=a3f1b2c4-d5e6-7890-abcd-ef1234567890 Site-Name=Acme Corp',
      'CW Ticket #12043 Client-Name=Acme Corp CW-Api-Key=Xk9mP2qR7tL4wN6vA1jB5cD8',
      'User: john.doe@acmecorp.com | IP: 192.168.1.45 | MAC: 00:1A:2B:3C:4D:5E',
      'S1 Site-Token=eyJhbGciOi... Threat-Id=12345678901234567',
      'VPN-Password=P@ssw0rd!2024 SSID=AcmeCorp_WiFi',
    ].join('\n');
    rawInput.dispatchEvent(new Event('input'));
  });

  // ── Clear ─────────────────────────────────────────────────────────────────
  document.getElementById('p-clear').addEventListener('click', function() {
    rawInput.value = '';
    currentResult = null;
    revealedTokens = {};
    document.getElementById('p-char-count').textContent = '0 chars';
    document.getElementById('p-summary').style.display = 'none';
    document.getElementById('p-output-wrap').style.display = 'none';
    document.getElementById('p-guidance').style.display = 'none';
    document.getElementById('p-safe-compose-wrap').style.display = 'none';
    document.getElementById('p-actions').style.display = 'none';
  });

  // ── Redact ────────────────────────────────────────────────────────────────
  document.getElementById('p-redact-btn').addEventListener('click', async function() {
    var text = rawInput.value.trim();
    if (!text) return;
    var btn = document.getElementById('p-redact-btn');
    btn.textContent = '⚡ Scanning…'; btn.disabled = true;

    chrome.storage.local.get(['logclean_active_rules'], async function(data) {
      var enabledIds = data.logclean_active_rules || null;
      var result = await logcleanRedact(text, enabledIds, { policyBundle: currentPolicyBundle, site: 'popup', org_id: 'org_acme_msp', org_name: 'Acme Managed Services', team_id: 'helpdesk', team_name: 'Helpdesk', rotating_actor_id: 'popup-local', device_id: runtimeContext.device_id, extension_version: runtimeContext.extension_version, policy_version: runtimeContext.policy_version, rules_version: runtimeContext.rules_version });
      currentResult = result;
      revealedTokens = {};
      renderOutput(result);
      btn.textContent = '🛡️ Clean Prompt'; btn.disabled = false;
    });
  });

  function renderOutput(result) {
    var sum = logcleanGetSummary(result.findings);
    // Summary
    var summaryEl = document.getElementById('p-summary');
    summaryEl.style.display = 'flex';
    document.getElementById('p-summary-count').textContent = sum.total + ' items redacted';
    document.getElementById('p-summary-count').style.color = sum.total > 0 ? '#f87171' : '#34d399';
    var catsEl = document.getElementById('p-summary-cats');
    catsEl.innerHTML = '';
    
    Object.entries(sum.byCategory).forEach(function(e) {
      var c = CAT_COLORS[e[0]] || CAT_COLORS.Network;
      var pill = document.createElement('span');
      pill.className = 'cat-pill';
      pill.style.cssText = 'background:' + c.bg + ';border-color:' + c.border + ';color:' + c.text;
      pill.textContent = e[0] + ': ' + e[1];
      catsEl.appendChild(pill);
    });

    if (sum.byProtection) {
      var protectionOrder = ['critical','high','medium','low'];
      protectionOrder.forEach(function(r) {
        if (!sum.byProtection[r]) return;
        var ri = (typeof LOGCLEAN_PROTECTION !== 'undefined' && LOGCLEAN_PROTECTION[r]) || { emoji:'⚪', color:'#94a3b8', bg:'rgba(148,163,184,0.1)', border:'rgba(148,163,184,0.3)', label: r };
        var pill = document.createElement('span');
        pill.className = 'cat-pill';
        pill.style.cssText = 'background:' + ri.bg + ';border-color:' + ri.border + ';color:' + ri.color;
        pill.textContent = ri.emoji + ' ' + ri.label + ': ' + sum.byProtection[r];
        catsEl.appendChild(pill);
      });
    }

    // Output
    buildOutput(result.sanitized, result.tokens);
    renderGuidance(result);
    document.getElementById('p-output-wrap').style.display = 'block';
    document.getElementById('p-guidance').style.display = 'block';
    document.getElementById('p-safe-compose-wrap').style.display = 'block';
    document.getElementById('p-actions').style.display = 'flex';
  }

  function renderGuidance(result) {
    var pills = document.getElementById('p-guidance-pills');
    pills.innerHTML = '';

    [
      { label: 'Intent: ' + String(result.intent_label || 'other').replace(/_/g, ' '), color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)' },
      { label: 'Policy: ' + (result.policy_action || 'warn'), color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
    ].forEach(function(item) {
      var pill = document.createElement('span');
      pill.className = 'cat-pill';
      pill.style.cssText = 'background:' + item.bg + ';border-color:' + item.border + ';color:' + item.color;
      pill.textContent = item.label;
      pills.appendChild(pill);
    });

    document.getElementById('p-guidance-text').textContent = result.employee_explanation || '';
    document.getElementById('p-safe-compose').value = result.safe_compose_prompt || '';
  }

  function buildOutput(sanitized, tokens) {
    var el = document.getElementById('p-output');
    el.innerHTML = '';
    var parts = sanitized.split(/(\[[A-Z0-9_]+_\d+\])/g);
    parts.forEach(function(part) {
      if (/^\[[A-Z0-9_]+_\d+\]$/.test(part)) {
        var m = part.match(/^\[([A-Z0-9_]+)_\d+\]$/);
        var rule = m ? LOGCLEAN_RULES.find(function(r){ return r.id === m[1]; }) : null;
        var cat = rule ? rule.category : 'Network';
        var c = CAT_COLORS[cat] || CAT_COLORS.Network;
        var span = document.createElement('span');
        span.className = 'p-token';
        span.textContent = part;
        span.style.cssText = 'background:' + c.bg + ';border-color:' + c.border + ';color:' + c.text;
        span.title = 'Click to reveal';
        span.addEventListener('click', function() {
          if (revealedTokens[part]) {
            delete revealedTokens[part];
            span.textContent = part;
            span.style.opacity = '1';
            span.style.textDecoration = 'none';
          } else {
            revealedTokens[part] = tokens[part];
            span.textContent = tokens[part] || part;
            span.style.opacity = '0.6';
            span.style.textDecoration = 'line-through';
          }
        });
        el.appendChild(span);
      } else {
        el.appendChild(document.createTextNode(part));
      }
    });
  }

  // ── Copy ─────────────────────────────────────────────────────────────────
  document.getElementById('p-copy').addEventListener('click', function() {
    if (!currentResult) return;
    var text = currentResult.sanitized;
    navigator.clipboard.writeText(text).then(function() {
      var btn = document.getElementById('p-copy');
      btn.textContent = '✓ Copied!';
      setTimeout(function(){ btn.textContent = '📋 Copy'; }, 1800);
    });
  });

  document.getElementById('p-copy-compose').addEventListener('click', function() {
    if (!currentResult) return;
    navigator.clipboard.writeText(currentResult.safe_compose_prompt || '').then(function() {
      var btn = document.getElementById('p-copy-compose');
      btn.textContent = '✓ Copied!';
      setTimeout(function(){ btn.textContent = '✨ Copy Safe Compose'; }, 1800);
    });
  });

  // ── Open in tab ────────────────────────────────────────────────────────────
  document.getElementById('p-open-tab').addEventListener('click', function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
  });

  // ── Initialization Complete ──
  } // end of initPopup function definition

  globalThis.__cleanpromptPopup = {
    buildManagedViewModel: buildManagedViewModel,
    buildPlatformCoverageModel: buildPlatformCoverageModel,
    describeResult: describeResult,
    formatTimestamp: formatTimestamp,
    humanizeStatus: humanizeStatus,
  };
})();
