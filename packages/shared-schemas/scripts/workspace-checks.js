const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const MODE = process.argv[2] || 'build';

const CONTRACTS = [
  {
    schemaFile: 'schemas/policy-bundle.schema.json',
    sourceFile: 'src/policy-bundle.ts',
    validator: 'validatePolicyBundle',
  },
  {
    schemaFile: 'schemas/audit-event.schema.json',
    sourceFile: 'src/audit-event.ts',
    validator: 'validateAuditEvent',
  },
  {
    schemaFile: 'schemas/device-enrollment.schema.json',
    sourceFile: 'src/device-enrollment.ts',
    validator: 'validateDeviceEnrollmentRequest',
  },
  {
    schemaFile: 'schemas/rule-manifest.schema.json',
    sourceFile: 'src/rule-manifest.ts',
    validator: 'validateRuleManifest',
  },
  {
    schemaFile: 'schemas/rollout-state.schema.json',
    sourceFile: 'src/rollout-state.ts',
    validator: 'validateRolloutState',
  },
];

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

function parseJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function runBuildChecks() {
  if (!fs.existsSync(path.join(ROOT, 'tsconfig.json'))) {
    fail('missing_tsconfig_json');
  }
  if (!fs.existsSync(path.join(ROOT, 'src/runtime.js'))) {
    fail('missing_runtime_js');
  }
  syntaxCheck(['src/runtime.js', 'test/runtime.test.js']);
  CONTRACTS.forEach((contract) => {
    parseJson(contract.schemaFile);
    if (!fs.existsSync(path.join(ROOT, contract.sourceFile))) {
      fail('missing_source_file:' + contract.sourceFile);
    }
  });
}

function runLintChecks() {
  const runtime = require(path.join(ROOT, 'src/runtime.js'));

  CONTRACTS.forEach((contract) => {
    const schema = parseJson(contract.schemaFile);
    if (typeof schema.$id !== 'string' || !schema.$id.trim()) {
      fail('missing_schema_id:' + contract.schemaFile);
    }
    if (schema.additionalProperties !== false) {
      fail('schema_allows_additional_properties:' + contract.schemaFile);
    }
    if (!Array.isArray(schema.required) || schema.required.length === 0) {
      fail('missing_required_keys:' + contract.schemaFile);
    }
    if (typeof runtime[contract.validator] !== 'function') {
      fail('missing_runtime_validator:' + contract.validator);
    }
  });

  const readme = read('README.md');
  if (readme.indexOf('package-local tests') === -1) {
    fail('missing_package_test_note_in_readme');
  }
}

function runTypeChecks() {
  const runtime = require(path.join(ROOT, 'src/runtime.js'));

  const ruleManifest = {
    schema_version: '1.0.0',
    manifest_version: '2026.03.22-demo',
    published_at: '2026-03-22T10:00:00.000Z',
    compatible_extension_versions: ['1.2.0'],
    rules: [
      {
        id: 'GENERIC_SECRET',
        label: 'Generic Secret',
        category: 'Credential',
        risk: 'high',
        color: '#f97316',
        pattern: '(?:sk|pk)-[a-z0-9]+',
      },
    ],
    signature: 'demo-signature',
  };

  const rolloutState = {
    schema_version: '1.0.0',
    artifact_type: 'rule_manifest',
    artifact_version: '2026.03.22-demo',
    rollout_stage: 'canary',
    rollout_percentage: 10,
    emergency_blocked: false,
  };

  if (runtime.validateRuleManifest(ruleManifest) !== null) {
    fail('rule_manifest_runtime_validation_failed');
  }
  if (runtime.validateRolloutState(rolloutState) !== null) {
    fail('rollout_state_runtime_validation_failed');
  }
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
