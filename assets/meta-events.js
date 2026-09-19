/* Meta Pixel standard events for apexmarketing.co.il
   - Contact: any click on a WhatsApp (wa.me), mailto: or tel: link
   - ViewContent: service / content pages (not home, about, legal)
   Requires the base pixel snippet (fbq init + PageView) on the page. */
(function () {
  function track(name, params) {
    if (typeof window.fbq === 'function') window.fbq('track', name, params || {});
  }

  function pageName() {
    var t = (document.title || '').split('|')[0].trim();
    if (t) return t.slice(0, 80);
    try { return decodeURIComponent(location.pathname); } catch (e) { return location.pathname; }
  }

  // Contact on WhatsApp / email / phone clicks (delegated, works for every page and button)
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var label = (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    var channel = null;
    if (/wa\.me|whatsapp/i.test(href)) channel = 'whatsapp';
    else if (/^mailto:/i.test(href)) channel = 'email';
    else if (/^tel:/i.test(href)) channel = 'phone';
    if (!channel) return;
    track('Contact', {
      content_name: label || channel,
      content_category: channel,
      page_name: pageName()
    });
  }, true);

  // ViewContent on service / content pages
  var path;
  try { path = decodeURIComponent(location.pathname); } catch (e) { path = location.pathname; }
  path = path.replace(/^\/+/, '').replace(/\.html$/i, '').replace(/\/+$/, '');
  var skip = /^(|index|אודות|בר-שושן|privacy|terms|accessibility|404)$/;
  if (!skip.test(path)) {
    track('ViewContent', {
      content_name: pageName(),
      content_type: 'service_page',
      content_ids: [path]
    });
  }
})();
