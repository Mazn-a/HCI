/* api.js — التواصل مع سيرفر المنصة */
(function () {
  var API_BASE = '';

  // لو فتحت الملف مباشرة بدون سيرفر — نوجّه طلبات الـ API للسيرفر المحلي
  // والأفضل تفتح الموقع من: http://localhost:3000
  if (location.protocol === 'file:') {
    API_BASE = 'http://localhost:3000';
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

  function setSession(token, user) {
    if (token) localStorage.setItem('hci_token', token);
    if (user) {
      localStorage.setItem('hci_user_name', user.fullName || (user.firstName + ' ' + user.lastName));
      localStorage.setItem('hci_user_id', String(user.id));
      localStorage.setItem('hci_user_role', user.role || 'student');
      localStorage.setItem('hci_user_json', JSON.stringify(user));
      if (user.pathType) localStorage.setItem('hci_path_type', user.pathType);
      else localStorage.removeItem('hci_path_type');
    }
  }

  function clearSession() {
    localStorage.removeItem('hci_token');
    localStorage.removeItem('hci_user_id');
    localStorage.removeItem('hci_user_role');
    localStorage.removeItem('hci_user_json');
    localStorage.removeItem('hci_user_name');
    localStorage.removeItem('hci_path_type');
  }

  function getPathType() {
    var u = currentUser();
    return (u && u.pathType) || localStorage.getItem('hci_path_type') || null;
  }

  function isSpecialist() {
    return getPathType() === 'specialist';
  }

  function isLoggedIn() {
    return !!getToken();
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
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }

    if (!res.ok) {
      var err = new Error(data.error || 'حدث خطأ');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function register(payload) {
    var data = await request('/api/auth/register', { method: 'POST', body: payload });
    setSession(data.token, data.user);
    return data;
  }

  async function login(identifier, password) {
    var data = await request('/api/auth/login', {
      method: 'POST',
      body: { identifier: identifier, password: password }
    });
    setSession(data.token, data.user);
    return data;
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
    ['1', '2', '3', '4'].forEach(function (id) {
      if (localStorage.getItem('hci_practice_' + id)) practice[id] = true;
    });

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
    j.bootstrapped = true;
    j.pathType = 'specialist';
    localStorage.setItem('hci_journey', JSON.stringify(j));
    scheduleSync();
  }

  /** رسالة ترحيب وسط الشاشة ثم تنفيذ callback */
  function showWelcomeOverlay(fullName, callback, options) {
    options = options || {};
    var isAdminUser = !!options.isAdmin;
    var hour = new Date().getHours();
    var greet = 'أهلاً بك';
    if (hour < 12) greet = 'صباح الخير';
    else if (hour < 17) greet = 'مساء الخير';
    else greet = 'مساء الخير';

    var first = (fullName || '').trim().split(/\s+/)[0] || '';
    var overlay = document.createElement('div');
    overlay.className = 'welcome-overlay';
    overlay.setAttribute('role', 'status');
    overlay.innerHTML =
      '<div class="welcome-card">' +
        '<p class="welcome-greet">' + greet + (isAdminUser ? ' أيها المدير' : '') + '</p>' +
        (first ? '<p class="welcome-name">' + first + '</p>' : '') +
        '<p class="welcome-sub">' +
          (isAdminUser
            ? 'مرحباً بك في لوحة قيادة HCI — الإحصائيات والتقدّم بين يديك'
            : 'سعيدون بوجودك في منصة HCI') +
        '</p>' +
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

  /** بعد تسجيل الدخول أو إنشاء الحساب — أين نودّي المستخدم؟ */
  function resolvePostAuthDestination(user, isNewSignup) {
    if (!user) return 'index.html';
    if (user.role === 'admin') return 'admin.html';
    if (isNewSignup || !user.pathType) return 'path-choice.html';
    if (user.pathType === 'curious' && !user.introSeen) return 'intro.html';
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
      showWelcomeOverlay(user.fullName || user.firstName, done, { isAdmin: user.role === 'admin' });
      // احتياطي ضد التعليق على الجوال/الشبكة البطيئة
      setTimeout(done, 2500);
    });
  }

  window.HCIApi = {
    API_BASE: API_BASE,
    getToken: getToken,
    setSession: setSession,
    clearSession: clearSession,
    isLoggedIn: isLoggedIn,
    currentUser: currentUser,
    isAdmin: isAdmin,
    getPathType: getPathType,
    isSpecialist: isSpecialist,
    request: request,
    register: register,
    login: login,
    logout: logout,
    setPathType: setPathType,
    markIntroSeen: markIntroSeen,
    applySpecialistUnlocks: applySpecialistUnlocks,
    showWelcomeOverlay: showWelcomeOverlay,
    resolvePostAuthDestination: resolvePostAuthDestination,
    afterAuthFlow: afterAuthFlow,
    fetchProgress: fetchProgress,
    saveProgress: saveProgress,
    fetchMessages: fetchMessages,
    fetchUnreadCount: fetchUnreadCount,
    fetchNotifications: fetchNotifications,
    markNotificationRead: markNotificationRead,
    markAllNotificationsRead: markAllNotificationsRead,
    markMessageRead: markMessageRead,
    updateProfile: updateProfile,
    collectLocalProgress: collectLocalProgress,
    applyProgress: applyProgress,
    syncProgress: syncProgress,
    scheduleSync: scheduleSync
  };
})();
