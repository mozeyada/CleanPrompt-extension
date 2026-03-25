var http = require('http');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var loadConfig = require('./config').loadConfig;
var persistence = require('./persistence');
var stateModule = require('./state');
var validators = require('./validators');

/** @typedef {import('http').IncomingMessage} IncomingMessage */
/** @typedef {import('http').ServerResponse} ServerResponse */
/** @typedef {import('../../packages/shared-schemas/src/audit-event').AuditEvent} AuditEvent */
/** @typedef {import('../../packages/shared-schemas/src/device-enrollment').DeviceEnrollmentRequest} DeviceEnrollmentRequest */
/** @typedef {import('../../packages/shared-schemas/src/policy-bundle').PolicyBundle} PolicyBundle */
/** @typedef {import('./types').ControlPlaneConfig} ControlPlaneConfig */
/** @typedef {import('./types').ControlPlaneState} ControlPlaneState */

/**
 * @param {ServerResponse} res
 * @param {number} statusCode
 * @param {unknown} body
 * @returns {void}
 */
function sendJson(res, statusCode, body) {
  var payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * @param {IncomingMessage} req
 * @returns {Promise<Record<string, unknown>>}
 */
function readJson(req) {
  return new Promise(function(resolve, reject) {
    var raw = '';
    req.on('data', function(chunk) {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('payload_too_large'));
        req.destroy();
      }
    });
    req.on('end', function() {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * @param {ServerResponse} res
 * @param {number} statusCode
 * @param {string} body
 * @param {string} contentType
 * @returns {void}
 */
function sendText(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    'content-type': contentType + '; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * @param {ServerResponse} res
 * @param {string} relativePath
 * @param {string} contentType
 * @returns {void}
 */
function serveStaticAsset(res, relativePath, contentType) {
  try {
    var absolutePath = path.join(__dirname, 'admin', relativePath);
    var body = fs.readFileSync(absolutePath, 'utf8');
    sendText(res, 200, body, contentType);
  } catch (error) {
    sendJson(res, 404, {
      ok: false,
      error: 'asset_not_found',
      path: relativePath,
    });
  }
}

/**
 * @param {ControlPlaneState} target
 * @param {ControlPlaneState} nextState
 * @returns {void}
 */
function replaceState(target, nextState) {
  target.policyBundle = nextState.policyBundle;
  target.auditEvents = nextState.auditEvents;
  target.devices = nextState.devices;
  target.adminActions = nextState.adminActions;
}

/**
 * @param {ControlPlaneConfig} config
 * @param {ControlPlaneState} state
 * @returns {(req: IncomingMessage, res: ServerResponse) => Promise<void>}
 */
function createApp(config, state) {
  return async function handler(req, res) {
    var url = new URL(req.url, 'http://' + req.headers.host);

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/admin')) {
      serveStaticAsset(res, 'index.html', 'text/html');
      return;
    }

    if (req.method === 'GET' && url.pathname === '/admin/app.js') {
      serveStaticAsset(res, 'app.js', 'application/javascript');
      return;
    }

    if (req.method === 'GET' && url.pathname === '/admin/styles.css') {
      serveStaticAsset(res, 'styles.css', 'text/css');
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        service: 'cleanprompt-control-plane',
        status: 'ok',
        environment: config.environment,
        policy_version: state.policyBundle.policy_version,
        rules_version: state.policyBundle.rules.bundle_version,
        audit_event_count: state.auditEvents.length,
        device_count: state.devices.length,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/policies/default') {
      var policyError = validators.validatePolicyBundle(state.policyBundle);
      if (policyError) {
        sendJson(res, 500, {
          ok: false,
          error: policyError,
        });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        policy_version: state.policyBundle.policy_version,
        rules_version: state.policyBundle.rules.bundle_version,
        policy: state.policyBundle,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/audit/events') {
      sendJson(res, 200, {
        ok: true,
        events: state.auditEvents,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/summary') {
      sendJson(res, 200, {
        ok: true,
        summary: stateModule.buildAdminSummary(state),
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/devices') {
      var devices = state.devices.slice().sort(function(a, b) {
        return String(b.enrolled_at || '').localeCompare(String(a.enrolled_at || ''));
      });
      sendJson(res, 200, {
        ok: true,
        devices: devices,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/actions') {
      var actions = state.adminActions.slice().sort(function(a, b) {
        return String(b.ts || '').localeCompare(String(a.ts || ''));
      });
      sendJson(res, 200, {
        ok: true,
        actions: actions,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/policies/default') {
      try {
        var policyRequest = /** @type {{ policy?: PolicyBundle }} */ (await readJson(req));
        var nextPolicy = policyRequest && policyRequest.policy;
        var policyError = validators.validatePolicyBundle(nextPolicy);
        if (policyError) {
          sendJson(res, 400, {
            ok: false,
            error: policyError,
          });
          return;
        }

        state.policyBundle = nextPolicy;
        state.adminActions.push({
          ts: new Date().toISOString(),
          action_type: 'policy_publish',
          actor: 'local_admin',
          policy_version: nextPolicy.policy_version,
          rules_version: nextPolicy.rules && nextPolicy.rules.bundle_version || null,
          metadata_only: true,
          details: {
            strict_mode: nextPolicy.strict_mode,
            default_action: nextPolicy.actions && nextPolicy.actions.default || null,
          },
        });
        persistence.persistSnapshot(config, state);
        sendJson(res, 200, {
          ok: true,
          policy_version: nextPolicy.policy_version,
          rules_version: nextPolicy.rules && nextPolicy.rules.bundle_version || null,
        });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: error.message || 'invalid_request',
        });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/demo/reset') {
      var resetState = stateModule.createDefaultState(config);
      replaceState(state, resetState);
      persistence.persistSnapshot(config, state);
      sendJson(res, 200, {
        ok: true,
        mode: 'reset',
        summary: stateModule.buildAdminSummary(state),
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/demo/seed') {
      var demoState = stateModule.createDemoState(config);
      replaceState(state, demoState);
      persistence.persistSnapshot(config, state);
      sendJson(res, 200, {
        ok: true,
        mode: 'seed',
        summary: stateModule.buildAdminSummary(state),
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/device-enrollment') {
      try {
        var enrollment = /** @type {DeviceEnrollmentRequest} */ (/** @type {unknown} */ (await readJson(req)));
        var enrollmentError = validators.validateDeviceEnrollmentRequest(enrollment);
        if (enrollmentError) {
          sendJson(res, 400, {
            ok: false,
            error: enrollmentError,
          });
          return;
        }

        var deviceRecord = /** @type {import('./types').DeviceRecord} */ ({
          schema_version: '1.0.0',
          device_id: 'device-' + crypto.randomUUID(),
          org_id: config.orgId,
          policy_version: state.policyBundle.policy_version,
          rules_version: state.policyBundle.rules.bundle_version,
          extension_version: enrollment.extension_version || 'unknown',
          browser_family: enrollment.browser_family || 'other',
          os_family: enrollment.os_family || 'other',
          managed_device: Boolean(enrollment.managed_device),
          enrolled_at: new Date().toISOString(),
        });
        state.devices.push(deviceRecord);
        persistence.persistSnapshot(config, state);
        sendJson(res, 201, {
          schema_version: '1.0.0',
          device_id: deviceRecord.device_id,
          org_id: deviceRecord.org_id,
          policy_version: deviceRecord.policy_version,
          rules_version: deviceRecord.rules_version,
        });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: error.message || 'invalid_request',
        });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/audit/events') {
      try {
        var auditEvent = /** @type {AuditEvent} */ (/** @type {unknown} */ (await readJson(req)));
        var auditError = validators.validateAuditEvent(auditEvent);
        if (auditError) {
          sendJson(res, 400, {
            ok: false,
            error: auditError,
          });
          return;
        }

        state.auditEvents.push({
          received_at: new Date().toISOString(),
          event: auditEvent,
        });
        persistence.persistSnapshot(config, state);
        sendJson(res, 202, {
          ok: true,
          accepted: true,
          count: state.auditEvents.length,
        });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: error.message || 'invalid_request',
        });
      }
      return;
    }

    sendJson(res, 404, {
      ok: false,
      error: 'not_found',
      path: url.pathname,
    });
  };
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [options]
 * @returns {{ config: ControlPlaneConfig, state: ControlPlaneState, server: import('http').Server }}
 */
function createServer(options) {
  var config = loadConfig(options);
  var snapshot = persistence.loadPersistedSnapshot(config);
  var state = stateModule.normalizeState(config, snapshot);
  var app = createApp(config, state);
  var server = http.createServer(function(req, res) {
    Promise.resolve(app(req, res)).catch(function(error) {
      sendJson(res, 500, {
        ok: false,
        error: 'internal_error',
        message: error && error.message ? error.message : 'unknown_error',
      });
    });
  });

  return {
    config: config,
    state: state,
    server: server,
  };
}

if (require.main === module) {
  var instance = createServer();
  instance.server.listen(instance.config.port, instance.config.host, function() {
    console.log(
      '[CleanPrompt Control Plane] listening on http://' +
      instance.config.host +
      ':' +
      instance.config.port
    );
  });
}

module.exports = {
  createApp,
  createServer,
};
