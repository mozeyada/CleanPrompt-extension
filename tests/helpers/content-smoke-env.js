class FakeEvent {
  constructor(type, options) {
    this.type = type;
    this.bubbles = Boolean(options && options.bubbles);
    this.cancelable = Boolean(options && options.cancelable);
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }

  stopPropagation() {}
  stopImmediatePropagation() {}
}

class FakeClassList {
  constructor(element) {
    this.element = element;
    this._set = new Set();
  }

  _syncFromString(value) {
    this._set = new Set(String(value || '').split(/\s+/).filter(Boolean));
    this.element.className = Array.from(this._set).join(' ');
  }

  add() {
    for (var i = 0; i < arguments.length; i += 1) {
      this._set.add(arguments[i]);
    }
    this.element.className = Array.from(this._set).join(' ');
  }

  remove() {
    for (var i = 0; i < arguments.length; i += 1) {
      this._set.delete(arguments[i]);
    }
    this.element.className = Array.from(this._set).join(' ');
  }

  contains(value) {
    return this._set.has(value);
  }
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.eventListeners = {};
    this.className = '';
    this.classList = new FakeClassList(this);
    this.textContent = '';
    this.innerText = '';
    this.value = '';
    this.disabled = false;
    this.id = '';
    this.clickCount = 0;
  }

  appendChild(child) {
    if (!child) return child;
    child.parentElement = this;
    this.children.push(child);
    if (child.ownerDocument !== this.ownerDocument) {
      child.ownerDocument = this.ownerDocument;
    }
    this.ownerDocument._registerTree(child);
    return child;
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  setAttribute(name, value) {
    var stringValue = String(value);
    this.attributes[name] = stringValue;
    if (name === 'id') {
      this.id = stringValue;
      this.ownerDocument._elementsById[stringValue] = this;
    } else if (name === 'class') {
      this.classList._syncFromString(stringValue);
    } else if (name.indexOf('data-') === 0) {
      this.dataset[name.slice(5).replace(/-([a-z])/g, function(_, letter) { return letter.toUpperCase(); })] = stringValue;
    } else if (name === 'value') {
      this.value = stringValue;
    }
  }

  getAttribute(name) {
    if (name === 'id') return this.id || null;
    if (name === 'class') return this.className || null;
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  addEventListener(type, handler) {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push(handler);
  }

  dispatchEvent(event) {
    event.target = this;
    event.currentTarget = this;
    var handlers = this.eventListeners[event.type] || [];
    handlers.forEach(function(handler) {
      handler.call(this, event);
    }, this);
    return !event.defaultPrevented;
  }

  click() {
    this.clickCount += 1;
    return this.dispatchEvent(new FakeEvent('click', { bubbles: true, cancelable: true }));
  }

  focus() {}

  closest(selector) {
    var node = this;
    while (node) {
      if (matchesSelector(node, selector)) return node;
      node = node.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    return this.ownerDocument._querySelector(selector, this);
  }

  querySelectorAll(selector) {
    return this.ownerDocument._querySelectorAll(selector, this);
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    this.ownerDocument._parseInnerHTMLInto(this, html);
  }

  get innerHTML() {
    return this._innerHTML || '';
  }
}

function matchesSelector(element, selector) {
  if (!element || !selector) return false;

  var trimmedSelector = String(selector).trim();
  if (!trimmedSelector) return false;

  var parts = splitSelectorParts(trimmedSelector);
  if (parts.length > 1) {
    return matchesSelectorChain(element, parts);
  }

  var selectorToMatch = trimmedSelector;
  var idMatch = selectorToMatch.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch && element.id !== idMatch[1]) {
    return false;
  }

  var classMatches = selectorToMatch.match(/\.([a-zA-Z0-9_-]+)/g) || [];
  for (var c = 0; c < classMatches.length; c += 1) {
    if (!element.classList.contains(classMatches[c].slice(1))) {
      return false;
    }
  }

  if (selector.charAt(0) === '#') {
    return element.id === selector.slice(1);
  }

  if (selector.charAt(0) === '.') {
    return element.classList.contains(selector.slice(1));
  }

  var attributeRegex = /\[([^\]=]+)(?:="([^"]*)")?\]/g;
  var attributes = [];
  var match = null;
  while ((match = attributeRegex.exec(selector))) {
    attributes.push({ name: match[1], value: match[2] });
  }

  var tag = selectorToMatch
    .replace(/#[a-zA-Z0-9_-]+/g, '')
    .replace(/\.[a-zA-Z0-9_-]+/g, '')
    .split('[')[0]
    .trim();
  if (tag && tag !== '*' && element.tagName.toLowerCase() !== tag.toLowerCase()) {
    return false;
  }

  for (var i = 0; i < attributes.length; i += 1) {
    var current = attributes[i];
    var actual = element.getAttribute(current.name);
    if (current.value == null) {
      if (actual == null) return false;
    } else if (actual !== current.value) {
      return false;
    }
  }

  return tag || attributes.length > 0;
}

function splitSelectorParts(selector) {
  var parts = [];
  var current = '';
  var bracketDepth = 0;
  var quoteChar = null;

  for (var index = 0; index < selector.length; index += 1) {
    var char = selector.charAt(index);

    if (quoteChar) {
      current += char;
      if (char === quoteChar) {
        quoteChar = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quoteChar = char;
      current += char;
      continue;
    }

    if (char === '[') {
      bracketDepth += 1;
      current += char;
      continue;
    }

    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += char;
      continue;
    }

    if (/\s/.test(char) && bracketDepth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function matchesSelectorChain(element, selectors) {
  if (!selectors.length) return false;
  if (!matchesSelector(element, selectors[selectors.length - 1])) return false;

  var current = element.parentElement;
  for (var index = selectors.length - 2; index >= 0; index -= 1) {
    while (current && !matchesSelector(current, selectors[index])) {
      current = current.parentElement;
    }
    if (!current) return false;
    current = current.parentElement;
  }

  return true;
}

class FakeDocument {
  constructor() {
    this._elementsById = {};
    this._eventListeners = {};
    this.readyState = 'complete';
    this.documentElement = new FakeElement('html', this);
    this.body = new FakeElement('body', this);
    this.documentElement.appendChild(this.body);
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  createTextNode(text) {
    var node = new FakeElement('#text', this);
    node.textContent = text;
    return node;
  }

  getElementById(id) {
    return this._elementsById[id] || null;
  }

  querySelector(selector) {
    return this._querySelector(selector, this.documentElement);
  }

  querySelectorAll(selector) {
    return this._querySelectorAll(selector, this.documentElement);
  }

  addEventListener(type, handler) {
    if (!this._eventListeners[type]) this._eventListeners[type] = [];
    this._eventListeners[type].push(handler);
  }

  dispatchEvent(event) {
    var handlers = this._eventListeners[event.type] || [];
    handlers.forEach(function(handler) {
      handler(event);
    });
  }

  execCommand() {
    return true;
  }

  _registerTree(node) {
    if (!node) return;
    if (node.id) this._elementsById[node.id] = node;
    node.children.forEach((child) => this._registerTree(child));
  }

  _parseInnerHTMLInto(parent, html) {
    var tagRegex = /<([a-zA-Z0-9-]+)([^>]*)>/g;
    var attrRegex = /([a-zA-Z0-9:-]+)="([^"]*)"/g;
    var match = null;

    while ((match = tagRegex.exec(String(html || '')))) {
      var tagName = match[1];
      if (tagName.charAt(0) === '/') continue;
      var child = this.createElement(tagName);
      var attributes = match[2] || '';
      var attrMatch = null;
      while ((attrMatch = attrRegex.exec(attributes))) {
        child.setAttribute(attrMatch[1], attrMatch[2]);
      }
      parent.appendChild(child);
    }
  }

  _walk(root, callback) {
    root.children.forEach((child) => {
      callback(child);
      this._walk(child, callback);
    });
  }

  _querySelector(selector, root) {
    return this._querySelectorAll(selector, root)[0] || null;
  }

  _querySelectorAll(selector, root) {
    var results = [];
    this._walk(root, function(element) {
      if (matchesSelector(element, selector)) {
        results.push(element);
      }
    });
    return results;
  }
}

function createContentSmokeEnv(options) {
  var settings = options && options.settings || {};
  var hostname = options && options.hostname || 'chatgpt.com';
  var fixture = options && options.fixture || inferFixtureFromHostname(hostname);
  var customRedact = options && options.logcleanRedact;
  var customSummary = options && options.logcleanGetSummary;
  var customChrome = options && options.chrome || null;
  var handleRuntimeMessage = options && options.handleRuntimeMessage;
  var fastTimers = options && Object.prototype.hasOwnProperty.call(options, 'fastTimers')
    ? Boolean(options.fastTimers)
    : true;
  var messages = [];
  var document = new FakeDocument();
  var fixtureState = buildFixture(document, fixture);
  var form = fixtureState.form;
  var input = fixtureState.input;

  var chrome = customChrome || {
    storage: {
      local: {
        get(keys, callback) {
          callback({});
        },
      },
    },
    runtime: {
      getURL(resource) {
        return resource;
      },
    },
  };

  if (!chrome.storage) {
    chrome.storage = {
      local: {
        get(keys, callback) {
          callback({});
        },
      },
    };
  }

  if (!chrome.storage.local) {
    chrome.storage.local = {
      get(keys, callback) {
        callback({});
      },
    };
  }

  if (!chrome.runtime) {
    chrome.runtime = {};
  }

  if (typeof chrome.runtime.getURL !== 'function') {
    chrome.runtime.getURL = function(resource) {
      return resource;
    };
  }

  var originalSendMessage = typeof chrome.runtime.sendMessage === 'function'
    ? chrome.runtime.sendMessage.bind(chrome.runtime)
    : null;

  chrome.runtime.sendMessage = function(message, callback) {
    messages.push(message);

    if (typeof handleRuntimeMessage === 'function') {
      var handled = handleRuntimeMessage(message, callback);
      if (handled && typeof handled.then === 'function') {
        handled.then(function(response) {
          if (callback) callback(response);
        });
      }
      return;
    }

    if (originalSendMessage) {
      originalSendMessage(message, callback);
      return;
    }

    if (message.type === 'GET_SETTINGS') {
      callback && callback(settings);
      return;
    }
    if (message.type === 'GET_AUDIT_LOG') {
      callback && callback([]);
      return;
    }
    callback && callback({ ok: true });
  };

  var window = {
    __logclean_injected: false,
    __logclean_initialized: false,
    HTMLTextAreaElement: function HTMLTextAreaElement() {},
  };

  Object.defineProperty(window.HTMLTextAreaElement.prototype, 'value', {
    configurable: true,
    get: function() {
      return this.value;
    },
    set: function(nextValue) {
      this.value = nextValue;
    },
  });

  return {
    additions: {
      window: window,
      document: document,
      location: { hostname: hostname },
      chrome: chrome,
      MutationObserver: class {
        constructor(callback) {
          this.callback = callback;
        }
        observe() {}
        disconnect() {}
      },
      getComputedStyle: function() {
        return { position: 'static' };
      },
      setTimeout: function(callback) {
        if (!fastTimers) return setTimeout(callback, 0);
        return setTimeout(callback, 0);
      },
      clearTimeout: function(timerId) {
        clearTimeout(timerId);
      },
      setInterval: function() { return 1; },
      clearInterval: function() {},
      Event: FakeEvent,
      InputEvent: FakeEvent,
      KeyboardEvent: FakeEvent,
      LOGCLEAN_RULES: [],
      LOGCLEAN_RISK: {},
      logcleanGetSummary: customSummary || function() {
        return { total: 0, byCategory: {}, byRisk: {} };
      },
      logcleanRedact: customRedact || async function() {
        return { findings: [], event_summary: null };
      },
    },
    chrome: chrome,
    document: document,
    input: input,
    form: form,
    sendButton: fixtureState.sendButton,
    messages: messages,
    window: window,
  };
}

function inferFixtureFromHostname(hostname) {
  if (/claude\.ai/.test(hostname)) return 'claude';
  if (/copilot\.microsoft\.com|bing\.com/.test(hostname)) return 'copilot';
  if (/gemini\.google\.com/.test(hostname)) return 'gemini';
  return 'chatgpt';
}

function buildFixture(document, fixture) {
  var hostRoot = document.createElement('div');
  hostRoot.setAttribute('id', 'host-root');
  document.body.appendChild(hostRoot);

  if (fixture === 'claude') {
    var claudeWrap = document.createElement('div');
    var claudeInput = document.createElement('div');
    var claudeSend = document.createElement('button');
    claudeInput.setAttribute('class', 'ProseMirror');
    claudeInput.setAttribute('contenteditable', 'true');
    claudeSend.setAttribute('aria-label', 'Send message');
    claudeWrap.appendChild(claudeInput);
    claudeWrap.appendChild(claudeSend);
    hostRoot.appendChild(claudeWrap);
    return { form: claudeWrap, input: claudeInput, sendButton: claudeSend };
  }

  if (fixture === 'copilot') {
    var copilotWrap = document.createElement('div');
    var copilotInput = document.createElement('textarea');
    var copilotSend = document.createElement('button');
    copilotInput.setAttribute('id', 'searchbox');
    copilotInput.setAttribute('aria-label', 'Ask Copilot');
    copilotSend.setAttribute('type', 'submit');
    copilotWrap.appendChild(copilotInput);
    copilotWrap.appendChild(copilotSend);
    hostRoot.appendChild(copilotWrap);
    return { form: copilotWrap, input: copilotInput, sendButton: copilotSend };
  }

  if (fixture === 'gemini') {
    var geminiWrap = document.createElement('div');
    var richTextarea = document.createElement('rich-textarea');
    var geminiInput = document.createElement('div');
    var geminiSend = document.createElement('button');
    geminiInput.setAttribute('contenteditable', 'true');
    geminiSend.setAttribute('aria-label', 'Send');
    richTextarea.appendChild(geminiInput);
    geminiWrap.appendChild(richTextarea);
    geminiWrap.appendChild(geminiSend);
    hostRoot.appendChild(geminiWrap);
    return { form: geminiWrap, input: geminiInput, sendButton: geminiSend };
  }

  if (fixture === 'chatgpt-drift') {
    var driftWrap = document.createElement('div');
    var driftSend = document.createElement('button');
    driftSend.setAttribute('data-testid', 'send-button');
    driftWrap.appendChild(driftSend);
    hostRoot.appendChild(driftWrap);
    return { form: driftWrap, input: null, sendButton: driftSend };
  }

  var form = document.createElement('form');
  var input = document.createElement('textarea');
  var sendButton = document.createElement('button');
  input.setAttribute('id', 'prompt-textarea');
  input.setAttribute('placeholder', 'Send a message');
  sendButton.setAttribute('data-testid', 'send-button');
  form.appendChild(input);
  form.appendChild(sendButton);
  hostRoot.appendChild(form);
  return { form: form, input: input, sendButton: sendButton };
}

module.exports = {
  createContentSmokeEnv,
};
