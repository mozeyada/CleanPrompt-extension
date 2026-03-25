var path = require('path');
var PACKAGE_ROOT = path.resolve(__dirname, '..');

/** @typedef {import('./types').ControlPlaneConfig} ControlPlaneConfig */

/**
 * @param {string | number | undefined | null} value
 * @param {number} fallback
 * @returns {number}
 */
function readNumber(value, fallback) {
  var parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {ControlPlaneConfig}
 */
function loadConfig(env) {
  var source = env || process.env;
  return {
    port: readNumber(source.CLEANPROMPT_CONTROL_PLANE_PORT, 8787),
    host: source.CLEANPROMPT_CONTROL_PLANE_HOST || '127.0.0.1',
    environment: source.NODE_ENV || 'development',
    orgId: source.CLEANPROMPT_DEFAULT_ORG_ID || 'org_acme_msp',
    orgName: source.CLEANPROMPT_DEFAULT_ORG_NAME || 'Acme Managed Services',
    teamId: source.CLEANPROMPT_DEFAULT_TEAM_ID || 'helpdesk',
    teamName: source.CLEANPROMPT_DEFAULT_TEAM_NAME || 'Helpdesk',
    policyVersion: source.CLEANPROMPT_DEFAULT_POLICY_VERSION || '2026.03.22-dev',
    rulesVersion: source.CLEANPROMPT_DEFAULT_RULES_VERSION || '1.2.0-local',
    dataDir: source.CLEANPROMPT_CONTROL_PLANE_DATA_DIR || path.join(PACKAGE_ROOT, 'data'),
    dataFile: source.CLEANPROMPT_CONTROL_PLANE_DATA_FILE || path.join(
      source.CLEANPROMPT_CONTROL_PLANE_DATA_DIR || path.join(PACKAGE_ROOT, 'data'),
      'dev-state.json'
    ),
  };
}

module.exports = {
  loadConfig,
};
