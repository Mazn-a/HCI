/* سيرفر منصة HCI — مصادقة، تقدم، لوحة إدارة */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, ensureAdmin, checkPassword } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'hci-platform-secret-change-in-production-2026';

const uploadsDir = path.join(__dirname, 'data', 'uploads');
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

app.use(cors());
app.use(express.json({ limit: '1mb' }));

/* robots/sitemap دائماً 200 عشان قوقل ما يعتبر الموقع محظور */
app.get('/robots.txt', (_req, res) => {
  res.status(200);
  res.type('text/plain; charset=utf-8');
  res.set('Cache-Control', 'no-store');
  res.send(
    [
      'User-agent: *',
      'Allow: /',
      '',
      'User-agent: Googlebot',
      'Allow: /',
      '',
      'Sitemap: https://hci-72ms.onrender.com/sitemap.xml',
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

app.use('/uploads', express.static(uploadsDir));
app.use(express.static(__dirname));

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.first_name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'جلسة منتهية — سجّل دخولك من جديد' });
  }
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'صلاحية المدير فقط' });
    }
    next();
  });
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
    passwordChangedAt: row.password_changed_at || null,
    createdAt: row.created_at,
    lastLogin: row.last_login
  };
}

function resolveIdentifier(raw) {
  const value = String(raw || '').trim();
  if (!value) return { error: 'أدخل البريد أو رقم الجوال' };
  if (value.includes('@')) {
    const email = value.toLowerCase();
    if (!isValidEmail(email)) return { error: 'البريد الإلكتروني غير صحيح' };
    return { identifier: email, channel: 'email', email: email, phone: null };
  }
  const phone = normalizePhone(value);
  if (!isValidPhone(phone)) return { error: 'رقم الجوال غير صحيح' };
  return { identifier: phone, channel: 'phone', email: null, phone: phone };
}

function isValidEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function isValidPhone(v) {
  if (typeof v !== 'string') return false;
  const digits = v.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

function normalizePhone(v) {
  return String(v || '').replace(/\D/g, '');
}

/* ---------- تسجيل حساب ---------- */
app.post('/api/auth/register', (req, res) => {
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
    if (!email && !phone) {
      return res.status(400).json({ error: 'أدخل البريد الإلكتروني أو رقم الجوال' });
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'البريد الإلكتروني غير صحيح' });
    }
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ error: 'رقم الجوال غير صحيح (9–15 رقم)' });
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

    const user = db.createUser({
      firstName,
      lastName,
      email,
      phone: phone || null,
      passwordHash: bcrypt.hashSync(password, 10),
      role: 'student'
    });

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ أثناء إنشاء الحساب' });
  }
});

/* ---------- تسجيل دخول (بريد أو جوال) ---------- */
app.post('/api/auth/login', (req, res) => {
  try {
    const identifier = String(req.body.identifier || req.body.email || '').trim();
    const password = String(req.body.password || '');

    if (!identifier || !password) {
      return res.status(400).json({ error: 'أدخل البريد/الجوال وكلمة المرور' });
    }

    let user = null;
    if (identifier.includes('@')) {
      user = db.findUserByEmail(identifier);
    } else {
      user = db.findUserByPhone(normalizePhone(identifier));
    }

    if (!user || !checkPassword(user, password)) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    db.updateUser(user.id, { last_login: new Date().toISOString() });

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ أثناء تسجيل الدخول' });
  }
});

app.get('/api/auth/me', authRequired, (req, res) => {
  const user = db.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  res.json({ user: publicUser(user) });
});

/* ---------- طلب رمز تحقق (بريد أو جوال) ---------- */
app.post('/api/auth/request-otp', (req, res) => {
  try {
    const purpose = String(req.body.purpose || 'verify');
    if (purpose !== 'verify' && purpose !== 'reset') {
      return res.status(400).json({ error: 'غرض الرمز غير صالح' });
    }

    const resolved = resolveIdentifier(req.body.identifier);
    if (resolved.error) return res.status(400).json({ error: resolved.error });

    let user = db.findUserByIdentifier(req.body.identifier);

    if (purpose === 'reset') {
      if (!user) return res.status(404).json({ error: 'ما لقينا حساب بهالمعرف' });
    }

    if (purpose === 'verify' && req.headers.authorization) {
      try {
        const token = req.headers.authorization.slice(7);
        const payload = jwt.verify(token, JWT_SECRET);
        user = db.findUserById(payload.id) || user;
      } catch { /* جلسة اختيارية */ }
    }

    if (purpose === 'verify' && user) {
      if (resolved.channel === 'email' && user.email !== resolved.email) {
        return res.status(400).json({ error: 'البريد لا يطابق حسابك' });
      }
      if (resolved.channel === 'phone' && user.phone !== resolved.phone) {
        return res.status(400).json({ error: 'الجوال لا يطابق حسابك' });
      }
    }

    const { code } = db.createOtp({
      identifier: resolved.identifier,
      purpose,
      userId: user ? user.id : null,
      channel: resolved.channel
    });

    // بدون خدمة SMS/بريد خارجية: نُظهر الرمز مرة واحدة في الاستجابة للتجربة
    // لاحقاً يُستبدل بإرسال حقيقي للجوال أو البريد
    res.json({
      ok: true,
      channel: resolved.channel,
      message: resolved.channel === 'email'
        ? 'تم إنشاء رمز تحقق للبريد. أدخله خلال 10 دقائق.'
        : 'تم إنشاء رمز تحقق للجوال. أدخله خلال 10 دقائق.',
      demoCode: code,
      deliveryNote: 'حالياً يظهر الرمز هنا لأن خدمة الإرسال الخارجية غير مفعّلة بعد.'
    });
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
    if (req.headers.authorization) {
      try {
        const payload = jwt.verify(req.headers.authorization.slice(7), JWT_SECRET);
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
    res.json({ ok: true, user: publicUser(updated) });
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

  db.updateUser(user.id, { path_type: pathType });
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
  const row = db.getProgress(req.user.id);
  if (!row) {
    return res.json({
      journey: {}, coding: {}, codingStage: '',
      practice: {}, courses: {}, books: {}
    });
  }
  res.json({
    journey: JSON.parse(row.journey_json || '{}'),
    coding: JSON.parse(row.coding_json || '{}'),
    codingStage: row.coding_stage || '',
    practice: JSON.parse(row.practice_json || '{}'),
    courses: JSON.parse(row.courses_json || '{}'),
    books: JSON.parse(row.books_json || '{}'),
    updatedAt: row.updated_at
  });
});

app.put('/api/progress', authRequired, (req, res) => {
  try {
    db.upsertProgress(req.user.id, {
      journey_json: JSON.stringify(req.body.journey || {}),
      coding_json: JSON.stringify(req.body.coding || {}),
      coding_stage: String(req.body.codingStage || ''),
      practice_json: JSON.stringify(req.body.practice || {}),
      courses_json: JSON.stringify(req.body.courses || {}),
      books_json: JSON.stringify(req.body.books || {})
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'تعذر حفظ التقدم' });
  }
});

/* ---------- رسائل ---------- */
app.get('/api/messages', authRequired, (req, res) => {
  const rows = db.getMessagesForUser(req.user.id);
  res.json({
    messages: rows.map((m) => {
      const admin = db.findUserById(m.admin_id);
      return {
        id: m.id,
        subject: m.subject,
        body: m.body,
        createdAt: m.created_at,
        read: !!m.read_by_user,
        from: admin ? admin.first_name + ' ' + admin.last_name : 'الإدارة'
      };
    })
  });
});

app.post('/api/messages/:id/read', authRequired, (req, res) => {
  db.markMessageRead(req.params.id, req.user.id);
  res.json({ ok: true });
});

/* ---------- لوحة الإدارة ---------- */
app.get('/api/admin/stats', adminRequired, (req, res) => {
  res.json({
    students: db.countStudents(),
    admins: db.countAdmins(),
    messages: db.countMessages(),
    reports: db.countReports(),
    activeWeek: db.countActiveWeek()
  });
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
  res.json({ ok: true });
});

app.get('/api/admin/users', adminRequired, (req, res) => {
  const students = db.getUsers().filter((u) => u.role === 'student');
  students.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  res.json({
    users: students.map((u) => {
      const p = db.getProgress(u.id);
      let journey = {};
      try { journey = JSON.parse((p && p.journey_json) || '{}'); } catch { /* */ }
      const done = journey.done || {};
      const doneCount = Object.keys(done).filter((k) => done[k]).length;
      return {
        ...publicUser(u),
        notes: u.notes || '',
        progressPercent: Math.round((doneCount / 7) * 100),
        doneStages: doneCount,
        progressUpdated: p ? p.updated_at : null
      };
    })
  });
});

app.get('/api/admin/users/:id', adminRequired, (req, res) => {
  const u = db.findUserById(req.params.id);
  if (!u) return res.status(404).json({ error: 'غير موجود' });

  const p = db.getProgress(u.id);
  const msgs = db.getMessagesForUser(u.id);

  res.json({
    user: {
      ...publicUser(u),
      notes: u.notes || '',
      // كلمات المرور مشفّرة (bcrypt) ولا يمكن استرجاع النص الأصلي أبداً — هذا متعمد للأمان
      passwordStored: !!u.password_hash,
      passwordAlgo: 'bcrypt',
      passwordHint: 'كلمة المرور محفوظة بشكل مشفّر ولا تُعرض كنص. استخدم «إعادة تعيين» لوضع كلمة جديدة.'
    },
    progress: p ? {
      journey: JSON.parse(p.journey_json || '{}'),
      coding: JSON.parse(p.coding_json || '{}'),
      codingStage: p.coding_stage,
      practice: JSON.parse(p.practice_json || '{}'),
      courses: JSON.parse(p.courses_json || '{}'),
      books: JSON.parse(p.books_json || '{}'),
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

  res.status(201).json({ id: msg.id, ok: true });
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

const adminInfo = ensureAdmin();

app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  HCI Platform يعمل على:');
  console.log('  http://localhost:' + PORT);
  console.log('  لوحة الإدارة: http://localhost:' + PORT + '/admin.html');
  console.log('');
  console.log('  حساب المدير:');
  console.log('  البريد: ' + adminInfo.email);
  console.log('  الجوال: ' + adminInfo.phone);
  console.log('  كلمة المرور: ' + adminInfo.password);
  console.log('═══════════════════════════════════════');
  console.log('');
});
