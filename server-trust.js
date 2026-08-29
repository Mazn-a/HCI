/* قواعد صدق التقدّم والشهادة — السيرفر هو المرجع */
const FUNDAMENTALS_QUIZ = [
  {
    id: 'q1',
    prompt: 'مستخدم ضغط زر "إرسال" ولا صار أي شي بالشاشة. أي مبدأ نيلسن انخرق؟',
    options: {
      a: 'الاتساق والمعايير',
      b: 'رؤية حالة النظام',
      c: 'التصميم الجمالي البسيط'
    },
    correct: 'b'
  },
  {
    id: 'q2',
    prompt: 'تقسيم نموذج تسجيل طويل إلى 3 خطوات بسيطة بدل صفحة وحدة — هذا يقلل من؟',
    options: {
      a: 'الجهد الذهني (Cognitive Load)',
      b: 'رد النظام الفوري (Feedback)',
      c: 'تصوّر المستخدم (Mental Model)'
    },
    correct: 'a'
  },
  {
    id: 'q3',
    prompt: 'زر بارز بظل وحواف دائرية يوحي إنه "قابل للضغط" — هذا مثال على؟',
    options: {
      a: 'Iterative Design',
      b: 'Mental Model',
      c: 'Affordance'
    },
    correct: 'c'
  },
  {
    id: 'q4',
    prompt: 'أيقونات البحث والإشعارات والإعدادات مجمّعة أعلى الشاشة، فتحس إنها "مجموعة تنقّل" وحدة — هذا تفسير من؟',
    options: {
      a: 'الجهد الذهني',
      b: 'مبادئ الجشطالت (Gestalt)',
      c: 'التصميم التكراري'
    },
    correct: 'b'
  }
];

const VALID_PRACTICE = new Set(
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', 'analyze']
);
const VALID_COURSES = new Set(['satr', 'google', 'idf', 'figma']);
const VALID_BOOKS = new Set(['norman', 'krug', 'cooper', 'eyal']);
const NOTE_MIN = 40;

function parseJsonSafe(raw, fallback) {
  try {
    const v = JSON.parse(raw || '');
    return v && typeof v === 'object' ? v : fallback;
  } catch {
    return fallback;
  }
}

function publicQuiz() {
  return FUNDAMENTALS_QUIZ.map(function (q) {
    return { id: q.id, prompt: q.prompt, options: q.options };
  });
}

function gradeFundamentals(answers) {
  const incoming = answers && typeof answers === 'object' ? answers : {};
  let score = 0;
  const detail = FUNDAMENTALS_QUIZ.map(function (q) {
    const chosen = String(incoming[q.id] || incoming['fundamentals-' + q.id] || '').trim();
    const ok = chosen === q.correct;
    if (ok) score += 1;
    return { id: q.id, chosen: chosen, ok: ok, correct: q.correct };
  });
  return {
    score: score,
    total: FUNDAMENTALS_QUIZ.length,
    passed: score >= 3,
    answers: detail,
    updatedAt: new Date().toISOString()
  };
}

function practiceCount(practice) {
  const p = practice || {};
  const scenes = p.scenes && typeof p.scenes === 'object' ? p.scenes : p;
  let n = 0;
  Object.keys(scenes).forEach(function (key) {
    if (key === 'count' || key === 'scenes') return;
    const id = String(key).replace(/^hci_practice_/, '');
    if (VALID_PRACTICE.has(id) && scenes[key]) n += 1;
  });
  return n;
}

function noteCount(store, allowed) {
  const obj = store || {};
  let n = 0;
  Object.keys(obj).forEach(function (id) {
    if (!allowed.has(id)) return;
    const row = obj[id];
    const note = row && typeof row === 'object' ? String(row.note || '') : '';
    if (note.trim().length >= NOTE_MIN) n += 1;
  });
  return n;
}

function markPracticeScene(practice, sceneId) {
  const id = String(sceneId || '').replace(/^hci_practice_/, '');
  if (!VALID_PRACTICE.has(id)) return { ok: false, error: 'تمرين غير معروف' };
  const next = Object.assign({ scenes: {} }, practice || {});
  if (!next.scenes || typeof next.scenes !== 'object') next.scenes = {};
  next.scenes[id] = true;
  next.count = practiceCount(next);
  return { ok: true, practice: next, count: next.count };
}

function saveNote(store, allowed, id, note) {
  const key = String(id || '').trim();
  const text = String(note || '').trim().slice(0, 800);
  if (!allowed.has(key)) return { ok: false, error: 'عنصر غير معروف' };
  if (text.length < NOTE_MIN) {
    return { ok: false, error: 'اكتب جملة أوضح (٤٠ حرفاً على الأقل) عما فهمت أو طبّقت.' };
  }
  const next = Object.assign({}, store || {});
  next[key] = { note: text, at: new Date().toISOString() };
  return { ok: true, store: next };
}

function sanitizeJourney(journey, ctx) {
  const j = Object.assign({}, journey || {});
  const done = Object.assign({}, j.done || {});
  if (!(ctx.quiz && ctx.quiz.fundamentals && ctx.quiz.fundamentals.passed)) {
    delete done.fundamentals;
  }
  if (practiceCount(ctx.practice) < 3) delete done.practice;
  if (noteCount(ctx.courses, VALID_COURSES) < 1) delete done.courses;
  if (noteCount(ctx.books, VALID_BOOKS) < 2) delete done.books;
  j.done = done;
  if (
    j.foundationDone ||
    done.discover || done.fundamentals || done.coding ||
    done.courses || done.books || done.practice || done.contribute
  ) {
    j.foundationDone = true;
  }
  return j;
}

function journeyComplete(journey, ctx) {
  const clean = sanitizeJourney(journey, ctx);
  const ids = ['discover', 'fundamentals', 'coding', 'courses', 'books', 'practice', 'contribute'];
  return ids.every(function (k) { return !!(clean.done && clean.done[k]); });
}

function evidenceSummary(ctx) {
  const quiz = (ctx.quiz && ctx.quiz.fundamentals) || {};
  return {
    quizScore: Number(quiz.score) || 0,
    quizTotal: Number(quiz.total) || 4,
    quizPassed: !!quiz.passed,
    practiceCount: practiceCount(ctx.practice),
    courseNotes: noteCount(ctx.courses, VALID_COURSES),
    bookNotes: noteCount(ctx.books, VALID_BOOKS)
  };
}

function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || req.ip || req.socket && req.socket.remoteAddress || 'unknown';
}

function createRateLimiter(windowMs, max) {
  const hits = new Map();
  return function rateLimit(req, res, next) {
    const key = clientIp(req) + '|' + (req.path || '');
    const now = Date.now();
    let row = hits.get(key);
    if (!row || now - row.start > windowMs) {
      row = { start: now, count: 0 };
    }
    row.count += 1;
    hits.set(key, row);
    if (hits.size > 4000) {
      hits.forEach(function (v, k) {
        if (now - v.start > windowMs) hits.delete(k);
      });
    }
    if (row.count > max) {
      return res.status(429).json({ error: 'محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.' });
    }
    next();
  };
}

function readCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i < 1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  });
  return out;
}

function tokenFromRequest(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ') && header.length > 12) return header.slice(7);
  return readCookies(req).hci_token || '';
}

function cookieHeader(name, value, extra) {
  const parts = [name + '=' + encodeURIComponent(value || ''), 'Path=/', 'SameSite=Lax'];
  if (extra && extra.maxAge != null) parts.push('Max-Age=' + extra.maxAge);
  if (extra && extra.httpOnly) parts.push('HttpOnly');
  if (extra && extra.secure) parts.push('Secure');
  return parts.join('; ');
}

function isProd() {
  return process.env.NODE_ENV === 'production';
}

function attachAuthCookie(res, token) {
  res.append('Set-Cookie', cookieHeader('hci_token', token, {
    maxAge: 30 * 24 * 3600,
    httpOnly: true,
    secure: isProd()
  }));
}

function clearAuthCookie(res) {
  res.append('Set-Cookie', cookieHeader('hci_token', '', { maxAge: 0, httpOnly: true, secure: isProd() }));
}

function applySecurityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProd()) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://accounts.google.com https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://api.qrserver.com",
    "frame-src https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  next();
}

function corsOrigin(origin, cb) {
  if (!origin) return cb(null, true);
  try {
    const host = new URL(origin).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return cb(null, true);
    if (host === 'hci-1-fk7w.onrender.com' || /\.onrender\.com$/.test(host)) return cb(null, true);
  } catch { /* */ }
  return cb(null, false);
}

module.exports = {
  publicQuiz,
  gradeFundamentals,
  practiceCount,
  noteCount,
  markPracticeScene,
  saveNote,
  sanitizeJourney,
  journeyComplete,
  evidenceSummary,
  createRateLimiter,
  tokenFromRequest,
  attachAuthCookie,
  clearAuthCookie,
  applySecurityHeaders,
  corsOrigin,
  VALID_COURSES,
  VALID_BOOKS,
  NOTE_MIN
};
