/**
 * LogClean Extension Popup Script
 */
(function () {
  'use strict';

  var CAT_COLORS = {
    Network:    { bg: 'rgba(56,189,248,0.15)', border: '#38bdf8', text: '#38bdf8' },
    Credential: { bg: 'rgba(249,115,22,0.15)', border: '#f97316', text: '#fb923c' },
    PII:        { bg: 'rgba(52,211,153,0.15)', border: '#34d399', text: '#34d399' },
    Financial:  { bg: 'rgba(250,204,21,0.15)', border: '#facc15', text: '#facc15' },
    MSP:        { bg: 'rgba(232,121,249,0.15)', border: '#e879f9', text: '#e879f9' },
  };

  var SUPPORTED_PLATFORMS = [
    { icon: '🤖', name: 'ChatGPT', host: 'chatgpt.com', url: 'https://chatgpt.com' },
    { icon: '🟠', name: 'ChatGPT (OpenAI)', host: 'chat.openai.com', url: 'https://chat.openai.com' },
    { icon: '🟣', name: 'Claude', host: 'claude.ai', url: 'https://claude.ai' },
    { icon: '🔷', name: 'Microsoft Copilot', host: 'copilot.microsoft.com', url: 'https://copilot.microsoft.com' },
    { icon: '🔵', name: 'Google Gemini', host: 'gemini.google.com', url: 'https://gemini.google.com' },
  ];

  var currentResult = null;
  var revealedTokens = {};
  var currentPolicyBundle = null;

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
  chrome.storage.local.get(['logclean_rules_override', 'logclean_policy_bundle'], function(data) {
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
    initPopup();
  });

  function initPopup() {

  // ── Populate platforms ───────────────────────────────────────────────────
  var platformList = document.getElementById('platform-list');
  SUPPORTED_PLATFORMS.forEach(function(p) {
    var div = document.createElement('div');
    div.className = 'platform-card';
    div.innerHTML =
      '<span class="platform-icon">' + p.icon + '</span>' +
      '<div><div class="platform-name">' + p.name + '</div>' +
      '<div style="font-size:11px;color:#475569">' + p.host + '</div></div>' +
      '<span class="platform-status">✓ Active</span>';
    div.style.cursor = 'pointer';
    div.addEventListener('click', function() { chrome.tabs.create({ url: p.url }); });
    platformList.appendChild(div);
  });

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
      var result = await logcleanRedact(text, enabledIds, { policyBundle: currentPolicyBundle, site: 'popup', org_id: 'org_acme_msp', org_name: 'Acme Managed Services', team_id: 'helpdesk', team_name: 'Helpdesk', rotating_actor_id: 'popup-local' });
      currentResult = result;
      revealedTokens = {};
      renderOutput(result);
      btn.textContent = '🛡️ Redact Sensitive Data'; btn.disabled = false;
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
})();
