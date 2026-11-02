# 排班系統後端

Node.js + Express + PostgreSQL 16。API 基底路徑 `/api/v1`，回應格式 `{ code, message, data }`（`code` 為 0 代表成功），與前端 `src/api/instance.ts` 一致。

## 啟動

1. `cp .env.example .env`，填入 `DATABASE_URL`
2. 建表與種子資料（空的資料庫）：
   `psql "$DATABASE_URL" -f db/schema.sql -f db/seed.sql`
3. `npm install`，然後 `npm run dev`
4. 開 http://localhost:3000/api/v1/health ，看到 `"db":"up"` 即成功

## 測試

- `npm test`（需要可連線的資料庫）
- Postman：匯入 `postman/` 內兩個檔案，環境選「Ecolab 本機」

## 目錄

- `src/`：程式（`app.js` 組裝、`routes/` 路由、`middleware/` 錯誤處理、`utils/response.js` 統一回應）
- `db/`：`schema.sql`（30 張表）、`seed.sql`（初始資料）
- `postman/`：API 測試集合

## 暫時固定登入（僅開發用）

`.env` 設 `ENABLE_DEV_LOGIN=true` 後，可用固定帳號登入（`admin`/`admin123`、`manager`/`manager123`、`leader`/`leader123`、`staff`/`staff123`、`TPA02`/`staff123`）。
正式環境不要設定這個變數（預設關閉）；正式登入完成後移除 `src/data/devUsers.js`。
