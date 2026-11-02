import { createApp } from './app.js';
import { config } from './config.js';

createApp().listen(config.port, () => {
  console.log(`後端已啟動：http://localhost:${config.port}/api/v1/health`);
});
