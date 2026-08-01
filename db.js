/* قاعدة بيانات JSON بسيطة — بدون مكتبات أصلية */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'hci-db.json');

const ADMIN_EMAIL = 'mazntyh7@gmail.com';
const ADMIN_PHONE = '0536786288';
const ADMIN_PIN = '1111';

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function defaultDb() {
  return {
    users: [],
    progress: [],
    messages: [],
    reports: [],
    otps: [],
    nextUserId: 1,
    nextMessageId: 1,
    nextReportId: 1,
    nextOtpId: 1
  };
}

function load() {
  if (!fs.existsSync(dbPath)) {
    const fresh = defaultDb();
    save(fresh);
    return fresh;
  }
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    const fresh = defaultDb();
    save(fresh);
    return fresh;
  }
}

function save(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

let cache = load();

(function migrate() {
  var changed = false;
  if (!cache.reports) { cache.reports = []; changed = true; }
  if (!cache.nextReportId) { cache.nextReportId = 1; changed = true; }
  if (!cache.otps) { cache.otps = []; changed = true; }
  if (!cache.nextOtpId) { cache.nextOtpId = 1; changed = true; }
  cache.users.forEach(function (u) {
    if (typeof u.path_type === 'undefined') { u.path_type = null; changed = true; }
    if (typeof u.intro_seen === 'undefined') { u.intro_seen = false; changed = true; }
    if (typeof u.email_verified === 'undefined') { u.email_verified = u.role === 'admin'; changed = true; }
    if (typeof u.phone_verified === 'undefined') { u.phone_verified = u.role === 'admin'; changed = true; }
    if (typeof u.password_changed_at === 'undefined') {
      u.password_changed_at = u.created_at || new Date().toISOString();
      changed = true;
    }
  });
  if (changed) save(cache);
})();

function persist() {
  save(cache);
}

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
      notes: ''
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
      persist();
    }
    return r;
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
  ADMIN_EMAIL,
  ADMIN_PHONE,
  ADMIN_PIN
};
