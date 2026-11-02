import pg from 'pg';
import { config } from './config.js';

// 連線池；所有 SQL 一律用參數化查詢（$1、$2…），不要把使用者輸入組進字串
export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export const query = (text, params) => pool.query(text, params);
