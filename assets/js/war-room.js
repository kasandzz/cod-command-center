// COD Command Center - War Room Page
// Renders KPI cards, revenue trend chart, and weekly summary table

var KPI_CONFIG = [
  { key: 'revenue_cash', label: 'Revenue (Cash)', format: formatCurrency, inverted: false },
  { key: 'ad_spend', label: 'Ad Spend', format: formatCurrency, inverted: true },
  { key: 'roas_cash', label: 'ROAS (Cash)', format: formatMultiplier, inverted: false },
  { key: 'enrollments', label: 'Enrollments', format: formatNumber, inverted: false },
  { key: 'show_rate', label: 'Show Rate', format: formatPercent, inverted: false },
  { key: 'close_rate', label: 'Close Rate', format: formatPercent, inverted: false },
  { key: 'dpl_cash', label: 'DPL (Cash)', format: formatCurrency, inverted: false },
  { key: 'funnel_health', label: 'Funnel Health', format: function(v) { return Math.min(v, 100) + '/100'; }, inverted: false }
];

var KPI_TARGETS = {
  revenue_cash: null,
  ad_spend: null,
  roas_cash: 3.0,
  enrollments: 15,
  show_rate: 0.65,
  close_rate: 0.25,
  dpl_cash: 8000,
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
    renderKPIs(data);
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
      '<td class="mono">' + row.shows + '</td>' +
      '<td class="mono">' + row.enrolls + '</td>';
    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(initWarRoom, 50);
});
