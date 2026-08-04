/* ============================================
   main.js — محرك المنصة: تقدم، فتح مراحل، تفاعل
   ============================================ */

// ----- شعار HCI التفاعلي (الهيرو فقط — H يضرب C) -----
(function initLogoBump(){
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var el = document.querySelector('a.wordmark, .wordmark');
  if (!el || el.querySelector('.logo-letter')) return;
  var text = String(el.textContent || '').replace(/\s+/g, '').trim().toUpperCase();
  if (text !== 'HCI') return;
  el.classList.add('logo-hci');
  el.innerHTML =
    '<span class="logo-letter logo-h" aria-hidden="true">H</span>' +
    '<span class="logo-letter logo-c" aria-hidden="true">C</span>' +
    '<span class="logo-letter logo-i" aria-hidden="true">I</span>';
  function bump(){
    el.classList.remove('is-bumping');
    void el.offsetWidth;
    el.classList.add('is-bumping');
  }
  el.addEventListener('mouseenter', bump);
  el.addEventListener('focusin', bump);
  setTimeout(bump, 480);
})();

// ----- تفضيلات المظهر -----
var ALLOWED_FONT_SIZES = { '16px': 1, '18px': 1, '20px': 1 };
function normalizeFontSize(size){
  if (ALLOWED_FONT_SIZES[size]) return size;
  if (size === '22px' || size === '24px') return '20px';
  return '18px';
}
var savedFontSize = normalizeFontSize(localStorage.getItem('hci_font_size') || '18px');
document.documentElement.style.fontSize = savedFontSize;
try { localStorage.setItem('hci_font_size', savedFontSize); } catch (e) { /* */ }

/* الوضع الفاتح تحت الصيانة — يُجبر الداكن دائماً */
var LIGHT_THEME_AVAILABLE = false;

/* ألوان التمييز الصارخة تُستبدل في الوضع الفاتح بهوية هادئة */
var LIGHT_ACCENT_MAP = {
  '#C9A24B': '#A9843A',
  '#c9a24b': '#A9843A',
  '#8FC15C': '#3F3F46',
  '#8fc15c': '#3F3F46',
  '#6FD6E0': '#57534E',
  '#6fd6e0': '#57534E',
  '#6B9FE8': '#57534E',
  '#6b9fe8': '#57534E',
  '#6ECF84': '#3F3F46',
  '#6ecf84': '#3F3F46',
  '#B79CE0': '#7C6A9A',
  '#b79ce0': '#7C6A9A',
  '#4A6B78': '#57534E',
  '#4a6b78': '#57534E'
};

function resolveAccentForTheme(theme, color){
  if (!color) return theme === 'light' ? '#A9843A' : '#C9A24B';
  if (theme === 'light' && LIGHT_ACCENT_MAP[color]) return LIGHT_ACCENT_MAP[color];
  return color;
}

function applyAccentColor(color){
  var theme = document.documentElement.getAttribute('data-theme') || 'dark';
  var resolved = resolveAccentForTheme(theme, color);
  document.documentElement.style.setProperty('--gold', resolved);
}

var savedAccent = localStorage.getItem('hci_accent_color');
(function applyThemeEarly(){
  var theme = localStorage.getItem('hci_theme') || 'dark';
  if (!LIGHT_THEME_AVAILABLE || theme !== 'light') theme = 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  if (document.body) document.body.setAttribute('data-theme', theme);
  try { localStorage.setItem('hci_theme', theme); } catch (e) { /* */ }
  applyAccentColor(savedAccent);
})();

function setTheme(theme){
  if (!LIGHT_THEME_AVAILABLE || theme !== 'light') theme = 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  if (document.body) document.body.setAttribute('data-theme', theme);
  try { localStorage.setItem('hci_theme', theme); } catch (e) { /* */ }
  applyAccentColor(localStorage.getItem('hci_accent_color'));
  return theme;
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

  // الترميز يُفتح باجتياز الأساسيات (اختبار 3/4)
  if (stageId === 'coding'){
    return !!(j.done && j.done.fundamentals) || !!(j.unlocked && j.unlocked.coding);
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
    reason: 'لفتح مسار الترميز: أجب عن اختبار أساسيات HCI بنتيجة 3 من 4 على الأقل، ثم اضغط «تحقق من إجاباتي».',
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

  if (loggedInName){ greetingText += '، ' + loggedInName; }
  else { greetingText += ' — مرحباً بك في HCI'; }

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
        '<a href="profile.html#inbox">الرسائل والتنبيهات</a>' +
        adminLink +
        '<a href="#" id="logoutLink" class="nav-dropdown-logout">تسجيل الخروج</a>' +
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

  async function doLogout(e){
    if (e) e.preventDefault();
    if (window.HCIApi) await HCIApi.logout();
    window.location.href = 'index.html';
  }
  var logoutLink = document.getElementById('logoutLink');
  if (logoutLink) logoutLink.addEventListener('click', doLogout);
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
var STAGE_HREFS = {
  discover: 'discover.html',
  fundamentals: 'fundamentals.html',
  coding: 'coding.html',
  courses: 'courses.html',
  books: 'books.html',
  practice: 'practice.html',
  contribute: 'contribute.html'
};
var STAGE_ORDER_LABEL = {
  discover: '1',
  fundamentals: '2',
  coding: '3',
  courses: '4',
  books: '5',
  practice: '6',
  contribute: '7'
};

function getCurrentStageId(){
  var current = null;
  JOURNEY_ORDER.forEach(function(id){
    if (current) return;
    if (isUnlocked(id) && !isDone(id)) current = id;
  });
  if (!current){
    // الكل مكتمل أو لم يبدأ
    if (JOURNEY_ORDER.every(isDone)) return null;
    current = 'discover';
  }
  return current;
}

var stationsRoot = document.getElementById('stationsList');
if (stationsRoot){
  var stations = stationsRoot.querySelectorAll('[data-stage]');
  var currentAssigned = false;
  var currentStageId = null;

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
      if (statusEl){ statusEl.textContent = 'مقفل'; statusEl.className = 'station-status locked'; }
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
      if (link){
        link.classList.remove('disabled');
        link.textContent = 'راجع المحطة ←';
      }
    } else if (!currentAssigned){
      station.setAttribute('aria-current', 'step');
      currentAssigned = true;
      currentStageId = id;
      if (statusEl){ statusEl.textContent = 'أنت هنا'; statusEl.className = 'station-status open'; }
      if (link){
        link.classList.remove('disabled');
        link.textContent = 'كمّل من هنا ←';
      }
    } else {
      station.removeAttribute('aria-current');
      if (statusEl){ statusEl.textContent = 'مفتوح'; statusEl.className = 'station-status open'; }
      if (link){ link.classList.remove('disabled'); }
    }
  });

  if (!currentStageId) currentStageId = getCurrentStageId();

  var guideTitle = document.getElementById('pathGuideTitle');
  var guideHint = document.getElementById('pathGuideHint');
  var guideCta = document.getElementById('pathGuideCta');
  var guideKicker = document.getElementById('pathGuideKicker');
  var doneCount = JOURNEY_ORDER.filter(isDone).length;

  if (guideTitle && guideCta){
    if (doneCount >= JOURNEY_ORDER.length){
      if (guideKicker) guideKicker.textContent = 'أحسنت';
      guideTitle.textContent = 'أكملت الرحلة كاملة';
      if (guideHint) guideHint.textContent = 'تقدر ترجع لأي محطة للمراجعة، أو تطبع شهادتك من الملف الشخصي.';
      guideCta.textContent = 'عرض الشهادة ←';
      guideCta.setAttribute('href', 'certificate.html');
    } else {
      var sid = currentStageId || 'discover';
      var title = (STAGE_META[sid] && STAGE_META[sid].title) || sid;
      var num = STAGE_ORDER_LABEL[sid] || '';
      if (guideKicker) guideKicker.textContent = 'خطوتك التالية · المحطة ' + num + ' من 7';
      guideTitle.textContent = title;
      if (guideHint){
        guideHint.textContent = doneCount === 0
          ? 'ابدأ من هنا بالترتيب. بعد ما تكمّل المحطة تُفتح اللي بعدها تلقائياً.'
          : ('أنجزت ' + doneCount + ' من 7. كمّل المحطة الذهبية أدناه — هذي مرحلتك الحالية.');
      }
      guideCta.textContent = 'ادخل محطتك الآن ←';
      guideCta.setAttribute('href', STAGE_HREFS[sid] || 'discover.html');
    }
  }

  if (heroCta){
    var hs = currentStageId || getCurrentStageId() || 'discover';
    if (doneCount >= JOURNEY_ORDER.length){
      heroCta.textContent = 'عرض شهادتك ←';
      heroCta.setAttribute('href', 'certificate.html');
    } else {
      heroCta.textContent = loggedInName ? 'كمّل محطتك ←' : 'ابدأ من المحطة 1 ←';
      heroCta.setAttribute('href', STAGE_HREFS[hs] || 'discover.html');
    }
  }
}

// ----- بوابة القفل للصفحات -----
var lockGate = document.getElementById('lockGate');
var pageStage = document.body.getAttribute('data-page-stage');

function refreshPageLockGate(){
  if (!pageStage || !lockGate) return;
  var mainContent = document.getElementById('main');
  var unlocked = isUnlocked(pageStage);

  if (!unlocked){
    if (mainContent) mainContent.hidden = true;
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
  } else {
    lockGate.hidden = true;
    if (mainContent) mainContent.hidden = false;
  }
}

if (pageStage){
  markVisited(pageStage);
  refreshPageLockGate();
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
      statusMsg.textContent = 'الحساب جاهز — أكّد ملكية البريد أو رقم الهاتف برمز التحقق';
      statusMsg.classList.add('show');
      signupSubmit.disabled = false;
      signupSubmit.textContent = 'إنشاء الحساب';
      // إرسال الرمز تلقائياً بعد إنشاء الحساب
      var autoSend = document.getElementById('verifySendCode');
      if (autoSend) {
        setTimeout(function () { autoSend.click(); }, 400);
      }
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
        statusMsg.textContent = 'أدخل البريد أو رقم الهاتف أولاً';
        statusMsg.classList.add('show');
        return;
      }
      try {
        resetSendCode.disabled = true;
        var otp = await HCIApi.request('/api/auth/request-otp', {
          method: 'POST',
          body: { identifier: resetIdentifier.value.trim(), purpose: 'reset' }
        });
        var resetDemoCode = document.getElementById('resetDemoCode');
        if (resetDemoCode && otp.demoCode) {
          resetDemoCode.hidden = false;
          resetDemoCode.textContent = 'رمز التحقق: ' + otp.demoCode;
        }
        statusMsg.textContent = otp.message;
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

  // ---- تأكيد البريد/الهاتف ----
  var verifySendCode = document.getElementById('verifySendCode');
  var verifyDemoCode = document.getElementById('verifyDemoCode');
  var verifyIdentifierEl = document.getElementById('verifyIdentifier');
  var verifyCode = document.getElementById('verifyCode');
  var verifySubmit = document.getElementById('verifySubmit');

  if (verifySendCode) {
    verifySendCode.addEventListener('click', async function () {
      if (!verifyIdentifierEl || !verifyIdentifierEl.value.trim()) {
        statusMsg.textContent = 'أدخل البريد أو رقم الهاتف';
        statusMsg.classList.add('show');
        return;
      }
      try {
        verifySendCode.disabled = true;
        verifySendCode.textContent = 'جاري الإرسال…';
        var otp = await HCIApi.request('/api/auth/request-otp', {
          method: 'POST',
          body: { identifier: verifyIdentifierEl.value.trim(), purpose: 'verify' }
        });
        if (verifyDemoCode && otp.demoCode) {
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
        verifySendCode.textContent = 'إرسال رمز التحقق';
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
        statusMsg.textContent = 'تم التأكيد. جاري فتح مسارك…';
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
}

// مزامنة التقدم من السيرفر عند وجود جلسة + توجيه المسار الناقص
if (window.HCIApi && HCIApi.isLoggedIn()){
  HCIApi.syncProgress().then(function(){
    // بعد المزامنة: أعد تقييم القفل (قد يكون الترميز مفتوحاً على السيرفر)
    if (typeof refreshPageLockGate === 'function') refreshPageLockGate();

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

// رسائل من الإدارة + تنبيهات في الملف الشخصي
var inboxList = document.getElementById('inboxList');
function escapeHtml(str){
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function formatNotifTime(iso){
  if (!iso) return '';
  try {
    var d = new Date(iso);
    return d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
}
function renderInboxCard(item){
  var isMsg = item.kind === 'message';
  var unread = !item.read;
  return '<article class="inbox-card' + (unread ? ' is-unread' : '') + '" data-kind="' + item.kind + '" data-id="' + item.id + '"' +
    (item.refId ? ' data-ref="' + item.refId + '"' : '') + '>' +
    '<div class="inbox-card-top">' +
      '<span class="inbox-card-type">' + escapeHtml(item.typeLabel) + '</span>' +
      '<span class="inbox-card-state">' + (unread ? 'جديدة' : 'مقروءة') + '</span>' +
    '</div>' +
    '<h3 class="inbox-card-title">' + escapeHtml(item.title) + '</h3>' +
    '<p class="inbox-card-preview">' + escapeHtml(item.preview) + '</p>' +
    '<div class="inbox-card-meta">' +
      '<span>' + escapeHtml(item.meta || '') + '</span>' +
      '<span>' + escapeHtml(formatNotifTime(item.createdAt)) + '</span>' +
    '</div>' +
    '<div class="inbox-card-body" hidden>' + escapeHtml(item.body) + '</div>' +
    '<button type="button" class="inbox-open-btn">' + (unread ? 'فتح وقراءة' : 'عرض') + '</button>' +
  '</article>';
}
function loadInboxBox(){
  if (!inboxList || !window.HCIApi || !HCIApi.isLoggedIn()) return;
  inboxList.innerHTML = '<p class="progress-note">جاري التحميل…</p>';
  Promise.all([
    HCIApi.fetchMessages().catch(function(){ return { messages: [] }; }),
    HCIApi.fetchNotifications().catch(function(){ return { notifications: [] }; })
  ]).then(function(results){
    var messages = (results[0].messages || []).map(function(m){
      return {
        kind: 'message',
        id: m.id,
        refId: m.id,
        read: !!m.read,
        typeLabel: 'رسالة إدارة',
        title: m.subject,
        preview: m.body,
        body: m.body,
        meta: 'من ' + (m.from || 'الإدارة') + (m.updatedAt ? ' · عُدّلت' : ''),
        createdAt: m.createdAt
      };
    });
    var notifs = (results[1].notifications || [])
      .filter(function(n){ return n.type !== 'admin_message'; })
      .map(function(n){
        var label = n.type === 'report_sent' ? 'بلاغ' :
          n.type === 'report_done' ? 'إصلاح بلاغ' :
          n.type === 'settings' ? 'حفظ' : 'تنبيه';
        return {
          kind: 'notification',
          id: n.id,
          refId: n.refId,
          read: !!n.read,
          typeLabel: label,
          title: n.title,
          preview: n.body,
          body: n.body,
          meta: '',
          createdAt: n.createdAt
        };
      });
    var items = messages.concat(notifs).sort(function(a, b){
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    if (!items.length){
      inboxList.innerHTML = '<p class="progress-note">لا توجد رسائل أو تنبيهات حالياً.</p>';
      return;
    }
    inboxList.innerHTML = items.map(renderInboxCard).join('');
  }).catch(function(){
    inboxList.innerHTML = '<p class="progress-note">تعذر جلب الرسائل. تأكد من اتصال المنصة.</p>';
  });
}
if (inboxList){
  if (window.HCIApi && HCIApi.isLoggedIn()) loadInboxBox();
  var inboxRefreshBtn = document.getElementById('inboxRefreshBtn');
  var inboxMarkAllBtn = document.getElementById('inboxMarkAllBtn');
  if (inboxRefreshBtn) inboxRefreshBtn.addEventListener('click', loadInboxBox);
  if (inboxMarkAllBtn){
    inboxMarkAllBtn.addEventListener('click', function(){
      if (!window.HCIApi || !HCIApi.isLoggedIn()) return;
      Promise.all([
        HCIApi.markAllNotificationsRead().catch(function(){}),
        HCIApi.fetchMessages().then(function(data){
          return Promise.all((data.messages || []).filter(function(m){ return !m.read; }).map(function(m){
            return HCIApi.markMessageRead(m.id);
          }));
        }).catch(function(){})
      ]).then(function(){
        loadInboxBox();
        if (window.HCINotifCenter) HCINotifCenter.refresh();
      });
    });
  }
  inboxList.addEventListener('click', function(e){
    var btn = e.target.closest('.inbox-open-btn');
    if (!btn) return;
    var card = btn.closest('.inbox-card');
    if (!card) return;
    var body = card.querySelector('.inbox-card-body');
    var open = body && body.hasAttribute('hidden');
    if (body){
      if (open) body.removeAttribute('hidden');
      else body.setAttribute('hidden', '');
    }
    btn.textContent = open ? 'إخفاء' : (card.classList.contains('is-unread') ? 'فتح وقراءة' : 'عرض');
    if (!open) return;
    var kind = card.getAttribute('data-kind');
    var id = card.getAttribute('data-id');
    if (!window.HCIApi) return;
    var markPromise = kind === 'message'
      ? HCIApi.markMessageRead(id)
      : HCIApi.markNotificationRead(id);
    markPromise.then(function(){
      card.classList.remove('is-unread');
      var state = card.querySelector('.inbox-card-state');
      if (state) state.textContent = 'مقروءة';
      btn.textContent = 'إخفاء';
      if (window.HCINotifCenter) HCINotifCenter.refresh();
    }).catch(function(){});
  });
  if (location.hash === '#inbox'){
    setTimeout(function(){
      var sec = document.getElementById('sec-inbox');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }
}

// مركز التنبيهات — زر في الشريط + لوحة + تنبيه فوري بأي صفحة
(function setupNotifCenter(){
  if (!window.HCIApi || !HCIApi.isLoggedIn() || HCIApi.isAdmin()) return;

  var LOCAL_KEY = 'hci_local_notifs';
  var SEEN_KEY = 'hci_seen_notif_ids';

  function readLocal(){
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch (e) { return []; }
  }
  function writeLocal(list){
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 40))); } catch (e) { /* */ }
  }

  function pushLocal(title, body, link){
    var list = readLocal();
    var item = {
      id: 'local-' + Date.now(),
      type: 'local',
      title: title,
      body: body || '',
      link: link || '',
      read: false,
      createdAt: new Date().toISOString()
    };
    list.unshift(item);
    writeLocal(list);
    showToast(title, body, link);
    try {
      var seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
      seen.push('local:' + item.id);
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-80)));
    } catch (e) { /* */ }
    refresh(true, { quiet: true });
    return item;
  }

  function showToast(title, body, link){
    var existing = document.getElementById('adminMsgToast');
    if (existing) existing.remove();
    ensureUi();
    var host = document.querySelector('.nav-notif-wrap');
    var toast = document.createElement('div');
    toast.id = 'adminMsgToast';
    toast.className = host ? 'nav-notif-toast' : 'admin-msg-toast';
    toast.setAttribute('role', 'status');
    var shortBody = body ? String(body) : '';
    if (shortBody.length > 90) shortBody = shortBody.slice(0, 87) + '…';
    toast.innerHTML =
      '<div class="nav-notif-toast-top">' +
        '<span class="nav-notif-toast-label">تنبيه</span>' +
        '<button type="button" class="toast-close" aria-label="إغلاق">×</button>' +
      '</div>' +
      '<p class="nav-notif-toast-title">' + escapeHtml(title) + '</p>' +
      (shortBody ? '<p class="nav-notif-toast-body">' + escapeHtml(shortBody) + '</p>' : '') +
      (link ? '<a class="nav-notif-toast-link" href="' + escapeHtml(link) + '">عرض</a>' : '');
    if (host){
      var openPanel = document.getElementById('navNotifPanel');
      var notifBtn = document.getElementById('navNotifBtn');
      if (openPanel) openPanel.setAttribute('hidden', '');
      if (notifBtn) notifBtn.setAttribute('aria-expanded', 'false');
      host.appendChild(toast);
    } else document.body.appendChild(toast);
    toast.querySelector('.toast-close').addEventListener('click', function(e){
      e.stopPropagation();
      toast.remove();
    });
    toast.addEventListener('click', function(e){
      if (e.target.closest('.toast-close')) return;
      if (e.target.closest('a')) return;
      if (link) location.href = link;
    });
    setTimeout(function(){ if (toast.parentNode) toast.remove(); }, 4500);
  }

  function ensureUi(){
    var slot = document.querySelector('.nav-user-wrap') || document.getElementById('navCtaSlot');
    if (!slot || document.getElementById('navNotifBtn')) return;
    var wrap = document.createElement('span');
    wrap.className = 'nav-notif-wrap';
    wrap.innerHTML =
      '<button type="button" class="nav-notif-btn" id="navNotifBtn" aria-haspopup="true" aria-expanded="false" aria-label="التنبيهات">' +
        '<svg class="nav-notif-svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
          '<path fill="currentColor" d="M12 22a2.2 2.2 0 0 0 2.2-2.2h-4.4A2.2 2.2 0 0 0 12 22zm7-6.2V11a7 7 0 1 0-14 0v4.8L3 17.8V19h18v-1.2l-2-1.8z"/>' +
        '</svg>' +
        '<span class="nav-notif-count" id="navNotifCount" hidden></span>' +
      '</button>' +
      '<div class="nav-notif-panel" id="navNotifPanel" hidden>' +
        '<div class="nav-notif-head">' +
          '<strong>التنبيهات</strong>' +
          '<button type="button" class="nav-notif-markall" id="navNotifMarkAll">علم الكل مقروء</button>' +
        '</div>' +
        '<div class="nav-notif-list" id="navNotifList"><p class="progress-note">لا توجد تنبيهات</p></div>' +
        '<a class="nav-notif-footer" href="profile.html#inbox">فتح صندوق الرسائل</a>' +
      '</div>';
    slot.insertBefore(wrap, slot.firstChild);

    var btn = document.getElementById('navNotifBtn');
    var panel = document.getElementById('navNotifPanel');
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var open = panel.hasAttribute('hidden');
      if (open){
        panel.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
        refresh(true);
      } else {
        panel.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('click', function(ev){
      if (!wrap.contains(ev.target)){
        panel.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    document.getElementById('navNotifMarkAll').addEventListener('click', function(){
      var locals = readLocal().map(function(n){ n.read = true; return n; });
      writeLocal(locals);
      HCIApi.markAllNotificationsRead().catch(function(){}).then(function(){
        return HCIApi.fetchMessages().then(function(data){
          return Promise.all((data.messages || []).filter(function(m){ return !m.read; }).map(function(m){
            return HCIApi.markMessageRead(m.id);
          }));
        });
      }).catch(function(){}).then(function(){ refresh(true); if (typeof loadInboxBox === 'function') loadInboxBox(); });
    });
    document.getElementById('navNotifList').addEventListener('click', function(ev){
      var row = ev.target.closest('[data-nid]');
      if (!row) return;
      var nid = row.getAttribute('data-nid');
      var ntype = row.getAttribute('data-ntype');
      var link = row.getAttribute('data-link') || 'profile.html#inbox';
      if (String(nid).indexOf('local-') === 0){
        var locals = readLocal().map(function(n){
          if (String(n.id) === String(nid)) n.read = true;
          return n;
        });
        writeLocal(locals);
        refresh(true);
        location.href = link;
        return;
      }
      var p = ntype === 'message'
        ? HCIApi.markMessageRead(nid)
        : HCIApi.markNotificationRead(nid);
      p.catch(function(){}).then(function(){
        refresh(true);
        location.href = link;
      });
    });
  }

  function setBadge(count){
    var el = document.getElementById('navNotifCount');
    if (!el) return;
    if (count > 0){
      el.hidden = false;
      el.removeAttribute('hidden');
      el.textContent = count > 99 ? '99+' : String(count);
    } else {
      el.hidden = true;
      el.setAttribute('hidden', '');
      el.textContent = '';
    }
  }

  function refresh(renderList, options){
    options = options || {};
    ensureUi();
    Promise.all([
      HCIApi.fetchNotifications().catch(function(){ return { notifications: [], unreadCount: 0 }; }),
      HCIApi.fetchMessages().catch(function(){ return { messages: [], unreadCount: 0 }; })
    ]).then(function(results){
      var serverNotifs = results[0].notifications || [];
      var messages = results[1].messages || [];
      var locals = readLocal();

      var merged = [];
      serverNotifs.forEach(function(n){
        merged.push({
          id: n.id,
          ntype: 'notification',
          title: n.title,
          body: n.body,
          link: n.link || 'profile.html#inbox',
          read: !!n.read,
          createdAt: n.createdAt,
          type: n.type
        });
      });
      messages.forEach(function(m){
        var hasTwin = serverNotifs.some(function(n){ return n.type === 'admin_message' && Number(n.refId) === Number(m.id); });
        if (hasTwin) return;
        merged.push({
          id: m.id,
          ntype: 'message',
          title: m.subject,
          body: m.body,
          link: 'profile.html#inbox',
          read: !!m.read,
          createdAt: m.createdAt,
          type: 'admin_message'
        });
      });
      locals.forEach(function(n){
        merged.push({
          id: n.id,
          ntype: 'local',
          title: n.title,
          body: n.body,
          link: n.link || 'profile.html#inbox',
          read: !!n.read,
          createdAt: n.createdAt,
          type: 'local'
        });
      });
      merged.sort(function(a, b){ return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });

      var unread = merged.filter(function(n){ return !n.read; });
      setBadge(unread.length);

      if (renderList){
        var list = document.getElementById('navNotifList');
        if (list){
          if (!merged.length){
            list.innerHTML = '<p class="progress-note">لا توجد تنبيهات بعد</p>';
          } else {
            list.innerHTML = merged.slice(0, 20).map(function(n){
              return '<button type="button" class="nav-notif-item' + (n.read ? '' : ' is-unread') + '" data-nid="' + escapeHtml(String(n.id)) + '" data-ntype="' + escapeHtml(n.ntype) + '" data-link="' + escapeHtml(n.link) + '">' +
                '<span class="nav-notif-item-title">' + escapeHtml(n.title) + '</span>' +
                '<span class="nav-notif-item-body">' + escapeHtml(n.body) + '</span>' +
                '<span class="nav-notif-item-time">' + escapeHtml(formatNotifTime(n.createdAt)) + (n.read ? '' : ' · جديدة') + '</span>' +
              '</button>';
            }).join('');
          }
        }
      }

      if (options.quiet){
        var seenQuiet = [];
        try { seenQuiet = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch (e) { seenQuiet = []; }
        unread.forEach(function(n){
          var key = n.ntype + ':' + n.id;
          if (seenQuiet.indexOf(key) === -1) seenQuiet.push(key);
        });
        try { localStorage.setItem(SEEN_KEY, JSON.stringify(seenQuiet.slice(-80))); } catch (e) { /* */ }
        return;
      }

      var seen = [];
      try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch (e) { seen = []; }
      var fresh = unread.filter(function(n){
        var key = n.ntype + ':' + n.id;
        return seen.indexOf(key) === -1;
      });
      if (fresh.length){
        var first = fresh[0];
        showToast(first.title, first.body, first.link || 'profile.html#inbox');
        fresh.forEach(function(n){ seen.push(n.ntype + ':' + n.id); });
        try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-80))); } catch (e) { /* */ }
      }
    }).catch(function(){});
  }

  ensureUi();
  refresh(false);
  setInterval(function(){ refresh(false); }, 30000);

  window.HCINotifCenter = {
    refresh: function(quiet){ refresh(true, { quiet: !!quiet }); },
    pushLocal: pushLocal
  };
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
var settingsSaveAll = document.getElementById('settingsSaveAll');
var settingsSaveNote = document.getElementById('settingsSaveNote');
var settingsSizeRow = document.getElementById('settingsSizeRow');
var settingsSwatchRow = document.getElementById('settingsSwatchRow');
var settingsThemeRow = document.getElementById('settingsThemeRow');

if (settingsFirstName && settingsLastName){
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
}

if (settingsThemeRow){
  var themeButtons = settingsThemeRow.querySelectorAll('.size-btn');
  var themeNote = document.getElementById('settingsThemeNote');
  var currentTheme = LIGHT_THEME_AVAILABLE ? (localStorage.getItem('hci_theme') || 'dark') : 'dark';
  themeButtons.forEach(function(btn){
    var isLight = btn.getAttribute('data-theme') === 'light';
    btn.classList.toggle('active', btn.getAttribute('data-theme') === currentTheme);
    if (isLight && !LIGHT_THEME_AVAILABLE){
      btn.classList.add('is-disabled');
      btn.setAttribute('aria-disabled', 'true');
    }
    btn.addEventListener('click', function(){
      var theme = btn.getAttribute('data-theme');
      if (theme === 'light' && !LIGHT_THEME_AVAILABLE){
        if (themeNote){
          themeNote.textContent = 'الوضع الفاتح تحت الصيانة — ماتقدر تفعّله حالياً.';
          themeNote.hidden = false;
        }
        return;
      }
      setTheme(theme);
      themeButtons.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });
}

if (settingsSizeRow){
  var sizeButtons = settingsSizeRow.querySelectorAll('.size-btn');
  var storedSize = normalizeFontSize(localStorage.getItem('hci_font_size') || '18px');

  sizeButtons.forEach(function(btn){
    btn.classList.toggle('active', btn.getAttribute('data-size') === storedSize);
    btn.addEventListener('click', function(){
      var size = normalizeFontSize(btn.getAttribute('data-size'));
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
  var themeNow = localStorage.getItem('hci_theme') || 'dark';
  var resolvedStored = resolveAccentForTheme(themeNow, storedAccent);

  swatchButtons.forEach(function(btn){
    var c = btn.getAttribute('data-color');
    btn.classList.toggle('active', c === storedAccent || c === resolvedStored);
    btn.addEventListener('click', function(){
      var color = btn.getAttribute('data-color');
      localStorage.setItem('hci_accent_color', color);
      applyAccentColor(color);
      swatchButtons.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });
}

if (settingsSaveAll){
  settingsSaveAll.addEventListener('click', async function(){
    var first = settingsFirstName ? settingsFirstName.value.trim() : '';
    var last = settingsLastName ? settingsLastName.value.trim() : '';
    if (first.length < 2 || last.length < 2){
      if (settingsSaveNote) settingsSaveNote.textContent = 'أدخل الاسم الأول واسم العائلة (حرفان على الأقل لكل منهما).';
      return;
    }

    // ثبّت المظهر/الحجم/اللون من الاختيار الحالي
    if (settingsThemeRow){
      var activeTheme = settingsThemeRow.querySelector('.size-btn.active:not([data-theme="light"]), .size-btn[data-theme="dark"].active');
      if (!activeTheme) activeTheme = settingsThemeRow.querySelector('.size-btn[data-theme="dark"]');
      setTheme(activeTheme ? activeTheme.getAttribute('data-theme') : 'dark');
    }
    if (settingsSizeRow){
      var activeSize = settingsSizeRow.querySelector('.size-btn.active');
      if (activeSize){
        var size = normalizeFontSize(activeSize.getAttribute('data-size'));
        document.documentElement.style.fontSize = size;
        localStorage.setItem('hci_font_size', size);
      }
    }
    if (settingsSwatchRow){
      var activeSwatch = settingsSwatchRow.querySelector('.swatch-btn.active');
      if (activeSwatch){
        var color = activeSwatch.getAttribute('data-color');
        localStorage.setItem('hci_accent_color', color);
        applyAccentColor(color);
      }
    }

    settingsSaveAll.disabled = true;
    settingsSaveAll.textContent = 'جاري الحفظ…';
    try {
      if (window.HCIApi && HCIApi.isLoggedIn()){
        await HCIApi.updateProfile(first, last);
        if (settingsSaveNote) settingsSaveNote.textContent = 'تم حفظ التغييرات في الحساب والشهادة ولوحة الإدارة.';
      } else {
        localStorage.setItem('hci_user_name', first + ' ' + last);
        if (settingsSaveNote) settingsSaveNote.textContent = 'تم حفظ التغييرات محلياً.';
      }
      var chip = document.querySelector('.nav-user-name');
      if (chip) chip.textContent = first + ' ' + last;
      settingsSaveAll.textContent = 'تم الحفظ ✓';
      if (window.HCINotifCenter){
        HCINotifCenter.pushLocal(
          'تم حفظ التعديلات',
          'حُفظت بياناتك وتفضيلات العرض بنجاح.',
          'settings.html'
        );
      }
      setTimeout(function(){ settingsSaveAll.textContent = 'حفظ التغييرات'; }, 1600);
    } catch (err) {
      if (settingsSaveNote) settingsSaveNote.textContent = err.message || 'تعذر حفظ التغييرات';
      settingsSaveAll.textContent = 'حفظ التغييرات';
    } finally {
      settingsSaveAll.disabled = false;
    }
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
      var jUnlock = getJourney();
      if (!jUnlock.unlocked) jUnlock.unlocked = {};
      jUnlock.unlocked.coding = true;
      jUnlock.done = jUnlock.done || {};
      jUnlock.done.fundamentals = true;
      saveJourney(jUnlock);
      quizResult.textContent += ' — ممتاز! فُتح مسار الترميز.';
      if (window.HCIApi && HCIApi.isLoggedIn()){
        HCIApi.syncProgress().catch(function(){});
      }
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
    '<details class="report-details">' +
      '<summary class="report-summary">' +
        '<span class="report-summary-title">بلّغ عن مشكلة</span>' +
        '<span class="report-summary-hint">شفت خطأ أو شي مو واضح؟</span>' +
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
    '</details>';

  var footer = document.querySelector('footer');
  var footerInner = footer && footer.querySelector('.footer-inner');
  var footerBottom = footerInner && footerInner.querySelector('.footer-bottom');
  if (footerInner && footerBottom){
    var slot = document.createElement('div');
    slot.className = 'footer-report-slot';
    slot.appendChild(section);
    footerInner.insertBefore(slot, footerBottom);
  } else if (footer){
    footer.appendChild(section);
  } else {
    document.body.appendChild(section);
  }

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
      if (window.HCINotifCenter){
        HCINotifCenter.pushLocal(
          'تم إرسال بلاغك',
          'استلمنا البلاغ وسنراجعه. إذا تم الإصلاح سيظهر تنبيه هنا.',
          'profile.html#inbox'
        );
        setTimeout(function(){ HCINotifCenter.refresh(true); }, 800);
      } else {
        /* زائر: تنبيه صغير أعلى الصفحة */
        var guestToast = document.createElement('div');
        guestToast.id = 'adminMsgToast';
        guestToast.className = 'admin-msg-toast';
        guestToast.innerHTML = '<div class="nav-notif-toast-top"><span class="nav-notif-toast-label">تنبيه</span><button type="button" class="toast-close" aria-label="إغلاق">×</button></div><p class="nav-notif-toast-title">تم إرسال بلاغك</p>';
        document.body.appendChild(guestToast);
        guestToast.querySelector('.toast-close').addEventListener('click', function(){ guestToast.remove(); });
        setTimeout(function(){ if (guestToast.parentNode) guestToast.remove(); }, 4000);
      }
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

/* تبويبات الإعدادات / الملف — أزرار واضحة + تمرير دقيق تحت الهيدر */
(function initSettingsSideNav(){
  var side = document.querySelector('.settings-page .settings-side');
  if (!side) return;
  var links = Array.prototype.slice.call(side.querySelectorAll('.settings-side-link[data-target]'));
  if (!links.length) return;

  var lockUntil = 0;

  function headerOffset(){
    var header = document.querySelector('body > header');
    var h = header ? header.getBoundingClientRect().height : 72;
    return Math.round(h + 16);
  }

  function setActive(id){
    links.forEach(function(link){
      var on = link.getAttribute('data-target') === id;
      link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  function scrollToSection(id){
    var el = document.getElementById(id);
    if (!el) return;
    lockUntil = Date.now() + 900;
    setActive(id);
    var top = el.getBoundingClientRect().top + window.pageYOffset - headerOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* */ }
  }

  links.forEach(function(link){
    link.addEventListener('click', function(e){
      e.preventDefault();
      scrollToSection(link.getAttribute('data-target'));
    });
  });

  var sections = links.map(function(link){
    return document.getElementById(link.getAttribute('data-target'));
  }).filter(Boolean);

  if ('IntersectionObserver' in window && sections.length){
    var io = new IntersectionObserver(function(entries){
      if (Date.now() < lockUntil) return;
      var visible = entries
        .filter(function(en){ return en.isIntersecting; })
        .sort(function(a, b){ return b.intersectionRatio - a.intersectionRatio; });
      if (visible[0] && visible[0].target.id) setActive(visible[0].target.id);
    }, { rootMargin: '-22% 0px -52% 0px', threshold: [0.15, 0.4, 0.7] });
    sections.forEach(function(sec){ io.observe(sec); });
  }

  if (location.hash){
    var hashId = location.hash.replace(/^#/, '');
    if (document.getElementById(hashId)){
      setTimeout(function(){ scrollToSection(hashId); }, 60);
    }
  }
})();
