/* api.js — التواصل مع سيرفر المنصة */
(function () {
  function resolveApiBase() {
    // فتح الملف مباشرة من Finder
    if (location.protocol === 'file:') return 'http://127.0.0.1:3000';
    var host = location.hostname;
    var port = String(location.port || '');
    // معاينة بسيرفر ملفات (مثل python -m http.server) بدون API
    if ((host === 'localhost' || host === '127.0.0.1') && port && port !== '3000') {
      return 'http://127.0.0.1:3000';
    }
    return '';
  }

  var API_BASE = resolveApiBase();

  // لو فتحت الملف مباشرة بدون سيرفر — نوجّه طلبات الـ API للسيرفر المحلي
  // والأفضل تفتح الموقع من: http://localhost:3000
  if (location.protocol === 'file:') {
    API_BASE = 'http://127.0.0.1:3000';
  }

  // تحويل تلقائي من file:// لصفحات تحتاج سيرفر
  if (location.protocol === 'file:') {
    var filePage = (location.pathname.split('/').pop() || '').toLowerCase();
    if (filePage === 'admin.html' || filePage === 'auth.html') {
      // ما نعمل redirect قسري هنا — admin.js يوجّه بوضوح
    }
  }

  function getToken() {
    return localStorage.getItem('hci_token') || '';
  }

  function setSession(token, user, opts) {
    if (token) localStorage.setItem('hci_token', token);
    if (user) {
      localStorage.setItem('hci_user_name', user.fullName || (user.firstName + ' ' + user.lastName));
      localStorage.setItem('hci_user_id', String(user.id));
      localStorage.setItem('hci_user_role', user.role || 'student');
      try {
        if (user.avatar) localStorage.setItem('hci_avatar', user.avatar);
        else if (user.hasOwnProperty('avatar') && !user.avatar) localStorage.removeItem('hci_avatar');
      } catch (e) { /* */ }
      /* لا نخزّن الصورة داخل JSON المستخدم — تبقى في hci_avatar فقط */
      var slim = Object.assign({}, user);
      if (slim.avatar) {
        slim.hasAvatar = true;
        slim.avatar = null;
      }
      localStorage.setItem('hci_user_json', JSON.stringify(slim));
      if (user.pathType) localStorage.setItem('hci_path_type', user.pathType);
      else localStorage.removeItem('hci_path_type');
      if (user.isPreview) {
        try { localStorage.setItem('hci_is_preview', '1'); } catch (e) { /* */ }
        /* صفّر التقدّم عند تسجيل الدخول فقط — لا عند كل /me وإلا تُمسح القراءة */
        if (opts && opts.resetPreview) clearLocalProgress();
      } else {
        try { localStorage.removeItem('hci_is_preview'); } catch (e) { /* */ }
      }
      var unlocked = (opts && opts.siteUnlock) ||
        user.role === 'admin' || !!user.emailVerified || !!user.phoneVerified || !!user.isPreview;
      if (unlocked) localStorage.setItem('hci_verified', '1');
      else localStorage.removeItem('hci_verified');
    }
  }

  function clearLocalProgress() {
    var keys = [
      'hci_journey',
      'hci_quiz',
      'hci_coding_progress',
      'hci_coding_stage',
      'hci_practice_count',
      'hci_course_satr',
      'hci_course_google',
      'hci_course_idf',
      'hci_course_figma',
      'hci_book_norman',
      'hci_book_krug',
      'hci_book_cooper',
      'hci_book_eyal',
      'hci_avatar',
      'hci_seen_notif_ids',
      'hci_foundation'
    ];
    keys.forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) { /* */ }
    });
    /* مفاتيح التمارين ديناميكية (hci_practice_1 .. n) */
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf('hci_practice_') === 0) localStorage.removeItem(k);
      }
    } catch (e) { /* */ }
  }

  function clearSession() {
    localStorage.removeItem('hci_token');
    localStorage.removeItem('hci_user_id');
    localStorage.removeItem('hci_user_role');
    localStorage.removeItem('hci_user_json');
    localStorage.removeItem('hci_user_name');
    localStorage.removeItem('hci_path_type');
    localStorage.removeItem('hci_verified');
    try { localStorage.removeItem('hci_is_preview'); } catch (e) { /* */ }
    try { sessionStorage.removeItem('hci_pending_verify'); } catch (e) { /* */ }
    clearLocalProgress();
  }

  function isVerified() {
    if (isAdmin()) return true;
    if (localStorage.getItem('hci_verified') === '1') return true;
    var u = currentUser();
    return !!(u && (u.emailVerified || u.phoneVerified || u.pathType));
  }

  function getPathType() {
    var u = currentUser();
    return (u && u.pathType) || localStorage.getItem('hci_path_type') || null;
  }

  function isSpecialist() {
    return getPathType() === 'specialist';
  }

  function isLoggedIn() {
    return !!getToken() && isVerified();
  }

  function currentUser() {
    try {
      return JSON.parse(localStorage.getItem('hci_user_json') || 'null');
    } catch (e) {
      return null;
    }
  }

  function isAdmin() {
    return localStorage.getItem('hci_user_role') === 'admin';
  }

  function isPreview() {
    try {
      if (localStorage.getItem('hci_is_preview') === '1') return true;
      var u = currentUser();
      return !!(u && u.isPreview);
    } catch (e) {
      return false;
    }
  }

  function getVisitorKey() {
    var key = localStorage.getItem('hci_visitor_id') || '';
    if (!key || key.length < 12) {
      key = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { localStorage.setItem('hci_visitor_id', key); } catch (e) { /* */ }
    }
    return key;
  }

  function captureShareRefFromUrl() {
    try {
      var m = /(?:\?|&)ref=([^&]+)/i.exec(location.search || '');
      if (!m) return null;
      var ref = String(decodeURIComponent(m[1] || '')).replace(/\D/g, '');
      if (!ref) return null;
      var myId = localStorage.getItem('hci_user_id') || '';
      if (myId && myId === ref) return null; /* لا تتبع رابطك أنت */
      localStorage.setItem('hci_ref', ref);
      localStorage.setItem('hci_ref_at', new Date().toISOString());
      return ref;
    } catch (e) {
      return null;
    }
  }

  function getStoredShareRef() {
    try {
      return localStorage.getItem('hci_ref') || '';
    } catch (e) {
      return '';
    }
  }

  function buildShareUrl(userId) {
    var id = userId || (currentUser() && currentUser().id) || localStorage.getItem('hci_user_id');
    if (!id) return location.origin + '/index.html';
    var base = location.origin + location.pathname.replace(/[^/]+$/, '');
    return base + 'index.html?ref=' + encodeURIComponent(String(id));
  }

  async function trackShareHit(refOverride) {
    var ref = refOverride || getStoredShareRef();
    if (!ref) return null;
    var myId = localStorage.getItem('hci_user_id') || '';
    if (myId && myId === String(ref)) return null;
    try {
      return await request('/api/share/hit', {
        method: 'POST',
        body: {
          ref: ref,
          visitorKey: getVisitorKey(),
          path: (location.pathname.split('/').pop() || 'index.html') + (location.search || '')
        }
      });
    } catch (e) {
      return null;
    }
  }

  async function fetchShareStats() {
    return request('/api/share/stats');
  }

  /* التقاط رابط المشاركة فور التحميل */
  (function initShareCapture() {
    var ref = captureShareRefFromUrl();
    if (ref) {
      trackShareHit(ref).catch(function () {});
    }
  })();

  function withTimeout(promise, ms, message) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        var err = new Error(message || 'انتهى وقت الانتظار — حاول مرة ثانية');
        err.code = 'TIMEOUT';
        reject(err);
      }, ms);
      promise.then(function (value) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      }, function (err) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async function request(path, options) {
    options = options || {};
    var isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
    var headers = Object.assign({}, options.headers || {});
    if (!isForm) headers['Content-Type'] = 'application/json';
    var token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    var res;
    var timeoutMs = options.timeoutMs || 18000;
    try {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var fetchPromise = fetch(API_BASE + path, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body
          ? (isForm ? options.body : JSON.stringify(options.body))
          : undefined,
        signal: ctrl ? ctrl.signal : undefined
      });
      if (ctrl) {
        setTimeout(function () {
          try { ctrl.abort(); } catch (e) { /* */ }
        }, timeoutMs);
      }
      res = await withTimeout(
        fetchPromise,
        timeoutMs,
        'الاتصال بطيء أو السيرفر يفيق من النوم — أعد المحاولة'
      );
    } catch (err) {
      if (err && err.code === 'TIMEOUT') throw err;
      var e = new Error(
        location.protocol === 'file:'
          ? 'السيرفر غير متصل. شغّل: npm start ثم افتح http://localhost:3000'
          : 'تعذر الاتصال بالسيرفر — تأكد من الإنترنت أو انتظر قليلاً إذا الموقع يفيق من النوم'
      );
      e.code = 'OFFLINE';
      throw e;
    }

    var data = {};
    var rawText = '';
    try {
      rawText = await res.text();
      data = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      data = {};
    }

    if (!res.ok) {
      var msg = data.error;
      if (!msg) {
        if (res.status === 404) {
          msg = 'السيرفر الحالي ما يخدم تسجيل الدخول. افتح الموقع من http://localhost:3000 بعد تشغيل: npm start';
        } else if (res.status === 401) {
          msg = 'بيانات الدخول غير صحيحة';
        } else if (res.status >= 500) {
          msg = 'خطأ في السيرفر — حاول مرة ثانية بعد لحظات';
        } else {
          msg = 'حدث خطأ أثناء الاتصال (رمز ' + res.status + ')';
        }
      }
      var err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function register(payload) {
    var body = Object.assign({}, payload || {});
    var ref = getStoredShareRef();
    if (ref && body.referredBy == null) body.referredBy = ref;
    body.visitorKey = getVisitorKey();
    var data = await request('/api/auth/register', { method: 'POST', body: body });
    if (data && data.token) setSession(data.token, data.user);
    return data;
  }

  async function login(identifier, password) {
    var data = await request('/api/auth/login', {
      method: 'POST',
      body: { identifier: identifier, password: password }
    });
    setSession(data.token, data.user, { siteUnlock: true, resetPreview: !!data.user.isPreview });
    return data;
  }

  async function loginWithGoogle(credential) {
    var body = {
      credential: credential,
      visitorKey: getVisitorKey()
    };
    var ref = getStoredShareRef();
    if (ref) body.referredBy = ref;
    var data = await request('/api/auth/google', { method: 'POST', body: body });
    setSession(data.token, data.user);
    return data;
  }

  async function getGoogleAuthConfig() {
    return request('/api/auth/google-config');
  }

  async function logout() {
    clearSession();
  }

  async function fetchProgress() {
    return request('/api/progress');
  }

  async function saveProgress(payload) {
    if (!isLoggedIn()) return null;
    return request('/api/progress', { method: 'PUT', body: payload });
  }

  async function fetchMyCertificate() {
    return request('/api/certificate/me');
  }

  async function fetchCertificateById(id) {
    return request('/api/certificate/' + encodeURIComponent(id));
  }

  async function updateProfile(firstName, lastName) {
    var data = await request('/api/auth/profile', {
      method: 'PATCH',
      body: { firstName: firstName, lastName: lastName }
    });
    if (data && data.user) {
      setSession(getToken(), data.user);
      try {
        localStorage.setItem('hci_user_name', data.user.fullName || '');
      } catch (e) { /* */ }
    }
    return data;
  }

  async function updateAvatar(dataUrl) {
    var data = await request('/api/auth/avatar', {
      method: 'PATCH',
      body: { avatar: dataUrl || '' }
    });
    if (data && data.user) setSession(getToken(), data.user);
    return data;
  }

  async function fetchUnreadCount() {
    return request('/api/messages/unread-count');
  }

  async function fetchMessages() {
    return request('/api/messages');
  }

  async function fetchNotifications() {
    return request('/api/notifications');
  }

  async function markNotificationRead(id) {
    return request('/api/notifications/' + id + '/read', { method: 'POST' });
  }

  async function markAllNotificationsRead() {
    return request('/api/notifications/read-all', { method: 'POST' });
  }

  async function markMessageRead(id) {
    return request('/api/messages/' + id + '/read', { method: 'POST' });
  }

  // جمع التقدم من localStorage لإرساله للسيرفر
  function collectLocalProgress() {
    function parse(key) {
      try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; }
    }
    var practice = {};
    var practiceCount = localStorage.getItem('hci_practice_count');
    if (practiceCount) practice.count = practiceCount;
    try {
      for (var pi = 0; pi < localStorage.length; pi++) {
        var pk = localStorage.key(pi);
        if (pk && pk.indexOf('hci_practice_') === 0 && pk !== 'hci_practice_count') {
          practice[pk.slice('hci_practice_'.length)] = true;
        }
      }
    } catch (e) { /* */ }

    var courses = {};
    ['satr', 'google', 'idf', 'figma'].forEach(function (id) {
      if (localStorage.getItem('hci_course_' + id)) courses[id] = true;
    });

    var books = {};
    ['norman', 'krug', 'cooper', 'eyal'].forEach(function (id) {
      if (localStorage.getItem('hci_book_' + id)) books[id] = true;
    });

    return {
      journey: parse('hci_journey'),
      coding: parse('hci_coding_progress'),
      codingStage: localStorage.getItem('hci_coding_stage') || '',
      practice: practice,
      courses: courses,
      books: books,
      quiz: parse('hci_quiz')
    };
  }

  function applyProgress(data) {
    if (!data) return;
    if (data.journey) localStorage.setItem('hci_journey', JSON.stringify(data.journey));
    if (data.coding) localStorage.setItem('hci_coding_progress', JSON.stringify(data.coding));
    if (data.codingStage) localStorage.setItem('hci_coding_stage', data.codingStage);
    if (data.quiz) localStorage.setItem('hci_quiz', JSON.stringify(data.quiz));

    if (data.practice) {
      if (data.practice.count) localStorage.setItem('hci_practice_count', String(data.practice.count));
      Object.keys(data.practice).forEach(function (k) {
        if (k !== 'count' && data.practice[k]) localStorage.setItem('hci_practice_' + k, '1');
      });
    }
    if (data.courses) {
      Object.keys(data.courses).forEach(function (k) {
        if (data.courses[k]) localStorage.setItem('hci_course_' + k, '1');
      });
    }
    if (data.books) {
      Object.keys(data.books).forEach(function (k) {
        if (data.books[k]) localStorage.setItem('hci_book_' + k, '1');
      });
    }
  }

  // دمج تقدم محلي مع السيرفر (يأخذ الأحدث/الأكمل)
  function mergeJourney(localJ, remoteJ) {
    var out = { visited: {}, done: {}, unlocked: {}, bootstrapped: true };
    [localJ || {}, remoteJ || {}].forEach(function (j) {
      ['visited', 'done', 'unlocked'].forEach(function (key) {
        var map = j[key] || {};
        Object.keys(map).forEach(function (k) {
          if (map[k]) out[key][k] = true;
        });
      });
      if (j.bootstrapped) out.bootstrapped = true;
    });
    return out;
  }

  async function syncProgress() {
    if (!isLoggedIn()) return;
    try {
      await withTimeout((async function () {
        var remote = await fetchProgress();
        var local = collectLocalProgress();
        var merged = {
          journey: mergeJourney(local.journey, remote.journey),
          coding: Object.assign({}, remote.coding || {}, local.coding || {}),
          codingStage: local.codingStage || remote.codingStage || '',
          practice: Object.assign({}, remote.practice || {}, local.practice || {}),
          courses: Object.assign({}, remote.courses || {}, local.courses || {}),
          books: Object.assign({}, remote.books || {}, local.books || {}),
          quiz: Object.assign({}, remote.quiz || {}, local.quiz || {})
        };
        applyProgress(merged);
        try {
          if (typeof sanitizeJourneyProgress === 'function') sanitizeJourneyProgress();
        } catch (e) { /* */ }
        await saveProgress(merged);
      })(), 12000, 'مزامنة التقدم استغرقت وقتاً طويلاً');
    } catch (err) {
      console.warn('مزامنة التقدم:', err.message);
    }
  }

  var syncTimer = null;
  function scheduleSync() {
    if (!isLoggedIn()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      saveProgress(collectLocalProgress()).catch(function () {});
    }, 600);
  }

  async function setPathType(pathType) {
    var data = await request('/api/auth/path', {
      method: 'PATCH',
      body: { pathType: pathType }
    });
    setSession(getToken(), data.user);
    return data.user;
  }

  async function markIntroSeen() {
    var data = await request('/api/auth/intro-seen', { method: 'PATCH', body: {} });
    setSession(getToken(), data.user);
    return data.user;
  }

  /** تطبيق فتح المراحل للمتخصص */
  function applySpecialistUnlocks() {
    var j;
    try { j = JSON.parse(localStorage.getItem('hci_journey') || '{}'); } catch (e) { j = {}; }
    if (!j.unlocked) j.unlocked = {};
    if (!j.done) j.done = {};
    if (!j.visited) j.visited = {};
    ['discover', 'fundamentals', 'coding', 'courses', 'books', 'practice', 'contribute'].forEach(function (id) {
      j.unlocked[id] = true;
    });
    /* المتخصص اختار المجال — لا نعيد عليه محطة «هل يناسبك؟» */
    j.done.discover = true;
    j.visited.discover = true;
    j.bootstrapped = true;
    j.pathType = 'specialist';
    localStorage.setItem('hci_journey', JSON.stringify(j));
    scheduleSync();
  }

  /** رسالة ترحيب وسط الشاشة ثم تنفيذ callback — خطاب يحترم التسجيل vs العودة */
  function showWelcomeOverlay(fullName, callback, options) {
    options = options || {};
    var isAdminUser = !!options.isAdmin;
    var isNewSignup = !!options.isNewSignup;
    var hour = new Date().getHours();
    var greet = 'أهلاً بك';
    if (hour < 12) greet = 'صباح الخير';
    else if (hour < 17) greet = 'مساء الخير';
    else greet = 'مساء الخير';

    var first = (fullName || '').trim().split(/\s+/)[0] || '';
    var sub;
    if (isAdminUser) {
      sub = 'مرحباً بك في لوحة قيادة HCI — الإحصائيات والتقدّم بين يديك';
    } else if (isNewSignup) {
      sub = 'حسابك جاهز. نتابع بتحديد مسارك ثم البداية — خطوة بخطوة.';
    } else {
      sub = 'مرحباً بعودتك. نكمل من حيث توقفت.';
    }
    var overlay = document.createElement('div');
    overlay.className = 'welcome-overlay';
    overlay.setAttribute('role', 'status');
    overlay.innerHTML =
      '<div class="welcome-card">' +
        '<p class="welcome-greet">' + greet + '</p>' +
        (first ? '<p class="welcome-name">' + first + '</p>' : '') +
        '<p class="welcome-sub">' + sub + '</p>' +
      '</div>';
    document.body.appendChild(overlay);

    requestAnimationFrame(function () {
      overlay.classList.add('show');
    });

    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isCoarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    var hold = prefersReduced ? 700 : (isCoarse ? 1200 : 2200);

    setTimeout(function () {
      overlay.classList.add('hide');
      setTimeout(function () {
        overlay.remove();
        if (typeof callback === 'function') callback();
      }, prefersReduced ? 150 : 450);
    }, hold);
  }

  function isFoundationCompleteLocal() {
    try {
      var data = JSON.parse(localStorage.getItem('hci_foundation') || '{}');
      if (data.completedAt) return true;
      var read = data.read || {};
      if (read.hci) return true;
      return !!(read.uxui && read.nielsen);
    } catch (e) {
      return false;
    }
  }

  function safeNextPath() {
    try {
      var params = new URLSearchParams(location.search || '');
      var next = String(params.get('next') || '').trim();
      if (!next) return '';
      next = decodeURIComponent(next);
      if (!/^[a-z0-9._~#?&=%+\-]+\.html(?:[?#][a-z0-9._~#?&=%+\-]*)?$/i.test(next)) return '';
      if (/^(admin|auth)\.html/i.test(next)) return '';
      return next;
    } catch (e) {
      return '';
    }
  }

  /** بعد تسجيل الدخول أو إنشاء الحساب — أين نودّي المستخدم؟ */
  function resolvePostAuthDestination(user, isNewSignup) {
    if (!user) return 'index.html';
    if (user.isPreview) return 'index.html';
    if (user.role === 'admin') return 'index.html';

    /* التوجيه إجباري للبداية — ما نرمي الجديد على المقالات أول شي */
    if (isNewSignup || !user.pathType) return 'path-choice.html';
    if (user.pathType === 'curious' && !user.introSeen) return 'intro.html';
    if (user.pathType !== 'specialist' && !isFoundationCompleteLocal()) return 'foundation.html';

    var next = safeNextPath();
    if (next) return next;
    return 'index.html#paths';
  }

  function afterAuthFlow(user, isNewSignup) {
    return new Promise(function (resolve) {
      var settled = false;
      var dest = resolvePostAuthDestination(user, isNewSignup);
      function done() {
        if (settled) return;
        settled = true;
        resolve(dest);
      }
      showWelcomeOverlay(user.fullName || user.firstName, done, {
        isAdmin: user.role === 'admin',
        isNewSignup: !!isNewSignup
      });
      // احتياطي ضد التعليق على الجوال/الشبكة البطيئة
      setTimeout(done, 2500);
    });
  }

  /* زائر بدون جلسة: امسح هوية/تقدّم شخص سابق على نفس المتصفح */
  if (!getToken()) clearSession();

  window.HCIApi = {
    API_BASE: API_BASE,
    getToken: getToken,
    setSession: setSession,
    clearSession: clearSession,
    isLoggedIn: isLoggedIn,
    isVerified: isVerified,
    currentUser: currentUser,
    isAdmin: isAdmin,
    isPreview: isPreview,
    getPathType: getPathType,
    isSpecialist: isSpecialist,
    request: request,
    register: register,
    login: login,
    loginWithGoogle: loginWithGoogle,
    getGoogleAuthConfig: getGoogleAuthConfig,
    logout: logout,
    setPathType: setPathType,
    markIntroSeen: markIntroSeen,
    applySpecialistUnlocks: applySpecialistUnlocks,
    showWelcomeOverlay: showWelcomeOverlay,
    resolvePostAuthDestination: resolvePostAuthDestination,
    afterAuthFlow: afterAuthFlow,
    fetchProgress: fetchProgress,
    saveProgress: saveProgress,
    fetchMyCertificate: fetchMyCertificate,
    fetchCertificateById: fetchCertificateById,
    fetchMessages: fetchMessages,
    fetchUnreadCount: fetchUnreadCount,
    fetchNotifications: fetchNotifications,
    markNotificationRead: markNotificationRead,
    markAllNotificationsRead: markAllNotificationsRead,
    markMessageRead: markMessageRead,
    updateProfile: updateProfile,
    updateAvatar: updateAvatar,
    collectLocalProgress: collectLocalProgress,
    applyProgress: applyProgress,
    syncProgress: syncProgress,
    scheduleSync: scheduleSync,
    getVisitorKey: getVisitorKey,
    getStoredShareRef: getStoredShareRef,
    buildShareUrl: buildShareUrl,
    trackShareHit: trackShareHit,
    fetchShareStats: fetchShareStats,
    captureShareRefFromUrl: captureShareRefFromUrl,
    fetchPublishedArticles: function () { return request('/api/articles/published'); },
    fetchPublishedArticle: function (id) { return request('/api/articles/published/' + encodeURIComponent(id)); },
    fetchMyArticles: function () { return request('/api/articles/mine'); },
    saveArticleDraft: function (title, body, id) {
      if (id) {
        return request('/api/articles/' + encodeURIComponent(id), {
          method: 'PUT',
          body: { title: title, body: body }
        });
      }
      return request('/api/articles', {
        method: 'POST',
        body: { title: title, body: body, asDraft: true }
      });
    },
    submitArticle: function (title, body, id) {
      if (id) {
        return request('/api/articles/' + encodeURIComponent(id) + '/submit', {
          method: 'POST',
          body: { title: title, body: body }
        });
      }
      return request('/api/articles', { method: 'POST', body: { title: title, body: body } });
    },
    adminFetchArticles: function () { return request('/api/admin/articles'); },
    adminApproveArticle: function (id) {
      return request('/api/admin/articles/' + encodeURIComponent(id) + '/approve', { method: 'POST', body: {} });
    },
    adminRejectArticle: function (id, reason) {
      return request('/api/admin/articles/' + encodeURIComponent(id) + '/reject', {
        method: 'POST',
        body: { reason: reason || '' }
      });
    },
    fetchOffers: function () { return request('/api/offers'); },
    expressOfferInterest: function (id, note) {
      return request('/api/offers/' + encodeURIComponent(id) + '/interest', {
        method: 'POST',
        body: { note: note || '' }
      });
    },
    updateNotifPrefs: function (prefs) {
      return request('/api/me/notif-prefs', {
        method: 'PATCH',
        body: prefs || {}
      }).then(function (data) {
        if (data && data.user) setSession(getToken(), data.user);
        return data;
      });
    },
    fetchMyFeedback: function () {
      return request('/api/me/feedback');
    },
    submitSiteFeedback: function (rating, comment) {
      return request('/api/me/feedback', {
        method: 'POST',
        body: { rating: rating, comment: comment || '' }
      });
    }
  };
})();
