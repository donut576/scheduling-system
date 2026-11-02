import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { dictRouter } from './routes/dict.js';
import { notFound, errorHandler } from './middleware/error.js';

export const createApp = () => {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  // 前端的 baseURL 是 {host}/api/v1
  app.use('/api/v1', healthRouter);
  app.use('/api/v1', authRouter);
  app.use('/api/v1', dictRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
