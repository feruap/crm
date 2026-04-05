(function () {
  'use strict';

  var STORAGE_KEY = 'amunet_visitor';
  var MAX_PAGES = 15;

  function getData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveData(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

  var config = window.amunetTrackerConfig || {};
  var apiUrl = config.apiUrl || '/wp-json/amunet-crm/v1';
  var nonce = config.nonce || '';

  // ── Capture UTMs on landing ───────────────────────────────────────────
  var params = new URLSearchParams(window.location.search);
  var data = getData();

  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
    var val = params.get(key);
    if (val) data[key] = val;
  });

  // Capture referrer and landing page (first visit only)
  if (!data.landing_page) {
    data.landing_page = window.location.pathname + window.location.search;
    data.referrer = document.referrer || '';
  }

  // ── Track page visit ──────────────────────────────────────────────────
  if (!data.pages) data.pages = [];
  var page = {
    url: window.location.pathname,
    title: document.title.substring(0, 100),
    ts: Date.now()
  };

  // Detect WooCommerce product page
  if (document.body.classList.contains('single-product')) {
    var prodEl = document.querySelector('.product_title');
    if (prodEl) page.product = prodEl.textContent.trim();

    // Also capture price if available
    var priceEl = document.querySelector('.summary .woocommerce-Price-amount');
    if (priceEl) page.price = priceEl.textContent.trim();

    // Capture SKU
    var skuEl = document.querySelector('.sku');
    if (skuEl) page.sku = skuEl.textContent.trim();
  }

  // Detect WooCommerce category page
  if (document.body.classList.contains('tax-product_cat')) {
    var catHeader = document.querySelector('.woocommerce-products-header__title');
    if (catHeader) page.category = catHeader.textContent.trim();
  }

  data.pages.push(page);
  if (data.pages.length > MAX_PAGES) data.pages = data.pages.slice(-MAX_PAGES);

  // Build unique products visited list
  var seen = {};
  data.products_visited = data.pages.filter(function (p) {
    if (!p.product || seen[p.product]) return false;
    seen[p.product] = true;
    return true;
  }).map(function (p) { return p.product; });

  // Ensure cookie ID
  if (!data.cookie_id) {
    data.cookie_id = 'av_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
  }

  saveData(data);

  // ── Intercept WhatsApp links to add product context ───────────────────
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!link) return;

    var d = getData();
    var products = (d.products_visited || []).slice(0, 3).join(', ');
    if (!products) return;

    var msg = 'Hola, estoy interesado en ' + products + '.';
    var source = d.utm_source ? ' (via ' + d.utm_source + ')' : '';
    msg += source;

    try {
      var url = new URL(link.href);
      var existingText = url.searchParams.get('text') || '';
      if (!existingText.includes(products)) {
        url.searchParams.set('text', msg);
        link.href = url.toString();
      }
    } catch (err) { /* ignore malformed URLs */ }
  });

  // ── Send tracking data to REST API ────────────────────────────────────
  if (data.products_visited && data.products_visited.length > 0) {
    var headers = { 'Content-Type': 'application/json' };
    if (nonce) headers['X-WP-Nonce'] = nonce;

    fetch(apiUrl + '/track', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        cookie_id: data.cookie_id,
        utm_source: data.utm_source || '',
        utm_medium: data.utm_medium || '',
        utm_campaign: data.utm_campaign || '',
        utm_content: data.utm_content || '',
        utm_term: data.utm_term || '',
        products_visited: data.products_visited,
        pages: data.pages.slice(-5),
        referrer: data.referrer || '',
        landing_page: data.landing_page || ''
      })
    }).catch(function () { /* silent fail */ });
  }
})();
