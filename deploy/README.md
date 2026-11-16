# 排班系統部署步驟（加進現有的 shift 環境）

前置：程式合併進 main 後，GitHub Actions 會建置兩個映像檔

- ghcr.io/donut576/scheduling-system（前端）
- ghcr.io/donut576/scheduling-system-backend（後端）
  映像檔若為私人，伺服器需先 `docker login ghcr.io`（帳號＋有 read:packages 的 token）。

## 1. 在現有 PostgreSQL 建專用資料庫（只做一次）

在伺服器上，取得專案的 backend/db 資料夾（git clone 或複製這三個檔案：schema.sql、seed.sql、dev-sample.sql）後：

```bash
docker exec -i shift-postgres psql -U shift_admin -d postgres <<'SQL'
CREATE USER scheduling_app WITH PASSWORD '請換成長隨機字串';
CREATE DATABASE scheduling OWNER scheduling_app;
SQL
for f in schema seed dev-sample; do
  docker exec -i shift-postgres psql -v ON_ERROR_STOP=1 -U scheduling_app -d scheduling < backend/db/$f.sql
done
```

## 2. 環境變數

同資料夾 .env 加入：

```
SCHEDULING_DB_PASSWORD=（和上面建立使用者時同一個密碼）
SCHEDULING_JWT_SECRET=（長隨機字串，例如 openssl rand -hex 32）
SCHEDULING_PUBLIC_URL=（使用者實際開的網址，例如 http://shift-schedule.ecolab-taiwan.com.tw）
```

## 3. 加入服務

- 把 docker-compose.scheduling.yml 的兩個服務貼進 docker-compose.yml 的 services 區塊
- scheduling-nginx.conf 放在 docker-compose.yml 同一個資料夾
- 總機 Nginx 加入 proxy-nginx-snippet.conf 的設定並重新載入

## 4. 啟動

```bash
docker compose up -d scheduling-backend scheduling-frontend
curl http://localhost/api/v1/health   # 經過總機時改成實際網址；看到 "db":"up" 就成功
```

## 之後更新

```bash
docker compose pull scheduling-backend scheduling-frontend
docker compose up -d scheduling-backend scheduling-frontend
```

資料庫有異動時，開發者會附 migrate-xxx.sql，用：
`docker exec -i shift-postgres psql -U scheduling_app -d scheduling < migrate-xxx.sql`
