// Analyst Notes Panel -- localStorage persistence, search, sort, export

var _notesPageSlug = null;
var _notes = [];
var _sortOrder = 'newest';
var _searchText = '';

function initNotes() {
  _notesPageSlug = document.body.getAttribute('data-page');
  if (!_notesPageSlug) return;

  // Load existing notes
  _notes = loadNotes();
  updateCount();
  renderNotes();

  // Wire event listeners
  var toggle = document.getElementById('notes-toggle');
  if (toggle) {
    toggle.addEventListener('click', function() {
      var drawer = document.getElementById('notes-drawer');
      if (drawer) drawer.classList.toggle('open');
    });
  }

  var saveBtn = document.getElementById('note-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveNote);

  var exportBtn = document.getElementById('note-export-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportNotes);

  var searchInput = document.getElementById('notes-search');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      _searchText = searchInput.value;
      renderNotes();
    });
  }

  var sortBtn = document.getElementById('notes-sort-btn');
  if (sortBtn) {
    sortBtn.addEventListener('click', function() {
      _sortOrder = _sortOrder === 'newest' ? 'oldest' : 'newest';
      sortBtn.textContent = _sortOrder === 'newest' ? 'Newest first' : 'Oldest first';
      renderNotes();
    });
  }
}

function storageKey() {
  return 'cod-notes-' + _notesPageSlug;
}

function loadNotes() {
  try {
    var raw = localStorage.getItem(storageKey());
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function persistNotes() {
  var data = JSON.stringify(_notes);
  if (data.length > 3200000) {
    var warn = document.getElementById('notes-list');
    if (warn) {
      var banner = document.createElement('p');
      banner.style.cssText = 'color:var(--status-warning);font-size:12px;padding:8px;';
      banner.textContent = 'Storage nearly full -- export and clear old notes.';
      warn.prepend(banner);
    }
  }
  if (data.length < 4000000) {
    localStorage.setItem(storageKey(), data);
  }
}

function generateId() {
  var now = new Date();
  var date = now.toISOString().split('T')[0].replace(/-/g, '');
  var time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  var rand = Math.random().toString(36).substring(2, 6);
  return 'n_' + date + '_' + time + '_' + rand;
}

function formatTimestamp() {
  var now = new Date();
  var date = now.toISOString().split('T')[0];
  var hours = String(now.getHours()).padStart(2, '0');
  var mins = String(now.getMinutes()).padStart(2, '0');
  return date + ' ' + hours + ':' + mins;
}

function saveNote() {
  var textarea = document.getElementById('note-text');
  if (!textarea || !textarea.value.trim()) return;

  var tags = [];
  var checkboxes = document.querySelectorAll('.notes-tag-row input[type="checkbox"]');
  checkboxes.forEach(function(cb) {
    if (cb.checked) tags.push(cb.value);
  });

  var note = {
    id: generateId(),
    timestamp: formatTimestamp(),
    analyst: 'Kas',
    text: textarea.value.trim(),
    tags: tags
  };

  _notes.unshift(note);
  persistNotes();

  // Clear form
  textarea.value = '';
  checkboxes.forEach(function(cb) { cb.checked = false; });

  updateCount();
  renderNotes();
}

function updateCount() {
  var countEl = document.getElementById('notes-count');
  if (countEl) countEl.textContent = _notes.length;
}

function renderNotes() {
  var list = document.getElementById('notes-list');
  if (!list) return;

  // Filter
  var filtered = _notes;
  if (_searchText) {
    var search = _searchText.toLowerCase();
    filtered = _notes.filter(function(note) {
      return note.text.toLowerCase().includes(search);
    });
  }

  // Sort (don't mutate original)
  var sorted = filtered.slice();
  if (_sortOrder === 'oldest') {
    sorted.reverse();
  }

  if (sorted.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted); padding:12px;">No notes yet. Add your first insight above.</p>';
    return;
  }

  var html = '';
  sorted.forEach(function(note) {
    var tagsHtml = '';
    if (note.tags && note.tags.length) {
      note.tags.forEach(function(tag) {
        tagsHtml += '<span class="note-tag tag-' + tag + '">' + tag + '</span>';
      });
    }

    html += '<div class="note-entry">' +
      '<div style="display:flex; justify-content:space-between; margin-bottom:4px;">' +
        '<span style="color:var(--text-muted); font-size:12px;">[' + note.timestamp + '] ' + note.analyst + '</span>' +
        '<div>' + tagsHtml + '</div>' +
      '</div>' +
      '<p style="color:var(--text-primary); font-size:13px; line-height:1.5; white-space:pre-wrap;">' + escapeHtml(note.text) + '</p>' +
    '</div>';
  });

  list.innerHTML = html;
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function exportNotes() {
  var exportObj = {
    page: _notesPageSlug,
    exported: new Date().toISOString(),
    notes: _notes
  };
  var blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = _notesPageSlug + '-notes.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
