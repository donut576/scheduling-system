import { createApp } from './app.js';
import { config } from './config.js';
import { startLicenseExpiryJob } from './services/licenseExpiry.js';
import { startDailyMailJob } from './services/mailDigest.js';

createApp().listen(config.port, () => {
  console.log(`後端已啟動：http://localhost:${config.port}/api/v1/health`);
  // 證照到期通知（每 6 小時檢查一次）；不想跑時設 LICENSE_JOB_ENABLED=false
  if (process.env.LICENSE_JOB_ENABLED !== 'false') startLicenseExpiryJob();
  // 每日合併寄信（每分鐘檢查是否到各主任的發送時間）；不想跑時設 MAIL_JOB_ENABLED=false
  if (process.env.MAIL_JOB_ENABLED !== 'false') startDailyMailJob();
});
