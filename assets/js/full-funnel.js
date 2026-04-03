// COD Command Center - Full Funnel Page
// Interactive Sankey diagram + comprehensive funnel metrics

var TRAFFIC_HEX = {
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
  neutral: '#94a3b8'
};

// Node colors for Sankey
var SANKEY_COLORS = [
  '#ef4444',   // 0  Ad Spend (red - cost)
  '#3b82f6',   // 1  FB Ads
  '#ef4444',   // 2  YT Ads
  '#22c55e',   // 3  Google Ads
  '#38bdf8',   // 4  Ticket Purchases
  '#94a3b8',   // 5  Free Tickets
  '#38bdf8',   // 6  Paid Tickets
  '#facc15',   // 7  VIP Upgrade
  '#a78bfa',   // 8  Email Sequence
  '#38bdf8',   // 9  Workshop Registered
  '#22c55e',   // 10 Workshop Attended
  '#ef4444',   // 11 No-Show (Workshop)
  '#facc15',   // 12 VIP Attended
  '#94a3b8',   // 13 Standard Attended
  '#38bdf8',   // 14 Calls Booked (All)
  '#22c55e',   // 15 Calls Booked (Workshop)
  '#a78bfa',   // 16 Calls Booked (Other)
  '#ef4444',   // 17 Did Not Book
  '#22c55e',   // 18 Call Showed
  '#ef4444',   // 19 No-Show (Call)
  '#f59e0b',   // 20 Cancelled
  '#38bdf8',   // 21 Matt Dakan
  '#22c55e',   // 22 Dorian Matney
  '#facc15',   // 23 Colby Mann
  '#a78bfa',   // 24 Bren Moran
  '#22c55e',   // 25 Enrolled
  '#ef4444',   // 26 No Sale
  '#f59e0b',   // 27 Follow Up
  '#22c55e',   // 28 Cash Collected
  '#38bdf8'    // 29 Contract Value
];

var CONVERSION_CARDS = [
  { key: 'ticket_to_attend', label: 'Ticket to Attend' },
  { key: 'attend_to_book', label: 'Attend to Book' },
  { key: 'book_to_show', label: 'Book to Show' },
  { key: 'show_to_enroll', label: 'Show to Enroll' },
  { key: 'vip_upgrade', label: 'VIP Upgrade Rate' },
  { key: 'overall', label: 'Overall Conversion' }
];

var CONVERSION_COLORS = {
  ticket_to_attend: '#38bdf8',
  attend_to_book: '#22c55e',
  book_to_show: '#facc15',
  show_to_enroll: '#a78bfa',
  vip_upgrade: '#f59e0b',
  overall: '#f8fafc'
};

var _trendChart = null;
var _fullFunnelData = null;

function initFullFunnel() {
  if (document.body.dataset.page !== 'full-funnel') return;

  fetchPageData('full-funnel').then(function(data) {
    if (!data) {
      var content = document.querySelector('.page-content');
      if (content) {
        content.innerHTML = '<p style="color:var(--status-down);padding:32px;">Failed to load Full Funnel data. Refresh the page or check the browser console for details.</p>';
      }
      return;
    }

    _fullFunnelData = data;
    renderSankey(data.sankey);
    renderMetricsGrid(data.metrics);
    renderConversionCards(data.conversion_rates);
    renderConversionTrend(data.weekly_conversions);
    renderComparisonTable(data.funnel_stages);

    document.addEventListener('dateRangeChanged', function(e) {
      console.log('Full Funnel: dateRangeChanged received', e.detail);
    });

    // Segment filter
    var segSelect = document.getElementById('segment-select');
    if (segSelect) {
      segSelect.addEventListener('change', function() {
        renderSegmentOverlay(data.segments, this.value);
      });
    }
  });
}

function renderSegmentOverlay(segments, segmentKey) {
  var overlay = document.getElementById('segment-overlay');
  if (!overlay) return;

  if (segmentKey === 'all') {
    overlay.style.display = 'none';
    return;
  }

  var seg = segments[segmentKey];
  if (!seg) return;
  var all = segments.all;

  overlay.style.display = '';
  var pctOfTotal = function(val, total) {
    return total ? ((val / total) * 100).toFixed(1) + '%' : '--';
  };

  overlay.innerHTML =
    '<div class="closer-name">' + seg.label + ' Segment</div>' +
    '<div class="stat-pair">' +
      '<div class="stat-label">Tickets</div>' +
      '<div class="stat-value">' + formatNumber(seg.tickets) + '</div>' +
      '<div class="stat-vs-avg">' + pctOfTotal(seg.tickets, all.tickets) + ' of total</div>' +
    '</div>' +
    '<div class="stat-pair">' +
      '<div class="stat-label">Attended</div>' +
      '<div class="stat-value">' + formatNumber(seg.attended) + '</div>' +
      '<div class="stat-vs-avg">Show: ' + formatPercent(seg.attended / seg.tickets) + '</div>' +
    '</div>' +
    '<div class="stat-pair">' +
      '<div class="stat-label">Calls Booked</div>' +
      '<div class="stat-value">' + formatNumber(seg.booked) + '</div>' +
      '<div class="stat-vs-avg">Book: ' + formatPercent(seg.booked / seg.attended) + '</div>' +
    '</div>' +
    '<div class="stat-pair">' +
      '<div class="stat-label">Showed</div>' +
      '<div class="stat-value">' + formatNumber(seg.showed) + '</div>' +
      '<div class="stat-vs-avg">Show: ' + formatPercent(seg.showed / seg.booked) + '</div>' +
    '</div>' +
    '<div class="stat-pair">' +
      '<div class="stat-label">Enrolled</div>' +
      '<div class="stat-value">' + formatNumber(seg.enrolled) + '</div>' +
      '<div class="stat-vs-avg">Close: ' + formatPercent(seg.enrolled / seg.showed) + '</div>' +
    '</div>' +
    '<div class="stat-pair">' +
      '<div class="stat-label">Cash Collected</div>' +
      '<div class="stat-value">' + formatCurrency(seg.cash) + '</div>' +
      '<div class="stat-vs-avg">DPL: ' + formatCurrency(seg.enrolled ? seg.cash / seg.enrolled : 0) + '</div>' +
    '</div>';
}

function renderSankey(sankeyData) {
  var container = document.getElementById('sankey-chart');
  if (!container || !sankeyData) return;

  var linkColors = sankeyData.links.map(function(link) {
    var sourceColor = SANKEY_COLORS[link.source] || '#94a3b8';
    // Make link color a semi-transparent version of the source node
    return sourceColor + '40';
  });

  var trace = {
    type: 'sankey',
    orientation: 'h',
    arrangement: 'snap',
    node: {
      pad: 20,
      thickness: 24,
      line: { color: '#1e293b', width: 1 },
      label: sankeyData.nodes,
      color: SANKEY_COLORS,
      hovertemplate: '%{label}<br>%{value}<extra></extra>'
    },
    link: {
      source: sankeyData.links.map(function(l) { return l.source; }),
      target: sankeyData.links.map(function(l) { return l.target; }),
      value: sankeyData.links.map(function(l) { return l.value; }),
      color: linkColors,
      customdata: sankeyData.links.map(function(l) { return l.label; }),
      hovertemplate: '%{customdata}<extra></extra>'
    }
  };

  var layout = {
    paper_bgcolor: '#0f172a',
    plot_bgcolor: '#0f172a',
    font: { color: '#94a3b8', family: 'Inter, sans-serif', size: 11 },
    margin: { l: 10, r: 10, t: 10, b: 10 },
    height: 500
  };

  var config = {
    displayModeBar: false,
    responsive: true
  };

  Plotly.newPlot(container, [trace], layout, config);
}

function renderMetricsGrid(metrics) {
  var grid = document.getElementById('metrics-grid');
  if (!grid) return;

  var cards = [
    { label: 'Ad Spend', value: formatCurrency(metrics.ad_spend.total), sub: 'FB ' + formatCurrency(metrics.ad_spend.fb) + ' | YT ' + formatCurrency(metrics.ad_spend.yt) + ' | G ' + formatCurrency(metrics.ad_spend.google), delta: getDeltaInfo(metrics.ad_spend.total, metrics.ad_spend.prior_total, true) },
    { label: 'Tickets Sold', value: formatNumber(metrics.tickets.total), sub: formatNumber(metrics.tickets.free) + ' free | ' + formatNumber(metrics.tickets.paid) + ' paid | ' + formatNumber(metrics.tickets.vip) + ' VIP', delta: getDeltaInfo(metrics.tickets.total, metrics.tickets.prior_total, false) },
    { label: 'Ticket Revenue', value: formatCurrency(metrics.tickets.ticket_revenue), sub: 'Cost/ticket: ' + formatCurrency(metrics.tickets.cost_per_ticket), delta: null },
    { label: 'VIP Upgrade %', value: formatPercent(metrics.tickets.vip_upgrade_pct), sub: formatNumber(metrics.tickets.vip) + ' of ' + formatNumber(metrics.tickets.total) + ' upgraded', delta: null },
    { label: 'Workshop Show Rate', value: formatPercent(metrics.workshop.show_rate), sub: 'VIP: ' + formatPercent(metrics.workshop.vip_show_rate) + ' | Std: ' + formatPercent(metrics.workshop.standard_show_rate), delta: null },
    { label: 'Attended', value: formatNumber(metrics.workshop.attended), sub: formatNumber(metrics.workshop.vip_attended) + ' VIP | ' + formatNumber(metrics.workshop.standard_attended) + ' standard | ' + formatNumber(metrics.workshop.no_show) + ' no-show', delta: null },
    { label: 'Calls Booked', value: formatNumber(metrics.calls.booked_all), sub: formatNumber(metrics.calls.booked_workshop) + ' workshop | ' + formatNumber(metrics.calls.booked_other) + ' other | Booking: ' + formatPercent(metrics.calls.booking_pct), delta: null },
    { label: 'Cost/Booked Call', value: formatCurrency(metrics.calls.cpb), sub: 'After ticket rev: ' + formatCurrency(metrics.calls.cpb_after_ticket_rev), delta: null },
    { label: 'Call Show Rate', value: formatPercent(metrics.calls.show_rate), sub: formatNumber(metrics.calls.showed) + ' showed | ' + formatNumber(metrics.calls.no_show) + ' no-show | ' + formatNumber(metrics.calls.cancelled) + ' cancelled', delta: null },
    { label: 'Enrollments', value: formatNumber(metrics.enrollment.total), sub: 'Close rate: ' + formatPercent(metrics.enrollment.close_rate), delta: getDeltaInfo(metrics.enrollment.total, metrics.enrollment.prior_total, false) },
    { label: 'Cash Collected', value: formatCurrency(metrics.revenue.cash_collected), sub: 'DPL: ' + formatCurrency(metrics.revenue.dpl_cash), delta: getDeltaInfo(metrics.revenue.cash_collected, metrics.revenue.prior_cash, false) },
    { label: 'Contract Value', value: formatCurrency(metrics.revenue.contract_value), sub: 'DPL: ' + formatCurrency(metrics.revenue.dpl_contract) + ' | ROAS: ' + formatMultiplier(metrics.cost_efficiency.roas_contract), delta: null }
  ];

  grid.innerHTML = '';
  cards.forEach(function(card) {
    var div = document.createElement('div');
    div.className = 'kpi-card';

    var deltaHtml = '';
    if (card.delta) {
      deltaHtml = '<div class="kpi-delta ' + card.delta.class + '">' + card.delta.text + '</div>';
    }

    div.innerHTML =
      '<div class="kpi-label">' + card.label + '</div>' +
      '<div class="kpi-value">' + card.value + '</div>' +
      deltaHtml +
      '<div style="font-size:11px;color:#64748b;margin-top:4px;line-height:1.4;">' + card.sub + '</div>';

    grid.appendChild(div);
  });
}

function renderConversionCards(conversionRates) {
  var grid = document.getElementById('conversion-grid');
  if (!grid) return;
  grid.innerHTML = '';

  CONVERSION_CARDS.forEach(function(cardCfg) {
    var rate = conversionRates[cardCfg.key];
    if (!rate) return;

    var light = getTrafficLightColor(rate.current, rate.target, false);
    var delta = rate.prior ? getDeltaInfo(rate.current, rate.prior, false) : null;
    var hexColor = TRAFFIC_HEX[light] || TRAFFIC_HEX.neutral;

    var card = document.createElement('div');
    card.className = 'kpi-card';
    card.style.borderLeftColor = hexColor;

    var deltaHtml = delta ? '<div class="kpi-delta ' + delta.class + '">' + delta.text + '</div>' : '';

    card.innerHTML =
      '<div class="kpi-header">' +
        '<span class="kpi-label">' + cardCfg.label + '</span>' +
        '<span class="traffic-light ' + light + '"></span>' +
      '</div>' +
      '<div class="kpi-value">' + formatPercent(rate.current) + '</div>' +
      deltaHtml +
      '<div style="font-size:12px;color:#64748b;margin-top:4px;">Target: ' + formatPercent(rate.target) + '</div>';

    grid.appendChild(card);
  });
}

function renderConversionTrend(weeklyData) {
  var canvas = document.getElementById('conversion-trend-chart');
  if (!canvas || !weeklyData || !weeklyData.length) return;

  var labels = weeklyData.map(function(w) { return w.week; });
  var datasets = [];

  CONVERSION_CARDS.forEach(function(cardCfg) {
    var color = CONVERSION_COLORS[cardCfg.key];
    datasets.push({
      label: cardCfg.label,
      data: weeklyData.map(function(w) { return w[cardCfg.key]; }),
      borderColor: color,
      borderWidth: 2,
      pointRadius: 2,
      pointHoverRadius: 5,
      tension: 0.3,
      fill: false
    });
  });

  if (_trendChart) {
    _trendChart.destroy();
  }

  _trendChart = new Chart(canvas, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
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
              return ctx.dataset.label + ': ' + formatPercent(ctx.parsed.y);
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', maxTicksLimit: 8 },
          grid: { color: 'rgba(30,41,59,0.5)' }
        },
        y: {
          ticks: {
            color: '#64748b',
            callback: function(value) { return (value * 100).toFixed(0) + '%'; }
          },
          grid: { color: 'rgba(30,41,59,0.5)' }
        }
      }
    }
  });
}

function renderComparisonTable(stages) {
  var tbody = document.getElementById('comparison-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  var STAGE_CONFIG = [
    { key: 'ad_spend', label: 'Ad Spend', format: formatCurrency, inverted: true },
    { key: 'tickets_sold', label: 'Tickets Sold', format: formatNumber, inverted: false },
    { key: 'vip_upgrades', label: 'VIP Upgrades', format: formatNumber, inverted: false },
    { key: 'workshop_attended', label: 'Workshop Attended', format: formatNumber, inverted: false },
    { key: 'calls_booked', label: 'Calls Booked', format: formatNumber, inverted: false },
    { key: 'calls_showed', label: 'Calls Showed', format: formatNumber, inverted: false },
    { key: 'enrollments', label: 'Enrollments', format: formatNumber, inverted: false },
    { key: 'cash_collected', label: 'Cash Collected', format: formatCurrency, inverted: false },
    { key: 'contract_value', label: 'Contract Value', format: formatCurrency, inverted: false }
  ];

  STAGE_CONFIG.forEach(function(stage) {
    var stageData = stages[stage.key];
    if (!stageData) return;
    var current = stageData.current;
    var prior = stageData.prior;
    var target = stageData.target;
    var deltaPct = prior ? ((current - prior) / prior * 100).toFixed(1) : '0.0';
    var deltaNum = current - prior;
    var isUp = deltaNum > 0;
    var isDown = deltaNum < 0;

    var arrowClass, arrow;
    if (stage.inverted) {
      arrowClass = isUp ? 'down' : (isDown ? 'up' : 'neutral');
    } else {
      arrowClass = isUp ? 'up' : (isDown ? 'down' : 'neutral');
    }
    arrow = isUp ? '\u2191' : (isDown ? '\u2193' : '\u2192');

    var targetLight = getTrafficLightColor(current, target, stage.inverted);
    var targetHex = TRAFFIC_HEX[targetLight] || TRAFFIC_HEX.neutral;

    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + stage.label + '</td>' +
      '<td class="mono">' + stage.format(current) + '</td>' +
      '<td class="mono">' + stage.format(prior) + '</td>' +
      '<td class="mono">' + (isUp ? '+' : '') + deltaPct + '%</td>' +
      '<td><span class="kpi-delta ' + arrowClass + '">' + arrow + '</span></td>' +
      '<td class="mono">' + stage.format(target) + '</td>' +
      '<td><span class="traffic-light ' + targetLight + '"></span></td>';
    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(initFullFunnel, 50);
});
