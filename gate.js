/* بوابة الدخول — صيانة عامة، ثم الصفحات بعد تسجيل الدخول */
(function () {
  try {
    /* ===== وضع الصيانة =====
       true  = الزوار يرون صفحة الصيانة فقط
       false = الموقع يعمل طبيعياً
       للدخول أنت وأنت تجرب: أضف ?open=1 لأي رابط
       لإلغاء التجاوز: ?open=0
    */
    var MAINTENANCE_MODE = false;

    var theme = localStorage.getItem('hci_theme') || 'dark';
    /* الوضع الفاتح تحت الصيانة */
    if (theme === 'light') theme = 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('hci_theme', theme); } catch (e) { /* */ }

    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (!page || page === '/' || page === '') page = 'index.html';
    var loggedIn = !!localStorage.getItem('hci_token');
    var search = location.search || '';

    // ملفات تحقق قوقل
    if (/^google[a-z0-9]+\.html$/i.test(page)) return;

    // تفعيل / إلغاء تجاوز الصيانة للمطوّر
    if (/(?:\?|&)open=1(?:&|$)/.test(search)) {
      try { localStorage.setItem('hci_maint_bypass', '1'); } catch (e) { /* */ }
    }
    if (/(?:\?|&)open=0(?:&|$)/.test(search)) {
      try { localStorage.removeItem('hci_maint_bypass'); } catch (e) { /* */ }
    }

    var bypass = false;
    try { bypass = localStorage.getItem('hci_maint_bypass') === '1'; } catch (e) { bypass = false; }

    if (MAINTENANCE_MODE) {
      if (page === 'maintenance.html') return;
      if (bypass) {
        /* المطوّر يكمّل لباقي قواعد البوابة */
      } else {
        location.replace('maintenance.html');
        return;
      }
    }

    // صفحات عامة يفهرسها قوقل باسم HCI (بدون تسجيل)
    var publicPages = {
      'index.html': true,
      'auth.html': true,
      'intro.html': true,
      'glossary.html': true,
      'maintenance.html': true,
      /* معاينة الشهادة للتصميم فقط عبر ?preview=1 */
      'certificate.html': /(?:\?|&)preview=1(?:&|$)/.test(search)
    };

    if (publicPages[page]) {
      if (page === 'auth.html' && loggedIn) location.replace('index.html');
      return;
    }

    // باقي المنصة تحتاج حساب
    if (!loggedIn) location.replace('auth.html');
  } catch (e) {
    /* تجاهل */
  }
})();
