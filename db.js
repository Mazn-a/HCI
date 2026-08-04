/* قاعدة بيانات JSON — محلياً ملف، وعلى Render تُحفظ في Postgres (دائمة) */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dataDir = process.env.HCI_DATA_DIR || process.env.DATA_DIR || path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'hci-db.json');
const DATABASE_URL = String(process.env.DATABASE_URL || '')
  .replace(/&?channel_binding=require/gi, '')
  .replace(/\?&/, '?')
  .replace(/\?$/, '');

const ADMIN_EMAIL = 'mazntyh7@gmail.com';
const ADMIN_PHONE = '0536786288';
const ADMIN_PIN = '1111';

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let pgPool = null;
let saveTimer = null;
let readyResolve;
const ready = new Promise(function (resolve) { readyResolve = resolve; });

function defaultDb() {
  return {
    users: [],
    progress: [],
    messages: [],
    reports: [],
    contacts: [],
    notifications: [],
    otps: [],
    nextUserId: 1,
    nextMessageId: 1,
    nextReportId: 1,
    nextContactId: 1,
    nextNotificationId: 1,
    nextOtpId: 1
  };
}

function loadFromFile() {
  if (!fs.existsSync(dbPath)) {
    const fresh = defaultDb();
    writeLocal(fresh);
    return fresh;
  }
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    const fresh = defaultDb();
    writeLocal(fresh);
    return fresh;
  }
}

function writeLocal(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

function migrate(cache) {
  var changed = false;
  if (!cache.reports) { cache.reports = []; changed = true; }
  if (!cache.nextReportId) { cache.nextReportId = 1; changed = true; }
  if (!cache.contacts) { cache.contacts = []; changed = true; }
  if (!cache.nextContactId) { cache.nextContactId = 1; changed = true; }
  if (!cache.notifications) { cache.notifications = []; changed = true; }
  if (!cache.nextNotificationId) { cache.nextNotificationId = 1; changed = true; }
  if (!cache.otps) { cache.otps = []; changed = true; }
  if (!cache.nextOtpId) { cache.nextOtpId = 1; changed = true; }
  cache.users.forEach(function (u) {
    if (typeof u.path_type === 'undefined') { u.path_type = null; changed = true; }
    if (typeof u.intro_seen === 'undefined') { u.intro_seen = false; changed = true; }
    if (typeof u.email_verified === 'undefined') { u.email_verified = u.role === 'admin'; changed = true; }
    if (typeof u.phone_verified === 'undefined') { u.phone_verified = u.role === 'admin'; changed = true; }
    if (!Array.isArray(u.name_history)) { u.name_history = []; changed = true; }
    if (typeof u.password_changed_at === 'undefined') {
      u.password_changed_at = u.created_at || new Date().toISOString();
      changed = true;
    }
  });
  (cache.progress || []).forEach(function (p) {
    if (typeof p.quiz_json === 'undefined') { p.quiz_json = '{}'; changed = true; }
  });
  return changed;
}

let cache = loadFromFile();
if (migrate(cache)) writeLocal(cache);

async function initRemote() {
  if (!DATABASE_URL) {
    console.log('HCI DB: ملف محلي (للتطوير). على Render أضف DATABASE_URL للحفظ الدائم.');
    readyResolve();
    return;
  }
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    });
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS hci_store (
        id INTEGER PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const res = await pgPool.query('SELECT data FROM hci_store WHERE id = 1');
    if (res.rows[0] && res.rows[0].data) {
      cache = res.rows[0].data;
      if (migrate(cache)) await flushRemote();
      writeLocal(cache);
      console.log('HCI DB: تم التحميل من Postgres (بيانات دائمة).');
    } else {
      if (migrate(cache)) writeLocal(cache);
      await flushRemote();
      console.log('HCI DB: تم إنشاء التخزين الدائم في Postgres.');
    }
  } catch (err) {
    console.error('HCI DB: فشل الاتصال بـ Postgres — نكمل بالملف المحلي:', err.message);
    pgPool = null;
  }
  readyResolve();
}

async function flushRemote() {
  if (!pgPool) return;
  await pgPool.query(
    `INSERT INTO hci_store (id, data, updated_at)
     VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [JSON.stringify(cache)]
  );
}

function persist() {
  writeLocal(cache);
  if (!pgPool) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    flushRemote().catch(function (err) {
      console.error('HCI DB: فشل حفظ Postgres:', err.message);
    });
  }, 150);
}

initRemote();

function toWesternDigits(str) {
  return String(str || '')
    .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
    .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); });
}

const db = {
  getUsers() {
    return cache.users;
  },

  findUserById(id) {
    return cache.users.find((u) => u.id === Number(id)) || null;
  },

  findUserByEmail(email) {
    if (!email) return null;
    const e = email.toLowerCase();
    return cache.users.find((u) => u.email === e) || null;
  },

  findUserByPhone(phone) {
    if (!phone) return null;
    return cache.users.find((u) => u.phone === phone) || null;
  },

  findAdmin() {
    return cache.users.find((u) => u.role === 'admin') || null;
  },

  createUser({ firstName, lastName, email, phone, passwordHash, role }) {
    const now = new Date().toISOString();
    const user = {
      id: cache.nextUserId++,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      password_hash: passwordHash,
      role: role || 'student',
      path_type: null,
      intro_seen: false,
      email_verified: role === 'admin',
      phone_verified: role === 'admin',
      password_changed_at: now,
      created_at: now,
      last_login: now,
      notes: '',
      name_history: []
    };
    cache.users.push(user);
    cache.progress.push({
      user_id: user.id,
      journey_json: '{}',
      coding_json: '{}',
      coding_stage: '',
      practice_json: '{}',
      courses_json: '{}',
      books_json: '{}',
      quiz_json: '{}',
      updated_at: new Date().toISOString()
    });
    persist();
    return user;
  },

  updateUser(id, patch) {
    const user = this.findUserById(id);
    if (!user) return null;
    Object.assign(user, patch);
    persist();
    return user;
  },

  /** تحديث الاسم مع حفظ السجل للإدارة والشهادة */
  updateUserName(id, firstName, lastName) {
    const user = this.findUserById(id);
    if (!user) return null;
    const nextFirst = String(firstName || '').trim();
    const nextLast = String(lastName || '').trim();
    if (nextFirst.length < 2 || nextLast.length < 2) {
      return { error: 'الاسم الأول والثاني مطلوبان (حرفان على الأقل لكل منهما)' };
    }
    if (!user.name_history) user.name_history = [];
    const oldFirst = user.first_name;
    const oldLast = user.last_name;
    if (oldFirst !== nextFirst || oldLast !== nextLast) {
      user.name_history.unshift({
        old_first: oldFirst,
        old_last: oldLast,
        new_first: nextFirst,
        new_last: nextLast,
        changed_at: new Date().toISOString()
      });
      if (user.name_history.length > 20) user.name_history = user.name_history.slice(0, 20);
      user.first_name = nextFirst;
      user.last_name = nextLast;
      persist();
    }
    return { user: user };
  },

  deleteUser(id) {
    cache.users = cache.users.filter((u) => u.id !== Number(id));
    cache.progress = cache.progress.filter((p) => p.user_id !== Number(id));
    cache.messages = cache.messages.filter((m) => m.user_id !== Number(id));
    persist();
  },

  getProgress(userId) {
    return cache.progress.find((p) => p.user_id === Number(userId)) || null;
  },

  upsertProgress(userId, data) {
    let row = this.getProgress(userId);
    if (!row) {
      row = {
        user_id: Number(userId),
        journey_json: '{}',
        coding_json: '{}',
        coding_stage: '',
        practice_json: '{}',
        courses_json: '{}',
        books_json: '{}',
        quiz_json: '{}',
        updated_at: new Date().toISOString()
      };
      cache.progress.push(row);
    }
    Object.assign(row, data, { updated_at: new Date().toISOString() });
    persist();
    return row;
  },

  createMessage({ adminId, userId, subject, body }) {
    const msg = {
      id: cache.nextMessageId++,
      admin_id: Number(adminId),
      user_id: Number(userId),
      subject,
      body,
      created_at: new Date().toISOString(),
      read_by_user: 0
    };
    cache.messages.push(msg);
    persist();
    return msg;
  },

  getMessagesForUser(userId) {
    return cache.messages
      .filter((m) => m.user_id === Number(userId))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  getAllMessages() {
    return cache.messages
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 100);
  },

  markMessageRead(id, userId) {
    const msg = cache.messages.find(
      (m) => m.id === Number(id) && m.user_id === Number(userId)
    );
    if (msg) {
      msg.read_by_user = 1;
      persist();
    }
  },

  updateMessage(id, adminId, patch) {
    const msg = cache.messages.find(
      (m) => m.id === Number(id) && m.admin_id === Number(adminId)
    );
    if (!msg) return null;
    if (typeof patch.subject === 'string') msg.subject = patch.subject.trim();
    if (typeof patch.body === 'string') msg.body = patch.body.trim();
    msg.updated_at = new Date().toISOString();
    persist();
    return msg;
  },

  deleteMessage(id, adminId) {
    const before = cache.messages.length;
    cache.messages = cache.messages.filter(
      (m) => !(m.id === Number(id) && m.admin_id === Number(adminId))
    );
    if (cache.messages.length === before) return false;
    persist();
    return true;
  },

  countUnreadForUser(userId) {
    return cache.messages.filter(
      (m) => m.user_id === Number(userId) && !m.read_by_user
    ).length;
  },

  createReport({ userId, name, contact, message, page, mediaPath, mediaType, mediaName }) {
    const report = {
      id: cache.nextReportId++,
      user_id: userId || null,
      name: name || '',
      contact: contact || '',
      message,
      page: page || '',
      media_path: mediaPath || null,
      media_type: mediaType || null,
      media_name: mediaName || null,
      created_at: new Date().toISOString(),
      status: 'new'
    };
    cache.reports.push(report);
    persist();
    return report;
  },

  getReports() {
    return cache.reports
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  markReportDone(id) {
    const r = cache.reports.find((x) => x.id === Number(id));
    if (r) {
      r.status = 'done';
      r.done_at = new Date().toISOString();
      persist();
    }
    return r;
  },

  createContact({ userId, name, contact, message }) {
    const row = {
      id: cache.nextContactId++,
      user_id: userId || null,
      name: name || '',
      contact: contact || '',
      message,
      created_at: new Date().toISOString(),
      status: 'new'
    };
    cache.contacts.push(row);
    persist();
    return row;
  },

  getContacts() {
    return cache.contacts
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  markContactDone(id) {
    const row = cache.contacts.find((x) => x.id === Number(id));
    if (row) {
      row.status = 'done';
      row.done_at = new Date().toISOString();
      persist();
    }
    return row;
  },

  replyContact(id, replyText) {
    const row = cache.contacts.find((x) => x.id === Number(id));
    if (!row) return null;
    row.reply = String(replyText || '').trim();
    row.replied_at = new Date().toISOString();
    row.status = 'done';
    row.done_at = row.done_at || row.replied_at;
    persist();
    return row;
  },

  countContacts() {
    return cache.contacts.filter((c) => c.status === 'new').length;
  },

  createNotification({ userId, type, title, body, link, refId }) {
    if (!userId) return null;
    const n = {
      id: cache.nextNotificationId++,
      user_id: Number(userId),
      type: type || 'system',
      title: title || '',
      body: body || '',
      link: link || '',
      ref_id: refId != null ? Number(refId) : null,
      read: 0,
      created_at: new Date().toISOString()
    };
    cache.notifications.push(n);
    persist();
    return n;
  },

  getNotificationsForUser(userId) {
    return cache.notifications
      .filter((n) => n.user_id === Number(userId))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 80);
  },

  countUnreadNotifications(userId) {
    return cache.notifications.filter(
      (n) => n.user_id === Number(userId) && !n.read
    ).length;
  },

  markNotificationRead(id, userId) {
    const n = cache.notifications.find(
      (x) => x.id === Number(id) && x.user_id === Number(userId)
    );
    if (!n) return null;
    n.read = 1;
    n.read_at = new Date().toISOString();
    if (n.type === 'admin_message' && n.ref_id) {
      this.markMessageRead(n.ref_id, userId);
    }
    persist();
    return n;
  },

  markAllNotificationsRead(userId) {
    const uid = Number(userId);
    cache.notifications.forEach((n) => {
      if (n.user_id === uid && !n.read) {
        n.read = 1;
        n.read_at = new Date().toISOString();
        if (n.type === 'admin_message' && n.ref_id) {
          this.markMessageRead(n.ref_id, uid);
        }
      }
    });
    persist();
  },

  countStudents() {
    return cache.users.filter((u) => u.role === 'student').length;
  },

  countAdmins() {
    return cache.users.filter((u) => u.role === 'admin').length;
  },

  countMessages() {
    return cache.messages.length;
  },

  countReports() {
    return cache.reports.filter((r) => r.status === 'new').length;
  },

  countActiveWeek() {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return cache.users.filter((u) => {
      if (u.role !== 'student' || !u.last_login) return false;
      return new Date(u.last_login).getTime() >= weekAgo;
    }).length;
  },

  /** ينشئ رمز تحقق 6 أرقام — يُرجع الرمز مرة واحدة فقط */
  createOtp({ identifier, purpose, userId, channel }) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const idNorm = String(identifier || '').trim().toLowerCase();
    cache.otps = cache.otps.filter(function (o) {
      return !(o.identifier === idNorm && o.purpose === purpose);
    });
    const entry = {
      id: cache.nextOtpId++,
      identifier: idNorm,
      purpose: purpose || 'verify',
      channel: channel || (idNorm.includes('@') ? 'email' : 'phone'),
      user_id: userId || null,
      code_hash: bcrypt.hashSync(code, 8),
      expires_at: Date.now() + 10 * 60 * 1000,
      created_at: new Date().toISOString(),
      used: false
    };
    cache.otps.push(entry);
    persist();
    return { otp: entry, code: code };
  },

  findActiveOtp(identifier, purpose) {
    const idNorm = String(identifier || '').trim().toLowerCase();
    return cache.otps.find(function (o) {
      return o.identifier === idNorm && o.purpose === purpose && !o.used;
    }) || null;
  },

  checkOtp(identifier, purpose, code) {
    const entry = this.findActiveOtp(identifier, purpose);
    const raw = toWesternDigits(String(code || '')).trim();
    if (!entry) return { ok: false, error: 'لا يوجد رمز تحقق نشط — اطلب رمزاً جديداً' };
    if (Date.now() > entry.expires_at) {
      return { ok: false, error: 'انتهت صلاحية الرمز — اطلب رمزاً جديداً' };
    }
    if (!bcrypt.compareSync(raw, entry.code_hash)) {
      return { ok: false, error: 'رمز التحقق غير صحيح' };
    }
    return { ok: true, otp: entry };
  },

  consumeOtp(identifier, purpose, code) {
    const result = this.checkOtp(identifier, purpose, code);
    if (!result.ok) return result;
    result.otp.used = true;
    persist();
    return result;
  },

  setPassword(userId, passwordHash) {
    return this.updateUser(userId, {
      password_hash: passwordHash,
      password_changed_at: new Date().toISOString()
    });
  },

  findUserByIdentifier(identifier) {
    const raw = String(identifier || '').trim();
    if (!raw) return null;
    if (raw.includes('@')) return this.findUserByEmail(raw.toLowerCase());
    const digits = raw.replace(/\D/g, '');
    return this.findUserByPhone(digits);
  }
};

/** يضمن حساب الأدمن بالبيانات المطلوبة في كل تشغيل */
function ensureAdmin() {
  const hash = bcrypt.hashSync(ADMIN_PIN, 10);
  let admin = db.findAdmin();

  if (admin) {
    db.updateUser(admin.id, {
      first_name: 'مازن',
      last_name: 'عطية',
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      password_hash: hash,
      role: 'admin'
    });
    return { email: ADMIN_EMAIL, phone: ADMIN_PHONE, password: ADMIN_PIN, id: admin.id, updated: true };
  }

  const user = db.createUser({
    firstName: 'مازن',
    lastName: 'عطية',
    email: ADMIN_EMAIL,
    phone: ADMIN_PHONE,
    passwordHash: hash,
    role: 'admin'
  });

  return { email: ADMIN_EMAIL, phone: ADMIN_PHONE, password: ADMIN_PIN, id: user.id, updated: false };
}

function checkPassword(user, rawPassword) {
  const normalized = toWesternDigits(rawPassword).trim();
  if (user.role === 'admin' && normalized === ADMIN_PIN) return true;
  try {
    return bcrypt.compareSync(normalized, user.password_hash) ||
           bcrypt.compareSync(String(rawPassword), user.password_hash);
  } catch {
    return false;
  }
}

module.exports = {
  db,
  ensureAdmin,
  checkPassword,
  toWesternDigits,
  ready,
  dataDir,
  ADMIN_EMAIL,
  ADMIN_PHONE,
  ADMIN_PIN
};
