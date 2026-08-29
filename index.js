/* سيرفر منصة HCI — مصادقة، تقدم، لوحة إدارة */
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, ensureAdmin, ensurePreviewOwner, resetPreviewOwnerProgress, checkPassword, ready, dataDir, PREVIEW_EMAIL, PREVIEW_PHONE, PREVIEW_PIN } = require('./db');
const { sendOtpEmail } = require('./mailer');
const trust = require('./server-trust');

const app = express();
const PORT = process.env.PORT || 3000;
function resolveJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV !== 'production') {
    return 'hci-local-dev-secret-only';
  }
  const secretFile = path.join(dataDir, '.jwt-secret');
  try {
    if (fs.existsSync(secretFile)) {
      const existing = String(fs.readFileSync(secretFile, 'utf8') || '').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    return generated;
  } catch (e) {
    return crypto.randomBytes(48).toString('hex');
  }
}
const JWT_SECRET = resolveJwtSecret();
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || '').trim();

const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) { cb(null, uploadsDir); },
  filename: function (_req, file, cb) {
    const safe = String(file.originalname || 'media').replace(/[^\w.\-()\u0600-\u06FF]/g, '_');
    cb(null, Date.now() + '-' + safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: function (_req, file, cb) {
    const ok = /^(image\/(jpeg|jpg|png|gif|webp)|video\/(mp4|webm|quicktime|x-m4v))$/i.test(file.mimetype);
    if (!ok) return cb(new Error('يُسمح بالصور أو فيديو قصير فقط (mp4/webm)'));
    cb(null, true);
  }
});

app.use(compression());
app.use(trust.applySecurityHeaders);
app.use(cors({
  origin: trust.corsOrigin,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
const authBurstLimit = trust.createRateLimiter(10 * 60 * 1000, 25);
const otpBurstLimit = trust.createRateLimiter(10 * 60 * 1000, 8);

/* ===== وضع الصيانة للموقع بالكامل =====
   true = الزوار يُحوَّلون لصفحة الصيانة
   للتجربة أنت: افتح أي صفحة مع ?open=1 (يحفظ كوكي تجاوز)
   إلغاء التجاوز: ?open=0
   لإعادة فتح الموقع للجميع: غيّر إلى false (ومعها gate.js)
*/
const MAINTENANCE_MODE = false;

app.use(function maintenanceGate(req, res, next) {
  if (!MAINTENANCE_MODE) return next();

  const pathOnly = (req.path || '/').split('?')[0];
  const isAsset = /\.(css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|mp4|webm|json)$/i.test(pathOnly);
  const isApi = pathOnly === '/api' || pathOnly.indexOf('/api/') === 0;
  const isUploads = pathOnly.indexOf('/uploads/') === 0;
  const isMaintPage = pathOnly === '/maintenance.html' || pathOnly === '/maintenance';
  const isSeo = pathOnly === '/robots.txt' || pathOnly === '/sitemap.xml';
  const isGoogleVerify = /^\/google[a-z0-9]+\.html$/i.test(pathOnly);

  if (isAsset || isApi || isUploads || isMaintPage || isSeo || isGoogleVerify) return next();

  const open = String(req.query.open || '');
  if (open === '1') {
    res.setHeader('Set-Cookie', 'hci_maint_bypass=1; Path=/; Max-Age=2592000; SameSite=Lax');
    return next();
  }
  if (open === '0') {
    res.setHeader('Set-Cookie', 'hci_maint_bypass=; Path=/; Max-Age=0; SameSite=Lax');
    return res.redirect(302, '/maintenance.html');
  }

  const cookie = req.headers.cookie || '';
  if (/(?:^|;\s*)hci_maint_bypass=1(?:;|$)/.test(cookie)) return next();

  return res.redirect(302, '/maintenance.html');
});

/* robots أثناء الصيانة: قوقل يبقى على صفحة الصيانة فقط */
app.get('/robots.txt', (_req, res) => {
  res.status(200);
  res.type('text/plain; charset=utf-8');
  res.set('Cache-Control', 'no-store');
  if (MAINTENANCE_MODE) {
    res.send(
      [
        'User-agent: *',
        'Disallow: /',
        'Allow: /maintenance.html',
        '',
        'User-agent: Googlebot',
        'Disallow: /',
        'Allow: /maintenance.html',
        ''
      ].join('\n')
    );
    return;
  }
  res.send(
    [
      'User-agent: *',
      'Allow: /',
      '',
      'User-agent: Googlebot',
      'Allow: /',
      '',
      'Sitemap: https://hci-1-fk7w.onrender.com/sitemap.xml',
      ''
    ].join('\n')
  );
});

app.get('/sitemap.xml', (_req, res) => {
  res.status(200);
  res.type('application/xml; charset=utf-8');
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'HCI',
    db: process.env.DATABASE_URL ? 'postgres' : 'file',
    time: new Date().toISOString()
  });
});

app.use('/uploads', express.static(uploadsDir, {
  maxAge: '30d',
  index: false,
  setHeaders: function (res) {
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));
app.use(express.static(__dirname, {
  setHeaders: function (res, filePath) {
    if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (/\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    } else if (/\.html$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.first_name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function authRequired(req, res, next) {
  const token = trust.tokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'جلسة منتهية — سجّل دخولك من جديد' });
  }
}

function sendAuth(res, user, extra) {
  const token = signToken(user);
  trust.attachAuthCookie(res, token);
  res.json(Object.assign({ token: token, user: publicUser(user) }, extra || {}));
}

function progressContext(userId) {
  const row = db.getProgress(userId) || {};
  return {
    quiz: parseJsonSafe(row.quiz_json, {}),
    practice: parseJsonSafe(row.practice_json, {}),
    courses: parseJsonSafe(row.courses_json, {}),
    books: parseJsonSafe(row.books_json, {}),
    journey: parseJsonSafe(row.journey_json, {}),
    row: row
  };
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'صلاحية المدير فقط' });
    }
    next();
  });
}

function defaultNotifPrefs(row) {
  const p = (row && row.notif_prefs) || {};
  return {
    inApp: p.inApp !== false,
    browserPush: !!p.browserPush,
    stalled: p.stalled !== false,
    updates: p.updates !== false
  };
}

function publicUser(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.first_name + ' ' + row.last_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    pathType: row.path_type || null,
    introSeen: !!row.intro_seen,
    emailVerified: !!row.email_verified,
    phoneVerified: !!row.phone_verified,
    authProvider: row.auth_provider || 'local',
    passwordChangedAt: row.password_changed_at || null,
    createdAt: row.created_at,
    lastLogin: row.last_login,
    referredBy: row.referred_by || null,
    notifPrefs: defaultNotifPrefs(row),
    avatar: row.avatar || null,
    hasAvatar: !!row.avatar,
    isPreview: !!row.is_preview
  };
}

function sendWelcomeNotification(user) {
  if (!user || user.role === 'admin') return;
  const already = db.getNotificationsForUser(user.id).some((n) => n.type === 'welcome');
  if (already) return;
  const name = user.first_name || 'يا بطل';
  db.createNotification({
    userId: user.id,
    type: 'welcome',
    title: 'أهلاً فيك في HCI ✨',
    body: name + '، مبسوطين بانضمامك. ابدأ بفهم التخصص، وبعدها المسارات تفتح لك خطوة خطوة. إحنا معك للنهاية.',
    link: 'foundation.html'
  });
}

function maybeNudgeStalledUser(user, opts) {
  opts = opts || {};
  if (!user || user.role === 'admin') return false;
  const prefs = defaultNotifPrefs(user);
  if (!prefs.inApp || !prefs.stalled) return false;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (!opts.force && user.last_stall_nudge_at && now - new Date(user.last_stall_nudge_at).getTime() < weekMs) {
    return false;
  }
  const p = db.getProgress(user.id);
  const journey = parseJsonSafe(p && p.journey_json, {});
  const done = journey.done || {};
  const doneCount = Object.keys(done).filter((k) => done[k]).length;
  if (doneCount >= 7) return false;
  /* نشاط التقدّم فقط — آخر دخول يتحدّث عند كل جلسة فلا يصلح لقياس التوقّف */
  const lastAct = (p && p.updated_at) || user.created_at;
  if (!lastAct || now - new Date(lastAct).getTime() < weekMs) return false;

  const stop = journeyStopPoint(journey);
  const stopLabel = (stop && stop.label) ? stop.label : 'بداية المسار';
  db.createNotification({
    userId: user.id,
    type: 'stall_nudge',
    title: 'وينك؟ المسار ينتظرك',
    body: 'توقفت عند «' + stopLabel + '». رجعة قصيرة تكفي تكمّل — أنت أقرب مما تتخيل.',
    link: 'index.html#paths'
  });
  db.updateUser(user.id, { last_stall_nudge_at: new Date().toISOString() });
  return true;
}

function nameHistoryPublic(row) {
  return (row.name_history || []).map((h) => ({
    oldName: ((h.old_first || '') + ' ' + (h.old_last || '')).trim(),
    newName: ((h.new_first || '') + ' ' + (h.new_last || '')).trim(),
    oldFirst: h.old_first,
    oldLast: h.old_last,
    newFirst: h.new_first,
    newLast: h.new_last,
    changedAt: h.changed_at
  }));
}

function resolveIdentifier(raw) {
  const value = String(raw || '').trim();
  if (!value) return { error: 'أدخل البريد أو رقم الجوال' };
  if (value.includes('@')) {
    const email = value.toLowerCase();
    if (!isValidEmail(email)) return { error: 'البريد الإلكتروني غير صحيح. استخدم صيغة مثل name@example.com' };
    return { identifier: email, channel: 'email', email: email, phone: null };
  }
  const phone = normalizePhone(value);
  if (!isValidPhone(phone)) return { error: 'رقم الهاتف غير صحيح. استخدم صيغة 05xxxxxxxx (10 أرقام)' };
  return { identifier: phone, channel: 'phone', email: null, phone: phone };
}

function isValidPersonName(v) {
  const s = String(v || '').trim().replace(/\s+/g, ' ');
  if (s.length < 2 || s.length > 40) return false;
  return /^[A-Za-z\u0621-\u063A\u0641-\u064A]+(?: [A-Za-z\u0621-\u063A\u0641-\u064A]+)*$/.test(s);
}

function isValidEmail(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim().toLowerCase();
  if (s.length < 6 || s.length > 100) return false;
  if (s.includes('..')) return false;
  return /^[a-z0-9](?:[a-z0-9._%+\-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?)+$/i.test(s);
}

function isValidPhone(v) {
  if (typeof v !== 'string') return false;
  return /^05[0-9]{8}$/.test(normalizePhone(v));
}

function toAsciiDigits(v) {
  return String(v || '')
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06F0));
}

function normalizePhone(v) {
  let digits = toAsciiDigits(v).replace(/[^0-9]/g, '');
  if (digits.startsWith('966') && digits.length >= 12) {
    digits = '0' + digits.slice(3);
  }
  if (digits.length === 9 && digits.startsWith('5')) {
    digits = '0' + digits;
  }
  return digits;
}

/* ---------- تسجيل حساب ---------- */
app.post('/api/auth/register', authBurstLimit, (req, res) => {
  try {
    const firstName = String(req.body.firstName || '').trim();
    const lastName = String(req.body.lastName || '').trim();
    const email = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
    const phone = req.body.phone ? normalizePhone(req.body.phone) : null;
    const password = String(req.body.password || '');

    if (!firstName || firstName.length < 2) {
      return res.status(400).json({ error: 'الاسم الأول مطلوب (حرفين على الأقل)' });
    }
    if (!lastName || lastName.length < 2) {
      return res.status(400).json({ error: 'الاسم الثاني مطلوب (حرفين على الأقل)' });
    }
    if (!isValidPersonName(firstName) || !isValidPersonName(lastName)) {
      return res.status(400).json({ error: 'الاسم حروف عربية أو إنجليزية فقط — بدون أرقام أو رموز' });
    }
    if (!email && !phone) {
      return res.status(400).json({ error: 'أدخل البريد الإلكتروني أو رقم الجوال' });
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'البريد الإلكتروني غير صحيح. استخدم صيغة مثل name@example.com' });
    }
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ error: 'رقم الهاتف غير صحيح. استخدم صيغة 05xxxxxxxx (10 أرقام)' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'كلمة المرور لازم 8 أحرف على الأقل' });
    }

    if (email && db.findUserByEmail(email)) {
      return res.status(409).json({ error: 'هذا البريد مسجّل مسبقاً' });
    }
    if (phone && db.findUserByPhone(phone)) {
      return res.status(409).json({ error: 'هذا الرقم مسجّل مسبقاً' });
    }

    const referredByRaw = req.body.referredBy != null ? req.body.referredBy : req.body.ref;
    let referredBy = null;
    if (referredByRaw != null && referredByRaw !== '') {
      const n = Number(referredByRaw);
      if (Number.isFinite(n) && n > 0 && db.findUserById(n)) referredBy = n;
    }

    const user = db.createUser({
      firstName,
      lastName,
      email,
      phone: phone || null,
      passwordHash: bcrypt.hashSync(password, 10),
      role: 'student',
      referredBy: referredBy
    });

    if (referredBy) {
      try {
        db.attachShareSignup(referredBy, user.id, req.body.visitorKey || '');
      } catch (e) { /* */ }
    }

    sendWelcomeNotification(user);

    res.status(201).json({
      user: publicUser(user),
      needsVerification: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ أثناء إنشاء الحساب' });
  }
});

/* ---------- تسجيل دخول (بريد أو جوال) ---------- */
app.post('/api/auth/login', authBurstLimit, (req, res) => {
  try {
    let identifier = String(req.body.identifier || req.body.email || '').trim();
    let password = String(req.body.password || '')
      .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
      .trim();

    if (!identifier || !password) {
      return res.status(400).json({ error: 'أدخل البريد/الجوال وكلمة المرور' });
    }
    if (password.length < 1) {
      return res.status(400).json({ error: 'كلمة المرور مطلوبة' });
    }

    let user = null;
    if (identifier.includes('@')) {
      user = db.findUserByEmail(identifier.toLowerCase());
    } else {
      user = db.findUserByPhone(normalizePhone(identifier));
    }

    const idNorm = identifier.includes('@')
      ? identifier.toLowerCase()
      : normalizePhone(identifier);
    const isPreviewCreds =
      (idNorm === PREVIEW_EMAIL || idNorm === PREVIEW_PHONE) &&
      String(password).replace(/[\u200B-\u200D\uFEFF\u2060]/g, '').trim() === PREVIEW_PIN;
    if (isPreviewCreds && (!user || !user.is_preview)) {
      ensurePreviewOwner();
      user = db.findUserByEmail(PREVIEW_EMAIL) || db.findUserByPhone(PREVIEW_PHONE);
    }

    if (!user || !checkPassword(user, password)) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة — تأكد من البريد/الجوال وكلمة المرور' });
    }

    if (user.is_preview) {
      resetPreviewOwnerProgress(user.id);
    }
    db.updateUser(user.id, { last_login: new Date().toISOString() });
    user = db.findUserById(user.id);
    if (!user.is_preview) maybeNudgeStalledUser(user);

    const verified = !!(user.email_verified || user.phone_verified || user.role === 'admin' || user.is_preview);
    sendAuth(res, user, { needsVerification: !verified });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ أثناء تسجيل الدخول' });
  }
});

/* ---------- تسجيل / دخول عبر Google ---------- */
app.get('/api/auth/google-config', (_req, res) => {
  res.json({
    enabled: !!GOOGLE_CLIENT_ID,
    clientId: GOOGLE_CLIENT_ID || null
  });
});

async function verifyGoogleIdToken(credential) {
  if (!GOOGLE_CLIENT_ID) {
    const err = new Error('تسجيل جوجل غير مفعّل على السيرفر');
    err.status = 503;
    throw err;
  }
  const token = String(credential || '').trim();
  if (!token) {
    const err = new Error('رمز جوجل مفقود');
    err.status = 400;
    throw err;
  }
  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token);
  let data;
  try {
    const resp = await fetch(url);
    data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const err = new Error('تعذر التحقق من حساب جوجل');
      err.status = 401;
      throw err;
    }
  } catch (e) {
    if (e.status) throw e;
    const err = new Error('تعذر الاتصال بخوادم جوجل للتحقق');
    err.status = 502;
    throw err;
  }
  if (String(data.aud || '') !== GOOGLE_CLIENT_ID) {
    const err = new Error('رمز جوجل غير صالح لهذا الموقع');
    err.status = 401;
    throw err;
  }
  const email = String(data.email || '').trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    const err = new Error('حساب جوجل بلا بريد صالح');
    err.status = 400;
    throw err;
  }
  const verified = data.email_verified === true || data.email_verified === 'true';
  if (!verified) {
    const err = new Error('بريد جوجل غير موثّق');
    err.status = 400;
    throw err;
  }
  return data;
}

function splitGoogleName(payload) {
  function cleanName(raw, fallback) {
    const s = String(raw || '')
      .replace(/[^A-Za-z\u0621-\u063A\u0641-\u064A\s]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40);
    return isValidPersonName(s) ? s : fallback;
  }
  let first = String(payload.given_name || '').trim();
  let last = String(payload.family_name || '').trim();
  if (!first && payload.name) {
    const parts = String(payload.name).trim().split(/\s+/);
    first = parts[0] || '';
    last = parts.slice(1).join(' ') || '';
  }
  return {
    firstName: cleanName(first, 'مستخدم'),
    lastName: cleanName(last, 'جوجل')
  };
}

app.post('/api/auth/google', async (req, res) => {
  try {
    const payload = await verifyGoogleIdToken(req.body && req.body.credential);
    const sub = String(payload.sub || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const names = splitGoogleName(payload);

    let user = (sub && db.findUserByGoogleSub(sub)) || db.findUserByEmail(email);
    let isNew = false;

    if (!user) {
      const referredByRaw = req.body.referredBy != null ? req.body.referredBy : req.body.ref;
      let referredBy = null;
      if (referredByRaw != null && referredByRaw !== '') {
        const n = Number(referredByRaw);
        if (Number.isFinite(n) && n > 0 && db.findUserById(n)) referredBy = n;
      }

      user = db.createUser({
        firstName: names.firstName,
        lastName: names.lastName,
        email,
        phone: null,
        passwordHash: bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10),
        role: 'student',
        referredBy,
        authProvider: 'google',
        googleSub: sub || null,
        emailVerified: true
      });
      isNew = true;

      if (referredBy) {
        try {
          db.attachShareSignup(referredBy, user.id, req.body.visitorKey || '');
        } catch (e) { /* */ }
      }
      sendWelcomeNotification(user);
    } else {
      const patch = {
        last_login: new Date().toISOString(),
        email_verified: true
      };
      if (sub && !user.google_sub) patch.google_sub = sub;
      if (!user.auth_provider || user.auth_provider === 'local') {
        if (sub) patch.auth_provider = user.password_hash ? 'local+google' : 'google';
      }
      db.updateUser(user.id, patch);
      user = db.findUserById(user.id);
      maybeNudgeStalledUser(user);
    }

    sendAuth(res, user, { isNew: isNew });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'خطأ أثناء تسجيل الدخول بجوجل' });
  }
});

app.get('/api/auth/me', authRequired, (req, res) => {
  const user = db.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  res.json({ user: publicUser(user) });
});

/* ---------- مشاركة الموقع وتتبع الإحالات ---------- */
app.post('/api/share/hit', (req, res) => {
  try {
    let visitorUserId = null;
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      try { visitorUserId = jwt.verify(token, JWT_SECRET).id; } catch { /* زائر */ }
    }
    const result = db.recordShareHit({
      sharerId: req.body.ref || req.body.sharerId,
      visitorKey: req.body.visitorKey,
      path: req.body.path || '/',
      userAgent: req.get('user-agent') || '',
      visitorUserId: visitorUserId
    });
    if (!result.ok) return res.status(400).json({ error: result.error || 'تعذر تسجيل الزيارة' });
    res.json({ ok: true, duplicate: !!result.duplicate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'تعذر تسجيل زيارة المشاركة' });
  }
});

app.get('/api/share/stats', authRequired, (req, res) => {
  try {
    const user = db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const stats = db.getShareStats(user.id);
    res.json({
      ref: String(user.id),
      sharePath: '/index.html?ref=' + user.id,
      stats: stats
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'تعذر جلب إحصائيات المشاركة' });
  }
});

app.get('/api/admin/share', adminRequired, (_req, res) => {
  try {
    res.json(db.getAdminShareOverview());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'تعذر جلب سجل المشاركة' });
  }
});

/* تحديث الاسم — ينعكس على الشهادة ولوحة الإدارة مع سجل التغيير */
app.patch('/api/auth/profile', authRequired, (req, res) => {
  try {
    const firstName = String(req.body.firstName || '').trim();
    const lastName = String(req.body.lastName || '').trim();
    const result = db.updateUserName(req.user.id, firstName, lastName);
    if (!result) return res.status(404).json({ error: 'المستخدم غير موجود' });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ user: publicUser(result.user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'تعذر تحديث الاسم' });
  }
});

/* صورة الحساب — تُحفظ على السيرفر وتظهر للإدارة والشهادة */
app.patch('/api/auth/avatar', authRequired, (req, res) => {
  try {
    const user = db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const raw = req.body && req.body.avatar;
    if (raw == null || raw === '') {
      db.updateUser(user.id, { avatar: null });
      return res.json({ user: publicUser(db.findUserById(user.id)) });
    }
    const s = String(raw);
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(s)) {
      return res.status(400).json({ error: 'صيغة الصورة غير مدعومة' });
    }
    if (s.length > 450000) {
      return res.status(400).json({ error: 'الصورة كبيرة — اختَر صورة أوضح وأصغر' });
    }
    db.updateUser(user.id, { avatar: s });
    res.json({ user: publicUser(db.findUserById(user.id)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'تعذر حفظ الصورة' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  trust.clearAuthCookie(res);
  res.json({ ok: true });
});

app.get('/api/quiz/fundamentals', authRequired, (_req, res) => {
  res.json({ questions: trust.publicQuiz(), passScore: 3 });
});

app.post('/api/quiz/fundamentals', authRequired, (req, res) => {
  try {
    const graded = trust.gradeFundamentals(req.body && req.body.answers);
    const ctx = progressContext(req.user.id);
    const quiz = Object.assign({}, ctx.quiz, { fundamentals: graded });
    const journey = trust.sanitizeJourney(ctx.journey, {
      quiz: quiz,
      practice: ctx.practice,
      courses: ctx.courses,
      books: ctx.books
    });
    if (graded.passed) {
      if (!journey.done) journey.done = {};
      journey.done.fundamentals = true;
      if (!journey.unlocked) journey.unlocked = {};
      journey.unlocked.coding = true;
    }
    db.upsertProgress(req.user.id, {
      journey_json: JSON.stringify(journey),
      quiz_json: JSON.stringify(quiz),
      coding_json: ctx.row.coding_json || '{}',
      coding_stage: ctx.row.coding_stage || '',
      practice_json: ctx.row.practice_json || '{}',
      courses_json: ctx.row.courses_json || '{}',
      books_json: ctx.row.books_json || '{}'
    });
    res.json({ ok: true, result: graded });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'تعذر تصحيح الاختبار' });
  }
});

app.post('/api/practice/complete', authRequired, (req, res) => {
  const ctx = progressContext(req.user.id);
  const marked = trust.markPracticeScene(ctx.practice, req.body && req.body.sceneId);
  if (!marked.ok) return res.status(400).json({ error: marked.error });
  const journey = trust.sanitizeJourney(ctx.journey, {
    quiz: ctx.quiz,
    practice: marked.practice,
    courses: ctx.courses,
    books: ctx.books
  });
  if (marked.count >= 3) {
    if (!journey.done) journey.done = {};
    journey.done.practice = true;
  }
  db.upsertProgress(req.user.id, {
    journey_json: JSON.stringify(journey),
    quiz_json: ctx.row.quiz_json || '{}',
    coding_json: ctx.row.coding_json || '{}',
    coding_stage: ctx.row.coding_stage || '',
    practice_json: JSON.stringify(marked.practice),
    courses_json: ctx.row.courses_json || '{}',
    books_json: ctx.row.books_json || '{}'
  });
  res.json({ ok: true, count: marked.count });
});

app.post('/api/evidence', authRequired, (req, res) => {
  const kind = String((req.body && req.body.kind) || '');
  const id = req.body && req.body.id;
  const note = req.body && req.body.note;
  const ctx = progressContext(req.user.id);
  let courses = ctx.courses;
  let books = ctx.books;
  if (kind === 'course') {
    const saved = trust.saveNote(courses, trust.VALID_COURSES, id, note);
    if (!saved.ok) return res.status(400).json({ error: saved.error });
    courses = saved.store;
  } else if (kind === 'book') {
    const saved = trust.saveNote(books, trust.VALID_BOOKS, id, note);
    if (!saved.ok) return res.status(400).json({ error: saved.error });
    books = saved.store;
  } else {
    return res.status(400).json({ error: 'نوع غير صالح' });
  }
  const journey = trust.sanitizeJourney(ctx.journey, {
    quiz: ctx.quiz,
    practice: ctx.practice,
    courses: courses,
    books: books
  });
  if (trust.noteCount(courses, trust.VALID_COURSES) >= 1) {
    if (!journey.done) journey.done = {};
    journey.done.courses = true;
    if (!journey.unlocked) journey.unlocked = {};
    journey.unlocked.books = true;
  }
  if (trust.noteCount(books, trust.VALID_BOOKS) >= 2) {
    if (!journey.done) journey.done = {};
    journey.done.books = true;
  }
  db.upsertProgress(req.user.id, {
    journey_json: JSON.stringify(journey),
    quiz_json: ctx.row.quiz_json || '{}',
    coding_json: ctx.row.coding_json || '{}',
    coding_stage: ctx.row.coding_stage || '',
    practice_json: ctx.row.practice_json || '{}',
    courses_json: JSON.stringify(courses),
    books_json: JSON.stringify(books)
  });
  res.json({
    ok: true,
    courseNotes: trust.noteCount(courses, trust.VALID_COURSES),
    bookNotes: trust.noteCount(books, trust.VALID_BOOKS)
  });
});

/* ---------- طلب رمز تحقق (بريد أو هاتف) ---------- */
app.post('/api/auth/request-otp', otpBurstLimit, async (req, res) => {
  try {
    const purpose = String(req.body.purpose || 'verify');
    if (purpose !== 'verify' && purpose !== 'reset') {
      return res.status(400).json({ error: 'غرض الرمز غير صالح' });
    }

    const resolved = resolveIdentifier(req.body.identifier);
    if (resolved.error) return res.status(400).json({ error: resolved.error });

    let user = db.findUserByIdentifier(req.body.identifier);

    if (purpose === 'reset') {
      if (!user) return res.status(404).json({ error: 'لم يُعثر على حساب بهذا المعرف' });
    }

    if (purpose === 'verify') {
      try {
        const token = trust.tokenFromRequest(req);
        if (token) {
          const payload = jwt.verify(token, JWT_SECRET);
          user = db.findUserById(payload.id) || user;
        }
      } catch { /* جلسة اختيارية */ }
    }

    if (purpose === 'verify' && !user) {
      return res.status(404).json({ error: 'أنشئ الحساب أولاً ثم اطلب رمز التحقق' });
    }

    if (purpose === 'verify' && user) {
      if (resolved.channel === 'email' && user.email !== resolved.email) {
        return res.status(400).json({ error: 'البريد لا يطابق حسابك' });
      }
      if (resolved.channel === 'phone' && user.phone !== resolved.phone) {
        return res.status(400).json({ error: 'رقم الهاتف لا يطابق حسابك' });
      }
    }

    const { code } = db.createOtp({
      identifier: resolved.identifier,
      purpose,
      userId: user ? user.id : null,
      channel: resolved.channel
    });

    let emailSent = false;
    if (resolved.channel === 'email') {
      emailSent = await sendOtpEmail(resolved.identifier, code, purpose);
    }

    const payload = {
      ok: true,
      channel: resolved.channel,
      message: emailSent
        ? 'أرسلنا رمز التحقق إلى بريدك الإلكتروني — تفقد صندوق الوارد (وربما مجلد الرسائل غير المرغوبة).'
        : 'الرمز ظاهر تحت الخانة. انسخه وأدخله خلال 10 دقائق.'
    };
    if (!emailSent) payload.demoCode = code;

    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'تعذر إرسال رمز التحقق' });
  }
});

/* ---------- تأكيد ملكية البريد/الجوال ---------- */
app.post('/api/auth/confirm-otp', (req, res) => {
  try {
    const purpose = String(req.body.purpose || 'verify');
    const resolved = resolveIdentifier(req.body.identifier);
    if (resolved.error) return res.status(400).json({ error: resolved.error });

    if (purpose === 'reset') {
      const check = db.checkOtp(resolved.identifier, 'reset', req.body.code);
      if (!check.ok) return res.status(400).json({ error: check.error });
      return res.json({ ok: true, resetTokenOk: true });
    }

    const result = db.consumeOtp(resolved.identifier, 'verify', req.body.code);
    if (!result.ok) return res.status(400).json({ error: result.error });

    let user = null;
    const sessionTok = trust.tokenFromRequest(req);
    if (sessionTok) {
      try {
        const payload = jwt.verify(sessionTok, JWT_SECRET);
        user = db.findUserById(payload.id);
      } catch { /* */ }
    }
    if (!user) user = db.findUserByIdentifier(req.body.identifier);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

    const patch = {};
    if (resolved.channel === 'email') patch.email_verified = true;
    if (resolved.channel === 'phone') patch.phone_verified = true;
    db.updateUser(user.id, patch);
    const updated = db.findUserById(user.id);
    sendAuth(res, updated, { ok: true, isNew: !updated.path_type });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'تعذر التحقق من الرمز' });
  }
});

/* ---------- استرجاع كلمة المرور برمز التحقق ---------- */
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const resolved = resolveIdentifier(req.body.identifier);
    if (resolved.error) return res.status(400).json({ error: resolved.error });

    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'كلمة المرور الجديدة لازم 8 أحرف على الأقل' });
    }

    const result = db.consumeOtp(resolved.identifier, 'reset', req.body.code);
    if (!result.ok) return res.status(400).json({ error: result.error });

    const user = db.findUserByIdentifier(req.body.identifier);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'إعادة تعيين حساب المدير تتم من لوحة الإدارة فقط' });
    }

    db.setPassword(user.id, bcrypt.hashSync(newPassword, 10));
    res.json({ ok: true, message: 'تم تغيير كلمة المرور بنجاح — سجّل دخولك الآن' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'تعذر إعادة تعيين كلمة المرور' });
  }
});

/* ---------- اختيار المسار: مهتم / متخصص ---------- */
app.patch('/api/auth/path', authRequired, (req, res) => {
  const pathType = String(req.body.pathType || '');
  if (pathType !== 'curious' && pathType !== 'specialist') {
    return res.status(400).json({ error: 'اختر: مهتم بالتخصص أو متخصص' });
  }

  const user = db.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

  if (user.path_type && user.path_type !== pathType) {
    return res.status(409).json({
      error: 'مسارك محفوظ مسبقاً. نكمّل من حيث توقفت.',
      user: publicUser(user)
    });
  }
  if (user.path_type === pathType) {
    return res.json({ user: publicUser(user) });
  }

  const patch = { path_type: pathType };
  if (pathType === 'specialist') patch.intro_seen = true;
  db.updateUser(user.id, patch);
  const updated = db.findUserById(user.id);
  res.json({ user: publicUser(updated) });
});

app.patch('/api/auth/intro-seen', authRequired, (req, res) => {
  const user = db.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  db.updateUser(user.id, { intro_seen: true });
  res.json({ user: publicUser(db.findUserById(user.id)) });
});

/* ---------- التقدم ---------- */
app.get('/api/progress', authRequired, (req, res) => {
  const ctx = progressContext(req.user.id);
  if (!ctx.row) {
    return res.json({
      journey: {}, coding: {}, codingStage: '',
      practice: {}, courses: {}, books: {}, quiz: {}
    });
  }
  res.json({
    journey: trust.sanitizeJourney(ctx.journey, ctx),
    coding: parseJsonSafe(ctx.row.coding_json, {}),
    codingStage: ctx.row.coding_stage || '',
    practice: ctx.practice,
    courses: ctx.courses,
    books: ctx.books,
    quiz: ctx.quiz,
    updatedAt: ctx.row.updated_at
  });
});

/* ---------- الشهادة (يُصدرها السيرفر ليصح التحقق من أي جهاز) ---------- */
const CERT_PATH_NAME = 'مسار تفاعل الإنسان والحاسوب (HCI)';

function ensureCertificateRecord(user, journey, evidence) {
  const existing = db.getCertificateByUserId(user.id);
  if (existing) return existing;
  const fullName = (user.first_name + (user.last_name ? ' ' + user.last_name : '')).trim() || 'متعلم HCI';
  return db.createCertificate({
    userId: user.id,
    name: fullName,
    path: CERT_PATH_NAME,
    pct: 100,
    issuedAt: new Date().toISOString(),
    completedAt: (journey && (journey.completedAt || journey.doneAt)) || new Date().toISOString(),
    evidence: evidence || null
  });
}

function maybeIssueCertificateAndNotify(userId, journey) {
  const ctx = progressContext(userId);
  const clean = trust.sanitizeJourney(journey || ctx.journey, ctx);
  if (!trust.journeyComplete(clean, ctx)) return false;

  const user = db.findUserById(userId);
  if (!user) return false;

  /* التقييم قبل فتح الشهادة */
  if (!db.getFeedbackByUserId(user.id)) {
    const alreadyFb = db.getNotificationsForUser(user.id).some((n) => n.type === 'feedback_request');
    if (!alreadyFb) {
      db.createNotification({
        userId: user.id,
        type: 'feedback_request',
        title: 'خطوة أخيرة قبل الشهادة',
        body: 'أكملت المسار — قيّم تجربتك في المنصة، وبعدها تفتح شهادتك مباشرة.',
        link: 'certificate.html'
      });
    }
    return false;
  }

  ensureCertificateRecord(user, clean, trust.evidenceSummary(ctx));

  const already = db.getNotificationsForUser(user.id).some((n) => n.type === 'certificate');
  if (!already) {
    db.createNotification({
      userId: user.id,
      type: 'certificate',
      title: 'حصلت على شهادتك',
      body: 'شكراً لتقييمك. شهادتك جاهزة — افتحها للعرض أو الطباعة.',
      link: 'certificate.html'
    });
  }
  return true;
}

app.put('/api/progress', authRequired, (req, res) => {
  try {
    const ctx = progressContext(req.user.id);
    const incoming = req.body.journey || ctx.journey || {};
    const journey = trust.sanitizeJourney(incoming, ctx);
    db.upsertProgress(req.user.id, {
      journey_json: JSON.stringify(journey),
      coding_json: JSON.stringify(req.body.coding || parseJsonSafe(ctx.row.coding_json, {})),
      coding_stage: String(req.body.codingStage != null ? req.body.codingStage : (ctx.row.coding_stage || '')),
      practice_json: ctx.row.practice_json || '{}',
      courses_json: ctx.row.courses_json || '{}',
      books_json: ctx.row.books_json || '{}',
      quiz_json: ctx.row.quiz_json || '{}'
    });
    const certificateReady = maybeIssueCertificateAndNotify(req.user.id, journey);
    res.json({ ok: true, certificateReady: certificateReady, journey: journey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'تعذر حفظ التقدم' });
  }
});

function computeProgressPercent(userId) {
  const ctx = progressContext(userId);
  const journey = trust.sanitizeJourney(ctx.journey, ctx);
  const ids = ['discover', 'fundamentals', 'coding', 'courses', 'books', 'practice', 'contribute'];
  const doneCount = ids.filter((k) => !!(journey.done && journey.done[k])).length;
  return { pct: Math.round((doneCount / 7) * 100), journey, updatedAt: ctx.row ? ctx.row.updated_at : null };
}

app.get('/api/certificate/me', authRequired, (req, res) => {
  const user = db.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

  const existing = db.getCertificateByUserId(user.id);
  if (existing) return res.json({ certificate: existing });

  const { pct, journey } = computeProgressPercent(user.id);
  if (pct < 100) return res.json({ locked: true, pct });

  if (!db.getFeedbackByUserId(user.id)) {
    return res.json({ needsFeedback: true, pct: 100 });
  }

  const record = ensureCertificateRecord(user, journey, trust.evidenceSummary(progressContext(user.id)));
  res.json({ certificate: record });
});

/* ---------- تفضيلات الإشعارات وتقييم الموقع ---------- */
app.patch('/api/me/notif-prefs', authRequired, (req, res) => {
  const user = db.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  const cur = defaultNotifPrefs(user);
  const body = req.body || {};
  const next = {
    inApp: body.inApp != null ? !!body.inApp : cur.inApp,
    browserPush: body.browserPush != null ? !!body.browserPush : cur.browserPush,
    stalled: body.stalled != null ? !!body.stalled : cur.stalled,
    updates: body.updates != null ? !!body.updates : cur.updates
  };
  db.updateUser(user.id, { notif_prefs: next });
  const updated = db.findUserById(user.id);
  res.json({ ok: true, notifPrefs: defaultNotifPrefs(updated), user: publicUser(updated) });
});

app.get('/api/me/feedback', authRequired, (req, res) => {
  const row = db.getFeedbackByUserId(req.user.id);
  res.json({
    feedback: row
      ? { rating: row.rating, comment: row.comment, createdAt: row.created_at }
      : null
  });
});

app.post('/api/me/feedback', authRequired, (req, res) => {
  try {
    const rating = Number(req.body && req.body.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'قيّم من ١ إلى ٥' });
    }
    const comment = String((req.body && req.body.comment) || '').trim().slice(0, 800);
    const row = db.createSiteFeedback({
      userId: req.user.id,
      rating,
      comment
    });
    const { pct, journey } = computeProgressPercent(req.user.id);
    let certificateReady = false;
    if (pct >= 100) {
      certificateReady = maybeIssueCertificateAndNotify(req.user.id, journey);
    }
    res.status(201).json({
      ok: true,
      feedback: { rating: row.rating, comment: row.comment, createdAt: row.created_at },
      certificateReady
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'تعذر حفظ التقييم' });
  }
});

app.get('/api/certificate/:id', (req, res) => {
  const record = db.getCertificateById(req.params.id);
  if (!record) return res.status(404).json({ error: 'لم يتم العثور على شهادة بهذا الرقم' });
  res.json({
    certificate: {
      id: record.id,
      name: record.name,
      path: record.path,
      pct: record.pct,
      issued_at: record.issued_at,
      completed_at: record.completed_at,
      evidence: record.evidence || null,
      issuer: 'منصة HCI',
      claim: 'إتمام مسار تعليمي داخلي — ليست اعتماداً حكومياً أو جامعياً'
    }
  });
});

/* ---------- رسائل ---------- */
app.get('/api/messages', authRequired, (req, res) => {
  const rows = db.getMessagesForUser(req.user.id);
  res.json({
    unreadCount: db.countUnreadForUser(req.user.id),
    messages: rows.map((m) => {
      const admin = db.findUserById(m.admin_id);
      return {
        id: m.id,
        subject: m.subject,
        body: m.body,
        createdAt: m.created_at,
        updatedAt: m.updated_at || null,
        read: !!m.read_by_user,
        from: admin ? admin.first_name + ' ' + admin.last_name : 'الإدارة'
      };
    })
  });
});

app.get('/api/messages/unread-count', authRequired, (req, res) => {
  res.json({ count: db.countUnreadForUser(req.user.id) });
});

app.post('/api/messages/:id/read', authRequired, (req, res) => {
  db.markMessageRead(req.params.id, req.user.id);
  res.json({ ok: true, unreadCount: db.countUnreadForUser(req.user.id) });
});

/* ---------- تنبيهات المستخدم ---------- */
app.get('/api/notifications', authRequired, (req, res) => {
  const rows = db.getNotificationsForUser(req.user.id);
  res.json({
    unreadCount: db.countUnreadNotifications(req.user.id),
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link || '',
      refId: n.ref_id,
      read: !!n.read,
      createdAt: n.created_at
    }))
  });
});

app.post('/api/notifications/:id/read', authRequired, (req, res) => {
  const n = db.markNotificationRead(req.params.id, req.user.id);
  if (!n) return res.status(404).json({ error: 'التنبيه غير موجود' });
  res.json({
    ok: true,
    unreadCount: db.countUnreadNotifications(req.user.id)
  });
});

app.post('/api/notifications/read-all', authRequired, (req, res) => {
  db.markAllNotificationsRead(req.user.id);
  res.json({ ok: true, unreadCount: 0 });
});

const STAGE_ORDER = ['discover', 'fundamentals', 'coding', 'courses', 'books', 'practice', 'contribute'];
const STAGE_LABELS = {
  discover: 'اكتشف التخصص',
  fundamentals: 'أساسيات HCI',
  coding: 'ترميز HTML & CSS',
  courses: 'دورات متخصصة',
  books: 'كتب ومراجع',
  practice: 'تعلّم بالمرح',
  contribute: 'أفد غيرك'
};

function journeyStopPoint(journey) {
  const done = (journey && journey.done) || {};
  const visited = (journey && journey.visited) || {};
  for (const id of STAGE_ORDER) {
    if (!done[id]) {
      if (visited[id]) return { id, label: STAGE_LABELS[id], status: 'in_progress' };
      return { id, label: STAGE_LABELS[id], status: 'next' };
    }
  }
  return { id: 'done', label: 'أكمل الرحلة', status: 'completed' };
}

function parseJsonSafe(raw, fallback) {
  try { return JSON.parse(raw || '') || fallback; } catch { return fallback; }
}

/* ---------- لوحة الإدارة ---------- */
app.get('/api/admin/attention', adminRequired, (_req, res) => {
  const articles = db.countPendingCommunityArticles();
  const contacts = db.countContacts();
  const reports = db.countReports();
  const interests = db.countNewOfferInterests();
  res.json({
    articles,
    contacts,
    reports,
    interests,
    total: articles + contacts + reports + interests
  });
});

app.get('/api/admin/stats', adminRequired, (req, res) => {
  const students = db.getUsers().filter((u) => u.role === 'student');
  const missMap = {};
  let quizAttempts = 0;
  let quizPasses = 0;
  let pathCompleted = 0;
  let startedPath = 0;
  let newThisWeek = 0;
  let stalled = 0;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const stageFunnel = {};
  STAGE_ORDER.forEach((id) => { stageFunnel[id] = 0; });
  const stopBuckets = {};

  students.forEach((u) => {
    if (u.created_at && new Date(u.created_at).getTime() >= weekAgo) newThisWeek += 1;
    const p = db.getProgress(u.id);
    const journey = parseJsonSafe(p && p.journey_json, {});
    const quiz = parseJsonSafe(p && p.quiz_json, {});
    const done = journey.done || {};
    const doneCount = Object.keys(done).filter((k) => done[k]).length;
    if (doneCount > 0) startedPath += 1;
    if (STAGE_ORDER.every((id) => !!done[id])) pathCompleted += 1;
    STAGE_ORDER.forEach((id) => {
      if (done[id]) stageFunnel[id] += 1;
    });
    const stop = journeyStopPoint(journey);
    const stopKey = stop.label || 'لم يبدأ';
    stopBuckets[stopKey] = (stopBuckets[stopKey] || 0) + 1;
    const last = u.last_login ? new Date(u.last_login).getTime() : 0;
    if (doneCount > 0 && (!last || last < twoWeeksAgo)) stalled += 1;

    const fund = quiz.fundamentals;
    if (!fund) return;
    quizAttempts += 1;
    if (fund.passed) quizPasses += 1;
    (fund.answers || []).forEach((a) => {
      if (!a) return;
      const key = a.qid || a.id || a.title || 'unknown';
      if (!missMap[key]) {
        missMap[key] = { qid: key, title: a.title || key, wrong: 0, total: 0 };
      }
      missMap[key].total += 1;
      if (!a.ok) missMap[key].wrong += 1;
    });
  });

  const mostMissed = Object.values(missMap)
    .filter((q) => q.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong)[0] || null;

  const recentLogins = students
    .filter((u) => u.last_login)
    .sort((a, b) => (a.last_login < b.last_login ? 1 : -1))
    .slice(0, 8)
    .map((u) => ({
      id: u.id,
      name: u.first_name + ' ' + u.last_name,
      lastLogin: u.last_login
    }));

  const articlesPending = db.countPendingCommunityArticles();
  const contacts = db.countContacts();
  const reports = db.countReports();
  const interests = db.countNewOfferInterests();

  res.json({
    students: db.countStudents(),
    admins: db.countAdmins(),
    messages: db.countMessages(),
    reports,
    contacts,
    articlesPending,
    articlesPublished: db.countApprovedCommunityArticles(),
    certificates: db.countCertificates(),
    offersPublished: db.getOffers({ status: 'published' }).length,
    offerInterestsNew: interests,
    partners: db.getPartners().length,
    activeWeek: db.countActiveWeek(),
    newThisWeek,
    startedPath,
    pathCompleted,
    stalled,
    quizAttempts,
    quizPasses,
    stageFunnel,
    stopBuckets,
    mostMissed,
    recentLogins,
    attention: {
      articles: articlesPending,
      contacts,
      reports,
      interests,
      total: articlesPending + contacts + reports + interests
    },
    generatedAt: new Date().toISOString()
  });
});

/* ---------- مقالات المتعلمين (مسودة، ثم مراجعة المشرف بعد إكمال المسار) ---------- */
function sanitizeArticleText(s, max) {
  return String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max);
}

function userJourneyComplete(userId) {
  const user = db.findUserById(userId);
  if (user && (user.role === 'admin' || user.path_type === 'specialist')) return true;
  const { pct, journey } = computeProgressPercent(userId);
  if (pct >= 100) return true;
  const done = (journey && journey.done) || {};
  return STAGE_ORDER.every((id) => !!done[id]);
}

function articleAuthorName(user) {
  return (user.first_name + (user.last_name ? ' ' + user.last_name : '')).trim() || 'متعلم HCI';
}

function notifyAdminArticlePending(row, authorName) {
  const admin = db.findAdmin();
  if (!admin) return;
  db.createNotification({
    userId: admin.id,
    type: 'article_pending',
    title: 'مقال جديد بانتظار موافقتك',
    body: authorName + ': «' + row.title + '»',
    link: 'admin.html#articles',
    refId: row.id
  });
}

app.get('/api/articles/published', (_req, res) => {
  try {
    const list = db.getCommunityArticles({ status: 'approved' }).map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      authorName: a.author_name,
      publishedAt: a.published_at || a.reviewed_at || a.created_at
    }));
    res.json({ articles: list });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'تعذر جلب المقالات' });
  }
});

app.get('/api/articles/published/:id', (req, res) => {
  try {
    const a = db.getCommunityArticleById(req.params.id);
    if (!a || a.status !== 'approved') {
      return res.status(404).json({ error: 'المقال غير متاح' });
    }
    res.json({
      article: {
        id: a.id,
        title: a.title,
        body: a.body,
        authorName: a.author_name,
        publishedAt: a.published_at || a.reviewed_at || a.created_at
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'تعذر جلب المقال' });
  }
});

app.get('/api/articles/mine', authRequired, (req, res) => {
  try {
    const list = db.getCommunityArticles({ userId: req.user.id }).map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      status: a.status,
      rejectReason: a.reject_reason || '',
      createdAt: a.created_at,
      updatedAt: a.updated_at || a.created_at,
      publishedAt: a.published_at
    }));
    res.json({
      articles: list,
      canSubmit: userJourneyComplete(req.user.id),
      pathComplete: userJourneyComplete(req.user.id)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'تعذر جلب مقالاتك' });
  }
});

app.post('/api/articles', authRequired, (req, res) => {
  try {
    const asDraft = !!req.body.asDraft || req.body.status === 'draft';
    const title = sanitizeArticleText(req.body.title, 120);
    const body = sanitizeArticleText(req.body.body, 8000);
    if (asDraft) {
      if (title.length < 3 && body.length < 20) {
        return res.status(400).json({ error: 'اكتب عنواناً أو بضعة أسطر قبل حفظ المسودة' });
      }
      const drafts = db.getCommunityArticles({ userId: req.user.id, status: 'draft' });
      if (drafts.length >= 3) {
        return res.status(400).json({ error: 'عندك ٣ مسودات — عدّل واحدة منها أو أرسلها للمراجعة' });
      }
      const authorName = articleAuthorName(req.user);
      const row = db.createCommunityArticle({
        userId: req.user.id,
        title: title || 'مسودة بلا عنوان',
        body,
        authorName,
        status: 'draft'
      });
      return res.status(201).json({ ok: true, id: row.id, status: row.status });
    }

    if (!userJourneyComplete(req.user.id)) {
      return res.status(403).json({
        error: 'تقدر تحفظ مسودة الآن. إرسال المقال للمراجعة يفتح بعد إكمال كل دروس المسار.'
      });
    }
    if (title.length < 8) {
      return res.status(400).json({ error: 'عنوان المقال قصير جداً (٨ أحرف على الأقل)' });
    }
    if (body.length < 120) {
      return res.status(400).json({ error: 'نص المقال قصير جداً — اكتب شرحاً أوضح (١٢٠ حرفاً على الأقل)' });
    }
    const pending = db.getCommunityArticles({ userId: req.user.id, status: 'pending' });
    if (pending.length >= 3) {
      return res.status(400).json({ error: 'عندك ٣ مقالات بانتظار المراجعة — انتظر الرد قبل إرسال المزيد' });
    }
    const authorName = articleAuthorName(req.user);
    const row = db.createCommunityArticle({
      userId: req.user.id,
      title,
      body,
      authorName,
      status: 'pending'
    });
    notifyAdminArticlePending(row, authorName);
    res.status(201).json({ ok: true, id: row.id, status: row.status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'تعذر إرسال المقال' });
  }
});

app.put('/api/articles/:id', authRequired, (req, res) => {
  try {
    const title = sanitizeArticleText(req.body.title, 120);
    const body = sanitizeArticleText(req.body.body, 8000);
    if (title.length < 3 && body.length < 20) {
      return res.status(400).json({ error: 'اكتب عنواناً أو بضعة أسطر قبل حفظ المسودة' });
    }
    const row = db.updateCommunityArticle(req.params.id, {
      userId: req.user.id,
      title: title || 'مسودة بلا عنوان',
      body
    });
    if (!row) {
      return res.status(404).json({ error: 'ما قدرت تعدّل هالمسودة (أو إنها تحت المراجعة)' });
    }
    res.json({ ok: true, id: row.id, status: row.status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'تعذر حفظ المسودة' });
  }
});

app.post('/api/articles/:id/submit', authRequired, (req, res) => {
  try {
    if (!userJourneyComplete(req.user.id)) {
      return res.status(403).json({
        error: 'كمّل كل دروس المسار أولاً — بعدها تقدر ترسل مقالك للمراجعة والنشر.'
      });
    }
    const existing = db.getCommunityArticleById(req.params.id);
    if (!existing || Number(existing.user_id) !== Number(req.user.id)) {
      return res.status(404).json({ error: 'المقال غير موجود' });
    }
    const title = sanitizeArticleText(req.body.title != null ? req.body.title : existing.title, 120);
    const body = sanitizeArticleText(req.body.body != null ? req.body.body : existing.body, 8000);
    if (title.length < 8) {
      return res.status(400).json({ error: 'عنوان المقال قصير جداً (٨ أحرف على الأقل)' });
    }
    if (body.length < 120) {
      return res.status(400).json({ error: 'نص المقال قصير جداً — اكتب شرحاً أوضح (١٢٠ حرفاً على الأقل)' });
    }
    const pending = db.getCommunityArticles({ userId: req.user.id, status: 'pending' });
    if (pending.length >= 3) {
      return res.status(400).json({ error: 'عندك ٣ مقالات بانتظار المراجعة — انتظر الرد قبل إرسال المزيد' });
    }
    db.updateCommunityArticle(req.params.id, {
      userId: req.user.id,
      title,
      body
    });
    const row = db.submitCommunityArticle(req.params.id, { userId: req.user.id });
    if (!row) {
      return res.status(400).json({ error: 'ما قدرت ترسل هالمقال للمراجعة' });
    }
    notifyAdminArticlePending(row, row.author_name || articleAuthorName(req.user));
    res.json({ ok: true, id: row.id, status: row.status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'تعذر إرسال المقال للمراجعة' });
  }
});

app.get('/api/admin/articles', adminRequired, (_req, res) => {
  try {
    const list = db.getCommunityArticles({ excludeStatus: 'draft' }).map((a) => {
      const u = db.findUserById(a.user_id);
      return {
        id: a.id,
        title: a.title,
        body: a.body,
        authorName: a.author_name,
        userId: a.user_id,
        userEmail: u ? (u.email || u.phone || '') : '',
        status: a.status,
        rejectReason: a.reject_reason || '',
        createdAt: a.created_at,
        reviewedAt: a.reviewed_at,
        publishedAt: a.published_at
      };
    });
    res.json({ articles: list, pending: db.countPendingCommunityArticles() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'تعذر جلب المقالات' });
  }
});

app.post('/api/admin/articles/:id/approve', adminRequired, (req, res) => {
  try {
    const row = db.reviewCommunityArticle(req.params.id, { status: 'approved' });
    if (!row) return res.status(404).json({ error: 'المقال غير موجود' });
    db.createNotification({
      userId: row.user_id,
      type: 'article_approved',
      title: 'نُشر مقالك',
      body: 'وافقت على مقالك «' + row.title + '» وهو ظاهر الآن للجميع.',
      link: 'community-article.html?id=' + row.id,
      refId: row.id
    });
    res.json({ ok: true, article: { id: row.id, status: row.status } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'تعذر قبول المقال' });
  }
});

app.post('/api/admin/articles/:id/reject', adminRequired, (req, res) => {
  try {
    const reason = sanitizeArticleText(req.body.reason, 400);
    const row = db.reviewCommunityArticle(req.params.id, {
      status: 'rejected',
      rejectReason: reason || 'لم يُقبل للنشر في شكله الحالي.'
    });
    if (!row) return res.status(404).json({ error: 'المقال غير موجود' });
    db.createNotification({
      userId: row.user_id,
      type: 'article_rejected',
      title: 'لم يُنشر مقالك',
      body: 'مقالك «' + row.title + '»: ' + (row.reject_reason || 'لم يُقبل.'),
      link: 'write-article.html',
      refId: row.id
    });
    res.json({ ok: true, article: { id: row.id, status: row.status } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'تعذر رفض المقال' });
  }
});

/* ---------- تواصل مع المُعِد (عروض / وظائف / رسالة عامة) ---------- */
app.post('/api/contact', (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    if (message.length < 5) {
      return res.status(400).json({ error: 'اكتب رسالتك بوضوح (٥ أحرف على الأقل)' });
    }

    let userId = null;
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      try {
        userId = jwt.verify(token, JWT_SECRET).id;
      } catch { /* زائر */ }
    }

    const row = db.createContact({
      userId,
      name: String(req.body.name || '').trim(),
      contact: String(req.body.contact || '').trim(),
      message
    });

    res.status(201).json({ ok: true, id: row.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'تعذر إرسال الرسالة' });
  }
});

app.get('/api/admin/contacts', adminRequired, (req, res) => {
  res.json({
    contacts: db.getContacts().map((c) => {
      const u = c.user_id ? db.findUserById(c.user_id) : null;
      let linkedUserId = c.user_id || null;
      if (!linkedUserId && c.contact) {
        const match = db.findUserByIdentifier(c.contact);
        if (match) linkedUserId = match.id;
      }
      return {
        id: c.id,
        name: c.name || (u ? u.first_name + ' ' + u.last_name : 'زائر'),
        contact: c.contact || (u ? (u.email || u.phone || '') : ''),
        message: c.message,
        status: c.status,
        reply: c.reply || '',
        repliedAt: c.replied_at || null,
        userId: linkedUserId,
        canNotify: !!linkedUserId,
        createdAt: c.created_at,
        doneAt: c.done_at || null
      };
    })
  });
});

app.post('/api/admin/contacts/:id/reply', adminRequired, (req, res) => {
  const reply = String(req.body.reply || '').trim();
  if (reply.length < 2) {
    return res.status(400).json({ error: 'اكتب الرد (حرفين على الأقل)' });
  }

  const existing = db.getContacts().find((c) => c.id === Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'الرسالة غير موجودة' });

  let userId = existing.user_id || null;
  if (!userId && existing.contact) {
    const match = db.findUserByIdentifier(existing.contact);
    if (match) userId = match.id;
  }

  const row = db.replyContact(req.params.id, reply);
  if (!row) return res.status(404).json({ error: 'الرسالة غير موجودة' });

  let notified = false;
  if (userId) {
    db.createNotification({
      userId,
      type: 'contact_reply',
      title: 'رد على رسالتك',
      body: reply.length > 200 ? reply.slice(0, 200) + '…' : reply,
      link: 'profile.html#inbox',
      refId: row.id
    });
    notified = true;
  }

  res.json({ ok: true, notified, reply: row.reply });
});

app.patch('/api/admin/contacts/:id/done', adminRequired, (req, res) => {
  const row = db.markContactDone(req.params.id);
  if (!row) return res.status(404).json({ error: 'الرسالة غير موجودة' });
  res.json({ ok: true });
});

app.delete('/api/admin/contacts/:id', adminRequired, (req, res) => {
  const ok = db.deleteContact(req.params.id);
  if (!ok) return res.status(404).json({ error: 'الرسالة غير موجودة' });
  res.json({ ok: true });
});

/* ---------- بلاغات المشاكل (من أي زائر أو طالب) ---------- */
app.post('/api/reports', (req, res) => {
  upload.single('media')(req, res, function (err) {
    if (err) {
      return res.status(400).json({ error: err.message || 'تعذر رفع الملف' });
    }

    try {
      const message = String(req.body.message || '').trim();
      if (message.length < 5) {
        if (req.file) fs.unlink(req.file.path, function () {});
        return res.status(400).json({ error: 'اكتب وصف المشكلة بوضوح (٥ أحرف على الأقل)' });
      }

      let userId = null;
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (token) {
        try {
          userId = jwt.verify(token, JWT_SECRET).id;
        } catch { /* زائر */ }
      }

      let mediaPath = null;
      let mediaType = null;
      let mediaName = null;
      if (req.file) {
        mediaPath = '/uploads/' + req.file.filename;
        mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
        mediaName = req.file.originalname || req.file.filename;
      }

      const report = db.createReport({
        userId,
        name: String(req.body.name || '').trim(),
        contact: String(req.body.contact || '').trim(),
        message,
        page: String(req.body.page || '').trim(),
        mediaPath,
        mediaType,
        mediaName
      });

      if (userId) {
        db.createNotification({
          userId,
          type: 'report_sent',
          title: 'تم استلام بلاغك',
          body: 'وصلنا بلاغك وسنراجعه قريباً.' + (message.length > 80 ? '' : ' — «' + message.slice(0, 80) + '»'),
          link: 'profile.html#inbox',
          refId: report.id
        });
      }

      res.status(201).json({ ok: true, id: report.id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'تعذر إرسال البلاغ' });
    }
  });
});

app.get('/api/admin/reports', adminRequired, (req, res) => {
  res.json({
    reports: db.getReports().map((r) => {
      const u = r.user_id ? db.findUserById(r.user_id) : null;
      return {
        id: r.id,
        name: r.name || (u ? u.first_name + ' ' + u.last_name : 'زائر'),
        contact: r.contact || (u ? (u.email || u.phone || '') : ''),
        message: r.message,
        page: r.page,
        status: r.status,
        createdAt: r.created_at,
        userId: r.user_id,
        mediaPath: r.media_path || null,
        mediaType: r.media_type || null,
        mediaName: r.media_name || null
      };
    })
  });
});

app.patch('/api/admin/reports/:id/done', adminRequired, (req, res) => {
  const r = db.markReportDone(req.params.id);
  if (!r) return res.status(404).json({ error: 'البلاغ غير موجود' });
  if (r.user_id) {
    db.createNotification({
      userId: r.user_id,
      type: 'report_done',
      title: 'تم إصلاح بلاغك',
      body: 'بلاغك رقم #' + r.id + ' تم التعامل معه وإصلاحه. شكراً لمساعدتك في تحسين المنصة.',
      link: 'profile.html#inbox',
      refId: r.id
    });
  }
  res.json({ ok: true });
});

app.get('/api/admin/users', adminRequired, (req, res) => {
  const students = db.getUsers().filter((u) => u.role === 'student');
  students.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  res.json({
    users: students.map((u) => {
      const p = db.getProgress(u.id);
      const journey = parseJsonSafe(p && p.journey_json, {});
      const quiz = parseJsonSafe(p && p.quiz_json, {});
      const done = journey.done || {};
      const doneCount = Object.keys(done).filter((k) => done[k]).length;
      const stop = journeyStopPoint(journey);
      const fund = quiz.fundamentals || null;
      const cert = db.getCertificateByUserId(u.id);
      return {
        ...publicUser(u),
        notes: u.notes || '',
        passwordStatus: 'مشفّرة (bcrypt)',
        passwordStored: !!u.password_hash,
        nameChanged: Array.isArray(u.name_history) && u.name_history.length > 0,
        lastNameChange: Array.isArray(u.name_history) && u.name_history[0]
          ? u.name_history[0].changed_at
          : null,
        progressPercent: Math.round((doneCount / 7) * 100),
        doneStages: doneCount,
        progressUpdated: p ? p.updated_at : null,
        stopPoint: stop.label,
        stopStatus: stop.status,
        stopId: stop.id,
        quizPassed: fund ? !!fund.passed : null,
        quizScore: fund ? (fund.score + '/' + fund.total) : null,
        quizCorrect: fund ? Number(fund.score || 0) : null,
        quizWrong: fund ? Math.max(0, Number(fund.total || 0) - Number(fund.score || 0)) : null,
        createdAt: u.created_at,
        lastLogin: u.last_login,
        certificateId: cert ? cert.id : null,
        certificateIssuedAt: cert ? cert.issued_at : null
      };
    })
  });
});

app.get('/api/admin/users/:id', adminRequired, (req, res) => {
  const u = db.findUserById(req.params.id);
  if (!u) return res.status(404).json({ error: 'غير موجود' });

  const p = db.getProgress(u.id);
  const msgs = db.getMessagesForUser(u.id);

  const cert = db.getCertificateByUserId(u.id);
  res.json({
    user: {
      ...publicUser(u),
      notes: u.notes || '',
      nameHistory: nameHistoryPublic(u),
      // كلمات المرور مشفّرة (bcrypt) ولا يمكن استرجاع النص الأصلي أبداً — هذا متعمد للأمان
      passwordStored: !!u.password_hash,
      passwordAlgo: 'bcrypt',
      passwordStatus: 'مشفّرة (لا تُعرض كنص)',
      passwordHint: 'كلمة المرور محفوظة بشكل مشفّر ولا تُعرض كنص. استخدم «إعادة تعيين» لوضع كلمة جديدة.',
      certificateId: cert ? cert.id : null,
      certificateIssuedAt: cert ? cert.issued_at : null,
      certificateName: cert ? cert.name : null,
      certificatePath: cert ? cert.path : null
    },
    progress: p ? {
      journey: JSON.parse(p.journey_json || '{}'),
      coding: JSON.parse(p.coding_json || '{}'),
      codingStage: p.coding_stage,
      practice: JSON.parse(p.practice_json || '{}'),
      courses: JSON.parse(p.courses_json || '{}'),
      books: JSON.parse(p.books_json || '{}'),
      quiz: JSON.parse(p.quiz_json || '{}'),
      updatedAt: p.updated_at
    } : null,
    messages: msgs
  });
});

app.patch('/api/admin/users/:id', adminRequired, (req, res) => {
  const u = db.findUserById(req.params.id);
  if (!u) return res.status(404).json({ error: 'غير موجود' });

  if (typeof req.body.notes === 'string') {
    db.updateUser(u.id, { notes: req.body.notes });
  }

  const updated = db.findUserById(u.id);
  res.json({ user: { ...publicUser(updated), notes: updated.notes || '' } });
});

/* المدير يعيد تعيين كلمة مرور أي طالب */
app.post('/api/admin/users/:id/reset-password', adminRequired, (req, res) => {
  const u = db.findUserById(req.params.id);
  if (!u) return res.status(404).json({ error: 'غير موجود' });
  if (u.role === 'admin') {
    return res.status(400).json({ error: 'لا يُعاد تعيين كلمة مرور المدير من هنا' });
  }

  const newPassword = String(req.body.newPassword || '');
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'كلمة المرور الجديدة لازم 8 أحرف على الأقل' });
  }

  db.setPassword(u.id, bcrypt.hashSync(newPassword, 10));
  res.json({
    ok: true,
    message: 'تم تعيين كلمة المرور الجديدة. أعطِها للطالب بأمان.',
    temporaryPassword: newPassword
  });
});

app.delete('/api/admin/users/:id', adminRequired, (req, res) => {
  const u = db.findUserById(req.params.id);
  if (!u) return res.status(404).json({ error: 'غير موجود' });
  if (u.role === 'admin') return res.status(400).json({ error: 'لا يمكن حذف حساب مدير' });
  if (u.is_preview) return res.status(400).json({ error: 'لا يمكن حذف حساب المعاينة' });

  db.deleteUser(u.id);
  res.json({ ok: true });
});

app.post('/api/admin/message', adminRequired, (req, res) => {
  const userId = Number(req.body.userId);
  const subject = String(req.body.subject || '').trim();
  const body = String(req.body.body || '').trim();

  if (!userId || !subject || !body) {
    return res.status(400).json({ error: 'المستخدم والموضوع والرسالة مطلوبة' });
  }

  const target = db.findUserById(userId);
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' });

  const msg = db.createMessage({
    adminId: req.user.id,
    userId,
    subject,
    body
  });

  db.createNotification({
    userId,
    type: 'admin_message',
    title: subject,
    body: body.length > 160 ? body.slice(0, 160) + '…' : body,
    link: 'profile.html#inbox',
    refId: msg.id
  });

  res.status(201).json({ id: msg.id, ok: true });
});

/* ---------- شركاء وعروض تدريب (إدارة عالية) ---------- */
function publicOffer(o) {
  const partner = o.partner_id ? db.getPartnerById(o.partner_id) : null;
  return {
    id: o.id,
    title: o.title,
    summary: o.summary,
    companyName: o.company_name || (partner ? partner.name : ''),
    link: o.link,
    mode: o.mode,
    city: o.city,
    status: o.status,
    partnerId: o.partner_id,
    publishedAt: o.published_at,
    createdAt: o.created_at
  };
}

app.get('/api/offers', (_req, res) => {
  try {
    const list = db.getOffers({ status: 'published' }).map(publicOffer);
    res.json({ offers: list });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'تعذر جلب العروض' });
  }
});

app.post('/api/offers/:id/interest', authRequired, (req, res) => {
  try {
    const offer = db.getOfferById(req.params.id);
    if (!offer || offer.status !== 'published') {
      return res.status(404).json({ error: 'العرض غير متاح' });
    }
    const name = (req.user.first_name + (req.user.last_name ? ' ' + req.user.last_name : '')).trim();
    const contact = req.user.email || req.user.phone || '';
    const note = sanitizeArticleText(req.body.note, 400);
    const row = db.createOfferInterest({
      offerId: offer.id,
      userId: req.user.id,
      name,
      contact,
      note
    });
    const admin = db.findAdmin();
    if (admin) {
      db.createNotification({
        userId: admin.id,
        type: 'offer_interest',
        title: 'اهتمام بعرض تدريب',
        body: name + ' مهتم بـ «' + offer.title + '»',
        link: 'admin.html#offers',
        refId: row.id
      });
    }
    res.status(201).json({ ok: true, id: row.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'تعذر تسجيل الاهتمام' });
  }
});

app.get('/api/admin/partners', adminRequired, (_req, res) => {
  res.json({
    partners: db.getPartners().map((p) => ({
      id: p.id,
      name: p.name,
      contactName: p.contact_name,
      email: p.email,
      phone: p.phone,
      website: p.website,
      notes: p.notes,
      createdAt: p.created_at
    }))
  });
});

app.post('/api/admin/partners', adminRequired, (req, res) => {
  const name = sanitizeArticleText(req.body.name, 120);
  if (name.length < 2) return res.status(400).json({ error: 'اسم الشركة مطلوب' });
  const row = db.createPartner({
    name,
    contactName: sanitizeArticleText(req.body.contactName, 80),
    email: sanitizeArticleText(req.body.email, 120),
    phone: sanitizeArticleText(req.body.phone, 40),
    website: sanitizeArticleText(req.body.website, 200),
    notes: sanitizeArticleText(req.body.notes, 800)
  });
  res.status(201).json({ ok: true, partner: { id: row.id, name: row.name } });
});

app.patch('/api/admin/partners/:id', adminRequired, (req, res) => {
  const row = db.updatePartner(req.params.id, {
    name: req.body.name != null ? sanitizeArticleText(req.body.name, 120) : undefined,
    contactName: req.body.contactName != null ? sanitizeArticleText(req.body.contactName, 80) : undefined,
    email: req.body.email != null ? sanitizeArticleText(req.body.email, 120) : undefined,
    phone: req.body.phone != null ? sanitizeArticleText(req.body.phone, 40) : undefined,
    website: req.body.website != null ? sanitizeArticleText(req.body.website, 200) : undefined,
    notes: req.body.notes != null ? sanitizeArticleText(req.body.notes, 800) : undefined
  });
  if (!row) return res.status(404).json({ error: 'الشريك غير موجود' });
  res.json({ ok: true });
});

app.delete('/api/admin/partners/:id', adminRequired, (req, res) => {
  const ok = db.deletePartner(req.params.id);
  if (!ok) return res.status(404).json({ error: 'الشريك غير موجود' });
  res.json({ ok: true });
});

app.get('/api/admin/offers', adminRequired, (_req, res) => {
  const interests = db.getOfferInterests();
  res.json({
    offers: db.getOffers().map((o) => {
      const pub = publicOffer(o);
      pub.interestCount = interests.filter((i) => i.offer_id === o.id).length;
      pub.newInterests = interests.filter((i) => i.offer_id === o.id && i.status === 'new').length;
      return pub;
    }),
    interests: interests.map((i) => {
      const offer = db.getOfferById(i.offer_id);
      const u = db.findUserById(i.user_id);
      return {
        id: i.id,
        offerId: i.offer_id,
        offerTitle: offer ? offer.title : '—',
        userId: i.user_id,
        name: i.name || (u ? u.first_name + ' ' + u.last_name : '—'),
        contact: i.contact || (u ? (u.email || u.phone || '') : ''),
        note: i.note || '',
        status: i.status,
        createdAt: i.created_at
      };
    }),
    partners: db.getPartners().map((p) => ({ id: p.id, name: p.name }))
  });
});

app.post('/api/admin/offers', adminRequired, (req, res) => {
  const title = sanitizeArticleText(req.body.title, 140);
  const companyName = sanitizeArticleText(req.body.companyName, 120);
  const summary = sanitizeArticleText(req.body.summary, 1200);
  if (title.length < 4) return res.status(400).json({ error: 'عنوان العرض قصير' });
  if (companyName.length < 2) return res.status(400).json({ error: 'اسم الشركة مطلوب' });
  if (summary.length < 20) return res.status(400).json({ error: 'اكتب وصفاً أوضح للعرض' });
  const status = req.body.publish ? 'published' : 'draft';
  const row = db.createOffer({
    partnerId: req.body.partnerId || null,
    companyName,
    title,
    summary,
    link: sanitizeArticleText(req.body.link, 400),
    mode: ['online', 'onsite', 'hybrid'].indexOf(req.body.mode) !== -1 ? req.body.mode : 'online',
    city: sanitizeArticleText(req.body.city, 80),
    status
  });
  if (status === 'published' && req.body.notifyStudents) {
    const students = db.getUsers().filter((u) => u.role === 'student');
    students.forEach((u) => {
      db.createNotification({
        userId: u.id,
        type: 'offer_new',
        title: 'عرض تدريب جديد',
        body: companyName + ': «' + title + '»',
        link: 'courses.html#offers',
        refId: row.id
      });
    });
  }
  res.status(201).json({ ok: true, offer: publicOffer(row) });
});

app.patch('/api/admin/offers/:id', adminRequired, (req, res) => {
  const existing = db.getOfferById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'العرض غير موجود' });
  const wasPublished = existing.status === 'published';
  const row = db.updateOffer(req.params.id, {
    partnerId: req.body.partnerId !== undefined ? req.body.partnerId : undefined,
    companyName: req.body.companyName != null ? sanitizeArticleText(req.body.companyName, 120) : undefined,
    title: req.body.title != null ? sanitizeArticleText(req.body.title, 140) : undefined,
    summary: req.body.summary != null ? sanitizeArticleText(req.body.summary, 1200) : undefined,
    link: req.body.link != null ? sanitizeArticleText(req.body.link, 400) : undefined,
    mode: req.body.mode,
    city: req.body.city != null ? sanitizeArticleText(req.body.city, 80) : undefined,
    status: req.body.status
  });
  if (!wasPublished && row.status === 'published' && req.body.notifyStudents) {
    const students = db.getUsers().filter((u) => u.role === 'student');
    students.forEach((u) => {
      db.createNotification({
        userId: u.id,
        type: 'offer_new',
        title: 'عرض تدريب جديد',
        body: row.company_name + ': «' + row.title + '»',
        link: 'courses.html#offers',
        refId: row.id
      });
    });
  }
  res.json({ ok: true, offer: publicOffer(row) });
});

app.delete('/api/admin/offers/:id', adminRequired, (req, res) => {
  const ok = db.deleteOffer(req.params.id);
  if (!ok) return res.status(404).json({ error: 'العرض غير موجود' });
  res.json({ ok: true });
});

app.patch('/api/admin/offer-interests/:id', adminRequired, (req, res) => {
  const row = db.updateOfferInterest(req.params.id, { status: req.body.status });
  if (!row) return res.status(404).json({ error: 'الاهتمام غير موجود' });
  res.json({ ok: true, status: row.status });
});

app.post('/api/admin/broadcast', adminRequired, (req, res) => {
  try {
    const subject = String(req.body.subject || '').trim();
    const body = String(req.body.body || '').trim();
    if (!subject || !body) {
      return res.status(400).json({ error: 'الموضوع ونص الرسالة مطلوبان' });
    }
    const students = db.getUsers().filter((u) => u.role === 'student');
    let sent = 0;
    students.forEach((u) => {
      const msg = db.createMessage({
        adminId: req.user.id,
        userId: u.id,
        subject,
        body
      });
      db.createNotification({
        userId: u.id,
        type: 'admin_message',
        title: subject,
        body: body.length > 160 ? body.slice(0, 160) + '…' : body,
        link: 'profile.html#inbox',
        refId: msg.id
      });
      sent += 1;
    });
    res.status(201).json({ ok: true, sent });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'تعذر إرسال الرسالة للجميع' });
  }
});

app.post('/api/admin/announce', adminRequired, (req, res) => {
  try {
    const title = String(req.body.title || req.body.subject || '').trim();
    const body = String(req.body.body || '').trim();
    const link = String(req.body.link || 'index.html').trim() || 'index.html';
    if (!title || !body) {
      return res.status(400).json({ error: 'العنوان والنص مطلوبان' });
    }
    let sent = 0;
    db.getUsers().filter((u) => u.role === 'student').forEach((u) => {
      const prefs = defaultNotifPrefs(u);
      if (!prefs.inApp || !prefs.updates) return;
      db.createNotification({
        userId: u.id,
        type: 'site_update',
        title,
        body: body.length > 220 ? body.slice(0, 220) + '…' : body,
        link
      });
      sent += 1;
    });
    res.status(201).json({ ok: true, sent });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'تعذر إرسال إعلان التحديث' });
  }
});

app.post('/api/admin/nudge-stalled', adminRequired, (req, res) => {
  try {
    let sent = 0;
    db.getUsers().filter((u) => u.role === 'student').forEach((u) => {
      if (maybeNudgeStalledUser(u, { force: true })) sent += 1;
    });
    res.json({ ok: true, sent });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'تعذر إرسال تذكير المتوقفين' });
  }
});

app.get('/api/admin/feedback', adminRequired, (_req, res) => {
  const rows = db.getAllFeedback();
  const avg = rows.length
    ? Math.round((rows.reduce((s, r) => s + Number(r.rating || 0), 0) / rows.length) * 10) / 10
    : null;
  res.json({
    avgRating: avg,
    count: rows.length,
    feedback: rows.slice(0, 50).map((f) => {
      const u = db.findUserById(f.user_id);
      return {
        id: f.id,
        rating: f.rating,
        comment: f.comment,
        createdAt: f.created_at,
        userName: u ? (u.first_name + ' ' + u.last_name).trim() : '—'
      };
    })
  });
});

app.get('/api/admin/messages', adminRequired, (req, res) => {
  const rows = db.getAllMessages();
  res.json({
    messages: rows.map((m) => {
      const u = db.findUserById(m.user_id);
      return {
        id: m.id,
        subject: m.subject,
        body: m.body,
        createdAt: m.created_at,
        updatedAt: m.updated_at || null,
        read: !!m.read_by_user,
        user: u ? {
          id: u.id,
          name: u.first_name + ' ' + u.last_name,
          email: u.email,
          phone: u.phone
        } : null
      };
    })
  });
});

app.patch('/api/admin/messages/:id', adminRequired, (req, res) => {
  const subject = String(req.body.subject || '').trim();
  const body = String(req.body.body || '').trim();
  if (!subject || !body) {
    return res.status(400).json({ error: 'الموضوع ونص الرسالة مطلوبان' });
  }
  const msg = db.updateMessage(req.params.id, req.user.id, { subject, body });
  if (!msg) return res.status(404).json({ error: 'الرسالة غير موجودة أو ليست من حسابك' });
  res.json({
    ok: true,
    message: {
      id: msg.id,
      subject: msg.subject,
      body: msg.body,
      updatedAt: msg.updated_at
    }
  });
});

app.delete('/api/admin/messages/:id', adminRequired, (req, res) => {
  const ok = db.deleteMessage(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: 'الرسالة غير موجودة أو ليست من حسابك' });
  res.json({ ok: true });
});

ready.then(() => {
  const adminInfo = ensureAdmin();
  const previewInfo = ensurePreviewOwner();

  app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('  HCI Platform يعمل على:');
    console.log('  http://localhost:' + PORT);
    console.log('  لوحة الإدارة: http://localhost:' + PORT + '/admin.html');
    console.log('  حفظ البيانات: ' + (process.env.DATABASE_URL ? 'Postgres (دائم)' : 'ملف محلي'));
    console.log('');
    if (process.env.NODE_ENV !== 'production') {
      console.log('  حساب المدير:');
      console.log('  البريد: ' + adminInfo.email);
      console.log('  الجوال: ' + adminInfo.phone);
      console.log('  كلمة المرور: ' + adminInfo.password);
      console.log('');
      console.log('  حساب المعاينة (يفتح الرئيسية من الصفر):');
      console.log('  البريد: ' + previewInfo.email);
      console.log('  الجوال: ' + previewInfo.phone);
      console.log('  كلمة المرور: ' + previewInfo.password);
    } else {
      console.log('  حساب المدير والمعاينة: جاهزان (كلمات المرور لا تُطبع في الإنتاج).');
    }
    console.log('═══════════════════════════════════════');
    if (!process.env.JWT_SECRET) {
      console.warn('⚠️  JWT_SECRET غير معرّف في البيئة. محلياً يُستخدم سر تطوير، وفي الإنتاج يُولَّد سر دائم في مجلد البيانات.');
      console.warn('   للأمان الأوضح: أضف JWT_SECRET عشوائياً طويلاً في Render → Environment.');
    }
    console.log('');
  });
}).catch((err) => {
  console.error('فشل تشغيل HCI:', err);
  process.exit(1);
});
