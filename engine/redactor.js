/**
 * CleanPrompt Redaction Engine - MV3 Compatible (plain IIFE, no ES modules)
 * Covers: Network, Credentials, PII, Financial, MSP Stack (Datto, ConnectWise, ITGlue, SentinelOne, WatchGuard, 3CX, UniFi)
 * v1.1 — Added risk levels: critical / high / medium / low
 */
var LOGCLEAN_RULES = [

  // ── A. NETWORK & INFRASTRUCTURE ─────────────────────────────────────────
  { id:'PRIVATE_IP', label:'Private IP', category:'Network', risk:'medium', color:'#38bdf8',
    pattern:/\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g },
  { id:'PUBLIC_IP', label:'Public IP', category:'Network', risk:'high', color:'#7dd3fc',
    pattern:/\b(?!10\.)(?!172\.1[6-9]\.)(?!172\.2[0-9]\.)(?!172\.3[01]\.)(?!192\.168\.)(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g },
  { id:'IPV6', label:'IPv6 Address', category:'Network', risk:'medium', color:'#38bdf8',
    pattern:/\b([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g },
  { id:'MAC_ADDRESS', label:'MAC Address', category:'Network', risk:'medium', color:'#818cf8',
    pattern:/\b([0-9A-Fa-f]{2}[:\-]){5}([0-9A-Fa-f]{2})\b/g },
  { id:'HOSTNAME', label:'Internal Hostname', category:'Network', risk:'medium', color:'#818cf8',
    pattern:/\b[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61})?\.(?:local|corp|internal|intranet|lan|home)\b/gi },
  { id:'FILE_PATH', label:'File Path', category:'Network', risk:'low', color:'#94a3b8',
    pattern:/(?:\/(?:home|root|etc|var|srv|opt)\/[a-zA-Z0-9_.\-\/]+|[A-Za-z]:\\(?:[A-Za-z0-9 _.\-]+\\)+[A-Za-z0-9 _.\-]*)/g },

  // ── B. CREDENTIALS & SECRETS ─────────────────────────────────────────────
  { id:'AWS_ACCESS_KEY', label:'AWS Access Key', category:'Credential', risk:'critical', color:'#f97316',
    pattern:/\b(ASIA|AKIA|AROA|AIDA)[A-Z0-9]{16}\b/g },
  { id:'GITHUB_TOKEN', label:'GitHub Token', category:'Credential', risk:'critical', color:'#f97316',
    pattern:/\b(ghp_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9]{36}\b/g },
  { id:'SLACK_TOKEN', label:'Slack Token', category:'Credential', risk:'critical', color:'#f97316',
    pattern:/\b(xox[baprs]-[0-9A-Za-z\-]+)\b/g },
  { id:'OPENAI_KEY', label:'OpenAI Key', category:'Credential', risk:'critical', color:'#f97316',
    pattern:/\bsk-[A-Za-z0-9]{32,60}\b/g },
  { id:'STRIPE_KEY', label:'Stripe Key', category:'Credential', risk:'critical', color:'#f97316',
    pattern:/\b(sk|pk)_(live|test)_[A-Za-z0-9]{24,99}\b/g },
  { id:'JWT_TOKEN', label:'JWT Token', category:'Credential', risk:'high', color:'#fb923c',
    pattern:/\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b/g },
  { id:'BEARER_TOKEN', label:'Bearer Token', category:'Credential', risk:'high', color:'#fb923c',
    pattern:/\bBearer\s+[A-Za-z0-9\-._~+\/]+=*\b/gi },
  { id:'BASIC_AUTH', label:'Basic Auth', category:'Credential', risk:'high', color:'#fb923c',
    pattern:/\bBasic\s+[A-Za-z0-9+\/]+=*\b/gi },
  { id:'GENERIC_SECRET', label:'Secret / Password', category:'Credential', risk:'high', color:'#fb923c',
    pattern:/(?:password|passwd|secret|token|api_key|apikey|auth_token|access_token)\s*[=:]\s*["']?([^\s"',;\n]{6,})["']?/gi },
  { id:'PRIVATE_KEY', label:'Private Key (PEM)', category:'Credential', risk:'critical', color:'#ef4444',
    pattern:/-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g },

  // ── C. PII ───────────────────────────────────────────────────────────────
  { id:'EMAIL', label:'Email Address', category:'PII', risk:'medium', color:'#34d399',
    pattern:/\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g },
  { id:'PHONE', label:'Phone Number', category:'PII', risk:'medium', color:'#34d399',
    pattern:/\b(\+?1[-.\ ]?)?\(?\d{3}\)?[-.\ ]\d{3}[-.\ ]\d{4}\b/g },
  { id:'SSN', label:'SSN', category:'PII', risk:'critical', color:'#f43f5e',
    pattern:/\b(?!000|666|9\d\d)\d{3}[-\ ]?(?!00)\d{2}[-\ ]?(?!0000)\d{4}\b/g },

  // ── D. FINANCIAL / HIPAA / PCI ───────────────────────────────────────────
  { id:'CREDIT_CARD', label:'Credit Card', category:'Financial', risk:'critical', color:'#facc15',
    pattern:/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g },
  { id:'CRYPTO_ADDRESS', label:'Crypto Wallet', category:'Financial', risk:'high', color:'#facc15',
    pattern:/\b(0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59})\b/g },

  // ── E. MSP STACK — DATTO RMM ─────────────────────────────────────────────
  { id:'DATTO_DEVICE_ID', label:'Datto Device GUID', category:'MSP', risk:'medium', color:'#e879f9',
    pattern:/\b[Dd]atto[-_\ ]?(?:[Dd]evice[-_\ ]?)?[Ii][Dd]?\s*[=:]\s*["']?([0-9a-fA-F\-]{32,40})["']?/g },
  { id:'DATTO_API_KEY', label:'Datto API Key', category:'MSP', risk:'critical', color:'#e879f9',
    pattern:/\b[Dd]atto[-_\ ]?[Aa][Pp][Ii][-_\ ]?[Kk]ey\s*[=:]\s*["']?([A-Za-z0-9+\/=]{20,})["']?/g },
  { id:'DATTO_SITE', label:'Datto Site Name', category:'MSP', risk:'low', color:'#e879f9',
    pattern:/\b[Ss]ite[-_\ ]?[Nn]ame\s*[=:]\s*["']?([A-Za-z0-9 &_.\-]{3,60})["']?(?=\s|,|;|}|$)/g },

  // ── F. MSP STACK — CONNECTWISE ────────────────────────────────────────────
  { id:'CW_COMPANY_ID', label:'CW Company ID', category:'MSP', risk:'low', color:'#c084fc',
    pattern:/\b(?:[Cc]onnect[Ww]ise[-_\ ]?)?[Cc]ompany[-_\ ]?[Ii][Dd]\s*[=:]\s*["']?([A-Za-z0-9_\-]{2,40})["']?/g },
  { id:'CW_API_KEY', label:'ConnectWise API Key', category:'MSP', risk:'critical', color:'#c084fc',
    pattern:/\b[Cc][Ww][-_\ ]?[Aa][Pp][Ii][-_\ ]?[Kk]ey\s*[=:]\s*["']?([A-Za-z0-9+\/=]{20,})["']?/g },
  { id:'CW_TICKET', label:'CW Ticket Number', category:'MSP', risk:'low', color:'#c084fc',
    pattern:/\b(?:[Ss]ervice[-_\ ]?)?[Tt]icket[-_\ ]?#?\s*(\d{5,12})\b/g },
  { id:'CW_CLIENT_NAME', label:'CW Client Name', category:'MSP', risk:'medium', color:'#c084fc',
    pattern:/\b[Cc]lient[-_\ ]?[Nn]ame\s*[=:]\s*["']?([A-Za-z0-9 &_.\-]{2,60})["']?(?=\s|,|;|}|$)/g },

  // ── G. MSP STACK — ITGLUE ────────────────────────────────────────────────
  { id:'ITGLUE_API_KEY', label:'ITGlue API Key', category:'MSP', risk:'critical', color:'#a78bfa',
    pattern:/\b[Ii][Tt][Gg]lue[-_\ ]?[Aa][Pp][Ii][-_\ ]?[Kk]ey\s*[=:]\s*["']?([A-Za-z0-9\-_]{20,})["']?/g },
  { id:'ITGLUE_ORG_ID', label:'ITGlue Org ID', category:'MSP', risk:'medium', color:'#a78bfa',
    pattern:/\b[Ii][Tt][Gg]lue[-_\ ]?[Oo]rg[-_\ ]?[Ii][Dd]\s*[=:]\s*["']?(\d{4,12})["']?/g },
  { id:'ITGLUE_PASSWORD', label:'ITGlue Password Entry', category:'MSP', risk:'critical', color:'#a78bfa',
    pattern:/\b[Pp]assword[-_\ ]?[Ee]ntry\s*[=:]\s*["']?([^\s"',;\n]{6,})["']?/g },

  // ── H. MSP STACK — SENTINELONE ────────────────────────────────────────────
  { id:'S1_API_TOKEN', label:'SentinelOne API Token', category:'MSP', risk:'critical', color:'#f472b6',
    pattern:/\b[Ss]entinel[Oo]ne[-_\ ]?[Aa][Pp][Ii][-_\ ]?[Tt]oken\s*[=:]\s*["']?([A-Za-z0-9\-_]{20,})["']?/g },
  { id:'S1_SITE_TOKEN', label:'SentinelOne Site Token', category:'MSP', risk:'critical', color:'#f472b6',
    pattern:/\b[Ss]ite[-_\ ]?[Tt]oken\s*[=:]\s*["']?([A-Za-z0-9\-_]{20,})["']?/g },
  { id:'S1_AGENT_ID', label:'SentinelOne Agent ID', category:'MSP', risk:'medium', color:'#f472b6',
    pattern:/\b[Ss]1[-_]?[Aa]gent[-_\ ]?[Ii][Dd]\s*[=:]\s*["']?(\d{15,25})["']?/g },
  { id:'S1_THREAT_ID', label:'SentinelOne Threat ID', category:'MSP', risk:'high', color:'#f472b6',
    pattern:/\b[Tt]hreat[-_\ ]?[Ii][Dd]\s*[=:]\s*["']?(\d{15,25})["']?/g },

  // ── I. MSP STACK — WATCHGUARD ─────────────────────────────────────────────
  { id:'WG_VPN_CRED', label:'WatchGuard VPN Credential', category:'MSP', risk:'critical', color:'#fb7185',
    pattern:/\b[Vv][Pp][Nn][-_\ ]?(?:[Uu]ser|[Pp]assword|[Cc]red)\s*[=:]\s*["']?([^\s"',;\n]{4,})["']?/g },
  { id:'WG_POLICY', label:'WatchGuard Policy Name', category:'MSP', risk:'low', color:'#fb7185',
    pattern:/\b[Pp]olicy[-_\ ]?[Nn]ame\s*[=:]\s*["']?([A-Za-z0-9_\-. ]{3,50})["']?/g },
  { id:'WG_AUTH_KEY', label:'WatchGuard Auth Key', category:'MSP', risk:'critical', color:'#fb7185',
    pattern:/\b[Ww]atch[Gg]uard[-_\ ]?[Aa]uth[-_\ ]?[Kk]ey\s*[=:]\s*["']?([A-Za-z0-9+\/=]{8,})["']?/g },

  // ── J. MSP STACK — 3CX ────────────────────────────────────────────────────
  { id:'3CX_EXTENSION', label:'3CX Extension Number', category:'MSP', risk:'low', color:'#67e8f9',
    pattern:/\b[Ee]xt(?:ension)?\s*[=:#]?\s*(\d{3,6})\b(?!\.\d)/g },
  { id:'3CX_SIP_CRED', label:'3CX SIP Credential', category:'MSP', risk:'critical', color:'#67e8f9',
    pattern:/\b[Ss][Ii][Pp][-_\ ]?(?:[Uu]ser|[Pp]ass|[Cc]red|[Aa]uth)\s*[=:]\s*["']?([^\s"',;\n]{4,})["']?/g },
  { id:'3CX_SERVER', label:'3CX Server URL', category:'MSP', risk:'medium', color:'#67e8f9',
    pattern:/\b3[Cc][Xx][-_\ ]?[Ss]erver\s*[=:]\s*["']?([^\s"',;\n]{4,})["']?/g },

  // ── K. MSP STACK — UNIFI ──────────────────────────────────────────────────
  { id:'UNIFI_CONTROLLER', label:'UniFi Controller Credential', category:'MSP', risk:'high', color:'#6ee7b7',
    pattern:/\b[Uu]ni[Ff]i[-_\ ]?(?:[Uu]ser|[Pp]ass|[Kk]ey|[Aa]uth)\s*[=:]\s*["']?([^\s"',;\n]{4,})["']?/g },
  { id:'UNIFI_SSID', label:'UniFi SSID', category:'MSP', risk:'medium', color:'#6ee7b7',
    pattern:/\b[Ss][Ss][Ii][Dd]\s*[=:]\s*["']?([A-Za-z0-9 _\-!@#$%^&*()\+]{2,32})["']?/g },
  { id:'UNIFI_VLAN', label:'UniFi VLAN Config', category:'MSP', risk:'low', color:'#6ee7b7',
    pattern:/\b[Vv][Ll][Aa][Nn]\s*[=:#]?\s*(\d{1,4})\b/g },
];

var LOGCLEAN_STAGE2_ENABLED = false;

var LOGCLEAN_INTENTS = [
  { id: 'log_analysis', keywords: ['log', 'stack trace', 'exception', 'traceback', 'syslog', 'error', 'alert', 'event id', 'firewall', 'endpoint', 'investigate'] },
  { id: 'ticket_summary', keywords: ['ticket', 'case', 'summary', 'notes', 'service request', 'incident notes', 'summarize'] },
  { id: 'incident_response', keywords: ['ioc', 'malware', 'phishing', 'ransomware', 'threat', 'compromised', 'containment', 'indicator'] },
  { id: 'scripting', keywords: ['script', 'powershell', 'bash', 'python', 'regex', 'automation', 'cli', 'command'] },
  { id: 'client_comms', keywords: ['client', 'customer', 'email reply', 'reply to', 'write an email', 'message the customer', 'status update'] },
  { id: 'documentation', keywords: ['documentation', 'runbook', 'kb', 'knowledge base', 'sop', 'how-to', 'procedure'] },
  { id: 'reporting', keywords: ['report', 'postmortem', 'executive summary', 'weekly summary', 'status report'] },
  { id: 'research', keywords: ['what is', 'compare', 'pros and cons', 'explain', 'research'] },
];

var LOGCLEAN_SAFE_COMPOSE = {
  log_analysis: 'Analyze the sanitized log below. Focus on likely root cause, affected systems, suspicious indicators, and the next three troubleshooting steps.\n\nSanitized log:\n{{text}}',
  ticket_summary: 'Summarize the sanitized ticket details below into a clean technician handoff with issue, impact, work performed, and next action.\n\nSanitized notes:\n{{text}}',
  incident_response: 'Review the sanitized incident details below and produce an incident-response brief with likely severity, immediate containment steps, and evidence to collect next.\n\nSanitized incident data:\n{{text}}',
  scripting: 'Use the sanitized context below to help draft or debug a script. Return a safe script example and explain the logic step by step.\n\nSanitized context:\n{{text}}',
  client_comms: 'Draft a professional customer-safe update using the sanitized details below. Keep it clear, calm, and free from sensitive internal specifics.\n\nSanitized details:\n{{text}}',
  documentation: 'Turn the sanitized notes below into a short internal runbook section with prerequisites, steps, validation, and rollback notes.\n\nSanitized notes:\n{{text}}',
  reporting: 'Create a concise report from the sanitized details below. Include what happened, what changed, business impact, and recommended follow-up.\n\nSanitized details:\n{{text}}',
  research: 'Answer the question below using the sanitized context. Keep the answer practical and tailored to MSP or IT operations.\n\nSanitized question or context:\n{{text}}',
  other: 'Use the sanitized details below to help with the request while keeping the answer practical for MSP and IT work.\n\nSanitized content:\n{{text}}',
};

var LOGCLEAN_ACTION_ORDER = {
  block: 5,
  justify: 4,
  redact: 3,
  warn: 2,
  allow: 1,
};

/** Stage-2 NER Web Worker Integration */
var nerWorker = null;
var nerCallbacks = {};
var nerCounter = 0;

if (LOGCLEAN_STAGE2_ENABLED && typeof window !== 'undefined' && typeof Worker !== 'undefined') {
  try {
    var workerUrl = chrome.runtime.getURL('engine/ner-worker.js');
    nerWorker = new Worker(workerUrl, { type: 'module' });
    
    nerWorker.addEventListener('message', function(e) {
      if (!e || !e.data) return;
      var data = e.data;
      if (data.type === 'RESULT' || data.type === 'ERROR') {
        var cb = nerCallbacks[data.id];
        if (cb) {
          delete nerCallbacks[data.id];
          if (data.type === 'RESULT') cb.resolve(data.findings);
          else cb.reject(new Error(data.error));
        }
      } else if (data.type === 'STATUS') {
        console.log('[CleanPrompt Stage-2] NER Engine status:', data.status);
      }
    });

    // Initialize the WASM backend in the worker
    nerWorker.postMessage({ type: 'INIT' });
  } catch (err) {
    console.warn('[CleanPrompt Stage-2] Could not initialize NER Web Worker:', err);
  }
}

function runNERAsync(text) {
  if (!nerWorker) return Promise.resolve([]);
  return new Promise(function(resolve, reject) {
    var id = ++nerCounter;
    nerCallbacks[id] = { resolve: resolve, reject: reject };
    nerWorker.postMessage({ type: 'DETECT', id: id, text: text });
  });
}

/** Protection metadata (formerly Risk) */
var LOGCLEAN_PROTECTION = {
  critical: { label: 'Secured Token', emoji: '🛡️', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)' }, // Emerald
  high:     { label: 'Protected',     emoji: '✅', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.4)' }, // Sky Blue
  medium:   { label: 'Cleaned',       emoji: '✨', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.4)' }, // Blue
  low:      { label: 'Anonymized',    emoji: '🟢', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.4)' }, // Violet
};

function logcleanBuildRuleCounts(findings) {
  var counts = {};
  findings.forEach(function(f) {
    counts[f.id] = f.count;
  });
  return counts;
}

function logcleanClassifyIntent(text) {
  var normalized = (text || '').toLowerCase();
  var best = { id: 'other', score: 0 };

  LOGCLEAN_INTENTS.forEach(function(intent) {
    var score = 0;
    intent.keywords.forEach(function(keyword) {
      if (normalized.indexOf(keyword) !== -1) score += 1;
    });
    if (score > best.score) best = { id: intent.id, score: score };
  });

  return {
    intent_label: best.id,
    intent_confidence_bucket: best.score >= 3 ? 'high' : best.score >= 1 ? 'medium' : 'low',
  };
}

function logcleanResolvePolicyAction(findings, policyBundle, intentLabel) {
  if (!findings || findings.length === 0) return 'allow';

  var actions = [];
  var byCategory = policyBundle && policyBundle.actions && policyBundle.actions.by_category;
  if (byCategory) {
    findings.forEach(function(f) {
      if (byCategory[f.category]) actions.push(byCategory[f.category]);
    });
  }

  var intentAction = policyBundle && policyBundle.intent_rules && policyBundle.intent_rules[intentLabel];
  if (intentAction) actions.push(intentAction);
  if (!actions.length) actions.push(policyBundle && policyBundle.actions && policyBundle.actions.default || 'warn');

  return actions.sort(function(a, b) {
    return (LOGCLEAN_ACTION_ORDER[b] || 0) - (LOGCLEAN_ACTION_ORDER[a] || 0);
  })[0];
}

function logcleanBuildExplanation(summary, intentLabel, action) {
  if (!summary.total) {
    return 'No sensitive values were detected. This prompt looks safe to send as written.';
  }

  var topCategory = Object.keys(summary.byCategory || {}).sort(function(a, b) {
    return (summary.byCategory[b] || 0) - (summary.byCategory[a] || 0);
  })[0] || 'data';

  return 'CleanPrompt secured ' + summary.total + ' sensitive item' + (summary.total === 1 ? '' : 's') +
    ' before this prompt leaves your device. Most matches were ' + topCategory +
    ' related, the likely workflow is ' + intentLabel.replace(/_/g, ' ') +
    ', and the current policy action is ' + action + '.';
}

function logcleanBuildSafeComposePrompt(text, intentLabel) {
  var template = LOGCLEAN_SAFE_COMPOSE[intentLabel] || LOGCLEAN_SAFE_COMPOSE.other;
  return template.replace('{{text}}', text);
}

function logcleanPromptSizeBucket(text) {
  var length = (text || '').length;
  if (length < 220) return 'small';
  if (length < 900) return 'medium';
  return 'large';
}

function logcleanBuildEventSummary(result, context) {
  var summary = logcleanGetSummary(result.findings);
  var policyBundle = context.policy_bundle || null;
  var action = context.action || result.policy_action || 'warn';
  return {
    schema_version: context.schema_version || '1.0.0',
    org_id: context.org_id || 'org_local',
    org_name: context.org_name || 'Local Workspace',
    team_id: context.team_id || 'unassigned',
    team_name: context.team_name || 'Unassigned',
    device_id: context.device_id || 'device-local',
    extension_version: context.extension_version || '0.0.0',
    policy_version: context.policy_version || policyBundle && policyBundle.policy_version || null,
    rules_version: context.rules_version || policyBundle && policyBundle.rules && (policyBundle.rules.bundle_version || policyBundle.rules.local_bundle_version) || null,
    site: context.site || 'unknown',
    action: action,
    intent_label: result.intent_label,
    intent_confidence_bucket: result.intent_confidence_bucket,
    sensitivity_categories: Object.keys(summary.byCategory || {}),
    rule_ids: result.findings.map(function(f) { return f.id; }),
    count_summary: {
      total: summary.total,
      by_category: summary.byCategory,
      by_risk: summary.byRisk,
    },
    prompt_size_bucket: logcleanPromptSizeBucket(result.sanitized_text),
    timestamp_bucket: new Date().toISOString().slice(0, 13) + ':00:00.000Z',
    rotating_actor_id: context.rotating_actor_id || 'device-local',
    strict_mode: Boolean(context.strict_mode),
    raw_text_absent: true,
    justification_required: Boolean(action === 'justify'),
    justification_provided: Boolean(context.justification_provided),
  };
}

/**
 * Core redact function (Async) — runs regex fast-pass, then defers to NER worker
 * Returns: { sanitized, findings, tokens, protectionSummary }
 */
async function logcleanRedact(text, enabledIds) {
  var options = arguments.length > 2 && arguments[2] ? arguments[2] : {};
  if (!text) {
    return {
      sanitized: '',
      sanitized_text: '',
      findings: [],
      tokens: {},
      protectionSummary: {},
      rule_counts: {},
      intent_label: 'other',
      intent_confidence_bucket: 'low',
      policy_action: 'allow',
      employee_explanation: 'No content to process.',
      safe_compose_prompt: '',
      event_summary: null,
    };
  }

  var output = text;
  var findingsMap = {};
  var tokens = {};
  var activeRules = enabledIds
    ? LOGCLEAN_RULES.filter(function(r){ return enabledIds.indexOf(r.id) !== -1; })
    : LOGCLEAN_RULES;

  // == STAGE 1: Regex Fast-Pass ==
  activeRules.forEach(function(rule) {
    var counterMap = {};

    var regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    output = output.replace(regex, function(match) {
      if (!findingsMap[rule.id]) {
        findingsMap[rule.id] = {
          id: rule.id,
          label: rule.label,
          category: rule.category,
          risk: rule.risk || 'medium',
          color: rule.color,
          count: 0
        };
      }
      findingsMap[rule.id].count++;
      if (!counterMap[match]) counterMap[match] = Object.keys(counterMap).length + 1;
      var token = '[' + rule.id + '_' + counterMap[match] + ']';
      tokens[token] = match;
      return token;
    });
  });

  // == STAGE 2: Zero-shot NER via WebAssembly ==
  try {
    var nerOutput = await runNERAsync(output);
    var nerCounterMap = {};

    // Sort backwards by start index so string replacements don't shift earlier indices
    nerOutput.sort(function(a, b) { return b.start - a.start; });

    nerOutput.forEach(function(r) {
      if (r.score < 0.6) return; // Confidence threshold
      var ruleId = 'NER_' + r.category.toUpperCase();
      if (!findingsMap[ruleId]) {
        findingsMap[ruleId] = {
          id: ruleId,
          label: 'Contextual ' + r.category,
          category: r.category,
          risk: 'high',
          color: '#e879f9',
          count: 0
        };
      }
      findingsMap[ruleId].count++;
      var matchText = r.word;
      if (!nerCounterMap[matchText]) nerCounterMap[matchText] = Object.keys(nerCounterMap).length + 1;
      var token = '[' + ruleId + '_' + nerCounterMap[matchText] + ']';
      tokens[token] = matchText;

      // Replace using substr since we have exact indices
      output = output.substr(0, r.start) + token + output.substr(r.end);
    });
  } catch (err) {
    console.warn('[CleanPrompt Stage-2] NER inference failed/timeout:', err);
  }

  var findings = Object.values(findingsMap).sort(function(a, b) {
    var protectionOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    var rd = (protectionOrder[a.risk] || 2) - (protectionOrder[b.risk] || 2);
    return rd !== 0 ? rd : a.category.localeCompare(b.category);
  });

  // Build protection summary
  var protectionSummary = {};
  findings.forEach(function(f) {
    protectionSummary[f.risk] = (protectionSummary[f.risk] || 0) + f.count;
  });

  var summary = logcleanGetSummary(findings);
  var intent = logcleanClassifyIntent(output);
  var policyAction = logcleanResolvePolicyAction(findings, options.policyBundle || null, intent.intent_label);
  var employeeExplanation = logcleanBuildExplanation(summary, intent.intent_label, policyAction);
  var safeComposePrompt = logcleanBuildSafeComposePrompt(output, intent.intent_label);
  var result = {
    sanitized: output,
    sanitized_text: output,
    findings: findings,
    tokens: tokens,
    protectionSummary: protectionSummary,
    rule_counts: logcleanBuildRuleCounts(findings),
    intent_label: intent.intent_label,
    intent_confidence_bucket: intent.intent_confidence_bucket,
    policy_action: policyAction,
    employee_explanation: employeeExplanation,
    safe_compose_prompt: safeComposePrompt,
  };

  result.event_summary = logcleanBuildEventSummary(result, {
    schema_version: options.schema_version,
    org_id: options.org_id,
    org_name: options.org_name,
    team_id: options.team_id,
    team_name: options.team_name,
    device_id: options.device_id,
    extension_version: options.extension_version,
    policy_version: options.policy_version,
    rules_version: options.rules_version,
    site: options.site,
    action: policyAction,
    policy_bundle: options.policyBundle || null,
    rotating_actor_id: options.rotating_actor_id,
    strict_mode: options.strict_mode,
    justification_provided: options.justification_provided,
  });

  return result;
}

function logcleanGetSummary(findings) {
  var total = 0;
  var byCategory = {};
  var byProtection = {};
  findings.forEach(function(f) {
    total += f.count;
    byCategory[f.category] = (byCategory[f.category] || 0) + f.count;
    byProtection[f.risk] = (byProtection[f.risk] || 0) + f.count;
  });
  return { total: total, byCategory: byCategory, byProtection: byProtection, byRisk: byProtection };
}
