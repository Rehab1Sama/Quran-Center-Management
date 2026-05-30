import nodemailer from "nodemailer";

function createTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendEmailOTP(to: string, otp: string): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    throw new Error("لم يتم ضبط EMAIL_USER و EMAIL_PASS في متغيرات البيئة");
  }
  await transporter.sendMail({
    from: `"مقرأة سَنا الآي" <${process.env.EMAIL_USER}>`,
    to,
    subject: "رمز التحقق — مقرأة سنا القرآن",
    html: `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#1e3a5f,#2d7d6f);padding:28px 32px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">مقرأة سَنا الآي</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:13px">التحقق من البريد الإلكتروني</p>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 20px;color:#334155;font-size:15px">أدخلي هذا الرمز في نافذة التسجيل للتحقق من بريدك الإلكتروني:</p>
      <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
        <span style="font-size:42px;font-weight:900;letter-spacing:12px;color:#1e3a5f;font-family:monospace">${otp}</span>
      </div>
      <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center">هذا الرمز صالح لمدة <strong>10 دقائق</strong> فقط<br>إذا لم تطلبي هذا الرمز يمكنك تجاهل هذه الرسالة</p>
    </div>
  </div>
</body>
</html>`,
  });
}
