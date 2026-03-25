const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const MODE = process.argv[2] || 'build';

function fail(message) {
  throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function syntaxCheck(relativePaths) {
  relativePaths.forEach((relativePath) => {
    new vm.Script(read(relativePath), {
      filename: path.join(ROOT, relativePath),
    });
  });
}

function runBuildChecks() {
  const requiredFiles = [
    'tsconfig.json',
    'src/server.js',
    'src/config.js',
    'src/persistence.js',
    'src/state.js',
    'src/validators.js',
    'src/types.d.ts',
    'src/validators.d.ts',
    'src/demo-state-cli.js',
    'src/admin/app.js',
    'src/admin/index.html',
    'src/admin/styles.css',
    'test/helpers/http-harness.js',
    'test/server.test.js',
  ];

  requiredFiles.forEach((relativePath) => {
    if (!fs.existsSync(path.join(ROOT, relativePath))) {
      fail('missing_required_file:' + relativePath);
    }
  });

  syntaxCheck([
    'src/server.js',
    'src/config.js',
    'src/persistence.js',
    'src/state.js',
    'src/validators.js',
    'src/demo-state-cli.js',
    'src/admin/app.js',
    'test/helpers/http-harness.js',
    'test/server.test.js',
  ]);
}

function extractDocumentedEndpoints(readme) {
  return readme
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^- `(GET|POST) /.test(line))
    .map((line) => line.replace(/^- `/, '').replace(/`$/, ''));
}

function extractImplementedEndpoints(serverSource) {
  const matches = [];
  if (serverSource.indexOf("req.method === 'GET' && (url.pathname === '/' || url.pathname === '/admin')") !== -1) {
    matches.push('GET /admin');
  }
  const regex = /req\.method === '([A-Z]+)' && url\.pathname === '([^']+)'/g;
  let match = null;
  while ((match = regex.exec(serverSource))) {
    if (
      match[2] === '/health' ||
      match[2] === '/admin' ||
      match[2].indexOf('/api/') === 0
    ) {
      matches.push(match[1] + ' ' + match[2]);
    }
  }
  return matches.sort();
}

function runLintChecks() {
  const documented = extractDocumentedEndpoints(read('README.md')).sort();
  const implemented = extractImplementedEndpoints(read('src/server.js'));

  if (JSON.stringify(documented) !== JSON.stringify(implemented)) {
    fail('readme_endpoint_drift');
  }

  const readme = read('README.md');
  if (readme.indexOf('shared-schema-backed request validation') === -1) {
    fail('missing_validation_note_in_readme');
  }
}

function runTypeChecks() {
  const serverModule = require(path.join(ROOT, 'src/server.js'));
  const configModule = require(path.join(ROOT, 'src/config.js'));
  const stateModule = require(path.join(ROOT, 'src/state.js'));
  const validators = require(path.join(ROOT, 'src/validators.js'));

  if (typeof serverModule.createServer !== 'function') fail('missing_createServer');
  if (typeof serverModule.createApp !== 'function') fail('missing_createApp');
  if (typeof configModule.loadConfig !== 'function') fail('missing_loadConfig');
  if (typeof stateModule.createDefaultState !== 'function') fail('missing_createDefaultState');
  if (typeof stateModule.buildAdminSummary !== 'function') fail('missing_buildAdminSummary');
  if (typeof validators.validatePolicyBundle !== 'function') fail('missing_validatePolicyBundle');
  if (typeof validators.validateAuditEvent !== 'function') fail('missing_validateAuditEvent');
  if (typeof validators.validateDeviceEnrollmentRequest !== 'function') fail('missing_validateDeviceEnrollmentRequest');

  const config = configModule.loadConfig({
    CLEANPROMPT_CONTROL_PLANE_DATA_DIR: path.join(ROOT, 'tmp-check'),
    CLEANPROMPT_CONTROL_PLANE_DATA_FILE: path.join(ROOT, 'tmp-check', 'state.json'),
    CLEANPROMPT_CONTROL_PLANE_PORT: '8787',
  });
  const state = stateModule.createDefaultState(config);
  const summary = stateModule.buildAdminSummary(state);

  ['device_count', 'audit_event_count', 'metadata_only', 'raw_prompt_retention'].forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(summary, key)) {
      fail('missing_summary_key:' + key);
    }
  });
}

if (MODE === 'build') {
  runBuildChecks();
} else if (MODE === 'lint') {
  runLintChecks();
} else if (MODE === 'typecheck') {
  runTypeChecks();
} else {
  fail('unknown_mode:' + MODE);
}
