// COD Command Center - Sales Scoreboard Page
// Renders closer leaderboard, call dispositions, close rate trends, closer detail card

var CLOSER_COLORS = ['#38bdf8', '#22c55e', '#facc15', '#a78bfa', '#f87171', '#fb923c'];

var DISPOSITION_COLORS = {
  enrolled: '#22c55e',
  follow_up: '#38bdf8',
  no_sale: '#f59e0b',
  no_show: '#ef4444',
  cancelled: '#475569'
};

var DISPOSITION_LABELS = {
  enrolled: 'Enrolled',
  follow_up: 'Follow Up',
  no_sale: 'No Sale',
  no_show: 'No Show',
  cancelled: 'Cancelled'
};

var _dispositionsChart = null;
var _closeRateChart = null;
var _scoreboardData = null;
var _currentSort = { column: 'dpl_cash', direction: 'desc' };
var _selectedCloser = null;

function initSalesScoreboard() {
  if (document.body.dataset.page !== 'sales-scoreboard') return;

  fetchPageData('sales-scoreboard').then(function(data) {
    if (!data) {
      var content = document.querySelector('.page-content');
      if (content) {
        content.innerHTML = '<p style="color:var(--status-down);padding:32px;">Failed to load Sales Scoreboard data. Refresh the page or check the browser console for details.</p>';
      }
      return;
    }

    _scoreboardData = data;
    initCloserFilter(data);
    renderLeaderboard(data.leaderboard, _selectedCloser);
    initSortableHeaders();
    renderDispositionsChart(data.dispositions, _selectedCloser);
    renderCloseRateChart(data.close_rate_trend, data.leaderboard, _selectedCloser);

    document.addEventListener('dateRangeChanged', function(e) {
      console.log('Sales Scoreboard: dateRangeChanged received', e.detail);
    });
  });
}

function initCloserFilter(data) {
  var select = document.getElementById('closer-select');
  if (!select) return;

  // Populate options from leaderboard names (alphabetical)
  var names = data.leaderboard.map(function(c) { return c.closer; }).sort();
  names.forEach(function(name) {
    var opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });

  // Read URL param ?closer=
  var params = new URLSearchParams(window.location.search);
  var closerParam = params.get('closer');
  if (closerParam) {
    var slug = closerParam.toLowerCase().replace(/-/g, ' ');
    var match = data.leaderboard.find(function(c) {
      return c.closer.toLowerCase() === slug || c.closer.toLowerCase() === closerParam.toLowerCase();
    });
    if (match) {
      _selectedCloser = match.closer;
      select.value = match.closer;
    }
  }

  select.addEventListener('change', function() {
    var val = this.value || null;
    filterToCloser(val);
    // Update URL without reload
    var url = new URL(window.location);
    if (val) {
      url.searchParams.set('closer', val);
    } else {
      url.searchParams.delete('closer');
    }
    history.replaceState(null, '', url);
  });
}

function filterToCloser(closerName) {
  _selectedCloser = closerName;

  var sorted = sortLeaderboard(_scoreboardData.leaderboard, _currentSort.column, _currentSort.direction);
  renderLeaderboard(sorted, closerName);
  renderDispositionsChart(_scoreboardData.dispositions, closerName);
  renderCloseRateChart(_scoreboardData.close_rate_trend, _scoreboardData.leaderboard, closerName);

  if (closerName) {
    renderCloserDetail(closerName);
  } else {
    var detail = document.getElementById('closer-detail');
    if (detail) detail.style.display = 'none';
  }
}

function renderLeaderboard(leaderboardData, selectedCloser) {
  var tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Check if URL has closer param (sales audience mode = redact others)
  var params = new URLSearchParams(window.location.search);
  var isFiltered = !!params.get('closer');

  leaderboardData.forEach(function(closer, idx) {
    var rank = idx + 1;
    var isSelected = selectedCloser && closer.closer === selectedCloser;
    var shouldRedact = isFiltered && selectedCloser && closer.closer !== selectedCloser;

    var tr = document.createElement('tr');
    if (isSelected) tr.style.background = 'rgba(56, 189, 248, 0.08)';
    tr.style.cursor = 'pointer';

    // Rank styling
    var rankStyle = '';
    if (rank === 1) rankStyle = 'color:#facc15;font-weight:700;';
    else if (rank <= 3) rankStyle = 'color:#38bdf8;font-weight:700;';

    var redacted = '<span class="redacted">---</span>';

    tr.innerHTML =
      '<td style="' + rankStyle + '">#' + rank + '</td>' +
      '<td>' + closer.closer + '</td>' +
      '<td class="mono">' + (shouldRedact ? redacted : formatCurrency(closer.dpl_cash)) + '</td>' +
      '<td class="mono">' + (shouldRedact ? redacted : formatCurrency(closer.dpl_contract)) + '</td>' +
      '<td class="mono">' + (shouldRedact ? redacted : formatPercent(closer.close_rate)) + '</td>' +
      '<td class="mono">' + (shouldRedact ? redacted : formatPercent(closer.show_rate)) + '</td>' +
      '<td class="mono">' + (shouldRedact ? redacted : formatNumber(closer.total_calls)) + '</td>' +
      '<td class="mono">' + (shouldRedact ? redacted : formatNumber(closer.enrollments)) + '</td>' +
      '<td class="mono">' + (shouldRedact ? redacted : formatCurrency(closer.cash_collected)) + '</td>';

    // Click row to filter
    (function(name) {
      tr.addEventListener('click', function() {
        var select = document.getElementById('closer-select');
        if (select) {
          select.value = (_selectedCloser === name) ? '' : name;
          select.dispatchEvent(new Event('change'));
        }
      });
    })(closer.closer);

    tbody.appendChild(tr);
  });
}

function sortLeaderboard(data, column, direction) {
  return data.slice().sort(function(a, b) {
    var aVal = a[column] || 0;
    var bVal = b[column] || 0;
    if (direction === 'asc') return aVal - bVal;
    return bVal - aVal;
  });
}

function initSortableHeaders() {
  var headers = document.querySelectorAll('.data-table th.sortable');
  headers.forEach(function(th) {
    th.addEventListener('click', function() {
      var column = this.getAttribute('data-column');
      if (_currentSort.column === column) {
        _currentSort.direction = _currentSort.direction === 'desc' ? 'asc' : 'desc';
      } else {
        _currentSort.column = column;
        _currentSort.direction = 'desc';
      }

      // Update header classes
      headers.forEach(function(h) {
        h.classList.remove('asc', 'desc');
      });
      this.classList.add(_currentSort.direction);

      // Re-render
      var sorted = sortLeaderboard(_scoreboardData.leaderboard, _currentSort.column, _currentSort.direction);
      renderLeaderboard(sorted, _selectedCloser);
    });
  });
}

function renderDispositionsChart(dispositions, selectedCloser) {
  var canvas = document.getElementById('dispositions-chart');
  if (!canvas) return;

  if (_dispositionsChart) {
    _dispositionsChart.destroy();
  }

  var labels = dispositions.map(function(d) { return d.closer; });
  var categories = ['enrolled', 'follow_up', 'no_sale', 'no_show', 'cancelled'];

  var datasets = categories.map(function(cat) {
    return {
      label: DISPOSITION_LABELS[cat],
      data: dispositions.map(function(d) { return d[cat]; }),
      backgroundColor: dispositions.map(function(d) {
        if (selectedCloser && d.closer !== selectedCloser) {
          return DISPOSITION_COLORS[cat] + '4D'; // 30% opacity
        }
        return DISPOSITION_COLORS[cat];
      }),
      stack: 'dispositions'
    };
  });

  _dispositionsChart = new Chart(canvas, {
    type: 'bar',
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
              return ctx.dataset.label + ': ' + ctx.parsed.y;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: '#94a3b8' },
          grid: { color: '#1e293b' }
        },
        y: {
          stacked: true,
          ticks: { color: '#64748b' },
          grid: { color: 'rgba(30,41,59,0.5)' }
        }
      }
    }
  });
}

function renderCloseRateChart(trendData, leaderboard, selectedCloser) {
  var canvas = document.getElementById('close-rate-chart');
  if (!canvas || !trendData || !trendData.length) return;

  if (_closeRateChart) {
    _closeRateChart.destroy();
  }

  var labels = trendData.map(function(w) { return w.week; });
  var closerNames = leaderboard.map(function(c) { return c.closer; });

  var datasets = closerNames.map(function(name, idx) {
    var color = CLOSER_COLORS[idx % CLOSER_COLORS.length];
    var isSelected = selectedCloser && name === selectedCloser;
    var isDimmed = selectedCloser && name !== selectedCloser;

    return {
      label: name,
      data: trendData.map(function(w) { return w[name]; }),
      borderColor: isDimmed ? color + '4D' : color,
      borderWidth: isSelected ? 3 : (isDimmed ? 1 : 2),
      pointRadius: isSelected ? 3 : (isDimmed ? 0 : 2),
      pointHoverRadius: 5,
      tension: 0.3,
      fill: false
    };
  });

  _closeRateChart = new Chart(canvas, {
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

function renderCloserDetail(closerName) {
  var detail = document.getElementById('closer-detail');
  if (!detail) return;

  var closer = null;
  for (var i = 0; i < _scoreboardData.leaderboard.length; i++) {
    if (_scoreboardData.leaderboard[i].closer === closerName) {
      closer = _scoreboardData.leaderboard[i];
      break;
    }
  }

  if (!closer) {
    detail.style.display = 'none';
    return;
  }

  detail.style.display = '';
  var avg = _scoreboardData.team_averages;

  var stats = [
    { label: 'DPL Cash', value: formatCurrency(closer.dpl_cash), vs: vsAvg(closer.dpl_cash, avg.dpl_cash) },
    { label: 'DPL Contract', value: formatCurrency(closer.dpl_contract), vs: vsAvg(closer.dpl_contract, avg.dpl_contract) },
    { label: 'Close Rate', value: formatPercent(closer.close_rate), vs: vsAvgPp(closer.close_rate, avg.close_rate) },
    { label: 'Show Rate', value: formatPercent(closer.show_rate), vs: vsAvgPp(closer.show_rate, avg.show_rate) },
    { label: 'Total Calls', value: formatNumber(closer.total_calls), vs: vsAvg(closer.total_calls, avg.total_calls) },
    { label: 'Enrollments', value: formatNumber(closer.enrollments), vs: vsAvg(closer.enrollments, avg.enrollments) }
  ];

  var html = '<div class="closer-name">' + closer.closer + '</div>';
  stats.forEach(function(stat) {
    html +=
      '<div class="stat-pair">' +
        '<div class="stat-label">' + stat.label + '</div>' +
        '<div class="stat-value">' + stat.value + '</div>' +
        '<div class="stat-vs-avg ' + stat.vs.cls + '">vs Team Avg: ' + stat.vs.text + '</div>' +
        '<div class="stat-sparkline"></div>' +
      '</div>';
  });

  detail.innerHTML = html;
}

function vsAvg(value, avg) {
  if (!avg) return { cls: 'neutral', text: '--' };
  var diff = ((value - avg) / avg * 100).toFixed(1);
  var isAbove = value > avg;
  return {
    cls: isAbove ? 'above' : 'below',
    text: (isAbove ? '+' : '') + diff + '%'
  };
}

function vsAvgPp(value, avg) {
  if (!avg) return { cls: 'neutral', text: '--' };
  var diff = ((value - avg) * 100).toFixed(1);
  var isAbove = value > avg;
  return {
    cls: isAbove ? 'above' : 'below',
    text: (isAbove ? '+' : '') + diff + 'pp'
  };
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(initSalesScoreboard, 50);
});
