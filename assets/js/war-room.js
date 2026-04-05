// COD Command Center - War Room Page
// Renders KPI cards, revenue trend chart, and weekly summary table

var KPI_CONFIG = [
  { key: 'revenue_cash', label: 'Revenue (Cash)', format: formatCurrency, inverted: false },
  { key: 'ad_spend', label: 'Ad Spend', format: formatCurrency, inverted: true },
  { key: 'roas_cash', label: 'ROAS (Cash)', format: formatMultiplier, inverted: false },
  { key: 'enrollments', label: 'Enrollments', format: formatNumber, inverted: false },
  { key: 'leads', label: 'Total Leads', format: formatNumber, inverted: false },
  { key: 'dpl_cash', label: 'DPL (Cash)', format: formatCurrency, inverted: false },
  { key: 'cpa', label: 'Cost to Acquire', format: formatCurrency, inverted: true },
  { key: 'funnel_health', label: 'Funnel Health', format: function(v) { return Math.min(v, 100) + '/100'; }, inverted: false }
];

var KPI_TARGETS = {
  revenue_cash: null,
  ad_spend: null,
  roas_cash: 2.0,
  enrollments: 35,
  leads: 1500,
  dpl_cash: 1500,
  cpa: 5000,
  funnel_health: 70
};

var _revenueChart = null;
var _sparkCharts = {};
var _warRoomData = null;

var TRAFFIC_HEX = {
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
  neutral: '#94a3b8'
};

// ---- Wins / Leaks Signal Definitions ----
var SIGNAL_DEFS = [
  { key: 'revenue_cash', label: 'Revenue', format: formatCurrency, inverted: false },
  { key: 'ad_spend', label: 'Ad Spend', format: formatCurrency, inverted: true },
  { key: 'roas_cash', label: 'ROAS', format: formatMultiplier, inverted: false },
  { key: 'enrollments', label: 'Enrollments', format: formatNumber, inverted: false },
  { key: 'leads', label: 'Leads', format: formatNumber, inverted: false },
  { key: 'dpl_cash', label: 'DPL', format: formatCurrency, inverted: false },
  { key: 'cpa', label: 'CPA', format: formatCurrency, inverted: true },
  { key: 'funnel_health', label: 'Funnel Health', format: function(v) { return Math.round(v) + '/100'; }, inverted: false }
];

function detectSignals(kpis) {
  var wins = [];
  var leaks = [];

  SIGNAL_DEFS.forEach(function(def) {
    var m = kpis[def.key];
    if (!m || !m.prior || m.prior === 0) return;

    var change = (m.value - m.prior) / Math.abs(m.prior);
    var pct = Math.abs(change * 100).toFixed(1);
    var isPositive = def.inverted ? change < 0 : change > 0;
    var isNegative = def.inverted ? change > 0 : change < 0;
    var magnitude = Math.abs(change);

    var text = def.label + ' at <span class="signal-value">' + def.format(m.value) + '</span>';

    if (isPositive && magnitude > 0.03) {
      if (def.inverted) {
        text += ' (down ' + pct + '% vs prior)';
      } else {
        text += ' (up ' + pct + '% vs prior)';
      }
      wins.push({ text: text, magnitude: magnitude });
    } else if (isNegative && magnitude > 0.03) {
      if (def.inverted) {
        text += ' (up ' + pct + '% vs prior)';
      } else {
        text += ' (down ' + pct + '% vs prior)';
      }
      leaks.push({ text: text, magnitude: magnitude });
    }
  });

  // Also check calls data if available
  // (handled separately since calls aren't in the kpis object)

  wins.sort(function(a, b) { return b.magnitude - a.magnitude; });
  leaks.sort(function(a, b) { return b.magnitude - a.magnitude; });

  return { wins: wins.slice(0, 4), leaks: leaks.slice(0, 4) };
}

function renderWinsLeaks(kpis, calls) {
  var signals = detectSignals(kpis);

  // Add calls-specific signals
  if (calls) {
    if (calls.close_rate && calls.prior_close_rate) {
      var crChange = (calls.close_rate - calls.prior_close_rate) / calls.prior_close_rate;
      var crPct = Math.abs(crChange * 100).toFixed(1);
      var crText = 'Close rate at <span class="signal-value">' + (calls.close_rate * 100).toFixed(1) + '%</span>';
      if (crChange > 0.03) {
        signals.wins.push({ text: crText + ' (up ' + crPct + '% vs prior)', magnitude: Math.abs(crChange) });
      } else if (crChange < -0.03) {
        signals.leaks.push({ text: crText + ' (down ' + crPct + '% vs prior)', magnitude: Math.abs(crChange) });
      }
    }
    if (calls.noshow_rate && calls.prior_noshow_rate) {
      var nsChange = (calls.noshow_rate - calls.prior_noshow_rate) / calls.prior_noshow_rate;
      var nsPct = Math.abs(nsChange * 100).toFixed(1);
      var nsText = 'No-show rate at <span class="signal-value">' + (calls.noshow_rate * 100).toFixed(1) + '%</span>';
      if (nsChange > 0.03) {
        signals.leaks.push({ text: nsText + ' (up ' + nsPct + '% vs prior)', magnitude: Math.abs(nsChange) });
      } else if (nsChange < -0.03) {
        signals.wins.push({ text: nsText + ' (down ' + nsPct + '% vs prior)', magnitude: Math.abs(nsChange) });
      }
    }

    // Re-sort and trim after adding calls signals
    signals.wins.sort(function(a, b) { return b.magnitude - a.magnitude; });
    signals.leaks.sort(function(a, b) { return b.magnitude - a.magnitude; });
    signals.wins = signals.wins.slice(0, 4);
    signals.leaks = signals.leaks.slice(0, 4);
  }

  var winsList = document.getElementById('wins-list');
  var leaksList = document.getElementById('leaks-list');
  if (!winsList || !leaksList) return;

  winsList.innerHTML = '';
  leaksList.innerHTML = '';

  if (signals.wins.length === 0) {
    winsList.innerHTML = '<li style="color:var(--text-muted)">No significant wins detected</li>';
  } else {
    signals.wins.forEach(function(w) {
      var li = document.createElement('li');
      li.innerHTML = w.text;
      winsList.appendChild(li);
    });
  }

  if (signals.leaks.length === 0) {
    leaksList.innerHTML = '<li style="color:var(--text-muted)">No significant leaks detected</li>';
  } else {
    signals.leaks.forEach(function(l) {
      var li = document.createElement('li');
      li.innerHTML = l.text;
      leaksList.appendChild(li);
    });
  }
}

function renderChannelBreakdown(channels) {
  var container = document.getElementById('channel-bars');
  if (!container || !channels) return;
  container.innerHTML = '';

  var maxCalls = 0;
  channels.forEach(function(ch) { if (ch.calls > maxCalls) maxCalls = ch.calls; });
  var totalCalls = 0;
  channels.forEach(function(ch) { totalCalls += ch.calls; });

  channels.forEach(function(ch) {
    var pct = totalCalls > 0 ? (ch.calls / totalCalls * 100).toFixed(0) : 0;
    var widthPct = maxCalls > 0 ? (ch.calls / maxCalls * 100) : 0;

    var row = document.createElement('div');
    row.className = 'channel-bar-row';
    row.innerHTML =
      '<div class="channel-bar-row__label">' + ch.channel + '</div>' +
      '<div class="channel-bar-row__track">' +
        '<div class="channel-bar-row__fill" style="width:' + widthPct + '%;background:' + ch.color + ';"></div>' +
      '</div>' +
      '<div class="channel-bar-row__count">' + ch.calls + '</div>' +
      '<div class="channel-bar-row__pct">' + pct + '%</div>';
    container.appendChild(row);
  });
}

function renderCallsKPIs(calls) {
  if (!calls) return;

  var crVal = document.getElementById('close-rate-val');
  var crDelta = document.getElementById('close-rate-delta');
  var nsVal = document.getElementById('noshow-rate-val');
  var nsDelta = document.getElementById('noshow-rate-delta');
  var tcVal = document.getElementById('total-calls-val');
  var tcDelta = document.getElementById('total-calls-delta');

  if (crVal) crVal.textContent = (calls.close_rate * 100).toFixed(1) + '%';
  if (nsVal) nsVal.textContent = (calls.noshow_rate * 100).toFixed(1) + '%';
  if (tcVal) tcVal.textContent = calls.total;

  // Close rate delta (higher is better)
  if (crDelta && calls.prior_close_rate) {
    var crInfo = getDeltaInfo(calls.close_rate, calls.prior_close_rate, false);
    crDelta.className = 'calls-kpi__delta ' + crInfo.class;
    crDelta.textContent = crInfo.text;
  }

  // No-show rate delta (lower is better = inverted)
  if (nsDelta && calls.prior_noshow_rate) {
    var nsInfo = getDeltaInfo(calls.noshow_rate, calls.prior_noshow_rate, true);
    nsDelta.className = 'calls-kpi__delta ' + nsInfo.class;
    nsDelta.textContent = nsInfo.text;
  }

  // Total calls delta
  if (tcDelta && calls.prior_total) {
    var tcInfo = getDeltaInfo(calls.total, calls.prior_total, false);
    tcDelta.className = 'calls-kpi__delta ' + tcInfo.class;
    tcDelta.textContent = tcInfo.text;
  }

  // Color the values based on performance
  if (crVal) {
    crVal.style.color = calls.close_rate >= 0.25 ? '#22c55e' : calls.close_rate >= 0.15 ? '#f59e0b' : '#ef4444';
  }
  if (nsVal) {
    nsVal.style.color = calls.noshow_rate <= 0.25 ? '#22c55e' : calls.noshow_rate <= 0.35 ? '#f59e0b' : '#ef4444';
  }
}

function initWarRoom() {
  if (document.body.dataset.page !== 'war-room') return;

  fetchPageData('war-room').then(function(data) {
    if (!data) {
      var content = document.querySelector('.page-content');
      if (content) {
        content.innerHTML = '<p style="color:var(--status-down);padding:32px;">Failed to load War Room data. Refresh the page or check the browser console for details.</p>';
      }
      return;
    }

    _warRoomData = data;
    renderWinsLeaks(data.kpis, data.calls);
    renderKPIs(data);
    renderChannelBreakdown(data.channel_breakdown);
    renderCallsKPIs(data.calls);
    renderRevenueChart(data.daily_trend);
    renderWeeklyTable(data.weekly_summary);

    document.addEventListener('dateRangeChanged', function(e) {
      var from = e.detail.from;
      var to = e.detail.to;
      var filtered = data.daily_trend.filter(function(d) {
        return d.date >= from && d.date <= to;
      });
      updateRevenueChart(filtered);
    });
  });
}

function getKPITarget(key, metric) {
  var target = KPI_TARGETS[key];
  if (target != null) return target;
  return metric.target;
}

function renderKPIs(data) {
  var grid = document.getElementById('kpi-grid');
  if (!grid) return;
  grid.innerHTML = '';

  KPI_CONFIG.forEach(function(kpi) {
    var metric = data.kpis[kpi.key];
    if (!metric) return;

    var target = getKPITarget(kpi.key, metric);
    var light = getTrafficLightColor(metric.value, target, kpi.inverted);
    var delta = getDeltaInfo(metric.value, metric.prior, kpi.inverted);
    var hexColor = TRAFFIC_HEX[light] || TRAFFIC_HEX.neutral;

    var card = document.createElement('div');
    card.className = 'kpi-card';
    card.setAttribute('data-kpi', kpi.key);
    card.style.borderLeftColor = hexColor;

    card.innerHTML =
      '<div class="kpi-header">' +
        '<span class="kpi-label">' + kpi.label + '</span>' +
        '<span class="traffic-light ' + light + '"></span>' +
      '</div>' +
      '<div class="kpi-value">' + kpi.format(metric.value) + '</div>' +
      '<div class="kpi-delta ' + delta.class + '">' + delta.text + '</div>' +
      '<div class="kpi-sparkline"><canvas id="spark-' + kpi.key + '" height="40"></canvas></div>';

    grid.appendChild(card);
  });

  renderSparklines(data);
}

function renderSparklines(data) {
  KPI_CONFIG.forEach(function(kpi) {
    var canvas = document.getElementById('spark-' + kpi.key);
    if (!canvas) return;

    var sparkData = data.sparklines[kpi.key];
    if (!sparkData || !sparkData.length) return;

    var metric = data.kpis[kpi.key];
    var target = getKPITarget(kpi.key, metric);
    var light = getTrafficLightColor(metric.value, target, kpi.inverted);
    var hexColor = TRAFFIC_HEX[light] || TRAFFIC_HEX.neutral;

    if (_sparkCharts[kpi.key]) {
      _sparkCharts[kpi.key].destroy();
    }

    _sparkCharts[kpi.key] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: sparkData.map(function(_, i) { return i; }),
        datasets: [{
          data: sparkData,
          borderColor: hexColor,
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        events: [],
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        scales: {
          x: { display: false },
          y: { display: false }
        },
        animation: { duration: 0 }
      }
    });
  });
}

function renderRevenueChart(dailyTrend) {
  var canvas = document.getElementById('revenue-chart');
  if (!canvas) return;

  var labels = dailyTrend.map(function(d) { return d.date; });
  var revenue = dailyTrend.map(function(d) { return d.revenue; });
  var spend = dailyTrend.map(function(d) { return d.spend; });

  _revenueChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Revenue',
          data: revenue,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.1)',
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5,
          tension: 0.2,
          fill: false
        },
        {
          label: 'Ad Spend',
          data: spend,
          borderColor: '#ef4444',
          borderDash: [6, 3],
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return ctx.dataset.label + ': ' + formatCurrency(ctx.parsed.y);
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', maxTicksLimit: 10 },
          grid: { color: 'rgba(30,41,59,0.5)' }
        },
        y: {
          ticks: {
            color: '#64748b',
            callback: function(value) { return formatCurrency(value); }
          },
          grid: { color: 'rgba(30,41,59,0.5)' }
        }
      }
    }
  });
}

function updateRevenueChart(filteredTrend) {
  if (!_revenueChart) {
    renderRevenueChart(filteredTrend);
    return;
  }

  _revenueChart.data.labels = filteredTrend.map(function(d) { return d.date; });
  _revenueChart.data.datasets[0].data = filteredTrend.map(function(d) { return d.revenue; });
  _revenueChart.data.datasets[1].data = filteredTrend.map(function(d) { return d.spend; });
  _revenueChart.update();
}

function renderWeeklyTable(weeklySummary) {
  var tbody = document.getElementById('weekly-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  weeklySummary.forEach(function(row) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + row.day + '</td>' +
      '<td class="mono">' + formatCurrency(row.revenue) + '</td>' +
      '<td class="mono">' + formatCurrency(row.spend) + '</td>' +
      '<td class="mono">' + formatMultiplier(row.roas) + '</td>' +
      '<td class="mono">' + row.leads + '</td>' +
      '<td class="mono">' + row.bookings + '</td>' +
      '<td class="mono">' + row.enrolls + '</td>';
    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(initWarRoom, 50);
});
