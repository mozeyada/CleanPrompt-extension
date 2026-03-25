(function () {
  'use strict';

  var ACTION_OPTIONS = ['allow', 'warn', 'redact', 'justify', 'block'];
  var CATEGORY_ORDER = ['Credential', 'PII', 'Financial', 'Network', 'MSP'];
  var currentPolicyBundle = null;

  function request(path, options) {
    return fetch(path, Object.assign({
      headers: {
        accept: 'application/json',
      },
    }, options || {})).then(function(response) {
      if (!response.ok) {
        return response.json().catch(function() {
          return { error: 'request_failed' };
        }).then(function(payload) {
          throw new Error(payload.error || ('http_' + response.status));
        });
      }
      return response.json();
    });
  }

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  function setDemoFeedback(message, isError) {
    var element = document.getElementById('demo-feedback');
    if (!element) return;
    element.textContent = message || '';
    element.style.color = isError ? '#ff7f7f' : '#8fa9b7';
  }

  function formatTimestamp(value) {
    if (!value) return 'Never';
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }

  function createStat(label, value) {
    var div = document.createElement('div');
    div.className = 'stat';
    div.innerHTML =
      '<div class="stat-label">' + label + '</div>' +
      '<div class="stat-value">' + value + '</div>';
    return div;
  }

  function createDistributionPanel(title, values) {
    var wrapper = document.createElement('div');
    wrapper.className = 'distribution-panel';
    wrapper.innerHTML = '<div class="distribution-title">' + title + '</div>';

    var list = document.createElement('div');
    list.className = 'distribution-list';
    var keys = Object.keys(values || {});

    if (!keys.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No data yet.';
      wrapper.appendChild(empty);
      return wrapper;
    }

    keys.sort(function(a, b) {
      return (values[b] || 0) - (values[a] || 0);
    }).forEach(function(key) {
      var row = document.createElement('div');
      row.className = 'distribution-item';
      row.innerHTML =
        '<span class="distribution-name">' + key.replace(/_/g, ' ') + '</span>' +
        '<span class="distribution-value">' + values[key] + '</span>';
      list.appendChild(row);
    });

    wrapper.appendChild(list);
    return wrapper;
  }

  function renderSummary(summary) {
    var stats = document.getElementById('summary-stats');
    stats.innerHTML = '';
    stats.appendChild(createStat('Devices', summary.device_count || 0));
    stats.appendChild(createStat('Audit Events', summary.audit_event_count || 0));
    stats.appendChild(createStat('Policy', summary.policy_version || 'n/a'));
    stats.appendChild(createStat('Rules', summary.rules_version || 'n/a'));

    var distributions = document.getElementById('distribution-grid');
    distributions.innerHTML = '';
    distributions.appendChild(createDistributionPanel('Policy actions', summary.action_counts || {}));
    distributions.appendChild(createDistributionPanel('Sensitive categories', summary.category_counts || {}));
    distributions.appendChild(createDistributionPanel('Extension versions', summary.device_version_counts || {}));

    setText('metadata-pill', summary.metadata_only ? 'Metadata only' : 'Review required');
  }

  function ensureActionOptions(select, selectedValue) {
    select.innerHTML = '';
    ACTION_OPTIONS.forEach(function(action) {
      var option = document.createElement('option');
      option.value = action;
      option.textContent = action;
      if (action === selectedValue) option.selected = true;
      select.appendChild(option);
    });
  }

  function renderPolicy(policy) {
    currentPolicyBundle = policy;
    setText('policy-meta', 'Org ' + policy.org_name + ' · Team ' + policy.team_name);
    document.getElementById('policy-version').value = policy.policy_version || '';
    document.getElementById('rules-version').value = policy.rules && policy.rules.bundle_version || '';
    ensureActionOptions(document.getElementById('default-action'), policy.actions && policy.actions.default || 'warn');
    document.getElementById('strict-mode').checked = Boolean(policy.strict_mode);

    var grid = document.getElementById('category-grid');
    grid.innerHTML = '';
    CATEGORY_ORDER.forEach(function(category) {
      var field = document.createElement('label');
      field.className = 'field';
      field.innerHTML = '<span>' + category + ' action</span>';
      var select = document.createElement('select');
      select.dataset.category = category;
      ensureActionOptions(select, policy.actions && policy.actions.by_category && policy.actions.by_category[category] || 'warn');
      field.appendChild(select);
      grid.appendChild(field);
    });
  }

  function renderDevices(devices) {
    var body = document.getElementById('devices-body');
    body.innerHTML = '';
    setText('device-meta', devices.length + ' enrolled endpoints');

    if (!devices.length) {
      body.innerHTML = '<tr><td colspan="4" class="empty">No devices enrolled yet.</td></tr>';
      return;
    }

    devices.forEach(function(device) {
      var row = document.createElement('tr');
      row.innerHTML =
        '<td>' + device.device_id + '</td>' +
        '<td>' + (device.extension_version || 'unknown') + '</td>' +
        '<td>' + [device.browser_family || 'other', device.os_family || 'other'].join(' / ') + '</td>' +
        '<td>' + formatTimestamp(device.enrolled_at) + '</td>';
      body.appendChild(row);
    });
  }

  function renderEvents(events) {
    var body = document.getElementById('events-body');
    body.innerHTML = '';

    if (!events.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty">No metadata events received yet.</td></tr>';
      return;
    }

    events.slice().reverse().slice(0, 12).forEach(function(entry) {
      var event = entry.event || {};
      var categories = (event.sensitivity_categories || []).map(function(category) {
        return '<span class="tag">' + category + '</span>';
      }).join('');
      var row = document.createElement('tr');
      row.innerHTML =
        '<td>' + formatTimestamp(entry.received_at) + '</td>' +
        '<td>' + (event.action || 'unknown') + '</td>' +
        '<td>' + (event.intent_label || 'unknown') + '</td>' +
        '<td><div class="tag-row">' + (categories || '<span class="tag">none</span>') + '</div></td>' +
        '<td>' + (event.device_id || 'unknown') + '</td>';
      body.appendChild(row);
    });
  }

  function renderActions(actions) {
    var list = document.getElementById('actions-list');
    list.innerHTML = '';

    if (!actions.length) {
      list.innerHTML = '<div class="empty">No admin actions yet.</div>';
      return;
    }

    actions.slice(0, 8).forEach(function(action) {
      var item = document.createElement('div');
      item.className = 'timeline-item';
      item.innerHTML =
        '<div>' +
          '<div class="timeline-title">' + String(action.action_type || 'unknown').replace(/_/g, ' ') + '</div>' +
          '<div class="timeline-meta">' + (action.policy_version || 'No policy version') + '</div>' +
        '</div>' +
        '<div class="timeline-meta">' + formatTimestamp(action.ts) + '</div>';
      list.appendChild(item);
    });
  }

  function collectPolicyFormValues() {
    var nextPolicy = JSON.parse(JSON.stringify(currentPolicyBundle || {}));
    nextPolicy.policy_version = document.getElementById('policy-version').value.trim();
    nextPolicy.strict_mode = document.getElementById('strict-mode').checked;
    nextPolicy.actions = nextPolicy.actions || { default: 'warn', by_category: {} };
    nextPolicy.actions.default = document.getElementById('default-action').value;
    nextPolicy.actions.by_category = nextPolicy.actions.by_category || {};
    nextPolicy.rules = nextPolicy.rules || {};
    nextPolicy.rules.bundle_version = document.getElementById('rules-version').value.trim();
    nextPolicy.rules.local_bundle_version = nextPolicy.rules.bundle_version;

    document.querySelectorAll('#category-grid select').forEach(function(select) {
      nextPolicy.actions.by_category[select.dataset.category] = select.value;
    });

    return nextPolicy;
  }

  function setPolicyFeedback(message, isError) {
    var feedback = document.getElementById('policy-feedback');
    feedback.textContent = message || '';
    feedback.style.color = isError ? '#ff7f7f' : '#8fa9b7';
  }

  function refreshDashboard() {
    setPolicyFeedback('Refreshing dashboard…', false);
    setDemoFeedback('Refreshing dashboard…', false);
    return Promise.all([
      request('/api/admin/summary'),
      request('/api/policies/default'),
      request('/api/admin/devices'),
      request('/api/audit/events'),
      request('/api/admin/actions'),
    ]).then(function(results) {
      renderSummary(results[0].summary || {});
      renderPolicy(results[1].policy || {});
      renderDevices(results[2].devices || []);
      renderEvents(results[3].events || []);
      renderActions(results[4].actions || []);
      setPolicyFeedback('Dashboard up to date.', false);
      setDemoFeedback('Dashboard is ready for demo use.', false);
    }).catch(function(error) {
      setPolicyFeedback('Dashboard refresh failed: ' + error.message, true);
      setDemoFeedback('Dashboard refresh failed: ' + error.message, true);
    });
  }

  function runDemoAction(path, pendingMessage, successMessage) {
    setDemoFeedback(pendingMessage, false);
    return request(path, {
      method: 'POST',
      headers: {
        accept: 'application/json',
      },
    }).then(function(payload) {
      setDemoFeedback(successMessage + ' Devices: ' + payload.summary.device_count + ' · Events: ' + payload.summary.audit_event_count, false);
      return refreshDashboard();
    }).catch(function(error) {
      setDemoFeedback('Demo action failed: ' + error.message, true);
    });
  }

  function publishPolicy(event) {
    event.preventDefault();
    setPolicyFeedback('Publishing policy…', false);

    request('/api/admin/policies/default', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        policy: collectPolicyFormValues(),
      }),
    }).then(function(payload) {
      setPolicyFeedback('Policy ' + payload.policy_version + ' published.', false);
      return refreshDashboard();
    }).catch(function(error) {
      setPolicyFeedback('Policy publish failed: ' + error.message, true);
    });
  }

  function init() {
    document.getElementById('refresh-dashboard').addEventListener('click', function() {
      refreshDashboard();
    });

    document.getElementById('seed-demo-data').addEventListener('click', function() {
      runDemoAction('/api/demo/seed', 'Seeding demo data…', 'Demo data seeded.');
    });

    document.getElementById('reset-demo-data').addEventListener('click', function() {
      runDemoAction('/api/demo/reset', 'Resetting demo state…', 'Demo state reset.');
    });

    document.getElementById('open-policy-api').addEventListener('click', function() {
      window.open('/api/policies/default', '_blank');
    });

    document.getElementById('policy-form').addEventListener('submit', publishPolicy);
    refreshDashboard();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
