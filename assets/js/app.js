// App initialization -- runs on every page
document.addEventListener('DOMContentLoaded', async function() {
  // 1. Inject shared components (sidebar, header)
  await initComponents();

  // 2. Initialize date picker in filter bar
  if (typeof initDatePicker === 'function') {
    initDatePicker();
  }

  // 3. Mobile banner visibility
  if (window.innerWidth < 768) {
    var banner = document.querySelector('.mobile-banner');
    if (banner) banner.style.display = 'block';
  }
});
