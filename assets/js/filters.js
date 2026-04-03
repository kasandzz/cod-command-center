// Date range selector with Flatpickr and preset buttons

var EARLIEST_DATE = '2024-01-01';

function yesterday() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function daysAgo(n) {
  var d = new Date();
  d.setDate(d.getDate() - 1 - n);
  return d.toISOString().split('T')[0];
}

function startOfYear() {
  return new Date().getFullYear() + '-01-01';
}

var DATE_PRESETS = {
  '7d':  function() { return { from: daysAgo(7), to: yesterday() }; },
  '30d': function() { return { from: daysAgo(30), to: yesterday() }; },
  '90d': function() { return { from: daysAgo(90), to: yesterday() }; },
  'ytd': function() { return { from: startOfYear(), to: yesterday() }; },
  'all': function() { return { from: EARLIEST_DATE, to: yesterday() }; }
};

var _fpFrom = null;
var _fpTo = null;

function initDatePicker() {
  var filterBar = document.getElementById('filter-bar');
  if (!filterBar) return;

  // Build preset buttons
  var presetsHtml = '';
  var presetLabels = { '7d': '7d', '30d': '30d', '90d': '90d', 'ytd': 'YTD', 'all': 'All' };
  Object.keys(presetLabels).forEach(function(key) {
    presetsHtml += '<button class="btn-preset" data-range="' + key + '">' + presetLabels[key] + '</button>';
  });

  // Date inputs and compare toggle
  filterBar.innerHTML = presetsHtml +
    '<span style="width:1px;height:24px;background:var(--border);margin:0 4px;"></span>' +
    '<input type="text" id="date-from" placeholder="From" style="width:110px;background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:13px;font-family:var(--font-family);">' +
    '<input type="text" id="date-to" placeholder="To" style="width:110px;background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:13px;font-family:var(--font-family);">' +
    '<label class="compare-toggle" style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:13px;cursor:pointer;margin-left:8px;">' +
      '<input type="checkbox" id="compare-toggle"> <span>Compare</span>' +
    '</label>';

  // Init Flatpickr
  _fpFrom = flatpickr('#date-from', { dateFormat: 'Y-m-d', disableMobile: true, maxDate: yesterday() });
  _fpTo = flatpickr('#date-to', { dateFormat: 'Y-m-d', disableMobile: true, maxDate: yesterday() });

  // Read initial state from URL or default to 30d
  var params = new URLSearchParams(window.location.search);
  var activeRange = params.get('range') || '30d';
  var initFrom = params.get('from');
  var initTo = params.get('to');
  var initCompare = params.get('compare') === 'true';

  if (initFrom && initTo) {
    _fpFrom.setDate(initFrom, false);
    _fpTo.setDate(initTo, false);
    // Check if it matches a preset
    var matched = false;
    Object.keys(DATE_PRESETS).forEach(function(key) {
      var range = DATE_PRESETS[key]();
      if (range.from === initFrom && range.to === initTo) {
        activeRange = key;
        matched = true;
      }
    });
    if (!matched) activeRange = null;
  } else {
    var defaultRange = DATE_PRESETS[activeRange]();
    initFrom = defaultRange.from;
    initTo = defaultRange.to;
    _fpFrom.setDate(initFrom, false);
    _fpTo.setDate(initTo, false);
  }

  // Set active preset button
  setActivePreset(activeRange);

  // Compare toggle
  var compareCheckbox = document.getElementById('compare-toggle');
  compareCheckbox.checked = initCompare;

  // Preset button handlers
  var presetBtns = filterBar.querySelectorAll('.btn-preset');
  presetBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var key = btn.getAttribute('data-range');
      var range = DATE_PRESETS[key]();
      _fpFrom.setDate(range.from, false);
      _fpTo.setDate(range.to, false);
      setActivePreset(key);
      applyDateRange(range.from, range.to, compareCheckbox.checked, key);
    });
  });

  // Custom date change handlers
  _fpFrom.config.onChange.push(function(selectedDates) {
    if (selectedDates.length) {
      setActivePreset(null);
      applyDateRange(selectedDates[0].toISOString().split('T')[0], _fpTo.selectedDates[0] ? _fpTo.selectedDates[0].toISOString().split('T')[0] : yesterday(), compareCheckbox.checked, null);
    }
  });

  _fpTo.config.onChange.push(function(selectedDates) {
    if (selectedDates.length) {
      setActivePreset(null);
      applyDateRange(_fpFrom.selectedDates[0] ? _fpFrom.selectedDates[0].toISOString().split('T')[0] : daysAgo(30), selectedDates[0].toISOString().split('T')[0], compareCheckbox.checked, null);
    }
  });

  // Compare toggle handler
  compareCheckbox.addEventListener('change', function() {
    var from = _fpFrom.selectedDates[0] ? _fpFrom.selectedDates[0].toISOString().split('T')[0] : daysAgo(30);
    var to = _fpTo.selectedDates[0] ? _fpTo.selectedDates[0].toISOString().split('T')[0] : yesterday();
    applyDateRange(from, to, compareCheckbox.checked, null);
  });

  // Apply initial range
  applyDateRange(initFrom, initTo, initCompare, activeRange);
}

function setActivePreset(key) {
  var btns = document.querySelectorAll('.btn-preset[data-range]');
  btns.forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-range') === key);
  });
}

function applyDateRange(from, to, compare, rangeKey) {
  var url = new URL(window.location);
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  if (rangeKey) {
    url.searchParams.set('range', rangeKey);
  } else {
    url.searchParams.delete('range');
  }
  if (compare) {
    url.searchParams.set('compare', 'true');
  } else {
    url.searchParams.delete('compare');
  }
  history.replaceState(null, '', url);

  // Compute prior period
  var fromDate = new Date(from);
  var toDate = new Date(to);
  var daysDiff = Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24));
  var priorTo = new Date(fromDate);
  priorTo.setDate(priorTo.getDate() - 1);
  var priorFrom = new Date(priorTo);
  priorFrom.setDate(priorFrom.getDate() - daysDiff);

  var detail = {
    from: from,
    to: to,
    compare: compare,
    priorFrom: priorFrom.toISOString().split('T')[0],
    priorTo: priorTo.toISOString().split('T')[0]
  };

  // localStorage fallback
  localStorage.setItem('cod-date-range', JSON.stringify({ from: from, to: to, compare: compare }));

  // Dispatch event
  document.dispatchEvent(new CustomEvent('dateRangeChanged', { detail: detail }));
}

function getActiveDateRange() {
  var params = new URLSearchParams(window.location.search);
  var from = params.get('from');
  var to = params.get('to');
  var compare = params.get('compare') === 'true';

  if (!from || !to) {
    try {
      var stored = JSON.parse(localStorage.getItem('cod-date-range'));
      if (stored && stored.from && stored.to) {
        from = stored.from;
        to = stored.to;
        compare = !!stored.compare;
      }
    } catch (e) {}
  }

  if (!from || !to) {
    var def = DATE_PRESETS['30d']();
    from = def.from;
    to = def.to;
  }

  var fromDate = new Date(from);
  var toDate = new Date(to);
  var daysDiff = Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24));
  var priorTo = new Date(fromDate);
  priorTo.setDate(priorTo.getDate() - 1);
  var priorFrom = new Date(priorTo);
  priorFrom.setDate(priorFrom.getDate() - daysDiff);

  return {
    from: from,
    to: to,
    compare: compare,
    priorFrom: priorFrom.toISOString().split('T')[0],
    priorTo: priorTo.toISOString().split('T')[0]
  };
}
