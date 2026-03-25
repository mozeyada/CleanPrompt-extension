const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  verifyContentStructure,
  verifyManifest,
  verifyPopupCleanSurface,
  verifyPopupRulesSurface,
  verifyPopupStructure,
  verifyPlatformCoverageViewModelSurface,
  verifyPlatformHealthSurface,
  verifyManagedViewModelSurface,
  verifyPresentationAssets,
  verifyRuleMetadataSurface,
  verifyRedactionResultSurface,
  verifyRuleBundle,
  verifyContentReviewSurface,
  verifyRuntimeResponseSurface,
  verifyStatusResultSurface,
  verifyStorageContract,
  verifyRuntimeMessageSurface,
  verifyRuntimeUrlDependencies,
  verifySidebarStructure,
  verifySupportedHostCoverage,
  verifyExtensionAssets,
} = require('../scripts/verify-extension-assets');

function createFixtureRoot() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanprompt-assets-'));

  fs.mkdirSync(path.join(rootDir, 'engine'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'icons'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'types'), { recursive: true });

  writeBackgroundMessageFixture(rootDir);
  fs.writeFileSync(path.join(rootDir, 'content.js'), 'console.log("content");\n');
  fs.writeFileSync(
    path.join(rootDir, 'popup.js'),
    [
      'function formatTimestamp(value) {',
      "  return value || 'Never';",
      '}',
      'function humanizeStatus(value) {',
      "  return value || 'Unknown';",
      '}',
      'var runtimeContext = {',
      "  device_id: 'device-demo',",
      "  extension_version: '1.0.0',",
      "  rules_version: '1.0.0',",
      '};',
      'var CAT_COLORS = {',
      "  Network: { bg: 'rgba(56,189,248,0.15)', border: '#38bdf8', text: '#38bdf8' },",
      "  Credential: { bg: 'rgba(249,115,22,0.15)', border: '#f97316', text: '#fb923c' },",
      "  PII: { bg: 'rgba(52,211,153,0.15)', border: '#34d399', text: '#34d399' },",
      "  Financial: { bg: 'rgba(250,204,21,0.15)', border: '#facc15', text: '#facc15' },",
      "  MSP: { bg: 'rgba(232,121,249,0.15)', border: '#e879f9', text: '#e879f9' },",
      '};',
      'var SUPPORTED_PLATFORMS = [',
      "  { icon: '🤖', key: 'chatgpt', name: 'ChatGPT', host: 'chatgpt.com', url: 'https://chatgpt.com' },",
      '];',
      'function buildPlatformCoverageModel(settings) {',
      "  var report = settings && settings.logclean_platform_health && settings.logclean_platform_health.chatgpt || null;",
      '  return SUPPORTED_PLATFORMS.map(function(platform) {',
      '    return {',
      '      icon: platform.icon,',
      '      name: platform.name,',
      "      host: report && report.host || 'chatgpt.com',",
      '      url: platform.url,',
      "      statusLabel: report && report.trigger_attached ? 'Verified' : 'Not verified yet',",
      "      statusTone: report && report.trigger_attached ? 'ok' : 'muted',",
      "      detail: report && report.input_selector || 'No compatibility signal captured yet from this host.',",
      '    };',
      '  });',
      '}',
      'function describeResult(result, successText, emptyText) {',
      '  if (!result || !result.status) return emptyText;',
      "  if (result.status === 'ok') return successText + ' on ' + formatTimestamp(result.ts);",
      '  var parts = [humanizeStatus(result.status)];',
      "  if (typeof result.code === 'number') parts.push('HTTP ' + result.code);",
      '  if (result.message) parts.push(result.message);',
      '  if (result.ts) parts.push(formatTimestamp(result.ts));',
      "  return parts.join(' · ');",
      '}',
      'function buildManagedViewModel(settings) {',
      '  settings = settings || {};',
      '  var enrollmentResult = settings.logclean_last_enrollment_result || null;',
      '  var syncResult = settings.logclean_last_sync_result || null;',
      '  var auditUploadResult = settings.logclean_last_audit_upload_result || null;',
      '  return {',
      "    syncEnabled: true,",
      "    baseUrl: settings.logclean_control_plane_base_url || 'Not configured',",
      "    orgName: 'Fixture Org',",
      "    deviceId: 'device-demo',",
      "    extensionVersion: '1.0.0',",
      "    policyVersion: 'policy-demo',",
      "    rulesVersion: '1.0.0',",
      "    modeLabel: 'Managed sync enabled',",
      "    modeTone: 'info',",
      "    enrollmentLabel: enrollmentResult && enrollmentResult.status || 'unknown',",
      "    enrollmentTone: 'ok',",
      "    syncLabel: syncResult && syncResult.status || 'unknown',",
      "    syncTone: 'warn',",
      "    uploadLabel: auditUploadResult && auditUploadResult.status || 'unknown',",
      "    uploadTone: 'warn',",
      "    enrollmentDetail: describeResult(enrollmentResult, 'Enrollment completed', 'No enrollment attempt recorded.'),",
      "    syncDetail: describeResult(syncResult, 'Policy sync completed', 'No sync attempt recorded.'),",
      "    uploadDetail: describeResult(auditUploadResult, 'Latest metadata event uploaded', 'No metadata upload recorded.'),",
      "    insightSummary: 'Metadata-only owner insight.',",
      "    demoNextStep: 'Prepare managed demo.',",
      "    demoResetNote: 'Reset clears local state.',",
      "    demoFlowNote: 'Prepare re-enrolls and syncs.',",
      '  };',
      '}',
      'function setChip() {}',
      'function setText() {}',
      'function renderManagedStatus(settings) {',
      '  var view = buildManagedViewModel(settings || {});',
      "  setChip('managed-mode-chip', view.modeLabel, view.modeTone);",
      "  setChip('managed-enrollment-chip', view.enrollmentLabel, view.enrollmentTone);",
      "  setChip('managed-sync-chip', view.syncLabel, view.syncTone);",
      "  setText('managed-base-url', view.baseUrl);",
      "  setText('managed-org', view.orgName);",
      "  setText('managed-device-id', view.deviceId || 'Unknown');",
      "  setText('managed-extension-version', view.extensionVersion || 'Unknown');",
      "  setText('managed-policy-version', view.policyVersion || 'Unknown');",
      "  setText('managed-rules-version', view.rulesVersion || 'Unknown');",
      "  setText('managed-enrollment-detail', view.enrollmentDetail);",
      "  setText('managed-sync-detail', view.syncDetail);",
      "  setText('managed-upload-detail', view.uploadDetail);",
      "  setText('managed-insight-summary', view.insightSummary);",
      "  setText('managed-demo-next-step', view.demoNextStep);",
      "  setText('managed-demo-reset-note', view.demoResetNote);",
      "  setText('managed-demo-flow-note', view.demoFlowNote);",
      "  var syncButton = document.getElementById('managed-sync-btn');",
      "  ['managed-open-policy', 'managed-open-overview', 'managed-open-devices'].forEach(function(id) { document.getElementById(id); });",
      '  return syncButton;',
      '}',
      'function renderPlatformCoverage(settings) {',
      "  var platformList = document.getElementById('platform-list');",
      '  if (!platformList) return;',
      '  buildPlatformCoverageModel(settings).forEach(function(platform) {',
      '    return [platform.icon, platform.name, platform.host, platform.detail, platform.statusTone, platform.statusLabel, platform.url];',
      '  });',
      '}',
      'function initPopup() {',
      "  var rulesList = document.getElementById('rules-list');",
      '  var rulesByCategory = {};',
      '  LOGCLEAN_RULES.forEach(function(r) {',
      '    if (!rulesByCategory[r.category]) rulesByCategory[r.category] = [];',
      '    rulesByCategory[r.category].push(r);',
      '  });',
      "  chrome.storage.local.get(['logclean_active_rules'], function(data) {",
      "    var activeIds = data.logclean_active_rules || LOGCLEAN_RULES.map(function(r){ return r.id; });",
      '    Object.entries(rulesByCategory).forEach(function(entry) {',
      '      var cat = entry[0], rules = entry[1];',
      '      var c = CAT_COLORS[cat] || CAT_COLORS.Network;',
      "      var section = document.createElement('div');",
      "      section.className = 'settings-section';",
      "      var title = document.createElement('div');",
      "      title.className = 'settings-title';",
      "      title.innerHTML = '<span style=\"color:' + c.text + '\">' + cat + '</span>';",
      '      section.appendChild(title);',
      '      rules.forEach(function(rule) {',
      "        var row = document.createElement('label');",
      "        row.className = 'rule-row';",
      "        var checked = activeIds.indexOf(rule.id) !== -1;",
      "        var r = (typeof LOGCLEAN_PROTECTION !== 'undefined' && LOGCLEAN_PROTECTION[rule.risk]) || { emoji:'⚪', color:'#94a3b8', bg:'rgba(148,163,184,0.1)', border:'rgba(148,163,184,0.3)', label: rule.risk };",
      "        row.innerHTML = '<input type=\"checkbox\" id=\"rule_' + rule.id + '\"' + (checked ? ' checked' : '') + '/>' +",
      "          '<div><span>' + rule.label + '</span><span style=\"border-color:' + r.border + ';background:' + r.bg + ';color:' + r.color + '\">' + r.emoji + ' ' + r.label + '</span></div>';",
      '        section.appendChild(row);',
      '      });',
      '      rulesList.appendChild(section);',
      '    });',
      '  });',
      '}',
      'function renderOutput(result) {',
      "  var sum = logcleanGetSummary(result.findings);",
      "  var summaryEl = document.getElementById('p-summary');",
      "  document.getElementById('p-summary-count').textContent = sum.total + ' items redacted';",
      "  var catsEl = document.getElementById('p-summary-cats');",
      '  Object.entries(sum.byCategory).forEach(function() {});',
      '  Object.entries(sum.byProtection).forEach(function() {});',
      '  buildOutput(result.sanitized, result.tokens);',
      '  renderGuidance(result);',
      "  document.getElementById('p-output-wrap').style.display = 'block';",
      "  document.getElementById('p-guidance').style.display = 'block';",
      "  document.getElementById('p-safe-compose-wrap').style.display = 'block';",
      "  document.getElementById('p-actions').style.display = 'flex';",
      '  return [summaryEl, catsEl];',
      '}',
      'function renderGuidance(result) {',
      "  var pills = document.getElementById('p-guidance-pills');",
      "  document.getElementById('p-guidance-text').textContent = result.employee_explanation || '';",
      "  document.getElementById('p-safe-compose').value = result.safe_compose_prompt || '';",
      '  return pills;',
      '}',
      'function buildOutput() {',
      "  var el = document.getElementById('p-output');",
      '  return el;',
      '}',
      "sendRuntimeMessage({ type: 'GET_SETTINGS' });",
      "document.getElementById('platform-list');",
      "document.getElementById('managed-sync-btn');",
      '',
    ].join('\n')
  );
  fs.writeFileSync(path.join(rootDir, 'sidebar.css'), '.sidebar {}\n');
  fs.writeFileSync(
    path.join(rootDir, 'sidebar.css'),
    [
      ':root {',
      '  --cleanprompt-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '  --cleanprompt-font-mono: "SFMono-Regular", Consolas, monospace;',
      '}',
      '#logclean-trigger-wrap {}',
      '#logclean-trigger {}',
      '#logclean-sidebar {}',
      '#lc-toast-wrap {}',
      '.lc-toast {}',
      '.lc-toast-out {}',
      '#lc-header {}',
      '#lc-tabs {}',
      '.lc-tab {}',
      '.lc-tab-content {}',
      '#lc-raw-input {}',
      '#lc-redact-btn {}',
      '#lc-actions {}',
      '#lc-compose-btn {}',
      '#lc-insert-btn {}',
      '#lc-intercept-overlay {}',
      '#lc-intercept-modal {}',
      '#lc-intercept-preview {}',
      '#lc-intercept-justification-wrap {}',
      '#lc-intercept-justification {}',
      '',
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(rootDir, 'popup.html'),
    [
      '<html><head><title>CleanPrompt</title><style>:root { --cleanprompt-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; --cleanprompt-font-mono: "SFMono-Regular", Consolas, monospace; } .settings-section { margin-bottom: 14px; } .settings-title { font-size: 11px; } .rule-row { display: flex; }</style></head><body>',
      '<div class="logo-name">CleanPrompt</div>',
      '<div title="Raw prompt text stays on device.">🔒 Raw Text Local</div>',
      '<button class="tab" data-tab="clean"></button>',
      '<button class="tab" data-tab="platforms"></button>',
      '<button class="tab" data-tab="managed"></button>',
      '<div class="panel" id="panel-clean"></div>',
      '<div class="panel" id="panel-platforms"></div>',
      '<div class="panel" id="panel-managed"></div>',
      '<div id="p-summary"></div>',
      '<div id="p-summary-count"></div>',
      '<div id="p-summary-cats"></div>',
      '<div id="p-output-wrap"></div>',
      '<div id="p-output"></div>',
      '<div id="p-guidance"></div>',
      '<div id="p-guidance-pills"></div>',
      '<div id="p-guidance-text"></div>',
      '<textarea id="p-safe-compose"></textarea>',
      '<div id="p-safe-compose-wrap"></div>',
      '<div id="p-actions"></div>',
      '<div id="platform-list"></div>',
      '<div id="managed-mode-chip"></div>',
      '<div id="managed-enrollment-chip"></div>',
      '<div id="managed-sync-chip"></div>',
      '<div id="managed-base-url"></div>',
      '<div id="managed-org"></div>',
      '<div id="managed-device-id"></div>',
      '<div id="managed-extension-version"></div>',
      '<div id="managed-policy-version"></div>',
      '<div id="managed-rules-version"></div>',
      '<div id="managed-enrollment-detail"></div>',
      '<div id="managed-sync-detail"></div>',
      '<div id="managed-upload-detail"></div>',
      '<div id="managed-insight-summary"></div>',
      '<div id="managed-demo-next-step"></div>',
      '<div id="managed-demo-reset-note"></div>',
      '<div id="managed-demo-flow-note"></div>',
      '<button id="managed-sync-btn"></button>',
      '<button id="managed-open-policy"></button>',
      '<button id="managed-open-overview"></button>',
      '<button id="managed-open-devices"></button>',
      '<div id="rules-list"></div>',
      '</body></html>',
      '',
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(rootDir, 'engine', 'redactor.js'),
    [
      'var LOGCLEAN_RULES = [',
      "  { id:'EMAIL', label:'Email', category:'PII', risk:'medium', color:'#34d399', pattern:/\\\\b[a-z]+@[a-z]+\\\\.com\\\\b/g },",
      '];',
      'var LOGCLEAN_PROTECTION = {',
      "  critical: { label: 'Secured Token', emoji: '🛡️', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)' },",
      "  high: { label: 'Protected', emoji: '✅', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.4)' },",
      "  medium: { label: 'Cleaned', emoji: '✨', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.4)' },",
      "  low: { label: 'Anonymized', emoji: '🟢', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.4)' },",
      '};',
      'function logcleanBuildEventSummary(result) {',
      '  return {',
      "    schema_version: '1.0.0',",
      "    site: 'popup',",
      "    action: result.policy_action,",
      '    intent_label: result.intent_label,',
      "    sensitivity_categories: ['PII'],",
      '    count_summary: {',
      '      total: result.findings.length,',
      "      by_category: { PII: result.findings.length },",
      "      by_risk: { medium: result.findings.length },",
      '    },',
      '    justification_required: false,',
      '    justification_provided: false,',
      '  };',
      '}',
      'async function logcleanRedact(text) {',
      '  if (!text) {',
      '    return {',
      "      sanitized: '',",
      "      sanitized_text: '',",
      '      findings: [],',
      '      tokens: {},',
      '      protectionSummary: {},',
      '      rule_counts: {},',
      "      intent_label: 'other',",
      "      intent_confidence_bucket: 'low',",
      "      policy_action: 'allow',",
      "      employee_explanation: 'No content to process.',",
      "      safe_compose_prompt: '',",
      '      event_summary: null,',
      '    };',
      '  }',
      '  var result = {',
      "    sanitized: '[EMAIL_1]',",
      "    sanitized_text: '[EMAIL_1]',",
      "    findings: [{ id: 'EMAIL', label: 'Email', category: 'PII', risk: 'medium', count: 1 }],",
      "    tokens: { '[EMAIL_1]': 'demo@example.com' },",
      "    protectionSummary: { medium: 1 },",
      "    rule_counts: { EMAIL: 1 },",
      "    intent_label: 'other',",
      "    intent_confidence_bucket: 'low',",
      "    policy_action: 'warn',",
      "    employee_explanation: 'Fixture explanation',",
      "    safe_compose_prompt: 'Fixture safe compose',",
      '  };',
      '  result.event_summary = logcleanBuildEventSummary(result);',
      '  return result;',
      '}',
      '',
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(rootDir, 'content.js'),
    [
      'var CAT_COLORS = {',
      "  Network: { bg: 'rgba(56,189,248,0.15)', border: '#38bdf8', text: '#38bdf8' },",
      "  Credential: { bg: 'rgba(249,115,22,0.15)', border: '#f97316', text: '#fb923c' },",
      "  PII: { bg: 'rgba(52,211,153,0.15)', border: '#34d399', text: '#34d399' },",
      "  Financial: { bg: 'rgba(250,204,21,0.15)', border: '#facc15', text: '#facc15' },",
      "  MSP: { bg: 'rgba(232,121,249,0.15)', border: '#e879f9', text: '#e879f9' },",
      '};',
      "var platform = { key: 'chatgpt', name: 'ChatGPT' };",
      "function calculateCompatibilityConfidence() { return 'primary_path'; }",
      'function buildCompatibilityReport(reason) {',
      "  var inputCandidate = { selector: '#prompt-textarea', rank: 1, element: {} };",
      "  var toolbarCandidate = { strategy: 'parentElement', element: { tagName: 'DIV' } };",
      "  var sendButtonCandidate = { selector: 'button[type=\"submit\"]', rank: 1, element: {} };",
      '  var input = inputCandidate.element;',
      '  var toolbar = toolbarCandidate.element;',
      '  var triggerWrap = { parentElement: toolbar };',
      '  var sidebar = {};',
      '  var sendButton = sendButtonCandidate.element;',
      '  var report = {',
      "    host: 'chatgpt.com',",
      '    platform_key: platform.key,',
      '    platform_name: platform.name,',
      '    input_detected: Boolean(input),',
      '    toolbar_detected: Boolean(toolbar),',
      '    send_button_detected: Boolean(sendButton),',
      '    trigger_attached: Boolean(triggerWrap && triggerWrap.parentElement === toolbar),',
      '    sidebar_ready: Boolean(sidebar),',
      "    detection_reason: reason || 'runtime',",
      '    input_selector: inputCandidate.selector,',
      '    input_selector_rank: inputCandidate.rank,',
      '    toolbar_strategy: toolbarCandidate.strategy || null,',
      '    send_selector: sendButtonCandidate.selector,',
      '    send_selector_rank: sendButtonCandidate.rank,',
      "    attachment_container_tag: 'div',",
      "    ts: '2026-03-24T00:00:00.000Z',",
      '  };',
      '  report.compatibility_confidence = calculateCompatibilityConfidence(report);',
      '  return report;',
      '}',
      'function logcleanGetSummary(findings) {',
      '  return {',
      '    total: findings.length,',
      "    byCategory: { PII: findings.length },",
      "    byRisk: { medium: findings.length },",
      '  };',
      '}',
      'function renderOutput(result) {',
      '  var sum = logcleanGetSummary(result.findings);',
      "  var summaryEl = document.getElementById('lc-summary');",
      "  document.getElementById('lc-summary-count').textContent = sum.total + ' items redacted';",
      "  var catsEl = document.getElementById('lc-summary-cats');",
      '  Object.entries(sum.byCategory).forEach(function() {});',
      '  Object.entries(sum.byRisk).forEach(function() {});',
      '  buildOutputView(result.sanitized, result.tokens);',
      '  renderInsights(result);',
      "  document.getElementById('lc-output-wrap').style.display = 'block';",
      "  document.getElementById('lc-actions').style.display = 'flex';",
      '  buildFindings(result.findings, sum);',
      '  return [summaryEl, catsEl];',
      '}',
      'function buildOutputView(sanitized) {',
      "  var outputEl = document.getElementById('lc-output');",
      '  outputEl.textContent = sanitized;',
      '  return outputEl;',
      '}',
      'function renderInsights(result) {',
      "  var insightsEl = document.getElementById('lc-insights');",
      "  var safeComposeEl = document.getElementById('lc-safe-compose-wrap');",
      "  var intentPill = document.getElementById('lc-intent-pill');",
      "  var actionPill = document.getElementById('lc-action-pill');",
      "  var explanationEl = document.getElementById('lc-explanation');",
      "  var safeComposeOutput = document.getElementById('lc-safe-compose-output');",
      "  intentPill.textContent = result.intent_label || 'other';",
      "  actionPill.textContent = result.policy_action || 'warn';",
      "  explanationEl.textContent = result.employee_explanation || '';",
      "  safeComposeOutput.value = result.safe_compose_prompt || '';",
      "  insightsEl.style.display = 'block';",
      "  safeComposeEl.style.display = 'block';",
      '}',
      'function buildFindings(findings, sum) {',
      "  var findingsEl = document.getElementById('lc-findings-list');",
      "  findingsEl.innerHTML = '';",
      '  if (findings.length === 0) return;',
      "  document.getElementById('lc-findings').style.display = 'block';",
      '  findings.forEach(function(f) {',
      "    findingsEl.innerHTML += f.category + ':' + f.risk + ':' + f.count + ':' + f.label + ':' + sum.total;",
      '  });',
      '}',
      'function loadAudit() {',
      "  chrome.runtime.sendMessage({ type: 'GET_AUDIT_LOG' }, function(log) {",
      "    var el = document.getElementById('lc-audit-list');",
      '    if (!log || log.length === 0) {',
      "      el.innerHTML = 'No sessions';",
      '      return;',
      '    }',
      '    el.innerHTML = log.slice(0, 20).map(function(entry) {',
      "      return entry.ts + entry.url + entry.intent_label + entry.action + entry.categories.join(',') + entry.redacted_count;",
      "    }).join('');",
      '  });',
      '}',
      'function openInterceptModal(result) {',
      "  var overlay = document.getElementById('lc-intercept-overlay');",
      "  var preview = document.getElementById('lc-intercept-preview');",
      "  var policyEl = document.getElementById('lc-intercept-policy');",
      "  var guidanceEl = document.getElementById('lc-intercept-guidance');",
      "  var allowBtn = document.getElementById('lc-intercept-allow');",
      "  var justifyWrap = document.getElementById('lc-intercept-justification-wrap');",
      "  var findingsEl = document.getElementById('lc-intercept-findings');",
      '  var sum = logcleanGetSummary(result.findings);',
      "  preview.textContent = result.sanitized || '';",
      "  policyEl.textContent = result.policy_action || 'warn';",
      "  guidanceEl.textContent = result.employee_explanation || '';",
      "  allowBtn.textContent = result.policy_action === 'justify' ? 'Allow once with reason' : 'Allow once';",
      "  justifyWrap.style.display = result.policy_action === 'justify' ? 'block' : 'none';",
      "  findingsEl.innerHTML = String(sum.total) + ':' + Object.keys(sum.byCategory).join(',');",
      "  overlay.style.display = 'flex';",
      '}',
      "chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });",
      'document.getElementById(\'lc-intercept-preview\');',
      'document.getElementById(\'lc-intercept-justification\');',
      'document.getElementById(\'lc-toast-wrap\');',
      'var PLATFORMS = {',
      "  chatgpt: {",
      "    key: 'chatgpt',",
      "    test: function() { return /chatgpt\\.com/.test(location.hostname); },",
      '  },',
      '};',
      'const template = `',
      '<div id="logclean-sidebar"></div>',
      '<div id="lc-logo-text">CleanPrompt</div>',
      '<div id="lc-header"></div>',
      '<div id="lc-tabs"></div>',
      '<button class="lc-tab"></button>',
      '<div class="lc-tab-content"></div>',
      '<div id="logclean-trigger-wrap"></div>',
      '<button id="logclean-trigger"></button>',
      '<textarea id="lc-raw-input"></textarea>',
      '<button id="lc-redact-btn"></button>',
      '<div id="lc-actions"></div>',
      '<button id="lc-compose-btn"></button>',
      '<button id="lc-insert-btn"></button>',
      '<div id="lc-summary"></div>',
      '<div id="lc-summary-count"></div>',
      '<div id="lc-summary-cats"></div>',
      '<div id="lc-output-wrap"></div>',
      '<div id="lc-output"></div>',
      '<div id="lc-insights"></div>',
      '<div id="lc-safe-compose-wrap"></div>',
      '<div id="lc-intent-pill"></div>',
      '<div id="lc-action-pill"></div>',
      '<div id="lc-explanation"></div>',
      '<textarea id="lc-safe-compose-output"></textarea>',
      '<div id="lc-findings"></div>',
      '<div id="lc-findings-list"></div>',
      '<div id="lc-audit-list"></div>',
      '<div id="lc-intercept-overlay"></div>',
      '<div id="lc-intercept-modal"></div>',
      '<pre id="lc-intercept-preview"></pre>',
      '<div id="lc-intercept-policy"></div>',
      '<div id="lc-intercept-guidance"></div>',
      '<button id="lc-intercept-allow"></button>',
      '<div id="lc-intercept-findings"></div>',
      '<div id="lc-intercept-justification-wrap"></div>',
      '<textarea id="lc-intercept-justification"></textarea>',
      '`;',
      'var toastWrap = document.createElement(\'div\');',
      'toastWrap.id = \'lc-toast-wrap\';',
      'document.body.appendChild(toastWrap);',
      'var toast = `<div class="lc-toast-title">CleanPrompt Active</div>`;',
      'var trust = `<div>Raw prompts stay local</div>`;',
      'sidebar.querySelectorAll(\'.lc-tab\');',
      'var tabs = `<button class="lc-tab" data-tab="paste"></button><button class="lc-tab" data-tab="audit"></button>`;',
      '',
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(rootDir, 'types', 'popup-runtime.d.ts'),
    [
      'export interface PopupManagedViewModel {',
      '  syncEnabled: boolean;',
      '  baseUrl: string;',
      '  orgName: string;',
      '  deviceId: string;',
      '  extensionVersion: string;',
      '  policyVersion: string;',
      '  rulesVersion: string;',
      '  modeLabel: string;',
      '  modeTone: string;',
      '  enrollmentLabel: string;',
      '  enrollmentTone: string;',
      '  syncLabel: string;',
      '  syncTone: string;',
      '  enrollmentDetail: string;',
      '  syncDetail: string;',
      '  uploadDetail: string;',
      '  uploadLabel: string;',
      '  uploadTone: string;',
      '  insightSummary: string;',
      '  demoNextStep: string;',
      '  demoResetNote: string;',
      '  demoFlowNote: string;',
      '}',
      '',
      'export interface PopupPlatformCoverageItem {',
      '  icon: string;',
      '  name: string;',
      '  host: string;',
      '  url: string;',
      '  statusLabel: string;',
      '  statusTone: string;',
      '  detail: string;',
      '}',
      '',
      'export interface PopupRedactionSummary {',
      '  total: number;',
      '  byCategory: Record<string, number>;',
      '  byProtection: Record<string, number>;',
      '  byRisk: Record<string, number>;',
      '}',
      '',
      'export interface PopupRuleListItem {',
      '  id: string;',
      '  label: string;',
      '  category: string;',
      '  risk: string;',
      '  color: string;',
      '}',
      '',
      'export interface PopupProtectionLevel {',
      '  emoji: string;',
      '  label: string;',
      '  color: string;',
      '  bg: string;',
      '  border: string;',
      '}',
      '',
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(rootDir, 'types', 'extension-runtime.d.ts'),
    [
      'export interface StatusResult {',
      '  status: string;',
      '  ts: string;',
      '  endpoint?: string;',
      '  code?: number;',
      '  message?: string;',
      '  reason?: string;',
      '  step?: string;',
      '  device_id?: string | null;',
      '  policy_version?: string | null;',
      '  action?: string;',
      '  site?: string;',
      '  validation_error?: string;',
      '  enrollment_reason?: string;',
      '}',
      '',
      'export interface PlatformHealthReport {',
      '  host: string;',
      '  platform_key: string;',
      '  platform_name: string;',
      '  input_detected: boolean;',
      '  toolbar_detected: boolean;',
      '  send_button_detected: boolean;',
      '  trigger_attached: boolean;',
      '  sidebar_ready: boolean;',
      '  detection_reason: string;',
      '  input_selector: string | null;',
      '  input_selector_rank: number | null;',
      '  toolbar_strategy: string | null;',
      '  send_selector: string | null;',
      '  send_selector_rank: number | null;',
      '  attachment_container_tag: string | null;',
      '  compatibility_confidence: string;',
      '  ts: string;',
      '}',
      '',
      'export interface LocalAuditLogEntry {',
      '  ts: string;',
      '  url: string;',
      '  redacted_count: number;',
      '  categories: string[];',
      '  risk_summary: Record<string, number>;',
      '  action: string;',
      '  intent_label: string;',
      '}',
      '',
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(rootDir, 'types', 'content-runtime.d.ts'),
    [
      'export interface RedactionFinding {',
      '  id: string;',
      '  label: string;',
      '  category: string;',
      '  risk: string;',
      '  count: number;',
      '}',
      '',
      'export interface ContentRedactionSummary {',
      '  total: number;',
      '  byCategory: Record<string, number>;',
      '  byRisk: Record<string, number>;',
      '}',
      '',
    ].join('\n')
  );
  fs.writeFileSync(path.join(rootDir, 'engine', 'ner-worker.js'), 'console.log("worker");\n');
  fs.writeFileSync(path.join(rootDir, 'engine', 'transformers.min.js'), 'export const env = {}; export async function pipeline() {}\n');
  fs.writeFileSync(path.join(rootDir, 'icons', 'icon16.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
  fs.writeFileSync(path.join(rootDir, 'icons', 'icon48.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
  fs.writeFileSync(path.join(rootDir, 'icons', 'icon128.png'), Buffer.from('89504e470d0a1a0a', 'hex'));

  fs.writeFileSync(
    path.join(rootDir, 'manifest.json'),
    JSON.stringify({
      manifest_version: 3,
      name: 'CleanPrompt',
      version: '1.2.0',
      description: 'CleanPrompt local-first asset verifier fixture',
      author: 'CleanPrompt',
      permissions: ['activeTab', 'storage'],
      host_permissions: [
        'http://localhost:8787/*',
        'https://chatgpt.com/*',
      ],
      background: {
        service_worker: 'background.js',
      },
      content_scripts: [
        {
          matches: ['https://chatgpt.com/*'],
          js: ['engine/redactor.js', 'content.js'],
          css: ['sidebar.css'],
        },
      ],
      action: {
        default_popup: 'popup.html',
        default_icon: {
          '16': 'icons/icon16.png',
          '48': 'icons/icon48.png',
          '128': 'icons/icon128.png',
        },
      },
      icons: {
        '16': 'icons/icon16.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png',
      },
      web_accessible_resources: [
        {
          resources: [
            'icons/*',
            'engine/ner-worker.js',
            'engine/transformers.min.js',
            'engine/rules.json',
          ],
          matches: ['https://chatgpt.com/*'],
        },
      ],
      content_security_policy: {
        extension_pages: "script-src 'self'; object-src 'self'",
      },
    }, null, 2)
  );

  fs.writeFileSync(
    path.join(rootDir, 'engine', 'rules.json'),
    JSON.stringify({
      version: '1.0.0',
      released: '2026-03-24',
      description: 'Fixture rule bundle',
      rules: [
        {
          id: 'EMAIL',
          label: 'Email',
          category: 'PII',
          risk: 'medium',
          pattern: '\\\\b[a-z]+@[a-z]+\\\\.com\\\\b',
          flags: 'g',
        },
      ],
    }, null, 2)
  );

  return rootDir;
}

function writeBackgroundMessageFixture(rootDir) {
  fs.writeFileSync(
    path.join(rootDir, 'background.js'),
    [
      'function buildSyncResult(status, extra) {',
      '  return Object.assign({',
      '    status: status,',
      "    ts: '2026-03-24T00:00:00.000Z',",
      '  }, extra || {});',
      '}',
      'function buildEnrollmentResult(status, extra) {',
      '  return Object.assign({',
      '    status: status,',
      "    ts: '2026-03-24T00:00:00.000Z',",
      '  }, extra || {});',
      '}',
      'function buildAuditUploadResult(status, extra) {',
      '  return Object.assign({',
      '    status: status,',
      "    ts: '2026-03-24T00:00:00.000Z',",
      '  }, extra || {});',
      '}',
      'function createDefaultSettings() {',
      '  return {',
      "    logclean_rules_override: null,",
      "    logclean_policy_bundle: { policy_version: 'demo' },",
      "    logclean_device_id: 'device-demo',",
      "    logclean_control_plane_base_url: 'http://127.0.0.1:8787',",
      "    logclean_platform_health: {},",
      "    logclean_rules_version: '1.0.0',",
      '  };',
      '}',
      'function resetExtensionDemoState() {',
      '  chrome.storage.local.set({ logclean_active_rules: null });',
      '}',
      "const baseUrl = 'http://127.0.0.1:8787';",
      "chrome.storage.local.get(['logclean_policy_bundle', 'logclean_device_id'], function() {});",
      "if (msg.type === 'GET_SETTINGS') {",
      "  readLocalStorage(['logclean_policy_bundle', 'logclean_device_id', 'logclean_control_plane_base_url', 'logclean_platform_health'], function() {});",
      "  result.device_id = 'device-demo';",
      "  result.extension_version = '1.0.0';",
      "  result.policy_version = 'policy-demo';",
      "  result.rules_version = '1.0.0';",
      "  result.rotating_actor_id = 'actor-demo';",
      "  result.logclean_control_plane_base_url = baseUrl;",
      "  result.logclean_last_enrollment_result = buildEnrollmentResult('ok', { endpoint: baseUrl, device_id: 'device-demo', message: 'Enrolled' });",
      "  result.logclean_last_sync_result = buildSyncResult('invalid_policy_bundle', { endpoint: baseUrl, code: 409, validation_error: 'schema', policy_version: 'policy-demo' });",
      "  result.logclean_last_audit_upload_result = buildAuditUploadResult('enrollment_required', { endpoint: baseUrl, enrollment_reason: 'missing_enrollment_token', message: 'token missing', site: 'chatgpt', action: 'warn' });",
      '}',
      "buildEnrollmentResult('ok', { endpoint: baseUrl, device_id: 'device-demo' });",
      "buildSyncResult('invalid_policy_bundle', { endpoint: baseUrl, code: 409, validation_error: 'schema' });",
      "buildAuditUploadResult('enrollment_required', { endpoint: baseUrl, enrollment_reason: 'missing_enrollment_token', message: 'token missing' });",
      'function normalizePlatformHealthReport(report) {',
      '  var source = report || {};',
      '  return {',
      "    host: source.host || 'unknown',",
      "    platform_key: source.platform_key || 'unknown',",
      "    platform_name: source.platform_name || 'Unknown',",
      '    input_detected: Boolean(source.input_detected),',
      '    toolbar_detected: Boolean(source.toolbar_detected),',
      '    send_button_detected: Boolean(source.send_button_detected),',
      '    trigger_attached: Boolean(source.trigger_attached),',
      '    sidebar_ready: Boolean(source.sidebar_ready),',
      "    detection_reason: source.detection_reason || 'runtime',",
      '    input_selector: source.input_selector || null,',
      '    input_selector_rank: source.input_selector_rank || null,',
      '    toolbar_strategy: source.toolbar_strategy || null,',
      '    send_selector: source.send_selector || null,',
      '    send_selector_rank: source.send_selector_rank || null,',
      '    attachment_container_tag: source.attachment_container_tag || null,',
      "    compatibility_confidence: source.compatibility_confidence || 'needs_review',",
      "    ts: source.ts || '2026-03-24T00:00:00.000Z',",
      '  };',
      '}',
      "if (msg.type === 'LOG_AUDIT') {}",
      "if (msg.type === 'GET_AUDIT_LOG') {",
      '  auditLog.unshift({',
      "    ts: new Date().toISOString(),",
      "    url: 'chatgpt.com',",
      '    redacted_count: 1,',
      "    categories: ['PII'],",
      "    action: 'warn',",
      "    intent_label: 'support',",
      '  });',
      '}',
      "if (msg.type === 'REPORT_PLATFORM_HEALTH') {}",
      '',
    ].join('\n')
  );
}

test('extension asset verifier accepts the current shipped asset shape', () => {
  const result = verifyExtensionAssets({
    rootDir: path.resolve(__dirname, '..'),
  });

  assert.equal(result.manifest.manifest_version, 3);
  assert.equal(result.manifest.background.service_worker, 'background.js');
  assert.ok(result.contentScriptMatchCount >= 4);
  assert.ok(result.accessibleFileCount >= 4);
  assert.ok(result.ruleCount >= 1);
  assert.ok(result.popupHookCount >= 10);
  assert.ok(result.popupTabCount >= 3);
  assert.ok(result.sidebarSelectorCount >= 10);
  assert.ok(result.contentReferencedIdCount >= 10);
  assert.ok(result.contentCreatedIdCount >= 10);
  assert.ok(result.supportedHostSurfaceCount >= 6);
  assert.ok(result.platformMatcherCount >= 4);
  assert.ok(result.popupUrlCount >= 1);
  assert.ok(result.backgroundUrlCount >= 1);
  assert.ok(result.manifestRemoteHostCount >= 4);
  assert.ok(result.backgroundManagedStorageKeyCount >= 10);
  assert.ok(result.backgroundReadStorageKeyCount >= 10);
  assert.ok(result.popupStorageKeyCount >= 1);
  assert.ok(result.contentStorageKeyCount >= 1);
  assert.ok(result.getSettingsProviderFieldCount >= 10);
  assert.ok(result.popupGetSettingsFieldCount >= 5);
  assert.ok(result.contentGetSettingsFieldCount >= 5);
  assert.ok(result.auditLogEntryFieldCount >= 5);
  assert.ok(result.contentAuditEntryFieldCount >= 5);
  assert.ok(result.redactionResultProviderFieldCount >= 8);
  assert.ok(result.redactionResultConsumerFieldCount >= 5);
  assert.ok(result.redactionEventSummaryFieldCount >= 5);
  assert.ok(result.redactionEventSummaryConsumerFieldCount >= 4);
  assert.ok(result.redactionCountSummaryFieldCount >= 2);
  assert.ok(result.redactionCountSummaryConsumerFieldCount >= 2);
  assert.ok(result.bundledRuleSurfaceCount >= 1);
  assert.ok(result.bundledRuleCategoryCount >= 1);
  assert.ok(result.bundledRuleRiskCount >= 1);
  assert.ok(result.protectionRiskCount >= 4);
  assert.ok(result.popupCategoryPaletteCount >= 3);
  assert.ok(result.contentCategoryPaletteCount >= 3);
  assert.ok(result.normalizedPlatformHealthFieldCount >= 10);
  assert.ok(result.contentPlatformHealthFieldCount >= 10);
  assert.ok(result.popupPlatformHealthFieldCount >= 5);
  assert.ok(result.typedPlatformHealthFieldCount >= 10);
  assert.ok(result.emittedStatusResultFieldCount >= 5);
  assert.ok(result.popupStatusResultFieldCount >= 4);
  assert.ok(result.typedStatusResultFieldCount >= 5);
  assert.ok(result.managedViewModelFieldCount >= 10);
  assert.ok(result.managedViewRenderFieldCount >= 10);
  assert.ok(result.managedViewDomIdCount >= 10);
  assert.ok(result.typedManagedViewFieldCount >= 10);
  assert.ok(result.platformCoverageViewModelFieldCount >= 5);
  assert.ok(result.platformCoverageRenderFieldCount >= 5);
  assert.ok(result.platformCoverageDomIdCount >= 1);
  assert.ok(result.typedPlatformCoverageFieldCount >= 5);
  assert.ok(result.popupCleanSummaryFieldCount >= 2);
  assert.ok(result.popupCleanDomIdCount >= 5);
  assert.ok(result.typedPopupSummaryFieldCount >= 4);
  assert.ok(result.popupRuleFieldCount >= 4);
  assert.ok(result.popupProtectionFieldCount >= 4);
  assert.ok(result.popupRulesHookCount >= 4);
  assert.ok(result.typedPopupRuleFieldCount >= 4);
  assert.ok(result.typedPopupProtectionFieldCount >= 4);
  assert.ok(result.contentReviewSummaryFieldCount >= 2);
  assert.ok(result.contentReviewFindingFieldCount >= 4);
  assert.ok(result.contentReviewAuditFieldCount >= 5);
  assert.ok(result.contentReviewDomIdCount >= 10);
  assert.ok(result.typedContentSummaryFieldCount >= 3);
  assert.ok(result.typedContentFindingFieldCount >= 5);
  assert.ok(result.typedContentAuditFieldCount >= 6);
  assert.ok(result.popupOutboundMessageCount >= 1);
  assert.ok(result.contentOutboundMessageCount >= 1);
  assert.ok(result.backgroundHandledMessageCount >= 4);
  assert.ok(result.iconFileCount >= 3);
  assert.ok(result.brandingSurfaceCount >= 10);
});

test('manifest verifier rejects content script matches outside host permissions', () => {
  const rootDir = createFixtureRoot();
  const manifestPath = path.join(rootDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.content_scripts[0].matches.push('https://claude.ai/*');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  assert.throws(
    () => verifyManifest({ rootDir }),
    /content_script_match_not_in_host_permissions:https:\/\/claude\.ai\/\*/
  );
});

test('manifest verifier rejects web-accessible match drift', () => {
  const rootDir = createFixtureRoot();
  const manifestPath = path.join(rootDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.web_accessible_resources[0].matches = ['https://chat.openai.com/*'];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  assert.throws(
    () => verifyManifest({ rootDir }),
    /web_resource_match_drift:0/
  );
});

test('rule verifier rejects duplicate ids and invalid regex flags', () => {
  const rootDir = createFixtureRoot();
  const rulesPath = path.join(rootDir, 'engine', 'rules.json');
  const bundle = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  bundle.rules.push({
    id: 'EMAIL',
    label: 'Email Duplicate',
    category: 'PII',
    risk: 'medium',
    pattern: '.+',
    flags: 'gg',
  });
  fs.writeFileSync(rulesPath, JSON.stringify(bundle, null, 2));

  assert.throws(
    () => verifyRuleBundle({ rootDir }),
    /duplicate_rule_id:EMAIL/
  );
});

test('rule verifier rejects malformed regex patterns', () => {
  const rootDir = createFixtureRoot();
  const rulesPath = path.join(rootDir, 'engine', 'rules.json');
  const bundle = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  bundle.rules[0].pattern = '[unterminated';
  fs.writeFileSync(rulesPath, JSON.stringify(bundle, null, 2));

  assert.throws(
    () => verifyRuleBundle({ rootDir }),
    /invalid_rule_regex:EMAIL:/
  );
});

test('popup verifier rejects ids referenced in popup.js but missing in popup.html', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(path.join(rootDir, 'popup.js'), "document.getElementById('missing-id');\n");

  assert.throws(
    () => verifyPopupStructure({ rootDir }),
    /missing_popup_id:missing-id/
  );
});

test('sidebar verifier rejects missing critical CSS selectors', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(path.join(rootDir, 'sidebar.css'), '#logclean-sidebar {}\n');

  assert.throws(
    () => verifySidebarStructure({ rootDir }),
    /missing_sidebar_selector:#logclean-trigger-wrap/
  );
});

test('content verifier rejects ids referenced in content.js but never created by the script', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'content.js'),
    [
      'document.getElementById(\'missing-content-id\');',
      'const template = `<div id="lc-header"></div>`;',
      '',
    ].join('\n')
  );

  assert.throws(
    () => verifyContentStructure({ rootDir }),
    /missing_content_created_id:missing-content-id/
  );
});

test('supported-host verifier rejects popup and manifest host drift', () => {
  const rootDir = createFixtureRoot();
  const manifestPath = path.join(rootDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.content_scripts[0].matches.push('https://claude.ai/*');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  assert.throws(
    () => verifySupportedHostCoverage({ rootDir }),
    /supported_host_surface_drift/
  );
});

test('supported-host verifier rejects popup hosts not matched by content platform regex', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'content.js'),
    [
      'var PLATFORMS = {',
      "  chatgpt: {",
      "    key: 'chatgpt',",
      "    test: function() { return /claude\\.ai/.test(location.hostname); },",
      '  },',
      '};',
      "document.getElementById('lc-header');",
      'const template = `<div id="lc-header"></div>`;',
      '',
    ].join('\n')
  );

  assert.throws(
    () => verifySupportedHostCoverage({ rootDir }),
    /content_platform_host_mismatch:chatgpt:chatgpt\.com/
  );
});

test('presentation verifier rejects invalid icon payloads', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(path.join(rootDir, 'icons', 'icon16.png'), 'not-a-png');

  assert.throws(
    () => verifyPresentationAssets({ rootDir }),
    /invalid_png_icon:icons\/icon16\.png/
  );
});

test('presentation verifier rejects missing CleanPrompt branding in popup surface', () => {
  const rootDir = createFixtureRoot();
  const popupPath = path.join(rootDir, 'popup.html');
  const popupHtml = fs.readFileSync(popupPath, 'utf8').replace('<title>CleanPrompt</title>', '<title>Something Else</title>');
  fs.writeFileSync(popupPath, popupHtml);

  assert.throws(
    () => verifyPresentationAssets({ rootDir }),
    /missing_popup_title_brand/
  );
});

test('runtime-url verifier rejects unexpected remote popup hosts', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'popup.js'),
    [
      'var SUPPORTED_PLATFORMS = [',
      "  { icon: '🤖', key: 'chatgpt', name: 'ChatGPT', host: 'chatgpt.com', url: 'https://evil.example.com' },",
      '];',
      '',
    ].join('\n')
  );

  assert.throws(
    () => verifyRuntimeUrlDependencies({ rootDir }),
    /unexpected_popup_url_host:evil\.example\.com/
  );
});

test('runtime-url verifier rejects embedded remote urls in shipped runtime files', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(path.join(rootDir, 'content.js'), "const url = 'https://evil.example.com/sdk.js';\n");

  assert.throws(
    () => verifyRuntimeUrlDependencies({ rootDir }),
    /unexpected_embedded_runtime_url:content\.js/
  );
});

test('runtime-message verifier rejects popup message types not handled by background', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'popup.js'),
    [
      "sendRuntimeMessage({ type: 'UNKNOWN_MESSAGE' });",
      '',
    ].join('\n')
  );

  assert.throws(
    () => verifyRuntimeMessageSurface({ rootDir }),
    /unhandled_popup_message_type:UNKNOWN_MESSAGE/
  );
});

test('runtime-message verifier rejects content message types not handled by background', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'content.js'),
    [
      "chrome.runtime.sendMessage({ type: 'UNKNOWN_CONTENT_MESSAGE' });",
      'const template = `<div id="lc-header"></div>`;',
      '',
    ].join('\n')
  );

  assert.throws(
    () => verifyRuntimeMessageSurface({ rootDir }),
    /unhandled_content_message_type:UNKNOWN_CONTENT_MESSAGE/
  );
});

test('storage-contract verifier rejects popup storage keys not managed by background', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'popup.js'),
    [
      "chrome.storage.local.get(['logclean_unknown_popup_key'], function() {});",
      '',
    ].join('\n')
  );

  assert.throws(
    () => verifyStorageContract({ rootDir }),
    /undeclared_popup_storage_key:logclean_unknown_popup_key/
  );
});

test('storage-contract verifier rejects content storage keys not managed by background', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'content.js'),
    [
      "chrome.storage.local.get(['logclean_unknown_content_key'], function() {});",
      'const template = `<div id="lc-header"></div>`;',
      '',
    ].join('\n')
  );

  assert.throws(
    () => verifyStorageContract({ rootDir }),
    /undeclared_content_storage_key:logclean_unknown_content_key/
  );
});

test('storage-contract verifier rejects background reads for undeclared storage keys', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'background.js'),
    [
      'function createDefaultSettings() {',
      '  return {',
      "    logclean_device_id: 'device-demo',",
      '  };',
      '}',
      "chrome.storage.local.get(['logclean_policy_bundle'], function() {});",
      '',
    ].join('\n')
  );

  assert.throws(
    () => verifyStorageContract({ rootDir }),
    /unmanaged_background_storage_key:logclean_policy_bundle/
  );
});

test('runtime-response verifier rejects popup GET_SETTINGS fields not provided by background', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'popup.js'),
    [
      "sendRuntimeMessage({ type: 'GET_SETTINGS' }).then(function(settings) {",
      "  return settings.logclean_missing_field;",
      '});',
      '',
    ].join('\n')
  );

  assert.throws(
    () => verifyRuntimeResponseSurface({ rootDir }),
    /missing_get_settings_response_field_for_popup:logclean_missing_field/
  );
});

test('runtime-response verifier rejects content GET_SETTINGS fields not provided by background', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'content.js'),
    [
      "chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, function(settings) {",
      "  return settings.missing_runtime_field;",
      '});',
      "chrome.runtime.sendMessage({ type: 'GET_AUDIT_LOG' }, function(log) {});",
      'const template = `<div id="lc-header"></div>`;',
      '',
    ].join('\n')
  );

  assert.throws(
    () => verifyRuntimeResponseSurface({ rootDir }),
    /missing_get_settings_response_field_for_content:missing_runtime_field/
  );
});

test('runtime-response verifier rejects audit-log fields not produced by background', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'content.js'),
    [
      "chrome.runtime.sendMessage({ type: 'GET_AUDIT_LOG' }, function(log) {",
      '  return log.map(function(entry) {',
      '    return entry.device_id;',
      '  });',
      '});',
      "chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, function(settings) { return settings.device_id; });",
      'const template = `<div id="lc-header"></div>`;',
      '',
    ].join('\n')
  );

  assert.throws(
    () => verifyRuntimeResponseSurface({ rootDir }),
    /missing_audit_log_entry_field:device_id/
  );
});

test('redaction-result verifier rejects popup fields not provided by logcleanRedact', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'popup.js'),
    [
      'function renderGuidance(result) {',
      '  return result.safe_compose_prompt;',
      '}',
      '',
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(rootDir, 'engine', 'redactor.js'),
    [
      'function logcleanBuildEventSummary(result) {',
      '  return {',
      "    action: result.policy_action,",
      "    intent_label: 'other',",
      "    sensitivity_categories: ['PII'],",
      '    count_summary: {',
      '      total: 1,',
      "      by_category: { PII: 1 },",
      "      by_risk: { medium: 1 },",
      '    },',
      '    justification_required: false,',
      '    justification_provided: false,',
      '  };',
      '}',
      'async function logcleanRedact(text) {',
      '  if (!text) {',
        '    return {',
      "      sanitized: '',",
      "      sanitized_text: '',",
      '      findings: [],',
      '      tokens: {},',
      '      protectionSummary: {},',
      '      rule_counts: {},',
      "      intent_label: 'other',",
      "      intent_confidence_bucket: 'low',",
      "      policy_action: 'allow',",
      "      employee_explanation: 'No content to process.',",
      '      event_summary: null,',
      '    };',
      '  }',
      '  var result = {',
      "    sanitized: '[EMAIL_1]',",
      "    sanitized_text: '[EMAIL_1]',",
      "    findings: [{ id: 'EMAIL', label: 'Email', category: 'PII', risk: 'medium', count: 1 }],",
      "    tokens: { '[EMAIL_1]': 'demo@example.com' },",
      "    protectionSummary: { medium: 1 },",
      "    rule_counts: { EMAIL: 1 },",
      "    intent_label: 'other',",
      "    intent_confidence_bucket: 'low',",
      "    policy_action: 'warn',",
      "    employee_explanation: 'Fixture explanation',",
      '  };',
      '  result.event_summary = logcleanBuildEventSummary(result);',
      '  return result;',
      '}',
      '',
    ].join('\n')
  );

  assert.throws(
    () => verifyRedactionResultSurface({ rootDir }),
    /missing_redaction_result_field:safe_compose_prompt/
  );
});

test('redaction-result verifier rejects content event-summary fields not provided by engine', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'content.js'),
    [
      'function logMetadataEvent(result) {',
      '  var eventSummary = result.event_summary;',
      '  return eventSummary.missing_event_summary_field;',
      '}',
      '',
    ].join('\n')
  );

  assert.throws(
    () => verifyRedactionResultSurface({ rootDir }),
    /missing_redaction_event_summary_field:missing_event_summary_field/
  );
});

test('redaction-result verifier rejects content count-summary fields not provided by engine', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'content.js'),
    [
      'function logMetadataEvent(result) {',
      '  var eventSummary = result.event_summary;',
      '  return eventSummary.count_summary.missing_bucket;',
      '}',
      '',
    ].join('\n')
  );

  assert.throws(
    () => verifyRedactionResultSurface({ rootDir }),
    /missing_redaction_count_summary_field:missing_bucket/
  );
});

test('rule-metadata verifier rejects bundled rule drift between redactor and rules.json', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'engine', 'redactor.js'),
    fs.readFileSync(path.join(rootDir, 'engine', 'redactor.js'), 'utf8').replace("label:'Email'", "label:'Email Drift'")
  );

  assert.throws(
    () => verifyRuleMetadataSurface({ rootDir }),
    /rule_label_drift:EMAIL/
  );
});

test('rule-metadata verifier rejects missing popup category palette coverage', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'popup.js'),
    fs.readFileSync(path.join(rootDir, 'popup.js'), 'utf8').replace(/\s*PII:\s*\{[^}]+\},\n/, '\n')
  );

  assert.throws(
    () => verifyRuleMetadataSurface({ rootDir }),
    /missing_popup_category_palette:PII/
  );
});

test('rule-metadata verifier rejects missing protection metadata for active rule risks', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'engine', 'redactor.js'),
    fs.readFileSync(path.join(rootDir, 'engine', 'redactor.js'), 'utf8').replace(/medium:[\s\S]*?\n  low:/, "low:")
  );

  assert.throws(
    () => verifyRuleMetadataSurface({ rootDir }),
    /missing_protection_risk:medium/
  );
});

test('platform-health verifier rejects content fields not normalized by background', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'background.js'),
    fs.readFileSync(path.join(rootDir, 'background.js'), 'utf8').replace(/\s*send_selector:\s*source\.send_selector \|\| null,\n/, '\n')
  );

  assert.throws(
    () => verifyPlatformHealthSurface({ rootDir }),
    /missing_normalized_platform_health_field:send_selector/
  );
});

test('platform-health verifier rejects popup fields not provided by normalized background report', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'popup.js'),
    fs.readFileSync(path.join(rootDir, 'popup.js'), 'utf8').replace('report.input_selector', 'report.missing_popup_field')
  );

  assert.throws(
    () => verifyPlatformHealthSurface({ rootDir }),
    /missing_popup_platform_health_field:missing_popup_field/
  );
});

test('platform-health verifier rejects normalized fields missing from the shared type', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'types', 'extension-runtime.d.ts'),
    fs.readFileSync(path.join(rootDir, 'types', 'extension-runtime.d.ts'), 'utf8').replace(/\s*compatibility_confidence: string;\n/, '\n')
  );

  assert.throws(
    () => verifyPlatformHealthSurface({ rootDir }),
    /missing_typed_platform_health_field:compatibility_confidence/
  );
});

test('status-result verifier rejects popup fields not emitted by background builders', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'popup.js'),
    fs.readFileSync(path.join(rootDir, 'popup.js'), 'utf8').replace('result.message', 'result.reason')
  );
  fs.writeFileSync(
    path.join(rootDir, 'background.js'),
    fs.readFileSync(path.join(rootDir, 'background.js'), 'utf8').replace(/\s*message: 'token missing',\n/, '\n')
  );

  assert.throws(
    () => verifyStatusResultSurface({ rootDir }),
    /missing_emitted_status_result_field:reason/
  );
});

test('status-result verifier rejects emitted background fields missing from the shared type', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'background.js'),
    fs.readFileSync(path.join(rootDir, 'background.js'), 'utf8').replace(
      "buildSyncResult('invalid_policy_bundle', { endpoint: baseUrl, code: 409, validation_error: 'schema' });",
      "buildSyncResult('invalid_policy_bundle', { endpoint: baseUrl, code: 409, validation_error: 'schema', debug_trace: 'trace-demo' });"
    )
  );

  assert.throws(
    () => verifyStatusResultSurface({ rootDir }),
    /missing_typed_status_result_field:debug_trace/
  );
});

test('status-result verifier rejects popup-consumed fields missing from the shared type', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'types', 'extension-runtime.d.ts'),
    fs.readFileSync(path.join(rootDir, 'types', 'extension-runtime.d.ts'), 'utf8').replace(/\s*message\?: string;\n/, '\n')
  );

  assert.throws(
    () => verifyStatusResultSurface({ rootDir }),
    /missing_typed_status_result_field:message/
  );
});

test('managed-view verifier rejects render fields missing from the managed view model builder', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'popup.js'),
    fs.readFileSync(path.join(rootDir, 'popup.js'), 'utf8').replace('view.demoFlowNote', 'view.missingManagedField')
  );

  assert.throws(
    () => verifyManagedViewModelSurface({ rootDir }),
    /missing_render_managed_view_field:missingManagedField/
  );
});

test('managed-view verifier rejects builder fields missing from the shared popup type', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'types', 'popup-runtime.d.ts'),
    fs.readFileSync(path.join(rootDir, 'types', 'popup-runtime.d.ts'), 'utf8').replace(/\s*demoFlowNote: string;\n/, '\n')
  );

  assert.throws(
    () => verifyManagedViewModelSurface({ rootDir }),
    /missing_typed_managed_view_field:demoFlowNote/
  );
});

test('managed-view verifier rejects missing managed DOM ids used by the renderer', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'popup.html'),
    fs.readFileSync(path.join(rootDir, 'popup.html'), 'utf8').replace('<div id="managed-upload-detail"></div>', '')
  );

  assert.throws(
    () => verifyManagedViewModelSurface({ rootDir }),
    /missing_managed_view_dom_id:managed-upload-detail/
  );
});

test('platform-coverage verifier rejects render fields missing from the platform coverage builder', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'popup.js'),
    fs.readFileSync(path.join(rootDir, 'popup.js'), 'utf8').replace('platform.detail', 'platform.missingCoverageField')
  );

  assert.throws(
    () => verifyPlatformCoverageViewModelSurface({ rootDir }),
    /missing_render_platform_coverage_field:missingCoverageField/
  );
});

test('platform-coverage verifier rejects builder fields missing from the shared popup type', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'types', 'popup-runtime.d.ts'),
    fs.readFileSync(path.join(rootDir, 'types', 'popup-runtime.d.ts'), 'utf8').replace(/\s*detail: string;\n/, '\n')
  );

  assert.throws(
    () => verifyPlatformCoverageViewModelSurface({ rootDir }),
    /missing_typed_platform_coverage_field:detail/
  );
});

test('platform-coverage verifier rejects missing platform DOM ids used by the renderer', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'popup.html'),
    fs.readFileSync(path.join(rootDir, 'popup.html'), 'utf8').replace('<div id="platform-list"></div>', '')
  );

  assert.throws(
    () => verifyPlatformCoverageViewModelSurface({ rootDir }),
    /missing_platform_coverage_dom_id:platform-list/
  );
});

test('popup-clean verifier rejects summary fields missing from the shared popup type', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'types', 'popup-runtime.d.ts'),
    fs.readFileSync(path.join(rootDir, 'types', 'popup-runtime.d.ts'), 'utf8').replace(/\s*byProtection: Record<string, number>;\n/, '\n')
  );

  assert.throws(
    () => verifyPopupCleanSurface({ rootDir }),
    /missing_typed_popup_summary_field:byProtection/
  );
});

test('popup-clean verifier rejects missing clean-panel DOM ids used by popup render helpers', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'popup.html'),
    fs.readFileSync(path.join(rootDir, 'popup.html'), 'utf8').replace('<div id="p-guidance"></div>', '')
  );

  assert.throws(
    () => verifyPopupCleanSurface({ rootDir }),
    /missing_popup_clean_dom_id:p-guidance/
  );
});

test('popup-rules verifier rejects rule fields missing from the shared popup type', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'types', 'popup-runtime.d.ts'),
    fs.readFileSync(path.join(rootDir, 'types', 'popup-runtime.d.ts'), 'utf8').replace(/\s*risk: string;\n/, '\n')
  );

  assert.throws(
    () => verifyPopupRulesSurface({ rootDir }),
    /missing_typed_popup_rule_field:risk/
  );
});

test('popup-rules verifier rejects protection fields missing from the shared popup type', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'types', 'popup-runtime.d.ts'),
    fs.readFileSync(path.join(rootDir, 'types', 'popup-runtime.d.ts'), 'utf8').replace(/\s*border: string;\n/, '\n')
  );

  assert.throws(
    () => verifyPopupRulesSurface({ rootDir }),
    /missing_typed_popup_protection_field:border/
  );
});

test('popup-rules verifier rejects missing rules-panel hooks used by the renderer', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'popup.html'),
    fs.readFileSync(path.join(rootDir, 'popup.html'), 'utf8').replace('.rule-row { display: flex; }', '')
  );

  assert.throws(
    () => verifyPopupRulesSurface({ rootDir }),
    /missing_popup_rules_hook:.rule-row/
  );
});

test('content-review verifier rejects summary fields missing from the shared content type', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'types', 'content-runtime.d.ts'),
    fs.readFileSync(path.join(rootDir, 'types', 'content-runtime.d.ts'), 'utf8').replace(/\s*byRisk: Record<string, number>;\n/, '\n')
  );

  assert.throws(
    () => verifyContentReviewSurface({ rootDir }),
    /missing_typed_content_summary_field:byRisk/
  );
});

test('content-review verifier rejects finding fields missing from the shared content type', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'types', 'content-runtime.d.ts'),
    fs.readFileSync(path.join(rootDir, 'types', 'content-runtime.d.ts'), 'utf8').replace(/\s*label: string;\n/, '\n')
  );

  assert.throws(
    () => verifyContentReviewSurface({ rootDir }),
    /missing_typed_content_finding_field:label/
  );
});

test('content-review verifier rejects audit fields missing from the shared extension type', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'types', 'extension-runtime.d.ts'),
    fs.readFileSync(path.join(rootDir, 'types', 'extension-runtime.d.ts'), 'utf8').replace(/\s*redacted_count: number;\n/, '\n')
  );

  assert.throws(
    () => verifyContentReviewSurface({ rootDir }),
    /missing_typed_content_audit_field:redacted_count/
  );
});

test('content-review verifier rejects missing review DOM ids used by content helpers', () => {
  const rootDir = createFixtureRoot();
  fs.writeFileSync(
    path.join(rootDir, 'content.js'),
    fs.readFileSync(path.join(rootDir, 'content.js'), 'utf8').replace('<div id="lc-intercept-findings"></div>', '')
  );

  assert.throws(
    () => verifyContentReviewSurface({ rootDir }),
    /missing_content_review_dom_id:lc-intercept-findings/
  );
});
