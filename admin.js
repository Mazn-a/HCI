/* admin.js — لوحة إدارة المنصة */
(async function () {
  var content = document.getElementById('adminContent');

  function showContent() {
    if (content) content.hidden = false;
  }

  // لازم تفتح من السيرفر مو من الملف مباشرة
  if (location.protocol === 'file:') {
    location.href = 'http://localhost:3000/admin.html';
    return;
  }

  if (!window.HCIApi) {
    return;
  }

  if (!HCIApi.isLoggedIn()) {
    location.href = 'auth.html';
    return;
  }

  // نتحقق من السيرفر ونحدّث الجلسة — بدون صفحة قفل
  var me;
  try {
    me = await HCIApi.request('/api/auth/me');
  } catch (err) {
    HCIApi.clearSession();
    location.href = 'auth.html';
    return;
  }

  if (!me.user) {
    location.href = 'auth.html';
    return;
  }

  // حدّث الجلسة المحلية من السيرفر
  HCIApi.setSession(HCIApi.getToken(), me.user);
  showContent();

  if (me.user.role !== 'admin') {
    location.href = 'index.html';
    return;
  }

  var welcomeTitle = document.getElementById('adminWelcomeTitle');
  if (welcomeTitle) {
    welcomeTitle.textContent = 'أهلاً بك، ' + (me.user.firstName || me.user.fullName || '');
  }

  var slot = document.getElementById('navCtaSlot');
  var user = me.user;
  if (slot && user) {
    slot.innerHTML =
      '<a href="admin.html" class="nav-admin-btn" aria-current="page">الإدارة</a>' +
      '<span class="nav-user-wrap">' +
        '<a href="profile.html" class="nav-user" aria-label="حسابك"><span class="chip-avatar">' +
        user.firstName.charAt(0) + '</span><span class="nav-user-name">' + user.fullName + '</span></a>' +
        '<button type="button" class="nav-user-menu-btn" id="navUserMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="خيارات الحساب">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
            '<path fill="currentColor" d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>' +
          '</svg>' +
        '</button>' +
        '<div class="nav-dropdown" id="navDropdown">' +
          '<a href="admin.html">لوحة الإدارة</a>' +
          '<a href="profile.html">الملف الشخصي</a>' +
          '<a href="index.html">الموقع</a>' +
          '<a href="#" id="logoutLink" class="nav-dropdown-logout">تسجيل الخروج</a>' +
        '</div>' +
      '</span>';
    var dropBtn = document.getElementById('navUserMenuBtn');
    var drop = document.getElementById('navDropdown');
    if (dropBtn && drop) {
      dropBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = drop.classList.toggle('open');
        dropBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (ev) {
        if (!dropBtn.contains(ev.target) && !drop.contains(ev.target)) {
          drop.classList.remove('open');
          dropBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }
    var logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
      logoutLink.addEventListener('click', async function (e) {
        e.preventDefault();
        try {
          localStorage.setItem('hci_accent_color', '#C9A24B');
        } catch (err) { /* */ }
        await HCIApi.logout();
        location.href = 'index.html';
      });
    }
  }

  var menuBtn = document.getElementById('menuBtn');
  var navLinks = document.getElementById('navLinks');
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', function () {
      navLinks.classList.toggle('is-open');
    });
  }

  var STAGE_LABELS = {
    discover: 'اكتشف التخصص',
    fundamentals: 'أساسيات HCI',
    coding: 'ترميز HTML & CSS',
    courses: 'الدورات',
    books: 'الكتب',
    practice: 'تعلّم بالمرح',
    contribute: 'أفد غيرك'
  };
  var STAGE_ORDER_UI = ['discover', 'fundamentals', 'coding', 'courses', 'books', 'practice', 'contribute'];
  var cachedUsers = [];

  function setBadge(id, n) {
    var el = document.getElementById(id);
    if (!el) return;
    var num = Number(n) || 0;
    if (num > 0) {
      el.hidden = false;
      el.textContent = String(num > 99 ? '99+' : num);
    } else {
      el.hidden = true;
      el.textContent = '0';
    }
  }

  function markAttentionCard(selector, n) {
    var card = document.querySelector(selector);
    if (!card) return;
    card.classList.toggle('has-items', Number(n) > 0);
  }

  function renderFunnel(funnel, totalStudents) {
    var root = document.getElementById('adminFunnel');
    if (!root) return;
    var max = Math.max(1, Number(totalStudents) || 1);
    root.innerHTML = STAGE_ORDER_UI.map(function (id) {
      var n = funnel && funnel[id] != null ? Number(funnel[id]) : 0;
      var pct = Math.round((n / max) * 100);
      return '<li>' +
        '<span class="label">' + escapeHtml(STAGE_LABELS[id] || id) + '</span>' +
        '<span class="track"><span class="fill" style="width:' + pct + '%"></span></span>' +
        '<span class="count">' + n + '</span>' +
        '</li>';
    }).join('');
  }

  async function loadStats() {
    var s = await HCIApi.request('/api/admin/stats');
    document.getElementById('statStudents').textContent = s.students;
    document.getElementById('statActive').textContent = s.activeWeek;
    var nw = document.getElementById('statNewWeek');
    if (nw) nw.textContent = s.newThisWeek != null ? s.newThisWeek : '—';
    var done = document.getElementById('statCompleted');
    if (done) done.textContent = s.pathCompleted != null ? s.pathCompleted : '—';
    var certs = document.getElementById('statCertificates');
    if (certs) certs.textContent = s.certificates != null ? s.certificates : '—';
    var stalled = document.getElementById('statStalled');
    if (stalled) stalled.textContent = s.stalled != null ? s.stalled : '—';
    var qp = document.getElementById('statQuizPasses');
    if (qp) qp.textContent = s.quizPasses != null ? s.quizPasses : '—';
    var ap = document.getElementById('statArticlesPub');
    if (ap) ap.textContent = s.articlesPublished != null ? s.articlesPublished : '—';

    var attn = s.attention || {};
    var aN = attn.articles != null ? attn.articles : s.articlesPending;
    var cN = attn.contacts != null ? attn.contacts : s.contacts;
    var rN = attn.reports != null ? attn.reports : s.reports;
    var iN = attn.interests != null ? attn.interests : s.offerInterestsNew;
    var attnA = document.getElementById('attnArticles');
    var attnC = document.getElementById('attnContacts');
    var attnR = document.getElementById('attnReports');
    var attnI = document.getElementById('attnInterests');
    if (attnA) attnA.textContent = aN != null ? aN : '—';
    if (attnC) attnC.textContent = cN != null ? cN : '—';
    if (attnR) attnR.textContent = rN != null ? rN : '—';
    if (attnI) attnI.textContent = iN != null ? iN : '—';
    markAttentionCard('[data-admin-tab="tabArticles"]', aN);
    markAttentionCard('[data-admin-tab="tabContacts"]', cN);
    markAttentionCard('[data-admin-tab="tabReports"]', rN);
    markAttentionCard('[data-admin-tab="tabOffers"]', iN);
    setBadge('badgeArticles', aN);
    setBadge('badgeContacts', cN);
    setBadge('badgeReports', rN);
    setBadge('badgeOffers', iN);
    setBadge('badgeOffersInner', iN);

    renderFunnel(s.stageFunnel || {}, s.students);

    var miss = document.getElementById('mostMissedQ');
    if (miss) {
      if (s.mostMissed && s.mostMissed.title) {
        miss.textContent = s.mostMissed.title + ' — أُجيب خطأ ' + s.mostMissed.wrong + ' مرة';
      } else {
        miss.textContent = 'ما فيه بيانات اختبار بعد — لما الطلاب يحلّون الأساسيات تظهر هنا.';
      }
    }
    var gen = document.getElementById('adminGeneratedAt');
    if (gen) gen.textContent = s.generatedAt ? ('آخر تحديث: ' + formatDate(s.generatedAt)) : '';

    var loginList = document.getElementById('recentLoginsList');
    if (loginList) {
      loginList.innerHTML = '';
      if (s.recentLogins && s.recentLogins.length) {
        s.recentLogins.forEach(function (row) {
          var li = document.createElement('li');
          li.innerHTML = '<strong>' + escapeHtml(row.name) + '</strong>' +
            '<span>' + formatDate(row.lastLogin) + '</span>';
          loginList.appendChild(li);
        });
      } else {
        loginList.innerHTML = '<li style="color:var(--text-mid)">ما فيه دخول مسجّل بعد.</li>';
      }
    }
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
      return iso;
    }
  }

  function bindUserActions(root) {
    if (!root) return;
    root.querySelectorAll('.msg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        openMsgModal(b.getAttribute('data-id'), b.getAttribute('data-name'));
      });
    });
    root.querySelectorAll('.view-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        openDetail(b.getAttribute('data-id'));
      });
    });
    root.querySelectorAll('.del-btn').forEach(function (b) {
      b.addEventListener('click', async function () {
        var name = b.getAttribute('data-name');
        if (!confirm('حذف حساب «' + name + '» نهائياً؟')) return;
        await HCIApi.request('/api/admin/users/' + b.getAttribute('data-id'), { method: 'DELETE' });
        await loadStats();
        await loadUsers();
      });
    });
  }

  function userMatchesFilters(u, q, filter) {
    if (q) {
      var hay = [u.fullName, u.email, u.phone, u.stopPoint].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    var weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    var twoWeeks = Date.now() - 14 * 24 * 60 * 60 * 1000;
    var last = u.lastLogin ? new Date(u.lastLogin).getTime() : 0;
    if (filter === 'active') return !!(last && last >= weekAgo);
    if (filter === 'stalled') return (u.doneStages > 0) && (!last || last < twoWeeks);
    if (filter === 'done') return Number(u.progressPercent) >= 100 || Number(u.doneStages) >= 7;
    if (filter === 'quiz') return !!u.quizPassed;
    if (filter === 'noquiz') return !u.quizScore;
    return true;
  }

  function renderUsers() {
    var body = document.getElementById('usersBody');
    var mobile = document.getElementById('usersMobile');
    var empty = document.getElementById('usersEmpty');
    var searchEl = document.getElementById('usersSearch');
    var filterEl = document.getElementById('usersFilter');
    var q = searchEl ? String(searchEl.value || '').trim().toLowerCase() : '';
    var filter = filterEl ? filterEl.value : 'all';
    body.innerHTML = '';
    if (mobile) mobile.innerHTML = '';

    var list = cachedUsers.filter(function (u) { return userMatchesFilters(u, q, filter); });
    if (!cachedUsers.length) {
      empty.style.display = 'block';
      empty.textContent = 'لا يوجد طلاب مسجّلون حالياً.';
      return;
    }
    if (!list.length) {
      empty.style.display = 'block';
      empty.textContent = 'ما في نتائج مطابقة للبحث أو التصفية.';
      return;
    }
    empty.style.display = 'none';

    list.forEach(function (u) {
      var contact = u.email || u.phone || '—';
      var pathLabel = u.pathType === 'specialist' ? 'متخصص' : (u.pathType === 'curious' ? 'مهتم' : '—');
      var stopLabel = u.stopPoint || '—';
      var quizLabel = u.quizScore
        ? (u.quizPassed ? '✓ ' + u.quizScore : '✕ ' + u.quizScore)
        : 'ما اختبر بعد';
      var actions =
        '<div class="admin-actions">' +
          '<button type="button" class="view-btn" data-id="' + u.id + '">تفاصيل</button>' +
          '<button type="button" class="msg-btn" data-id="' + u.id + '" data-name="' + escapeHtml(u.fullName) + '">رسالة</button>' +
          '<button type="button" class="del-btn" data-id="' + u.id + '" data-name="' + escapeHtml(u.fullName) + '">حذف</button>' +
        '</div>';

      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><strong>' + escapeHtml(u.fullName) + '</strong><br><span style="font-size:0.72rem;color:var(--text-mid)">' + pathLabel +
          (u.nameChanged ? ' · تغيّر الاسم' : '') + '<br dir="ltr">' + escapeHtml(contact) + '</span></td>' +
        '<td><span class="pct-pill">' + escapeHtml(stopLabel) + '</span></td>' +
        '<td><span class="pct-pill">' + u.progressPercent + '% · ' + u.doneStages + '/7</span></td>' +
        '<td>' + quizLabel + (u.quizWrong != null && u.quizScore ? '<br><span style="font-size:0.72rem;color:var(--text-mid)">صح ' + u.quizCorrect + ' · خطأ ' + u.quizWrong + '</span>' : '') + '</td>' +
        '<td>' + formatDate(u.lastLogin) + '</td>' +
        '<td>' + formatDate(u.progressUpdated) + '</td>' +
        '<td>' + actions + '</td>';
      body.appendChild(tr);

      if (mobile) {
        var card = document.createElement('div');
        card.className = 'admin-user-card';
        card.innerHTML =
          '<div class="admin-user-card-top"><strong>' + escapeHtml(u.fullName) + '</strong><span>' + u.progressPercent + '%</span></div>' +
          '<p style="color:var(--text-mid);font-size:0.85rem;margin:6px 0;">توقف عند: ' + escapeHtml(stopLabel) + '</p>' +
          '<p style="color:var(--text-mid);font-size:0.85rem;margin:0 0 6px;">اختبار: ' + quizLabel + '</p>' +
          '<p style="color:var(--text-mid);font-size:0.8rem;margin:0 0 10px;">آخر دخول: ' + formatDate(u.lastLogin) + ' · تحديث: ' + formatDate(u.progressUpdated) + '</p>' +
          actions;
        mobile.appendChild(card);
      }
    });
    bindUserActions(body);
    if (mobile) bindUserActions(mobile);
  }

  async function loadUsers() {
    var data = await HCIApi.request('/api/admin/users');
    cachedUsers = data.users || [];
    renderUsers();
  }

  async function loadMessages() {
    var data = await HCIApi.request('/api/admin/messages');
    var list = document.getElementById('messagesList');
    var empty = document.getElementById('messagesEmpty');
    list.innerHTML = '';

    if (!data.messages.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    data.messages.forEach(function (m) {
      var div = document.createElement('div');
      div.className = 'admin-msg-item';
      div.style.cssText = 'padding:16px 0; border-bottom:1px solid var(--ink-3);';
      div.innerHTML =
        '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px;">' +
          '<strong class="msg-subject-text">' + escapeHtml(m.subject) + '</strong>' +
          '<span style="color:var(--text-mid);font-size:0.78rem;">' + formatDate(m.createdAt) +
          (m.updatedAt ? ' · عُدّلت ' + formatDate(m.updatedAt) : '') +
          '</span>' +
          '<span style="font-size:0.78rem;font-weight:700;padding:3px 8px;border-radius:999px;' +
            (m.read
              ? 'background:rgba(110,207,132,0.15);color:var(--line-cyan);'
              : 'background:rgba(201,162,75,0.15);color:var(--gold);') +
          '">' + (m.read ? 'تمت القراءة' : 'لم تُقرأ بعد') + '</span>' +
        '</div>' +
        '<p style="color:var(--text-mid);font-size:0.85rem;margin-bottom:6px;">إلى: ' +
          (m.user ? escapeHtml(m.user.name) : '—') +
          (m.user && m.user.email ? ' · ' + escapeHtml(m.user.email) : '') +
          (m.user && m.user.phone ? ' · ' + escapeHtml(m.user.phone) : '') +
        '</p>' +
        '<p class="msg-body-text" style="font-size:0.95rem; margin-bottom:10px;">' + escapeHtml(m.body) + '</p>' +
        '<div class="admin-actions">' +
          '<button type="button" class="view-btn msg-edit-btn" data-id="' + m.id + '">تعديل</button>' +
          '<button type="button" class="del-btn msg-del-btn" data-id="' + m.id + '">حذف</button>' +
        '</div>';
      list.appendChild(div);
    });

    list.querySelectorAll('.msg-del-btn').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('حذف هذه الرسالة؟ ستُحذف أيضاً من صندوق الطالب.')) return;
        try {
          await HCIApi.request('/api/admin/messages/' + btn.getAttribute('data-id'), { method: 'DELETE' });
          await loadMessages();
          await loadStats();
        } catch (err) {
          alert(err.message);
        }
      });
    });

    list.querySelectorAll('.msg-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var item = btn.closest('.admin-msg-item');
        var oldSubject = item.querySelector('.msg-subject-text').textContent;
        var oldBody = item.querySelector('.msg-body-text').textContent;
        var subject = prompt('موضوع الرسالة:', oldSubject);
        if (subject === null) return;
        subject = subject.trim();
        if (!subject) { alert('الموضوع مطلوب'); return; }
        var body = prompt('نص الرسالة:', oldBody);
        if (body === null) return;
        body = body.trim();
        if (!body) { alert('نص الرسالة مطلوب'); return; }
        try {
          await HCIApi.request('/api/admin/messages/' + btn.getAttribute('data-id'), {
            method: 'PATCH',
            body: { subject: subject, body: body }
          });
          await loadMessages();
          alert('تم تعديل الرسالة، وسيظهر التحديث لدى الطالب.');
        } catch (err) {
          alert(err.message);
        }
      });
    });
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var ADMIN_TABS = ['tabOverview', 'tabUsers', 'tabShare', 'tabMessages', 'tabReports', 'tabContacts', 'tabArticles', 'tabOffers'];
  var BLOCK_ORDER_KEY = 'hci_admin_block_order';
  var STAT_ORDER_KEY = 'hci_admin_stat_order';
  var DEFAULT_BLOCKS = ['attention', 'stats', 'insights'];
  var DEFAULT_STATS = ['students', 'active', 'newWeek', 'completed', 'certificates', 'stalled', 'quiz', 'articlesPub'];

  function readOrder(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      var arr = raw ? JSON.parse(raw) : null;
      if (!Array.isArray(arr) || !arr.length) return fallback.slice();
      var clean = [];
      arr.forEach(function (id) {
        if (fallback.indexOf(id) !== -1 && clean.indexOf(id) === -1) clean.push(id);
      });
      fallback.forEach(function (id) {
        if (clean.indexOf(id) === -1) clean.push(id);
      });
      return clean;
    } catch (e) {
      return fallback.slice();
    }
  }

  function saveOrder(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) { /* */ }
  }

  function applyBlockOrder() {
    var stack = document.getElementById('adminOverviewStack');
    if (!stack) return;
    var order = readOrder(BLOCK_ORDER_KEY, DEFAULT_BLOCKS);
    order.forEach(function (id) {
      var el = stack.querySelector('[data-admin-block="' + id + '"]');
      if (el) stack.appendChild(el);
    });
    // refresh numbers in titles
    var labels = { attention: 'يحتاج انتباهك الآن', stats: 'أرقام سريعة', insights: 'صورة أوضح' };
    order.forEach(function (id, i) {
      var el = stack.querySelector('[data-admin-block="' + id + '"] h2');
      if (el && labels[id]) el.textContent = (i + 1) + ') ' + labels[id];
    });
  }

  function moveBlock(id, dir) {
    var order = readOrder(BLOCK_ORDER_KEY, DEFAULT_BLOCKS);
    var i = order.indexOf(id);
    if (i < 0) return;
    var j = i + dir;
    if (j < 0 || j >= order.length) return;
    var tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
    saveOrder(BLOCK_ORDER_KEY, order);
    applyBlockOrder();
  }

  function applyStatOrder() {
    var root = document.getElementById('adminStats');
    if (!root) return;
    var order = readOrder(STAT_ORDER_KEY, DEFAULT_STATS);
    order.forEach(function (id) {
      var el = root.querySelector('[data-stat="' + id + '"]');
      if (el) root.appendChild(el);
    });
    root.querySelectorAll('.stat-box').forEach(function (box) {
      var move = box.querySelector('.stat-move');
      if (!move) {
        move = document.createElement('div');
        move.className = 'stat-move';
        move.innerHTML =
          '<button type="button" class="stat-up" aria-label="للأعلى">↑</button>' +
          '<button type="button" class="stat-down" aria-label="للأسفل">↓</button>';
        box.insertBefore(move, box.firstChild);
      }
    });
  }

  function moveStat(id, dir) {
    var order = readOrder(STAT_ORDER_KEY, DEFAULT_STATS);
    var i = order.indexOf(id);
    if (i < 0) return;
    var j = i + dir;
    if (j < 0 || j >= order.length) return;
    var tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
    saveOrder(STAT_ORDER_KEY, order);
    applyStatOrder();
  }

  function setAdminTab(active, opts) {
    opts = opts || {};
    ADMIN_TABS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('active', id === active);
    });
    var panelOverview = document.getElementById('panelOverview');
    if (panelOverview) panelOverview.hidden = active !== 'tabOverview';
    document.getElementById('panelUsers').hidden = active !== 'tabUsers';
    var panelShare = document.getElementById('panelShare');
    if (panelShare) panelShare.hidden = active !== 'tabShare';
    document.getElementById('panelMessages').hidden = active !== 'tabMessages';
    document.getElementById('panelReports').hidden = active !== 'tabReports';
    var panelContacts = document.getElementById('panelContacts');
    if (panelContacts) panelContacts.hidden = active !== 'tabContacts';
    var panelArticles = document.getElementById('panelArticles');
    if (panelArticles) panelArticles.hidden = active !== 'tabArticles';
    var panelOffers = document.getElementById('panelOffers');
    if (panelOffers) panelOffers.hidden = active !== 'tabOffers';

    var tabBtn = document.getElementById(active);
    var hash = tabBtn && tabBtn.getAttribute('data-hash');
    if (hash && !opts.skipHash) {
      try { history.replaceState(null, '', '#' + hash); } catch (e) { location.hash = hash; }
    }

    if (active === 'tabShare') loadShareAdmin().catch(function (e) { alert(e.message); });
    if (active === 'tabMessages') loadMessages().catch(function (e) { alert(e.message); });
    if (active === 'tabReports') loadReports().catch(function (e) { alert(e.message); });
    if (active === 'tabContacts') loadContacts().catch(function (e) { alert(e.message); });
    if (active === 'tabArticles') loadCommunityArticles().catch(function (e) { alert(e.message); });
    if (active === 'tabOffers') loadOffersAdmin().catch(function (e) { alert(e.message); });
  }

  function openTabFromHash() {
    var h = (location.hash || '').replace(/^#/, '');
    var map = {
      overview: 'tabOverview',
      '': 'tabOverview',
      users: 'tabUsers',
      share: 'tabShare',
      messages: 'tabMessages',
      reports: 'tabReports',
      contacts: 'tabContacts',
      articles: 'tabArticles',
      offers: 'tabOffers'
    };
    setAdminTab(map[h] || 'tabOverview', { skipHash: true });
  }

  ADMIN_TABS.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function () {
      setAdminTab(id);
    });
  });

  document.querySelectorAll('[data-block-up]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      moveBlock(btn.getAttribute('data-block-up'), -1);
    });
  });
  document.querySelectorAll('[data-block-down]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      moveBlock(btn.getAttribute('data-block-down'), 1);
    });
  });

  var statsRoot = document.getElementById('adminStats');
  var toggleStatsEdit = document.getElementById('toggleStatsEdit');
  if (toggleStatsEdit && statsRoot) {
    toggleStatsEdit.addEventListener('click', function () {
      var on = statsRoot.classList.toggle('edit-mode');
      toggleStatsEdit.textContent = on ? 'إنهاء الترتيب' : 'ترتيب الأرقام';
    });
    statsRoot.addEventListener('click', function (e) {
      var up = e.target.closest('.stat-up');
      var down = e.target.closest('.stat-down');
      if (!up && !down) return;
      var box = e.target.closest('[data-stat]');
      if (!box) return;
      moveStat(box.getAttribute('data-stat'), up ? -1 : 1);
    });
  }
  applyBlockOrder();
  applyStatOrder();

  document.querySelectorAll('[data-admin-tab]').forEach(function (card) {
    card.addEventListener('click', function (e) {
      e.preventDefault();
      setAdminTab(card.getAttribute('data-admin-tab'));
      var panel = document.getElementById('panel' + card.getAttribute('data-admin-tab').replace('tab', ''));
      if (panel && panel.scrollIntoView) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  var usersSearch = document.getElementById('usersSearch');
  var usersFilter = document.getElementById('usersFilter');
  if (usersSearch) usersSearch.addEventListener('input', renderUsers);
  if (usersFilter) usersFilter.addEventListener('change', renderUsers);

  var broadcastModal = document.getElementById('broadcastModal');
  var broadcastOpenBtn = document.getElementById('broadcastOpenBtn');
  if (broadcastOpenBtn && broadcastModal) {
    broadcastOpenBtn.addEventListener('click', function () {
      broadcastModal.classList.add('open');
    });
    document.getElementById('broadcastCancel').addEventListener('click', function () {
      broadcastModal.classList.remove('open');
    });
    broadcastModal.addEventListener('click', function (e) {
      if (e.target === broadcastModal) broadcastModal.classList.remove('open');
    });
    document.getElementById('broadcastSend').addEventListener('click', async function () {
      var subject = document.getElementById('broadcastSubject').value.trim();
      var body = document.getElementById('broadcastBody').value.trim();
      if (!subject || !body) { alert('اكتب الموضوع والرسالة'); return; }
      if (!confirm('إرسال هالرسالة لكل الطلاب؟')) return;
      try {
        var res = await HCIApi.request('/api/admin/broadcast', {
          method: 'POST',
          body: { subject: subject, body: body }
        });
        broadcastModal.classList.remove('open');
        document.getElementById('broadcastSubject').value = '';
        document.getElementById('broadcastBody').value = '';
        alert('تم الإرسال لـ ' + (res.sent || 0) + ' طالب ✓');
        await loadMessages();
        await loadStats();
      } catch (err) {
        alert(err.message || 'تعذر الإرسال');
      }
    });
  }

  async function loadCommunityArticles() {
    var data = await HCIApi.adminFetchArticles();
    var list = (data && data.articles) || [];
    var root = document.getElementById('articlesList');
    var empty = document.getElementById('articlesEmpty');
    if (!root) return;
    root.innerHTML = '';
    if (!list.length) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    list.sort(function (a, b) {
      var rank = { pending: 0, approved: 1, rejected: 2 };
      return (rank[a.status] != null ? rank[a.status] : 9) - (rank[b.status] != null ? rank[b.status] : 9);
    });
    list.forEach(function (a) {
      var card = document.createElement('article');
      card.className = 'profile-card';
      card.style.marginBottom = '14px';
      var statusAr = a.status === 'approved' ? 'منشور' : (a.status === 'rejected' ? 'مرفوض' : (a.status === 'draft' ? 'مسودة' : 'بانتظارك'));
      var actions = a.status === 'pending'
        ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' +
          '<button type="button" class="btn-primary article-approve" data-id="' + a.id + '" style="padding:8px 14px;font-size:0.85rem;">موافقة ونشر</button>' +
          '<button type="button" class="btn-ghost article-reject" data-id="' + a.id + '" style="padding:8px 14px;font-size:0.85rem;">رفض</button>' +
          '</div>'
        : (a.status === 'approved'
          ? '<p style="margin:10px 0 0;"><a href="community-article.html?id=' + a.id + '" style="color:var(--gold)">عرض المنشور ↗</a></p>'
          : '<p style="margin:10px 0 0;color:var(--text-mid);font-size:0.85rem;">سبب الرفض: ' + escapeHtml(a.rejectReason || '—') + '</p>');
      card.innerHTML =
        '<p style="margin:0 0 6px;color:var(--gold);font-size:0.78rem;">' + statusAr + ' · ' + escapeHtml(a.authorName || '') +
        (a.userEmail ? (' · ' + escapeHtml(a.userEmail)) : '') + '</p>' +
        '<h3 style="margin:0 0 8px;font-size:1.05rem;">' + escapeHtml(a.title) + '</h3>' +
        '<p style="margin:0;color:var(--text-mid);font-size:0.9rem;line-height:1.75;white-space:pre-wrap;">' +
        escapeHtml(a.body) + '</p>' + actions;
      root.appendChild(card);
    });

    root.querySelectorAll('.article-approve').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('نشر هذا المقال للجميع؟')) return;
        try {
          await HCIApi.adminApproveArticle(btn.getAttribute('data-id'));
          await loadCommunityArticles();
          await loadStats();
        } catch (err) { alert(err.message); }
      });
    });
    root.querySelectorAll('.article-reject').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var reason = prompt('سبب الرفض (يظهر لكاتب المقال):', 'أعد الصياغة أو وضّح الفكرة أكثر.');
        if (reason === null) return;
        try {
          await HCIApi.adminRejectArticle(btn.getAttribute('data-id'), reason);
          await loadCommunityArticles();
          await loadStats();
        } catch (err) { alert(err.message); }
      });
    });
  }

  function formatShareTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar-SA', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return iso; }
  }

  function contactLine(email, phone) {
    return [email, phone].filter(Boolean).join(' · ') || '—';
  }

  async function loadShareAdmin() {
    var data = await HCIApi.request('/api/admin/share');
    var t = (data && data.totals) || {};
    var elSharers = document.getElementById('shareStatSharers');
    var elEntries = document.getElementById('shareStatEntries');
    var elSignups = document.getElementById('shareStatSignups');
    if (elSharers) elSharers.textContent = t.sharers != null ? t.sharers : 0;
    if (elEntries) elEntries.textContent = t.uniqueEntries != null ? t.uniqueEntries : (t.entries || 0);
    if (elSignups) elSignups.textContent = t.signups != null ? t.signups : 0;

    var sharers = data.sharers || [];
    var sharersBody = document.getElementById('shareSharersBody');
    var sharersMobile = document.getElementById('shareSharersMobile');
    var sharersEmpty = document.getElementById('shareSharersEmpty');
    if (sharersEmpty) sharersEmpty.style.display = sharers.length ? 'none' : 'block';
    if (sharersBody) {
      sharersBody.innerHTML = sharers.map(function (s) {
        return '<tr>' +
          '<td><strong>' + escapeHtml(s.name) + '</strong><div style="color:var(--text-mid);font-size:0.75rem">#' + s.id + '</div></td>' +
          '<td>' + escapeHtml(contactLine(s.email, s.phone)) + '</td>' +
          '<td>' + Number(s.unique || 0) + '</td>' +
          '<td>' + Number(s.signups || 0) + '</td>' +
          '</tr>';
      }).join('');
    }
    if (sharersMobile) {
      sharersMobile.innerHTML = sharers.map(function (s) {
        return '<div class="admin-user-card"><strong>' + escapeHtml(s.name) + '</strong>' +
          '<div class="meta">دخلوا عبره: ' + Number(s.unique || 0) +
          '<br>سجّلوا عبره: ' + Number(s.signups || 0) +
          '<br>' + escapeHtml(contactLine(s.email, s.phone)) + '</div></div>';
      }).join('');
    }

    var entries = data.entries || [];
    var entriesBody = document.getElementById('shareEntriesBody');
    var entriesMobile = document.getElementById('shareEntriesMobile');
    var entriesEmpty = document.getElementById('shareEntriesEmpty');
    if (entriesEmpty) entriesEmpty.style.display = entries.length ? 'none' : 'block';
    if (entriesBody) {
      entriesBody.innerHTML = entries.map(function (e) {
        var visitor = e.visitorName || e.signupName || 'زائر';
        var signup = e.signupName ? ('سجّل: ' + e.signupName) : '—';
        return '<tr>' +
          '<td>' + escapeHtml(formatShareTime(e.at)) + '</td>' +
          '<td>' + escapeHtml(e.sharerName || ('#' + e.sharerId)) + '</td>' +
          '<td>' + escapeHtml(visitor) + '</td>' +
          '<td>' + escapeHtml(signup) + '</td>' +
          '</tr>';
      }).join('');
    }
    if (entriesMobile) {
      entriesMobile.innerHTML = entries.map(function (e) {
        var visitor = e.visitorName || e.signupName || 'زائر';
        return '<div class="admin-user-card"><strong>' + escapeHtml(visitor) + '</strong>' +
          '<div class="meta">دخل عبر: ' + escapeHtml(e.sharerName || '') +
          '<br>' + escapeHtml(formatShareTime(e.at)) +
          (e.signupName ? ('<br>سجّل: ' + escapeHtml(e.signupName)) : '') +
          '</div></div>';
      }).join('');
    }

    var signups = data.signups || [];
    var signupsBody = document.getElementById('shareSignupsBody');
    var signupsMobile = document.getElementById('shareSignupsMobile');
    var signupsEmpty = document.getElementById('shareSignupsEmpty');
    if (signupsEmpty) signupsEmpty.style.display = signups.length ? 'none' : 'block';
    if (signupsBody) {
      signupsBody.innerHTML = signups.map(function (u) {
        return '<tr>' +
          '<td><strong>' + escapeHtml(u.name) + '</strong><div style="color:var(--text-mid);font-size:0.75rem">' +
          escapeHtml(contactLine(u.email, u.phone)) + '</div></td>' +
          '<td>' + escapeHtml(u.viaName || ('#' + u.viaId)) + '</td>' +
          '<td>' + escapeHtml(formatShareTime(u.at)) + '</td>' +
          '</tr>';
      }).join('');
    }
    if (signupsMobile) {
      signupsMobile.innerHTML = signups.map(function (u) {
        return '<div class="admin-user-card"><strong>' + escapeHtml(u.name) + '</strong>' +
          '<div class="meta">عبر: ' + escapeHtml(u.viaName || '') +
          '<br>' + escapeHtml(formatShareTime(u.at)) + '</div></div>';
      }).join('');
    }
  }

  async function loadContacts() {
    var data = await HCIApi.request('/api/admin/contacts');
    var list = document.getElementById('contactsList');
    var empty = document.getElementById('contactsEmpty');
    list.innerHTML = '';

    if (!data.contacts.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    data.contacts.forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'admin-contact-card';
      card.setAttribute('data-id', String(c.id));

      var replyBlock = '';
      if (c.reply) {
        replyBlock =
          '<div class="admin-contact-reply-done">' +
            '<strong>ردّك:</strong>' +
            '<p>' + escapeHtml(c.reply) + '</p>' +
            '<span>' + formatDate(c.repliedAt) + '</span>' +
          '</div>';
      } else {
        replyBlock =
          '<div class="admin-contact-reply-box">' +
            '<label for="reply-' + c.id + '">اكتب ردك — يطلع تنبيه عند المرسل</label>' +
            '<textarea id="reply-' + c.id + '" class="admin-contact-reply-input" rows="3" placeholder="مثال: تم استلام رسالتك وسأرد عليك قريباً…"></textarea>' +
            '<div class="admin-contact-reply-actions">' +
              '<button type="button" class="btn-primary reply-contact-btn" data-id="' + c.id + '">إرسال الرد</button>' +
              (c.status === 'new'
                ? '<button type="button" class="done-contact-btn" data-id="' + c.id + '">تم الاطلاع</button>'
                : '') +
              '<button type="button" class="del-btn del-contact-btn" data-id="' + c.id + '" data-name="' + escapeHtml(c.name) + '">حذف</button>' +
            '</div>' +
            (!c.canNotify
              ? '<p class="admin-contact-hint">ما لقينا حساب مرتبط — الرد يُحفظ هنا، والتنبيه يوصل فقط لو كان مسجّل.</p>'
              : '<p class="admin-contact-hint">التنبيه يوصل مباشرة لجرس الإشعارات عنده.</p>') +
          '</div>';
      }

      var deleteOnly =
        c.reply
          ? '<div class="admin-contact-reply-actions" style="margin-top:10px;">' +
              '<button type="button" class="del-btn del-contact-btn" data-id="' + c.id + '" data-name="' + escapeHtml(c.name) + '">حذف الرسالة</button>' +
            '</div>'
          : '';

      card.innerHTML =
        '<div class="admin-contact-top">' +
          '<strong>' + escapeHtml(c.name) + '</strong>' +
          '<span>' + formatDate(c.createdAt) +
            (c.status === 'done' ? ' · تم' : ' · جديد') + '</span>' +
        '</div>' +
        '<div class="admin-contact-meta" dir="ltr">' + escapeHtml(c.contact || '—') + '</div>' +
        '<p class="admin-contact-msg">' + escapeHtml(c.message) + '</p>' +
        replyBlock + deleteOnly;
      list.appendChild(card);
    });

    list.querySelectorAll('.reply-contact-btn').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.getAttribute('data-id');
        var ta = document.getElementById('reply-' + id);
        var text = ta ? ta.value.trim() : '';
        if (text.length < 2) {
          alert('اكتب الرد أولاً');
          return;
        }
        b.disabled = true;
        try {
          var res = await HCIApi.request('/api/admin/contacts/' + id + '/reply', {
            method: 'POST',
            body: { reply: text }
          });
          alert(res.notified
            ? 'تم إرسال الرد — يطلع تنبيه عند المرسل ✓'
            : 'تم حفظ الرد. المرسل ما عنده حساب مرتبط فما يوصله تنبيه داخل المنصة.');
          await loadStats();
          await loadContacts();
        } catch (err) {
          alert(err.message || 'تعذر إرسال الرد');
          b.disabled = false;
        }
      });
    });

    list.querySelectorAll('.done-contact-btn').forEach(function (b) {
      b.addEventListener('click', async function () {
        await HCIApi.request('/api/admin/contacts/' + b.getAttribute('data-id') + '/done', { method: 'PATCH' });
        await loadStats();
        await loadContacts();
      });
    });

    list.querySelectorAll('.del-contact-btn').forEach(function (b) {
      b.addEventListener('click', async function () {
        var name = b.getAttribute('data-name') || 'هذي الرسالة';
        if (!confirm('حذف رسالة «' + name + '» نهائياً؟')) return;
        try {
          await HCIApi.request('/api/admin/contacts/' + b.getAttribute('data-id'), { method: 'DELETE' });
          await loadStats();
          await loadContacts();
        } catch (err) {
          alert(err.message || 'تعذر الحذف');
        }
      });
    });
  }

  async function loadReports() {
    var data = await HCIApi.request('/api/admin/reports');
    var list = document.getElementById('reportsList');
    var empty = document.getElementById('reportsEmpty');
    list.innerHTML = '';

    if (!data.reports.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    data.reports.forEach(function (r) {
      var div = document.createElement('div');
      div.style.cssText = 'padding:16px 0; border-bottom:1px solid var(--ink-3);';
      var statusLabel = r.status === 'done' ? 'تم التعامل' : 'جديد';
      var statusColor = r.status === 'done' ? 'var(--line-green)' : 'var(--line-amber)';
      div.innerHTML =
        '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px;">' +
          '<strong>' + r.name + '</strong>' +
          '<span style="color:' + statusColor + ';font-size:0.78rem;font-family:var(--font-mono)">' + statusLabel + '</span>' +
        '</div>' +
        '<p style="color:var(--text-mid);font-size:0.82rem;margin-bottom:6px;">' +
          (r.contact ? r.contact + ' · ' : '') +
          'صفحة: ' + (r.page || '—') + ' · ' + formatDate(r.createdAt) +
        '</p>' +
        '<p style="font-size:0.95rem;margin-bottom:10px;">' + r.message + '</p>' +
        (r.mediaPath
          ? (r.mediaType === 'video'
              ? '<video class="report-admin-media" src="' + r.mediaPath + '" controls playsinline style="max-width:100%;max-height:220px;border-radius:8px;margin-bottom:10px;"></video>'
              : '<a href="' + r.mediaPath + '" target="_blank" rel="noopener"><img class="report-admin-media" src="' + r.mediaPath + '" alt="مرفق البلاغ" style="max-width:100%;max-height:220px;border-radius:8px;margin-bottom:10px;display:block;"></a>')
          : '') +
        (r.status !== 'done'
          ? '<button type="button" class="done-report-btn" data-id="' + r.id + '" style="font-size:0.78rem;padding:6px 14px;border-radius:16px;border:1px solid var(--line-green);background:none;color:var(--line-green);cursor:pointer;font-family:var(--font-body)">تم التعامل ✓</button>'
          : '');
      list.appendChild(div);
    });

    list.querySelectorAll('.done-report-btn').forEach(function (b) {
      b.addEventListener('click', async function () {
        await HCIApi.request('/api/admin/reports/' + b.getAttribute('data-id') + '/done', { method: 'PATCH' });
        await loadStats();
        await loadReports();
      });
    });
  }

  function modeLabel(m) {
    if (m === 'onsite') return 'حضوري';
    if (m === 'hybrid') return 'مدمج';
    return 'عن بعد';
  }

  function setOffersSub(which) {
    var map = {
      offers: 'offersPaneOffers',
      interests: 'offersPaneInterests',
      partners: 'offersPanePartners'
    };
    Object.keys(map).forEach(function (k) {
      var pane = document.getElementById(map[k]);
      if (pane) pane.hidden = k !== which;
    });
    var bO = document.getElementById('offersSubOffers');
    var bI = document.getElementById('offersSubInterests');
    var bP = document.getElementById('offersSubPartners');
    if (bO) bO.classList.toggle('active', which === 'offers');
    if (bI) bI.classList.toggle('active', which === 'interests');
    if (bP) bP.classList.toggle('active', which === 'partners');
  }

  async function loadOffersAdmin() {
    var data = await HCIApi.request('/api/admin/offers');
    var offers = data.offers || [];
    var interests = data.interests || [];
    var partners = data.partners || [];

    var partnerSelect = document.getElementById('offerPartner');
    if (partnerSelect) {
      var cur = partnerSelect.value;
      partnerSelect.innerHTML = '<option value="">— بدون —</option>' +
        partners.map(function (p) {
          return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>';
        }).join('');
      if (cur) partnerSelect.value = cur;
    }

    var offersList = document.getElementById('offersList');
    var offersEmpty = document.getElementById('offersEmpty');
    if (offersList) {
      offersList.innerHTML = '';
      if (!offers.length) {
        if (offersEmpty) offersEmpty.hidden = false;
      } else if (offersEmpty) offersEmpty.hidden = true;
      offers.forEach(function (o) {
        var statusAr = o.status === 'published' ? 'منشور' : (o.status === 'archived' ? 'مؤرشف' : 'مسودة');
        var card = document.createElement('article');
        card.className = 'admin-contact-card';
        var actions = '';
        if (o.status !== 'published') {
          actions += '<button type="button" class="btn-primary offer-publish" data-id="' + o.id + '" style="padding:8px 12px;font-size:0.82rem;">نشر</button>';
        } else {
          actions += '<button type="button" class="btn-ghost offer-unpublish" data-id="' + o.id + '" style="padding:8px 12px;font-size:0.82rem;">إخفاء</button>';
        }
        actions += '<button type="button" class="del-btn offer-del" data-id="' + o.id + '">حذف</button>';
        card.innerHTML =
          '<div class="admin-contact-top">' +
            '<strong>' + escapeHtml(o.title) + '</strong>' +
            '<span>' + statusAr + ' · ' + (o.newInterests || 0) + ' اهتمام جديد</span>' +
          '</div>' +
          '<p class="admin-contact-meta">' + escapeHtml(o.companyName) + ' · ' + modeLabel(o.mode) +
            (o.city ? ' · ' + escapeHtml(o.city) : '') +
            ' · إجمالي الاهتمام: ' + (o.interestCount || 0) + '</p>' +
          '<p class="admin-contact-msg">' + escapeHtml(o.summary) + '</p>' +
          (o.link ? '<p style="margin:0 0 10px;"><a href="' + escapeHtml(o.link) + '" target="_blank" rel="noopener" style="color:var(--gold)">رابط العرض ↗</a></p>' : '') +
          '<div class="admin-contact-reply-actions">' + actions + '</div>';
        offersList.appendChild(card);
      });

      offersList.querySelectorAll('.offer-publish').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (!confirm('نشر العرض للطلاب؟')) return;
          var doNotify = confirm('تبي كمان تنبّه كل الطلاب بهالعرض؟');
          try {
            await HCIApi.request('/api/admin/offers/' + btn.getAttribute('data-id'), {
              method: 'PATCH',
              body: { status: 'published', notifyStudents: doNotify }
            });
            await loadOffersAdmin();
            await loadStats();
          } catch (err) { alert(err.message); }
        });
      });
      offersList.querySelectorAll('.offer-unpublish').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          try {
            await HCIApi.request('/api/admin/offers/' + btn.getAttribute('data-id'), {
              method: 'PATCH',
              body: { status: 'draft' }
            });
            await loadOffersAdmin();
            await loadStats();
          } catch (err) { alert(err.message); }
        });
      });
      offersList.querySelectorAll('.offer-del').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (!confirm('حذف هذا العرض وكل الاهتمامات المرتبطة؟')) return;
          try {
            await HCIApi.request('/api/admin/offers/' + btn.getAttribute('data-id'), { method: 'DELETE' });
            await loadOffersAdmin();
            await loadStats();
          } catch (err) { alert(err.message); }
        });
      });
    }

    var interestsList = document.getElementById('interestsList');
    var interestsEmpty = document.getElementById('interestsEmpty');
    if (interestsList) {
      interestsList.innerHTML = '';
      if (!interests.length) {
        if (interestsEmpty) interestsEmpty.hidden = false;
      } else if (interestsEmpty) interestsEmpty.hidden = true;
      interests.forEach(function (i) {
        var st = i.status === 'done' ? 'تم' : (i.status === 'contacted' ? 'تم التواصل' : 'جديد');
        var card = document.createElement('div');
        card.className = 'admin-contact-card';
        card.innerHTML =
          '<div class="admin-contact-top">' +
            '<strong>' + escapeHtml(i.name) + '</strong>' +
            '<span>' + st + ' · ' + formatDate(i.createdAt) + '</span>' +
          '</div>' +
          '<p class="admin-contact-meta">العرض: ' + escapeHtml(i.offerTitle) + '</p>' +
          '<p class="admin-contact-meta" dir="ltr">' + escapeHtml(i.contact || '—') + '</p>' +
          (i.note ? '<p class="admin-contact-msg">' + escapeHtml(i.note) + '</p>' : '') +
          '<div class="admin-contact-reply-actions">' +
            '<button type="button" class="btn-primary interest-msg" data-uid="' + i.userId + '" data-name="' + escapeHtml(i.name) + '" data-offer="' + escapeHtml(i.offerTitle) + '">راسل عبر المنصة</button>' +
            (i.status === 'new' ? '<button type="button" class="btn-ghost interest-mark" data-id="' + i.id + '" data-st="contacted">تم التواصل</button>' : '') +
            (i.status !== 'done' ? '<button type="button" class="done-contact-btn interest-mark" data-id="' + i.id + '" data-st="done">أرشف</button>' : '') +
          '</div>';
        interestsList.appendChild(card);
      });
      interestsList.querySelectorAll('.interest-msg').forEach(function (btn) {
        btn.addEventListener('click', function () {
          openMsgModal(btn.getAttribute('data-uid'), btn.getAttribute('data-name'));
          document.getElementById('msgSubject').value = 'بخصوص عرض: ' + (btn.getAttribute('data-offer') || '');
        });
      });
      interestsList.querySelectorAll('.interest-mark').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          try {
            await HCIApi.request('/api/admin/offer-interests/' + btn.getAttribute('data-id'), {
              method: 'PATCH',
              body: { status: btn.getAttribute('data-st') }
            });
            await loadOffersAdmin();
            await loadStats();
          } catch (err) { alert(err.message); }
        });
      });
    }

    var partnersList = document.getElementById('partnersList');
    var partnersEmpty = document.getElementById('partnersEmpty');
    if (partnersList) {
      var fullPartners = await HCIApi.request('/api/admin/partners');
      var plist = (fullPartners && fullPartners.partners) || [];
      partnersList.innerHTML = '';
      if (!plist.length) {
        if (partnersEmpty) partnersEmpty.hidden = false;
      } else if (partnersEmpty) partnersEmpty.hidden = true;
      plist.forEach(function (p) {
        var card = document.createElement('div');
        card.className = 'admin-contact-card';
        card.innerHTML =
          '<div class="admin-contact-top"><strong>' + escapeHtml(p.name) + '</strong>' +
          '<button type="button" class="del-btn partner-del" data-id="' + p.id + '">حذف</button></div>' +
          '<p class="admin-contact-meta">' + escapeHtml(p.contactName || '—') +
            (p.phone ? ' · ' + escapeHtml(p.phone) : '') +
            (p.email ? ' · ' + escapeHtml(p.email) : '') + '</p>' +
          (p.website ? '<p style="margin:0 0 8px;"><a href="' + escapeHtml(p.website) + '" target="_blank" rel="noopener" style="color:var(--gold)" dir="ltr">' + escapeHtml(p.website) + '</a></p>' : '') +
          (p.notes ? '<p class="admin-contact-msg">' + escapeHtml(p.notes) + '</p>' : '');
        partnersList.appendChild(card);
      });
      partnersList.querySelectorAll('.partner-del').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (!confirm('حذف هالشركة من القائمة؟')) return;
          try {
            await HCIApi.request('/api/admin/partners/' + btn.getAttribute('data-id'), { method: 'DELETE' });
            await loadOffersAdmin();
          } catch (err) { alert(err.message); }
        });
      });
    }
  }

  (function wireOffersForms() {
    var subO = document.getElementById('offersSubOffers');
    var subI = document.getElementById('offersSubInterests');
    var subP = document.getElementById('offersSubPartners');
    if (subO) subO.addEventListener('click', function () { setOffersSub('offers'); });
    if (subI) subI.addEventListener('click', function () { setOffersSub('interests'); });
    if (subP) subP.addEventListener('click', function () { setOffersSub('partners'); });

    async function createOffer(publish) {
      var body = {
        companyName: document.getElementById('offerCompany').value.trim(),
        title: document.getElementById('offerTitle').value.trim(),
        summary: document.getElementById('offerSummary').value.trim(),
        mode: document.getElementById('offerMode').value,
        city: document.getElementById('offerCity').value.trim(),
        link: document.getElementById('offerLink').value.trim(),
        partnerId: document.getElementById('offerPartner').value || null,
        publish: !!publish,
        notifyStudents: !!(publish && document.getElementById('offerNotify').checked)
      };
      await HCIApi.request('/api/admin/offers', { method: 'POST', body: body });
      document.getElementById('offerCreateForm').reset();
      await loadOffersAdmin();
      await loadStats();
      alert(publish ? 'نُشر العرض للطلاب ✓' : 'اتحفظت المسودة ✓');
    }

    var form = document.getElementById('offerCreateForm');
    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        try { await createOffer(false); } catch (err) { alert(err.message); }
      });
    }
    var pubBtn = document.getElementById('offerPublishBtn');
    if (pubBtn) {
      pubBtn.addEventListener('click', async function () {
        try { await createOffer(true); } catch (err) { alert(err.message); }
      });
    }
    var pForm = document.getElementById('partnerCreateForm');
    if (pForm) {
      pForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        try {
          await HCIApi.request('/api/admin/partners', {
            method: 'POST',
            body: {
              name: document.getElementById('partnerName').value.trim(),
              contactName: document.getElementById('partnerContact').value.trim(),
              phone: document.getElementById('partnerPhone').value.trim(),
              email: document.getElementById('partnerEmail').value.trim(),
              website: document.getElementById('partnerWeb').value.trim(),
              notes: document.getElementById('partnerNotes').value.trim()
            }
          });
          pForm.reset();
          await loadOffersAdmin();
          alert('تم حفظ الشركة ✓');
        } catch (err) { alert(err.message); }
      });
    }
  })();

  var msgModal = document.getElementById('msgModal');
  function openMsgModal(id, name) {
    document.getElementById('msgUserId').value = id;
    document.getElementById('msgModalSub').textContent = 'إلى: ' + name;
    document.getElementById('msgSubject').value = '';
    document.getElementById('msgBody').value = '';
    msgModal.classList.add('open');
  }
  document.getElementById('msgCancel').addEventListener('click', function () {
    msgModal.classList.remove('open');
  });
  document.getElementById('msgSend').addEventListener('click', async function () {
    try {
      await HCIApi.request('/api/admin/message', {
        method: 'POST',
        body: {
          userId: Number(document.getElementById('msgUserId').value),
          subject: document.getElementById('msgSubject').value,
          body: document.getElementById('msgBody').value
        }
      });
      msgModal.classList.remove('open');
      await loadStats();
      alert('تم إرسال الرسالة. سيظهر تنبيه للطالب عند فتح المنصة.');
    } catch (err) {
      alert(err.message);
    }
  });

  var detailModal = document.getElementById('detailModal');
  var currentDetailId = null;
  var currentDetailName = '';
  async function openDetail(id) {
    currentDetailId = id;
    var data = await HCIApi.request('/api/admin/users/' + id);
    var u = data.user;
    var p = data.progress;
    currentDetailName = u.fullName;
    document.getElementById('detailTitle').textContent = u.fullName;
    document.getElementById('detailSub').textContent =
      'معرّف #' + u.id + ' · انضم ' + formatDate(u.createdAt);

    var journey = (p && p.journey) || {};
    var done = journey.done || {};
    var stageLabels = {
      discover: 'اكتشف التخصص',
      fundamentals: 'أساسيات HCI',
      coding: 'ترميز HTML & CSS',
      courses: 'دورات متخصصة',
      books: 'كتب ومراجع',
      practice: 'تعلّم بالمرح',
      contribute: 'أفد غيرك'
    };
    var stageOrder = ['discover', 'fundamentals', 'coding', 'courses', 'books', 'practice', 'contribute'];
    var stopLabel = 'أكمل الرحلة';
    for (var i = 0; i < stageOrder.length; i++) {
      if (!done[stageOrder[i]]) {
        stopLabel = stageLabels[stageOrder[i]];
        break;
      }
    }
    var doneCount = stageOrder.filter(function (sid) { return !!done[sid]; }).length;

    var fund = p && p.quiz && p.quiz.fundamentals ? p.quiz.fundamentals : null;
    var quizHtml = '<strong>اختبار الأساسيات:</strong> ما اختبر بعد';
    if (fund) {
      quizHtml =
        '<strong>اختبار الأساسيات:</strong> ' + fund.score + '/' + fund.total +
        (fund.passed ? ' (اجتاز ✓)' : ' (لم يجتز)') +
        '<br><strong>آخر محاولة:</strong> ' + formatDate(fund.updatedAt);
      if (fund.answers && fund.answers.length) {
        quizHtml += '<ul style="margin:8px 0 0; padding-inline-start:18px;">';
        fund.answers.forEach(function (a) {
          quizHtml +=
            '<li style="margin-bottom:6px;">' +
            (a.ok ? '✓ ' : '✕ ') +
            escapeHtml(a.title || a.qid) +
            (a.ok ? '' : ' <span style="color:var(--text-mid)">(اختار ' + escapeHtml(a.chosen) + ')</span>') +
            '</li>';
        });
        quizHtml += '</ul>';
      }
    }

    document.getElementById('detailInfo').innerHTML =
      '<strong>الاسم الحالي:</strong> ' + escapeHtml(u.fullName) + '<br>' +
      '<strong>البريد:</strong> ' + (u.email || '—') +
        (u.email ? ' · ' + (u.emailVerified ? '<span style="color:var(--line-green)">متحقق ✓</span>' : '<span style="color:var(--line-amber)">غير متحقق</span>') : '') + '<br>' +
      '<strong>الجوال:</strong> ' + (u.phone || '—') +
        (u.phone ? ' · ' + (u.phoneVerified ? '<span style="color:var(--line-green)">متحقق ✓</span>' : '<span style="color:var(--line-amber)">غير متحقق</span>') : '') + '<br>' +
      '<strong>المسار:</strong> ' + (u.pathType === 'specialist' ? 'متخصص' : (u.pathType === 'curious' ? 'مهتم' : 'لم يُختر')) + '<br>' +
      '<strong>آخر دخول:</strong> ' + formatDate(u.lastLogin) + '<br>' +
      '<strong>آخر تحديث للتقدّم:</strong> ' + formatDate(p && p.updatedAt) + '<br>' +
      '<strong>توقف عند:</strong> <span style="color:var(--gold)">' + stopLabel + '</span> · ' + doneCount + '/7 مراحل<br>' +
      '<strong>آخر تغيير لكلمة المرور:</strong> ' + formatDate(u.passwordChangedAt) + '<br>' +
      '<strong>حالة كلمة المرور:</strong> <span style="color:var(--gold)">' + (u.passwordStatus || 'مشفّرة') + '</span> — لا تُعرض كنص<br>' +
      nameHistoryHtml(u.nameHistory) +
      '<div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--ink-3);">' + quizHtml + '</div>';

    document.getElementById('detailNotes').value = u.notes || '';
    document.getElementById('detailNewPass').value = '';
    var prevEl = document.getElementById('detailPrevPass');
    if (prevEl) {
      prevEl.textContent = 'غير قابلة للعرض — محفوظة بشكل مشفّر' +
        (u.passwordChangedAt ? ' · آخر تغيير: ' + formatDate(u.passwordChangedAt) : '');
    }
    var passResult = document.getElementById('detailPassResult');
    if (passResult) {
      passResult.hidden = true;
      passResult.textContent = '';
    }
    document.getElementById('detailProgress').textContent =
      JSON.stringify(data.progress, null, 2);
    detailModal.classList.add('open');
  }

  function generateTempPassword() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    var out = '';
    for (var i = 0; i < 10; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  function copyText(text) {
    if (!text) return Promise.reject(new Error('فارغ'));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        resolve();
      } catch (e) {
        reject(e);
      }
      ta.remove();
    });
  }

  document.getElementById('detailGenPass').addEventListener('click', function () {
    var pass = generateTempPassword();
    document.getElementById('detailNewPass').value = pass;
    var result = document.getElementById('detailPassResult');
    result.hidden = false;
    result.textContent = 'كلمة مولَّدة (ما انحفظت بعد): ' + pass;
  });

  document.getElementById('detailCopyPass').addEventListener('click', async function () {
    var pass = document.getElementById('detailNewPass').value.trim();
    if (!pass) {
      alert('ما فيه كلمة لنسخها — ولّد أو اكتب أولاً');
      return;
    }
    try {
      await copyText(pass);
      alert('تم النسخ ✓');
    } catch (e) {
      alert('تعذر النسخ — انسخها يدوياً:\n' + pass);
    }
  });

  function nameHistoryHtml(history) {
    if (!history || !history.length) {
      return '<strong>سجل تغيير الاسم:</strong> لا يوجد تغييرات مسجّلة';
    }
    var rows = history.map(function (h) {
      return '<li style="margin-bottom:6px;">من «' + escapeHtml(h.oldName) +
        '» إلى «' + escapeHtml(h.newName) +
        '» — <span style="color:var(--text-mid)">' + formatDate(h.changedAt) + '</span></li>';
    }).join('');
    return '<strong>سجل تغيير الاسم:</strong><ul style="margin:8px 0 0 0; padding-inline-start:18px;">' + rows + '</ul>';
  }
  document.getElementById('detailClose').addEventListener('click', function () {
    detailModal.classList.remove('open');
  });
  document.getElementById('detailSaveNotes').addEventListener('click', async function () {
    await HCIApi.request('/api/admin/users/' + currentDetailId, {
      method: 'PATCH',
      body: { notes: document.getElementById('detailNotes').value }
    });
    alert('تم حفظ الملاحظات ✓');
  });
  document.getElementById('detailResetPass').addEventListener('click', async function () {
    var pass = document.getElementById('detailNewPass').value.trim();
    if (pass.length < 8) {
      alert('كلمة المرور الجديدة لازم 8 أحرف على الأقل');
      return;
    }
    if (!confirm('تعيين كلمة مرور جديدة لحساب «' + currentDetailName + '»؟\n\nالكلمة القديمة تنمحي وما ترجع.')) return;
    try {
      var res = await HCIApi.request('/api/admin/users/' + currentDetailId + '/reset-password', {
        method: 'POST',
        body: { newPassword: pass }
      });
      var result = document.getElementById('detailPassResult');
      result.hidden = false;
      result.textContent = 'كلمة المرور الجديدة (احفظها الآن): ' + res.temporaryPassword;
      try { await copyText(res.temporaryPassword); } catch (e) { /* */ }
      alert('تم التعيين ✓\n\nالكلمة الجديدة:\n' + res.temporaryPassword + '\n\n(اننسخت للحافظة إن أمكن)');
      await openDetail(currentDetailId);
      document.getElementById('detailNewPass').value = res.temporaryPassword;
      result = document.getElementById('detailPassResult');
      result.hidden = false;
      result.textContent = 'كلمة المرور الجديدة (احفظها الآن): ' + res.temporaryPassword;
    } catch (err) {
      alert(err.message);
    }
  });
  document.getElementById('detailDelete').addEventListener('click', async function () {
    if (!confirm('حذف حساب «' + currentDetailName + '» نهائياً؟ لا يمكن التراجع.')) return;
    await HCIApi.request('/api/admin/users/' + currentDetailId, { method: 'DELETE' });
    detailModal.classList.remove('open');
    await loadStats();
    await loadUsers();
  });

  try {
    await loadStats();
    await loadUsers();
    openTabFromHash();
    window.addEventListener('hashchange', openTabFromHash);
  } catch (err) {
    console.warn('تعذر تحميل بيانات الإدارة:', err && err.message);
  }
})();

