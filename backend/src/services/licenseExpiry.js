import { withTransaction } from '../db.js';

// 證照到期通知：每天檢查一次，員工的證照在 30 天內到期，就在「負責主任」的系統通知出現一筆。
// - 同一位主任、同一張證照（同一個到期日）只有一筆，之後每天更新剩餘天數
// - 跨過 30、14、7 天這幾個門檻時，重設為未讀並更新時間（提醒再看一次）
// - 證照更新（到期日變了）或員工離職／停用後，舊的通知會被清掉
// - 員工所屬群組沒有設主任 → 沒有人可通知，略過
export const LICENSE_NOTICE_DAYS = 30; // 幾天內到期開始通知
export const LICENSE_BUCKETS = [7, 14, 30]; // 門檻：跨過就重新提醒
const LOCK_ID = 7301; // 多台後端同時跑時，只讓一台執行

// 剩餘天數 → 所在的門檻；超出範圍（已到期或還很久）回傳 null
export const bucketOf = (daysLeft) => {
  if (!Number.isInteger(daysLeft) || daysLeft < 0 || daysLeft > LICENSE_NOTICE_DAYS) return null;
  return LICENSE_BUCKETS.find((b) => daysLeft <= b) ?? null;
};

export const buildLicensePayload = (row) => ({
  kind: 'LICENSE_EXPIRY',
  employeeName: row.name,
  license: row.license_name,
  expiryDate: row.exp,
  daysLeft: row.days_left,
  bucket: bucketOf(row.days_left),
  key: `${row.uid}:${row.lid}:${row.exp}`,
});

export const runLicenseExpiryCheck = () => withTransaction(async (q) => {
  const lock = await q('SELECT pg_try_advisory_xact_lock($1) AS ok', [LOCK_ID]);
  if (!lock.rows[0].ok) return { skipped: true };

  const r = await q(`SELECT u.id::text AS uid, u.name, l.license_name, ul.license_id::text AS lid, ul.expires_on::text AS exp,
      (ul.expires_on - (now() AT TIME ZONE 'Asia/Taipei')::date)::int AS days_left, rg.leader_id::text AS leader
    FROM user_licenses ul
    JOIN users u ON u.id = ul.user_id AND u.is_active
    JOIN licenses l ON l.id = ul.license_id
    JOIN regions rg ON rg.id = u.region_id AND rg.leader_id IS NOT NULL
    WHERE ul.expires_on IS NOT NULL
      AND ul.expires_on - (now() AT TIME ZONE 'Asia/Taipei')::date BETWEEN 0 AND $1::int
    ORDER BY ul.expires_on, u.id`, [LICENSE_NOTICE_DAYS]);

  const keep = [];
  for (const row of r.rows) {
    const payload = buildLicensePayload(row);
    keep.push(`${row.leader}|${payload.key}`);
    const subject = `證照即將到期：${row.name} ${row.license_name}（剩 ${row.days_left} 天）`;
    const content = `${row.name} 的「${row.license_name}」將於 ${row.exp} 到期，剩 ${row.days_left} 天。`;
    // 同一筆通知每天更新；跨過門檻才重設未讀並更新時間
    // eslint-disable-next-line no-await-in-loop
    await q(`INSERT INTO notifications (type, channel, recipient_user_id, subject, content, payload)
      VALUES ('LICENSE_EXPIRY', 'IN_APP', $1::bigint, $2, $3, $4::jsonb)
      ON CONFLICT (recipient_user_id, (payload->>'key')) WHERE type = 'LICENSE_EXPIRY' AND channel = 'IN_APP'
      DO UPDATE SET subject = EXCLUDED.subject, content = EXCLUDED.content, payload = EXCLUDED.payload, updated_at = now(),
        is_read = CASE WHEN notifications.payload->>'bucket' IS DISTINCT FROM EXCLUDED.payload->>'bucket' THEN false ELSE notifications.is_read END,
        read_at = CASE WHEN notifications.payload->>'bucket' IS DISTINCT FROM EXCLUDED.payload->>'bucket' THEN NULL ELSE notifications.read_at END,
        created_at = CASE WHEN notifications.payload->>'bucket' IS DISTINCT FROM EXCLUDED.payload->>'bucket' THEN now() ELSE notifications.created_at END`,
    [row.leader, subject, content, JSON.stringify(payload)]);
  }

  // 清掉已經不需要的通知（證照更新、員工停用、已過期…）
  const removed = await q(`DELETE FROM notifications WHERE type = 'LICENSE_EXPIRY' AND channel = 'IN_APP'
    AND (recipient_user_id::text || '|' || (payload->>'key')) <> ALL($1::text[]) RETURNING id`, [keep]);
  return { skipped: false, notified: r.rows.length, removed: removed.rows.length };
});

// 啟動時跑一次，之後每 6 小時一次（同一天重複跑只會更新，不會重複通知）
export const startLicenseExpiryJob = (intervalMs = 6 * 60 * 60 * 1000) => {
  const run = () => runLicenseExpiryCheck()
    .then((s) => { if (!s.skipped) console.log(`[證照到期] 通知 ${s.notified} 筆，清除 ${s.removed} 筆`); })
    .catch((e) => console.error('[證照到期] 檢查失敗：', e.message));
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return timer;
};
