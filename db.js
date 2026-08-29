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
const ADMIN_PIN_ENV = String(process.env.ADMIN_PIN || '').trim();
const ADMIN_PIN = ADMIN_PIN_ENV || (process.env.NODE_ENV === 'production' ? '' : '1111');

const PREVIEW_EMAIL = process.env.PREVIEW_EMAIL || 'mazen@hci.dev';
const PREVIEW_PHONE = process.env.PREVIEW_PHONE || '0590000001';
const PREVIEW_PIN_ENV = String(process.env.PREVIEW_PIN || '').trim();
const PREVIEW_PIN = PREVIEW_PIN_ENV || (process.env.NODE_ENV === 'production' ? '' : '11111111');

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
    share_hits: [],
    certificates: [],
    community_articles: [],
    partners: [],
    offers: [],
    offer_interests: [],
    site_feedback: [],
    nextUserId: 1,
    nextMessageId: 1,
    nextReportId: 1,
    nextContactId: 1,
    nextNotificationId: 1,
    nextOtpId: 1,
    nextShareHitId: 1,
    nextCertificateId: 1,
    nextCommunityArticleId: 1,
    nextPartnerId: 1,
    nextOfferId: 1,
    nextOfferInterestId: 1,
    nextFeedbackId: 1
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

let localWriteTimer = null;
function writeLocalAsync(data) {
  if (localWriteTimer) clearTimeout(localWriteTimer);
  localWriteTimer = setTimeout(function () {
    localWriteTimer = null;
    const json = JSON.stringify(data, null, 2);
    fs.writeFile(dbPath, json, 'utf8', function (err) {
      if (err) console.error('HCI DB: فشل الحفظ المحلي:', err.message);
    });
  }, 120);
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
  if (!cache.share_hits) { cache.share_hits = []; changed = true; }
  if (!cache.nextShareHitId) { cache.nextShareHitId = 1; changed = true; }
  if (!cache.certificates) { cache.certificates = []; changed = true; }
  if (!cache.nextCertificateId) { cache.nextCertificateId = 1; changed = true; }
  if (!cache.community_articles) { cache.community_articles = []; changed = true; }
  if (!cache.nextCommunityArticleId) { cache.nextCommunityArticleId = 1; changed = true; }
  if (!cache.partners) { cache.partners = []; changed = true; }
  if (!cache.nextPartnerId) { cache.nextPartnerId = 1; changed = true; }
  if (!cache.offers) { cache.offers = []; changed = true; }
  if (!cache.nextOfferId) { cache.nextOfferId = 1; changed = true; }
  if (!cache.offer_interests) { cache.offer_interests = []; changed = true; }
  if (!cache.nextOfferInterestId) { cache.nextOfferInterestId = 1; changed = true; }
  if (!cache.site_feedback) { cache.site_feedback = []; changed = true; }
  if (!cache.nextFeedbackId) { cache.nextFeedbackId = 1; changed = true; }
  cache.users.forEach(function (u) {
    if (typeof u.is_preview === 'undefined') { u.is_preview = false; changed = true; }
    if (typeof u.path_type === 'undefined') { u.path_type = null; changed = true; }
    if (typeof u.intro_seen === 'undefined') { u.intro_seen = false; changed = true; }
    if (typeof u.email_verified === 'undefined') { u.email_verified = u.role === 'admin'; changed = true; }
    if (typeof u.phone_verified === 'undefined') { u.phone_verified = u.role === 'admin'; changed = true; }
    if (!Array.isArray(u.name_history)) { u.name_history = []; changed = true; }
    if (!u.notif_prefs || typeof u.notif_prefs !== 'object') {
      u.notif_prefs = { inApp: true, browserPush: false, stalled: true, updates: true };
      changed = true;
    }
    if (typeof u.last_stall_nudge_at === 'undefined') { u.last_stall_nudge_at = null; changed = true; }
    if (typeof u.avatar === 'undefined') { u.avatar = null; changed = true; }
    if (typeof u.referred_by === 'undefined') { u.referred_by = null; changed = true; }
    if (typeof u.auth_provider === 'undefined') { u.auth_provider = u.google_sub ? 'google' : 'local'; changed = true; }
    if (typeof u.google_sub === 'undefined') { u.google_sub = null; changed = true; }
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
  writeLocalAsync(cache);
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

  findUserByGoogleSub(sub) {
    if (!sub) return null;
    return cache.users.find((u) => u.google_sub === String(sub)) || null;
  },

  findAdmin() {
    return cache.users.find((u) => u.role === 'admin') || null;
  },

  createUser({ firstName, lastName, email, phone, passwordHash, role, referredBy, authProvider, googleSub, emailVerified }) {
    const now = new Date().toISOString();
    const refId = referredBy != null && referredBy !== '' ? Number(referredBy) : null;
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
      email_verified: emailVerified != null ? !!emailVerified : role === 'admin',
      phone_verified: role === 'admin',
      auth_provider: authProvider || 'local',
      google_sub: googleSub || null,
      password_changed_at: now,
      created_at: now,
      last_login: now,
      notes: '',
      name_history: [],
      referred_by: (refId && Number.isFinite(refId) && refId > 0) ? refId : null,
      notif_prefs: { inApp: true, browserPush: false, stalled: true, updates: true },
      last_stall_nudge_at: null,
      avatar: null
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
    var nameOk = /^[A-Za-z\u0621-\u063A\u0641-\u064A]+(?: [A-Za-z\u0621-\u063A\u0641-\u064A]+)*$/;
    if (!nameOk.test(nextFirst.replace(/\s+/g, ' ')) || !nameOk.test(nextLast.replace(/\s+/g, ' '))) {
      return { error: 'الاسم حروف عربية أو إنجليزية فقط — بدون أرقام أو رموز' };
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

  getCertificateByUserId(userId) {
    return cache.certificates.find((c) => c.user_id === Number(userId)) || null;
  },

  getCertificateById(id) {
    return cache.certificates.find((c) => c.id === String(id)) || null;
  },

  createCertificate(data) {
    const existing = this.getCertificateByUserId(data.userId);
    if (existing) return existing;
    const year = new Date(data.issuedAt).getFullYear();
    const seq = String(cache.nextCertificateId++).padStart(6, '0');
    const record = {
      id: 'HCI-' + year + '-' + seq,
      user_id: Number(data.userId),
      name: data.name,
      path: data.path,
      pct: data.pct,
      issued_at: data.issuedAt,
      completed_at: data.completedAt,
      evidence: data.evidence || null
    };
    cache.certificates.push(record);
    persist();
    return record;
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

  deleteContact(id) {
    const before = cache.contacts.length;
    cache.contacts = cache.contacts.filter((x) => x.id !== Number(id));
    if (cache.contacts.length === before) return false;
    persist();
    return true;
  },

  countContacts() {
    return cache.contacts.filter((c) => c.status === 'new').length;
  },

  createCommunityArticle({ userId, title, body, authorName, status }) {
    const st = status === 'draft' ? 'draft' : 'pending';
    const row = {
      id: cache.nextCommunityArticleId++,
      user_id: Number(userId),
      title: String(title || '').trim(),
      body: String(body || '').trim(),
      author_name: String(authorName || '').trim(),
      status: st,
      reject_reason: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reviewed_at: null,
      published_at: null
    };
    cache.community_articles.push(row);
    persist();
    return row;
  },

  getCommunityArticles(filter) {
    var list = cache.community_articles.slice();
    if (filter && filter.status) {
      list = list.filter((a) => a.status === filter.status);
    }
    if (filter && filter.excludeStatus) {
      list = list.filter((a) => a.status !== filter.excludeStatus);
    }
    if (filter && filter.userId != null) {
      list = list.filter((a) => a.user_id === Number(filter.userId));
    }
    return list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  getCommunityArticleById(id) {
    return cache.community_articles.find((a) => a.id === Number(id)) || null;
  },

  updateCommunityArticle(id, { userId, title, body }) {
    const row = cache.community_articles.find((a) => a.id === Number(id));
    if (!row) return null;
    if (Number(row.user_id) !== Number(userId)) return null;
    if (row.status !== 'draft' && row.status !== 'rejected') return null;
    if (title != null) row.title = String(title || '').trim();
    if (body != null) row.body = String(body || '').trim();
    row.status = 'draft';
    row.reject_reason = '';
    row.updated_at = new Date().toISOString();
    row.reviewed_at = null;
    row.published_at = null;
    persist();
    return row;
  },

  submitCommunityArticle(id, { userId }) {
    const row = cache.community_articles.find((a) => a.id === Number(id));
    if (!row) return null;
    if (Number(row.user_id) !== Number(userId)) return null;
    if (row.status !== 'draft' && row.status !== 'rejected') return null;
    row.status = 'pending';
    row.reject_reason = '';
    row.updated_at = new Date().toISOString();
    row.reviewed_at = null;
    row.published_at = null;
    persist();
    return row;
  },

  reviewCommunityArticle(id, { status, rejectReason }) {
    const row = cache.community_articles.find((a) => a.id === Number(id));
    if (!row) return null;
    if (row.status === 'draft') return null;
    if (status !== 'approved' && status !== 'rejected') return null;
    row.status = status;
    row.reviewed_at = new Date().toISOString();
    if (status === 'approved') {
      row.published_at = row.reviewed_at;
      row.reject_reason = '';
    } else {
      row.reject_reason = String(rejectReason || '').trim();
      row.published_at = null;
    }
    persist();
    return row;
  },

  countPendingCommunityArticles() {
    return cache.community_articles.filter((a) => a.status === 'pending').length;
  },

  /* ----- شركاء وعروض تدريب ----- */
  createPartner({ name, contactName, email, phone, website, notes }) {
    const row = {
      id: cache.nextPartnerId++,
      name: String(name || '').trim(),
      contact_name: String(contactName || '').trim(),
      email: String(email || '').trim(),
      phone: String(phone || '').trim(),
      website: String(website || '').trim(),
      notes: String(notes || '').trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    cache.partners.push(row);
    persist();
    return row;
  },

  updatePartner(id, data) {
    const row = cache.partners.find((p) => p.id === Number(id));
    if (!row) return null;
    if (data.name != null) row.name = String(data.name || '').trim();
    if (data.contactName != null) row.contact_name = String(data.contactName || '').trim();
    if (data.email != null) row.email = String(data.email || '').trim();
    if (data.phone != null) row.phone = String(data.phone || '').trim();
    if (data.website != null) row.website = String(data.website || '').trim();
    if (data.notes != null) row.notes = String(data.notes || '').trim();
    row.updated_at = new Date().toISOString();
    persist();
    return row;
  },

  deletePartner(id) {
    const before = cache.partners.length;
    cache.partners = cache.partners.filter((p) => p.id !== Number(id));
    if (cache.partners.length === before) return false;
    persist();
    return true;
  },

  getPartners() {
    return cache.partners.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  getPartnerById(id) {
    return cache.partners.find((p) => p.id === Number(id)) || null;
  },

  createOffer(data) {
    const row = {
      id: cache.nextOfferId++,
      partner_id: data.partnerId != null ? Number(data.partnerId) : null,
      company_name: String(data.companyName || '').trim(),
      title: String(data.title || '').trim(),
      summary: String(data.summary || '').trim(),
      link: String(data.link || '').trim(),
      mode: String(data.mode || 'online').trim(), // online | onsite | hybrid
      city: String(data.city || '').trim(),
      status: data.status === 'published' ? 'published' : 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: data.status === 'published' ? new Date().toISOString() : null
    };
    cache.offers.push(row);
    persist();
    return row;
  },

  updateOffer(id, data) {
    const row = cache.offers.find((o) => o.id === Number(id));
    if (!row) return null;
    if (data.partnerId !== undefined) row.partner_id = data.partnerId != null ? Number(data.partnerId) : null;
    if (data.companyName != null) row.company_name = String(data.companyName || '').trim();
    if (data.title != null) row.title = String(data.title || '').trim();
    if (data.summary != null) row.summary = String(data.summary || '').trim();
    if (data.link != null) row.link = String(data.link || '').trim();
    if (data.mode != null) row.mode = String(data.mode || 'online').trim();
    if (data.city != null) row.city = String(data.city || '').trim();
    if (data.status === 'published' || data.status === 'draft' || data.status === 'archived') {
      if (data.status === 'published' && row.status !== 'published') {
        row.published_at = new Date().toISOString();
      }
      row.status = data.status;
    }
    row.updated_at = new Date().toISOString();
    persist();
    return row;
  },

  deleteOffer(id) {
    const before = cache.offers.length;
    cache.offers = cache.offers.filter((o) => o.id !== Number(id));
    if (cache.offers.length === before) return false;
    cache.offer_interests = cache.offer_interests.filter((i) => i.offer_id !== Number(id));
    persist();
    return true;
  },

  getOffers(filter) {
    var list = cache.offers.slice();
    if (filter && filter.status) list = list.filter((o) => o.status === filter.status);
    return list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  getOfferById(id) {
    return cache.offers.find((o) => o.id === Number(id)) || null;
  },

  createOfferInterest({ offerId, userId, name, contact, note }) {
    const existing = cache.offer_interests.find(
      (i) => i.offer_id === Number(offerId) && i.user_id === Number(userId)
    );
    if (existing) return existing;
    const row = {
      id: cache.nextOfferInterestId++,
      offer_id: Number(offerId),
      user_id: Number(userId),
      name: String(name || '').trim(),
      contact: String(contact || '').trim(),
      note: String(note || '').trim(),
      status: 'new',
      created_at: new Date().toISOString()
    };
    cache.offer_interests.push(row);
    persist();
    return row;
  },

  getOfferInterests(filter) {
    var list = cache.offer_interests.slice();
    if (filter && filter.status) list = list.filter((i) => i.status === filter.status);
    if (filter && filter.offerId != null) list = list.filter((i) => i.offer_id === Number(filter.offerId));
    return list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  updateOfferInterest(id, { status }) {
    const row = cache.offer_interests.find((i) => i.id === Number(id));
    if (!row) return null;
    if (status === 'new' || status === 'contacted' || status === 'done') row.status = status;
    persist();
    return row;
  },

  countNewOfferInterests() {
    return cache.offer_interests.filter((i) => i.status === 'new').length;
  },

  createSiteFeedback({ userId, rating, comment }) {
    const existing = cache.site_feedback.find((f) => f.user_id === Number(userId));
    if (existing) {
      existing.rating = Number(rating);
      existing.comment = String(comment || '').trim();
      existing.created_at = new Date().toISOString();
      persist();
      return existing;
    }
    const row = {
      id: cache.nextFeedbackId++,
      user_id: Number(userId),
      rating: Number(rating),
      comment: String(comment || '').trim(),
      created_at: new Date().toISOString()
    };
    cache.site_feedback.push(row);
    persist();
    return row;
  },

  getFeedbackByUserId(userId) {
    return cache.site_feedback.find((f) => f.user_id === Number(userId)) || null;
  },

  getAllFeedback() {
    return cache.site_feedback.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
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

  countCertificates() {
    return (cache.certificates || []).length;
  },

  countApprovedCommunityArticles() {
    return (cache.community_articles || []).filter((a) => a.status === 'approved').length;
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
  },

  /** تسجيل زيارة من رابط مشاركة — زيارة فريدة لكل زائر خلال 24 ساعة */
  recordShareHit({ sharerId, visitorKey, path, userAgent, visitorUserId }) {
    const sid = Number(sharerId);
    if (!sid || !Number.isFinite(sid) || !this.findUserById(sid)) {
      return { ok: false, error: 'رابط المشاركة غير صالح' };
    }
    const visitorId = visitorUserId != null ? Number(visitorUserId) : null;
    if (visitorId && visitorId === sid) {
      return { ok: true, hit: null, duplicate: true, self: true };
    }
    const key = String(visitorKey || '').trim().slice(0, 64);
    if (!key || key.length < 8) {
      return { ok: false, error: 'معرّف الزائر غير صالح' };
    }
    /* لا تحسب زيارة صاحب الرابط لنفسه */
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const existing = (cache.share_hits || []).find(function (h) {
      return h.sharer_id === sid && h.visitor_key === key && (now - new Date(h.at).getTime()) < dayMs;
    });
    if (existing) {
      existing.last_at = new Date().toISOString();
      existing.path = String(path || existing.path || '/').slice(0, 200);
      if (visitorId && !existing.visitor_user_id) existing.visitor_user_id = visitorId;
      persist();
      return { ok: true, hit: existing, duplicate: true };
    }
    const hit = {
      id: cache.nextShareHitId++,
      sharer_id: sid,
      visitor_key: key,
      visitor_user_id: (visitorId && this.findUserById(visitorId)) ? visitorId : null,
      path: String(path || '/').slice(0, 200),
      user_agent: String(userAgent || '').slice(0, 180),
      at: new Date().toISOString(),
      last_at: new Date().toISOString(),
      signup_user_id: null
    };
    cache.share_hits.push(hit);
    persist();
    return { ok: true, hit: hit, duplicate: false };
  },

  attachShareSignup(sharerId, signupUserId, visitorKey) {
    const sid = Number(sharerId);
    const uid = Number(signupUserId);
    if (!sid || !uid) return;
    const key = String(visitorKey || '').trim();
    const hits = (cache.share_hits || []).filter(function (h) {
      return h.sharer_id === sid && (!key || h.visitor_key === key);
    });
    if (hits.length) {
      hits[hits.length - 1].signup_user_id = uid;
      if (!hits[hits.length - 1].visitor_user_id) hits[hits.length - 1].visitor_user_id = uid;
      persist();
    }
  },

  getShareStats(sharerId) {
    const sid = Number(sharerId);
    const hits = (cache.share_hits || []).filter(function (h) { return h.sharer_id === sid; });
    const uniqueVisitors = {};
    hits.forEach(function (h) { uniqueVisitors[h.visitor_key] = true; });
    const signups = cache.users.filter(function (u) {
      return u.referred_by === sid && u.role !== 'admin';
    }).map(function (u) {
      return {
        id: u.id,
        name: ((u.first_name || '') + ' ' + (u.last_name || '')).trim(),
        at: u.created_at
      };
    }).sort(function (a, b) {
      return (a.at < b.at ? 1 : -1);
    });

    const recentHits = hits
      .slice()
      .sort(function (a, b) { return (a.at < b.at ? 1 : -1); })
      .slice(0, 20)
      .map(function (h) {
        var signup = h.signup_user_id ? cache.users.find(function (u) { return u.id === h.signup_user_id; }) : null;
        return {
          at: h.at,
          path: h.path,
          converted: !!h.signup_user_id,
          signupName: signup ? ((signup.first_name || '') + ' ' + (signup.last_name || '')).trim() : null
        };
      });

    return {
      visits: hits.length,
      uniqueVisitors: Object.keys(uniqueVisitors).length,
      signups: signups.length,
      signupUsers: signups.slice(0, 30),
      recent: recentHits
    };
  },

  getAdminShareOverview() {
    const hits = cache.share_hits || [];
    const nameOf = function (id) {
      const u = db.findUserById(id);
      if (!u) return null;
      return ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || ('#' + id);
    };
    const contactOf = function (id) {
      const u = db.findUserById(id);
      if (!u) return { email: null, phone: null };
      return { email: u.email || null, phone: u.phone || null };
    };

    const sharerMap = {};
    function ensureSharer(id) {
      if (!id || sharerMap[id]) return sharerMap[id];
      const c = contactOf(id);
      sharerMap[id] = {
        id: id,
        name: nameOf(id) || ('مستخدم #' + id),
        email: c.email,
        phone: c.phone,
        entries: 0,
        uniqueKeys: {},
        signups: 0
      };
      return sharerMap[id];
    }

    hits.forEach(function (h) {
      const s = ensureSharer(h.sharer_id);
      if (!s) return;
      s.entries += 1;
      if (h.visitor_key) s.uniqueKeys[h.visitor_key] = true;
    });

    const referred = cache.users.filter(function (u) {
      return u.referred_by && u.role !== 'admin';
    });
    referred.forEach(function (u) {
      const s = ensureSharer(u.referred_by);
      if (s) s.signups += 1;
    });

    const uniqueAll = {};
    hits.forEach(function (h) {
      if (h.visitor_key) uniqueAll[h.visitor_key] = true;
    });

    const sharers = Object.keys(sharerMap).map(function (k) {
      const s = sharerMap[k];
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        entries: s.entries,
        unique: Object.keys(s.uniqueKeys).length,
        signups: s.signups
      };
    }).sort(function (a, b) {
      if (b.entries !== a.entries) return b.entries - a.entries;
      return b.signups - a.signups;
    });

    const entries = hits.slice().sort(function (a, b) {
      return (a.at < b.at ? 1 : -1);
    }).slice(0, 300).map(function (h) {
      return {
        id: h.id,
        at: h.at,
        lastAt: h.last_at || h.at,
        path: h.path || '/',
        sharerId: h.sharer_id,
        sharerName: nameOf(h.sharer_id) || ('#' + h.sharer_id),
        visitorUserId: h.visitor_user_id || null,
        visitorName: h.visitor_user_id ? nameOf(h.visitor_user_id) : null,
        signupUserId: h.signup_user_id || null,
        signupName: h.signup_user_id ? nameOf(h.signup_user_id) : null
      };
    });

    const signups = referred.map(function (u) {
      return {
        id: u.id,
        name: ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || ('#' + u.id),
        email: u.email || null,
        phone: u.phone || null,
        at: u.created_at,
        viaId: u.referred_by,
        viaName: nameOf(u.referred_by) || ('#' + u.referred_by)
      };
    }).sort(function (a, b) {
      return (a.at < b.at ? 1 : -1);
    });

    return {
      totals: {
        sharers: sharers.length,
        entries: hits.length,
        uniqueEntries: Object.keys(uniqueAll).length,
        signups: referred.length
      },
      sharers: sharers,
      entries: entries,
      signups: signups
    };
  }
};

/** يضمن حساب الأدمن بالبيانات المطلوبة في كل تشغيل */
function ensureAdmin() {
  let admin = db.findAdmin();
  const patch = {
    first_name: 'مازن',
    last_name: 'عطية',
    email: ADMIN_EMAIL,
    phone: ADMIN_PHONE,
    role: 'admin'
  };
  if (ADMIN_PIN_ENV) patch.password_hash = bcrypt.hashSync(ADMIN_PIN_ENV, 10);

  if (admin) {
    db.updateUser(admin.id, patch);
    return { email: ADMIN_EMAIL, phone: ADMIN_PHONE, password: ADMIN_PIN_ENV ? '(من البيئة)' : '(بدون تغيير)', id: admin.id, updated: true };
  }

  if (!ADMIN_PIN) {
    console.warn('ADMIN_PIN غير معرّف — لم يُنشأ حساب مدير جديد.');
    return { email: ADMIN_EMAIL, phone: ADMIN_PHONE, password: '', id: null, updated: false };
  }

  const user = db.createUser({
    firstName: 'مازن',
    lastName: 'عطية',
    email: ADMIN_EMAIL,
    phone: ADMIN_PHONE,
    passwordHash: bcrypt.hashSync(ADMIN_PIN, 10),
    role: 'admin'
  });

  return { email: ADMIN_EMAIL, phone: ADMIN_PHONE, password: process.env.NODE_ENV === 'production' ? '' : ADMIN_PIN, id: user.id, updated: false };
}

function ensurePreviewOwner() {
  const patch = {
    first_name: 'مازن',
    last_name: 'معاينة',
    email: PREVIEW_EMAIL,
    phone: PREVIEW_PHONE,
    role: 'student',
    is_preview: true,
    email_verified: true,
    phone_verified: true
  };
  if (PREVIEW_PIN_ENV || PREVIEW_PIN) {
    patch.password_hash = bcrypt.hashSync(PREVIEW_PIN_ENV || PREVIEW_PIN, 10);
  }
  let user = db.findUserByEmail(PREVIEW_EMAIL) || db.findUserByPhone(PREVIEW_PHONE);
  if (user) {
    db.updateUser(user.id, patch);
    return { email: PREVIEW_EMAIL, phone: PREVIEW_PHONE, password: PREVIEW_PIN ? '(محلي)' : '', id: user.id, updated: true };
  }
  if (!PREVIEW_PIN) {
    return { email: PREVIEW_EMAIL, phone: PREVIEW_PHONE, password: '', id: null, updated: false };
  }
  user = db.createUser({
    firstName: 'مازن',
    lastName: 'معاينة',
    email: PREVIEW_EMAIL,
    phone: PREVIEW_PHONE,
    passwordHash: patch.password_hash,
    role: 'student',
    emailVerified: true
  });
  db.updateUser(user.id, { is_preview: true, phone_verified: true, email_verified: true });
  return { email: PREVIEW_EMAIL, phone: PREVIEW_PHONE, password: process.env.NODE_ENV === 'production' ? '' : PREVIEW_PIN, id: user.id, updated: false };
}

function resetPreviewOwnerProgress(userId) {
  db.updateUser(userId, { path_type: null, intro_seen: false });
  db.upsertProgress(userId, {
    journey_json: '{}',
    coding_json: '{}',
    coding_stage: '',
    practice_json: '{}',
    courses_json: '{}',
    books_json: '{}',
    quiz_json: '{}'
  });
}

function checkPassword(user, rawPassword) {
  const normalized = toWesternDigits(rawPassword).trim();
  if (process.env.NODE_ENV !== 'production') {
    if (ADMIN_PIN && user.role === 'admin' && normalized === ADMIN_PIN) return true;
    if (PREVIEW_PIN && user.is_preview && normalized === PREVIEW_PIN) return true;
  }
  try {
    return bcrypt.compareSync(normalized, user.password_hash) ||
           bcrypt.compareSync(String(rawPassword), user.password_hash);
  } catch {
    return false;
  }
}

function flushLocalSync() {
  if (localWriteTimer) {
    clearTimeout(localWriteTimer);
    localWriteTimer = null;
  }
  try { writeLocal(cache); } catch (e) { /* */ }
}
process.on('SIGTERM', flushLocalSync);
process.on('SIGINT', flushLocalSync);
process.on('exit', flushLocalSync);

module.exports = {
  db,
  ensureAdmin,
  ensurePreviewOwner,
  resetPreviewOwnerProgress,
  checkPassword,
  toWesternDigits,
  ready,
  dataDir,
  ADMIN_EMAIL,
  ADMIN_PHONE,
  ADMIN_PIN,
  PREVIEW_EMAIL,
  PREVIEW_PHONE,
  PREVIEW_PIN
};
