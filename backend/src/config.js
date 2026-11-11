import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  // 簽發 token 用的密鑰；正式環境必須換成長隨機字串
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  tokenTtlSec: Number(process.env.TOKEN_TTL_SEC || 7200),
  // 暫時固定登入：只有明確設為 true 才啟用，預設關閉
  enableDevLogin: process.env.ENABLE_DEV_LOGIN === 'true',

    // 忘記密碼寄信：信裡的連結指向前端網址；連結有效分鐘數；同一位員工兩次申請的最短間隔（秒）
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  resetTokenTtlMin: Number(process.env.RESET_TOKEN_TTL_MIN || 30),
  resetRequestIntervalSec: Number(process.env.RESET_REQUEST_INTERVAL_SEC || 300),
  // 寄信（SMTP）。沒設定 SMTP_HOST 時不會真的寄，只把信件內容印在後端終端機（開發用）
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@example.com',
  },
};
