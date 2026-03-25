const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');

function createResponseCapture() {
  return {
    statusCode: null,
    headers: null,
    body: '',
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk) {
      if (chunk) this.body += chunk;
    },
  };
}

async function dispatch(app, method, url, body) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost' };
  const res = createResponseCapture();
  const promise = app(req, res);
  if (body !== undefined) {
    req.emit('data', JSON.stringify(body));
  }
  req.emit('end');
  await promise;
  const contentType = res.headers && res.headers['content-type'] || '';
  return {
    statusCode: res.statusCode,
    headers: res.headers,
    body: res.body,
    json: contentType.includes('application/json') ? JSON.parse(res.body) : null,
  };
}

function createTempConfig() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanprompt-control-plane-workspace-'));
  return {
    CLEANPROMPT_CONTROL_PLANE_DATA_DIR: dataDir,
    CLEANPROMPT_CONTROL_PLANE_DATA_FILE: path.join(dataDir, 'state.json'),
    CLEANPROMPT_CONTROL_PLANE_PORT: '8794',
  };
}

module.exports = {
  createTempConfig,
  dispatch,
};
