// Component injection system for shared HTML fragments

async function injectComponent(mountId, fragmentPath) {
  var mount = document.getElementById(mountId);
  if (!mount) return;
  try {
    var res = await fetch(fragmentPath);
    if (!res.ok) throw new Error('Failed to load ' + fragmentPath + ': ' + res.status);
    mount.innerHTML = await res.text();
  } catch (err) {
    console.error('Component injection failed:', err.message);
    mount.innerHTML = '<p style="color:var(--status-down)">Component failed to load</p>';
  }
}

function highlightCurrentPage() {
  var currentPage = document.body.getAttribute('data-page');
  if (!currentPage) return;
  var links = document.querySelectorAll('.nav-link');
  links.forEach(function(link) {
    if (link.getAttribute('data-page') === currentPage) {
      link.classList.add('active');
    }
  });
}

async function initComponents() {
  var base = '../assets/components/';
  await Promise.all([
    injectComponent('sidebar-mount', base + 'sidebar.html'),
    injectComponent('header-mount', base + 'header.html'),
  ]);
  highlightCurrentPage();
}
