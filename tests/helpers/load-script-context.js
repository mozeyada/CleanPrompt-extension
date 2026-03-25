const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');

function createChromeStub() {
  const storageState = {};
  const listeners = {
    onInstalled: null,
    onStartup: null,
    onMessage: null,
    onAlarm: null,
  };

  return {
    tabs: {
      create() {},
    },
    runtime: {
      getManifest() {
        return { version: '1.2.0-test' };
      },
      getURL(resource) {
        return resource;
      },
      onInstalled: {
        addListener(fn) {
          listeners.onInstalled = fn;
        },
      },
      onStartup: {
        addListener(fn) {
          listeners.onStartup = fn;
        },
      },
      onMessage: {
        addListener(fn) {
          listeners.onMessage = fn;
        },
      },
      _listeners: listeners,
    },
    alarms: {
      create() {},
      onAlarm: {
        addListener(fn) {
          listeners.onAlarm = fn;
        },
      },
    },
    storage: {
      local: {
        get(keys, cb) {
          if (keys == null) {
            cb({ ...storageState });
            return;
          }

          if (Array.isArray(keys)) {
            const result = {};
            keys.forEach((key) => {
              if (Object.prototype.hasOwnProperty.call(storageState, key)) {
                result[key] = storageState[key];
              }
            });
            cb(result);
            return;
          }

          if (typeof keys === 'string') {
            cb({ [keys]: storageState[keys] });
            return;
          }

          const result = {};
          Object.keys(keys).forEach((key) => {
            result[key] = Object.prototype.hasOwnProperty.call(storageState, key)
              ? storageState[key]
              : keys[key];
          });
          cb(result);
        },
        set(patch, cb) {
          Object.assign(storageState, patch);
          if (cb) cb();
        },
        _state: storageState,
      },
    },
  };
}

function loadScript(relativePath, additions = {}) {
  const absolutePath = path.join(ROOT, relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  const context = {
    console,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Promise,
    setTimeout,
    clearTimeout,
    ...additions,
  };

  context.globalThis = context;
  vm.createContext(context);
  if (typeof context.importScripts !== 'function') {
    context.importScripts = function importScripts() {
      Array.from(arguments).forEach((scriptPath) => {
        const importedPath = path.join(ROOT, scriptPath);
        const importedSource = fs.readFileSync(importedPath, 'utf8');
        vm.runInContext(importedSource, context, { filename: importedPath });
      });
    };
  }
  vm.runInContext(source, context, { filename: absolutePath });
  return context;
}

function dispatchRuntimeMessage(chrome, message, sender = {}) {
  return new Promise((resolve) => {
    const listener = chrome
      && chrome.runtime
      && chrome.runtime._listeners
      && chrome.runtime._listeners.onMessage;

    if (typeof listener !== 'function') {
      resolve(undefined);
      return;
    }

    let settled = false;
    function settle(value) {
      if (settled) return;
      settled = true;
      resolve(value);
    }

    const result = listener(message, sender, settle);
    if (result !== true && !settled) {
      settle(result);
    }
  });
}

module.exports = {
  createChromeStub,
  dispatchRuntimeMessage,
  loadScript,
};
