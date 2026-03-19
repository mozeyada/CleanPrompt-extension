/**
 * LogClean Content Script
 * Injected into: ChatGPT, Claude, Copilot, Gemini
 * - Detects the AI chat input box on the page
 * - Injects a 🛡️ "Clean" button next to it
 * - Opens a sidebar overlay when clicked
 * - Inserts sanitized text back into the AI's input
 */

(function () {
  'use strict';

  if (window.__logclean_injected) return;
  window.__logclean_injected = true;

  // ── Platform detection ───────────────────────────────────────────────────
  var PLATFORMS = {
    chatgpt: {
      test: function() { return /openai\.com|chatgpt\.com/.test(location.hostname); },
      name: 'ChatGPT',
      findInput: function() {
        return document.querySelector('#prompt-textarea') ||
               document.querySelector('div[contenteditable="true"][data-id]') ||
               document.querySelector('textarea[placeholder]');
      },
      findToolbar: function() {
        var input = this.findInput();
        return input && (input.closest('form') || input.parentElement);
      },
    },
    claude: {
      test: function() { return /claude\.ai/.test(location.hostname); },
      name: 'Claude',
      findInput: function() {
        return document.querySelector('div[contenteditable="true"]') ||
               document.querySelector('.ProseMirror');
      },
      findToolbar: function() {
        var input = this.findInput();
        return input && input.parentElement;
      },
    },
    copilot: {
      test: function() { return /copilot\.microsoft\.com|bing\.com/.test(location.hostname); },
      name: 'Copilot',
      findInput: function() {
        return document.querySelector('textarea#searchbox') ||
               document.querySelector('textarea[aria-label]') ||
               document.querySelector('div[contenteditable="true"]');
      },
      findToolbar: function() {
        var input = this.findInput();
        return input && input.parentElement;
      },
    },
    gemini: {
      test: function() { return /gemini\.google\.com/.test(location.hostname); },
      name: 'Gemini',
      findInput: function() {
        return document.querySelector('.ql-editor') ||
               document.querySelector('div[contenteditable="true"]') ||
               document.querySelector('rich-textarea');
      },
      findToolbar: function() {
        var input = this.findInput();
        return input && input.parentElement;
      },
    },
  };

  function detectPlatform() {
    for (var key in PLATFORMS) {
      if (PLATFORMS[key].test()) return PLATFORMS[key];
    }
    return null;
  }

  var platform = detectPlatform();
  if (!platform) return;

  // ── Load OTA rule overrides from storage ─────────────────────────────────
  // background.js fetches updated rules every 6h and stores them.
  // We deserialize pattern strings → RegExp and override LOGCLEAN_RULES in-place.
  try {
    chrome.storage.local.get(['logclean_rules_override'], function(data) {
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
        // Replace in-place so logcleanRedact() picks up new rules
        LOGCLEAN_RULES.length = 0;
        overrideRules.forEach(function(r) { LOGCLEAN_RULES.push(r); });
        console.log('[LogClean] Loaded OTA rules: ' + overrideRules.length + ' rules');
      }
    });
  } catch(e) {
    // chrome.storage not available (e.g., during unit testing) — use bundled rules
  }

  // ── Insert text & Auto-Submit ───────────────────────────────────────────
  function insertIntoInput(text, autoSubmit = true) {
    var input = platform.findInput();
    if (!input) return;

    if (input.tagName === 'TEXTAREA') {
      var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeInputValueSetter.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (input.isContentEditable || input.getAttribute('contenteditable') === 'true') {
      input.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      text.split('\n').forEach(function(line, idx) {
        if (idx > 0) document.execCommand('insertParagraph', false, null);
        if (line) document.execCommand('insertText', false, line);
      });
      input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    }

    if (!autoSubmit) return;

    // Auto-submit logic based on platform
    setTimeout(function() {
      // ChatGPT / Copilot usually have a visible send button next to the input
      var sendBtn = platform.findToolbar()?.querySelector('button[aria-label="Send prompt"], button[data-testid="send-button"], button:has(svg)');
      if (sendBtn && !sendBtn.disabled) {
        sendBtn.click();
      } else {
        // Fallback: Dispatch Enter keydown event
        var enterEvent = new KeyboardEvent('keydown', {
          bubbles: true, cancelable: true, keyCode: 13, key: 'Enter'
        });
        input.dispatchEvent(enterEvent);
      }
    }, 150);
  }

  // ── Build the sidebar HTML ─────────────────────────────────────────────────
  function createSidebar() {
    var el = document.createElement('div');
    el.id = 'logclean-sidebar';
    el.innerHTML = `
      <div id="lc-header">
        <div id="lc-logo">
          <span id="lc-logo-icon">🛡️</span>
          <span id="lc-logo-text">LogClean</span>
          <span id="lc-platform-badge">${platform.name}</span>
        </div>
        <button id="lc-close">✕</button>
      </div>

      <div id="lc-tabs">
        <button class="lc-tab lc-tab-active" data-tab="paste">Paste & Clean</button>
        <button class="lc-tab" data-tab="audit">Audit Log</button>
      </div>

      <!-- Trust banner -->
      <div id="lc-trust-bar">
        🔒 <strong>Raw prompts stay local</strong> &nbsp;·&nbsp; Optional metadata-only analytics &nbsp;·&nbsp; No prompt retention
      </div>

      <!-- PASTE TAB -->
      <div id="lc-tab-paste" class="lc-tab-content">
        <div id="lc-input-wrap">
          <label class="lc-label">Raw Log Input</label>
          <textarea id="lc-raw-input" placeholder="Paste your log here…&#10;&#10;Supports: Datto · ConnectWise · SentinelOne · ITGlue · WatchGuard · 3CX · UniFi · AWS · Splunk · Datadog"></textarea>
          <div id="lc-input-footer">
            <span id="lc-char-count">0 chars</span>
            <div>
              <button class="lc-btn-secondary" id="lc-load-sample">Sample Log</button>
              <button class="lc-btn-secondary" id="lc-clear-btn">Clear</button>
            </div>
          </div>
        </div>

        <button id="lc-redact-btn">🛡️ Redact Sensitive Data</button>

        <!-- Summary bar -->
        <div id="lc-summary" style="display:none">
          <span id="lc-summary-count"></span>
          <div id="lc-summary-cats"></div>
        </div>

        <div id="lc-output-wrap" style="display:none">
          <label class="lc-label">
            Sanitized Output
            <span id="lc-reveal-hint">(click token to reveal)</span>
          </label>
          <div id="lc-output"></div>
        </div>

        <div id="lc-insights" style="display:none">
          <div class="lc-label" style="margin-bottom:8px">Workflow Guidance</div>
          <div id="lc-insight-row">
            <span id="lc-intent-pill" class="lc-cat-pill"></span>
            <span id="lc-action-pill" class="lc-cat-pill"></span>
          </div>
          <div id="lc-explanation"></div>
        </div>

        <div id="lc-safe-compose-wrap" style="display:none">
          <label class="lc-label">Safe Compose Prompt</label>
          <textarea id="lc-safe-compose-output" readonly></textarea>
        </div>

        <div id="lc-actions" style="display:none">
          <button id="lc-compose-btn">✨ Use Safe Compose</button>
          <button id="lc-insert-btn">✅ Insert Sanitized Text</button>
        </div>

        <!-- Findings Report -->
        <div id="lc-findings" style="display:none">
          <div class="lc-label" style="margin-bottom:8px">Detection Report</div>
          <div id="lc-findings-list"></div>
        </div>
      </div>

      <!-- AUDIT TAB -->
      <div id="lc-tab-audit" class="lc-tab-content" style="display:none">
        <div class="lc-label" style="margin-bottom:10px">Recent Redaction Sessions</div>
        <div id="lc-audit-list"></div>
      </div>

      <!-- Intercept modal (rendered at document body level for z-index) -->
    `;
    // Append intercept overlay to body separately so it sits above everything
    var overlay = document.createElement('div');
    overlay.id = 'lc-intercept-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
      <div id="lc-intercept-modal">
        <span id="lc-intercept-icon">⚠️</span>
        <div id="lc-intercept-title">Sensitive data detected</div>
        <div id="lc-intercept-sub">Review the sanitized message before it is sent.</div>
        <div id="lc-intercept-policy"></div>
        <div id="lc-intercept-guidance"></div>

        <div id="lc-intercept-preview-container">
          <div id="lc-intercept-preview-label">Preview (sanitized):</div>
          <pre id="lc-intercept-preview"></pre>
        </div>

        <div id="lc-intercept-findings"></div>
        <div id="lc-intercept-justification-wrap" style="display:none">
          <div id="lc-intercept-justification-label">Reason required for one-time raw send:</div>
          <textarea id="lc-intercept-justification" placeholder="Describe the business need without pasting the sensitive content again."></textarea>
        </div>
        <div id="lc-intercept-actions">
          <button id="lc-intercept-block">🚫 Block</button>
          <button id="lc-intercept-redact">🛡️ Redact &amp; Send</button>
          <button id="lc-intercept-allow">Allow once</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return el;
  }

  // ── Button injected INSIDE the AI input ──────────────────────────────────
  function createTriggerButton() {
    var wrapper = document.createElement('div');
    wrapper.id = 'logclean-trigger-wrap';
    var btn = document.createElement('button');
    btn.id = 'logclean-trigger';
    btn.title = 'Scrub logs before sending to AI';
    btn.innerHTML = '🛡️ Clean';
    wrapper.appendChild(btn);
    return wrapper;
  }

  function getAttachContainer() {
    var input = platform.findInput();
    if (!input) return null;
    return platform.findToolbar() || input.closest('form') || input.parentElement;
  }

  function attachButtonToInput(btnWrap) {
    var container = getAttachContainer();
    if (!container) return false;

    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    if (btnWrap.parentElement !== container) {
      container.appendChild(btnWrap);
    }
    btnWrap.style.display = '';
    return true;
  }

  function ensureSidebar() {
    var sidebar = document.getElementById('logclean-sidebar');
    if (sidebar) return sidebar;
    sidebar = createSidebar();
    document.body.appendChild(sidebar);
    return sidebar;
  }

  function ensureTriggerButton() {
    var existing = document.getElementById('logclean-trigger-wrap');
    if (existing) return existing;
    return createTriggerButton();
  }

  // ── Main init ─────────────────────────────────────────────────────────────
  function init() {
    if (window.__logclean_initialized) return true;

    // Inject sidebar
    var sidebar = ensureSidebar();

    // Inject trigger button inside the text area container
    var btnWrap = ensureTriggerButton();
    var attached = attachButtonToInput(btnWrap);
    if (!attached) return false; // Wait and try again if input isn't fully rendered

    window.__logclean_initialized = true;

    // ── State ──────────────────────────────────────────────────────────────
    var currentResult = null;
    var revealedTokens = {};
    var sidebarOpen = false;
    var runtimeSettings = {
      policyBundle: null,
      orgId: 'org_acme_msp',
      orgName: 'Acme Managed Services',
      teamId: 'helpdesk',
      teamName: 'Helpdesk',
      rotatingActorId: 'device-local',
      strictMode: false,
    };

    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, function(settings) {
      if (!settings) return;
      runtimeSettings.policyBundle = settings.logclean_policy_bundle || null;
      runtimeSettings.orgId = settings.logclean_policy_bundle && settings.logclean_policy_bundle.org_id || runtimeSettings.orgId;
      runtimeSettings.orgName = settings.logclean_policy_bundle && settings.logclean_policy_bundle.org_name || runtimeSettings.orgName;
      runtimeSettings.teamId = settings.logclean_policy_bundle && settings.logclean_policy_bundle.team_id || runtimeSettings.teamId;
      runtimeSettings.teamName = settings.logclean_policy_bundle && settings.logclean_policy_bundle.team_name || runtimeSettings.teamName;
      runtimeSettings.strictMode = Boolean(settings.logclean_policy_bundle && settings.logclean_policy_bundle.strict_mode);
      runtimeSettings.rotatingActorId = settings.rotating_actor_id || runtimeSettings.rotatingActorId;
    });

    // ── Toggle sidebar ─────────────────────────────────────────────────────
    function openSidebar() {
      sidebar.classList.add('lc-open');
      sidebarOpen = true;
      document.getElementById('lc-raw-input').focus();
    }
    function closeSidebar() {
      sidebar.classList.remove('lc-open');
      sidebarOpen = false;
    }

    var btn = document.getElementById('logclean-trigger');
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      sidebarOpen ? closeSidebar() : openSidebar();
    });
    document.getElementById('lc-close').addEventListener('click', closeSidebar);

    // ── Tabs ───────────────────────────────────────────────────────────────
    var tabs = sidebar.querySelectorAll('.lc-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        tabs.forEach(function(t) { t.classList.remove('lc-tab-active'); });
        tab.classList.add('lc-tab-active');
        var name = tab.dataset.tab;
        document.getElementById('lc-tab-paste').style.display = name === 'paste' ? 'flex' : 'none';
        document.getElementById('lc-tab-audit').style.display = name === 'audit' ? 'block' : 'none';
        if (name === 'audit') loadAudit();
      });
    });

    // ── Char count ─────────────────────────────────────────────────────────
    var rawInput = document.getElementById('lc-raw-input');
    rawInput.addEventListener('input', function() {
      document.getElementById('lc-char-count').textContent = rawInput.value.length.toLocaleString() + ' chars';
    });

    // ── Clear ──────────────────────────────────────────────────────────────
    document.getElementById('lc-clear-btn').addEventListener('click', function() {
      rawInput.value = '';
      currentResult = null;
      revealedTokens = {};
      document.getElementById('lc-summary').style.display = 'none';
      document.getElementById('lc-output-wrap').style.display = 'none';
      document.getElementById('lc-insights').style.display = 'none';
      document.getElementById('lc-safe-compose-wrap').style.display = 'none';
      document.getElementById('lc-actions').style.display = 'none';
      document.getElementById('lc-findings').style.display = 'none';
      document.getElementById('lc-char-count').textContent = '0 chars';
    });

    // ── Sample log ─────────────────────────────────────────────────────────
    document.getElementById('lc-load-sample').addEventListener('click', function() {
      rawInput.value = [
        '2024-01-15T10:22:11Z [Datto RMM] Device-Id=a3f1b2c4-d5e6-7890-abcd-ef1234567890 Site-Name=Acme Corp',
        'Client-Name=Acme Corp Ticket-Number=12043 CW-Api-Key=Xk9mP2qR7tL4wN6vA1jB5cD8',
        'Email: john.doe@acmecorp.com Phone: (02) 9876-5432',
        'IP: 192.168.1.45 → 52.94.228.167 MAC: 00:1A:2B:3C:4D:5E',
        'SentinelOne Site-Token=eyJhbGciOi... Threat-Id=12345678901234567',
        'VPN-User=admin VPN-Password=P@ssw0rd!2024',
        'SSID=AcmeCorp_WiFi VLAN=100 Ext=201 SIP-User=3cxuser SIP-Pass=s3cur3!',
        'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiam9obiJ9.signature123',
      ].join('\n');
      rawInput.dispatchEvent(new Event('input'));
    });

    // ── Redact ─────────────────────────────────────────────────────────────
    document.getElementById('lc-redact-btn').addEventListener('click', async function() {
      var text = rawInput.value.trim();
      if (!text) return;

      var btn2 = document.getElementById('lc-redact-btn');
      btn2.textContent = '⚡ Scanning…';
      btn2.disabled = true;

      var enabledIds = runtimeSettings.policyBundle && runtimeSettings.policyBundle.rules && runtimeSettings.policyBundle.rules.active_rule_ids || null;
      var result = await logcleanRedact(text, enabledIds, {
        policyBundle: runtimeSettings.policyBundle,
        org_id: runtimeSettings.orgId,
        org_name: runtimeSettings.orgName,
        team_id: runtimeSettings.teamId,
        team_name: runtimeSettings.teamName,
        site: location.hostname,
        rotating_actor_id: runtimeSettings.rotatingActorId,
        strict_mode: runtimeSettings.strictMode,
      });
      currentResult = result;
      revealedTokens = {};
      renderOutput(result);
      btn2.innerHTML = '🛡️ Redact Sensitive Data';
      btn2.disabled = false;

      // Send audit event to background
      if (result.findings.length > 0) {
        logMetadataEvent(result, result.policy_action);
      }
    });

    // ── Render output with token badges ───────────────────────────────────
    var CAT_COLORS = {
      Network:    { bg: 'rgba(56,189,248,0.15)', border: '#38bdf8', text: '#38bdf8' },
      Credential: { bg: 'rgba(249,115,22,0.15)', border: '#f97316', text: '#fb923c' },
      PII:        { bg: 'rgba(52,211,153,0.15)', border: '#34d399', text: '#34d399' },
      Financial:  { bg: 'rgba(250,204,21,0.15)', border: '#facc15', text: '#facc15' },
      MSP:        { bg: 'rgba(232,121,249,0.15)', border: '#e879f9', text: '#e879f9' },
    };

    function getCatFromToken(token) {
      var m = token.match(/^\[([A-Z0-9_]+)_\d+\]$/);
      if (!m) return 'Network';
      var ruleId = m[1];
      var rule = LOGCLEAN_RULES.find(function(r){ return r.id === ruleId; });
      return rule ? rule.category : 'Network';
    }

    function renderOutput(result) {
      // Summary
      var sum = logcleanGetSummary(result.findings);
      var summaryEl = document.getElementById('lc-summary');
      var countEl = document.getElementById('lc-summary-count');
      var catsEl = document.getElementById('lc-summary-cats');

      summaryEl.style.display = 'flex';
      countEl.textContent = sum.total + ' item' + (sum.total !== 1 ? 's' : '') + ' redacted';
      countEl.style.color = sum.total > 0 ? '#f87171' : '#34d399';
      catsEl.innerHTML = '';

      // Category pills
      Object.entries(sum.byCategory).forEach(function(entry) {
        var cat = entry[0], count = entry[1];
        var c = CAT_COLORS[cat] || CAT_COLORS.Network;
        var pill = document.createElement('span');
        pill.className = 'lc-cat-pill';
        pill.style.background = c.bg;
        pill.style.borderColor = c.border;
        pill.style.color = c.text;
        pill.textContent = cat + ': ' + count;
        catsEl.appendChild(pill);
      });

      // Risk severity pills
      if (sum.byRisk) {
        var riskOrder = ['critical','high','medium','low'];
        riskOrder.forEach(function(r) {
          if (!sum.byRisk[r]) return;
          var ri = (typeof LOGCLEAN_RISK !== 'undefined' && LOGCLEAN_RISK[r]) || { emoji:'⚪', color:'#94a3b8', bg:'rgba(148,163,184,0.1)', border:'rgba(148,163,184,0.3)', label: r };
          var pill = document.createElement('span');
          pill.className = 'lc-cat-pill';
          pill.style.background = ri.bg;
          pill.style.borderColor = ri.border;
          pill.style.color = ri.color;
          pill.textContent = ri.emoji + ' ' + ri.label + ': ' + sum.byRisk[r];
          catsEl.appendChild(pill);
        });
      }

      // Output
      buildOutputView(result.sanitized, result.tokens);
      renderInsights(result);
      document.getElementById('lc-output-wrap').style.display = 'block';
      document.getElementById('lc-actions').style.display = 'flex';

      // Findings
      buildFindings(result.findings, sum);
    }

    function buildOutputView(sanitized, tokens) {
      var outputEl = document.getElementById('lc-output');
      outputEl.innerHTML = '';
      var parts = sanitized.split(/(\[[A-Z0-9_]+_\d+\])/g);
      parts.forEach(function(part) {
        if (/^\[[A-Z0-9_]+_\d+\]$/.test(part)) {
          var cat = getCatFromToken(part);
          var c = CAT_COLORS[cat] || CAT_COLORS.Network;
          var span = document.createElement('span');
          span.className = 'lc-token';
          span.textContent = part;
          span.style.background = c.bg;
          span.style.borderColor = c.border;
          span.style.color = c.text;
          span.title = 'Click to reveal/hide original value';
          span.dataset.token = part;
          span.addEventListener('click', function() {
            if (revealedTokens[part]) {
              delete revealedTokens[part];
              span.textContent = part;
              span.style.opacity = '1';
            } else {
              revealedTokens[part] = tokens[part];
              span.textContent = tokens[part] || part;
              span.style.opacity = '0.6';
              span.style.textDecoration = 'line-through';
            }
            updateInsertBtn();
          });
          outputEl.appendChild(span);
        } else {
          var text = document.createTextNode(part);
          outputEl.appendChild(text);
        }
      });
    }

    function updateInsertBtn() {
      var insertBtn = document.getElementById('lc-insert-btn');
      var composeBtn = document.getElementById('lc-compose-btn');
      var revealed = Object.keys(revealedTokens).length;
      if (revealed > 0) {
        insertBtn.textContent = '⚠ ' + revealed + ' token(s) revealed — hide to insert';
        insertBtn.disabled = true;
        composeBtn.disabled = true;
      } else {
        insertBtn.textContent = '✅ Insert Sanitized Text';
        insertBtn.disabled = false;
        composeBtn.disabled = false;
      }
    }

    function renderInsights(result) {
      var insightsEl = document.getElementById('lc-insights');
      var safeComposeEl = document.getElementById('lc-safe-compose-wrap');
      var intentPill = document.getElementById('lc-intent-pill');
      var actionPill = document.getElementById('lc-action-pill');
      var explanationEl = document.getElementById('lc-explanation');
      var safeComposeOutput = document.getElementById('lc-safe-compose-output');

      intentPill.textContent = 'Intent: ' + String(result.intent_label || 'other').replace(/_/g, ' ');
      intentPill.style.background = 'rgba(59,130,246,0.12)';
      intentPill.style.borderColor = 'rgba(59,130,246,0.3)';
      intentPill.style.color = '#60a5fa';

      actionPill.textContent = 'Policy: ' + (result.policy_action || 'warn');
      actionPill.style.background = 'rgba(16,185,129,0.12)';
      actionPill.style.borderColor = 'rgba(16,185,129,0.28)';
      actionPill.style.color = '#34d399';

      explanationEl.textContent = result.employee_explanation || '';
      safeComposeOutput.value = result.safe_compose_prompt || '';

      insightsEl.style.display = 'block';
      safeComposeEl.style.display = 'block';
    }

    function logMetadataEvent(result, action, justificationProvided) {
      if (!result || !result.event_summary) return;
      var eventSummary = JSON.parse(JSON.stringify(result.event_summary));
      eventSummary.action = action || eventSummary.action;
      eventSummary.justification_provided = Boolean(justificationProvided);
      chrome.runtime.sendMessage({
        type: 'LOG_AUDIT',
        url: location.hostname,
        redacted_count: eventSummary.count_summary.total,
        categories: eventSummary.sensitivity_categories,
        risk_summary: eventSummary.count_summary.by_risk,
        action: eventSummary.action,
        intent_label: eventSummary.intent_label,
        event_summary: eventSummary,
      });
    }

    function buildFindings(findings, sum) {
      var findingsEl = document.getElementById('lc-findings-list');
      findingsEl.innerHTML = '';
      if (findings.length === 0) return;
      document.getElementById('lc-findings').style.display = 'block';

      findings.forEach(function(f) {
        var c = CAT_COLORS[f.category] || CAT_COLORS.Network;
        var ri = (typeof LOGCLEAN_RISK !== 'undefined' && LOGCLEAN_RISK[f.risk]) || { emoji:'⚪', label: f.risk || 'unknown', color:'#94a3b8', bg:'rgba(148,163,184,0.1)', border:'rgba(148,163,184,0.3)' };
        var div = document.createElement('div');
        div.className = 'lc-finding-card';
        div.style.borderLeftColor = ri.color;
        div.innerHTML = `
          <div class="lc-finding-header">
            <div style="display:flex;align-items:center;gap:6px">
              <span class="lc-cat-pill" style="background:${c.bg};border-color:${c.border};color:${c.text}">${f.category}</span>
              <span class="lc-risk-badge" style="background:${ri.bg};border-color:${ri.border};color:${ri.color}">${ri.emoji} ${ri.label}</span>
            </div>
            <span class="lc-finding-count" style="color:${ri.color}">${f.count}</span>
          </div>
          <div class="lc-finding-label">${f.label}</div>
          <div class="lc-finding-bar-bg">
            <div class="lc-finding-bar" style="width:${Math.min((f.count / (sum.total||1))*100, 100)}%;background:${ri.color}88"></div>
          </div>
        `;
        findingsEl.appendChild(div);
      });
    }

    // ── Insert ─────────────────────────────────────────────────────────────
    document.getElementById('lc-insert-btn').addEventListener('click', function() {
      if (!currentResult) return;
      var text = getFinalText();
      
      closeSidebar();
      
      // Add a tiny delay so the sidebar animates away before we send the message
      setTimeout(function() {
        insertIntoInput(text);
      }, 200);
    });

    document.getElementById('lc-compose-btn').addEventListener('click', function() {
      if (!currentResult) return;
      closeSidebar();
      setTimeout(function() {
        insertIntoInput(currentResult.safe_compose_prompt || currentResult.sanitized);
      }, 200);
    });

    function getFinalText() {
      if (!currentResult) return '';
      var text = currentResult.sanitized;
      // No revealed tokens should be present at insert time, but handle gracefully
      Object.entries(revealedTokens).forEach(function(e) {
        text = text.split(e[0]).join(e[1]);
      });
      return text;
    }

    // ── Audit log ─────────────────────────────────────────────────────────
    function loadAudit() {
      chrome.runtime.sendMessage({ type: 'GET_AUDIT_LOG' }, function(log) {
        var el = document.getElementById('lc-audit-list');
        if (!log || log.length === 0) {
          el.innerHTML = '<p style="color:#475569;font-size:13px">No sessions yet. Redact some logs to see history.</p>';
          return;
        }
        el.innerHTML = log.slice(0, 20).map(function(entry) {
          return '<div class="lc-audit-entry">' +
            '<div class="lc-audit-ts">' + new Date(entry.ts).toLocaleString() + '</div>' +
            '<div class="lc-audit-site">' + entry.url + '</div>' +
            '<div class="lc-audit-count" style="margin-bottom:4px">' + (entry.intent_label || 'other').replace(/_/g, ' ') + ' · ' + (entry.action || 'warn') + '</div>' +
            '<div class="lc-audit-cats">' + (entry.categories || []).map(function(c) {
              var col = (CAT_COLORS[c] || CAT_COLORS.Network);
              return '<span class="lc-cat-pill" style="background:' + col.bg + ';border-color:' + col.border + ';color:' + col.text + '">' + c + '</span>';
            }).join('') + '</div>' +
            '<div class="lc-audit-count">' + entry.redacted_count + ' items redacted</div>' +
          '</div>';
        }).join('');
      });
    }

    // ── Keyboard shortcut: Alt+L ───────────────────────────────────────────
    document.addEventListener('keydown', function(e) {
      if (e.altKey && e.key === 'l') {
        sidebarOpen ? closeSidebar() : openSidebar();
      }
    });

    // ── Pre-send Interception (Invisible Shield) ──────────────────────────
    var interceptEnabled = true;    var interceptAllowOnce = false;
    var pendingIntercept = null;

    function openInterceptModal(result, raw, sendBtn) {
      pendingIntercept = { result: result, raw: raw, sendBtn: sendBtn };
      var overlay = document.getElementById('lc-intercept-overlay');
      var preview = document.getElementById('lc-intercept-preview');
      var policyEl = document.getElementById('lc-intercept-policy');
      var guidanceEl = document.getElementById('lc-intercept-guidance');
      var allowBtn = document.getElementById('lc-intercept-allow');
      var justifyWrap = document.getElementById('lc-intercept-justification-wrap');
      if (preview) {
        // Replace internal token placeholders with a consistent redaction marker for preview clarity
        var previewText = (result.sanitized || '').replace(/\[[A-Z0-9_]+_\d+\]/g, '[REDACTED]');
        preview.textContent = previewText;
      }
      if (policyEl) {
        policyEl.textContent = 'Policy action: ' + (result.policy_action || 'warn');
      }
      if (guidanceEl) {
        guidanceEl.textContent = result.employee_explanation || '';
      }
      if (justifyWrap) {
        justifyWrap.style.display = result.policy_action === 'justify' ? 'block' : 'none';
      }
      if (allowBtn) {
        allowBtn.style.display = result.policy_action === 'block' ? 'none' : 'inline-flex';
        allowBtn.textContent = result.policy_action === 'justify' ? 'Allow once with reason' : 'Allow once';
      }

      var findingsEl = document.getElementById('lc-intercept-findings');
      if (findingsEl) {
        var sum = logcleanGetSummary(result.findings);
        var html = '';
        if (sum.total > 0) {
          html += '<div style="margin-bottom:10px;font-size:12px;color:#94a3b8;">Detected ' + sum.total + ' sensitive item' + (sum.total === 1 ? '' : 's') + '.</div>';
          html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
          Object.entries(sum.byCategory).forEach(function(e) {
            html += '<span style="padding:4px 8px;border-radius:999px;background:rgba(255,255,255,0.08);font-size:11px;">' + e[0] + ': ' + e[1] + '</span>';
          });
          html += '</div>';
        }
        findingsEl.innerHTML = html;
      }

      overlay.style.display = 'flex';
    }

    function closeInterceptModal() {
      var overlay = document.getElementById('lc-intercept-overlay');
      if (overlay) overlay.style.display = 'none';
      var justify = document.getElementById('lc-intercept-justification');
      if (justify) justify.value = '';
      pendingIntercept = null;
    }
    // Inject Toast Container
    var toastWrap = document.createElement('div');
    toastWrap.id = 'lc-toast-wrap';
    document.body.appendChild(toastWrap);

    function showToast(count, action) {
      var toast = document.createElement('div');
      toast.className = 'lc-toast';
      toast.innerHTML = 
        '<div class="lc-toast-icon">🛡️</div>' +
        '<div class="lc-toast-content">' +
          '<div class="lc-toast-title">LogClean Active</div>' +
          '<div class="lc-toast-desc">' + count + ' sensitive item' + (count > 1 ? 's' : '') + ' handled with policy action: ' + (action || 'redact') + '.</div>' +
        '</div>';
      
      toastWrap.appendChild(toast);
      
      // Auto-remove
      setTimeout(function() {
        toast.classList.add('lc-toast-out');
        setTimeout(function() { toast.remove(); }, 300);
      }, 3500);
    }

    // ── Per-platform send button observer ─────────────────────────────────
    var SEND_SELECTORS = [
      'button[data-testid="send-button"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Send message"]',
      'button[aria-label="Send"]',
      'button[type="submit"]',
    ];

    function findSendButton() {
      for (var i = 0; i < SEND_SELECTORS.length; i++) {
        var btn = document.querySelector(SEND_SELECTORS[i]);
        if (btn && !btn.disabled) return btn;
      }
      return null;
    }

    var observedSendBtn = null;

    function attachSendInterceptor() {
      var btn = findSendButton();
      if (!btn || btn === observedSendBtn) return;
      observedSendBtn = btn;
      btn.addEventListener('click', async function(e) {
        if (!interceptEnabled || !platform || !platform.findInput) return;
        var input = platform.findInput();
        if (!input) return;
        var raw = input.tagName === 'TEXTAREA' ? input.value : input.innerText;
        if (!raw || raw.trim().length < 10) return;

        // Has data — pause submit instantly for Stage-2 scan
        e.preventDefault();
        e.stopImmediatePropagation();

        var enabledIds = runtimeSettings.policyBundle && runtimeSettings.policyBundle.rules && runtimeSettings.policyBundle.rules.active_rule_ids || null;
        var result = await logcleanRedact(raw, enabledIds, {
          policyBundle: runtimeSettings.policyBundle,
          org_id: runtimeSettings.orgId,
          org_name: runtimeSettings.orgName,
          team_id: runtimeSettings.teamId,
          team_name: runtimeSettings.teamName,
          site: location.hostname,
          rotating_actor_id: runtimeSettings.rotatingActorId,
          strict_mode: runtimeSettings.strictMode,
        });
        if (!result.findings || result.findings.length === 0) {
          observedSendBtn = null; // detach
          btn.click();
          return;
        }

        var sum = logcleanGetSummary(result.findings);
        if (result.policy_action === 'redact') {
          logMetadataEvent(result, 'redact');
          insertIntoInput(result.sanitized, false);
          showToast(sum.total, 'redact');
          interceptEnabled = false;
          setTimeout(function() {
            btn.click();
            interceptEnabled = true;
          }, 180);
          return;
        }

        insertIntoInput(result.sanitized, false);
        openInterceptModal(result, raw, btn);
      }, true); // capture phase
    }

    // Intercept modal action buttons
    document.getElementById('lc-intercept-block').addEventListener('click', function() {
      if (pendingIntercept) {
        logMetadataEvent(pendingIntercept.result, 'block');
      }
      closeInterceptModal();
    });

    document.getElementById('lc-intercept-allow').addEventListener('click', function() {
      if (!pendingIntercept) return;
      var pending = pendingIntercept;
      if (pendingIntercept.result.policy_action === 'justify') {
        var reason = document.getElementById('lc-intercept-justification').value.trim();
        if (!reason) return;
      }
      logMetadataEvent(pending.result, pending.result.policy_action === 'justify' ? 'justify' : 'allow', true);
      closeInterceptModal();
      interceptEnabled = false;
      pending.sendBtn.click();
      setTimeout(function() { interceptEnabled = true; }, 200);
    });

    document.getElementById('lc-intercept-redact').addEventListener('click', function() {
      if (!pendingIntercept) return;
      var pending = pendingIntercept;
      logMetadataEvent(pending.result, 'redact');
      closeInterceptModal();
      interceptEnabled = false;
      insertIntoInput(pending.result.sanitized, false);
      setTimeout(function() { pending.sendBtn.click(); interceptEnabled = true; }, 200);
    });

    // Poll for send button (it may render after page load)
    var sendBtnInterval = setInterval(attachSendInterceptor, 1500);
    attachSendInterceptor();
    return true;
  }

  function ensureInjection() {
    if (!window.__logclean_initialized && !init()) {
      return;
    }

    var triggerWrap = document.getElementById('logclean-trigger-wrap');
    if (triggerWrap) {
      attachButtonToInput(triggerWrap);
    }
  }

  // ── Wait for page ready ───────────────────────────────────────────────────
  function waitAndInit() {
    init();
    ensureInjection();

    var observer = new MutationObserver(function() {
      ensureInjection();
    });

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });

    setInterval(function() {
      ensureInjection();
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndInit);
  } else {
    waitAndInit();
  }
})();
