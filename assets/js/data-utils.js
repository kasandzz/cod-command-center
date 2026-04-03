// COD Command Center - Shared Data Utilities
// Used by all dashboard pages (Phases 13-16)

var COLORS = {
  up: '#22c55e',
  down: '#ef4444',
  neutral: '#94a3b8',
  warning: '#f59e0b',
  accent: '#38bdf8',
  gold: '#facc15',
  gridLine: 'rgba(30,41,59,0.5)',
  textMuted: '#64748b',
  textSecondary: '#94a3b8'
};

function fetchPageData(pageSlug) {
  return fetch('../data/' + pageSlug + '.json')
    .then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .catch(function(err) {
      console.error('Failed to load data for ' + pageSlug + ':', err);
      return null;
    });
}

function formatCurrency(value) {
  if (value == null) return '--';
  if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'K';
  return '$' + value.toLocaleString('en-US');
}

function formatPercent(value) {
  if (value == null) return '--';
  return (value * 100).toFixed(1) + '%';
}

function formatMultiplier(value) {
  if (value == null) return '--';
  return value.toFixed(1) + 'x';
}

function formatNumber(value) {
  if (value == null) return '--';
  return Math.round(value).toLocaleString('en-US');
}

function getTrafficLightColor(value, target, inverted) {
  if (target == null) return 'neutral';
  if (inverted) {
    if (value <= target) return 'green';
    if (value <= target * 1.1) return 'yellow';
    return 'red';
  }
  if (value >= target) return 'green';
  if (value >= target * 0.9) return 'yellow';
  return 'red';
}

function getDeltaInfo(current, prior, inverted) {
  if (!prior || prior === 0) return { class: 'neutral', text: '--' };
  var change = (current - prior) / prior;
  var pct = (Math.abs(change) * 100).toFixed(1);
  var isUp = change > 0;
  var isDown = change < 0;
  var arrow, cls;

  if (Math.abs(change) < 0.001) {
    return { class: 'neutral', text: '\u2192 0.0% vs prior' };
  }

  if (inverted) {
    arrow = isUp ? '\u2191' : '\u2193';
    cls = isUp ? 'down' : 'up';
  } else {
    arrow = isUp ? '\u2191' : '\u2193';
    cls = isUp ? 'up' : 'down';
  }

  return { class: cls, text: arrow + ' ' + pct + '% vs prior' };
}
