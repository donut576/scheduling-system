import { config } from '../config.js';

// 寄信。沒設定 SMTP_HOST（開發、測試）時不會真的寄，只把信件內容印在後端終端機，
// 並記在 sentMails 裡（測試用）。設定 SMTP_HOST 後才會用 nodemailer 實際寄出。
// nodemailer 只在真的要寄信時才載入，沒安裝也不影響其他功能。

export const sentMails = []; // 只在「不實際寄信」的模式下記錄，最多保留 50 封
let transporter = null;

const getTransporter = async () => {
  if (transporter) return transporter;
  const { default: nodemailer } = await import('nodemailer');
  const { host, port, user, pass } = config.smtp;
  transporter = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });
  return transporter;
};

export const sendMail = async ({ to, subject, text, html }) => {
  if (!config.smtp.host) {
    sentMails.push({ to, subject, text, html, at: new Date() });
    if (sentMails.length > 50) sentMails.shift();
    console.log(`[mailer] 未設定 SMTP，不實際寄信\n  收件者：${to}\n  主旨：${subject}\n${text.split('\n').map((l) => `  ${l}`).join('\n')}`);
    return { delivered: false };
  }
  const t = await getTransporter();
  const info = await t.sendMail({ from: config.smtp.from, to, subject, text, html });
  console.log(`[mailer] 已寄出給 ${to}，SMTP 回應：${info.response}`);
  return { delivered: true };
};
