const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGE_MANIFEST_FILE = 'PACKAGE_MANIFEST.json';
const CHECKSUM_FILE = 'CHECKSUMS.txt';

const EXTENSION_FILES = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'sidebar.css',
];

const EXTENSION_DIRS = [
  'engine',
  'icons',
];

const CONTROL_PLANE_FILES = [
  'control-plane/package.json',
  'control-plane/README.md',
];

const CONTROL_PLANE_DIRS = [
  'control-plane/src',
];

const DOC_FILES = [
  'README.md',
  'SECURITY.md',
  'SUPPLY_CHAIN.md',
  'COMPLIANCE.md',
  'ROADMAP.md',
  'STATUS.md',
];

const DOC_DIRS = [
  'docs/commercial',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function copyFile(rootDir, fromRelativePath, toRelativePath) {
  const sourcePath = path.join(rootDir, fromRelativePath);
  const targetPath = path.join(rootDir, toRelativePath);
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function copyTree(rootDir, fromRelativePath, toRelativePath) {
  const sourcePath = path.join(rootDir, fromRelativePath);
  const targetPath = path.join(rootDir, toRelativePath);
  ensureDir(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function renderStartHere(version) {
  return [
    '# CleanPrompt Evaluation Kit',
    '',
    'This package is a controlled pilot/demo handoff for the current CleanPrompt prototype.',
    'It is designed to help an evaluator run the local control plane, load the browser extension, and repeat the managed demo flow without digging through the full repo.',
    '',
    '## What Is In This Kit',
    '',
    '- `extension-unpacked/`: load this folder as an unpacked Chrome or Edge extension',
    '- `control-plane/`: local metadata-only owner console and APIs',
    '- `docs/`: commercial, trust, and reference docs copied from the repo',
    '- `bin/`: optional helper scripts for local startup and demo reset',
    '- `PACKAGE_MANIFEST.json`: package metadata and included artifacts',
    '- `CHECKSUMS.txt`: SHA-256 checksums for the packaged files',
    '',
    '## Quick Start',
    '',
    '1. Start the control plane with `node control-plane/src/server.js`.',
    '2. Seed demo data with `node control-plane/src/demo-state-cli.js seed`.',
    '3. In Chrome or Edge, load `extension-unpacked/` as an unpacked extension.',
    '4. Open the extension popup and go to the `Managed` tab.',
    '5. Click `Prepare managed demo`.',
    '6. Open `http://127.0.0.1:8787/admin` to view the owner console.',
    '',
    '## Repeatable Demo Loop',
    '',
    '- Use `Reset extension demo` in the popup between runs when you want a clean browser-side baseline.',
    '- Use `node control-plane/src/demo-state-cli.js reset` to clear the owner console state.',
    '- Use `node control-plane/src/demo-state-cli.js seed` when you want the owner dashboard back at the known demo baseline.',
    '',
    '## Honest Scope',
    '',
    '- Version: `' + version + '`',
    '- This is pilot-ready for controlled evaluation, not a production SaaS release.',
    '- Raw prompt text stays on the endpoint in the default managed flow shown by this kit.',
    '',
  ].join('\n');
}

function renderControlPlaneDataReadme() {
  return [
    '# Control Plane Data',
    '',
    'This folder is intentionally packaged without a seeded runtime state file.',
    'When you run the control plane and use the demo seed/reset commands, `dev-state.json` will be created here locally.',
    '',
  ].join('\n');
}

function renderShellScript(command) {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'KIT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"',
    'cd "${KIT_DIR}"',
    command,
    '',
  ].join('\n');
}

function renderCmdScript(command) {
  return [
    '@echo off',
    'setlocal',
    'set SCRIPT_DIR=%~dp0',
    'set KIT_DIR=%SCRIPT_DIR%..',
    'cd /d "%KIT_DIR%"',
    command,
    '',
  ].join('\r\n');
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

function listFilesForRelativeDir(rootDir, relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir);
  return walkFiles(absoluteDir, absoluteDir).map((relativePath) => path.posix.join(relativeDir, relativePath));
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function writeChecksums(kitRoot) {
  const fileList = walkFiles(kitRoot, kitRoot).filter((relativePath) => relativePath !== CHECKSUM_FILE);
  const lines = fileList.map((relativePath) => {
    const absolutePath = path.join(kitRoot, relativePath);
    return sha256File(absolutePath) + '  ' + relativePath;
  });
  fs.writeFileSync(path.join(kitRoot, CHECKSUM_FILE), lines.join('\n') + '\n', 'utf8');
  return fileList;
}

function createPackageManifest(options) {
  return {
    manifest_version: 1,
    package_name: 'cleanprompt-evaluation-kit',
    version: options.version,
    generated_at: options.generatedAt,
    artifact_root: '.',
    start_here: 'START_HERE.md',
    checksum_algorithm: 'sha256',
    checksum_file: CHECKSUM_FILE,
    extension_entry: 'extension-unpacked',
    control_plane_entry: 'control-plane/src/server.js',
    docs_dir: 'docs',
    artifact_file_count: options.artifactFileCount,
    included_sections: [
      'extension-unpacked',
      'control-plane',
      'docs',
      'bin',
      PACKAGE_MANIFEST_FILE,
      CHECKSUM_FILE,
    ],
  };
}

function listPackagedSourceFiles(rootDir) {
  let fileMappings = [];

  EXTENSION_FILES.forEach((relativePath) => {
    fileMappings.push({
      sourceRelativePath: relativePath,
      packagedRelativePath: path.posix.join('extension-unpacked', relativePath),
    });
  });

  EXTENSION_DIRS.forEach((relativeDir) => {
    listFilesForRelativeDir(rootDir, relativeDir).forEach((sourceRelativePath) => {
      fileMappings.push({
        sourceRelativePath,
        packagedRelativePath: path.posix.join('extension-unpacked', sourceRelativePath),
      });
    });
  });

  CONTROL_PLANE_FILES.forEach((relativePath) => {
    fileMappings.push({
      sourceRelativePath: relativePath,
      packagedRelativePath: relativePath,
    });
  });

  CONTROL_PLANE_DIRS.forEach((relativeDir) => {
    listFilesForRelativeDir(rootDir, relativeDir).forEach((sourceRelativePath) => {
      fileMappings.push({
        sourceRelativePath,
        packagedRelativePath: sourceRelativePath,
      });
    });
  });

  DOC_FILES.forEach((relativePath) => {
    fileMappings.push({
      sourceRelativePath: relativePath,
      packagedRelativePath: path.posix.join('docs', path.basename(relativePath)),
    });
  });

  DOC_DIRS.forEach((relativeDir) => {
    listFilesForRelativeDir(rootDir, relativeDir).forEach((sourceRelativePath) => {
      fileMappings.push({
        sourceRelativePath,
        packagedRelativePath: sourceRelativePath,
      });
    });
  });

  return fileMappings.sort((a, b) => a.packagedRelativePath.localeCompare(b.packagedRelativePath));
}

function createEvaluationKit(options) {
  const rootDir = options && options.rootDir || ROOT_DIR;
  const workspacePackage = readJson(path.join(rootDir, 'package.json'));
  const version = options && options.version || workspacePackage.version;
  const generatedAt = options && options.generatedAt || new Date().toISOString();
  const distDir = options && options.outputDir || path.join(rootDir, 'dist');
  const kitRoot = path.join(distDir, 'cleanprompt-evaluation-kit-v' + version);

  removeDir(kitRoot);
  ensureDir(kitRoot);

  EXTENSION_FILES.forEach((relativePath) => {
    copyFile(rootDir, relativePath, path.join(path.relative(rootDir, kitRoot), 'extension-unpacked', relativePath));
  });
  EXTENSION_DIRS.forEach((relativePath) => {
    copyTree(rootDir, relativePath, path.join(path.relative(rootDir, kitRoot), 'extension-unpacked', relativePath));
  });

  CONTROL_PLANE_FILES.forEach((relativePath) => {
    copyFile(rootDir, relativePath, path.join(path.relative(rootDir, kitRoot), relativePath));
  });
  CONTROL_PLANE_DIRS.forEach((relativePath) => {
    copyTree(rootDir, relativePath, path.join(path.relative(rootDir, kitRoot), relativePath));
  });

  DOC_FILES.forEach((relativePath) => {
    copyFile(rootDir, relativePath, path.join(path.relative(rootDir, kitRoot), 'docs', path.basename(relativePath)));
  });
  DOC_DIRS.forEach((relativePath) => {
    copyTree(rootDir, relativePath, path.join(path.relative(rootDir, kitRoot), relativePath));
  });

  ensureDir(path.join(kitRoot, 'control-plane', 'data'));
  fs.writeFileSync(path.join(kitRoot, 'control-plane', 'data', 'README.md'), renderControlPlaneDataReadme(), 'utf8');
  fs.writeFileSync(path.join(kitRoot, 'START_HERE.md'), renderStartHere(version), 'utf8');
  fs.writeFileSync(path.join(kitRoot, PACKAGE_MANIFEST_FILE), JSON.stringify(createPackageManifest({
    version,
    generatedAt,
    artifactFileCount: 0,
  }), null, 2) + '\n', 'utf8');

  ensureDir(path.join(kitRoot, 'bin'));
  fs.writeFileSync(path.join(kitRoot, 'bin', 'start-control-plane.sh'), renderShellScript('node control-plane/src/server.js'), 'utf8');
  fs.writeFileSync(path.join(kitRoot, 'bin', 'seed-demo.sh'), renderShellScript('node control-plane/src/demo-state-cli.js seed'), 'utf8');
  fs.writeFileSync(path.join(kitRoot, 'bin', 'reset-demo.sh'), renderShellScript('node control-plane/src/demo-state-cli.js reset'), 'utf8');
  fs.writeFileSync(path.join(kitRoot, 'bin', 'start-control-plane.cmd'), renderCmdScript('node control-plane\\src\\server.js'), 'utf8');
  fs.writeFileSync(path.join(kitRoot, 'bin', 'seed-demo.cmd'), renderCmdScript('node control-plane\\src\\demo-state-cli.js seed'), 'utf8');
  fs.writeFileSync(path.join(kitRoot, 'bin', 'reset-demo.cmd'), renderCmdScript('node control-plane\\src\\demo-state-cli.js reset'), 'utf8');

  var artifactFileList = walkFiles(kitRoot, kitRoot).filter(function(relativePath) {
    return relativePath !== CHECKSUM_FILE;
  });
  fs.writeFileSync(path.join(kitRoot, PACKAGE_MANIFEST_FILE), JSON.stringify(createPackageManifest({
    version,
    generatedAt,
    artifactFileCount: artifactFileList.length,
  }), null, 2) + '\n', 'utf8');
  writeChecksums(kitRoot);

  return {
    version,
    generatedAt,
    distDir,
    kitRoot,
    extensionRoot: path.join(kitRoot, 'extension-unpacked'),
  };
}

if (require.main === module) {
  const result = createEvaluationKit();
  process.stdout.write(
    [
      'Created CleanPrompt evaluation kit',
      'kit_root=' + result.kitRoot,
      'extension_root=' + result.extensionRoot,
      '',
    ].join('\n')
  );
}

module.exports = {
  createEvaluationKit,
  listPackagedSourceFiles,
  renderStartHere,
};
