const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { listPackagedSourceFiles } = require('./package-evaluation-kit');

const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGE_MANIFEST_FILE = 'PACKAGE_MANIFEST.json';
const CHECKSUM_FILE = 'CHECKSUMS.txt';

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function walkFiles(directoryPath, basePath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  let fileList = [];

  entries.forEach((entry) => {
    const absolutePath = path.join(directoryPath, entry.name);
    const relativePath = path.relative(basePath, absolutePath);
    if (entry.isDirectory()) {
      fileList = fileList.concat(walkFiles(absolutePath, basePath));
      return;
    }
    fileList.push(relativePath);
  });

  return fileList.sort();
}

function findLatestEvaluationKit(distDir) {
  const entries = fs.readdirSync(distDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^cleanprompt-evaluation-kit-v/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  ensure(entries.length > 0, 'evaluation_kit_not_found');
  return path.join(distDir, entries[entries.length - 1]);
}

function parseChecksums(checksumText) {
  return checksumText
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([a-f0-9]{64})  (.+)$/);
      ensure(Boolean(match), 'invalid_checksum_line');
      return {
        hash: match[1],
        relativePath: match[2],
      };
    });
}

function verifyEvaluationKit(options = {}) {
  const distDir = options.distDir || path.join(ROOT_DIR, 'dist');
  const kitRoot = options.kitRoot || findLatestEvaluationKit(distDir);
  const sourceRoot = options.sourceRoot || ROOT_DIR;
  const manifestPath = path.join(kitRoot, PACKAGE_MANIFEST_FILE);
  const checksumPath = path.join(kitRoot, CHECKSUM_FILE);

  ensure(fs.existsSync(manifestPath), 'missing_package_manifest');
  ensure(fs.existsSync(checksumPath), 'missing_checksums');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  ensure(manifest.package_name === 'cleanprompt-evaluation-kit', 'invalid_package_name');
  ensure(manifest.manifest_version === 1, 'invalid_manifest_version');
  ensure(manifest.checksum_algorithm === 'sha256', 'invalid_checksum_algorithm');
  ensure(manifest.checksum_file === CHECKSUM_FILE, 'invalid_checksum_file');
  ensure(Array.isArray(manifest.included_sections), 'invalid_included_sections');

  manifest.included_sections.forEach((relativePath) => {
    ensure(fs.existsSync(path.join(kitRoot, relativePath)), 'missing_section:' + relativePath);
  });

  const checksumEntries = parseChecksums(fs.readFileSync(checksumPath, 'utf8'));
  const expectedFiles = walkFiles(kitRoot, kitRoot).filter((relativePath) => relativePath !== CHECKSUM_FILE);
  const checksummedFiles = checksumEntries.map((entry) => entry.relativePath).sort();

  ensure(JSON.stringify(checksummedFiles) === JSON.stringify(expectedFiles), 'checksum_file_list_drift');
  ensure(manifest.artifact_file_count === expectedFiles.length, 'artifact_file_count_drift');

  checksumEntries.forEach((entry) => {
    const absolutePath = path.join(kitRoot, entry.relativePath);
    ensure(fs.existsSync(absolutePath), 'missing_artifact:' + entry.relativePath);
    ensure(sha256File(absolutePath) === entry.hash, 'checksum_mismatch:' + entry.relativePath);
  });

  const sourceMappings = listPackagedSourceFiles(sourceRoot);
  sourceMappings.forEach((mapping) => {
    const sourcePath = path.join(sourceRoot, mapping.sourceRelativePath);
    const packagedPath = path.join(kitRoot, mapping.packagedRelativePath);
    ensure(fs.existsSync(sourcePath), 'missing_source_artifact:' + mapping.sourceRelativePath);
    ensure(fs.existsSync(packagedPath), 'missing_packaged_source_artifact:' + mapping.packagedRelativePath);
    ensure(
      sha256File(sourcePath) === sha256File(packagedPath),
      'source_artifact_drift:' + mapping.packagedRelativePath
    );
  });

  return {
    kitRoot,
    manifest,
    artifactFileCount: expectedFiles.length,
    sourceSyncedFileCount: sourceMappings.length,
  };
}

if (require.main === module) {
  const result = verifyEvaluationKit();
  process.stdout.write(
    [
      'Verified CleanPrompt evaluation kit',
      'kit_root=' + result.kitRoot,
      'artifact_file_count=' + result.artifactFileCount,
      'source_synced_file_count=' + result.sourceSyncedFileCount,
      '',
    ].join('\n')
  );
}

module.exports = {
  findLatestEvaluationKit,
  parseChecksums,
  verifyEvaluationKit,
};
