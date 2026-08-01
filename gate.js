/* بوابة الدخول — يمنع تصفح الصفحات قبل تسجيل الدخول أو إنشاء حساب */
(function () {
  try {
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (!page || page === '/') page = 'index.html';
    var loggedIn = !!localStorage.getItem('hci_token');

    // ملفات تحقق قوقل وغيرها — عامة بدون دخول
    if (/^google[a-z0-9]+\.html$/i.test(page)) return;

    if (page === 'auth.html') {
      if (loggedIn) location.replace('index.html');
      return;
    }

    if (!loggedIn) location.replace('auth.html');
  } catch (e) {
    /* تجاهل */
  }
})();
