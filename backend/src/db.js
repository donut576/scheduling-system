import pg from 'pg';
import { config } from './config.js';

// 連線池；所有 SQL 一律用參數化查詢（$1、$2…），不要把使用者輸入組進字串
export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export const query = (text, params) => pool.query(text, params);

// 交易：fn 收到一個 q(sql, params)，裡面的查詢都在同一個連線、同一筆交易。
// fn 正常結束就 COMMIT，丟出錯誤就 ROLLBACK（新增任務時，任務、內容、指派人員要全部成功或全部不成立）
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn((text, params) => client.query(text, params));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* 連線已壞時忽略，原始錯誤更重要 */ }
    throw err;
  } finally {
    client.release();
  }
};
