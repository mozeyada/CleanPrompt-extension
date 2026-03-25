var fs = require('fs');

/** @typedef {import('./types').ControlPlaneConfig} ControlPlaneConfig */
/** @typedef {import('./types').ControlPlaneState} ControlPlaneState */

/**
 * @param {ControlPlaneConfig} config
 * @returns {void}
 */
function ensureDataDir(config) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

/**
 * @param {ControlPlaneState} state
 * @returns {ControlPlaneState}
 */
function createDefaultSnapshot(state) {
  return {
    policyBundle: state.policyBundle,
    auditEvents: state.auditEvents,
    devices: state.devices,
    adminActions: state.adminActions,
  };
}

/**
 * @param {ControlPlaneConfig} config
 * @returns {ControlPlaneState | null}
 */
function loadPersistedSnapshot(config) {
  try {
    var raw = fs.readFileSync(config.dataFile, 'utf8');
    return /** @type {ControlPlaneState} */ (JSON.parse(raw));
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * @param {ControlPlaneConfig} config
 * @param {ControlPlaneState} state
 * @returns {void}
 */
function persistSnapshot(config, state) {
  ensureDataDir(config);
  var payload = JSON.stringify(createDefaultSnapshot(state), null, 2);
  fs.writeFileSync(config.dataFile, payload, 'utf8');
}

module.exports = {
  loadPersistedSnapshot,
  persistSnapshot,
};
