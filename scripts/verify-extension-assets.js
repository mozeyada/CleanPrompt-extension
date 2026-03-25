const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const ALLOWED_RULE_RISKS = new Set(['low', 'medium', 'high', 'critical']);
const ALLOWED_REGEX_FLAGS = new Set(['d', 'g', 'i', 'm', 's', 'u', 'v', 'y']);
const PNG_SIGNATURE = '89504e470d0a1a0a';
const IGNORED_RESPONSE_FIELDS = new Set(['ok', 'reason', 'message', 'status', 'error', 'code']);

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hasOnlyUniqueCharacters(text) {
  return new Set(text.split('')).size === text.length;
}

function isPlainNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function collectMatches(text, pattern) {
  const results = [];
  let match = pattern.exec(text);
  while (match) {
    results.push(match[1]);
    match = pattern.exec(text);
  }
  return results;
}

function collectClassNames(values) {
  return values
    .flatMap((value) => String(value).split(/\s+/))
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveManifestPattern(rootDir, relativePattern) {
  ensure(isPlainNonEmptyString(relativePattern), 'invalid_manifest_resource_pattern');

  if (!relativePattern.includes('*')) {
    const absoluteFilePath = path.join(rootDir, relativePattern);
    ensure(fs.existsSync(absoluteFilePath), 'missing_manifest_resource:' + relativePattern);
    return [relativePattern];
  }

  ensure(relativePattern.endsWith('/*'), 'unsupported_manifest_resource_pattern:' + relativePattern);

  const directoryPath = path.join(rootDir, relativePattern.slice(0, -2));
  ensure(fs.existsSync(directoryPath), 'missing_manifest_resource_directory:' + relativePattern);
  ensure(fs.statSync(directoryPath).isDirectory(), 'manifest_resource_not_directory:' + relativePattern);

  return fs.readdirSync(directoryPath)
    .filter((entry) => fs.statSync(path.join(directoryPath, entry)).isFile())
    .map((entry) => path.posix.join(relativePattern.slice(0, -2), entry))
    .sort();
}

function verifyManifest(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const manifestPath = options.manifestPath || path.join(rootDir, 'manifest.json');
  const manifest = readJsonFile(manifestPath);

  ensure(manifest.manifest_version === 3, 'invalid_manifest_version');
  ensure(isPlainNonEmptyString(manifest.name), 'missing_manifest_name');
  ensure(isPlainNonEmptyString(manifest.version), 'missing_manifest_version_string');
  ensure(isPlainNonEmptyString(manifest.description), 'missing_manifest_description');

  ensure(Array.isArray(manifest.permissions) && manifest.permissions.length > 0, 'missing_permissions');
  ensure(Array.isArray(manifest.host_permissions) && manifest.host_permissions.length > 0, 'missing_host_permissions');

  const hostPermissionSet = new Set(manifest.host_permissions);
  ensure(manifest.background && isPlainNonEmptyString(manifest.background.service_worker), 'missing_service_worker');
  ensure(fs.existsSync(path.join(rootDir, manifest.background.service_worker)), 'missing_service_worker_file');

  ensure(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0, 'missing_content_scripts');

  const contentScriptMatches = new Set();
  manifest.content_scripts.forEach((entry, index) => {
    ensure(Array.isArray(entry.matches) && entry.matches.length > 0, 'missing_content_script_matches:' + index);
    ensure(Array.isArray(entry.js) && entry.js.length > 0, 'missing_content_script_js:' + index);

    entry.matches.forEach((matchPattern) => {
      ensure(hostPermissionSet.has(matchPattern), 'content_script_match_not_in_host_permissions:' + matchPattern);
      contentScriptMatches.add(matchPattern);
    });

    entry.js.forEach((relativePath) => {
      ensure(fs.existsSync(path.join(rootDir, relativePath)), 'missing_content_script_file:' + relativePath);
    });

    (entry.css || []).forEach((relativePath) => {
      ensure(fs.existsSync(path.join(rootDir, relativePath)), 'missing_content_style_file:' + relativePath);
    });
  });

  ensure(manifest.action && isPlainNonEmptyString(manifest.action.default_popup), 'missing_default_popup');
  ensure(fs.existsSync(path.join(rootDir, manifest.action.default_popup)), 'missing_default_popup_file');

  const referencedIcons = new Set();
  [manifest.icons, manifest.action.default_icon].forEach((iconMap) => {
    ensure(iconMap && typeof iconMap === 'object', 'missing_icon_map');
    Object.values(iconMap).forEach((relativePath) => {
      ensure(isPlainNonEmptyString(relativePath), 'invalid_icon_path');
      referencedIcons.add(relativePath);
    });
  });
  referencedIcons.forEach((relativePath) => {
    ensure(fs.existsSync(path.join(rootDir, relativePath)), 'missing_icon_file:' + relativePath);
  });

  ensure(
    manifest.content_security_policy
      && isPlainNonEmptyString(manifest.content_security_policy.extension_pages),
    'missing_extension_page_csp'
  );

  ensure(
    Array.isArray(manifest.web_accessible_resources) && manifest.web_accessible_resources.length > 0,
    'missing_web_accessible_resources'
  );

  const accessibleFiles = new Set();
  manifest.web_accessible_resources.forEach((entry, index) => {
    ensure(Array.isArray(entry.resources) && entry.resources.length > 0, 'missing_web_resources:' + index);
    ensure(Array.isArray(entry.matches) && entry.matches.length > 0, 'missing_web_resource_matches:' + index);

    const entryMatchSet = new Set(entry.matches);
    ensure(
      entry.matches.length === contentScriptMatches.size
      && [...contentScriptMatches].every((matchPattern) => entryMatchSet.has(matchPattern)),
      'web_resource_match_drift:' + index
    );

    entry.resources.forEach((relativePattern) => {
      resolveManifestPattern(rootDir, relativePattern).forEach((resolvedPath) => {
        accessibleFiles.add(resolvedPath);
      });
    });
  });

  return {
    manifest,
    contentScriptMatchCount: contentScriptMatches.size,
    accessibleFileCount: accessibleFiles.size,
    accessibleFiles: [...accessibleFiles].sort(),
  };
}

function verifyRuleBundle(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const rulesPath = options.rulesPath || path.join(rootDir, 'engine', 'rules.json');
  const ruleBundle = readJsonFile(rulesPath);

  ensure(isPlainNonEmptyString(ruleBundle.version), 'missing_rules_version');
  ensure(/^\d+\.\d+\.\d+$/.test(ruleBundle.version), 'invalid_rules_version');
  ensure(isPlainNonEmptyString(ruleBundle.released), 'missing_rules_released');
  ensure(/^\d{4}-\d{2}-\d{2}$/.test(ruleBundle.released), 'invalid_rules_released');
  ensure(isPlainNonEmptyString(ruleBundle.description), 'missing_rules_description');
  ensure(Array.isArray(ruleBundle.rules) && ruleBundle.rules.length > 0, 'missing_rules');

  const seenRuleIds = new Set();

  ruleBundle.rules.forEach((rule, index) => {
    ensure(rule && typeof rule === 'object', 'invalid_rule:' + index);
    ensure(isPlainNonEmptyString(rule.id), 'missing_rule_id:' + index);
    ensure(!seenRuleIds.has(rule.id), 'duplicate_rule_id:' + rule.id);
    seenRuleIds.add(rule.id);

    ensure(isPlainNonEmptyString(rule.label), 'missing_rule_label:' + rule.id);
    ensure(isPlainNonEmptyString(rule.category), 'missing_rule_category:' + rule.id);
    ensure(ALLOWED_RULE_RISKS.has(rule.risk), 'invalid_rule_risk:' + rule.id);
    ensure(isPlainNonEmptyString(rule.pattern), 'missing_rule_pattern:' + rule.id);

    const flags = rule.flags || '';
    ensure(typeof flags === 'string', 'invalid_rule_flags:' + rule.id);
    ensure(hasOnlyUniqueCharacters(flags), 'duplicate_rule_flags:' + rule.id);
    ensure(flags.split('').every((flag) => ALLOWED_REGEX_FLAGS.has(flag)), 'unsupported_rule_flags:' + rule.id);

    try {
      // Compile every shipped pattern at verification time so malformed rule edits fail fast.
      new RegExp(rule.pattern, flags);
    } catch (error) {
      throw new Error('invalid_rule_regex:' + rule.id + ':' + error.message);
    }
  });

  return {
    ruleBundle,
    ruleCount: ruleBundle.rules.length,
  };
}

function verifyPopupStructure(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const popupHtmlPath = options.popupHtmlPath || path.join(rootDir, 'popup.html');
  const popupJsPath = options.popupJsPath || path.join(rootDir, 'popup.js');
  const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
  const popupJs = fs.readFileSync(popupJsPath, 'utf8');

  const popupIds = new Set(collectMatches(popupHtml, /id="([^"]+)"/g));
  const referencedIds = new Set(collectMatches(popupJs, /getElementById\('([^']+)'\)/g));
  const tabNames = collectMatches(popupHtml, /data-tab="([^"]+)"/g);

  ensure(tabNames.length > 0, 'missing_popup_tabs');
  ensure(/class="[^"]*\btab\b/.test(popupHtml), 'missing_popup_tab_class');
  ensure(/class="[^"]*\bpanel\b/.test(popupHtml), 'missing_popup_panel_class');

  tabNames.forEach((tabName) => {
    ensure(popupIds.has('panel-' + tabName), 'missing_popup_panel_for_tab:' + tabName);
  });

  referencedIds.forEach((id) => {
    ensure(popupIds.has(id), 'missing_popup_id:' + id);
  });

  return {
    popupHookCount: referencedIds.size,
    popupTabCount: tabNames.length,
  };
}

function verifySidebarStructure(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const contentJsPath = options.contentJsPath || path.join(rootDir, 'content.js');
  const sidebarCssPath = options.sidebarCssPath || path.join(rootDir, 'sidebar.css');
  const contentJs = fs.readFileSync(contentJsPath, 'utf8');
  const sidebarCss = fs.readFileSync(sidebarCssPath, 'utf8');
  const contentCreatedIds = new Set([
    ...collectMatches(contentJs, /id="([^"]+)"/g),
    ...collectMatches(contentJs, /\.id = '([^']+)'/g),
  ]);
  const contentClasses = new Set(collectClassNames([
    ...collectMatches(contentJs, /class="([^"]+)"/g),
    ...collectMatches(contentJs, /\.className = '([^']+)'/g),
    ...collectMatches(contentJs, /classList\.add\('([^']+)'\)/g),
  ]));

  const criticalSelectors = [
    '#logclean-trigger-wrap',
    '#logclean-trigger',
    '#logclean-sidebar',
    '#lc-toast-wrap',
    '.lc-toast',
    '.lc-toast-out',
    '#lc-header',
    '#lc-tabs',
    '.lc-tab',
    '.lc-tab-content',
    '#lc-raw-input',
    '#lc-redact-btn',
    '#lc-actions',
    '#lc-compose-btn',
    '#lc-insert-btn',
    '#lc-intercept-overlay',
    '#lc-intercept-modal',
    '#lc-intercept-preview',
    '#lc-intercept-justification-wrap',
    '#lc-intercept-justification',
  ];

  criticalSelectors.forEach((selector) => {
    if (selector.startsWith('#')) {
      ensure(contentCreatedIds.has(selector.slice(1)), 'missing_content_hook:' + selector);
    } else if (selector.startsWith('.')) {
      ensure(contentClasses.has(selector.slice(1)), 'missing_content_hook:' + selector);
    }
    ensure(sidebarCss.includes(selector), 'missing_sidebar_selector:' + selector);
  });

  return {
    sidebarSelectorCount: criticalSelectors.length,
  };
}

function verifyContentStructure(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const contentJsPath = options.contentJsPath || path.join(rootDir, 'content.js');
  const contentJs = fs.readFileSync(contentJsPath, 'utf8');

  const referencedIds = new Set(collectMatches(contentJs, /getElementById\('([^']+)'\)/g));
  const htmlTemplateIds = new Set(collectMatches(contentJs, /id="([^"]+)"/g));
  const assignedIds = new Set(collectMatches(contentJs, /\.id = '([^']+)'/g));
  const createdIds = new Set([...htmlTemplateIds, ...assignedIds]);

  referencedIds.forEach((id) => {
    ensure(createdIds.has(id), 'missing_content_created_id:' + id);
  });

  ensure(contentJs.includes("querySelectorAll('.lc-tab')"), 'missing_content_tab_query');
  ensure(contentJs.includes('data-tab="paste"'), 'missing_content_paste_tab');
  ensure(contentJs.includes('data-tab="audit"'), 'missing_content_audit_tab');

  return {
    contentReferencedIdCount: referencedIds.size,
    contentCreatedIdCount: createdIds.size,
  };
}

function extractHostnameFromMatchPattern(value) {
  const match = String(value).match(/^https?:\/\/([^/]+)\/\*$/);
  return match ? match[1] : null;
}

function extractLiteralUrls(text) {
  return collectMatches(text, /(https?:\/\/[^\s"'`<>]+)/g).map((value) => value.replace(/[),;]+$/, ''));
}

function extractPopupSupportedPlatforms(popupJs) {
  const entries = [];
  const pattern = /\{\s*icon:\s*'[^']+',\s*key:\s*'([^']+)',\s*name:\s*'[^']+',\s*host:\s*'([^']+)',\s*url:\s*'([^']+)'\s*\}/g;
  let match = pattern.exec(popupJs);
  while (match) {
    entries.push({
      key: match[1],
      host: match[2],
      url: match[3],
    });
    match = pattern.exec(popupJs);
  }
  return entries;
}

function extractContentPlatformMatchers(contentJs) {
  const pattern = /([a-z0-9_]+):\s*\{[\s\S]*?test:\s*function\(\)\s*\{\s*return\s*\/([^/]+)\/\.test\(location\.hostname\);\s*\},/g;
  const matchers = [];
  let match = pattern.exec(contentJs);
  while (match) {
    matchers.push({
      key: match[1],
      regexSource: match[2],
      regex: new RegExp(match[2]),
    });
    match = pattern.exec(contentJs);
  }
  return matchers;
}

function verifySupportedHostCoverage(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const manifestPath = options.manifestPath || path.join(rootDir, 'manifest.json');
  const popupJsPath = options.popupJsPath || path.join(rootDir, 'popup.js');
  const contentJsPath = options.contentJsPath || path.join(rootDir, 'content.js');
  const manifest = readJsonFile(manifestPath);
  const popupJs = fs.readFileSync(popupJsPath, 'utf8');
  const contentJs = fs.readFileSync(contentJsPath, 'utf8');

  const popupPlatforms = extractPopupSupportedPlatforms(popupJs);
  ensure(popupPlatforms.length > 0, 'missing_popup_supported_platforms');

  const popupHosts = popupPlatforms.map((entry) => entry.host).sort();
  ensure(new Set(popupHosts).size === popupHosts.length, 'duplicate_popup_supported_host');

  popupPlatforms.forEach((entry) => {
    ensure(isPlainNonEmptyString(entry.key), 'invalid_popup_supported_key');
    ensure(isPlainNonEmptyString(entry.host), 'invalid_popup_supported_host');
    ensure(isPlainNonEmptyString(entry.url), 'invalid_popup_supported_url');
    ensure(new URL(entry.url).hostname === entry.host, 'popup_url_host_mismatch:' + entry.host);
  });

  const manifestHosts = (manifest.content_scripts || [])
    .flatMap((entry) => entry.matches || [])
    .map(extractHostnameFromMatchPattern)
    .filter(Boolean)
    .sort();
  const nonLocalManifestHosts = manifestHosts.filter((host) => host !== 'localhost' && host !== '127.0.0.1:8787');

  ensure(
    JSON.stringify([...new Set(nonLocalManifestHosts)]) === JSON.stringify(popupHosts),
    'supported_host_surface_drift'
  );

  const contentMatchers = extractContentPlatformMatchers(contentJs);
  ensure(contentMatchers.length > 0, 'missing_content_platform_matchers');

  popupPlatforms.forEach((entry) => {
    const matcher = contentMatchers.find((candidate) => candidate.key === entry.key);
    ensure(Boolean(matcher), 'missing_content_platform_key:' + entry.key);
    ensure(matcher.regex.test(entry.host), 'content_platform_host_mismatch:' + entry.key + ':' + entry.host);
  });

  return {
    supportedHostSurfaceCount: popupPlatforms.length,
    platformMatcherCount: contentMatchers.length,
  };
}

function verifyRuntimeUrlDependencies(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const manifestPath = options.manifestPath || path.join(rootDir, 'manifest.json');
  const popupJsPath = options.popupJsPath || path.join(rootDir, 'popup.js');
  const backgroundJsPath = options.backgroundJsPath || path.join(rootDir, 'background.js');

  const manifest = readJsonFile(manifestPath);
  const popupJs = fs.readFileSync(popupJsPath, 'utf8');
  const backgroundJs = fs.readFileSync(backgroundJsPath, 'utf8');

  const remoteManifestHosts = new Set(
    (manifest.host_permissions || [])
      .map(extractHostnameFromMatchPattern)
      .filter((host) => host && host !== 'localhost' && host !== '127.0.0.1:8787')
  );
  const localAllowedHosts = new Set(['localhost', '127.0.0.1']);

  extractLiteralUrls(popupJs).forEach((urlValue) => {
    const hostname = new URL(urlValue).hostname;
    ensure(remoteManifestHosts.has(hostname), 'unexpected_popup_url_host:' + hostname);
  });

  extractLiteralUrls(backgroundJs).forEach((urlValue) => {
    const hostname = new URL(urlValue).hostname;
    ensure(localAllowedHosts.has(hostname), 'unexpected_background_url_host:' + hostname);
  });

  [
    { relativePath: 'popup.html' },
    { relativePath: 'sidebar.css' },
    { relativePath: 'content.js' },
    { relativePath: 'engine/redactor.js' },
    { relativePath: 'engine/ner-worker.js' },
  ].forEach((entry) => {
    const text = fs.readFileSync(path.join(rootDir, entry.relativePath), 'utf8');
    const urls = extractLiteralUrls(text);
    ensure(urls.length === 0, 'unexpected_embedded_runtime_url:' + entry.relativePath);
  });

  return {
    popupUrlCount: extractLiteralUrls(popupJs).length,
    backgroundUrlCount: extractLiteralUrls(backgroundJs).length,
    manifestRemoteHostCount: remoteManifestHosts.size,
  };
}

function extractMessageTypesFromOutboundScript(scriptText) {
  const outboundTypes = new Set([
    ...collectMatches(scriptText, /sendRuntimeMessage\(\{\s*type:\s*'([^']+)'/g),
    ...collectMatches(scriptText, /safeSendRuntimeMessage\(\{\s*type:\s*'([^']+)'/g),
    ...collectMatches(scriptText, /sendMessage\(\{\s*type:\s*'([^']+)'/g),
  ]);
  return [...outboundTypes].sort();
}

function extractBackgroundHandledMessageTypes(backgroundJs) {
  return [...new Set(collectMatches(backgroundJs, /if \(msg\.type === '([^']+)'\)/g))].sort();
}

function extractBackgroundMessageHandlerBlock(backgroundJs, messageType) {
  const startMarker = "if (msg.type === '" + messageType + "') {";
  const startIndex = backgroundJs.indexOf(startMarker);
  ensure(startIndex !== -1, 'missing_background_message_handler:' + messageType);

  const nextMarkerIndex = backgroundJs.indexOf("\n  if (msg.type === '", startIndex + startMarker.length);
  const endIndex = nextMarkerIndex === -1 ? backgroundJs.length : nextMarkerIndex;
  return backgroundJs.slice(startIndex, endIndex);
}

function extractFirstObjectLiteralBlock(text, marker) {
  const markerIndex = text.indexOf(marker);
  ensure(markerIndex !== -1, 'missing_object_literal_marker:' + marker);

  const objectStart = text.indexOf('{', markerIndex + marker.length);
  ensure(objectStart !== -1, 'missing_object_literal_start:' + marker);

  let depth = 0;
  for (let index = objectStart; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(objectStart + 1, index);
      }
    }
  }

  throw new Error('unterminated_object_literal:' + marker);
}

function extractFunctionBlock(text, functionName) {
  const marker = 'function ' + functionName;
  const startIndex = text.indexOf(marker);
  ensure(startIndex !== -1, 'missing_function_block:' + functionName);

  const bodyStart = text.indexOf('{', startIndex);
  ensure(bodyStart !== -1, 'missing_function_body_start:' + functionName);

  let depth = 0;
  for (let index = bodyStart; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  throw new Error('unterminated_function_block:' + functionName);
}

function extractVarStatement(text, variableName) {
  const pattern = new RegExp('var\\s+' + variableName + '\\s*=\\s*[\\[{][\\s\\S]*?\\n\\s*[\\]}];');
  const match = text.match(pattern);
  ensure(match, 'missing_var_statement:' + variableName);
  return match[0];
}

function evaluateVarStatement(statement, variableName) {
  return vm.runInNewContext(statement + '\n' + variableName + ';', {});
}

function extractInterfaceBlock(text, interfaceName) {
  const marker = 'interface ' + interfaceName;
  const startIndex = text.indexOf(marker);
  ensure(startIndex !== -1, 'missing_interface_block:' + interfaceName);

  const bodyStart = text.indexOf('{', startIndex);
  ensure(bodyStart !== -1, 'missing_interface_body_start:' + interfaceName);

  let depth = 0;
  for (let index = bodyStart; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(bodyStart + 1, index);
      }
    }
  }

  throw new Error('unterminated_interface_block:' + interfaceName);
}

function extractQuotedLogcleanKeys(text) {
  return [...new Set(collectMatches(text, /['"](logclean_[a-z0-9_]+)['"]/g))].sort();
}

function extractStorageGetKeys(scriptText) {
  const keys = new Set();
  const arrayPattern = /(?:chrome\.storage\.local\.get|readLocalStorage|safeStorageLocalGet)\(\s*\[([\s\S]*?)\]\s*(?:,|\))/g;
  let match = arrayPattern.exec(scriptText);

  while (match) {
    extractQuotedLogcleanKeys(match[1]).forEach((key) => keys.add(key));
    match = arrayPattern.exec(scriptText);
  }

  return [...keys].sort();
}

function extractStorageSetKeys(scriptText) {
  const keys = new Set();
  const objectPattern = /(?:chrome\.storage\.local\.set|writeLocalStorage)\(\s*\{([\s\S]*?)\}\s*(?:,|\))/g;
  let match = objectPattern.exec(scriptText);

  while (match) {
    collectMatches(match[1], /\b(logclean_[a-z0-9_]+)\s*:/g).forEach((key) => keys.add(key));
    match = objectPattern.exec(scriptText);
  }

  return [...keys].sort();
}

function verifyStorageContract(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const popupJsPath = options.popupJsPath || path.join(rootDir, 'popup.js');
  const contentJsPath = options.contentJsPath || path.join(rootDir, 'content.js');
  const backgroundJsPath = options.backgroundJsPath || path.join(rootDir, 'background.js');

  const popupJs = fs.readFileSync(popupJsPath, 'utf8');
  const contentJs = fs.readFileSync(contentJsPath, 'utf8');
  const backgroundJs = fs.readFileSync(backgroundJsPath, 'utf8');

  const backgroundDeclaredKeys = new Set(collectMatches(backgroundJs, /\b(logclean_[a-z0-9_]+)\s*:/g));
  const backgroundWriteKeys = new Set(extractStorageSetKeys(backgroundJs));
  const backgroundManagedKeys = new Set([...backgroundDeclaredKeys, ...backgroundWriteKeys]);
  const backgroundReadKeys = extractStorageGetKeys(backgroundJs);
  const popupStorageKeys = new Set([
    ...extractStorageGetKeys(popupJs),
    ...extractStorageSetKeys(popupJs),
  ]);
  const contentStorageKeys = new Set([
    ...extractStorageGetKeys(contentJs),
    ...extractStorageSetKeys(contentJs),
  ]);

  ensure(backgroundManagedKeys.size > 0, 'missing_background_storage_contract');

  backgroundReadKeys.forEach((key) => {
    ensure(backgroundManagedKeys.has(key), 'unmanaged_background_storage_key:' + key);
  });

  popupStorageKeys.forEach((key) => {
    ensure(backgroundManagedKeys.has(key), 'undeclared_popup_storage_key:' + key);
  });

  contentStorageKeys.forEach((key) => {
    ensure(backgroundManagedKeys.has(key), 'undeclared_content_storage_key:' + key);
  });

  return {
    backgroundManagedStorageKeyCount: backgroundManagedKeys.size,
    backgroundReadStorageKeyCount: backgroundReadKeys.length,
    popupStorageKeyCount: popupStorageKeys.size,
    contentStorageKeyCount: contentStorageKeys.size,
  };
}

function verifyRuntimeResponseSurface(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const popupJsPath = options.popupJsPath || path.join(rootDir, 'popup.js');
  const contentJsPath = options.contentJsPath || path.join(rootDir, 'content.js');
  const backgroundJsPath = options.backgroundJsPath || path.join(rootDir, 'background.js');

  const popupJs = fs.readFileSync(popupJsPath, 'utf8');
  const contentJs = fs.readFileSync(contentJsPath, 'utf8');
  const backgroundJs = fs.readFileSync(backgroundJsPath, 'utf8');

  const getSettingsBlock = extractBackgroundMessageHandlerBlock(backgroundJs, 'GET_SETTINGS');
  const popupGetSettingsFields = new Set(collectMatches(popupJs, /\bsettings\.([a-zA-Z0-9_]+)/g).filter((field) => !IGNORED_RESPONSE_FIELDS.has(field)));
  const contentGetSettingsFields = new Set(collectMatches(contentJs, /\bsettings\.([a-zA-Z0-9_]+)/g).filter((field) => !IGNORED_RESPONSE_FIELDS.has(field)));
  const getSettingsProviderFields = new Set([
    ...extractStorageGetKeys(getSettingsBlock),
    ...collectMatches(getSettingsBlock, /result\.([a-zA-Z0-9_]+)\s*=/g),
  ]);

  popupGetSettingsFields.forEach((field) => {
    ensure(getSettingsProviderFields.has(field), 'missing_get_settings_response_field_for_popup:' + field);
  });
  contentGetSettingsFields.forEach((field) => {
    ensure(getSettingsProviderFields.has(field), 'missing_get_settings_response_field_for_content:' + field);
  });

  const getAuditLogProviderFields = new Set(collectMatches(backgroundJs, /auditLog\.unshift\(\{([\s\S]*?)\}\);/g)
    .flatMap((block) => collectMatches(block, /\b([a-zA-Z0-9_]+)\s*:/g)));
  const contentAuditEntryFields = new Set(collectMatches(contentJs, /\bentry\.([a-zA-Z0-9_]+)/g).filter((field) => !IGNORED_RESPONSE_FIELDS.has(field)));

  ensure(getAuditLogProviderFields.size > 0, 'missing_audit_log_provider_shape');
  contentAuditEntryFields.forEach((field) => {
    ensure(getAuditLogProviderFields.has(field), 'missing_audit_log_entry_field:' + field);
  });

  return {
    getSettingsProviderFieldCount: getSettingsProviderFields.size,
    popupGetSettingsFieldCount: popupGetSettingsFields.size,
    contentGetSettingsFieldCount: contentGetSettingsFields.size,
    auditLogEntryFieldCount: getAuditLogProviderFields.size,
    contentAuditEntryFieldCount: contentAuditEntryFields.size,
  };
}

function verifyRedactionResultSurface(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const redactorJsPath = options.redactorJsPath || path.join(rootDir, 'engine', 'redactor.js');
  const popupJsPath = options.popupJsPath || path.join(rootDir, 'popup.js');
  const contentJsPath = options.contentJsPath || path.join(rootDir, 'content.js');

  const redactorJs = fs.readFileSync(redactorJsPath, 'utf8');
  const popupJs = fs.readFileSync(popupJsPath, 'utf8');
  const contentJs = fs.readFileSync(contentJsPath, 'utf8');

  const redactionFunctionBlock = extractFunctionBlock(redactorJs, 'logcleanRedact');
  const eventSummaryFunctionBlock = extractFunctionBlock(redactorJs, 'logcleanBuildEventSummary');
  const emptyResultBlock = extractFirstObjectLiteralBlock(redactionFunctionBlock, 'return ');
  const mainResultBlock = extractFirstObjectLiteralBlock(redactionFunctionBlock, 'var result = ');
  const eventSummaryObjectBlock = extractFirstObjectLiteralBlock(eventSummaryFunctionBlock, 'return ');
  const countSummaryBlock = extractFirstObjectLiteralBlock(eventSummaryObjectBlock, 'count_summary: ');

  const redactionProviderFields = new Set([
    ...collectMatches(emptyResultBlock, /\b([a-zA-Z0-9_]+)\s*:/g),
    ...collectMatches(mainResultBlock, /\b([a-zA-Z0-9_]+)\s*:/g),
    ...collectMatches(redactorJs, /result\.([a-zA-Z0-9_]+)\s*=/g),
  ]);
  const redactionConsumerFields = new Set([
    ...collectMatches(popupJs, /\bresult\.(sanitized|findings|tokens|intent_label|policy_action|employee_explanation|safe_compose_prompt|event_summary)\b/g),
    ...collectMatches(contentJs, /\bresult\.(sanitized|findings|tokens|intent_label|policy_action|employee_explanation|safe_compose_prompt|event_summary)\b/g),
  ]);
  const eventSummaryProviderFields = new Set(collectMatches(eventSummaryObjectBlock, /\b([a-zA-Z0-9_]+)\s*:/g));
  const eventSummaryCountSummaryFields = new Set(collectMatches(countSummaryBlock, /\b([a-zA-Z0-9_]+)\s*:/g));
  const eventSummaryConsumerFields = new Set(collectMatches(contentJs, /\beventSummary\.([a-zA-Z0-9_]+)\b/g));
  const eventSummaryCountConsumerFields = new Set(collectMatches(contentJs, /\beventSummary\.count_summary\.([a-zA-Z0-9_]+)\b/g));

  redactionConsumerFields.forEach((field) => {
    ensure(redactionProviderFields.has(field), 'missing_redaction_result_field:' + field);
  });

  eventSummaryConsumerFields.forEach((field) => {
    ensure(eventSummaryProviderFields.has(field), 'missing_redaction_event_summary_field:' + field);
  });

  eventSummaryCountConsumerFields.forEach((field) => {
    ensure(eventSummaryCountSummaryFields.has(field), 'missing_redaction_count_summary_field:' + field);
  });

  return {
    redactionResultProviderFieldCount: redactionProviderFields.size,
    redactionResultConsumerFieldCount: redactionConsumerFields.size,
    redactionEventSummaryFieldCount: eventSummaryProviderFields.size,
    redactionEventSummaryConsumerFieldCount: eventSummaryConsumerFields.size,
    redactionCountSummaryFieldCount: eventSummaryCountSummaryFields.size,
    redactionCountSummaryConsumerFieldCount: eventSummaryCountConsumerFields.size,
  };
}

function verifyRuleMetadataSurface(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const redactorJsPath = options.redactorJsPath || path.join(rootDir, 'engine', 'redactor.js');
  const rulesPath = options.rulesPath || path.join(rootDir, 'engine', 'rules.json');
  const popupJsPath = options.popupJsPath || path.join(rootDir, 'popup.js');
  const contentJsPath = options.contentJsPath || path.join(rootDir, 'content.js');

  const redactorJs = fs.readFileSync(redactorJsPath, 'utf8');
  const popupJs = fs.readFileSync(popupJsPath, 'utf8');
  const contentJs = fs.readFileSync(contentJsPath, 'utf8');
  const ruleBundle = readJsonFile(rulesPath);

  const redactorRules = evaluateVarStatement(extractVarStatement(redactorJs, 'LOGCLEAN_RULES'), 'LOGCLEAN_RULES');
  const protectionMap = evaluateVarStatement(extractVarStatement(redactorJs, 'LOGCLEAN_PROTECTION'), 'LOGCLEAN_PROTECTION');
  const popupCategories = Object.keys(evaluateVarStatement(extractVarStatement(popupJs, 'CAT_COLORS'), 'CAT_COLORS'));
  const contentCategories = Object.keys(evaluateVarStatement(extractVarStatement(contentJs, 'CAT_COLORS'), 'CAT_COLORS'));

  ensure(Array.isArray(redactorRules) && redactorRules.length > 0, 'missing_redactor_rules');
  ensure(Array.isArray(ruleBundle.rules) && ruleBundle.rules.length > 0, 'missing_rule_bundle_rules');
  ensure(redactorRules.length === ruleBundle.rules.length, 'rule_surface_count_drift');

  const redactorRuleMap = new Map(redactorRules.map((rule) => [rule.id, rule]));
  const ruleCategories = new Set();
  const ruleRisks = new Set();

  ruleBundle.rules.forEach((rule) => {
    const redactorRule = redactorRuleMap.get(rule.id);
    ensure(redactorRule, 'missing_redactor_rule:' + rule.id);
    ensure(redactorRule.label === rule.label, 'rule_label_drift:' + rule.id);
    ensure(redactorRule.category === rule.category, 'rule_category_drift:' + rule.id);
    ensure((redactorRule.risk || 'medium') === rule.risk, 'rule_risk_drift:' + rule.id);
    ensure(redactorRule.pattern && redactorRule.pattern.source === rule.pattern, 'rule_pattern_drift:' + rule.id);
    ensure((redactorRule.pattern && redactorRule.pattern.flags || '') === (rule.flags || ''), 'rule_flags_drift:' + rule.id);
    ensure(isPlainNonEmptyString(redactorRule.color), 'missing_redactor_rule_color:' + rule.id);
    ruleCategories.add(rule.category);
    ruleRisks.add(rule.risk);
  });

  Object.keys(protectionMap).forEach((risk) => {
    ensure(protectionMap[risk] && isPlainNonEmptyString(protectionMap[risk].label), 'invalid_protection_metadata:' + risk);
  });

  [...ruleRisks].forEach((risk) => {
    ensure(Object.prototype.hasOwnProperty.call(protectionMap, risk), 'missing_protection_risk:' + risk);
  });

  [...ruleCategories].forEach((category) => {
    ensure(popupCategories.includes(category), 'missing_popup_category_palette:' + category);
    ensure(contentCategories.includes(category), 'missing_content_category_palette:' + category);
  });

  return {
    bundledRuleSurfaceCount: redactorRules.length,
    bundledRuleCategoryCount: ruleCategories.size,
    bundledRuleRiskCount: ruleRisks.size,
    protectionRiskCount: Object.keys(protectionMap).length,
    popupCategoryPaletteCount: popupCategories.length,
    contentCategoryPaletteCount: contentCategories.length,
  };
}

function verifyPlatformHealthSurface(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const backgroundJsPath = options.backgroundJsPath || path.join(rootDir, 'background.js');
  const contentJsPath = options.contentJsPath || path.join(rootDir, 'content.js');
  const popupJsPath = options.popupJsPath || path.join(rootDir, 'popup.js');
  const extensionRuntimeTypesPath = options.extensionRuntimeTypesPath || path.join(rootDir, 'types', 'extension-runtime.d.ts');

  const backgroundJs = fs.readFileSync(backgroundJsPath, 'utf8');
  const contentJs = fs.readFileSync(contentJsPath, 'utf8');
  const popupJs = fs.readFileSync(popupJsPath, 'utf8');
  const extensionRuntimeTypes = fs.readFileSync(extensionRuntimeTypesPath, 'utf8');

  const normalizeBlock = extractFunctionBlock(backgroundJs, 'normalizePlatformHealthReport');
  const contentBlock = extractFunctionBlock(contentJs, 'buildCompatibilityReport');
  const popupBlock = extractFunctionBlock(popupJs, 'buildPlatformCoverageModel');
  const normalizedFields = new Set(collectMatches(extractFirstObjectLiteralBlock(normalizeBlock, 'return '), /(?:^|\n)\s*([a-zA-Z0-9_]+)\s*:/g));
  const contentReportFields = new Set(collectMatches(extractFirstObjectLiteralBlock(contentBlock, 'var report = '), /(?:^|\n)\s*([a-zA-Z0-9_]+)\s*:/g));
  const popupReportFields = new Set(collectMatches(popupBlock, /\breport\.([a-zA-Z0-9_]+)/g));
  const typedFields = new Set(collectMatches(extractInterfaceBlock(extensionRuntimeTypes, 'PlatformHealthReport'), /\b([a-zA-Z0-9_]+)\??:\s/g));

  contentReportFields.forEach((field) => {
    ensure(normalizedFields.has(field), 'missing_normalized_platform_health_field:' + field);
  });

  popupReportFields.forEach((field) => {
    ensure(normalizedFields.has(field), 'missing_popup_platform_health_field:' + field);
  });

  normalizedFields.forEach((field) => {
    ensure(typedFields.has(field), 'missing_typed_platform_health_field:' + field);
  });

  contentReportFields.forEach((field) => {
    ensure(typedFields.has(field), 'missing_typed_content_platform_health_field:' + field);
  });

  popupReportFields.forEach((field) => {
    ensure(typedFields.has(field), 'missing_typed_popup_platform_health_field:' + field);
  });

  return {
    normalizedPlatformHealthFieldCount: normalizedFields.size,
    contentPlatformHealthFieldCount: contentReportFields.size,
    popupPlatformHealthFieldCount: popupReportFields.size,
    typedPlatformHealthFieldCount: typedFields.size,
  };
}

function verifyStatusResultSurface(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const backgroundJsPath = options.backgroundJsPath || path.join(rootDir, 'background.js');
  const popupJsPath = options.popupJsPath || path.join(rootDir, 'popup.js');
  const extensionRuntimeTypesPath = options.extensionRuntimeTypesPath || path.join(rootDir, 'types', 'extension-runtime.d.ts');

  const backgroundJs = fs.readFileSync(backgroundJsPath, 'utf8');
  const popupJs = fs.readFileSync(popupJsPath, 'utf8');
  const extensionRuntimeTypes = fs.readFileSync(extensionRuntimeTypesPath, 'utf8');

  const typedFields = new Set(collectMatches(extractInterfaceBlock(extensionRuntimeTypes, 'StatusResult'), /\b([a-zA-Z0-9_]+)\??:\s/g));
  const describeResultBlock = extractFunctionBlock(popupJs, 'describeResult');
  const buildManagedViewModelBlock = extractFunctionBlock(popupJs, 'buildManagedViewModel');
  const popupStatusFields = new Set([
    ...collectMatches(describeResultBlock, /\bresult\.([a-zA-Z0-9_]+)/g),
    ...collectMatches(buildManagedViewModelBlock, /\b(?:enrollmentResult|syncResult|auditUploadResult)\.([a-zA-Z0-9_]+)/g),
  ]);

  const emittedFields = new Set(['status', 'ts']);
  ['buildSyncResult', 'buildEnrollmentResult', 'buildAuditUploadResult'].forEach((builderName) => {
    const builderPattern = new RegExp(builderName + "\\('[^']+'\\s*,\\s*\\{([\\s\\S]*?)\\}\\s*\\)", 'g');
    let match = builderPattern.exec(backgroundJs);
    while (match) {
      collectMatches(match[1], /\b([a-zA-Z0-9_]+)\s*:/g).forEach((field) => emittedFields.add(field));
      match = builderPattern.exec(backgroundJs);
    }
  });

  emittedFields.forEach((field) => {
    ensure(typedFields.has(field), 'missing_typed_status_result_field:' + field);
  });

  popupStatusFields.forEach((field) => {
    ensure(typedFields.has(field), 'missing_typed_popup_status_result_field:' + field);
    ensure(emittedFields.has(field), 'missing_emitted_status_result_field:' + field);
  });

  return {
    emittedStatusResultFieldCount: emittedFields.size,
    popupStatusResultFieldCount: popupStatusFields.size,
    typedStatusResultFieldCount: typedFields.size,
  };
}

function verifyManagedViewModelSurface(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const popupJsPath = options.popupJsPath || path.join(rootDir, 'popup.js');
  const popupHtmlPath = options.popupHtmlPath || path.join(rootDir, 'popup.html');
  const popupRuntimeTypesPath = options.popupRuntimeTypesPath || path.join(rootDir, 'types', 'popup-runtime.d.ts');

  const popupJs = fs.readFileSync(popupJsPath, 'utf8');
  const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
  const popupRuntimeTypes = fs.readFileSync(popupRuntimeTypesPath, 'utf8');

  const buildManagedViewModelBlock = extractFunctionBlock(popupJs, 'buildManagedViewModel');
  const renderManagedStatusBlock = extractFunctionBlock(popupJs, 'renderManagedStatus');
  const typedFields = new Set(collectMatches(extractInterfaceBlock(popupRuntimeTypes, 'PopupManagedViewModel'), /\b([a-zA-Z0-9_]+)\??:\s/g));
  const returnedFields = new Set(collectMatches(extractFirstObjectLiteralBlock(buildManagedViewModelBlock, 'return '), /(?:^|\n)\s*([a-zA-Z0-9_]+)\s*:/g));
  const renderedFields = new Set(collectMatches(renderManagedStatusBlock, /\bview\.([a-zA-Z0-9_]+)/g));
  const managedDomIds = new Set(collectMatches(popupHtml, /id="([^"]+)"/g).filter((id) => id.startsWith('managed-')));
  const renderedDomIds = new Set(collectMatches(renderManagedStatusBlock, /'(managed-[a-z0-9-]+)'/g));

  returnedFields.forEach((field) => {
    ensure(typedFields.has(field), 'missing_typed_managed_view_field:' + field);
  });

  renderedFields.forEach((field) => {
    ensure(returnedFields.has(field), 'missing_render_managed_view_field:' + field);
    ensure(typedFields.has(field), 'missing_typed_render_managed_view_field:' + field);
  });

  renderedDomIds.forEach((id) => {
    ensure(managedDomIds.has(id), 'missing_managed_view_dom_id:' + id);
  });

  return {
    managedViewModelFieldCount: returnedFields.size,
    managedViewRenderFieldCount: renderedFields.size,
    managedViewDomIdCount: renderedDomIds.size,
    typedManagedViewFieldCount: typedFields.size,
  };
}

function verifyPlatformCoverageViewModelSurface(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const popupJsPath = options.popupJsPath || path.join(rootDir, 'popup.js');
  const popupHtmlPath = options.popupHtmlPath || path.join(rootDir, 'popup.html');
  const popupRuntimeTypesPath = options.popupRuntimeTypesPath || path.join(rootDir, 'types', 'popup-runtime.d.ts');

  const popupJs = fs.readFileSync(popupJsPath, 'utf8');
  const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
  const popupRuntimeTypes = fs.readFileSync(popupRuntimeTypesPath, 'utf8');

  const buildPlatformCoverageModelBlock = extractFunctionBlock(popupJs, 'buildPlatformCoverageModel');
  const renderPlatformCoverageBlock = extractFunctionBlock(popupJs, 'renderPlatformCoverage');
  const typedFields = new Set(collectMatches(extractInterfaceBlock(popupRuntimeTypes, 'PopupPlatformCoverageItem'), /\b([a-zA-Z0-9_]+)\??:\s/g));
  const itemReturnIndex = buildPlatformCoverageModelBlock.lastIndexOf('return {');
  ensure(itemReturnIndex !== -1, 'missing_platform_coverage_item_return');
  const returnedFields = new Set(
    collectMatches(
      extractFirstObjectLiteralBlock(buildPlatformCoverageModelBlock.slice(itemReturnIndex), 'return '),
      /(?:^|\n)\s*([a-zA-Z0-9_]+)\s*:/g
    )
  );
  const renderedFields = new Set(collectMatches(renderPlatformCoverageBlock, /\bplatform\.([a-zA-Z0-9_]+)/g));
  const popupIds = new Set(collectMatches(popupHtml, /id="([^"]+)"/g));
  const renderedDomIds = new Set(collectMatches(renderPlatformCoverageBlock, /getElementById\('([^']+)'\)/g));

  returnedFields.forEach((field) => {
    ensure(typedFields.has(field), 'missing_typed_platform_coverage_field:' + field);
  });

  renderedFields.forEach((field) => {
    ensure(returnedFields.has(field), 'missing_render_platform_coverage_field:' + field);
    ensure(typedFields.has(field), 'missing_typed_render_platform_coverage_field:' + field);
  });

  renderedDomIds.forEach((id) => {
    ensure(popupIds.has(id), 'missing_platform_coverage_dom_id:' + id);
  });

  return {
    platformCoverageViewModelFieldCount: returnedFields.size,
    platformCoverageRenderFieldCount: renderedFields.size,
    platformCoverageDomIdCount: renderedDomIds.size,
    typedPlatformCoverageFieldCount: typedFields.size,
  };
}

function verifyPopupCleanSurface(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const popupJsPath = options.popupJsPath || path.join(rootDir, 'popup.js');
  const popupHtmlPath = options.popupHtmlPath || path.join(rootDir, 'popup.html');
  const popupRuntimeTypesPath = options.popupRuntimeTypesPath || path.join(rootDir, 'types', 'popup-runtime.d.ts');

  const popupJs = fs.readFileSync(popupJsPath, 'utf8');
  const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
  const popupRuntimeTypes = fs.readFileSync(popupRuntimeTypesPath, 'utf8');

  const renderOutputBlock = extractFunctionBlock(popupJs, 'renderOutput');
  const renderGuidanceBlock = extractFunctionBlock(popupJs, 'renderGuidance');
  const buildOutputBlock = extractFunctionBlock(popupJs, 'buildOutput');
  const typedSummaryFields = new Set(collectMatches(extractInterfaceBlock(popupRuntimeTypes, 'PopupRedactionSummary'), /\b([a-zA-Z0-9_]+)\??:\s/g));
  const consumedSummaryFields = new Set(collectMatches(renderOutputBlock, /\bsum\.([a-zA-Z0-9_]+)/g));
  const popupIds = new Set(collectMatches(popupHtml, /id="([^"]+)"/g));
  const cleanDomIds = new Set([
    ...collectMatches(renderOutputBlock, /getElementById\('([^']+)'\)/g),
    ...collectMatches(renderGuidanceBlock, /getElementById\('([^']+)'\)/g),
    ...collectMatches(buildOutputBlock, /getElementById\('([^']+)'\)/g),
  ]);

  consumedSummaryFields.forEach((field) => {
    ensure(typedSummaryFields.has(field), 'missing_typed_popup_summary_field:' + field);
  });

  cleanDomIds.forEach((id) => {
    ensure(popupIds.has(id), 'missing_popup_clean_dom_id:' + id);
  });

  return {
    popupCleanSummaryFieldCount: consumedSummaryFields.size,
    popupCleanDomIdCount: cleanDomIds.size,
    typedPopupSummaryFieldCount: typedSummaryFields.size,
  };
}

function verifyPopupRulesSurface(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const popupJsPath = options.popupJsPath || path.join(rootDir, 'popup.js');
  const popupHtmlPath = options.popupHtmlPath || path.join(rootDir, 'popup.html');
  const popupRuntimeTypesPath = options.popupRuntimeTypesPath || path.join(rootDir, 'types', 'popup-runtime.d.ts');

  const popupJs = fs.readFileSync(popupJsPath, 'utf8');
  const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
  const popupRuntimeTypes = fs.readFileSync(popupRuntimeTypesPath, 'utf8');

  const typedRuleFields = new Set(collectMatches(extractInterfaceBlock(popupRuntimeTypes, 'PopupRuleListItem'), /\b([a-zA-Z0-9_]+)\??:\s/g));
  const typedProtectionFields = new Set(collectMatches(extractInterfaceBlock(popupRuntimeTypes, 'PopupProtectionLevel'), /\b([a-zA-Z0-9_]+)\??:\s/g));
  const initPopupBlock = extractFunctionBlock(popupJs, 'initPopup');
  const rulesByCategoryMatch = initPopupBlock.match(/LOGCLEAN_RULES\.forEach\(function\(r\) \{[\s\S]*?\n  \}\);/);
  const ruleRowMatch = initPopupBlock.match(/rules\.forEach\(function\(rule\) \{[\s\S]*?\n      \}\);/);

  ensure(rulesByCategoryMatch, 'missing_rules_by_category_block');
  ensure(ruleRowMatch, 'missing_popup_rule_row_block');

  const rulesByCategoryBlock = rulesByCategoryMatch[0];
  const ruleRowBlock = ruleRowMatch[0];
  const consumedRuleFields = new Set([
    ...collectMatches(rulesByCategoryBlock, /\br\.([a-zA-Z0-9_]+)/g),
    ...collectMatches(ruleRowBlock, /\brule\.([a-zA-Z0-9_]+)/g),
  ]);
  const consumedProtectionFields = new Set(collectMatches(ruleRowBlock, /\br\.(emoji|label|color|bg|border)\b/g));
  const popupIds = new Set(collectMatches(popupHtml, /id="([^"]+)"/g));
  const popupClasses = new Set(collectMatches(popupHtml, /\.([a-zA-Z0-9_-]+)\s*\{/g));
  const requiredHooks = ['rules-list', '.settings-section', '.settings-title', '.rule-row'];

  consumedRuleFields.forEach((field) => {
    ensure(typedRuleFields.has(field), 'missing_typed_popup_rule_field:' + field);
  });

  consumedProtectionFields.forEach((field) => {
    ensure(typedProtectionFields.has(field), 'missing_typed_popup_protection_field:' + field);
  });

  requiredHooks.forEach((hook) => {
    if (hook.startsWith('.')) {
      ensure(popupClasses.has(hook.slice(1)), 'missing_popup_rules_hook:' + hook);
    } else {
      ensure(popupIds.has(hook), 'missing_popup_rules_hook:' + hook);
    }
  });

  return {
    popupRuleFieldCount: consumedRuleFields.size,
    popupProtectionFieldCount: consumedProtectionFields.size,
    popupRulesHookCount: requiredHooks.length,
    typedPopupRuleFieldCount: typedRuleFields.size,
    typedPopupProtectionFieldCount: typedProtectionFields.size,
  };
}

function verifyContentReviewSurface(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const contentJsPath = options.contentJsPath || path.join(rootDir, 'content.js');
  const contentRuntimeTypesPath = options.contentRuntimeTypesPath || path.join(rootDir, 'types', 'content-runtime.d.ts');
  const extensionRuntimeTypesPath = options.extensionRuntimeTypesPath || path.join(rootDir, 'types', 'extension-runtime.d.ts');

  const contentJs = fs.readFileSync(contentJsPath, 'utf8');
  const contentRuntimeTypes = fs.readFileSync(contentRuntimeTypesPath, 'utf8');
  const extensionRuntimeTypes = fs.readFileSync(extensionRuntimeTypesPath, 'utf8');

  const renderOutputBlock = extractFunctionBlock(contentJs, 'renderOutput');
  const renderInsightsBlock = extractFunctionBlock(contentJs, 'renderInsights');
  const buildFindingsBlock = extractFunctionBlock(contentJs, 'buildFindings');
  const loadAuditBlock = extractFunctionBlock(contentJs, 'loadAudit');
  const openInterceptModalBlock = extractFunctionBlock(contentJs, 'openInterceptModal');
  const typedSummaryFields = new Set(collectMatches(extractInterfaceBlock(contentRuntimeTypes, 'ContentRedactionSummary'), /\b([a-zA-Z0-9_]+)\??:\s/g));
  const typedFindingFields = new Set(collectMatches(extractInterfaceBlock(contentRuntimeTypes, 'RedactionFinding'), /\b([a-zA-Z0-9_]+)\??:\s/g));
  const typedAuditFields = new Set(collectMatches(extractInterfaceBlock(extensionRuntimeTypes, 'LocalAuditLogEntry'), /\b([a-zA-Z0-9_]+)\??:\s/g));
  const consumedSummaryFields = new Set([
    ...collectMatches(renderOutputBlock, /\bsum\.([a-zA-Z0-9_]+)/g),
    ...collectMatches(buildFindingsBlock, /\bsum\.([a-zA-Z0-9_]+)/g),
    ...collectMatches(openInterceptModalBlock, /\bsum\.([a-zA-Z0-9_]+)/g),
  ]);
  const consumedFindingFields = new Set(collectMatches(buildFindingsBlock, /\bf\.([a-zA-Z0-9_]+)/g));
  const consumedAuditFields = new Set(collectMatches(loadAuditBlock, /\bentry\.([a-zA-Z0-9_]+)/g));
  const createdIds = new Set([
    ...collectMatches(contentJs, /id="([^"]+)"/g),
    ...collectMatches(contentJs, /\.id = '([^']+)'/g),
  ]);
  const reviewDomIds = new Set([
    ...collectMatches(renderOutputBlock, /getElementById\('([^']+)'\)/g),
    ...collectMatches(renderInsightsBlock, /getElementById\('([^']+)'\)/g),
    ...collectMatches(buildFindingsBlock, /getElementById\('([^']+)'\)/g),
    ...collectMatches(loadAuditBlock, /getElementById\('([^']+)'\)/g),
    ...collectMatches(openInterceptModalBlock, /getElementById\('([^']+)'\)/g),
  ]);

  consumedSummaryFields.forEach((field) => {
    ensure(typedSummaryFields.has(field), 'missing_typed_content_summary_field:' + field);
  });

  consumedFindingFields.forEach((field) => {
    ensure(typedFindingFields.has(field), 'missing_typed_content_finding_field:' + field);
  });

  consumedAuditFields.forEach((field) => {
    ensure(typedAuditFields.has(field), 'missing_typed_content_audit_field:' + field);
  });

  reviewDomIds.forEach((id) => {
    ensure(createdIds.has(id), 'missing_content_review_dom_id:' + id);
  });

  return {
    contentReviewSummaryFieldCount: consumedSummaryFields.size,
    contentReviewFindingFieldCount: consumedFindingFields.size,
    contentReviewAuditFieldCount: consumedAuditFields.size,
    contentReviewDomIdCount: reviewDomIds.size,
    typedContentSummaryFieldCount: typedSummaryFields.size,
    typedContentFindingFieldCount: typedFindingFields.size,
    typedContentAuditFieldCount: typedAuditFields.size,
  };
}

function verifyRuntimeMessageSurface(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const popupJsPath = options.popupJsPath || path.join(rootDir, 'popup.js');
  const contentJsPath = options.contentJsPath || path.join(rootDir, 'content.js');
  const backgroundJsPath = options.backgroundJsPath || path.join(rootDir, 'background.js');

  const popupJs = fs.readFileSync(popupJsPath, 'utf8');
  const contentJs = fs.readFileSync(contentJsPath, 'utf8');
  const backgroundJs = fs.readFileSync(backgroundJsPath, 'utf8');

  const popupOutboundTypes = extractMessageTypesFromOutboundScript(popupJs);
  const contentOutboundTypes = extractMessageTypesFromOutboundScript(contentJs);
  const handledTypes = extractBackgroundHandledMessageTypes(backgroundJs);
  const handledTypeSet = new Set(handledTypes);

  popupOutboundTypes.forEach((type) => {
    ensure(handledTypeSet.has(type), 'unhandled_popup_message_type:' + type);
  });

  contentOutboundTypes.forEach((type) => {
    ensure(handledTypeSet.has(type), 'unhandled_content_message_type:' + type);
  });

  return {
    popupOutboundMessageCount: popupOutboundTypes.length,
    contentOutboundMessageCount: contentOutboundTypes.length,
    backgroundHandledMessageCount: handledTypes.length,
  };
}

function verifyPresentationAssets(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const manifestPath = options.manifestPath || path.join(rootDir, 'manifest.json');
  const popupHtmlPath = options.popupHtmlPath || path.join(rootDir, 'popup.html');
  const contentJsPath = options.contentJsPath || path.join(rootDir, 'content.js');
  const sidebarCssPath = options.sidebarCssPath || path.join(rootDir, 'sidebar.css');
  const manifest = readJsonFile(manifestPath);
  const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
  const contentJs = fs.readFileSync(contentJsPath, 'utf8');
  const sidebarCss = fs.readFileSync(sidebarCssPath, 'utf8');

  ensure(isPlainNonEmptyString(manifest.name) && manifest.name.includes('CleanPrompt'), 'missing_manifest_brand');
  ensure(isPlainNonEmptyString(manifest.author) && manifest.author.includes('CleanPrompt'), 'missing_manifest_author_brand');
  ensure(isPlainNonEmptyString(manifest.description) && /local/i.test(manifest.description), 'missing_manifest_local_privacy_copy');
  ensure(!/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(popupHtml), 'remote_popup_font_dependency');
  ensure(!/@import\s+url\(['"]https?:\/\//i.test(sidebarCss), 'remote_sidebar_font_dependency');
  ensure(popupHtml.includes('--cleanprompt-font-sans') && popupHtml.includes('--cleanprompt-font-mono'), 'missing_popup_local_font_tokens');
  ensure(sidebarCss.includes('--cleanprompt-font-sans') && sidebarCss.includes('--cleanprompt-font-mono'), 'missing_sidebar_local_font_tokens');
  ensure(/<title>\s*CleanPrompt\s*<\/title>/.test(popupHtml), 'missing_popup_title_brand');
  ensure(popupHtml.includes('logo-name">CleanPrompt'), 'missing_popup_logo_brand');
  ensure(/Raw Text Local|Raw prompt text stays on device/i.test(popupHtml), 'missing_popup_privacy_copy');
  ensure(contentJs.includes('id="lc-logo-text">CleanPrompt'), 'missing_content_logo_brand');
  ensure(contentJs.includes('CleanPrompt Active'), 'missing_content_toast_brand');
  ensure(/Raw prompts stay local/i.test(contentJs), 'missing_content_privacy_copy');

  const iconFiles = new Set([
    ...Object.values(manifest.icons || {}),
    ...Object.values((manifest.action && manifest.action.default_icon) || {}),
  ]);
  ensure(iconFiles.size > 0, 'missing_icon_assets');

  iconFiles.forEach((relativePath) => {
    const filePath = path.join(rootDir, relativePath);
    ensure(fs.existsSync(filePath), 'missing_presentation_icon:' + relativePath);
    const signature = fs.readFileSync(filePath).subarray(0, 8).toString('hex');
    ensure(signature === PNG_SIGNATURE, 'invalid_png_icon:' + relativePath);
  });

  return {
    iconFileCount: iconFiles.size,
    brandingSurfaceCount: 10,
  };
}

function verifyExtensionAssets(options = {}) {
  const manifestResult = verifyManifest(options);
  const rulesResult = verifyRuleBundle(options);
  const popupResult = verifyPopupStructure(options);
  const sidebarResult = verifySidebarStructure(options);
  const contentResult = verifyContentStructure(options);
  const hostCoverageResult = verifySupportedHostCoverage(options);
  const urlDependencyResult = verifyRuntimeUrlDependencies(options);
  const storageContractResult = verifyStorageContract(options);
  const responseSurfaceResult = verifyRuntimeResponseSurface(options);
  const redactionSurfaceResult = verifyRedactionResultSurface(options);
  const ruleMetadataSurfaceResult = verifyRuleMetadataSurface(options);
  const platformHealthSurfaceResult = verifyPlatformHealthSurface(options);
  const statusResultSurfaceResult = verifyStatusResultSurface(options);
  const managedViewModelSurfaceResult = verifyManagedViewModelSurface(options);
  const platformCoverageViewModelSurfaceResult = verifyPlatformCoverageViewModelSurface(options);
  const popupCleanSurfaceResult = verifyPopupCleanSurface(options);
  const popupRulesSurfaceResult = verifyPopupRulesSurface(options);
  const contentReviewSurfaceResult = verifyContentReviewSurface(options);
  const messageSurfaceResult = verifyRuntimeMessageSurface(options);
  const presentationResult = verifyPresentationAssets(options);

  return {
    manifest: manifestResult.manifest,
    ruleBundle: rulesResult.ruleBundle,
    contentScriptMatchCount: manifestResult.contentScriptMatchCount,
    accessibleFileCount: manifestResult.accessibleFileCount,
    ruleCount: rulesResult.ruleCount,
    popupHookCount: popupResult.popupHookCount,
    popupTabCount: popupResult.popupTabCount,
    sidebarSelectorCount: sidebarResult.sidebarSelectorCount,
    contentReferencedIdCount: contentResult.contentReferencedIdCount,
    contentCreatedIdCount: contentResult.contentCreatedIdCount,
    supportedHostSurfaceCount: hostCoverageResult.supportedHostSurfaceCount,
    platformMatcherCount: hostCoverageResult.platformMatcherCount,
    popupUrlCount: urlDependencyResult.popupUrlCount,
    backgroundUrlCount: urlDependencyResult.backgroundUrlCount,
    manifestRemoteHostCount: urlDependencyResult.manifestRemoteHostCount,
    backgroundManagedStorageKeyCount: storageContractResult.backgroundManagedStorageKeyCount,
    backgroundReadStorageKeyCount: storageContractResult.backgroundReadStorageKeyCount,
    popupStorageKeyCount: storageContractResult.popupStorageKeyCount,
    contentStorageKeyCount: storageContractResult.contentStorageKeyCount,
    getSettingsProviderFieldCount: responseSurfaceResult.getSettingsProviderFieldCount,
    popupGetSettingsFieldCount: responseSurfaceResult.popupGetSettingsFieldCount,
    contentGetSettingsFieldCount: responseSurfaceResult.contentGetSettingsFieldCount,
    auditLogEntryFieldCount: responseSurfaceResult.auditLogEntryFieldCount,
    contentAuditEntryFieldCount: responseSurfaceResult.contentAuditEntryFieldCount,
    redactionResultProviderFieldCount: redactionSurfaceResult.redactionResultProviderFieldCount,
    redactionResultConsumerFieldCount: redactionSurfaceResult.redactionResultConsumerFieldCount,
    redactionEventSummaryFieldCount: redactionSurfaceResult.redactionEventSummaryFieldCount,
    redactionEventSummaryConsumerFieldCount: redactionSurfaceResult.redactionEventSummaryConsumerFieldCount,
    redactionCountSummaryFieldCount: redactionSurfaceResult.redactionCountSummaryFieldCount,
    redactionCountSummaryConsumerFieldCount: redactionSurfaceResult.redactionCountSummaryConsumerFieldCount,
    bundledRuleSurfaceCount: ruleMetadataSurfaceResult.bundledRuleSurfaceCount,
    bundledRuleCategoryCount: ruleMetadataSurfaceResult.bundledRuleCategoryCount,
    bundledRuleRiskCount: ruleMetadataSurfaceResult.bundledRuleRiskCount,
    protectionRiskCount: ruleMetadataSurfaceResult.protectionRiskCount,
    popupCategoryPaletteCount: ruleMetadataSurfaceResult.popupCategoryPaletteCount,
    contentCategoryPaletteCount: ruleMetadataSurfaceResult.contentCategoryPaletteCount,
    normalizedPlatformHealthFieldCount: platformHealthSurfaceResult.normalizedPlatformHealthFieldCount,
    contentPlatformHealthFieldCount: platformHealthSurfaceResult.contentPlatformHealthFieldCount,
    popupPlatformHealthFieldCount: platformHealthSurfaceResult.popupPlatformHealthFieldCount,
    typedPlatformHealthFieldCount: platformHealthSurfaceResult.typedPlatformHealthFieldCount,
    emittedStatusResultFieldCount: statusResultSurfaceResult.emittedStatusResultFieldCount,
    popupStatusResultFieldCount: statusResultSurfaceResult.popupStatusResultFieldCount,
    typedStatusResultFieldCount: statusResultSurfaceResult.typedStatusResultFieldCount,
    managedViewModelFieldCount: managedViewModelSurfaceResult.managedViewModelFieldCount,
    managedViewRenderFieldCount: managedViewModelSurfaceResult.managedViewRenderFieldCount,
    managedViewDomIdCount: managedViewModelSurfaceResult.managedViewDomIdCount,
    typedManagedViewFieldCount: managedViewModelSurfaceResult.typedManagedViewFieldCount,
    platformCoverageViewModelFieldCount: platformCoverageViewModelSurfaceResult.platformCoverageViewModelFieldCount,
    platformCoverageRenderFieldCount: platformCoverageViewModelSurfaceResult.platformCoverageRenderFieldCount,
    platformCoverageDomIdCount: platformCoverageViewModelSurfaceResult.platformCoverageDomIdCount,
    typedPlatformCoverageFieldCount: platformCoverageViewModelSurfaceResult.typedPlatformCoverageFieldCount,
    popupCleanSummaryFieldCount: popupCleanSurfaceResult.popupCleanSummaryFieldCount,
    popupCleanDomIdCount: popupCleanSurfaceResult.popupCleanDomIdCount,
    typedPopupSummaryFieldCount: popupCleanSurfaceResult.typedPopupSummaryFieldCount,
    popupRuleFieldCount: popupRulesSurfaceResult.popupRuleFieldCount,
    popupProtectionFieldCount: popupRulesSurfaceResult.popupProtectionFieldCount,
    popupRulesHookCount: popupRulesSurfaceResult.popupRulesHookCount,
    typedPopupRuleFieldCount: popupRulesSurfaceResult.typedPopupRuleFieldCount,
    typedPopupProtectionFieldCount: popupRulesSurfaceResult.typedPopupProtectionFieldCount,
    contentReviewSummaryFieldCount: contentReviewSurfaceResult.contentReviewSummaryFieldCount,
    contentReviewFindingFieldCount: contentReviewSurfaceResult.contentReviewFindingFieldCount,
    contentReviewAuditFieldCount: contentReviewSurfaceResult.contentReviewAuditFieldCount,
    contentReviewDomIdCount: contentReviewSurfaceResult.contentReviewDomIdCount,
    typedContentSummaryFieldCount: contentReviewSurfaceResult.typedContentSummaryFieldCount,
    typedContentFindingFieldCount: contentReviewSurfaceResult.typedContentFindingFieldCount,
    typedContentAuditFieldCount: contentReviewSurfaceResult.typedContentAuditFieldCount,
    popupOutboundMessageCount: messageSurfaceResult.popupOutboundMessageCount,
    contentOutboundMessageCount: messageSurfaceResult.contentOutboundMessageCount,
    backgroundHandledMessageCount: messageSurfaceResult.backgroundHandledMessageCount,
    iconFileCount: presentationResult.iconFileCount,
    brandingSurfaceCount: presentationResult.brandingSurfaceCount,
  };
}

if (require.main === module) {
  const result = verifyExtensionAssets();
  process.stdout.write(
    [
      'Verified CleanPrompt extension assets',
      'manifest_version=' + result.manifest.version,
      'rule_bundle_version=' + result.ruleBundle.version,
      'supported_host_count=' + result.contentScriptMatchCount,
      'web_accessible_file_count=' + result.accessibleFileCount,
      'rule_count=' + result.ruleCount,
      'popup_hook_count=' + result.popupHookCount,
      'popup_tab_count=' + result.popupTabCount,
      'sidebar_selector_count=' + result.sidebarSelectorCount,
      'content_referenced_id_count=' + result.contentReferencedIdCount,
      'content_created_id_count=' + result.contentCreatedIdCount,
      'supported_host_surface_count=' + result.supportedHostSurfaceCount,
      'platform_matcher_count=' + result.platformMatcherCount,
      'popup_url_count=' + result.popupUrlCount,
      'background_url_count=' + result.backgroundUrlCount,
      'manifest_remote_host_count=' + result.manifestRemoteHostCount,
      'background_managed_storage_key_count=' + result.backgroundManagedStorageKeyCount,
      'background_read_storage_key_count=' + result.backgroundReadStorageKeyCount,
      'popup_storage_key_count=' + result.popupStorageKeyCount,
      'content_storage_key_count=' + result.contentStorageKeyCount,
      'get_settings_provider_field_count=' + result.getSettingsProviderFieldCount,
      'popup_get_settings_field_count=' + result.popupGetSettingsFieldCount,
      'content_get_settings_field_count=' + result.contentGetSettingsFieldCount,
      'audit_log_entry_field_count=' + result.auditLogEntryFieldCount,
      'content_audit_entry_field_count=' + result.contentAuditEntryFieldCount,
      'redaction_result_provider_field_count=' + result.redactionResultProviderFieldCount,
      'redaction_result_consumer_field_count=' + result.redactionResultConsumerFieldCount,
      'redaction_event_summary_field_count=' + result.redactionEventSummaryFieldCount,
      'redaction_event_summary_consumer_field_count=' + result.redactionEventSummaryConsumerFieldCount,
      'redaction_count_summary_field_count=' + result.redactionCountSummaryFieldCount,
      'redaction_count_summary_consumer_field_count=' + result.redactionCountSummaryConsumerFieldCount,
      'bundled_rule_surface_count=' + result.bundledRuleSurfaceCount,
      'bundled_rule_category_count=' + result.bundledRuleCategoryCount,
      'bundled_rule_risk_count=' + result.bundledRuleRiskCount,
      'protection_risk_count=' + result.protectionRiskCount,
      'popup_category_palette_count=' + result.popupCategoryPaletteCount,
      'content_category_palette_count=' + result.contentCategoryPaletteCount,
      'normalized_platform_health_field_count=' + result.normalizedPlatformHealthFieldCount,
      'content_platform_health_field_count=' + result.contentPlatformHealthFieldCount,
      'popup_platform_health_field_count=' + result.popupPlatformHealthFieldCount,
      'typed_platform_health_field_count=' + result.typedPlatformHealthFieldCount,
      'emitted_status_result_field_count=' + result.emittedStatusResultFieldCount,
      'popup_status_result_field_count=' + result.popupStatusResultFieldCount,
      'typed_status_result_field_count=' + result.typedStatusResultFieldCount,
      'managed_view_model_field_count=' + result.managedViewModelFieldCount,
      'managed_view_render_field_count=' + result.managedViewRenderFieldCount,
      'managed_view_dom_id_count=' + result.managedViewDomIdCount,
      'typed_managed_view_field_count=' + result.typedManagedViewFieldCount,
      'platform_coverage_view_model_field_count=' + result.platformCoverageViewModelFieldCount,
      'platform_coverage_render_field_count=' + result.platformCoverageRenderFieldCount,
      'platform_coverage_dom_id_count=' + result.platformCoverageDomIdCount,
      'typed_platform_coverage_field_count=' + result.typedPlatformCoverageFieldCount,
      'popup_clean_summary_field_count=' + result.popupCleanSummaryFieldCount,
      'popup_clean_dom_id_count=' + result.popupCleanDomIdCount,
      'typed_popup_summary_field_count=' + result.typedPopupSummaryFieldCount,
      'popup_rule_field_count=' + result.popupRuleFieldCount,
      'popup_protection_field_count=' + result.popupProtectionFieldCount,
      'popup_rules_hook_count=' + result.popupRulesHookCount,
      'typed_popup_rule_field_count=' + result.typedPopupRuleFieldCount,
      'typed_popup_protection_field_count=' + result.typedPopupProtectionFieldCount,
      'content_review_summary_field_count=' + result.contentReviewSummaryFieldCount,
      'content_review_finding_field_count=' + result.contentReviewFindingFieldCount,
      'content_review_audit_field_count=' + result.contentReviewAuditFieldCount,
      'content_review_dom_id_count=' + result.contentReviewDomIdCount,
      'typed_content_summary_field_count=' + result.typedContentSummaryFieldCount,
      'typed_content_finding_field_count=' + result.typedContentFindingFieldCount,
      'typed_content_audit_field_count=' + result.typedContentAuditFieldCount,
      'popup_outbound_message_count=' + result.popupOutboundMessageCount,
      'content_outbound_message_count=' + result.contentOutboundMessageCount,
      'background_handled_message_count=' + result.backgroundHandledMessageCount,
      'icon_file_count=' + result.iconFileCount,
      'branding_surface_count=' + result.brandingSurfaceCount,
      '',
    ].join('\n')
  );
}

module.exports = {
  verifyContentStructure,
  verifyManifest,
  verifyPopupStructure,
  verifyPlatformHealthSurface,
  verifyPresentationAssets,
  verifyRuleMetadataSurface,
  verifyRedactionResultSurface,
  verifyRuleBundle,
  verifyStatusResultSurface,
  verifyManagedViewModelSurface,
  verifyPlatformCoverageViewModelSurface,
  verifyPopupCleanSurface,
  verifyContentReviewSurface,
  verifyPopupRulesSurface,
  verifyRuntimeResponseSurface,
  verifyStorageContract,
  verifyRuntimeMessageSurface,
  verifyRuntimeUrlDependencies,
  verifySidebarStructure,
  verifySupportedHostCoverage,
  verifyExtensionAssets,
};
