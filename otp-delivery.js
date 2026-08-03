/**
 * إرسال رمز التحقق باسم المنصة HCI
 * البريد: Resend  |  الهاتف: Twilio
 *
 * متغيرات البيئة على Render:
 *   RESEND_API_KEY
 *   HCI_FROM_EMAIL          مثال: HCI <onboarding@resend.dev> أو بريد نطاق موثّق
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM             رقم E.164 أو معرّف مرسل أبجدي مثل HCI (إن كان معتمداً)
 *   OTP_DEMO=1              اختياري للتطوير فقط — يُرجع الرمز في الاستجابة
 */

function emailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.HCI_FROM_EMAIL);
}

function smsConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM
  );
}

function toE164Saudi(phoneDigits) {
  const d = String(phoneDigits || '').replace(/\D/g, '');
  if (/^05\d{8}$/.test(d)) return '+966' + d.slice(1);
  if (/^5\d{8}$/.test(d)) return '+966' + d;
  if (/^9665\d{8}$/.test(d)) return '+' + d;
  if (d.startsWith('+')) return d;
  return null;
}

function otpMessage(code, purpose) {
  if (purpose === 'reset') {
    return 'رمز استعادة كلمة المرور من HCI: ' + code + '\nصالح لمدة 10 دقائق.\n— HCI';
  }
  return 'رمز التحقق من HCI: ' + code + '\nصالح لمدة 10 دقائق.\n— HCI';
}

async function sendEmailOtp({ to, code, purpose }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.HCI_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false, error: 'خدمة البريد غير مفعّلة. أضف RESEND_API_KEY و HCI_FROM_EMAIL في Render.' };
  }

  const subject =
    purpose === 'reset'
      ? 'رمز استعادة كلمة المرور — HCI'
      : 'رمز التحقق — HCI';

  const html =
    '<div style="font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;line-height:1.7;color:#15202B">' +
    '<p style="font-size:18px;font-weight:700;color:#C9A24B;margin:0 0 12px">HCI</p>' +
    '<p>رمز التحقق الخاص بك:</p>' +
    '<p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:16px 0">' + code + '</p>' +
    '<p style="color:#4A5D6F;font-size:14px">صالح لمدة 10 دقائق. لا تشارك الرمز مع أي شخص.</p>' +
    '<p style="color:#4A5D6F;font-size:13px;margin-top:24px">منصة HCI لتعلم تفاعل الإنسان والحاسوب</p>' +
    '</div>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: from.includes('<') ? from : 'HCI <' + from + '>',
      to: [to],
      subject,
      html,
      text: otpMessage(code, purpose)
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('Resend error:', res.status, body);
    return { ok: false, error: 'تعذر إرسال رسالة البريد. تحقق من إعدادات Resend.' };
  }
  return { ok: true, channel: 'email', provider: 'resend' };
}

async function sendSmsOtp({ to, code, purpose }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    return { ok: false, error: 'خدمة الرسائل غير مفعّلة. أضف مفاتيح Twilio في Render.' };
  }

  const e164 = toE164Saudi(to);
  if (!e164) {
    return { ok: false, error: 'رقم الهاتف غير صالح للإرسال. استخدم صيغة 05xxxxxxxx' };
  }

  const body = new URLSearchParams();
  body.set('To', e164);
  body.set('From', from);
  body.set('Body', otpMessage(code, purpose));

  const auth = Buffer.from(sid + ':' + token).toString('base64');
  const url = 'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(sid) + '/Messages.json';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + auth,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error('Twilio error:', res.status, errBody);
    return { ok: false, error: 'تعذر إرسال رسالة الهاتف. تحقق من إعدادات Twilio ومعرّف المرسل HCI.' };
  }
  return { ok: true, channel: 'sms', provider: 'twilio' };
}

/**
 * @param {{ channel: 'email'|'phone', target: string, code: string, purpose?: string }} opts
 */
async function deliverOtp(opts) {
  const purpose = opts.purpose || 'verify';
  if (opts.channel === 'email') {
    return sendEmailOtp({ to: opts.target, code: opts.code, purpose });
  }
  return sendSmsOtp({ to: opts.target, code: opts.code, purpose });
}

module.exports = {
  deliverOtp,
  emailConfigured,
  smsConfigured,
  toE164Saudi
};
