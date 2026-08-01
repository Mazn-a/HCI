/* بوابة الدخول — الصفحات العامة للفهرسة، والمسارات بعد تسجيل الدخول */
(function () {
  try {
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (!page || page === '/' || page === '') page = 'index.html';
    var loggedIn = !!localStorage.getItem('hci_token');

    // ملفات تحقق قوقل
    if (/^google[a-z0-9]+\.html$/i.test(page)) return;

    // صفحات عامة يفهرسها قوقل باسم HCI (بدون تسجيل)
    var publicPages = {
      'index.html': true,
      'auth.html': true,
      'intro.html': true,
      'glossary.html': true
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
