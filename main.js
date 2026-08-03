/* ============================================
   main.js — محرك المنصة: تقدم، فتح مراحل، تفاعل
   ============================================ */

// ----- تفضيلات المظهر -----
var savedFontSize = localStorage.getItem('hci_font_size') || '18px';
document.documentElement.style.fontSize = savedFontSize;

var savedAccent = localStorage.getItem('hci_accent_color');
if (savedAccent){ document.documentElement.style.setProperty('--gold', savedAccent); }

(function applyThemeEarly(){
  var theme = localStorage.getItem('hci_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  if (document.body) document.body.setAttribute('data-theme', theme);
})();

function setTheme(theme){
  theme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  if (document.body) document.body.setAttribute('data-theme', theme);
  try { localStorage.setItem('hci_theme', theme); } catch (e) { /* */ }
}

// ----- نظام الرحلة (فتح تدريجي) -----
// المراحل بالترتيب: discover → fundamentals → coding → courses → books → practice → contribute
// practice يُفتح مع fundamentals (تعلم ممتع موازي)
// books يُفتح بعد courses أو بعد إكمال الترميز
// contribute يُفتح بعد إكمال 4 مراحل

var JOURNEY_ORDER = ['discover', 'fundamentals', 'coding', 'courses', 'books', 'practice', 'contribute'];

var STAGE_META = {
  discover:      { title: 'اكتشف التخصص', unlocks: 'fundamentals' },
  fundamentals:  { title: 'أساسيات HCI', unlocks: 'coding' },
  coding:        { title: 'ترميز HTML & CSS', unlocks: 'courses' },
  courses:       { title: 'الدورات المتخصصة', unlocks: 'books' },
  books:         { title: 'الكتب والمراجع', unlocks: null },
  practice:      { title: 'تعلّم بالمرح', unlocks: null },
  contribute:    { title: 'أفد غيرك', unlocks: null }
};

function getJourney(){
  try {
    return JSON.parse(localStorage.getItem('hci_journey') || '{}');
  } catch (e) {
    return {};
  }
}

function saveJourney(data){
  localStorage.setItem('hci_journey', JSON.stringify(data));
  if (window.HCIApi) HCIApi.scheduleSync();
}

function markVisited(stageId){
  var j = getJourney();
  if (!j.visited) j.visited = {};
  j.visited[stageId] = true;
  saveJourney(j);
}

function markComplete(stageId, silent){
  var j = getJourney();
  if (!j.done) j.done = {};
  if (!j.unlocked) j.unlocked = {};
  var wasNew = !j.done[stageId];
  j.done[stageId] = true;

  var toastMsg = '';

  // فتح المرحلة التالية في السلسلة
  var next = STAGE_META[stageId] && STAGE_META[stageId].unlocks;
  if (next && !j.unlocked[next] && !j.done[next]){
    j.unlocked[next] = true;
    toastMsg = 'فتحت مرحلة جديدة: ' + STAGE_META[next].title + ' ✨';
  } else if (next){
    j.unlocked[next] = true;
  }

  // التمارين تفتح بعد الاكتشاف أو الأساسيات
  if (stageId === 'discover' || stageId === 'fundamentals'){
    if (!j.unlocked.practice && !j.done.practice){
      j.unlocked.practice = true;
      if (!toastMsg) toastMsg = 'فتحت تمارين «تعلّم بالمرح» ✨';
    } else {
      j.unlocked.practice = true;
    }
  }

  // contribute بعد 4 مراحل مكتملة
  var doneCount = Object.keys(j.done).filter(function(k){ return j.done[k]; }).length;
  var contribWasLocked = !j.unlocked.contribute && !j.done.contribute;
  if (doneCount >= 4){
    j.unlocked.contribute = true;
    if (contribWasLocked){
      toastMsg = 'فتحت مرحلة «أفد غيرك» — صرت جاهز تساعد غيرك ✨';
    }
  }

  saveJourney(j);

  if (wasNew && !silent && toastMsg){
    showUnlockToast(toastMsg);
  }

  return wasNew;
}

function isUnlocked(stageId){
  // المتخصص: أغلب المراحل مفتوحة من البداية
  if (window.HCIApi && HCIApi.isSpecialist()) return true;

  // الأولى دائماً مفتوحة
  if (stageId === 'discover') return true;

  var j = getJourney();
  if (j.unlocked && j.unlocked[stageId]) return true;
  if (j.done && j.done[stageId]) return true;

  // فتح ضمني: fundamentals بعد زيارة discover أو إكماله
  if (stageId === 'fundamentals'){
    return !!(j.visited && j.visited.discover) || !!(j.done && j.done.discover) || !!(j.unlocked && j.unlocked.fundamentals);
  }

  // practice بعد fundamentals مفتوح أو مكتمل أو discover مكتمل
  if (stageId === 'practice'){
    return !!(j.done && j.done.fundamentals) || !!(j.unlocked && j.unlocked.practice) || !!(j.done && j.done.discover);
  }

  return false;
}

function isDone(stageId){
  var j = getJourney();
  return !!(j.done && j.done[stageId]);
}

function getOverallProgress(){
  var total = JOURNEY_ORDER.length;
  var done = 0;
  JOURNEY_ORDER.forEach(function(id){
    if (isDone(id)) done++;
  });
  return Math.round((done / total) * 100);
}

function showUnlockToast(message){
  var el = document.getElementById('unlockToast');
  if (!el){
    el = document.createElement('div');
    el.id = 'unlockToast';
    el.className = 'unlock-toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.classList.remove('is-lock');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(showUnlockToast._t);
  showUnlockToast._t = setTimeout(function(){ el.classList.remove('show'); }, 3200);
}

// أسباب القفل + رابط الخطوة المطلوبة لفتحها
var STAGE_LOCK_INFO = {
  fundamentals: {
    reason: 'لفتح «أساسيات HCI» أكمل أولاً محطة «اكتشف التخصص»، ثم اضغط «أكملت هالمرحلة».',
    href: 'discover.html',
    cta: 'افتح اكتشف التخصص'
  },
  coding: {
    reason: 'لفتح مسار الترميز اجتز اختبار أساسيات HCI بنتيجة 3 من 4 على الأقل.',
    href: 'fundamentals.html#quiz',
    cta: 'اذهب للاختبار'
  },
  courses: {
    reason: 'لفتح الدورات أكمل نصف دروس HTML و CSS على الأقل (50% من مسار الترميز).',
    href: 'coding.html',
    cta: 'أكمل مسار الترميز'
  },
  books: {
    reason: 'لفتح الكتب سجّل اهتمامك بدورة واحدة على الأقل من صفحة الدورات.',
    href: 'courses.html',
    cta: 'تصفح الدورات'
  },
  practice: {
    reason: 'لفتح التمارين أكمل أولاً محطة «اكتشف التخصص».',
    href: 'discover.html',
    cta: 'افتح اكتشف التخصص'
  },
  contribute: {
    reason: 'لفتح «أفد غيرك» أكمل 4 محطات على الأقل من رحلتك التعليمية.',
    href: 'index.html#paths',
    cta: 'عرض المسارات'
  }
};

function getLockReason(stageId){
  return (STAGE_LOCK_INFO[stageId] && STAGE_LOCK_INFO[stageId].reason) ||
    'لفتح هالمرحلة أكمل المحطة السابقة أولاً.';
}

function getLockInfo(stageId){
  return STAGE_LOCK_INFO[stageId] || {
    reason: getLockReason(stageId),
    href: 'index.html#paths',
    cta: 'عرض المسارات'
  };
}

/** تنبيه قفل مع خيار يودّيك للمكان المطلوب */
function showLockAlert(message, href, ctaLabel){
  var existing = document.getElementById('lockDialog');
  if (existing) existing.remove();

  var backdrop = document.createElement('div');
  backdrop.id = 'lockDialog';
  backdrop.className = 'lock-dialog-backdrop';
  backdrop.setAttribute('role', 'alertdialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'lockDialogTitle');

  backdrop.innerHTML =
    '<div class="lock-dialog">' +
      '<p class="lock-dialog-eyebrow">/// خطوة مطلوبة قبل المتابعة</p>' +
      '<h3 id="lockDialogTitle">كيف تفتح هالمرحلة؟</h3>' +
      '<p class="lock-dialog-reason">' + message + '</p>' +
      '<div class="lock-dialog-actions">' +
        '<button type="button" class="btn-ghost" id="lockDialogClose">لاحقاً</button>' +
        (href
          ? '<a href="' + href + '" class="btn-primary" id="lockDialogGo">' + (ctaLabel || 'الذهاب للخطوة المطلوبة') + '</a>'
          : '') +
      '</div>' +
    '</div>';

  document.body.appendChild(backdrop);
  requestAnimationFrame(function(){ backdrop.classList.add('show'); });

  function close(){
    backdrop.classList.remove('show');
    setTimeout(function(){ backdrop.remove(); }, 220);
  }

  document.getElementById('lockDialogClose').addEventListener('click', close);
  backdrop.addEventListener('click', function(e){
    if (e.target === backdrop) close();
  });
}

function showStageLock(stageId){
  var info = getLockInfo(stageId);
  showLockAlert(info.reason, info.href, info.cta);
}

function stageFromHref(href){
  if (!href) return null;
  var file = href.split('#')[0].split('?')[0].split('/').pop();
  var map = {
    'fundamentals.html': 'fundamentals',
    'coding.html': 'coding',
    'courses.html': 'courses',
    'books.html': 'books',
    'practice.html': 'practice',
    'contribute.html': 'contribute',
    'discover.html': 'discover'
  };
  return map[file] || null;
}

/** هل كل خانات المراجعة (✓) محددة؟ */
function getPageChecklists(){
  return document.querySelectorAll('.checklist.required-checklist, .checklist[data-required="true"]');
}

function ensureChecklistsComplete(){
  var lists = getPageChecklists();
  if (!lists.length) return { ok: true };

  var unchecked = [];
  lists.forEach(function(list){
    list.querySelectorAll('input[type="checkbox"]').forEach(function(cb){
      if (!cb.checked) unchecked.push(cb);
    });
  });

  if (!unchecked.length) return { ok: true };

  // أبرز أول قائمة ناقصة
  var firstList = unchecked[0].closest('.checklist');
  if (firstList){
    firstList.classList.add('checklist-warn');
    setTimeout(function(){ firstList.classList.remove('checklist-warn'); }, 2200);
    firstList.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return {
    ok: false,
    message: 'قبل ما تكمّل: لازم تضغط ✓ على كل بنود المراجعة فوق. كل خانة لازم تكون محددة.'
  };
}

function annotateChecklists(){
  document.querySelectorAll('.checklist').forEach(function(list){
    if (!list.classList.contains('required-checklist')) list.classList.add('required-checklist');
    list.setAttribute('data-required', 'true');
    if (!list.querySelector('.checklist-hint')){
      var hint = document.createElement('p');
      hint.className = 'checklist-hint';
      hint.textContent = 'مهم: لازم تحدد ✓ على كل البنود قبل ما تضغط «أكملت» أو «التالي».';
      var h4 = list.querySelector('h4');
      if (h4) h4.insertAdjacentElement('afterend', hint);
      else list.insertBefore(hint, list.firstChild);
    }
  });
}

// تهيئة: لو أول زيارة، fundamentals مقفول لين يزور discover
// لكن نسهّل الدخول: لو ضغط "ابدأ المسار" من الهوم يفتح discover+fundamentals
function bootstrapUnlockFromHome(){
  var j = getJourney();
  if (!j.unlocked) j.unlocked = {};
  // أول مرة: fundamentals مفتوح عشان ما نصدم المبتدئ — بس نحفزه يبدأ بـ discover
  if (!j.bootstrapped){
    j.unlocked.fundamentals = true;
    j.bootstrapped = true;
    saveJourney(j);
  }
}
bootstrapUnlockFromHome();

// ----- رجوع للأعلى -----
var backToTop = document.getElementById('backToTop');
if (backToTop){
  window.addEventListener('scroll', function(){
    backToTop.classList.toggle('show', window.scrollY > 420);
  }, { passive: true });
  backToTop.addEventListener('click', function(){
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
  });
}

// ----- قائمة الجوال / الآيباد -----
var menuBtn = document.getElementById('menuBtn');
var navLinks = document.getElementById('navLinks');
var navBackdrop = document.getElementById('navBackdrop');
if (!navBackdrop && document.body){
  navBackdrop = document.createElement('button');
  navBackdrop.type = 'button';
  navBackdrop.id = 'navBackdrop';
  navBackdrop.className = 'nav-backdrop';
  navBackdrop.setAttribute('aria-label', 'إغلاق القائمة');
  document.body.appendChild(navBackdrop);
}

function setNavOpen(isOpen){
  if (!navLinks || !menuBtn) return;
  navLinks.classList.toggle('is-open', isOpen);
  menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  document.body.classList.toggle('nav-open', isOpen);
  if (navBackdrop) navBackdrop.classList.toggle('is-visible', isOpen);
}

if (menuBtn && navLinks){
  menuBtn.addEventListener('click', function(e){
    e.stopPropagation();
    setNavOpen(!navLinks.classList.contains('is-open'));
  });
  navLinks.querySelectorAll('a').forEach(function(link){
    link.addEventListener('click', function(){ setNavOpen(false); });
  });
  if (navBackdrop){
    navBackdrop.addEventListener('click', function(){ setNavOpen(false); });
  }
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') setNavOpen(false);
  });
  window.addEventListener('resize', function(){
    if (window.innerWidth > 860) setNavOpen(false);
  });
  // أغلق القائمة عند التحميل لتفادي بقاء شريط مائل/جزئي
  setNavOpen(false);
}

// ----- حساب المستخدم -----
var loggedInName = localStorage.getItem('hci_user_name');

var greetingEl = document.getElementById('greeting');
if (greetingEl){
  var hour = new Date().getHours();
  var greetingText = 'أهلاً بك';
  if (hour < 12) { greetingText = 'صباح الخير'; }
  else if (hour < 17) { greetingText = 'مساء الخير'; }
  else { greetingText = 'مساء النور'; }

  if (loggedInName){ greetingText += '، يا ' + loggedInName; }
  else { greetingText += '، جاهز تتعلم اليوم؟'; }

  // حدّث النص فقط إذا تغيّر — يقلل القفز البصري
  var nextGreet = '/// ' + greetingText;
  if (greetingEl.textContent.trim() !== nextGreet) {
    greetingEl.textContent = nextGreet;
  }
}

var navCtaSlot = document.getElementById('navCtaSlot');
var heroCta = document.getElementById('heroCta');

function getUserAvatar(){
  try { return localStorage.getItem('hci_avatar') || ''; } catch (e) { return ''; }
}

function setUserAvatar(dataUrl){
  try {
    if (dataUrl) localStorage.setItem('hci_avatar', dataUrl);
    else localStorage.removeItem('hci_avatar');
  } catch (e) { /* مساحة التخزين ممتلئة */ }
}

function applyAvatarToEl(el, name){
  if (!el) return;
  var photo = getUserAvatar();
  var letter = (name || '?').charAt(0);
  if (photo){
    el.textContent = '';
    el.classList.add('has-photo');
    el.style.backgroundImage = 'url(' + photo + ')';
  } else {
    el.classList.remove('has-photo');
    el.style.backgroundImage = '';
    el.textContent = letter;
  }
}

function compressImageFile(file, maxSize, quality, callback){
  var reader = new FileReader();
  reader.onload = function(){
    var img = new Image();
    img.onload = function(){
      var canvas = document.createElement('canvas');
      var size = Math.min(img.width, img.height);
      var sx = (img.width - size) / 2;
      var sy = (img.height - size) / 2;
      canvas.width = maxSize;
      canvas.height = maxSize;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize);
      callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

if (navCtaSlot && loggedInName){
  var adminLink = (window.HCIApi && HCIApi.isAdmin())
    ? '<a href="admin.html">لوحة الإدارة</a>'
    : '';
  navCtaSlot.innerHTML =
    '<span class="nav-user-wrap">' +
      '<button type="button" class="nav-user" id="navUserMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="حسابك">' +
        '<span class="chip-avatar" id="navAvatarChip">' + loggedInName.charAt(0) + '</span>' +
        '<span class="nav-user-name">' + loggedInName + '</span>' +
      '</button>' +
      '<div class="nav-dropdown" id="navDropdown">' +
        '<a href="profile.html">الملف الشخصي</a>' +
        '<a href="settings.html">الإعدادات</a>' +
        adminLink +
        '<a href="#" id="logoutLink">تسجيل الخروج</a>' +
      '</div>' +
    '</span>';

  applyAvatarToEl(document.getElementById('navAvatarChip'), loggedInName);

  var navUserMenuBtn = document.getElementById('navUserMenuBtn');
  var navDropdown = document.getElementById('navDropdown');
  navUserMenuBtn.addEventListener('click', function(e){
    e.stopPropagation();
    var isOpen = navDropdown.classList.toggle('open');
    navUserMenuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
  document.addEventListener('click', function(event){
    if (!navUserMenuBtn.contains(event.target) && !navDropdown.contains(event.target)){
      navDropdown.classList.remove('open');
      navUserMenuBtn.setAttribute('aria-expanded', 'false');
    }
  });

  var logoutLink = document.getElementById('logoutLink');
  if (logoutLink && window.HCIApi){
    logoutLink.addEventListener('click', async function(e){
      e.preventDefault();
      await HCIApi.logout();
      window.location.href = 'index.html';
    });
  }

}

if (heroCta && loggedInName){
  heroCta.textContent = 'أكمل مسارك ←';
  heroCta.setAttribute('href', '#paths');
}

// ----- شريط التقدم العام -----
var overallFill = document.getElementById('overallProgressFill');
var overallPct = document.getElementById('overallProgressPct');
if (overallFill || overallPct){
  var pct = getOverallProgress();
  if (overallFill) overallFill.style.width = pct + '%';
  if (overallPct) overallPct.textContent = pct + '%';
}

// ----- تحديث محطات المسار على الصفحة الرئيسية -----
var stationsRoot = document.getElementById('stationsList');
if (stationsRoot){
  var stations = stationsRoot.querySelectorAll('[data-stage]');
  var currentAssigned = false;

  stations.forEach(function(station){
    var id = station.getAttribute('data-stage');
    var statusEl = station.querySelector('.station-status');
    var link = station.querySelector('.station-link');
    var unlocked = isUnlocked(id);
    var done = isDone(id);

    station.classList.toggle('is-locked', !unlocked);
    station.classList.toggle('is-done', done);

    if (!unlocked){
      station.removeAttribute('aria-current');
      if (statusEl){ statusEl.textContent = 'قريباً'; statusEl.className = 'station-status locked'; }
      if (link){
        link.classList.add('disabled');
        link.classList.add('show-lock-reason');
        link.setAttribute('aria-disabled', 'true');
        link.setAttribute('href', '#');
        link.textContent = 'كيف أفتحها؟';
        link.title = getLockReason(id);
        link.addEventListener('click', function(e){
          e.preventDefault();
          showStageLock(id);
        });
      }
    } else if (done){
      station.removeAttribute('aria-current');
      if (statusEl){ statusEl.textContent = 'مكتمل ✓'; statusEl.className = 'station-status done'; }
      if (link){ link.classList.remove('disabled'); }
    } else if (!currentAssigned){
      station.setAttribute('aria-current', 'step');
      currentAssigned = true;
      if (statusEl){ statusEl.textContent = 'مرحلتك الحالية'; statusEl.className = 'station-status open'; }
      if (link){ link.classList.remove('disabled'); }
    } else {
      station.removeAttribute('aria-current');
      if (statusEl){ statusEl.textContent = 'مفتوح'; statusEl.className = 'station-status open'; }
      if (link){ link.classList.remove('disabled'); }
    }
  });
}

// ----- بوابة القفل للصفحات -----
var lockGate = document.getElementById('lockGate');
var pageStage = document.body.getAttribute('data-page-stage');

if (pageStage){
  markVisited(pageStage);

  if (!isUnlocked(pageStage) && lockGate){
    var mainContent = document.getElementById('main');
    if (mainContent){ mainContent.hidden = true; }
    lockGate.hidden = false;
    var info = getLockInfo(pageStage);
    var gateP = lockGate.querySelector('p');
    if (gateP) gateP.textContent = info.reason;
    var gateHint = lockGate.querySelector('.lock-reason-box');
    if (!gateHint){
      gateHint = document.createElement('div');
      gateHint.className = 'lock-reason-box';
      gateHint.setAttribute('role', 'alert');
      var gateH = lockGate.querySelector('h1');
      if (gateH && gateH.nextSibling) lockGate.insertBefore(gateHint, gateH.nextSibling);
      else lockGate.appendChild(gateHint);
    }
    gateHint.innerHTML = '<strong>السبب:</strong> ' + info.reason;
    var gateBtn = lockGate.querySelector('a.btn-primary');
    if (gateBtn){
      gateBtn.href = info.href;
      gateBtn.textContent = info.cta;
    }
    showStageLock(pageStage);
  } else if (lockGate){
    lockGate.hidden = true;
  }
}

// تلميح قوائم المراجعة + شرط تحديد الكل قبل الإكمال/التالي
annotateChecklists();

// زر إكمال مرحلة (discover / courses / books / contribute)
var markCompleteBtn = document.getElementById('markCompleteBtn');
if (markCompleteBtn && pageStage){
  if (isDone(pageStage)){
    markCompleteBtn.textContent = 'أكملت هالمرحلة ✓';
    markCompleteBtn.disabled = true;
    markCompleteBtn.style.opacity = '0.7';
  }
  markCompleteBtn.addEventListener('click', function(){
    var check = ensureChecklistsComplete();
    if (!check.ok){
      showLockAlert(check.message, null, null);
      return;
    }
    markComplete(pageStage);
    markCompleteBtn.textContent = 'أكملت هالمرحلة ✓';
    markCompleteBtn.disabled = true;
    markCompleteBtn.style.opacity = '0.7';
    // حدّث شريط التقدم لو موجود
    if (overallFill) overallFill.style.width = getOverallProgress() + '%';
    if (overallPct) overallPct.textContent = getOverallProgress() + '%';
  });
}

// اعتراض أزرار «التالي» لو المرحلة اللي بعدها مقفولة أو المراجعة ناقصة
document.querySelectorAll('a[data-next-stage], .lesson-nav-footer a.btn-primary, .hero-actions a[href$=".html"]').forEach(function(link){
  link.addEventListener('click', function(e){
    var href = link.getAttribute('href') || '';
    var targetStage = link.getAttribute('data-next-stage') || stageFromHref(href);

    // أولاً: قوائم المراجعة في الصفحة الحالية
    var check = ensureChecklistsComplete();
    if (!check.ok){
      e.preventDefault();
      showLockAlert(check.message, null, null);
      return;
    }

    // ثانياً: هل المرحلة الهدف مفتوحة؟
    if (targetStage && targetStage !== 'discover' && !isUnlocked(targetStage)){
      e.preventDefault();
      showStageLock(targetStage);
    }
  });
});

// ----- أنيميشن الظهور عند التمرير -----
var revealEls = document.querySelectorAll('.reveal, .tl-item');
if (revealEls.length && 'IntersectionObserver' in window){
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (entry.isIntersecting){
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach(function(el){ io.observe(el); });
} else {
  revealEls.forEach(function(el){ el.classList.add('is-visible'); });
}

// ----- شريط تقدم القراءة -----
var readingFill = document.getElementById('readingProgressFill');
if (readingFill){
  window.addEventListener('scroll', function(){
    var doc = document.documentElement;
    var scrollTop = doc.scrollTop || document.body.scrollTop;
    var height = doc.scrollHeight - doc.clientHeight;
    var progress = height > 0 ? (scrollTop / height) * 100 : 0;
    readingFill.style.width = progress + '%';
  }, { passive: true });
}

// ----- نماذج الدخول / إنشاء حساب (مع قاعدة البيانات) -----
var tabLogin = document.getElementById('tabLogin');
var tabSignup = document.getElementById('tabSignup');
var formLogin = document.getElementById('formLogin');
var formSignup = document.getElementById('formSignup');
var statusMsg = document.getElementById('statusMsg');

var formReset = document.getElementById('formReset');
var formVerify = document.getElementById('formVerify');

function showTab(tab){
  var isLogin = tab === 'login';
  var isSignup = tab === 'signup';
  var isReset = tab === 'reset';
  var isVerify = tab === 'verify';
  if (tabLogin) tabLogin.classList.toggle('active', isLogin);
  if (tabSignup) tabSignup.classList.toggle('active', isSignup);
  if (formLogin) formLogin.classList.toggle('active', isLogin);
  if (formSignup) formSignup.classList.toggle('active', isSignup);
  if (formReset) formReset.classList.toggle('active', isReset);
  if (formVerify) formVerify.classList.toggle('active', isVerify);
  if (tabLogin) tabLogin.style.display = (isReset || isVerify) ? 'none' : '';
  if (tabSignup) tabSignup.style.display = (isReset || isVerify) ? 'none' : '';
  if (statusMsg) statusMsg.classList.remove('show');
}

function isValidEmail(value){
  var s = String(value || '').trim().toLowerCase();
  if (s.length < 6 || s.length > 100) return false;
  if (s.indexOf('..') !== -1) return false;
  // صيغة قياسية: اسم@نطاق.امتداد (الامتداد حرفان فأكثر)
  return /^[a-z0-9](?:[a-z0-9._%+\-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?)+$/i.test(s);
}

function normalizePhoneLocal(value){
  var digits = String(value || '').replace(/\D/g, '');
  // 9665xxxxxxxx → 05xxxxxxxx
  if (digits.indexOf('966') === 0 && digits.length >= 12) {
    digits = '0' + digits.slice(3);
  }
  // 5xxxxxxxx → 05xxxxxxxx
  if (digits.length === 9 && digits.charAt(0) === '5') {
    digits = '0' + digits;
  }
  return digits;
}

function isValidPhone(value){
  // جوال سعودي: 05xxxxxxxx بالضبط
  return /^05[0-9]{8}$/.test(normalizePhoneLocal(value));
}

function validateField(input, errorEl, checkFn){
  if (!input || !errorEl) return false;
  var ok = checkFn(input.value);
  errorEl.classList.toggle('show', !ok);
  return ok;
}

if (tabLogin && tabSignup && formLogin && formSignup && statusMsg){
  var params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'signup'){ showTab('signup'); }

  tabLogin.addEventListener('click', function(){ showTab('login'); });
  tabSignup.addEventListener('click', function(){ showTab('signup'); });

  // تبديل بريد / جوال عند التسجيل
  var contactMode = 'email';
  var useEmailBtn = document.getElementById('useEmailBtn');
  var usePhoneBtn = document.getElementById('usePhoneBtn');
  var emailFieldWrap = document.getElementById('emailFieldWrap');
  var phoneFieldWrap = document.getElementById('phoneFieldWrap');

  function setContactMode(mode){
    contactMode = mode;
    if (useEmailBtn) useEmailBtn.classList.toggle('active', mode === 'email');
    if (usePhoneBtn) usePhoneBtn.classList.toggle('active', mode === 'phone');
    if (emailFieldWrap) emailFieldWrap.hidden = mode !== 'email';
    if (phoneFieldWrap) phoneFieldWrap.hidden = mode !== 'phone';
  }
  if (useEmailBtn) useEmailBtn.addEventListener('click', function(){ setContactMode('email'); });
  if (usePhoneBtn) usePhoneBtn.addEventListener('click', function(){ setContactMode('phone'); });

  var serverHint = document.getElementById('serverHint');
  if (serverHint && location.protocol === 'file:'){
    serverHint.textContent = 'شغّل السيرفر أولاً: npm start ثم افتح http://localhost:3000/auth.html';
    serverHint.style.display = 'block';
  }

  // ---- تسجيل الدخول ----
  var loginIdentifier = document.getElementById('loginIdentifier');
  var loginPass = document.getElementById('loginPass');
  var loginIdentifierError = document.getElementById('loginIdentifierError');
  var loginPassError = document.getElementById('loginPassError');
  var loginSubmit = document.getElementById('loginSubmit');

  formLogin.addEventListener('submit', async function(event){
    event.preventDefault();
    var idOk = validateField(loginIdentifier, loginIdentifierError, function(v){
      return v.trim().length > 0 && (v.includes('@') ? isValidEmail(v) : isValidPhone(v));
    });
    var passOk = validateField(loginPass, loginPassError, function(v){ return v.length > 0; });
    if (!idOk || !passOk) return;

    if (!window.HCIApi){
      statusMsg.textContent = 'ملف api.js غير محمّل';
      statusMsg.classList.add('show');
      return;
    }

    loginSubmit.disabled = true;
    loginSubmit.textContent = 'جاري الدخول…';
    statusMsg.classList.remove('show');
    try {
      var data = await HCIApi.login(loginIdentifier.value.trim(), loginPass.value);
      // لا نعلّق الدخول على المزامنة — نكمل ولو فشلت/تأخّرت
      try { await HCIApi.syncProgress(); } catch (syncErr) { /* تجاهل */ }
      if (data.user.pathType === 'specialist') HCIApi.applySpecialistUnlocks();
      var dest = await HCIApi.afterAuthFlow(data.user, false);
      window.location.href = dest;
    } catch (err) {
      statusMsg.textContent = err.message || 'تعذر تسجيل الدخول';
      statusMsg.classList.add('show');
    } finally {
      loginSubmit.disabled = false;
      loginSubmit.textContent = 'تسجيل الدخول';
    }
  });

  // ---- إنشاء حساب ----
  var signupFirst = document.getElementById('signupFirst');
  var signupLast = document.getElementById('signupLast');
  var signupEmail = document.getElementById('signupEmail');
  var signupPhone = document.getElementById('signupPhone');
  var signupPass = document.getElementById('signupPass');
  var signupFirstError = document.getElementById('signupFirstError');
  var signupLastError = document.getElementById('signupLastError');
  var signupEmailError = document.getElementById('signupEmailError');
  var signupPhoneError = document.getElementById('signupPhoneError');
  var signupPassError = document.getElementById('signupPassError');
  var signupSubmit = document.getElementById('signupSubmit');

  // حدود وصيغة مباشرة أثناء الكتابة
  if (signupEmail){
    signupEmail.addEventListener('input', function(){
      if (signupEmail.value.length > 100) signupEmail.value = signupEmail.value.slice(0, 100);
      if (signupEmailError) signupEmailError.classList.remove('show');
    });
    signupEmail.addEventListener('blur', function(){
      signupEmail.value = signupEmail.value.trim().toLowerCase();
      if (signupEmail.value) validateField(signupEmail, signupEmailError, isValidEmail);
    });
  }
  if (signupPhone){
    signupPhone.setAttribute('maxlength', '10');
    signupPhone.addEventListener('keydown', function(e){
      // اسمح بمفاتيح التحكم والحذف والتنقل
      var allow = e.ctrlKey || e.metaKey || e.altKey ||
        e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' ||
        e.key === 'Enter' || e.key === 'Escape' ||
        e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
        e.key === 'Home' || e.key === 'End';
      if (allow) return;
      if (e.key.length === 1 && /\D/.test(e.key)) {
        e.preventDefault();
        return;
      }
      var selected = (signupPhone.selectionEnd || 0) - (signupPhone.selectionStart || 0);
      if (e.key.length === 1 && signupPhone.value.length - selected >= 10) {
        e.preventDefault();
      }
    });
    signupPhone.addEventListener('input', function(){
      // أرقام فقط، وبحد أقصى 10 — لا يمكن الزيادة
      var digits = signupPhone.value.replace(/\D/g, '').slice(0, 10);
      if (signupPhone.value !== digits) signupPhone.value = digits;
      if (signupPhoneError) signupPhoneError.classList.remove('show');
    });
    signupPhone.addEventListener('beforeinput', function(e){
      if (!e.data) return;
      if (/\D/.test(e.data)) {
        e.preventDefault();
        return;
      }
      var selected = (signupPhone.selectionEnd || 0) - (signupPhone.selectionStart || 0);
      var nextLen = signupPhone.value.length - selected + e.data.length;
      if (nextLen > 10) e.preventDefault();
    });
    signupPhone.addEventListener('blur', function(){
      var normalized = normalizePhoneLocal(signupPhone.value).slice(0, 10);
      if (normalized) signupPhone.value = normalized;
      if (signupPhone.value) validateField(signupPhone, signupPhoneError, isValidPhone);
    });
    signupPhone.addEventListener('paste', function(e){
      e.preventDefault();
      var text = '';
      try {
        text = (e.clipboardData || window.clipboardData).getData('text') || '';
      } catch (err) { text = ''; }
      var digits = String(text).replace(/\D/g, '').slice(0, 10);
      signupPhone.value = digits;
      if (signupPhoneError) signupPhoneError.classList.remove('show');
    });
  }

  formSignup.addEventListener('submit', async function(event){
    event.preventDefault();
    var firstOk = validateField(signupFirst, signupFirstError, function(v){ return v.trim().length >= 2; });
    var lastOk = validateField(signupLast, signupLastError, function(v){ return v.trim().length >= 2; });
    var passOk = validateField(signupPass, signupPassError, function(v){ return v.length >= 8; });

    var contactOk = false;
    if (contactMode === 'email'){
      if (signupEmail) signupEmail.value = signupEmail.value.trim().toLowerCase();
      contactOk = validateField(signupEmail, signupEmailError, isValidEmail);
      if (signupPhoneError) signupPhoneError.classList.remove('show');
    } else {
      if (signupPhone) signupPhone.value = normalizePhoneLocal(signupPhone.value);
      contactOk = validateField(signupPhone, signupPhoneError, isValidPhone);
      if (signupEmailError) signupEmailError.classList.remove('show');
    }

    if (!firstOk || !lastOk || !passOk || !contactOk) return;

    if (!window.HCIApi){
      statusMsg.textContent = 'ملف api.js غير محمّل';
      statusMsg.classList.add('show');
      return;
    }

    signupSubmit.disabled = true;
    signupSubmit.textContent = 'جاري الإنشاء…';
    statusMsg.classList.remove('show');
    try {
      var reg = await HCIApi.register({
        firstName: signupFirst.value.trim(),
        lastName: signupLast.value.trim(),
        email: contactMode === 'email' ? signupEmail.value.trim().toLowerCase() : null,
        phone: contactMode === 'phone' ? normalizePhoneLocal(signupPhone.value) : null,
        password: signupPass.value
      });
      try { await HCIApi.syncProgress(); } catch (syncErr) { /* تجاهل */ }
      // بعد التسجيل: تحقق من البريد/الجوال ثم اختيار المسار
      var verifyIdentifier = document.getElementById('verifyIdentifier');
      if (verifyIdentifier) {
        verifyIdentifier.value = contactMode === 'email'
          ? (signupEmail.value.trim())
          : (normalizePhoneLocal(signupPhone.value));
      }
      showTab('verify');
      statusMsg.textContent = 'الحساب جاهز — أكّد ملكية البريد أو الجوال برمز التحقق';
      statusMsg.classList.add('show');
      signupSubmit.disabled = false;
      signupSubmit.textContent = 'إنشاء الحساب';
    } catch (err) {
      statusMsg.textContent = err.message;
      statusMsg.classList.add('show');
      signupSubmit.disabled = false;
      signupSubmit.textContent = 'إنشاء الحساب';
    }
  });

  // ---- نسيت كلمة المرور ----
  var forgotOpenBtn = document.getElementById('forgotOpenBtn');
  var resetBackBtn = document.getElementById('resetBackBtn');
  var resetSendCode = document.getElementById('resetSendCode');
  var resetDemoCode = document.getElementById('resetDemoCode');
  var resetIdentifier = document.getElementById('resetIdentifier');
  var resetCode = document.getElementById('resetCode');
  var resetNewPass = document.getElementById('resetNewPass');
  var resetSubmit = document.getElementById('resetSubmit');

  if (forgotOpenBtn) {
    forgotOpenBtn.addEventListener('click', function () {
      if (loginIdentifier && resetIdentifier) resetIdentifier.value = loginIdentifier.value.trim();
      showTab('reset');
    });
  }
  if (resetBackBtn) resetBackBtn.addEventListener('click', function () { showTab('login'); });

  if (resetSendCode) {
    resetSendCode.addEventListener('click', async function () {
      if (!resetIdentifier || !resetIdentifier.value.trim()) {
        statusMsg.textContent = 'أدخل البريد أو الجوال أولاً';
        statusMsg.classList.add('show');
        return;
      }
      try {
        resetSendCode.disabled = true;
        var otp = await HCIApi.request('/api/auth/request-otp', {
          method: 'POST',
          body: { identifier: resetIdentifier.value.trim(), purpose: 'reset' }
        });
        if (resetDemoCode) {
          resetDemoCode.hidden = false;
          resetDemoCode.textContent = 'رمز التحقق: ' + otp.demoCode;
        }
        statusMsg.textContent = otp.message + (otp.deliveryNote ? ' — ' + otp.deliveryNote : '');
        statusMsg.classList.add('show');
      } catch (err) {
        statusMsg.textContent = err.message;
        statusMsg.classList.add('show');
      } finally {
        resetSendCode.disabled = false;
      }
    });
  }

  if (formReset) {
    formReset.addEventListener('submit', async function (event) {
      event.preventDefault();
      try {
        resetSubmit.disabled = true;
        var res = await HCIApi.request('/api/auth/reset-password', {
          method: 'POST',
          body: {
            identifier: resetIdentifier.value.trim(),
            code: resetCode.value.trim(),
            newPassword: resetNewPass.value
          }
        });
        statusMsg.textContent = res.message;
        statusMsg.classList.add('show');
        showTab('login');
        if (loginIdentifier) loginIdentifier.value = resetIdentifier.value.trim();
      } catch (err) {
        statusMsg.textContent = err.message;
        statusMsg.classList.add('show');
      } finally {
        resetSubmit.disabled = false;
      }
    });
  }

  // ---- تأكيد البريد/الجوال ----
  var verifySendCode = document.getElementById('verifySendCode');
  var verifyDemoCode = document.getElementById('verifyDemoCode');
  var verifyIdentifierEl = document.getElementById('verifyIdentifier');
  var verifyCode = document.getElementById('verifyCode');
  var verifySubmit = document.getElementById('verifySubmit');
  var verifySkipBtn = document.getElementById('verifySkipBtn');

  if (verifySendCode) {
    verifySendCode.addEventListener('click', async function () {
      if (!verifyIdentifierEl || !verifyIdentifierEl.value.trim()) {
        statusMsg.textContent = 'أدخل البريد أو الجوال';
        statusMsg.classList.add('show');
        return;
      }
      try {
        verifySendCode.disabled = true;
        var otp = await HCIApi.request('/api/auth/request-otp', {
          method: 'POST',
          body: { identifier: verifyIdentifierEl.value.trim(), purpose: 'verify' }
        });
        if (verifyDemoCode) {
          verifyDemoCode.hidden = false;
          verifyDemoCode.textContent = 'رمز التحقق: ' + otp.demoCode;
        }
        statusMsg.textContent = otp.message;
        statusMsg.classList.add('show');
      } catch (err) {
        statusMsg.textContent = err.message;
        statusMsg.classList.add('show');
      } finally {
        verifySendCode.disabled = false;
      }
    });
  }

  if (formVerify) {
    formVerify.addEventListener('submit', async function (event) {
      event.preventDefault();
      try {
        verifySubmit.disabled = true;
        var conf = await HCIApi.request('/api/auth/confirm-otp', {
          method: 'POST',
          body: {
            identifier: verifyIdentifierEl.value.trim(),
            code: verifyCode.value.trim(),
            purpose: 'verify'
          }
        });
        if (conf.user) HCIApi.setSession(HCIApi.getToken(), conf.user);
        statusMsg.textContent = 'تم التأكيد ✓ جاري فتح مسارك…';
        statusMsg.classList.add('show');
        var dest = await HCIApi.afterAuthFlow(conf.user || HCIApi.currentUser(), true);
        window.location.href = dest;
      } catch (err) {
        statusMsg.textContent = err.message;
        statusMsg.classList.add('show');
        verifySubmit.disabled = false;
      }
    });
  }

  if (verifySkipBtn) {
    verifySkipBtn.addEventListener('click', async function () {
      var u = HCIApi.currentUser();
      var dest = await HCIApi.afterAuthFlow(u, true);
      window.location.href = dest;
    });
  }
}

// مزامنة التقدم من السيرفر عند وجود جلسة + توجيه المسار الناقص
if (window.HCIApi && HCIApi.isLoggedIn()){
  HCIApi.syncProgress().then(function(){
    var overallFillEl = document.getElementById('overallProgressFill');
    var overallPctEl = document.getElementById('overallProgressPct');
    if (overallFillEl || overallPctEl){
      var pctNow = getOverallProgress();
      if (overallFillEl) overallFillEl.style.width = pctNow + '%';
      if (overallPctEl) overallPctEl.textContent = pctNow + '%';
    }

    // صفحات عامة: لو ما اختار مساره أو ما شاف التعريف، نوجّهه
    var page = (location.pathname.split('/').pop() || '').toLowerCase();
    var skipRedirect = ['auth.html', 'path-choice.html', 'intro.html', 'admin.html'].indexOf(page) !== -1;
    if (!skipRedirect && !HCIApi.isAdmin()){
      var u = HCIApi.currentUser();
      if (u && !u.pathType){
        location.href = 'path-choice.html';
        return;
      }
      if (u && u.pathType === 'curious' && !u.introSeen){
        location.href = 'intro.html';
        return;
      }
      if (u && u.pathType === 'specialist'){
        HCIApi.applySpecialistUnlocks();
      }
    }
  }).catch(function(){});
}

// ----- الملف الشخصي -----
var avatarLetter = document.getElementById('avatarLetter');
var profileNameDisplay = document.getElementById('profileNameDisplay');
var profileNameHint = document.getElementById('profileNameHint');

if (avatarLetter && profileNameDisplay && profileNameHint){
  var savedName = localStorage.getItem('hci_user_name');
  if (savedName){
    applyAvatarToEl(avatarLetter, savedName);
    profileNameDisplay.textContent = savedName;
    profileNameHint.style.display = 'none';
  }

  var avatarUpload = document.getElementById('avatarUpload');
  var avatarRemove = document.getElementById('avatarRemove');
  if (avatarUpload){
    avatarUpload.addEventListener('change', function(){
      var file = avatarUpload.files && avatarUpload.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)){
        alert('اختَر صورة فقط');
        return;
      }
      if (file.size > 8 * 1024 * 1024){
        alert('الصورة كبيرة — اختَر صورة أصغر من 8MB');
        return;
      }
      compressImageFile(file, 320, 0.82, function(dataUrl){
        setUserAvatar(dataUrl);
        applyAvatarToEl(avatarLetter, savedName || '؟');
        applyAvatarToEl(document.getElementById('navAvatarChip'), savedName || '؟');
        if (avatarRemove) avatarRemove.hidden = false;
      });
    });
  }
  if (avatarRemove){
    avatarRemove.hidden = !getUserAvatar();
    avatarRemove.addEventListener('click', function(){
      setUserAvatar('');
      applyAvatarToEl(avatarLetter, savedName || '؟');
      applyAvatarToEl(document.getElementById('navAvatarChip'), savedName || '؟');
      avatarRemove.hidden = true;
      if (avatarUpload) avatarUpload.value = '';
    });
  }
}

// رسائل من الإدارة في الملف الشخصي
var inboxList = document.getElementById('inboxList');
if (inboxList && window.HCIApi && HCIApi.isLoggedIn()){
  HCIApi.fetchMessages().then(function(data){
    if (!data.messages || !data.messages.length){
      inboxList.innerHTML = '<p class="progress-note">لا توجد رسائل من الإدارة حالياً.</p>';
      return;
    }
    inboxList.innerHTML = data.messages.map(function(m){
      return '<div class="glossary-item">' +
        '<div class="term-row"><span class="term-ar">' + m.subject + '</span>' +
        '<span class="term-en">' + (m.read ? 'مقروءة' : 'جديدة') + '</span></div>' +
        '<p class="term-def">' + m.body + '</p>' +
        '<p class="progress-note">من ' + m.from +
          (m.updatedAt ? ' · عُدّلت' : '') + '</p>' +
      '</div>';
    }).join('');
    data.messages.forEach(function(m){
      if (!m.read){
        HCIApi.request('/api/messages/' + m.id + '/read', { method: 'POST' }).catch(function(){});
      }
    });
  }).catch(function(){
    inboxList.innerHTML = '<p class="progress-note">تعذر جلب الرسائل. تأكد من اتصال المنصة.</p>';
  });
}

// تنبيه عند وصول رسالة من الإدارة
(function setupAdminMessageAlert(){
  if (!window.HCIApi || !HCIApi.isLoggedIn() || HCIApi.isAdmin()) return;

  function showMsgToast(count, subject){
    var existing = document.getElementById('adminMsgToast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'adminMsgToast';
    toast.className = 'admin-msg-toast';
    toast.setAttribute('role', 'status');
    var text = count === 1
      ? ('رسالة جديدة من الإدارة' + (subject ? ': ' + subject : ''))
      : ('لديك ' + count + ' رسائل جديدة من الإدارة');
    toast.innerHTML = '<strong>تنبيه</strong><span>' + text + '</span>' +
      '<a href="profile.html#inbox">عرض الرسائل</a>' +
      '<button type="button" class="toast-close" aria-label="إغلاق">×</button>';
    document.body.appendChild(toast);
    toast.querySelector('.toast-close').addEventListener('click', function(){ toast.remove(); });
    setTimeout(function(){ if (toast.parentNode) toast.remove(); }, 12000);
  }

  function updateMsgBadge(count){
    var slot = document.querySelector('.nav-user-wrap') || document.getElementById('navCtaSlot');
    if (!slot) return;
    var badge = document.getElementById('navMsgBadge');
    if (count <= 0){
      if (badge) badge.remove();
      return;
    }
    if (!badge){
      badge = document.createElement('a');
      badge.id = 'navMsgBadge';
      badge.className = 'nav-msg-badge';
      badge.href = 'profile.html#inbox';
      badge.setAttribute('aria-label', 'رسائل غير مقروءة');
      slot.appendChild(badge);
    }
    badge.textContent = String(count);
  }

  function checkMessages(){
    HCIApi.fetchMessages().then(function(data){
      var unread = (data.messages || []).filter(function(m){ return !m.read; });
      var count = data.unreadCount != null ? data.unreadCount : unread.length;
      updateMsgBadge(count);
      if (!count) return;
      var seenKey = 'hci_seen_msg_ids';
      var seen = [];
      try { seen = JSON.parse(localStorage.getItem(seenKey) || '[]'); } catch (e) { seen = []; }
      var fresh = unread.filter(function(m){ return seen.indexOf(m.id) === -1; });
      if (fresh.length){
        showMsgToast(fresh.length, fresh[0].subject);
        fresh.forEach(function(m){ seen.push(m.id); });
        try { localStorage.setItem(seenKey, JSON.stringify(seen.slice(-50))); } catch (e) { /* */ }
      }
    }).catch(function(){});
  }

  checkMessages();
  setInterval(checkMessages, 45000);
})();

// خريطة الرحلة في الملف الشخصي
var journeyMap = document.getElementById('journeyMap');
if (journeyMap){
  var labels = {
    discover: 'اكتشف التخصص',
    fundamentals: 'أساسيات HCI',
    coding: 'ترميز HTML & CSS',
    courses: 'الدورات المتخصصة',
    books: 'الكتب والمراجع',
    practice: 'تعلّم بالمرح',
    contribute: 'أفد غيرك'
  };
  var hrefs = {
    discover: 'discover.html',
    fundamentals: 'fundamentals.html',
    coding: 'coding.html',
    courses: 'courses.html',
    books: 'books.html',
    practice: 'practice.html',
    contribute: 'contribute.html'
  };
  var html = '';
  var foundCurrent = false;
  JOURNEY_ORDER.forEach(function(id){
    var done = isDone(id);
    var unlocked = isUnlocked(id);
    var cls = 'locked';
    var state = 'قريباً';
    if (done){ cls = 'done'; state = 'مكتمل'; }
    else if (unlocked && !foundCurrent){ cls = 'current'; state = 'الحالية'; foundCurrent = true; }
    else if (unlocked){ cls = ''; state = 'مفتوح'; }

    if (unlocked){
      html += '<a class="jm-row ' + cls + '" href="' + hrefs[id] + '">' +
        '<span class="jm-dot"></span>' +
        '<span>' + labels[id] + '</span>' +
        '<span class="jm-state">' + state + '</span>' +
      '</a>';
    } else {
      html += '<button type="button" class="jm-row ' + cls + '" data-locked-stage="' + id + '">' +
        '<span class="jm-dot"></span>' +
        '<span>' + labels[id] + '</span>' +
        '<span class="jm-state">' + state + '</span>' +
      '</button>';
    }
  });
  journeyMap.innerHTML = html;

  journeyMap.querySelectorAll('[data-locked-stage]').forEach(function(btn){
    btn.addEventListener('click', function(){
      showStageLock(btn.getAttribute('data-locked-stage'));
    });
  });

  var profileOverall = document.getElementById('profileOverallFill');
  var profileOverallNote = document.getElementById('profileOverallNote');
  var certBox = document.getElementById('certificateBox');
  var p = getOverallProgress();
  if (profileOverall) profileOverall.style.width = p + '%';
  if (profileOverallNote){
    profileOverallNote.textContent = p >= 100
      ? 'أكملت الرحلة كاملة — شهادتك جاهزة للطباعة'
      : 'أنجزت ' + p + '% من الرحلة الكاملة';
  }
  if (certBox) certBox.hidden = p < 100;
}

// تفصيل مسار الترميز — من الدروس الفعلية (مو اختيار يدوي منفصل)
var codingMiniMap = document.getElementById('codingMiniMap');
if (codingMiniMap){
  var codingLessons = [
    { id: 'html-intro', title: 'مقدمة HTML' },
    { id: 'html-elements', title: 'العناصر والوسوم' },
    { id: 'html-links', title: 'الروابط' },
    { id: 'html-images', title: 'الصور' },
    { id: 'html-lists', title: 'القوائم' },
    { id: 'html-forms', title: 'الفورمات' },
    { id: 'css-intro', title: 'مقدمة CSS' },
    { id: 'css-box-model', title: 'Box Model' }
  ];

  var codingProg = {};
  try { codingProg = JSON.parse(localStorage.getItem('hci_coding_progress') || '{}'); } catch (e) { codingProg = {}; }

  var doneCoding = 0;
  var nextTitle = null;
  var miniHtml = '';
  codingLessons.forEach(function(lesson, index){
    var doneL = !!codingProg[lesson.id];
    if (doneL) doneCoding++;
    var prevDone = index === 0 || !!codingProg[codingLessons[index - 1].id];
    var cls = 'locked';
    var state = 'قريباً';
    if (doneL){ cls = 'done'; state = 'تم'; }
    else if (prevDone){ cls = 'current'; state = 'التالي'; if (!nextTitle) nextTitle = lesson.title; }
    miniHtml += '<div class="jm-row ' + cls + '">' +
      '<span class="jm-dot"></span>' +
      '<span>' + (index + 1 < 10 ? '0' : '') + (index + 1) + ' — ' + lesson.title + '</span>' +
      '<span class="jm-state">' + state + '</span>' +
    '</div>';
  });
  codingMiniMap.innerHTML = miniHtml;

  var codingFill = document.getElementById('codingProfileFill');
  var codingNote = document.getElementById('codingProfileNote');
  var codingLink = document.getElementById('codingContinueLink');
  var codingPct = Math.round((doneCoding / codingLessons.length) * 100);
  if (codingFill) codingFill.style.width = codingPct + '%';
  if (codingNote){
    if (doneCoding === 0) codingNote.textContent = 'ما بدأت بعد — ابدأ من أول درس بمسار الترميز';
    else if (doneCoding === codingLessons.length) codingNote.textContent = 'أكملت كل دروس الترميز (' + doneCoding + '/' + codingLessons.length + ')';
    else codingNote.textContent = 'أكملت ' + doneCoding + ' من ' + codingLessons.length + ' — التالي: ' + (nextTitle || '—');
  }
  if (codingLink){
    if (!isUnlocked('coding')){
      codingLink.textContent = 'كيف أفتحه؟';
      codingLink.href = '#';
      codingLink.addEventListener('click', function(e){
        e.preventDefault();
        showStageLock('coding');
      });
    } else if (doneCoding === codingLessons.length){
      codingLink.textContent = 'انتقل للدورات ←';
      codingLink.href = 'courses.html';
    }
  }
}

// ----- مسار الترميز -----
var lessonList = document.getElementById('lessonList');
var codingProgressFill = document.getElementById('codingProgressFill');
var codingProgressNote = document.getElementById('codingProgressNote');

if (lessonList && codingProgressFill && codingProgressNote){
  var lessonCards = lessonList.querySelectorAll('.lesson-card');
  var storageKey = 'hci_coding_progress';

  function getProgress(){
    var raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : {};
  }

  function saveProgress(progress){
    localStorage.setItem(storageKey, JSON.stringify(progress));
    if (window.HCIApi) HCIApi.scheduleSync();
  }

  function renderLessons(){
    var progress = getProgress();
    var doneCount = 0;
    var currentAssigned = false;

    lessonCards.forEach(function(card, index){
      var id = card.getAttribute('data-lesson');
      var doneBtn = card.querySelector('.lesson-done-btn');
      var isLessonDone = !!progress[id];

      // قفل تسلسلي: الدرس التالي يفتح بعد إكمال السابق
      var prevDone = index === 0 || !!progress[lessonCards[index - 1].getAttribute('data-lesson')];
      var lockedLesson = !prevDone && !isLessonDone;
      card.classList.toggle('is-locked-lesson', lockedLesson);
      card.title = lockedLesson ? 'أكمل الدرس السابق أولاً عشان يفتح هذا الدرس' : '';

      card.classList.toggle('is-done', isLessonDone);
      doneBtn.classList.toggle('done', isLessonDone);
      doneBtn.textContent = isLessonDone ? 'تم ✓' : (lockedLesson ? 'كيف أفتحه؟' : 'أكملت هذا الدرس');
      doneBtn.disabled = false;
      doneBtn.setAttribute('data-locked', lockedLesson ? '1' : '0');

      if (isLessonDone){ doneCount++; }

      if (!isLessonDone && prevDone && !currentAssigned){
        card.classList.add('is-current');
        currentAssigned = true;
      } else {
        card.classList.remove('is-current');
      }
    });

    var percent = Math.round((doneCount / lessonCards.length) * 100);
    codingProgressFill.style.width = percent + '%';

    if (doneCount === 0){
      codingProgressNote.textContent = 'ما بدأت بعد — افتح أول درس وابدأ';
    } else if (doneCount === lessonCards.length){
      codingProgressNote.textContent = 'أكملت كل الدروس! فتحت مسار الدورات ✨';
      markComplete('coding');
    } else {
      codingProgressNote.textContent = 'أكملت ' + doneCount + ' من ' + lessonCards.length + ' دروس';
      // فتح الدورات عند 50%
      if (percent >= 50){
        var j = getJourney();
        if (!j.unlocked) j.unlocked = {};
        if (!j.unlocked.courses){
          j.unlocked.courses = true;
          saveJourney(j);
          showUnlockToast('فتحت مرحلة الدورات المتخصصة ✨');
        }
      }
    }
  }

  lessonCards.forEach(function(card){
    var id = card.getAttribute('data-lesson');
    var doneBtn = card.querySelector('.lesson-done-btn');

    doneBtn.addEventListener('click', function(){
      if (doneBtn.getAttribute('data-locked') === '1'){
        showLockAlert(
          'لفتح هذا الدرس أكمل الدرس السابق أولاً بالترتيب، ثم ارجع هنا.',
          'coding.html',
          'ارجع لأول درس ناقص'
        );
        // نمرر للدرس الحالي المقترح
        var current = document.querySelector('.lesson-card.is-current');
        if (current) current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      var progress = getProgress();
      progress[id] = !progress[id];
      saveProgress(progress);
      renderLessons();
    });
  });

  renderLessons();
}

// ----- الإعدادات -----
var settingsFirstName = document.getElementById('settingsFirstName');
var settingsLastName = document.getElementById('settingsLastName');
var settingsNameSave = document.getElementById('settingsNameSave');
var settingsNameNote = document.getElementById('settingsNameNote');
var settingsSizeRow = document.getElementById('settingsSizeRow');
var settingsSwatchRow = document.getElementById('settingsSwatchRow');
var settingsThemeRow = document.getElementById('settingsThemeRow');

if (settingsFirstName && settingsLastName && settingsNameSave){
  var u = window.HCIApi && HCIApi.currentUser ? HCIApi.currentUser() : null;
  if (u){
    settingsFirstName.value = u.firstName || '';
    settingsLastName.value = u.lastName || '';
  } else {
    var legacy = localStorage.getItem('hci_user_name') || '';
    var parts = legacy.trim().split(/\s+/);
    settingsFirstName.value = parts[0] || '';
    settingsLastName.value = parts.slice(1).join(' ') || '';
  }

  settingsNameSave.addEventListener('click', async function(){
    var first = settingsFirstName.value.trim();
    var last = settingsLastName.value.trim();
    if (first.length < 2 || last.length < 2){
      if (settingsNameNote) settingsNameNote.textContent = 'أدخل الاسم الأول واسم العائلة (حرفان على الأقل لكل منهما).';
      return;
    }
    settingsNameSave.disabled = true;
    try {
      if (window.HCIApi && HCIApi.isLoggedIn()){
        await HCIApi.updateProfile(first, last);
        if (settingsNameNote) settingsNameNote.textContent = 'تم حفظ الاسم في الحساب والشهادة ولوحة الإدارة.';
      } else {
        localStorage.setItem('hci_user_name', first + ' ' + last);
        if (settingsNameNote) settingsNameNote.textContent = 'تم الحفظ محلياً. سجّل الدخول لمزامنة الاسم مع الشهادة والإدارة.';
      }
      settingsNameSave.textContent = 'تم الحفظ ✓';
      setTimeout(function(){ settingsNameSave.textContent = 'حفظ الاسم'; }, 1600);
      var chip = document.querySelector('.nav-user-name');
      if (chip) chip.textContent = first + ' ' + last;
    } catch (err) {
      if (settingsNameNote) settingsNameNote.textContent = err.message || 'تعذر حفظ الاسم';
    } finally {
      settingsNameSave.disabled = false;
    }
  });
}

if (settingsThemeRow){
  var themeButtons = settingsThemeRow.querySelectorAll('.size-btn');
  var currentTheme = localStorage.getItem('hci_theme') || 'dark';
  themeButtons.forEach(function(btn){
    btn.classList.toggle('active', btn.getAttribute('data-theme') === currentTheme);
    btn.addEventListener('click', function(){
      var theme = btn.getAttribute('data-theme');
      setTheme(theme);
      themeButtons.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });
}

if (settingsSizeRow){
  var sizeButtons = settingsSizeRow.querySelectorAll('.size-btn');
  var storedSize = localStorage.getItem('hci_font_size') || '18px';

  sizeButtons.forEach(function(btn){
    btn.classList.toggle('active', btn.getAttribute('data-size') === storedSize);
    btn.addEventListener('click', function(){
      var size = btn.getAttribute('data-size');
      document.documentElement.style.fontSize = size;
      localStorage.setItem('hci_font_size', size);
      sizeButtons.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });
}

if (settingsSwatchRow){
  var swatchButtons = settingsSwatchRow.querySelectorAll('.swatch-btn');
  var storedAccent = localStorage.getItem('hci_accent_color') || '#C9A24B';

  swatchButtons.forEach(function(btn){
    btn.classList.toggle('active', btn.getAttribute('data-color') === storedAccent);
    btn.addEventListener('click', function(){
      var color = btn.getAttribute('data-color');
      document.documentElement.style.setProperty('--gold', color);
      localStorage.setItem('hci_accent_color', color);
      swatchButtons.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });
}

// ----- المعجم -----
var glossaryList = document.getElementById('glossaryList');
var glossarySearch = document.getElementById('glossarySearch');
var glossaryCount = document.getElementById('glossaryCount');
var glossaryEmpty = document.getElementById('glossaryEmpty');

if (glossaryList && glossarySearch && glossaryCount && glossaryEmpty){

  var glossaryTerms = [
    { ar: 'تجربة المستخدم', en: 'UX — User Experience', def: 'إحساس المستخدم ورحلته الكاملة أثناء استخدام المنتج.' },
    { ar: 'واجهة المستخدم', en: 'UI — User Interface', def: 'الطبقة البصرية اللي يتفاعل معها المستخدم: الألوان والأزرار والخطوط.' },
    { ar: 'الإشارات البصرية', en: 'Affordance', def: 'شكل العنصر نفسه يوحي بوظيفته — زر بارز يوحي إنه يُضغط.' },
    { ar: 'التغذية الراجعة', en: 'Feedback', def: 'رد فعل النظام الفوري على أي فعل يسويه المستخدم.' },
    { ar: 'المخطط السلكي', en: 'Wireframe', def: 'رسم أولي بسيط لهيكل الصفحة، بدون ألوان أو تفاصيل نهائية.' },
    { ar: 'النموذج الأولي', en: 'Prototype', def: 'نسخة تفاعلية قابلة للاختبار قبل بناء المنتج فعلياً.' },
    { ar: 'قابلية الاستخدام', en: 'Usability', def: 'مدى سهولة وكفاءة استخدام المنتج لتحقيق هدف معين.' },
    { ar: 'إتاحة الوصول', en: 'Accessibility', def: 'تصميم المنتج بحيث يقدر يستخدمه ذوو الإعاقة والاحتياجات الخاصة.' },
    { ar: 'معايير الوصولية العالمية', en: 'WCAG', def: 'دليل عالمي لمعايير إتاحة الوصول بالمواقع والتطبيقات.' },
    { ar: 'هندسة معلومات', en: 'Information Architecture', def: 'كيفية تنظيم وترتيب المحتوى بشكل منطقي يسهل تصفحه.' },
    { ar: 'مسار المستخدم', en: 'User Flow', def: 'سلسلة الخطوات اللي يمر فيها المستخدم لإنجاز مهمة معينة.' },
    { ar: 'الشخصية الافتراضية', en: 'Persona', def: 'ملف تخيلي يمثل شريحة حقيقية من المستخدمين، يساعد باتخاذ قرارات التصميم.' },
    { ar: 'التقييم الاستكشافي', en: 'Heuristic Evaluation', def: 'تقييم واجهة بناءً على مبادئ راسخة (زي مبادئ نيلسن) بدون اختبار مستخدمين فعليين.' },
    { ar: 'الحمل المعرفي', en: 'Cognitive Load', def: 'مقدار الجهد الذهني اللي يحتاجه المستخدم لفهم واستخدام الواجهة.' },
    { ar: 'النموذج الذهني', en: 'Mental Model', def: 'توقعات المستخدم لسلوك النظام بناءً على خبرته السابقة.' },
    { ar: 'مبادئ الجشطالت', en: 'Gestalt Principles', def: 'قوانين نفسية تفسر كيف يجمّع الدماغ العناصر البصرية كمجموعات.' },
    { ar: 'اختبار أ/ب', en: 'A/B Testing', def: 'مقارنة نسختين من نفس العنصر لمعرفة أيهما أفضل أداءً.' },
    { ar: 'التصميم المتجاوب', en: 'Responsive Design', def: 'تصميم يتكيف تلقائياً مع أحجام الشاشات المختلفة.' },
    { ar: 'نظام التصميم', en: 'Design System', def: 'مكتبة موحدة من المكونات والقواعد تضمن اتساق أي منتج رقمي.' },
    { ar: 'التهيئة الأولى', en: 'Onboarding', def: 'أول تجربة يمر فيها مستخدم جديد، تُعرّفه على المنتج وتساعده يبدأ بسهولة.' },
    { ar: 'التصميم الشامل', en: 'Inclusive Design', def: 'تصميم يراعي تنوع البشر من البداية، مو كإضافة لاحقة.' },
    { ar: 'قانون فيتس', en: "Fitts's Law", def: 'الوقت للوصول لهدف يعتمد على المسافة وحجم الهدف — خلّي الأزرار المهمة أكبر وأقرب.' },
    { ar: 'قانون هيك', en: "Hick's Law", def: 'كلما زادت الخيارات، زاد وقت اتخاذ القرار — قلّل الخيارات الظاهرة.' },
    { ar: 'اختبار الاستخدام', en: 'Usability Testing', def: 'مراقبة مستخدمين حقيقيين وهم يحاولون إنجاز مهام على تصميمك.' }
  ];

  function renderGlossary(filter){
    var query = (filter || '').trim().toLowerCase();
    var results = glossaryTerms.filter(function(term){
      return term.ar.toLowerCase().includes(query) ||
             term.en.toLowerCase().includes(query) ||
             term.def.toLowerCase().includes(query);
    });

    glossaryList.innerHTML = results.map(function(term){
      return '<div class="glossary-item">' +
               '<div class="term-row"><span class="term-ar">' + term.ar + '</span><span class="term-en">' + term.en + '</span></div>' +
               '<p class="term-def">' + term.def + '</p>' +
             '</div>';
    }).join('');

    glossaryCount.textContent = results.length + ' من أصل ' + glossaryTerms.length + ' مصطلح';
    glossaryEmpty.style.display = results.length === 0 ? 'block' : 'none';
  }

  glossarySearch.addEventListener('input', function(){ renderGlossary(glossarySearch.value); });
  renderGlossary('');
}

// ----- اختبار أساسيات HCI -----
var quizCheckBtn = document.getElementById('quizCheckBtn');
var quizResult = document.getElementById('quizResult');

if (quizCheckBtn && quizResult){
  quizCheckBtn.addEventListener('click', function(){
    var check = ensureChecklistsComplete();
    if (!check.ok){
      showLockAlert(check.message, null, null);
      return;
    }

    var questions = document.querySelectorAll('.quiz-q');
    var correctCount = 0;

    questions.forEach(function(q){
      var correctValue = q.getAttribute('data-correct');
      var selected = q.querySelector('input[type="radio"]:checked');
      var feedback = q.querySelector('.quiz-feedback');
      var labels = q.querySelectorAll('.quiz-options label');

      labels.forEach(function(label){ label.classList.remove('selected'); });
      q.classList.remove('correct', 'wrong');

      if (!selected){
        feedback.textContent = 'ما اخترت إجابة لهذا السؤال';
        q.classList.add('wrong');
        return;
      }

      var selectedLabel = selected.closest('label');
      selectedLabel.classList.add('selected');

      if (selected.value === correctValue){
        correctCount++;
        q.classList.add('correct');
        feedback.textContent = '✓ صحيح!';
      } else {
        q.classList.add('wrong');
        feedback.textContent = '✕ غير صحيح — راجع القسم اللي فوق وحاول مرة ثانية';
      }
    });

    quizResult.textContent = 'نتيجتك: ' + correctCount + ' من ' + questions.length + ' صحيحة';
    quizResult.classList.add('show');

    // فتح الترميز عند 3/4 أو أكثر
    if (correctCount >= 3){
      markComplete('fundamentals');
      quizResult.textContent += ' — ممتاز! فتحت مسار الترميز ✨';
    } else {
      quizResult.textContent += ' — تحتاج 3 إجابات صحيحة على الأقل لفتح المرحلة التالية';
    }
  });
}

// ----- تمارين practice -----
var spotOptions = document.querySelectorAll('.spot-option');
if (spotOptions.length){
  spotOptions.forEach(function(opt){
    opt.addEventListener('click', function(){
      var scene = opt.closest('.practice-scene');
      var feedback = scene.querySelector('.spot-feedback');
      var options = scene.querySelectorAll('.spot-option');
      var correct = opt.getAttribute('data-correct') === 'true';

      options.forEach(function(o){
        o.classList.remove('is-correct', 'is-wrong');
        o.disabled = true;
        o.style.pointerEvents = 'none';
        if (o.getAttribute('data-correct') === 'true') o.classList.add('is-correct');
      });

      if (!correct) opt.classList.add('is-wrong');

      if (feedback){
        feedback.textContent = correct
          ? '✓ ممتاز — فكرت كمصمم HCI!'
          : '✕ مو هذي — شوف الخيار الصحيح ولماذا أفضل.';
        feedback.style.color = correct ? 'var(--line-green)' : 'var(--error)';
      }

      // تتبع تقدم التمارين
      var done = parseInt(localStorage.getItem('hci_practice_count') || '0', 10);
      var sceneId = scene.getAttribute('data-scene');
      var key = 'hci_practice_' + sceneId;
      if (!localStorage.getItem(key)){
        localStorage.setItem(key, '1');
        done++;
        localStorage.setItem('hci_practice_count', String(done));
      }
      if (done >= 3){
        markComplete('practice');
      }
    });
  });
}

// حفظ تقدم الدورات عند الضغط على "سجّلت اهتمامي"
document.querySelectorAll('[data-course-done]').forEach(function(btn){
  var id = btn.getAttribute('data-course-done');
  var key = 'hci_course_' + id;
  if (localStorage.getItem(key)){
    btn.textContent = 'تم التسجيل ✓';
    btn.classList.add('done');
  }
  btn.addEventListener('click', function(){
    localStorage.setItem(key, '1');
    btn.textContent = 'تم التسجيل ✓';
    var courses = document.querySelectorAll('[data-course-done]');
    var all = true;
    courses.forEach(function(b){
      if (!localStorage.getItem('hci_course_' + b.getAttribute('data-course-done'))) all = false;
    });
    // فتح الكتب بعد تسجيل اهتمام بدورة واحدة على الأقل
    var j = getJourney();
    if (!j.unlocked) j.unlocked = {};
    if (!j.unlocked.books){
      j.unlocked.books = true;
      saveJourney(j);
      showUnlockToast('فتحت مكتبة الكتب والمراجع ✨');
    }
    var anyDone = false;
    courses.forEach(function(b){
      if (localStorage.getItem('hci_course_' + b.getAttribute('data-course-done'))) anyDone = true;
    });
    if (anyDone) markComplete('courses', true);
  });
});

// كتب — تتبع القراءة
document.querySelectorAll('[data-book-read]').forEach(function(btn){
  var id = btn.getAttribute('data-book-read');
  var key = 'hci_book_' + id;
  if (localStorage.getItem(key)){
    btn.textContent = 'قرأت الملخص ✓';
  }
  btn.addEventListener('click', function(){
    localStorage.setItem(key, '1');
    btn.textContent = 'قرأت الملخص ✓';
    var books = document.querySelectorAll('[data-book-read]');
    var count = 0;
    books.forEach(function(b){
      if (localStorage.getItem('hci_book_' + b.getAttribute('data-book-read'))) count++;
    });
    if (count >= 2) markComplete('books');
  });
});

// ----- بلّغ عن مشكلة — أسفل الصفحات المحتوى فقط (مو صفحات الدخول) -----
(function injectReportSection(){
  if (document.getElementById('reportSection')) return;

  var pageName = (location.pathname.split('/').pop() || '').toLowerCase();
  var skipPages = ['admin.html', 'auth.html', 'path-choice.html', 'certificate.html'];
  if (skipPages.indexOf(pageName) !== -1) return;
  if (document.body.classList.contains('auth-page')) return;
  if (document.body.classList.contains('path-choice-page')) return;
  if (document.body.classList.contains('cert-page')) return;

  var section = document.createElement('section');
  section.id = 'reportSection';
  section.className = 'report-section';
  section.setAttribute('aria-label', 'بلّغ عن مشكلة');
  section.innerHTML =
    '<div class="wrap">' +
      '<details class="report-details">' +
        '<summary class="report-summary">' +
          '<span class="report-summary-title">بلّغ عن مشكلة</span>' +
          '<span class="report-summary-hint">شفت خطأ أو شي مو واضح؟ اضغط هنا</span>' +
          '<span class="report-summary-chevron" aria-hidden="true">▾</span>' +
        '</summary>' +
        '<form class="report-form" id="reportForm">' +
          '<p class="report-lead">اكتب المشكلة باختصار — تقدر ترفق صورة أو فيديو قصير (حد أقصى ١٠ ثوانٍ).</p>' +
          '<div class="report-fields">' +
            '<input type="text" id="reportName" class="settings-input" placeholder="اسمك (اختياري)" autocomplete="name">' +
            '<input type="text" id="reportContact" class="settings-input" dir="ltr" placeholder="بريد أو جوال (اختياري)">' +
          '</div>' +
          '<textarea id="reportMessage" class="report-textarea" required placeholder="صف المشكلة أو الخطأ…" rows="3"></textarea>' +
          '<div class="report-media">' +
            '<label class="report-media-btn" for="reportMedia">إرفاق صورة أو فيديو</label>' +
            '<input type="file" id="reportMedia" accept="image/*,video/mp4,video/webm,video/quicktime" hidden>' +
            '<span class="report-media-name" id="reportMediaName">اختياري · الفيديو ≤ ١٠ ثوانٍ</span>' +
            '<button type="button" class="report-media-clear" id="reportMediaClear" hidden>إزالة</button>' +
          '</div>' +
          '<div class="report-media-preview" id="reportMediaPreview" hidden></div>' +
          '<div class="report-submit-row">' +
            '<button type="submit" class="btn-primary" id="reportSubmit">إرسال البلاغ</button>' +
            '<p class="status-msg" id="reportStatus"></p>' +
          '</div>' +
        '</form>' +
      '</details>' +
    '</div>';

  // دائماً في آخر الصفحة بعد الفوتر، بعرض كامل
  var footer = document.querySelector('footer');
  if (footer) footer.insertAdjacentElement('afterend', section);
  else document.body.appendChild(section);

  var form = document.getElementById('reportForm');
  var status = document.getElementById('reportStatus');
  var submitBtn = document.getElementById('reportSubmit');
  var mediaInput = document.getElementById('reportMedia');
  var mediaName = document.getElementById('reportMediaName');
  var mediaClear = document.getElementById('reportMediaClear');
  var mediaPreview = document.getElementById('reportMediaPreview');
  var selectedMedia = null;

  function clearMedia(){
    selectedMedia = null;
    mediaInput.value = '';
    mediaName.textContent = 'اختياري · الفيديو ≤ ١٠ ثوانٍ';
    mediaClear.hidden = true;
    mediaPreview.hidden = true;
    mediaPreview.innerHTML = '';
  }

  function validateMediaFile(file){
    return new Promise(function(resolve, reject){
      if (!file) return resolve(null);
      if (file.type.indexOf('image/') === 0) return resolve(file);
      if (file.type.indexOf('video/') !== 0){
        return reject(new Error('ارفق صورة أو فيديو فقط'));
      }
      var url = URL.createObjectURL(file);
      var video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = function(){
        URL.revokeObjectURL(url);
        if (!isFinite(video.duration) || video.duration > 10.05){
          reject(new Error('الفيديو لازم يكون ١٠ ثوانٍ أو أقل (مدته الآن: ' + Math.ceil(video.duration) + ' ث)'));
          return;
        }
        resolve(file);
      };
      video.onerror = function(){
        URL.revokeObjectURL(url);
        reject(new Error('ما قدرنا نقرأ الفيديو — جرّب صيغة mp4 أو webm'));
      };
      video.src = url;
    });
  }

  mediaInput.addEventListener('change', async function(){
    var file = mediaInput.files && mediaInput.files[0];
    if (!file){ clearMedia(); return; }
    try {
      selectedMedia = await validateMediaFile(file);
      mediaName.textContent = file.name;
      mediaClear.hidden = false;
      mediaPreview.hidden = false;
      mediaPreview.innerHTML = '';
      var url = URL.createObjectURL(file);
      if (file.type.indexOf('image/') === 0){
        mediaPreview.innerHTML = '<img src="' + url + '" alt="معاينة المرفق">';
      } else {
        mediaPreview.innerHTML = '<video src="' + url + '" controls muted playsinline></video>';
      }
      status.classList.remove('show');
    } catch (err) {
      clearMedia();
      status.textContent = err.message;
      status.classList.add('show');
    }
  });

  mediaClear.addEventListener('click', clearMedia);

  if (window.HCIApi && HCIApi.isLoggedIn()){
    var u = HCIApi.currentUser();
    if (u){
      var nameEl = document.getElementById('reportName');
      var contactEl = document.getElementById('reportContact');
      if (nameEl && !nameEl.value) nameEl.value = u.fullName || '';
      if (contactEl && !contactEl.value) contactEl.value = u.email || u.phone || '';
    }
  }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    var msg = document.getElementById('reportMessage').value.trim();
    if (msg.length < 5){
      status.textContent = 'اكتب وصف أوضح للمشكلة';
      status.classList.add('show');
      return;
    }
    if (!window.HCIApi){
      status.textContent = 'السيرفر غير متصل';
      status.classList.add('show');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري الإرسال…';
    try {
      var fd = new FormData();
      fd.append('name', document.getElementById('reportName').value.trim());
      fd.append('contact', document.getElementById('reportContact').value.trim());
      fd.append('message', msg);
      fd.append('page', pageName || location.href);
      if (selectedMedia) fd.append('media', selectedMedia);

      await HCIApi.request('/api/reports', {
        method: 'POST',
        body: fd
      });
      status.textContent = 'وصلنا بلاغك ✓';
      status.classList.add('show');
      document.getElementById('reportMessage').value = '';
      clearMedia();
      submitBtn.textContent = 'تم الإرسال';
      setTimeout(function(){
        submitBtn.disabled = false;
        submitBtn.textContent = 'إرسال البلاغ';
      }, 2000);
    } catch (err) {
      status.textContent = err.message;
      status.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = 'إرسال البلاغ';
    }
  });
})();
