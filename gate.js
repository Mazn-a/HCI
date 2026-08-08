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
    var search = location.search || '';
    var token = localStorage.getItem('hci_token');
    var role = localStorage.getItem('hci_user_role') || '';
    var verifiedFlag = localStorage.getItem('hci_verified') === '1' || role === 'admin';
    if (token && !verifiedFlag) {
      try {
        var sessionUser = JSON.parse(localStorage.getItem('hci_user_json') || 'null');
        if (sessionUser && (sessionUser.emailVerified || sessionUser.phoneVerified || sessionUser.role === 'admin' || sessionUser.pathType)) {
          verifiedFlag = true;
        }
      } catch (e) { /* */ }
    }
    var loggedIn = !!token && verifiedFlag;

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
      'certificate.html': /(?:\?|&)preview=1(?:&|$)/.test(search),
      'verify.html': true
    };

    if (publicPages[page]) {
      if (page === 'auth.html' && loggedIn) location.replace('index.html');
      else if (page === 'auth.html' && token && !verifiedFlag) {
        if (!/(?:\?|&)tab=/.test(search)) location.replace('auth.html?tab=verify');
      }
      return;
    }

    // باقي المنصة تحتاج حساب مكتمل (كلمة مرور + تحقق)
    if (!loggedIn) {
      location.replace(token && !verifiedFlag ? 'auth.html?tab=verify' : 'auth.html');
    }
  } catch (e) {
    /* تجاهل */
  }
})();
