var loadConfig = require('./config').loadConfig;
var persistence = require('./persistence');
var stateModule = require('./state');

/**
 * @returns {void}
 */
function printUsage() {
  console.log('Usage: node src/demo-state-cli.js <seed|reset>');
}

/**
 * @param {string[]} argv
 * @returns {void}
 */
function main(argv) {
  var command = argv[2];
  if (!command || (command !== 'seed' && command !== 'reset')) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  var config = loadConfig();
  var state = command === 'seed'
    ? stateModule.createDemoState(config)
    : stateModule.createDefaultState(config);

  persistence.persistSnapshot(config, state);

  var summary = stateModule.buildAdminSummary(state);
  console.log(
    '[CleanPrompt Control Plane] ' +
    (command === 'seed' ? 'seeded demo state' : 'reset demo state') +
    ' at ' +
    config.dataFile
  );
  console.log(
    JSON.stringify({
      policy_version: summary.policy_version,
      device_count: summary.device_count,
      audit_event_count: summary.audit_event_count,
    }, null, 2)
  );
}

main(process.argv);
