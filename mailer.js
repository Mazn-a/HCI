/* mailer.js — إرسال بريد حقيقي لرموز التحقق (اختياري)
   بدون إعداد SMTP، يبقى النظام يعمل بوضع العرض (demoCode) كما كان.
   لتفعيل الإرسال الحقيقي أضف بمتغيرات البيئة (Render → Environment أو .env محلياً):
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=465
     SMTP_USER=you@gmail.com
     SMTP_PASS=xxxxxxxxxxxxxxxx   (App Password من إعدادات جوجل، ليس كلمة المرور العادية)
     SMTP_FROM="HCI <you@gmail.com>"   (اختياري، افتراضياً يستخدم SMTP_USER)
*/
const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim();
const SMTP_FROM = String(process.env.SMTP_FROM || SMTP_USER || '').trim();

const isConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
if (isConfigured) {
  try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
    console.log('HCI Mail: SMTP مفعّل (' + SMTP_HOST + ') — سيصل رمز التحقق فعلياً بالبريد.');
  } catch (err) {
    console.error('HCI Mail: تعذر تهيئة SMTP:', err.message);
    transporter = null;
  }
} else {
  console.log('HCI Mail: SMTP غير مُعد — سيظهر رمز التحقق بالواجهة (وضع تجريبي) بدل إرساله بالبريد.');
}

function otpEmailHtml(code, purpose) {
  const title = purpose === 'reset' ? 'إعادة تعيين كلمة المرور' : 'تأكيد بريدك الإلكتروني';
  return (
    '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#0b0b0b;padding:32px;color:#eee">' +
      '<div style="max-width:420px;margin:0 auto;background:#151515;border:1px solid rgba(184,148,84,0.35);border-radius:12px;padding:28px;text-align:center">' +
        '<p style="letter-spacing:0.15em;color:#B89454;font-weight:700;margin:0 0 18px">HCI</p>' +
        '<h1 style="font-size:18px;margin:0 0 10px;color:#fff">' + title + '</h1>' +
        '<p style="color:#aaa;font-size:13px;margin:0 0 20px">استخدم الرمز التالي خلال 10 دقائق:</p>' +
        '<p style="font-size:32px;font-weight:700;letter-spacing:0.3em;color:#fff;background:#0b0b0b;border:1px solid rgba(184,148,84,0.4);border-radius:10px;padding:14px 0;margin:0 0 18px">' + code + '</p>' +
        '<p style="color:#777;font-size:11px;margin:0">لو ما طلبت هذا الرمز، تجاهل هذه الرسالة.</p>' +
      '</div>' +
    '</div>'
  );
}

/* يرجع true لو انبعث البريد فعلياً، false لو الوضع تجريبي (يبقى العرض بالواجهة كما كان) */
async function sendOtpEmail(to, code, purpose) {
  if (!transporter) return false;
  try {
    await transporter.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to: to,
      subject: 'رمز التحقق — HCI',
      html: otpEmailHtml(code, purpose)
    });
    return true;
  } catch (err) {
    console.error('HCI Mail: فشل إرسال رمز التحقق:', err.message);
    return false;
  }
}

module.exports = { sendOtpEmail, isConfigured: isConfigured };
