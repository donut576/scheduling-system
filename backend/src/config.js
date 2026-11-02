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
};
