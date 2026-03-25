const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createEvaluationKit, listPackagedSourceFiles } = require('../scripts/package-evaluation-kit');
const { verifyEvaluationKit } = require('../scripts/verify-evaluation-kit');

function copySourceSnapshot(sourceRoot, snapshotRoot) {
  listPackagedSourceFiles(sourceRoot).forEach((mapping) => {
    const sourcePath = path.join(sourceRoot, mapping.sourceRelativePath);
    const targetPath = path.join(snapshotRoot, mapping.sourceRelativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  });
}

test('package evaluation kit builds a runnable pilot handoff layout', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanprompt-package-kit-'));
  const result = createEvaluationKit({
    rootDir: path.resolve(__dirname, '..'),
    outputDir,
    version: '0.1.0-test',
    generatedAt: '2026-03-22T12:00:00.000Z',
  });

  const manifestPath = path.join(result.kitRoot, 'PACKAGE_MANIFEST.json');
  const startHerePath = path.join(result.kitRoot, 'START_HERE.md');
  const checksumsPath = path.join(result.kitRoot, 'CHECKSUMS.txt');
  const extensionManifestPath = path.join(result.kitRoot, 'extension-unpacked', 'manifest.json');
  const controlPlaneServerPath = path.join(result.kitRoot, 'control-plane', 'src', 'server.js');
  const cmdSeedPath = path.join(result.kitRoot, 'bin', 'seed-demo.cmd');

  assert.equal(fs.existsSync(manifestPath), true);
  assert.equal(fs.existsSync(startHerePath), true);
  assert.equal(fs.existsSync(checksumsPath), true);
  assert.equal(fs.existsSync(extensionManifestPath), true);
  assert.equal(fs.existsSync(controlPlaneServerPath), true);
  assert.equal(fs.existsSync(cmdSeedPath), true);

  const packageManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(packageManifest.manifest_version, 1);
  assert.equal(packageManifest.package_name, 'cleanprompt-evaluation-kit');
  assert.equal(packageManifest.version, '0.1.0-test');
  assert.equal(packageManifest.checksum_algorithm, 'sha256');
  assert.equal(packageManifest.checksum_file, 'CHECKSUMS.txt');
  assert.equal(packageManifest.control_plane_entry, 'control-plane/src/server.js');
  assert.ok(packageManifest.artifact_file_count > 0);

  const startHere = fs.readFileSync(startHerePath, 'utf8');
  assert.match(startHere, /Prepare managed demo/);
  assert.match(startHere, /pilot-ready for controlled evaluation/i);

  const checksums = fs.readFileSync(checksumsPath, 'utf8');
  assert.match(checksums, /extension-unpacked\/manifest\.json/);
  assert.match(checksums, /control-plane\/src\/server\.js/);

  const verification = verifyEvaluationKit({
    kitRoot: result.kitRoot,
  });
  assert.equal(verification.kitRoot, result.kitRoot);
  assert.equal(verification.manifest.version, '0.1.0-test');
  assert.equal(verification.artifactFileCount, packageManifest.artifact_file_count);
  assert.ok(verification.sourceSyncedFileCount > 0);
});

test('evaluation kit verification rejects drift from the source tree used to build it', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanprompt-package-drift-'));
  const sourceSnapshot = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanprompt-source-snapshot-'));
  const result = createEvaluationKit({
    rootDir: repoRoot,
    outputDir,
    version: '0.1.0-drift',
    generatedAt: '2026-03-24T12:00:00.000Z',
  });

  copySourceSnapshot(repoRoot, sourceSnapshot);
  fs.appendFileSync(path.join(sourceSnapshot, 'manifest.json'), '\n');

  assert.throws(
    () => verifyEvaluationKit({
      kitRoot: result.kitRoot,
      sourceRoot: sourceSnapshot,
    }),
    /source_artifact_drift:extension-unpacked\/manifest\.json/
  );
});
