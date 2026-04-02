(function() {
  'use strict';
  var STORAGE_KEY = 'amunet_visitor';
  var MAX_PAGES = 10;

  function getData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e) { return {}; }
  }
  function saveData(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

  // Capture UTMs on landing
  var params = new URLSearchParams(window.location.search);
  var data = getData();
  if (params.get('utm_source')) data.utm_source = params.get('utm_source');
  if (params.get('utm_medium')) data.utm_medium = params.get('utm_medium');
  if (params.get('utm_campaign')) data.utm_campaign = params.get('utm_campaign');

  // Track page visit
  if (!data.pages) data.pages = [];
  var page = { url: window.location.pathname, title: document.title, ts: Date.now() };

  // Detect WooCommerce product page
  if (document.body.classList.contains('single-product')) {
    var prodName = document.querySelector('.product_title');
    if (prodName) page.product = prodName.textContent.trim();
  }

  data.pages.push(page);
  if (data.pages.length > MAX_PAGES) data.pages = data.pages.slice(-MAX_PAGES);

  // Build products visited list
  data.products_visited = data.pages.filter(function(p) { return p.product; }).map(function(p) { return p.product; });
  data.products_visited = data.products_visited.filter(function(v, i, a) { return a.indexOf(v) === i; }); // unique

  saveData(data);

  // Intercept WhatsApp links to add context
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!link) return;
    var d = getData();
    var products = (d.products_visited || []).join(', ');
    var source = d.utm_source || 'web';
    if (products) {
      var msg = 'Hola, estoy interesado en ' + products + '.';
      var url = new URL(link.href);
      var existingText = url.searchParams.get('text') || '';
      if (!existingText.includes(products)) {
        url.searchParams.set('text', msg);
        link.href = url.toString();
      }
    }
  });

  // Send tracking data to WordPress REST API on page load (debounced)
  if (data.products_visited && data.products_visited.length > 0) {
    var cookieId = data.cookie_id || ('av_' + Math.random().toString(36).substr(2, 9));
    data.cookie_id = cookieId;
    saveData(data);
    var apiUrl = (window.amunetTrackerApi || '/wp-json/amunet-tracker/v1') + '/track';
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cookie_id: cookieId,
        utm_source: data.utm_source || '',
        utm_medium: data.utm_medium || '',
        utm_campaign: data.utm_campaign || '',
        products_visited: data.products_visited,
        pages: data.pages.slice(-5)
      })
    }).catch(function() {});
  }
})();
