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
    welcomeTitle.textContent = 'أهلاً بك أيها المدير، ' + (me.user.firstName || me.user.fullName || '');
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

  async function loadStats() {
    var s = await HCIApi.request('/api/admin/stats');
    document.getElementById('statStudents').textContent = s.students;
    document.getElementById('statActive').textContent = s.activeWeek;
    document.getElementById('statMessages').textContent = s.messages;
    document.getElementById('statReports').textContent = s.reports;
    var contactsStat = document.getElementById('statContacts');
    if (contactsStat) contactsStat.textContent = s.contacts != null ? s.contacts : '—';
    var qa = document.getElementById('statQuizAttempts');
    var qp = document.getElementById('statQuizPasses');
    if (qa) qa.textContent = s.quizAttempts != null ? s.quizAttempts : '—';
    if (qp) qp.textContent = s.quizPasses != null ? s.quizPasses : '—';
    var miss = document.getElementById('mostMissedQ');
    if (miss) {
      if (s.mostMissed && s.mostMissed.title) {
        miss.textContent = s.mostMissed.title + ' — أُجيب خطأ ' + s.mostMissed.wrong + ' مرة';
      } else {
        miss.textContent = 'ما فيه بيانات اختبار بعد — لما الطلاب يحلّون الأساسيات تظهر هنا.';
      }
    }
    var gen = document.getElementById('adminGeneratedAt');
    if (gen) gen.textContent = s.generatedAt ? ('آخر تحديث للإحصائيات: ' + formatDate(s.generatedAt)) : '';

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

  async function loadUsers() {
    var data = await HCIApi.request('/api/admin/users');
    var body = document.getElementById('usersBody');
    var mobile = document.getElementById('usersMobile');
    var empty = document.getElementById('usersEmpty');
    body.innerHTML = '';
    if (mobile) mobile.innerHTML = '';

    if (!data.users.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    data.users.forEach(function (u) {
      var contact = u.email || u.phone || '—';
      var pathLabel = u.pathType === 'specialist' ? 'متخصص' : (u.pathType === 'curious' ? 'مهتم' : '—');
      var stopLabel = u.stopPoint || '—';
      var quizLabel = u.quizScore
        ? (u.quizPassed ? '✓ ' + u.quizScore : '✕ ' + u.quizScore)
        : 'ما اختبر بعد';
      var actions =
        '<div class="admin-actions">' +
          '<button type="button" class="view-btn" data-id="' + u.id + '">تفاصيل</button>' +
          '<button type="button" class="msg-btn" data-id="' + u.id + '" data-name="' + u.fullName + '">رسالة</button>' +
          '<button type="button" class="del-btn" data-id="' + u.id + '" data-name="' + u.fullName + '">حذف</button>' +
        '</div>';

      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><strong>' + u.fullName + '</strong><br><span style="font-size:0.72rem;color:var(--text-mid)">' + pathLabel +
          (u.nameChanged ? ' · تغيّر الاسم' : '') + '<br dir="ltr">' + contact + '</span></td>' +
        '<td><span class="pct-pill">' + stopLabel + '</span></td>' +
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
          '<div class="admin-user-card-top"><strong>' + u.fullName + '</strong><span>' + u.progressPercent + '%</span></div>' +
          '<p style="color:var(--text-mid);font-size:0.85rem;margin:6px 0;">توقف عند: ' + stopLabel + '</p>' +
          '<p style="color:var(--text-mid);font-size:0.85rem;margin:0 0 6px;">اختبار: ' + quizLabel + '</p>' +
          '<p style="color:var(--text-mid);font-size:0.8rem;margin:0 0 10px;">آخر دخول: ' + formatDate(u.lastLogin) + ' · تحديث: ' + formatDate(u.progressUpdated) + '</p>' +
          actions;
        mobile.appendChild(card);
      }
    });
    bindUserActions(body);
    if (mobile) bindUserActions(mobile);
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

  function setAdminTab(active) {
    ['tabUsers', 'tabMessages', 'tabReports', 'tabContacts'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('active', id === active);
    });
    document.getElementById('panelUsers').hidden = active !== 'tabUsers';
    document.getElementById('panelMessages').hidden = active !== 'tabMessages';
    document.getElementById('panelReports').hidden = active !== 'tabReports';
    var panelContacts = document.getElementById('panelContacts');
    if (panelContacts) panelContacts.hidden = active !== 'tabContacts';
  }

  document.getElementById('tabUsers').addEventListener('click', function () {
    setAdminTab('tabUsers');
  });

  document.getElementById('tabMessages').addEventListener('click', function () {
    setAdminTab('tabMessages');
    loadMessages().catch(function (e) { alert(e.message); });
  });

  document.getElementById('tabReports').addEventListener('click', function () {
    setAdminTab('tabReports');
    loadReports().catch(function (e) { alert(e.message); });
  });

  document.getElementById('tabContacts').addEventListener('click', function () {
    setAdminTab('tabContacts');
    loadContacts().catch(function (e) { alert(e.message); });
  });

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
            '</div>' +
            (!c.canNotify
              ? '<p class="admin-contact-hint">ما لقينا حساب مرتبط — الرد يُحفظ هنا، والتنبيه يوصل فقط لو كان مسجّل.</p>'
              : '<p class="admin-contact-hint">التنبيه يوصل مباشرة لجرس الإشعارات عنده.</p>') +
          '</div>';
      }

      card.innerHTML =
        '<div class="admin-contact-top">' +
          '<strong>' + escapeHtml(c.name) + '</strong>' +
          '<span>' + formatDate(c.createdAt) +
            (c.status === 'done' ? ' · تم' : ' · جديد') + '</span>' +
        '</div>' +
        '<div class="admin-contact-meta" dir="ltr">' + escapeHtml(c.contact || '—') + '</div>' +
        '<p class="admin-contact-msg">' + escapeHtml(c.message) + '</p>' +
        replyBlock;
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
  } catch (err) {
    console.warn('تعذر تحميل بيانات الإدارة:', err && err.message);
  }
})();
