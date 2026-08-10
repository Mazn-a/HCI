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

/* ثيمات لون التمييز — خلفية سوداء + بطاقات محايدة + لون بارز */
var ACCENT_SURFACE = {
  ink2: '#121212',
  ink3: '#2A2A2A',
  inkSoft: '#1A1A1A',
  cardBg: 'rgba(0,0,0,0.28)',
  textHi: '#EAF3F6',
  textMid: '#9DB4C6',
  onAccent: '#111111',
  onHighlight: '#000000',
  highlight: '#6FD6E0',
  cyanRgb: '111, 214, 224',
  success: '#6FD6E0'
};

var ACCENT_THEMES = {
  gold: {
    id: 'gold',
    accent: '#C9A24B',
    goldRgb: '201, 162, 75',
    amber: '#F2A93B',
    violet: '#B79CE0',
    cardHover: 'rgba(201, 162, 75, 0.48)',
    badgeBg: 'rgba(201, 162, 75, 0.12)'
  },
  rose: {
    id: 'rose',
    /* وردي فقط — بدون ثانوي */
    accent: '#E0A0B4',
    goldRgb: '224, 160, 180',
    highlight: '#E0A0B4',
    cyanRgb: '224, 160, 180',
    amber: '#EBB4C4',
    violet: '#D4A0C0',
    cardHover: 'rgba(224, 160, 180, 0.48)',
    badgeBg: 'rgba(224, 160, 180, 0.14)',
    success: '#E0A0B4',
    onAccent: '#1A0C10',
    onHighlight: '#1A0C10'
  },
  green: {
    id: 'green',
    /* أخضر زيتوني بارز — بدون ثانوي */
    accent: '#7A9E4A',
    goldRgb: '122, 158, 74',
    highlight: '#7A9E4A',
    cyanRgb: '122, 158, 74',
    amber: '#8FB055',
    violet: '#6F9140',
    cardHover: 'rgba(122, 158, 74, 0.48)',
    badgeBg: 'rgba(122, 158, 74, 0.14)',
    success: '#7A9E4A',
    onAccent: '#0E1408',
    onHighlight: '#0E1408'
  }
};

function normalizeAccentHex(color){
  var c = String(color || '').trim().toLowerCase();
  if (!c) return '';
  if (c.charAt(0) !== '#') c = '#' + c;
  if (/^#[0-9a-f]{3}$/.test(c)){
    c = '#' + c.charAt(1) + c.charAt(1) + c.charAt(2) + c.charAt(2) + c.charAt(3) + c.charAt(3);
  }
  if (!/^#[0-9a-f]{6}$/.test(c)) return '';
  return c;
}

function hexToRgbParts(hex){
  var c = normalizeAccentHex(hex);
  if (!c) return null;
  return {
    r: parseInt(c.slice(1, 3), 16),
    g: parseInt(c.slice(3, 5), 16),
    b: parseInt(c.slice(5, 7), 16)
  };
}

function buildCustomAccentPack(hex){
  var accent = normalizeAccentHex(hex) || '#C9A24B';
  var rgb = hexToRgbParts(accent) || { r: 201, g: 162, b: 75 };
  var rgbStr = rgb.r + ', ' + rgb.g + ', ' + rgb.b;
  var lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  var on = lum > 0.58 ? '#1A120C' : '#F5F0EB';
  return {
    id: 'custom',
    accent: accent,
    goldRgb: rgbStr,
    highlight: accent,
    cyanRgb: rgbStr,
    amber: accent,
    violet: accent,
    cardHover: 'rgba(' + rgbStr + ', 0.48)',
    badgeBg: 'rgba(' + rgbStr + ', 0.14)',
    success: accent,
    onAccent: on,
    onHighlight: on
  };
}

function getAccentPack(color){
  var id = getAccentThemeId(color);
  var base = id === 'custom'
    ? buildCustomAccentPack(color)
    : (ACCENT_THEMES[id] || ACCENT_THEMES.gold);
  var pack = {};
  var k;
  for (k in ACCENT_SURFACE){ if (Object.prototype.hasOwnProperty.call(ACCENT_SURFACE, k)) pack[k] = ACCENT_SURFACE[k]; }
  for (k in base){ if (Object.prototype.hasOwnProperty.call(base, k)) pack[k] = base[k]; }
  return pack;
}

/* مطابقة ألوان السواتش / القيم القديمة → معرّف الثيم */
function getAccentThemeId(color){
  var c = normalizeAccentHex(color);
  if (!c) return 'gold';
  if (
    c === '#e0a0b4' || c === '#e8a0b0' || c === '#d4a0b0' ||
    c === '#e87888' || c === '#f05a6e'
  ) return 'rose';
  if (
    c === '#7a9e4a' || c === '#719641' || c === '#6b8e3a' || c === '#8fb055'
  ) return 'green';
  if (
    c === '#c9a24b' || c === '#e8c84a' || c === '#f0d060' ||
    c === '#a9843a' || c === '#f2a93b'
  ) return 'gold';
  return 'custom';
}

function resolveAccentForTheme(theme, color){
  var pack = getAccentPack(color);
  if (theme === 'light'){
    if (pack.id === 'gold') return '#A9843A';
    return pack.accent;
  }
  return pack.accent;
}

function applyAccentColor(color){
  var theme = document.documentElement.getAttribute('data-theme') || 'dark';
  var pack = getAccentPack(color);
  var root = document.documentElement;
  var accent = theme === 'light' && pack.id === 'gold' ? '#A9843A' : pack.accent;

  root.setAttribute('data-accent', pack.id);
  if (document.body) document.body.setAttribute('data-accent', pack.id);

  root.style.setProperty('--gold', accent);
  root.style.setProperty('--gold-rgb', pack.goldRgb);
  root.style.setProperty('--line-cyan', pack.highlight);
  root.style.setProperty('--cyan-rgb', pack.cyanRgb);
  root.style.setProperty('--line-amber', pack.amber);
  root.style.setProperty('--line-green', pack.highlight);
  root.style.setProperty('--line-violet', pack.violet);
  root.style.setProperty('--success', pack.success);
  root.style.setProperty('--on-accent', pack.onAccent);
  root.style.setProperty('--on-highlight', pack.onHighlight);
  root.style.setProperty('--text-hi', pack.textHi);
  root.style.setProperty('--text-mid', pack.textMid);

  if (theme !== 'light'){
    root.style.setProperty('--ink', '#000000');
    root.style.setProperty('--ink-2', pack.ink2);
    root.style.setProperty('--ink-3', pack.ink3);
    root.style.setProperty('--ink-soft', pack.inkSoft);
    root.style.setProperty('--card-bg', pack.cardBg);
    root.style.setProperty('--card-bg-panel', pack.ink2);
    root.style.setProperty('--card-border', pack.ink3);
    root.style.setProperty('--card-border-hover', pack.cardHover);
    root.style.setProperty('--badge-bg', pack.badgeBg);
    root.style.setProperty('--header-bg', '#000000');
    root.style.setProperty('--nav-panel', 'rgba(0,0,0,0.98)');
  }

  try {
    var id = pack.id;
    if (id === 'rose') localStorage.setItem('hci_accent_color', '#E0A0B4');
    else if (id === 'green') localStorage.setItem('hci_accent_color', '#7A9E4A');
    else if (id === 'gold') localStorage.setItem('hci_accent_color', DEFAULT_ACCENT_COLOR);
    else localStorage.setItem('hci_accent_color', pack.accent || DEFAULT_ACCENT_COLOR);
  } catch (e) { /* */ }
}

/* علبة ألوان مخصصة — أزرق / أحمر / أخضر / أصفر فقط (بدون أبيض وأسود ورمادي) */
var CUSTOM_ACCENT_PALETTE = {
  red:    ['#8B1A1A', '#A93226', '#C0392B', '#E74C3C', '#EF5350', '#F07167', '#FF6B6B', '#FF8A80'],
  yellow: ['#8B6914', '#A67C00', '#C9A227', '#D4AF37', '#E8C84A', '#F0D060', '#F5D76E', '#FFE066'],
  green:  ['#145A32', '#1B6B3A', '#1E8449', '#27AE60', '#2ECC71', '#3DDC84', '#58D68D', '#7DCEA0'],
  blue:   ['#1A5276', '#1F618D', '#2471A3', '#2980B9', '#3498DB', '#5DADE2', '#6FD6E0', '#85C1E9']
};

function closeAllAccentPalettes(){
  document.querySelectorAll('.accent-palette.is-open').forEach(function(el){
    el.classList.remove('is-open');
    el.hidden = true;
  });
  document.querySelectorAll('.swatch-custom[aria-expanded="true"]').forEach(function(btn){
    btn.setAttribute('aria-expanded', 'false');
  });
}

function syncAccentPaletteSelection(panel, color){
  if (!panel) return;
  var c = normalizeAccentHex(color);
  panel.querySelectorAll('.accent-palette-swatch').forEach(function(btn){
    btn.classList.toggle('active', normalizeAccentHex(btn.getAttribute('data-color')) === c);
  });
}

function initAccentColorPicker(opts){
  var btn = opts && opts.button;
  var panel = opts && opts.panel;
  var onPick = opts && opts.onPick;
  if (!btn || !panel) return;

  if (!panel.dataset.built){
    var groups = [
      { key: 'red', label: 'أحمر' },
      { key: 'yellow', label: 'أصفر' },
      { key: 'green', label: 'أخضر' },
      { key: 'blue', label: 'أزرق' }
    ];
    panel.innerHTML = '';
    groups.forEach(function(g){
      var row = document.createElement('div');
      row.className = 'accent-palette-row';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', g.label);
      (CUSTOM_ACCENT_PALETTE[g.key] || []).forEach(function(hex){
        var sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'accent-palette-swatch';
        sw.setAttribute('data-color', hex);
        sw.setAttribute('aria-label', g.label + ' ' + hex);
        sw.title = hex;
        sw.style.background = hex;
        sw.addEventListener('click', function(e){
          e.preventDefault();
          e.stopPropagation();
          if (typeof onPick === 'function') onPick(hex);
          closeAllAccentPalettes();
        });
        row.appendChild(sw);
      });
      panel.appendChild(row);
    });
    panel.dataset.built = '1';
  }

  btn.addEventListener('click', function(e){
    e.preventDefault();
    e.stopPropagation();
    var open = panel.classList.contains('is-open');
    closeAllAccentPalettes();
    if (!open){
      panel.hidden = false;
      panel.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      syncAccentPaletteSelection(panel, localStorage.getItem('hci_accent_color'));
    }
  });
}

if (!window.__hciAccentPaletteDocBound){
  window.__hciAccentPaletteDocBound = true;
  document.addEventListener('click', function(e){
    if (e.target.closest('.swatch-custom-wrap')) return;
    closeAllAccentPalettes();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closeAllAccentPalettes();
  });
}

var DEFAULT_ACCENT_COLOR = '#C9A24B';

var savedAccent = localStorage.getItem('hci_accent_color');
(function applyThemeEarly(){
  var theme = localStorage.getItem('hci_theme') || 'dark';
  if (!LIGHT_THEME_AVAILABLE || theme !== 'light') theme = 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  if (document.body) document.body.setAttribute('data-theme', theme);
  try { localStorage.setItem('hci_theme', theme); } catch (e) { /* */ }

  /* الذهبي افتراضي فقط إن ما فيه لون محفوظ — اختيار المستخدم يبقى */
  applyAccentColor(savedAccent || DEFAULT_ACCENT_COLOR);
})();

function setTheme(theme){
  if (!LIGHT_THEME_AVAILABLE || theme !== 'light') theme = 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  if (document.body) document.body.setAttribute('data-theme', theme);
  try { localStorage.setItem('hci_theme', theme); } catch (e) { /* */ }
  applyAccentColor(localStorage.getItem('hci_accent_color') || DEFAULT_ACCENT_COLOR);
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
  try {
    localStorage.setItem('hci_journey', JSON.stringify(data));
  } catch (e) { /* تخزين ممتلئ أو محظور — نكمل بدون توقف باقي السكربت */ }
  if (window.HCIApi) HCIApi.scheduleSync();
}

/** اجتياز اختبار أساسيات HCI مطلوب قبل اعتبار المرحلة مكتملة وفتح الترميز */
function isFundamentalsQuizPassed(){
  if (window.HCIApi && (HCIApi.isAdmin() || HCIApi.isSpecialist())) return true;
  try {
    var q = JSON.parse(localStorage.getItem('hci_quiz') || '{}');
    return !!(q.fundamentals && q.fundamentals.passed);
  } catch (e) {
    return false;
  }
}

/** يصحّح تقدماً خاطئاً: أساسيات «مكتملة» بدون اختبار → تُلغى، والترميز يُقفل */
function sanitizeJourneyProgress(){
  if (window.HCIApi && (HCIApi.isAdmin() || HCIApi.isSpecialist())) return;
  var j = getJourney();
  if (!j.done) j.done = {};
  if (!j.unlocked) j.unlocked = {};
  var changed = false;

  if (j.done.fundamentals && !isFundamentalsQuizPassed()){
    delete j.done.fundamentals;
    changed = true;
  }
  if (!isFundamentalsQuizPassed()){
    if (j.unlocked.coding){
      delete j.unlocked.coding;
      changed = true;
    }
  }

  if (changed){
    try { localStorage.setItem('hci_journey', JSON.stringify(j)); } catch (e) { /* */ }
  }
}

function markVisited(stageId){
  var j = getJourney();
  if (!j.visited) j.visited = {};
  j.visited[stageId] = true;
  saveJourney(j);
}

function markComplete(stageId, silent){
  // الأساسيات لا تُكمَل إلا بعد اجتياز الاختبار (3/4)
  if (stageId === 'fundamentals' && !isFundamentalsQuizPassed()){
    return false;
  }

  var j = getJourney();
  if (!j.done) j.done = {};
  if (!j.unlocked) j.unlocked = {};
  var wasNew = !j.done[stageId];
  j.done[stageId] = true;

  var toastMsg = '';

  // فتح المرحلة التالية في السلسلة
  var next = STAGE_META[stageId] && STAGE_META[stageId].unlocks;
  if (next){
    if (!j.unlocked[next] && !j.done[next]){
      j.unlocked[next] = true;
      toastMsg = 'فتحت مرحلة جديدة: ' + STAGE_META[next].title + ' ✨';
    } else {
      j.unlocked[next] = true;
    }
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

  var allDone = JOURNEY_ORDER.every(function(id){ return !!j.done[id]; });
  if (allDone && !j.completedAt) j.completedAt = new Date().toISOString();

  saveJourney(j);

  if (wasNew && !silent && toastMsg){
    showUnlockToast(toastMsg);
  }

  return wasNew;
}

function isUnlocked(stageId){
  // المدير والمتخصص: كل المسارات مفتوحة
  if (window.HCIApi && (HCIApi.isAdmin() || HCIApi.isSpecialist())) return true;

  // الطالب: ترتيب صارم — المرحلة تنفتح فقط بعد إكمال اللي قبلها
  if (stageId === 'discover') return true;

  if (isDone(stageId)) return true;

  var idx = JOURNEY_ORDER.indexOf(stageId);
  if (idx <= 0) return true;
  var prev = JOURNEY_ORDER[idx - 1];
  return isDone(prev);
}

function isDone(stageId){
  var j = getJourney();
  if (!(j.done && j.done[stageId])) return false;
  // أساسيات HCI: مكتملة فقط بعد اجتياز الاختبار
  if (stageId === 'fundamentals') return isFundamentalsQuizPassed();
  return true;
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
    reason: 'لفتح «أساسيات HCI» أكمل أولاً مسار «اكتشف التخصص»، ثم اضغط «التالي».',
    href: 'discover.html',
    cta: 'افتح اكتشف التخصص'
  },
  coding: {
    reason: 'مسار الترميز ينفتح بعد ما تجتاز اختبار أساسيات HCI بنتيجة 3 من 4 على الأقل.',
    href: 'fundamentals.html#quiz',
    cta: 'العودة لاختبار الأساسيات'
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
    reason: 'لفتح التمارين أكمل أولاً مسار «اكتشف التخصص».',
    href: 'discover.html',
    cta: 'افتح اكتشف التخصص'
  },
  contribute: {
    reason: 'لفتح «أفد غيرك» أكمل 4 مسارات على الأقل من رحلتك التعليمية.',
    href: 'index.html#paths',
    cta: 'عرض المسارات'
  }
};

function getLockReason(stageId){
  return (STAGE_LOCK_INFO[stageId] && STAGE_LOCK_INFO[stageId].reason) ||
    'لفتح هالمرحلة أكمل المسار السابق أولاً.';
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
        '<button type="button" class="btn-ghost" id="lockDialogClose">فهمت</button>' +
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

function showCertReadyDialog(){
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
      '<p class="lock-dialog-eyebrow">/// أحسنت</p>' +
      '<h3 id="lockDialogTitle">حصلت على شهادتك</h3>' +
      '<p class="lock-dialog-reason">أكملت المسار كامل. شهادتك جاهزة باسمك — فكّها الحين لعرضها أو طباعتها.</p>' +
      '<div class="lock-dialog-actions">' +
        '<button type="button" class="btn-ghost" id="lockDialogClose">لاحقاً</button>' +
        '<a href="certificate.html" class="btn-primary" id="lockDialogGo">فك الشهادة ←</a>' +
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
      hint.innerHTML = 'حدّد كل البنود، ثم اضغط الزر للمتابعة.';
      var h4 = list.querySelector('h4');
      if (h4) h4.insertAdjacentElement('afterend', hint);
      else list.insertBefore(hint, list.firstChild);
    }
  });
}

// تهيئة الرحلة — بدون فتح الأساسيات/الترميز قبل أوانها
function bootstrapUnlockFromHome(){
  var hasSession = !!(localStorage.getItem('hci_user_name') || (window.HCIApi && HCIApi.isLoggedIn && HCIApi.isLoggedIn()));
  if (!hasSession) return;
  var j = getJourney();
  if (!j.unlocked) j.unlocked = {};
  if (!j.bootstrapped){
    j.bootstrapped = true;
    saveJourney(j);
  }
  sanitizeJourneyProgress();
}
bootstrapUnlockFromHome();

// ----- رجوع للأعلى (يبقى فوق خط التذييل عند الوصول لآخر الصفحة) -----
var backToTop = document.getElementById('backToTop');
if (backToTop){
  var siteFooter = document.querySelector('footer');
  function syncBackToTop(){
    var show = window.scrollY > 420;
    backToTop.classList.toggle('show', show);
    if (!show || !siteFooter){
      backToTop.style.bottom = '';
      return;
    }
    var fr = siteFooter.getBoundingClientRect();
    var overlap = Math.max(0, window.innerHeight - fr.top);
    if (overlap > 0){
      backToTop.style.bottom = (overlap + 14) + 'px';
    } else {
      backToTop.style.bottom = '';
    }
  }
  var backToTopTicking = false;
  function onBackToTopScroll(){
    if (backToTopTicking) return;
    backToTopTicking = true;
    requestAnimationFrame(function(){
      syncBackToTop();
      backToTopTicking = false;
    });
  }
  window.addEventListener('scroll', onBackToTopScroll, { passive: true });
  window.addEventListener('resize', onBackToTopScroll);
  syncBackToTop();
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

function closeAccountMenu(){
  var btn = document.getElementById('navUserMenuBtn');
  var drop = document.getElementById('navDropdown');
  if (drop) drop.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function setNavOpen(isOpen){
  if (!navLinks || !menuBtn) return;
  navLinks.classList.toggle('is-open', isOpen);
  menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  document.body.classList.toggle('nav-open', isOpen);
  if (navBackdrop) navBackdrop.classList.toggle('is-visible', isOpen);
  if (isOpen) closeAccountMenu();
}

if (menuBtn && navLinks){
  menuBtn.addEventListener('click', function(e){
    e.stopPropagation();
    setNavOpen(!navLinks.classList.contains('is-open'));
  });
  navLinks.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (a && navLinks.contains(a)) setNavOpen(false);
  });
  if (navBackdrop){
    navBackdrop.addEventListener('click', function(){ setNavOpen(false); });
  }
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape'){
      setNavOpen(false);
      closeAccountMenu();
    }
  });
  window.addEventListener('resize', function(){
    if (window.innerWidth > 860) setNavOpen(false);
  });
  // أغلق القائمة عند التحميل لتفادي بقاء شريط مائل/جزئي
  setNavOpen(false);
}

// ----- حساب المستخدم -----
var loggedInName = localStorage.getItem('hci_user_name');

/* للزائر: اخفِ الرئيسية والمسارات — يظهران بعد تسجيل الدخول / إنشاء حساب */
(function hideGuestNavLinks(){
  var links = document.getElementById('navLinks');
  if (!links) return;
  var isLoggedIn = !!(loggedInName || (window.HCIApi && HCIApi.isLoggedIn && HCIApi.isLoggedIn()));
  if (isLoggedIn) return;
  Array.prototype.slice.call(links.querySelectorAll('a')).forEach(function(a){
    var t = (a.textContent || '').replace(/\s+/g, ' ').trim();
    if (t === 'الرئيسية' || t === 'المسارات' || t === 'المعجم') {
      a.setAttribute('hidden', '');
      a.style.display = 'none';
    }
  });
})();

var greetingEl = document.getElementById('greeting');
if (greetingEl){
  var hour = new Date().getHours();
  var greetingText = 'أهلاً بك';
  if (hour < 12) { greetingText = 'صباح الخير'; }
  else if (hour < 17) { greetingText = 'مساء الخير'; }
  else { greetingText = 'مساء النور'; }

  if (loggedInName){
    greetingText += '، ' + loggedInName;
  } else {
    greetingText += ' — مرحباً بك';
  }

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
  var adminLinkHtml = (window.HCIApi && HCIApi.isAdmin())
    ? '<a href="admin.html" class="nav-dropdown-admin">لوحة الإدارة</a>'
    : '';
  var navAccountHref = 'profile.html';
  try {
    var navUser = window.HCIApi && HCIApi.currentUser ? HCIApi.currentUser() : null;
    if (navUser && navUser.pathType === 'curious' && !navUser.introSeen) navAccountHref = 'settings.html';
  } catch (e) { /* */ }
  /* ملاحظة: زر الإدارة الذهبي يظهر مرة واحدة بجانب الحساب — القائمة احتياطي */
  navCtaSlot.innerHTML =
    '<span class="nav-user-wrap">' +
      '<a href="' + navAccountHref + '" class="nav-user" id="navUserProfileLink" aria-label="الملف الشخصي">' +
        '<span class="chip-avatar" id="navAvatarChip">' + loggedInName.charAt(0) + '</span>' +
        '<span class="nav-user-name">' + loggedInName + '</span>' +
      '</a>' +
      '<button type="button" class="nav-user-menu-btn" id="navUserMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="خيارات الحساب">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
          '<path fill="currentColor" d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>' +
        '</svg>' +
      '</button>' +
      '<div class="nav-dropdown" id="navDropdown">' +
        adminLinkHtml +
        '<a href="profile.html">الملف الشخصي</a>' +
        '<a href="profile.html#share">مشاركة الموقع</a>' +
        '<a href="settings.html">الإعدادات</a>' +
        '<a href="#" id="switchAccountLink">تبديل الحساب</a>' +
        '<a href="#" id="logoutLink" class="nav-dropdown-logout">تسجيل خروج</a>' +
      '</div>' +
    '</span>';

  function ensureAdminNavControls(){
    if (!(window.HCIApi && HCIApi.isAdmin())) return;

    /* إزالة التكرار القديم إن وُجد */
    var oldLink = document.getElementById('navAdminLink');
    if (oldLink) oldLink.remove();
    var oldFab = document.getElementById('adminFab');
    if (oldFab) oldFab.remove();

    /* زر إدارة واحد فقط — بجانب الحساب */
    if (!document.getElementById('navAdminBtn')){
      var adminBtn = document.createElement('a');
      adminBtn.href = 'admin.html';
      adminBtn.id = 'navAdminBtn';
      adminBtn.className = 'nav-admin-btn';
      adminBtn.textContent = 'الإدارة';
      adminBtn.setAttribute('aria-label', 'لوحة الإدارة');
      navCtaSlot.insertBefore(adminBtn, navCtaSlot.firstChild);
    }
  }
  ensureAdminNavControls();
  window.HCIEnsureAdminNav = ensureAdminNavControls;
  applyAvatarToEl(document.getElementById('navAvatarChip'), loggedInName);

  var navUserMenuBtn = document.getElementById('navUserMenuBtn');
  var navDropdown = document.getElementById('navDropdown');
  var navUserProfileLink = document.getElementById('navUserProfileLink');

  function toggleAccountMenu(e){
    if (e) e.preventDefault();
    if (e) e.stopPropagation();
    setNavOpen(false);
    var isOpen = navDropdown.classList.toggle('open');
    if (navUserMenuBtn) navUserMenuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  if (navUserMenuBtn){
    navUserMenuBtn.addEventListener('click', toggleAccountMenu);
  }
  /* على الجوال: الأفاتار يفتح قائمة الحساب بدل البرغر/⋮ */
  if (navUserProfileLink){
    navUserProfileLink.addEventListener('click', function(e){
      if (window.matchMedia('(max-width: 860px)').matches){
        toggleAccountMenu(e);
      }
    });
  }
  document.addEventListener('click', function(event){
    if (!navDropdown) return;
    var wrap = document.querySelector('.nav-user-wrap');
    if (wrap && !wrap.contains(event.target)){
      closeAccountMenu();
    }
  });

  async function doLogout(e){
    if (e) e.preventDefault();
    try {
      localStorage.setItem('hci_accent_color', DEFAULT_ACCENT_COLOR);
      applyAccentColor(DEFAULT_ACCENT_COLOR);
    } catch (err) { /* */ }
    if (window.HCIApi) await HCIApi.logout();
    window.location.href = 'index.html';
  }
  async function doSwitchAccount(e){
    if (e) e.preventDefault();
    try {
      localStorage.setItem('hci_accent_color', DEFAULT_ACCENT_COLOR);
      applyAccentColor(DEFAULT_ACCENT_COLOR);
    } catch (err) { /* */ }
    if (window.HCIApi) await HCIApi.logout();
    window.location.href = 'auth.html';
  }
  var logoutLink = document.getElementById('logoutLink');
  if (logoutLink) logoutLink.addEventListener('click', doLogout);
  var switchAccountLink = document.getElementById('switchAccountLink');
  if (switchAccountLink) switchAccountLink.addEventListener('click', doSwitchAccount);
}

if (heroCta && loggedInName){
  heroCta.textContent = 'أكمل مسارك ←';
  heroCta.setAttribute('href', '#paths');
} else if (heroCta && !(window.HCIApi && HCIApi.isLoggedIn && HCIApi.isLoggedIn())){
  heroCta.textContent = 'ابدأ رحلتك ←';
  heroCta.setAttribute('href', 'auth.html?tab=signup');
}

// ----- شريط التقدم العام (للمسجّلين فقط) -----
var overallFill = document.getElementById('overallProgressFill');
var overallPct = document.getElementById('overallProgressPct');
var journeyStrip = document.getElementById('journeyStrip');
var isLoggedInForProgress = !!(loggedInName || (window.HCIApi && HCIApi.isLoggedIn && HCIApi.isLoggedIn()));
if (journeyStrip){
  if (isLoggedInForProgress) journeyStrip.removeAttribute('hidden');
  else journeyStrip.setAttribute('hidden', '');
}
if (isLoggedInForProgress && (overallFill || overallPct)){
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
if (stationsRoot && !isLoggedInForProgress){
  var guestGuideTitle = document.getElementById('pathGuideTitle');
  var guestGuideHint = document.getElementById('pathGuideHint');
  var guestGuideCta = document.getElementById('pathGuideCta');
  var guestGuideKicker = document.getElementById('pathGuideKicker');
  var guestGuideProfile = document.getElementById('pathGuideProfile');
  if (guestGuideKicker) guestGuideKicker.textContent = 'قبل ما تبدأ';
  if (guestGuideTitle) guestGuideTitle.textContent = 'سبعة مسارات بالترتيب — من الفضول إلى الإفادة';
  if (guestGuideHint) guestGuideHint.textContent = 'التقدم يُحفظ على حسابك فقط. أنشئ حساباً مجاناً عشان يبدأ مسارك من الصفر باسمك.';
  if (guestGuideCta){
    guestGuideCta.textContent = 'أنشئ حساب وابدأ ←';
    guestGuideCta.setAttribute('href', 'auth.html?tab=signup');
  }
  if (guestGuideProfile){
    guestGuideProfile.textContent = 'تسجيل الدخول';
    guestGuideProfile.setAttribute('href', 'auth.html');
  }
  stationsRoot.querySelectorAll('[data-stage]').forEach(function(station){
    var statusEl = station.querySelector('.station-status');
    var link = station.querySelector('.station-link');
    var isFirst = station.getAttribute('data-stage') === 'discover';
    station.classList.remove('is-done');
    station.classList.toggle('is-locked', !isFirst);
    station.removeAttribute('aria-current');
    if (isFirst){
      station.setAttribute('aria-current', 'step');
      if (statusEl){ statusEl.textContent = 'ابدأ من هنا'; statusEl.className = 'station-status open'; }
      if (link){
        link.classList.remove('disabled');
        link.classList.remove('show-lock-reason');
        link.removeAttribute('aria-disabled');
        link.setAttribute('href', 'auth.html?tab=signup');
        link.textContent = 'أنشئ حساب وابدأ ←';
        link.removeAttribute('title');
      }
    } else {
      if (statusEl){ statusEl.textContent = 'بعد التسجيل'; statusEl.className = 'station-status locked'; }
      if (link){
        link.classList.add('disabled');
        link.classList.add('show-lock-reason');
        link.setAttribute('aria-disabled', 'true');
        link.setAttribute('href', 'auth.html?tab=signup');
        link.title = 'أنشئ حساباً أولاً عشان يُحفظ تقدمك';
        link.addEventListener('click', function(e){
          e.preventDefault();
          location.href = 'auth.html?tab=signup';
        });
      }
    }
  });
} else if (stationsRoot){
  var stations = stationsRoot.querySelectorAll('[data-stage]');
  var currentAssigned = false;
  var currentStageId = null;
  var doneCountEarly = JOURNEY_ORDER.filter(isDone).length;

  function stageTitle(id){
    return (STAGE_META[id] && STAGE_META[id].title) || id;
  }

  function focusCurrentStationCta(){
    var current = stationsRoot.querySelector('.station[aria-current="step"]');
    if (!current){
      current = stationsRoot.querySelector('.station:not(.is-locked):not(.is-done)');
    }
    if (!current) return;
    current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    current.classList.remove('pulse-glow-card');
    var link = current.querySelector('.station-link');
    if (link) link.classList.remove('pulse-glow');
    void current.offsetWidth;
    current.classList.add('pulse-glow-card');
    if (link) link.classList.add('pulse-glow');
    setTimeout(function(){
      current.classList.remove('pulse-glow-card');
      if (link) link.classList.remove('pulse-glow');
    }, 3200);
  }

  stations.forEach(function(station){
    var id = station.getAttribute('data-stage');
    var statusEl = station.querySelector('.station-status');
    var link = station.querySelector('.station-link');
    var unlocked = isUnlocked(id);
    var done = isDone(id);
    var title = stageTitle(id);

    station.classList.toggle('is-locked', !unlocked);
    station.classList.toggle('is-done', done);

    if (!unlocked){
      station.removeAttribute('aria-current');
      if (statusEl){ statusEl.textContent = 'مقفل'; statusEl.className = 'station-status locked'; }
      if (link){
        link.classList.add('disabled');
        link.classList.add('show-lock-reason');
        link.setAttribute('aria-disabled', 'true');
        link.setAttribute('href', '#paths');
        link.textContent = title;
        link.title = 'أكمل المرحلة الحالية أولاً بالترتيب';
        link.addEventListener('click', function(e){
          e.preventDefault();
          focusCurrentStationCta();
        });
      }
    } else if (done){
      station.removeAttribute('aria-current');
      if (statusEl){ statusEl.textContent = 'مكتمل ✓'; statusEl.className = 'station-status done'; }
      if (link){
        link.classList.remove('disabled');
        link.classList.remove('show-lock-reason');
        link.removeAttribute('aria-disabled');
        link.textContent = title;
      }
    } else if (!currentAssigned){
      station.setAttribute('aria-current', 'step');
      currentAssigned = true;
      currentStageId = id;
      if (statusEl){ statusEl.textContent = 'أنت هنا'; statusEl.className = 'station-status open'; }
      if (link){
        link.classList.remove('disabled');
        link.classList.remove('show-lock-reason');
        link.removeAttribute('aria-disabled');
        link.textContent = doneCountEarly === 0 ? 'ابدأ من هنا ←' : 'كمّل من هنا ←';
      }
    } else {
      var bypassOrder = window.HCIApi && (HCIApi.isAdmin() || HCIApi.isSpecialist());
      if (bypassOrder){
        /* المدير / المتخصص: يقدرون يدخلون أي مرحلة */
        station.removeAttribute('aria-current');
        if (statusEl){ statusEl.textContent = 'متاح'; statusEl.className = 'station-status open'; }
        if (link){
          link.classList.remove('disabled');
          link.classList.remove('show-lock-reason');
          link.removeAttribute('aria-disabled');
          link.textContent = title;
        }
      } else {
        /* لاحقاً — ما نسمح بالدخول قبل الحالية */
        station.classList.add('is-locked');
        station.removeAttribute('aria-current');
        if (statusEl){ statusEl.textContent = 'لاحقاً'; statusEl.className = 'station-status locked'; }
        if (link){
          link.classList.add('disabled');
          link.classList.add('show-lock-reason');
          link.setAttribute('aria-disabled', 'true');
          link.setAttribute('href', '#paths');
          link.textContent = title;
          link.title = 'لازم تكمل المرحلة الحالية أولاً';
          link.addEventListener('click', function(e){
            e.preventDefault();
            focusCurrentStationCta();
          });
        }
      }
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
      if (guideHint) guideHint.textContent = 'تقدر ترجع لأي مسار للمراجعة، أو تطبع شهادتك من الملف الشخصي.';
      guideCta.textContent = 'عرض الشهادة ←';
      guideCta.setAttribute('href', 'certificate.html');
    } else {
      var sid = currentStageId || 'discover';
      var title = stageTitle(sid);
      var num = STAGE_ORDER_LABEL[sid] || '';
      if (guideKicker) guideKicker.textContent = 'خطوتك التالية · المسار ' + num + ' من 7';
      guideTitle.textContent = title;
      if (guideHint){
        guideHint.textContent = doneCount === 0
          ? 'ابدأ من هنا بالترتيب. بعد ما تكمّل المسار تُفتح اللي بعده تلقائياً.'
          : ('أنجزت ' + doneCount + ' من 7. كمّل المسار الذهبي أدناه — هذي مرحلتك الحالية.');
      }
      guideCta.textContent = doneCount === 0
        ? (sid === 'fundamentals' ? 'ابدأ من الأساسيات ←' : 'ابدأ من هنا ←')
        : (sid === 'fundamentals' ? 'كمّل الأساسيات ←' : 'كمّل من هنا ←');
      guideCta.setAttribute('href', STAGE_HREFS[sid] || 'discover.html');
    }
  }

  if (heroCta){
    var hs = currentStageId || getCurrentStageId() || 'discover';
    if (doneCount >= JOURNEY_ORDER.length){
      heroCta.textContent = 'عرض شهادتك ←';
      heroCta.setAttribute('href', 'certificate.html');
    } else if (loggedInName){
      if (doneCount === 0){
        heroCta.textContent = hs === 'fundamentals' ? 'ابدأ من الأساسيات ←' : 'ابدأ من هنا ←';
      } else if (hs === 'fundamentals'){
        heroCta.textContent = 'كمّل الأساسيات ←';
      } else if (hs === 'coding'){
        heroCta.textContent = 'كمّل الترميز ←';
      } else {
        heroCta.textContent = 'كمّل مسارك ←';
      }
      heroCta.setAttribute('href', STAGE_HREFS[hs] || 'discover.html');
    } else {
      // زائر: ابدأ من أول مسار مفتوح — مو من HTML
      var guestStart = getCurrentStageId() || 'discover';
      if (guestStart === 'coding' || guestStart === 'courses' || guestStart === 'books'){
        guestStart = isDone('discover') ? 'fundamentals' : 'discover';
      }
      heroCta.textContent = guestStart === 'fundamentals'
        ? 'ابدأ من الأساسيات ←'
        : 'ابدأ رحلتك ←';
      heroCta.setAttribute('href', STAGE_HREFS[guestStart] || 'discover.html');
    }
  }

  // لو الرابط فيه تنبيه ترتيب
  if (/(?:\?|&)needOrder=1(?:&|$)/.test(location.search || '')){
    setTimeout(focusCurrentStationCta, 350);
  }
}

// ----- بوابة القفل للصفحات -----
var lockGate = document.getElementById('lockGate');
var pageStage = document.body.getAttribute('data-page-stage');

function refreshPageLockGate(){
  var mainContent = document.getElementById('main');
  var stage = document.body.getAttribute('data-page-stage');
  var bypassOrder = window.HCIApi && (HCIApi.isAdmin() || HCIApi.isSpecialist());

  if (stage && !bypassOrder && !isUnlocked(stage) && !isDone(stage)){
    // أرجع للمسارات مع إشعاع على الخطوة الحالية
    location.replace('index.html?needOrder=1#paths');
    return;
  }

  if (lockGate) lockGate.hidden = true;
  if (mainContent) mainContent.hidden = false;
}

if (pageStage){
  var canEnterStage = (window.HCIApi && (HCIApi.isAdmin() || HCIApi.isSpecialist())) || isUnlocked(pageStage) || isDone(pageStage);
  if (canEnterStage) markVisited(pageStage);
  refreshPageLockGate();
}

// تلميح قوائم المراجعة + شرط تحديد الكل قبل التالي
annotateChecklists();

// زر إكمال مرحلة (contribute وغيرها) — يكمل ويوجّه إن لزم
var markCompleteBtn = document.getElementById('markCompleteBtn');
if (markCompleteBtn && pageStage){
  if (pageStage === 'contribute'){
    markCompleteBtn.textContent = 'فك الشهادة ←';
    markCompleteBtn.setAttribute('href', 'certificate.html');
  } else if (isDone(pageStage) && markCompleteBtn.tagName === 'BUTTON'){
    markCompleteBtn.textContent = 'أكملت هالمرحلة ✓';
    markCompleteBtn.disabled = true;
    markCompleteBtn.style.opacity = '0.7';
  }
  markCompleteBtn.addEventListener('click', function(e){
    var check = ensureChecklistsComplete();
    if (!check.ok){
      e.preventDefault();
      showLockAlert(check.message, null, null);
      return;
    }
    var wasNew = markComplete(pageStage);
    if (overallFill) overallFill.style.width = getOverallProgress() + '%';
    if (overallPct) overallPct.textContent = getOverallProgress() + '%';

    if (pageStage === 'contribute'){
      e.preventDefault();
      if (!wasNew){
        window.location.href = 'certificate.html';
        return;
      }
      if (window.HCINotifCenter){
        HCINotifCenter.pushLocal(
          'حصلت على شهادتك',
          'أكملت المسار كامل. شهادتك جاهزة — اضغط لفكّها.',
          'certificate.html',
          true
        );
      }
      showCertReadyDialog();
      if (window.HCIApi && HCIApi.isLoggedIn()){
        HCIApi.syncProgress().then(function(){
          if (window.HCINotifCenter) HCINotifCenter.refresh(true);
        }).catch(function(){});
      }
      return;
    }

    var go = markCompleteBtn.getAttribute('data-complete-and-go');
    if (go){
      e.preventDefault();
      window.location.href = go;
      return;
    }
    if (markCompleteBtn.tagName === 'BUTTON'){
      markCompleteBtn.textContent = 'أكملت هالمرحلة ✓';
      markCompleteBtn.disabled = true;
      markCompleteBtn.style.opacity = '0.7';
    }
  });
}

// اعتراض أزرار «التالي» لو المرحلة اللي بعدها مقفولة أو المراجعة ناقصة
document.querySelectorAll('a[data-next-stage], .lesson-nav-footer a.btn-primary, .hero-actions a[href$=".html"]').forEach(function(link){
  if (link.id === 'markCompleteBtn') return;
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

    // أساسيات HCI: ممنوع الانتقال للترميز بدون اجتياز الاختبار
    if (pageStage === 'fundamentals' && targetStage === 'coding' && !isFundamentalsQuizPassed()){
      e.preventDefault();
      showLockAlert(
        'لازم تجتاز اختبار الأساسيات (3 من 4 على الأقل) قبل ما تفتح الترميز.',
        'fundamentals.html#quiz',
        'العودة للاختبار'
      );
      return;
    }

    // إكمال المرحلة الحالية عند الضغط على التالي (الأساسيات فقط عبر الاختبار)
    if (pageStage && pageStage !== 'fundamentals' && !isDone(pageStage)){
      markComplete(pageStage);
      if (overallFill) overallFill.style.width = getOverallProgress() + '%';
      if (overallPct) overallPct.textContent = getOverallProgress() + '%';
    }

    // فتح الهدف صراحة قبل الانتقال — إلا الترميز بدون اختبار
    if (targetStage){
      if (targetStage === 'coding' && !isFundamentalsQuizPassed() &&
          !(window.HCIApi && (HCIApi.isAdmin() || HCIApi.isSpecialist()))){
        e.preventDefault();
        showLockAlert(
          'مسار الترميز ينفتح بعد اجتياز اختبار أساسيات HCI.',
          'fundamentals.html#quiz',
          'العودة للاختبار'
        );
        return;
      }
      var jGo = getJourney();
      if (!jGo.unlocked) jGo.unlocked = {};
      jGo.unlocked[targetStage] = true;
      saveJourney(jGo);
    }
  });
});

function updateCodingNextButton(){
  var nextCoding = document.querySelector('a[data-next-stage="coding"]');
  if (!nextCoding) return;
  var ok = isFundamentalsQuizPassed();
  nextCoding.classList.toggle('is-locked-next', !ok);
  nextCoding.setAttribute('aria-disabled', ok ? 'false' : 'true');
  if (ok){
    nextCoding.removeAttribute('title');
  } else {
    nextCoding.title = 'اجتز اختبار الأساسيات أولاً (3 من 4)';
  }
}
updateCodingNextButton();

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
  }, { threshold: 0.08, rootMargin: '0px 0px -12% 0px' });

  revealEls.forEach(function(el){ io.observe(el); });
} else {
  revealEls.forEach(function(el){ el.classList.add('is-visible'); });
}

// ----- شريط تقدم القراءة -----
var readingFill = document.getElementById('readingProgressFill');
if (readingFill){
  var readingTicking = false;
  function updateReadingFill(){
    var doc = document.documentElement;
    var scrollTop = doc.scrollTop || document.body.scrollTop;
    var height = doc.scrollHeight - doc.clientHeight;
    var progress = height > 0 ? (scrollTop / height) * 100 : 0;
    readingFill.style.width = progress + '%';
    readingTicking = false;
  }
  window.addEventListener('scroll', function(){
    if (readingTicking) return;
    readingTicking = true;
    requestAnimationFrame(updateReadingFill);
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

function toAsciiDigits(value){
  return String(value || '')
    .replace(/[\u0660-\u0669]/g, function(ch){ return String(ch.charCodeAt(0) - 0x0660); })
    .replace(/[\u06F0-\u06F9]/g, function(ch){ return String(ch.charCodeAt(0) - 0x06F0); });
}

function onlyAsciiDigits(value){
  return toAsciiDigits(value).replace(/[^0-9]/g, '');
}

function normalizePhoneLocal(value){
  var digits = onlyAsciiDigits(value);
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

function isValidPersonName(value){
  var s = String(value || '').trim().replace(/\s+/g, ' ');
  if (s.length < 2 || s.length > 40) return false;
  return /^[A-Za-z\u0621-\u063A\u0641-\u064A]+(?: [A-Za-z\u0621-\u063A\u0641-\u064A]+)*$/.test(s);
}

function onlyPersonNameChars(value){
  return String(value || '')
    .replace(/[^A-Za-z\u0621-\u063A\u0641-\u064A\s]/g, '')
    .replace(/\s+/g, ' ');
}

function bindLettersOnlyName(input){
  if (!input) return;
  function applyName(){
    var v = onlyPersonNameChars(input.value);
    if (input.value !== v) input.value = v;
  }
  input.setAttribute('maxlength', '40');
  input.addEventListener('input', applyName);
  input.addEventListener('blur', function(){
    input.value = onlyPersonNameChars(input.value).trim();
  });
  input.addEventListener('paste', function(){ setTimeout(applyName, 0); });
}

function isValidPhone(value){
  // جوال سعودي: 05xxxxxxxx بالضبط — أرقام إنجليزية فقط
  return /^05[0-9]{8}$/.test(normalizePhoneLocal(value));
}

/** يجبر الحقل على أرقام إنجليزية 0-9 فقط (مع تحويل العربية/الفارسية تلقائياً) */
function bindAsciiDigitsOnly(input, maxLen){
  if (!input) return;
  if (maxLen) input.setAttribute('maxlength', String(maxLen));
  input.setAttribute('inputmode', 'numeric');
  input.setAttribute('lang', 'en');

  function applyDigits(){
    var digits = onlyAsciiDigits(input.value);
    if (maxLen) digits = digits.slice(0, maxLen);
    if (input.value !== digits) input.value = digits;
  }

  input.addEventListener('keydown', function(e){
    var allow = e.ctrlKey || e.metaKey || e.altKey ||
      e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' ||
      e.key === 'Enter' || e.key === 'Escape' ||
      e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
      e.key === 'Home' || e.key === 'End';
    if (allow) return;
    if (e.key.length !== 1) return;

    var ascii = onlyAsciiDigits(e.key);
    if (!ascii) {
      e.preventDefault();
      return;
    }
    /* رقم عربي/فارسي → أدخله إنجليزي */
    if (ascii !== e.key) {
      e.preventDefault();
      var start = input.selectionStart || 0;
      var end = input.selectionEnd || 0;
      var next = onlyAsciiDigits(input.value.slice(0, start) + ascii + input.value.slice(end));
      if (maxLen) next = next.slice(0, maxLen);
      if (maxLen && input.value.length - (end - start) >= maxLen && end === start) return;
      input.value = next;
      var pos = Math.min(start + ascii.length, next.length);
      try { input.setSelectionRange(pos, pos); } catch (err) { /* */ }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (maxLen) {
      var selected = (input.selectionEnd || 0) - (input.selectionStart || 0);
      if (input.value.length - selected >= maxLen) e.preventDefault();
    }
  });

  input.addEventListener('beforeinput', function(e){
    if (!e.data) return;
    var ascii = onlyAsciiDigits(e.data);
    if (!ascii) {
      e.preventDefault();
      return;
    }
    if (ascii === e.data) return;
    e.preventDefault();
    var start = input.selectionStart || 0;
    var end = input.selectionEnd || 0;
    var next = onlyAsciiDigits(input.value.slice(0, start) + ascii + input.value.slice(end));
    if (maxLen) next = next.slice(0, maxLen);
    input.value = next;
    var pos = Math.min(start + ascii.length, next.length);
    try { input.setSelectionRange(pos, pos); } catch (err) { /* */ }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  input.addEventListener('input', applyDigits);
  input.addEventListener('blur', applyDigits);
  input.addEventListener('paste', function(e){
    e.preventDefault();
    var text = '';
    try { text = (e.clipboardData || window.clipboardData).getData('text') || ''; } catch (err) { text = ''; }
    var digits = onlyAsciiDigits(text);
    if (maxLen) digits = digits.slice(0, maxLen);
    input.value = digits;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** للحقول المختلطة (بريد أو جوال): يحوّل الأرقام العربية → إنجليزي دون حذف النص */
function bindAsciiDigitsInMixedField(input){
  if (!input) return;
  function normalizeMixed(){
    var raw = toAsciiDigits(input.value);
    var hasLettersOrAt = /[a-zA-Z@._%+]/.test(raw);
    var v = hasLettersOrAt ? raw : onlyAsciiDigits(raw);
    if (input.value !== v) input.value = v;
  }
  input.addEventListener('input', normalizeMixed);
  input.addEventListener('blur', normalizeMixed);
  input.addEventListener('paste', function(){ setTimeout(normalizeMixed, 0); });
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
  if (params.get('tab') === 'verify'){ showTab('verify'); }
  try {
    var pendingVerify = sessionStorage.getItem('hci_pending_verify') || '';
    var verifyIdField = document.getElementById('verifyIdentifier');
    if (pendingVerify && verifyIdField && !verifyIdField.value) {
      verifyIdField.value = pendingVerify;
      showTab('verify');
    } else if (params.get('tab') === 'verify' && verifyIdField && !verifyIdField.value) {
      var cu = window.HCIApi && HCIApi.currentUser ? HCIApi.currentUser() : null;
      if (cu) verifyIdField.value = cu.email || cu.phone || '';
    }
  } catch (e) { /* */ }

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
  var rememberMe = document.getElementById('rememberMe');
  var rememberPrompt = document.getElementById('rememberPrompt');
  var rememberPromptText = document.getElementById('rememberPromptText');
  var rememberFillYes = document.getElementById('rememberFillYes');
  var rememberFillNo = document.getElementById('rememberFillNo');
  var rememberForget = document.getElementById('rememberForget');
  var REMEMBER_KEY = 'hci_remember_login';

  function encodeRememberSecret(value){
    try { return btoa(unescape(encodeURIComponent(String(value || '')))); }
    catch (e) { return ''; }
  }
  function decodeRememberSecret(value){
    try { return decodeURIComponent(escape(atob(String(value || '')))); }
    catch (e) { return ''; }
  }
  function readRememberedLogin(){
    try {
      var raw = localStorage.getItem(REMEMBER_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.identifier) return null;
      return data;
    } catch (e) {
      return null;
    }
  }
  function saveRememberedLogin(identifier, password, displayName){
    try {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({
        identifier: String(identifier || '').trim(),
        secret: encodeRememberSecret(password || ''),
        name: String(displayName || '').trim(),
        savedAt: new Date().toISOString()
      }));
    } catch (e) { /* */ }
  }
  function clearRememberedLogin(){
    try { localStorage.removeItem(REMEMBER_KEY); } catch (e) { /* */ }
  }
  function hideRememberPrompt(){
    if (rememberPrompt) rememberPrompt.hidden = true;
  }
  function showRememberPrompt(data){
    if (!rememberPrompt || !data) return;
    var label = data.name || data.identifier || 'حسابك';
    if (rememberPromptText){
      rememberPromptText.textContent =
        'وجدنا حساب «' + label + '» محفوظ على هذا الجهاز. هل تريد ملء البيانات تلقائياً؟';
    }
    rememberPrompt.hidden = false;
  }

  // عرض طلب الموافقة إذا فيه حساب محفوظ على الجهاز
  (function offerRememberedFill(){
    if (!loginIdentifier || !loginPass) return;
    if (window.HCIApi && HCIApi.isLoggedIn && HCIApi.isLoggedIn()) return;
    var remembered = readRememberedLogin();
    if (!remembered) return;
    if (rememberMe) rememberMe.checked = true;
    showRememberPrompt(remembered);
  })();

  if (rememberFillYes){
    rememberFillYes.addEventListener('click', function(){
      var remembered = readRememberedLogin();
      if (!remembered){ hideRememberPrompt(); return; }
      if (loginIdentifier) loginIdentifier.value = remembered.identifier || '';
      if (loginPass) loginPass.value = decodeRememberSecret(remembered.secret);
      if (rememberMe) rememberMe.checked = true;
      hideRememberPrompt();
      if (loginPass && loginPass.value) loginPass.focus();
      else if (loginIdentifier) loginIdentifier.focus();
    });
  }
  if (rememberFillNo){
    rememberFillNo.addEventListener('click', hideRememberPrompt);
  }
  if (rememberForget){
    rememberForget.addEventListener('click', function(){
      clearRememberedLogin();
      if (rememberMe) rememberMe.checked = false;
      hideRememberPrompt();
    });
  }

  // عين إظهار/إخفاء كلمة المرور
  document.querySelectorAll('[data-toggle-password]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var id = btn.getAttribute('data-toggle-password');
      var input = document.getElementById(id);
      if (!input) return;
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      btn.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
      var openIcon = btn.querySelector('.eye-open');
      var closedIcon = btn.querySelector('.eye-closed');
      if (openIcon && closedIcon){
        if (show){
          openIcon.setAttribute('hidden', '');
          closedIcon.removeAttribute('hidden');
        } else {
          closedIcon.setAttribute('hidden', '');
          openIcon.removeAttribute('hidden');
        }
      }
    });
  });

  // Enter من المعرّف/الجوال → ينقل لكلمة المرور (لابتوب وجوال)
  function focusPasswordOnEnter(fromInput, passInput){
    if (!fromInput || !passInput) return;
    fromInput.addEventListener('keydown', function(e){
      if (e.key !== 'Enter') return;
      e.preventDefault();
      passInput.focus();
      try { passInput.select(); } catch (err) { /* */ }
    });
  }
  focusPasswordOnEnter(loginIdentifier, loginPass);

  formLogin.addEventListener('submit', async function(event){
    event.preventDefault();
    var idOk = validateField(loginIdentifier, loginIdentifierError, function(v){
      return v.trim().length > 0 && (v.includes('@') ? isValidEmail(v) : isValidPhone(v));
    });
    var passOk = validateField(loginPass, loginPassError, function(v){ return v.length > 0; });
    if (idOk && !passOk){
      loginPass.focus();
      return;
    }
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
      var identifierValue = loginIdentifier.value.trim();
      var passwordValue = String(loginPass.value || '')
        .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
        .trim();
      var data = await HCIApi.login(identifierValue, passwordValue);
      // حفظ / مسح التذكر حسب اختيار المستخدم
      if (rememberMe && rememberMe.checked){
        var displayName = (data.user && (data.user.fullName || data.user.firstName)) || identifierValue;
        saveRememberedLogin(identifierValue, passwordValue, displayName);
      } else {
        clearRememberedLogin();
      }
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
  var signupPassConfirm = document.getElementById('signupPassConfirm');
  var signupFirstError = document.getElementById('signupFirstError');
  var signupLastError = document.getElementById('signupLastError');
  var signupEmailError = document.getElementById('signupEmailError');
  var signupPhoneError = document.getElementById('signupPhoneError');
  var signupPassError = document.getElementById('signupPassError');
  var signupPassConfirmError = document.getElementById('signupPassConfirmError');
  var signupSubmit = document.getElementById('signupSubmit');

  bindLettersOnlyName(signupFirst);
  bindLettersOnlyName(signupLast);

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
    bindAsciiDigitsOnly(signupPhone, 10);
    signupPhone.addEventListener('input', function(){
      if (signupPhoneError) signupPhoneError.classList.remove('show');
    });
    signupPhone.addEventListener('blur', function(){
      var normalized = normalizePhoneLocal(signupPhone.value).slice(0, 10);
      if (normalized) signupPhone.value = normalized;
      if (signupPhone.value) validateField(signupPhone, signupPhoneError, isValidPhone);
    });
    focusPasswordOnEnter(signupPhone, signupPass);
  }
  if (signupEmail){
    focusPasswordOnEnter(signupEmail, signupPass);
  }
  if (signupPass && signupPassConfirm){
    focusPasswordOnEnter(signupPass, signupPassConfirm);
    signupPassConfirm.addEventListener('input', function(){
      if (signupPassConfirmError) signupPassConfirmError.classList.remove('show');
    });
  }

  bindAsciiDigitsInMixedField(loginIdentifier);
  bindAsciiDigitsInMixedField(document.getElementById('resetIdentifier'));
  bindAsciiDigitsInMixedField(document.getElementById('verifyIdentifier'));
  bindAsciiDigitsOnly(document.getElementById('resetCode'), 6);
  bindAsciiDigitsOnly(document.getElementById('verifyCode'), 6);

  formSignup.addEventListener('submit', async function(event){
    event.preventDefault();
    var firstOk = validateField(signupFirst, signupFirstError, isValidPersonName);
    var lastOk = validateField(signupLast, signupLastError, isValidPersonName);
    var passOk = validateField(signupPass, signupPassError, function(v){ return v.length >= 8; });
    var confirmOk = validateField(signupPassConfirm, signupPassConfirmError, function(v){
      return v.length >= 8 && v === String(signupPass && signupPass.value || '');
    });

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

    if (!firstOk || !lastOk || !contactOk || !passOk || !confirmOk){
      if (firstOk && lastOk && contactOk && !passOk && signupPass){
        signupPass.focus();
      } else if (firstOk && lastOk && contactOk && passOk && !confirmOk && signupPassConfirm){
        signupPassConfirm.focus();
      }
      return;
    }

    if (!window.HCIApi){
      statusMsg.textContent = 'ملف api.js غير محمّل';
      statusMsg.classList.add('show');
      return;
    }

    signupSubmit.disabled = true;
    signupSubmit.textContent = 'جاري الإنشاء…';
    statusMsg.classList.remove('show');
    try {
      var pendingId = contactMode === 'email'
        ? signupEmail.value.trim().toLowerCase()
        : normalizePhoneLocal(signupPhone.value);
      await HCIApi.register({
        firstName: signupFirst.value.trim(),
        lastName: signupLast.value.trim(),
        email: contactMode === 'email' ? pendingId : null,
        phone: contactMode === 'phone' ? pendingId : null,
        password: signupPass.value
      });
      try { sessionStorage.setItem('hci_pending_verify', pendingId); } catch (e) { /* */ }
      var verifyIdentifier = document.getElementById('verifyIdentifier');
      if (verifyIdentifier) verifyIdentifier.value = pendingId;
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
          resetDemoCode.innerHTML = 'اكتب في الخانة فوق هذا الرمز: <strong>' + String(otp.demoCode) + '</strong>';
        }
        resetSendCode.textContent = 'أعد إرسال الرمز';
        if (resetCode) resetCode.focus();
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
          verifyDemoCode.innerHTML = 'اكتب في الخانة فوق هذا الرمز: <strong>' + String(otp.demoCode) + '</strong>';
        }
        statusMsg.textContent = otp.message;
        statusMsg.classList.add('show');
        if (verifyCode) verifyCode.focus();
      } catch (err) {
        statusMsg.textContent = err.message;
        statusMsg.classList.add('show');
      } finally {
        verifySendCode.disabled = false;
        verifySendCode.textContent = 'أعد إرسال الرمز';
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
        if (conf.token && conf.user) {
          HCIApi.setSession(conf.token, conf.user, { siteUnlock: true });
        } else if (conf.user) {
          HCIApi.setSession(HCIApi.getToken(), conf.user, { siteUnlock: true });
        }
        try { sessionStorage.removeItem('hci_pending_verify'); } catch (e) { /* */ }
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

  // ---- تسجيل الدخول / إنشاء حساب عبر Google ----
  (function initGoogleAuth(){
    if (!window.HCIApi || typeof HCIApi.getGoogleAuthConfig !== 'function') return;

    var googleReady = false;
    var googleBusy = false;

    function showGoogleUi(clientId){
      document.querySelectorAll('.google-auth-only').forEach(function(el){
        el.hidden = false;
      });

      function loadGis(cb){
        if (window.google && google.accounts && google.accounts.id) {
          cb();
          return;
        }
        var existing = document.querySelector('script[data-hci-gis]');
        if (existing) {
          existing.addEventListener('load', cb);
          return;
        }
        var s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.defer = true;
        s.setAttribute('data-hci-gis', '1');
        s.onload = cb;
        s.onerror = function(){
          if (statusMsg){
            statusMsg.textContent = 'تعذر تحميل خدمة جوجل — أعد تحميل الصفحة';
            statusMsg.classList.add('show');
          }
        };
        document.head.appendChild(s);
      }

      function onCredential(response){
        if (!response || !response.credential || googleBusy) return;
        googleBusy = true;
        if (statusMsg){
          statusMsg.textContent = 'جاري الدخول بحساب جوجل…';
          statusMsg.classList.add('show');
        }
        HCIApi.loginWithGoogle(response.credential).then(function(data){
          try { return HCIApi.syncProgress().then(function(){ return data; }); }
          catch (e) { return data; }
        }).then(function(data){
          if (data.user && data.user.pathType === 'specialist') HCIApi.applySpecialistUnlocks();
          return HCIApi.afterAuthFlow(data.user, !!data.isNew).then(function(dest){
            window.location.href = dest;
          });
        }).catch(function(err){
          if (statusMsg){
            statusMsg.textContent = (err && err.message) || 'تعذر الدخول بجوجل';
            statusMsg.classList.add('show');
          }
        }).finally(function(){
          googleBusy = false;
        });
      }

      loadGis(function(){
        if (googleReady) return;
        try {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: onCredential,
            auto_select: false,
            cancel_on_tap_outside: true,
            context: 'signin',
            ux_mode: 'popup'
          });
          var opts = {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 320
          };
          var loginWrap = document.getElementById('googleLoginBtnWrap');
          var signupWrap = document.getElementById('googleSignupBtnWrap');
          if (loginWrap) google.accounts.id.renderButton(loginWrap, opts);
          if (signupWrap) google.accounts.id.renderButton(signupWrap, opts);
          googleReady = true;
        } catch (e) {
          if (statusMsg){
            statusMsg.textContent = 'تعذر تهيئة زر جوجل';
            statusMsg.classList.add('show');
          }
        }
      });
    }

    HCIApi.getGoogleAuthConfig().then(function(cfg){
      if (cfg && cfg.enabled && cfg.clientId) showGoogleUi(cfg.clientId);
    }).catch(function(){ /* الميزة اختيارية */ });
  })();
}

// مزامنة التقدم من السيرفر عند وجود جلسة + توجيه المسار الناقص
if (window.HCIApi && HCIApi.isLoggedIn()){
  HCIApi.request('/api/auth/me').then(function(me){
    if (me && me.user){
      HCIApi.setSession(HCIApi.getToken(), me.user);
      if (typeof window.HCIEnsureAdminNav === 'function') window.HCIEnsureAdminNav();
    }
  }).catch(function(){});

  HCIApi.syncProgress().then(function(){
    // بعد المزامنة: أعد تقييم القفل (قد يكون الترميز مفتوحاً على السيرفر)
    if (typeof refreshPageLockGate === 'function') refreshPageLockGate();

    var overallFillEl = document.getElementById('overallProgressFill');
    var overallPctEl = document.getElementById('overallProgressPct');
    var journeyStripEl = document.getElementById('journeyStrip');
    if (journeyStripEl) journeyStripEl.removeAttribute('hidden');
    if (overallFillEl || overallPctEl){
      var pctNow = getOverallProgress();
      if (overallFillEl) overallFillEl.style.width = pctNow + '%';
      if (overallPctEl) overallPctEl.textContent = pctNow + '%';
    }

    // صفحات عامة: لو ما اختار مساره أو ما شاف التعريف، نوجّهه
    var page = (location.pathname.split('/').pop() || '').toLowerCase();
    var skipRedirect = ['auth.html', 'path-choice.html', 'intro.html', 'admin.html', 'settings.html', 'legal.html'].indexOf(page) !== -1;
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
  if (!window.HCIApi || !HCIApi.isLoggedIn()) return;

  var LOCAL_KEY = 'hci_local_notifs';
  var SEEN_KEY = 'hci_seen_notif_ids';

  function readLocal(){
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch (e) { return []; }
  }
  function writeLocal(list){
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 40))); } catch (e) { /* */ }
  }

  function pushLocal(title, body, link, quiet){
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
    if (!quiet) showToast(title, body, link);
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
    var toast = document.createElement('div');
    toast.id = 'adminMsgToast';
    toast.className = 'nav-notif-toast';
    toast.setAttribute('role', 'status');
    var shortBody = body ? String(body) : '';
    if (shortBody.length > 80) shortBody = shortBody.slice(0, 77) + '…';
    toast.innerHTML =
      '<div class="nav-notif-toast-top">' +
        '<span class="nav-notif-toast-label">تنبيه جديد</span>' +
        '<button type="button" class="toast-close" aria-label="إغلاق">×</button>' +
      '</div>' +
      '<p class="nav-notif-toast-title">' + escapeHtml(title) + '</p>' +
      (shortBody ? '<p class="nav-notif-toast-body">' + escapeHtml(shortBody) + '</p>' : '') +
      (link ? '<a class="nav-notif-toast-link" href="' + escapeHtml(link) + '">عرض</a>' : '');
    /* ثابت على الـ body عشان ما ينقصّ داخل الهيدر */
    document.body.appendChild(toast);
    toast.querySelector('.toast-close').addEventListener('click', function(e){
      e.stopPropagation();
      toast.remove();
    });
    toast.addEventListener('click', function(e){
      if (e.target.closest('.toast-close')) return;
      if (e.target.closest('a')) return;
      if (link) location.href = link;
    });
    setTimeout(function(){ if (toast.parentNode) toast.remove(); }, 5200);
  }

  function ensureUi(){
    var existingBtn = document.getElementById('navNotifBtn');
    var existingLayer = document.getElementById('navNotifLayer');
    if (existingBtn && existingLayer) return true;
    /* لو الجرس موجود واللوحة ضاعت — نبني اللوحة من جديد */
    if (existingBtn && !existingLayer) {
      var oldWrap = existingBtn.closest('.nav-notif-wrap');
      if (oldWrap) oldWrap.remove();
      else existingBtn.remove();
    }

    var slot = document.getElementById('navCtaSlot');
    var userWrap = document.querySelector('.nav-user-wrap');
    if (!slot && !userWrap) return false;

    var wrap = document.createElement('span');
    wrap.className = 'nav-notif-wrap';
    wrap.innerHTML =
      '<button type="button" class="nav-notif-btn" id="navNotifBtn" aria-haspopup="true" aria-expanded="false" aria-label="التنبيهات">' +
        '<svg class="nav-notif-svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
          '<path fill="currentColor" d="M12 22a2.2 2.2 0 0 0 2.2-2.2h-4.4A2.2 2.2 0 0 0 12 22zm7-6.2V11a7 7 0 1 0-14 0v4.8L3 17.8V19h18v-1.2l-2-1.8z"/>' +
        '</svg>' +
        '<span class="nav-notif-count" id="navNotifCount" hidden></span>' +
      '</button>';

    /* اللوحة على الـ body عشان تظهر كاملة وما تنقصّ بالهيدر */
    var oldLayer = document.getElementById('navNotifLayer');
    if (oldLayer) oldLayer.remove();
    var layer = document.createElement('div');
    layer.className = 'nav-notif-layer';
    layer.id = 'navNotifLayer';
    layer.hidden = true;
    layer.innerHTML =
      '<div class="nav-notif-backdrop" id="navNotifBackdrop"></div>' +
      '<div class="nav-notif-panel" id="navNotifPanel" role="dialog" aria-label="التنبيهات">' +
        '<div class="nav-notif-head">' +
          '<strong>التنبيهات</strong>' +
          '<button type="button" class="nav-notif-markall" id="navNotifMarkAll">علم الكل مقروء</button>' +
        '</div>' +
        '<div class="nav-notif-list" id="navNotifList"><p class="progress-note">لا توجد تنبيهات</p></div>' +
        '<a class="nav-notif-footer" href="profile.html#inbox">عرض كل التنبيهات</a>' +
      '</div>';
    document.body.appendChild(layer);

    /* دائماً بجانب الحساب داخل شريط الإجراءات — سطر واحد */
    if (slot){
      if (userWrap && userWrap.parentNode === slot){
        slot.insertBefore(wrap, userWrap);
      } else if (userWrap && userWrap.parentNode){
        userWrap.parentNode.insertBefore(wrap, userWrap);
      } else {
        slot.appendChild(wrap);
      }
    } else if (userWrap && userWrap.parentNode){
      userWrap.parentNode.insertBefore(wrap, userWrap);
    } else {
      return false;
    }

    var btn = document.getElementById('navNotifBtn');
    var panel = document.getElementById('navNotifPanel');
    var backdrop = document.getElementById('navNotifBackdrop');

    function isMobileNotif(){
      return window.matchMedia('(max-width: 860px)').matches;
    }

    function placeDesktopPanel(){
      if (!panel || !btn || isMobileNotif()){
        if (panel){
          panel.style.top = '';
          panel.style.left = '';
          panel.style.right = '';
          panel.style.bottom = '';
        }
        return;
      }
      var rect = btn.getBoundingClientRect();
      var width = Math.min(320, window.innerWidth - 24);
      var left = rect.left + rect.width / 2 - width / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
      panel.style.top = Math.round(rect.bottom + 10) + 'px';
      panel.style.left = Math.round(left) + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.width = width + 'px';
    }

    function closePanel(){
      layer.hidden = true;
      layer.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('notif-open');
    }
    function openPanel(){
      placeDesktopPanel();
      layer.hidden = false;
      layer.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      if (isMobileNotif()) document.body.classList.add('notif-open');
      else document.body.classList.remove('notif-open');
      refresh(true);
    }

    btn.addEventListener('click', function(e){
      e.stopPropagation();
      if (layer.hidden) openPanel();
      else closePanel();
    });
    if (backdrop){
      backdrop.addEventListener('click', function(){ closePanel(); });
    }
    window.addEventListener('resize', function(){
      if (!layer.hidden) placeDesktopPanel();
    });
    document.addEventListener('keydown', function(ev){
      if (ev.key === 'Escape' && !layer.hidden) closePanel();
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
        closePanel();
        location.href = link;
        return;
      }
      var p = ntype === 'message'
        ? HCIApi.markMessageRead(nid)
        : HCIApi.markNotificationRead(nid);
      p.catch(function(){}).then(function(){
        refresh(true);
        closePanel();
        location.href = link;
      });
    });
    return true;
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
        var markAll = document.getElementById('navNotifMarkAll');
        if (markAll) markAll.hidden = unread.length === 0;
        if (list){
          if (!merged.length){
            list.innerHTML = '<p class="progress-note">لا توجد تنبيهات بعد</p>';
          } else {
            list.innerHTML = merged.slice(0, 40).map(function(n){
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

  function bootNotifUi(){
    if (ensureUi()){
      refresh(false);
      return;
    }
    var tries = 0;
    var t = setInterval(function(){
      tries++;
      if (ensureUi() || tries > 20){
        clearInterval(t);
        refresh(false);
      }
    }, 150);
  }
  bootNotifUi();
  /* نتحقق كل 45 ثانية، وفقط لو التبويب ظاهر — يخفف الحمل على السيرفر مع كثرة المستخدمين المتزامنين */
  setInterval(function(){
    if (!document.hidden) refresh(false);
  }, 45000);
  document.addEventListener('visibilitychange', function(){
    if (!document.hidden) refresh(false);
  });

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

/* ----- مشاركة الموقع وإحصائيات الإحالات ----- */
(function initSharePanel() {
  var panel = document.getElementById('sharePanel');
  if (!panel) return;

  var input = document.getElementById('shareLinkInput');
  var copyBtn = document.getElementById('shareCopyBtn');
  var nativeBtn = document.getElementById('shareNativeBtn');
  var hint = document.getElementById('shareHint');
  var statsEl = document.getElementById('shareStats');

  function setLoggedOut() {
    if (hint) {
      hint.hidden = false;
      hint.innerHTML = '<a href="auth.html?tab=signup">أنشئ حساباً</a> أو سجّل دخولك لتظهر رابطك وكم دخلوا عبره.';
    }
    if (statsEl) statsEl.hidden = true;
    if (input) input.value = location.origin + '/index.html';
    if (copyBtn) copyBtn.disabled = true;
    if (nativeBtn) nativeBtn.disabled = true;
  }

  async function loadShare() {
    if (!(window.HCIApi && HCIApi.isLoggedIn && HCIApi.isLoggedIn())) {
      setLoggedOut();
      return;
    }
    if (copyBtn) copyBtn.disabled = false;
    if (nativeBtn) nativeBtn.disabled = false;
    var url = HCIApi.buildShareUrl();
    if (input) input.value = url;
    if (hint) hint.hidden = true;

    try {
      var data = await HCIApi.fetchShareStats();
      if (data && data.sharePath) {
        url = location.origin + data.sharePath;
        if (input) input.value = url;
      }
      var s = (data && data.stats) || {};
      if (statsEl) {
        statsEl.hidden = false;
        var entered = document.getElementById('shareEntered');
        if (entered) entered.textContent = String(s.uniqueVisitors != null ? s.uniqueVisitors : (s.visits || 0));
      }
    } catch (e) {
      if (hint) {
        hint.hidden = false;
        hint.textContent = 'تعذر تحميل الإحصائيات — تأكد أن السيرفر يعمل.';
      }
    }
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async function () {
      var text = (input && input.value) || '';
      if (!text) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          input.select();
          document.execCommand('copy');
        }
        copyBtn.textContent = 'تم النسخ';
        setTimeout(function () { copyBtn.textContent = 'نسخ'; }, 1600);
      } catch (e) {
        alert('انسخ الرابط يدوياً من الخانة');
      }
    });
  }

  if (nativeBtn) {
    nativeBtn.addEventListener('click', async function () {
      var text = (input && input.value) || '';
      if (!text) return;
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'منصة HCI',
            text: 'تعرّف على مسار تعلم تفاعل الإنسان والحاسوب',
            url: text
          });
        } catch (e) { /* ألغى المستخدم */ }
      } else if (copyBtn) {
        copyBtn.click();
      }
    });
  }

  loadShare();

  /* تنقل الهاش #share */
  if (location.hash === '#share') {
    var sec = document.getElementById('sec-share');
    var btn = document.querySelector('.settings-side-link[data-target="sec-share"]');
    if (btn) btn.click();
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
})();

// ----- مسار الترميز -----
var lessonList = document.getElementById('lessonList');
var codingProgressFill = document.getElementById('codingProgressFill');
var codingProgressNote = document.getElementById('codingProgressNote');

if (lessonList && codingProgressFill && codingProgressNote){
  var lessonCards = lessonList.querySelectorAll('.lesson-card');
  var storageKey = 'hci_coding_progress';
  var LOCK_MSG = 'افتح «اشرحلي المفهوم» في الدرس السابق أولاً. بعد القراءة ينفك هذا الدرس.';

  function getProgress(){
    try {
      var raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveProgress(progress){
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch (e) { /* */ }
    if (window.HCIApi) HCIApi.scheduleSync();
  }

  function lessonState(progress, id){
    var v = progress[id];
    if (v === true) return { read: true, done: true };
    if (v && typeof v === 'object') return { read: !!v.read || !!v.done, done: !!v.done };
    return { read: false, done: false };
  }

  function setLessonState(progress, id, patch){
    var cur = lessonState(progress, id);
    progress[id] = {
      read: patch.read != null ? patch.read : cur.read,
      done: patch.done != null ? patch.done : cur.done
    };
    if (progress[id].done) progress[id].read = true;
  }

  function isLessonUnlocked(progress, index){
    if (index === 0) return true;
    var prevId = lessonCards[index - 1].getAttribute('data-lesson');
    return lessonState(progress, prevId).read;
  }

  function renderLessons(){
    var progress = getProgress();
    var doneCount = 0;
    var readCount = 0;
    var currentAssigned = false;
    var htmlCards = lessonList.querySelectorAll('[data-coding-stage="html"] .lesson-card');
    var htmlAllRead = true;
    htmlCards.forEach(function(card){
      if (!lessonState(progress, card.getAttribute('data-lesson')).read) htmlAllRead = false;
    });
    var cssLock = document.getElementById('cssStageLock');
    if (cssLock) cssLock.hidden = htmlAllRead;

    lessonCards.forEach(function(card, index){
      var id = card.getAttribute('data-lesson');
      var doneBtn = card.querySelector('.lesson-done-btn');
      var explainer = card.querySelector('.lesson-explainer');
      var st = lessonState(progress, id);
      var unlocked = isLessonUnlocked(progress, index);
      var lockedLesson = !unlocked;

      card.classList.toggle('is-locked-lesson', lockedLesson);
      card.title = lockedLesson ? LOCK_MSG : '';

      card.classList.toggle('is-done', st.done);
      doneBtn.classList.toggle('done', st.done);
      if (lockedLesson) doneBtn.textContent = 'كيف أفتحه؟';
      else if (st.done) doneBtn.textContent = 'تم ✓';
      else if (!st.read) doneBtn.textContent = 'افتح الشرح أولاً';
      else doneBtn.textContent = 'أكملت هذا الدرس';
      doneBtn.disabled = false;
      doneBtn.setAttribute('data-locked', lockedLesson ? '1' : '0');

      if (st.read) readCount++;
      if (st.done) doneCount++;

      if (!lockedLesson && !st.done && !currentAssigned){
        card.classList.add('is-current');
        currentAssigned = true;
      } else {
        card.classList.remove('is-current');
      }
    });

    var tracked = readCount > doneCount ? readCount : doneCount;
    var percent = Math.round((tracked / lessonCards.length) * 100);
    codingProgressFill.style.width = percent + '%';

    if (tracked === 0){
      codingProgressNote.textContent = 'ابدأ من درس HTML الأول: افتح «اشرحلي المفهوم»';
    } else if (tracked === lessonCards.length){
      codingProgressNote.textContent = 'أكملت مرحلتي HTML و CSS — فتحت مسار الدورات';
      markComplete('coding');
    } else {
      codingProgressNote.textContent = 'قرأت ' + tracked + ' من ' + lessonCards.length + ' دروس';
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

  lessonCards.forEach(function(card, index){
    var id = card.getAttribute('data-lesson');
    var doneBtn = card.querySelector('.lesson-done-btn');
    var explainer = card.querySelector('.lesson-explainer');

    if (explainer){
      explainer.addEventListener('toggle', function(){
        if (!explainer.open) return;
        if (!isLessonUnlocked(getProgress(), index)){
          explainer.open = false;
          showLockAlert(LOCK_MSG, null, null);
          return;
        }
        var progress = getProgress();
        setLessonState(progress, id, { read: true, done: true });
        saveProgress(progress);
        renderLessons();
      });
    }

    doneBtn.addEventListener('click', function(){
      var progress = getProgress();
      if (!isLessonUnlocked(progress, index)){
        showLockAlert(LOCK_MSG, null, null);
        var current = document.querySelector('.lesson-card.is-current');
        if (current) current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      var st = lessonState(progress, id);
      if (!st.read){
        if (explainer){
          explainer.open = true;
        } else {
          showLockAlert('افتح «اشرحلي المفهوم» في هذا الدرس أولاً.', null, null);
        }
        return;
      }
      setLessonState(progress, id, { done: !st.done, read: true });
      saveProgress(progress);
      renderLessons();
    });
  });

  renderLessons();
}

// ----- محرر «جرّب بنفسك» -----
document.querySelectorAll('.try-lab').forEach(function(lab){
  var codeBox = lab.querySelector('.try-code');
  var frame = lab.querySelector('.try-frame');
  var resetBtn = lab.querySelector('.try-reset');
  if (!codeBox || !frame) return;
  var originalCode = codeBox.value;
  var renderTimer = null;

  function renderTry(){
    var src = codeBox.value;
    if (!/<html|<body/i.test(src)){
      src = '<html dir="rtl"><head><meta charset="UTF-8"><style>body{font-family:sans-serif;margin:12px;color:#111;font-size:14px}</style></head><body>' + src + '</body></html>';
    }
    frame.srcdoc = src;
  }

  codeBox.addEventListener('input', function(){
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderTry, 250);
  });

  if (resetBtn){
    resetBtn.addEventListener('click', function(){
      codeBox.value = originalCode;
      renderTry();
    });
  }

  renderTry();
});

var projectDoneBtn = document.getElementById('projectDoneBtn');
if (projectDoneBtn){
  projectDoneBtn.addEventListener('click', function(){
    projectDoneBtn.textContent = 'أنجزتها ✓';
    showUnlockToast('مبروك! بنيت أول صفحة ويب بنفسك 🎉');
  });
}

// ----- الإعدادات -----
var settingsFirstName = document.getElementById('settingsFirstName');
var settingsLastName = document.getElementById('settingsLastName');
var settingsSaveAll = document.getElementById('settingsSaveAll');
var settingsSaveNote = document.getElementById('settingsSaveNote');
var settingsSizeRow = document.getElementById('settingsSizeRow');
var settingsSwatchRow = document.getElementById('settingsSwatchRow');
var settingsThemeRow = document.getElementById('settingsThemeRow');

bindLettersOnlyName(settingsFirstName);
bindLettersOnlyName(settingsLastName);

var settingsBack = document.querySelector('.settings-page .page-back');
if (settingsBack && window.HCIApi && HCIApi.currentUser){
  var backUser = HCIApi.currentUser();
  if (backUser && backUser.pathType === 'curious' && !backUser.introSeen){
    settingsBack.setAttribute('href', 'intro.html');
    settingsBack.textContent = 'رجوع للتعريف';
  }
}

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

(function initSettingsAvatar(){
  var preview = document.getElementById('settingsAvatarPreview');
  var upload = document.getElementById('settingsAvatarUpload');
  var removeBtn = document.getElementById('settingsAvatarRemove');
  if (!preview || !upload) return;

  function currentName(){
    var first = settingsFirstName ? settingsFirstName.value.trim() : '';
    var last = settingsLastName ? settingsLastName.value.trim() : '';
    var full = (first + ' ' + last).trim();
    return full || localStorage.getItem('hci_user_name') || '؟';
  }

  function refreshPreview(){
    applyAvatarToEl(preview, currentName());
    applyAvatarToEl(document.getElementById('navAvatarChip'), currentName());
    if (removeBtn) removeBtn.hidden = !getUserAvatar();
  }

  refreshPreview();

  if (settingsFirstName) settingsFirstName.addEventListener('input', refreshPreview);
  if (settingsLastName) settingsLastName.addEventListener('input', refreshPreview);

  upload.addEventListener('change', function(){
    var file = upload.files && upload.files[0];
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
      refreshPreview();
    });
  });

  if (removeBtn){
    removeBtn.addEventListener('click', function(){
      setUserAvatar('');
      upload.value = '';
      refreshPreview();
    });
  }
})();

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
  var customSwatch = document.getElementById('settingsAccentCustomBtn');
  var accentPalette = document.getElementById('settingsAccentPalette');
  var storedAccent = localStorage.getItem('hci_accent_color') || DEFAULT_ACCENT_COLOR;
  var activeThemeId = getAccentThemeId(storedAccent);

  function syncAccentSwatches(){
    var stored = localStorage.getItem('hci_accent_color') || DEFAULT_ACCENT_COLOR;
    var id = getAccentThemeId(stored);
    swatchButtons.forEach(function(btn){
      btn.classList.toggle('active', getAccentThemeId(btn.getAttribute('data-color')) === id);
    });
    if (customSwatch){
      customSwatch.classList.toggle('active', id === 'custom');
      if (id === 'custom') customSwatch.style.setProperty('--swatch-picked', stored);
      else customSwatch.style.removeProperty('--swatch-picked');
    }
    syncAccentPaletteSelection(accentPalette, stored);
  }

  swatchButtons.forEach(function(btn){
    btn.classList.toggle('active', getAccentThemeId(btn.getAttribute('data-color')) === activeThemeId);
    btn.addEventListener('click', function(){
      closeAllAccentPalettes();
      var color = btn.getAttribute('data-color');
      localStorage.setItem('hci_accent_color', color);
      applyAccentColor(color);
      syncAccentSwatches();
    });
  });

  initAccentColorPicker({
    button: customSwatch,
    panel: accentPalette,
    onPick: function(color){
      localStorage.setItem('hci_accent_color', color);
      applyAccentColor(color);
      syncAccentSwatches();
    }
  });
  syncAccentSwatches();
}

if (settingsSaveAll){
  settingsSaveAll.addEventListener('click', async function(){
    var first = settingsFirstName ? settingsFirstName.value.trim() : '';
    var last = settingsLastName ? settingsLastName.value.trim() : '';
    if (first.length < 2 || last.length < 2){
      if (settingsSaveNote) settingsSaveNote.textContent = 'أدخل الاسم الأول واسم العائلة (حرفان على الأقل لكل منهما).';
      return;
    }
    if (!isValidPersonName(first) || !isValidPersonName(last)){
      if (settingsSaveNote) settingsSaveNote.textContent = 'الاسم حروف عربية أو إنجليزية فقط — بدون أرقام أو رموز.';
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
      var activeCustom = settingsSwatchRow.querySelector('.swatch-custom.active');
      if (activeCustom){
        var customColor = localStorage.getItem('hci_accent_color') || '#3498DB';
        localStorage.setItem('hci_accent_color', customColor);
        applyAccentColor(customColor);
      } else if (activeSwatch){
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
        localStorage.setItem('hci_user_name', first + ' ' + last);
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
      // حتى لو فشل السيرفر: ثبّت الاسم والتفضيلات محلياً عشان ما يضيع التعديل
      try { localStorage.setItem('hci_user_name', first + ' ' + last); } catch (e) { /* */ }
      var chipFail = document.querySelector('.nav-user-name');
      if (chipFail) chipFail.textContent = first + ' ' + last;
      if (settingsSaveNote){
        settingsSaveNote.textContent = (err && err.message)
          ? ('حُفظت التفضيلات محلياً — ' + err.message)
          : 'حُفظت التفضيلات محلياً. تعذر مزامنة الحساب.';
      }
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
    var questions = document.querySelectorAll('.quiz-q');
    var correctCount = 0;
    var answeredAll = true;

    questions.forEach(function(q){
      var correctValue = q.getAttribute('data-correct');
      var selected = q.querySelector('input[type="radio"]:checked');
      var feedback = q.querySelector('.quiz-feedback');
      var labels = q.querySelectorAll('.quiz-options label');

      labels.forEach(function(label){ label.classList.remove('selected'); });
      q.classList.remove('correct', 'wrong');

      if (!selected){
        answeredAll = false;
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

    if (!answeredAll){
      quizResult.textContent = 'جاوب على كل الأسئلة ثم اضغط تحقق مرة ثانية.';
      quizResult.classList.add('show');
      return;
    }

    quizResult.textContent = 'نتيجتك: ' + correctCount + ' من ' + questions.length + ' صحيحة';
    quizResult.classList.add('show');

    // حفظ نتيجة الاختبار أولاً (قبل markComplete)
    try {
      var answers = [];
      questions.forEach(function(q, idx){
        var correctValue = q.getAttribute('data-correct');
        var selected = q.querySelector('input[type="radio"]:checked');
        var titleEl = q.querySelector('p:not(.quiz-feedback)');
        var title = titleEl ? titleEl.textContent.trim().slice(0, 100) : ('سؤال ' + (idx + 1));
        var qid = 'fundamentals-q' + (idx + 1);
        var chosen = selected ? selected.value : '';
        answers.push({
          qid: qid,
          title: title,
          chosen: chosen,
          correct: correctValue,
          ok: !!(selected && selected.value === correctValue)
        });
      });
      var quizStore = {};
      try { quizStore = JSON.parse(localStorage.getItem('hci_quiz') || '{}'); } catch (err) { quizStore = {}; }
      quizStore.fundamentals = {
        score: correctCount,
        total: questions.length,
        passed: correctCount >= 3,
        answers: answers,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('hci_quiz', JSON.stringify(quizStore));
      if (window.HCIApi && HCIApi.isLoggedIn()) HCIApi.scheduleSync();
    } catch (err) { /* */ }

    // فتح الترميز عند 3/4 أو أكثر فقط
    if (correctCount >= 3){
      markComplete('fundamentals');
      var jUnlock = getJourney();
      if (!jUnlock.unlocked) jUnlock.unlocked = {};
      if (!jUnlock.done) jUnlock.done = {};
      jUnlock.unlocked.coding = true;
      jUnlock.done.fundamentals = true;
      saveJourney(jUnlock);
      quizResult.textContent += ' — ممتاز! فُتح مسار الترميز. تقدر تضغط «التالي» الآن.';
      updateCodingNextButton();
      if (window.HCIApi && HCIApi.isLoggedIn()){
        HCIApi.syncProgress().catch(function(){});
      }
      showUnlockToast('فتحت مرحلة جديدة: ترميز HTML & CSS ✨');
    } else {
      quizResult.textContent += ' — تحتاج 3 إجابات صحيحة على الأقل لفتح الترميز.';
      updateCodingNextButton();
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

// ----- بلّغ عن مشكلة — رابط بالتذييل + نموذج منبثق -----
(function injectReportSection(){
  if (document.getElementById('reportSection')) return;

  var pageName = (location.pathname.split('/').pop() || '').toLowerCase();
  var skipPages = ['admin.html', 'auth.html', 'path-choice.html', 'certificate.html', 'maintenance.html'];
  if (skipPages.indexOf(pageName) !== -1) return;
  if (document.body.classList.contains('auth-page')) return;
  if (document.body.classList.contains('path-choice-page')) return;
  if (document.body.classList.contains('cert-page')) return;

  var trigger = document.getElementById('reportTrigger');
  if (!trigger){
    trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = 'reportTrigger';
    trigger.className = 'footer-text-link footer-link-report';
    trigger.textContent = 'بلّغ عن مشكلة';
    var legalList = document.querySelector('.footer-legal ul');
    var supportList = document.querySelector('.footer-support ul');
    var targetList = legalList || supportList;
    if (targetList){
      var li = document.createElement('li');
      li.appendChild(trigger);
      targetList.appendChild(li);
    }
  } else {
    trigger.className = 'footer-text-link footer-link-report';
  }
  window.__hciReportTrigger = trigger;

  var backdrop = document.createElement('div');
  backdrop.id = 'reportSection';
  backdrop.className = 'site-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'reportModalTitle');
  backdrop.hidden = true;
  backdrop.innerHTML =
    '<div class="site-modal report-modal">' +
      '<div class="site-modal-head">' +
        '<h3 id="reportModalTitle">بلّغ عن مشكلة</h3>' +
        '<button type="button" class="site-modal-close" id="reportModalClose" aria-label="إغلاق">×</button>' +
      '</div>' +
      '<p class="site-modal-lead">شفت خطأ أو شي مو واضح في الصفحة؟ اكتبها هنا.</p>' +
      '<form class="report-form" id="reportForm">' +
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
    '</div>';

  document.body.appendChild(backdrop);

  function openReport(){
    backdrop.hidden = false;
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeReport(){
    backdrop.classList.remove('open');
    backdrop.hidden = true;
    document.body.style.overflow = '';
  }
  trigger.addEventListener('click', openReport);
  document.querySelectorAll('[data-report-open]').forEach(function(el){
    if (el === trigger) return;
    el.addEventListener('click', openReport);
  });
  document.getElementById('reportModalClose').addEventListener('click', closeReport);
  backdrop.addEventListener('click', function(e){
    if (e.target === backdrop) closeReport();
  });

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
    var u = HCIApi.currentUser ? HCIApi.currentUser() : (HCIApi.getUser && HCIApi.getUser());
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
      }
      setTimeout(function(){
        closeReport();
        submitBtn.disabled = false;
        submitBtn.textContent = 'إرسال البلاغ';
        status.classList.remove('show');
      }, 1200);
    } catch (err) {
      status.textContent = err.message;
      status.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = 'إرسال البلاغ';
    }
  });
})();

// ----- تذييل: روابط تواصل + بلاغ (نمط المواقع الرسمية) -----
(function injectFooterContact(){
  var pageName = (location.pathname.split('/').pop() || '').toLowerCase();
  if (['admin.html', 'auth.html', 'certificate.html', 'maintenance.html'].indexOf(pageName) !== -1) return;
  if (document.body.classList.contains('auth-page')) return;

  if (document.getElementById('contactModal')) return;
  if (!document.querySelector('footer .footer-inner')) return;

  var btn = document.getElementById('footerContactBtn');
  if (!btn){
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'footerContactBtn';
    btn.className = 'footer-text-link footer-link-contact';
    btn.textContent = 'تواصل معنا';
    var supportList = document.querySelector('.footer-support ul');
    if (supportList){
      var li = document.createElement('li');
      li.appendChild(btn);
      supportList.insertBefore(li, supportList.firstChild);
    } else {
      return;
    }
  } else {
    btn.className = 'footer-text-link footer-link-contact';
  }

  var reportBtn = document.getElementById('reportTrigger') || window.__hciReportTrigger;
  if (reportBtn) reportBtn.className = 'footer-text-link footer-link-report';

  var backdrop = document.createElement('div');
  backdrop.id = 'contactModal';
  backdrop.className = 'site-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'contactModalTitle');
  backdrop.hidden = true;
  backdrop.innerHTML =
    '<div class="site-modal">' +
      '<div class="site-modal-head">' +
        '<h3 id="contactModalTitle">تواصل معنا</h3>' +
        '<button type="button" class="site-modal-close" id="contactModalClose" aria-label="إغلاق">×</button>' +
      '</div>' +
      '<form id="contactForm">' +
        '<label class="site-modal-label" for="contactName">الاسم</label>' +
        '<input type="text" id="contactName" class="settings-input" placeholder="اسمك" autocomplete="name">' +
        '<label class="site-modal-label" for="contactReach">وسيلة تواصل</label>' +
        '<input type="text" id="contactReach" class="settings-input" dir="ltr" placeholder="بريد أو جوال">' +
        '<label class="site-modal-label" for="contactMessage">الرسالة</label>' +
        '<textarea id="contactMessage" class="report-textarea" required placeholder="اكتب رسالتك…" rows="4"></textarea>' +
        '<div class="report-submit-row">' +
          '<button type="submit" class="btn-primary" id="contactSubmit">إرسال</button>' +
          '<p class="status-msg" id="contactStatus"></p>' +
        '</div>' +
      '</form>' +
    '</div>';
  document.body.appendChild(backdrop);

  function openContact(){
    backdrop.hidden = false;
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeContact(){
    backdrop.classList.remove('open');
    backdrop.hidden = true;
    document.body.style.overflow = '';
  }
  btn.addEventListener('click', openContact);
  document.querySelectorAll('[data-contact-open]').forEach(function(el){
    if (el === btn) return;
    el.addEventListener('click', openContact);
  });
  document.getElementById('contactModalClose').addEventListener('click', closeContact);
  backdrop.addEventListener('click', function(e){
    if (e.target === backdrop) closeContact();
  });

  if (window.HCIApi && HCIApi.isLoggedIn()){
    var u = HCIApi.currentUser ? HCIApi.currentUser() : (HCIApi.getUser && HCIApi.getUser());
    if (u){
      var n = document.getElementById('contactName');
      var r = document.getElementById('contactReach');
      if (n) n.value = u.fullName || '';
      if (r) r.value = u.email || u.phone || '';
    }
  }

  document.getElementById('contactForm').addEventListener('submit', async function(e){
    e.preventDefault();
    var statusEl = document.getElementById('contactStatus');
    var submitBtn = document.getElementById('contactSubmit');
    var message = document.getElementById('contactMessage').value.trim();
    if (message.length < 5){
      statusEl.textContent = 'اكتب الرسالة بوضوح';
      statusEl.classList.add('show');
      return;
    }
    if (!window.HCIApi){
      statusEl.textContent = 'السيرفر غير متصل';
      statusEl.classList.add('show');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري الإرسال…';
    statusEl.classList.remove('show');
    try {
      await HCIApi.request('/api/contact', {
        method: 'POST',
        body: {
          name: document.getElementById('contactName').value.trim(),
          contact: document.getElementById('contactReach').value.trim(),
          message: message
        }
      });
      statusEl.textContent = 'وصلت رسالتك ✓';
      statusEl.classList.add('show');
      document.getElementById('contactMessage').value = '';
      setTimeout(function(){
        closeContact();
      }, 900);
    } catch (err){
      statusEl.textContent = (err && err.message) || 'تعذّر الإرسال';
      statusEl.classList.add('show');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'إرسال';
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
    if (hashId === 'share') hashId = 'sec-share';
    if (hashId === 'inbox') hashId = 'sec-inbox';
    if (document.getElementById(hashId)){
      setTimeout(function(){ scrollToSection(hashId); }, 60);
    }
  }
})();

/* ====== نبذة عنا — نافذة من زر التذييل ====== */
(function initAboutModal(){
  if (document.getElementById('aboutModal')) return;
  var triggers = document.querySelectorAll('[data-about-open]');
  if (!triggers.length) return;

  var aboutHtml =
    '<p class="about-modal-lead">المنصة من إعداد <strong>مازن عطية الذبياني</strong>.</p>' +
    '<p>طالب في <strong>جامعة أم القرى</strong>، يدرس تخصص <strong>تفاعل الإنسان والحاسوب (HCI)</strong>.</p>' +
    '<p>يسعى لنشر التخصص ومفاهيمه بالعربية، وترتيب مسار تعلّم واضح، مع الاستمرار في تطوير المنصة وتحسين التجربة خطوة بخطوة.</p>';

  var backdrop = document.createElement('div');
  backdrop.id = 'aboutModal';
  backdrop.className = 'site-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'aboutModalTitle');
  backdrop.hidden = true;
  backdrop.innerHTML =
    '<div class="site-modal about-modal">' +
      '<div class="site-modal-head">' +
        '<h3 id="aboutModalTitle">نبذة عنا</h3>' +
        '<button type="button" class="site-modal-close" id="aboutModalClose" aria-label="إغلاق">×</button>' +
      '</div>' +
      '<div class="about-modal-body">' + aboutHtml + '</div>' +
    '</div>';
  document.body.appendChild(backdrop);

  function openAbout(){
    backdrop.hidden = false;
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeAbout(){
    backdrop.classList.remove('open');
    backdrop.hidden = true;
    document.body.style.overflow = '';
  }

  triggers.forEach(function(btn){
    btn.addEventListener('click', openAbout);
  });
  document.getElementById('aboutModalClose').addEventListener('click', closeAbout);
  backdrop.addEventListener('click', function(e){
    if (e.target === backdrop) closeAbout();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && backdrop.classList.contains('open')) closeAbout();
  });
})();

/* ====== أقسام القراءة: نفس المحتوى للجوال واللابتوب (عرض كامل) ====== */
(function initReadSteps(){
  document.querySelectorAll('[data-read-steps]').forEach(function(root){
    root.querySelectorAll('.read-step').forEach(function(step){
      step.classList.add('is-active');
      step.removeAttribute('hidden');
    });
    root.classList.remove('is-last', 'is-first');
    root.querySelectorAll('details.read-acc').forEach(function(d){ d.open = true; });
  });
  document.querySelectorAll('.read-accordions details.read-acc').forEach(function(d){
    d.open = true;
  });
})();
