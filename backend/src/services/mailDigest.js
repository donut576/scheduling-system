import { query, withTransaction } from '../db.js';
import { sendMail } from './mailer.js';
import { diffFields } from './taskChanges.js';
import { hasPermission } from '../middleware/permission.js';
import { parsePaging, toPage } from '../utils/pagination.js';
import { AppError, ERROR_CODES } from '../utils/response.js';

// 每日合併寄信。
// 任務異動由 taskChanges 記進 notification_changes；這裡在「每位主任設定的發送時間」把待寄的異動
// 依「收件人＋群組（早、晚班不合併）」合成一封信：
//   - 這個任務從沒寄給這位收件人過 → 標「新增」（就算寄出前改過幾次，也只寄最新版）
//   - 寄過、之後內容有變 → 標「修改」；寄過、之後取消（或被換掉）→ 標「取消」
//   - 寄出前新增又取消、或改了又改回原樣 → 不寄
// 流程：先把信寫進寄件佇列（email_outbox）並更新「上次寄出的版本」，再從佇列實際寄出（失敗會重試）。

export const MAIL_LOG_DAYS = 7;          // 發送紀錄留幾天
export const DEFAULT_SEND_TIME = '17:00'; // 主任沒設定、或系統沒設預設時用
export const MAX_ATTEMPTS = 3;            // 寄信失敗最多試幾次
export const RETRY_MINUTES = 10;          // 失敗後隔多久重試
const LOCK_ID = 7302;

const ACTION_TEXT = { CREATED: '新增', UPDATED: '修改', CANCELED: '取消' };
const CONTENT_LABEL = { TERMITE: '白蟻', FIRE_ANT: '火蟻', BED_BUG: '臭蟲', VEHICLE_MAINTENANCE: '車輛保養', TRAINING: '培訓', OTHER: '其他' };
// 後端異動欄位 → 信裡的中文（開始、結束、時間型態都算「時間」；換分店、改地址都算「地址」）
const FIELD_LABEL = { date: '日期', timeMode: '時間', startTime: '時間', endTime: '時間', timeRemark: '彈性說明', branchId: '地址', address: '地址', contents: '內容', remarks: '備註', assignees: '施作同仁' };

const contentText = (codes = []) => codes.map((c) => CONTENT_LABEL[c] ?? c).join('、');
const mmdd = (d) => (d ? d.slice(5).replace('-', '/') : '');
const hhmm = (t) => (t ? t.replace(':', '') : '');
const timeText = (s) => (s.timeMode === 'FLEXIBLE' ? '彈性' : hhmm(s.startTime));

// ---------- 純函式（不碰資料庫，方便測試）----------

// 這位收件人、這個任務，這一次該標什麼。
// last：上次寄出的 { last_action, snapshot }，沒寄過是 null；changes：待處理的異動（依時間排序）。
// 回傳 { action, state, changedFields?, previous? } 或 null（不用寄）。
export const resolveLabel = (last, changes, isEmployee = false) => {
  if (changes.length === 0) return null;
  const latest = changes.at(-1);
  const visible = latest.change_type !== 'DELETED';
  const onBooks = Boolean(last) && last.last_action !== 'CANCELED';
  if (!onBooks) return visible ? { action: 'CREATED', state: latest.detail.after } : null;
  if (!visible) return { action: 'CANCELED', state: last.snapshot };
  const fields = diffFields(last.snapshot, latest.detail.after, isEmployee);
  return fields.length ? { action: 'UPDATED', state: latest.detail.after, changedFields: fields, previous: last.snapshot } : null;
};

// 信裡一行：日期 時間 集團・分店　內容　地址
const lineOf = (it) => {
  const s = it.state;
  const parts = [`${mmdd(s.date)} ${timeText(s)}`.trim(), `${s.groupName}・${s.branchName}`, contentText(s.contents), s.address].filter(Boolean);
  let text = parts.join('　');
  if (it.action === 'UPDATED') {
    text += `（${[...new Set(it.changedFields.map((f) => FIELD_LABEL[f] ?? f))].join('、')}已更動）`;
  }
  return text;
};

const sortItems = (items) => [...items].sort((a, b) =>
  `${a.state.date}${a.state.startTime ?? '99:99'}`.localeCompare(`${b.state.date}${b.state.startTime ?? '99:99'}`));

// 組出信件（主旨、純文字、HTML）
export const buildMail = ({ recipientType, recipientName, items, date }) => {
  const isCustomer = recipientType === 'CUSTOMER';
  const subject = isCustomer ? `Ecolab 服務異動通知（${date}）` : `Ecolab 您的排班異動（${date}）`;
  const sections = ['CREATED', 'UPDATED', 'CANCELED']
    .map((a) => ({ action: a, rows: sortItems(items.filter((i) => i.action === a)) }))
    .filter((s) => s.rows.length);
  const text = [
    `${recipientName} 您好，以下是 ${date} 的${isCustomer ? '服務' : '排班'}異動：`,
    ...sections.flatMap((s) => ['', `【${ACTION_TEXT[s.action]}】`, ...s.rows.map((r) => `・${lineOf(r)}`)]),
    '',
    isCustomer ? '若有任何時間調整需求，請隨時與我們聯絡。' : '請準時前往處理並於完成後更新狀態。',
  ].join('\n');
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = [
    `<p>${esc(recipientName)} 您好，以下是 ${esc(date)} 的${isCustomer ? '服務' : '排班'}異動：</p>`,
    ...sections.map((s) => `<p><b>${ACTION_TEXT[s.action]}</b></p><ul>${s.rows.map((r) => `<li>${esc(lineOf(r))}</li>`).join('')}</ul>`),
    `<p>${isCustomer ? '若有任何時間調整需求，請隨時與我們聯絡。' : '請準時前往處理並於完成後更新狀態。'}</p>`,
  ].join('\n');
  return { subject, text, html };
};

// 發送紀錄用：信裡每個任務的摘要
export const toLogItems = (items) => sortItems(items).map((i) => ({
  action: i.action, taskDate: i.state.date, taskTime: i.state.timeMode === 'FLEXIBLE' ? undefined : hhmm(i.state.startTime),
  flexible: i.state.timeMode === 'FLEXIBLE', groupName: i.state.groupName, branchName: i.state.branchName,
  contents: i.state.contents, taskId: i.state.id,
}));

// ---------- 資料庫 ----------

const taipeiNow = async (q) => (await q(`SELECT to_char(now() AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD') AS today,
  to_char(now() AT TIME ZONE 'Asia/Taipei', 'HH24:MI') AS hm`)).rows[0];

// 這個群組的發送設定：主任自己的時間與開關，沒有就用系統預設
const scheduleOf = async (q, regionId) => {
  const def = (await q(`SELECT value FROM system_settings WHERE key = 'notify_default_time'`)).rows[0]?.value ?? DEFAULT_SEND_TIME;
  if (!regionId) return { leaderId: null, sendTime: def, enabled: true };
  const r = (await q(`SELECT rg.leader_id::text AS leader, to_char(ns.send_time, 'HH24:MI') AS send_time, ns.is_enabled
    FROM regions rg LEFT JOIN notification_schedules ns ON ns.user_id = rg.leader_id WHERE rg.id = $1::bigint`, [regionId])).rows[0];
  return { leaderId: r?.leader ?? null, sendTime: r?.send_time ?? def, enabled: r?.is_enabled ?? true };
};

const recipientInfo = async (q, type, id) => {
  if (type === 'EMPLOYEE') {
    const r = (await q('SELECT name, email FROM users WHERE id = $1::bigint', [id])).rows[0];
    return { name: r?.name ?? '', email: r?.email ?? null };
  }
  const r = (await q(`SELECT g.name || ' - ' || c.name AS name, cc.email FROM customer_contacts cc
    JOIN customers c ON c.id = cc.customer_id JOIN customer_groups g ON g.id = c.group_id WHERE cc.id = $1::bigint`, [id])).rows[0];
  return { name: r?.name ?? '', email: r?.email ?? null };
};

// 處理一個群組：把「發送時間之前」累積的待寄異動合成信件，寫進寄件佇列。回傳寄出（排入佇列）幾封。
export const processRegion = async (q, regionId, { cutoffSql = 'now()', cutoffParams = [], sender }) => {
  const rows = (await q(`SELECT id::text AS id, task_id::text AS task_id, change_type, recipient_type,
      recipient_user_id::text AS uid, recipient_contact_id::text AS cid, detail
    FROM notification_changes WHERE status = 'PENDING' AND ${regionId ? 'region_id = $1::bigint' : 'region_id IS NULL'}
      AND created_at <= ${cutoffSql} ORDER BY id FOR UPDATE`, regionId ? [regionId, ...cutoffParams] : cutoffParams)).rows;
  if (rows.length === 0) return 0;
  const { today } = await taipeiNow(q);
  const dateLabel = mmdd(today);

  if (!sender.enabled) { // 這位主任關閉了自動通知：這批異動不寄（之後重新開啟，仍會跟上次寄出的版本比對）
    await q(`UPDATE notification_changes SET status = 'CANCELLED' WHERE id = ANY($1::bigint[])`, [rows.map((r) => r.id)]);
    return 0;
  }

  // 依收件人分組
  const byRecipient = new Map();
  for (const r of rows) {
    const key = r.recipient_type === 'EMPLOYEE' ? `E${r.uid}` : `C${r.cid}`;
    byRecipient.set(key, [...(byRecipient.get(key) ?? []), r]);
  }
  let queued = 0;
  for (const [key, list] of byRecipient) {
    const first = list[0];
    const isEmployee = first.recipient_type === 'EMPLOYEE';
    const byTask = new Map();
    for (const r of list) byTask.set(r.task_id, [...(byTask.get(r.task_id) ?? []), r]);
    const taskIds = [...byTask.keys()];
    const lasts = new Map((await q(`SELECT task_id::text AS task_id, last_action, snapshot FROM mail_task_state
      WHERE recipient_key = $1 AND task_id = ANY($2::bigint[])`, [key, taskIds])).rows.map((r) => [r.task_id, r]));
    const items = [];
    for (const [taskId, changes] of byTask) {
      const label = resolveLabel(lasts.get(taskId) ?? null, changes, isEmployee);
      if (label) items.push({ taskId, ...label });
    }
    await q(`UPDATE notification_changes SET status = 'SENT' WHERE id = ANY($1::bigint[])`, [list.map((r) => r.id)]);
    if (items.length === 0) continue;

    const who = await recipientInfo(q, first.recipient_type, isEmployee ? first.uid : first.cid);
    if (!who.email) { // 沒有 email：記一筆失敗紀錄，這個版本不算寄出（不更新上次寄出的版本）
      await q(`INSERT INTO email_outbox (to_email, subject, body, status, last_error, recipient_type, recipient_user_id, recipient_contact_id, recipient_name, region_id, leader_id, items)
        VALUES ('', $1, '', 'FAILED', '收件人沒有 email', $2, $3::bigint, $4::bigint, $5, $6::bigint, $7::bigint, $8::jsonb)`,
      [`Ecolab 異動通知（${dateLabel}）`, first.recipient_type, isEmployee ? first.uid : null, isEmployee ? null : first.cid, who.name, regionId, sender.leaderId, JSON.stringify(toLogItems(items))]);
      continue;
    }
    const mail = buildMail({ recipientType: first.recipient_type, recipientName: who.name, items, date: dateLabel });
    await q(`INSERT INTO email_outbox (to_email, subject, body, html, status, recipient_type, recipient_user_id, recipient_contact_id, recipient_name, region_id, leader_id, items)
      VALUES ($1, $2, $3, $4, 'QUEUED', $5, $6::bigint, $7::bigint, $8, $9::bigint, $10::bigint, $11::jsonb)`,
    [who.email, mail.subject, mail.text, mail.html, first.recipient_type, isEmployee ? first.uid : null, isEmployee ? null : first.cid,
      who.name, regionId, sender.leaderId, JSON.stringify(toLogItems(items))]);
    for (const it of items) { // 記下這次寄出的版本
      // eslint-disable-next-line no-await-in-loop
      await q(`INSERT INTO mail_task_state (recipient_key, task_id, last_action, snapshot) VALUES ($1, $2::bigint, $3, $4::jsonb)
        ON CONFLICT (recipient_key, task_id) DO UPDATE SET last_action = EXCLUDED.last_action, snapshot = EXCLUDED.snapshot, sent_at = now()`,
      [key, it.taskId, it.action, JSON.stringify(it.state)]);
    }
    queued += 1;
  }
  return queued;
};

// 實際寄出佇列裡到期的信；失敗隔 RETRY_MINUTES 分鐘重試，超過 MAX_ATTEMPTS 次就標失敗
export const deliverOutbox = async (limit = 50) => {
  const picked = await withTransaction(async (q) => {
    const r = await q(`SELECT id::text AS id, to_email, subject, body, html, attempts FROM email_outbox
      WHERE status = 'QUEUED' AND scheduled_at <= now() ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED`, [limit]);
    if (r.rows.length) await q(`UPDATE email_outbox SET status = 'SENDING' WHERE id = ANY($1::bigint[])`, [r.rows.map((x) => x.id)]);
    return r.rows;
  });
  let sent = 0;
  for (const m of picked) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendMail({ to: m.to_email, subject: m.subject, text: m.body, html: m.html ?? undefined });
      // eslint-disable-next-line no-await-in-loop
      await query(`UPDATE email_outbox SET status = 'SENT', attempts = attempts + 1, sent_at = now(), last_error = NULL WHERE id = $1::bigint`, [m.id]);
      sent += 1;
    } catch (e) {
      const attempts = m.attempts + 1;
      // eslint-disable-next-line no-await-in-loop
      await query(`UPDATE email_outbox SET status = $2, attempts = $3, last_error = $4,
          scheduled_at = now() + ($5 || ' minutes')::interval WHERE id = $1::bigint`,
      [m.id, attempts >= MAX_ATTEMPTS ? 'FAILED' : 'QUEUED', attempts, String(e.message).slice(0, 500), String(RETRY_MINUTES)]);
    }
  }
  return sent;
};

// 執行一次每日寄信：找出「到發送時間、今天還沒跑」的群組，處理後把佇列寄出。
// force＝true（手動測試用）：不看發送時間與今天是否已跑，把現有待寄異動全部處理。
export const runDailyMail = async ({ force = false } = {}) => {
  const regions = (await query(`SELECT DISTINCT region_id::text AS id FROM notification_changes WHERE status = 'PENDING'`)).rows.map((r) => r.id);
  let queued = 0;
  for (const regionId of regions) {
    // eslint-disable-next-line no-await-in-loop
    queued += await withTransaction(async (q) => {
      const lock = await q('SELECT pg_try_advisory_xact_lock($1::int, $2::int) AS ok', [LOCK_ID, regionId ? Number(regionId) : 0]);
      if (!lock.rows[0].ok) return 0;
      const sender = await scheduleOf(q, regionId);
      const stateKey = `mail_last_run:${regionId ?? 'none'}`;
      const { today, hm } = await taipeiNow(q);
      if (!force) {
        if (hm < sender.sendTime) return 0;
        const last = (await q('SELECT value FROM system_settings WHERE key = $1', [stateKey])).rows[0]?.value;
        if (last === today) return 0;
      }
      const n = await processRegion(q, regionId, force
        ? { sender }
        : { sender, cutoffSql: `(($${regionId ? 2 : 1}::date + $${regionId ? 3 : 2}::time) AT TIME ZONE 'Asia/Taipei')`, cutoffParams: [today, sender.sendTime] });
      if (!force) {
        await q(`INSERT INTO system_settings (key, value, description) VALUES ($1, $2, '每日寄信：這個群組最後一次執行的日期')
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [stateKey, today]);
      }
      return n;
    });
  }
  const sent = await deliverOutbox();
  return { queued, sent };
};

export const startDailyMailJob = (intervalMs = 60 * 1000) => {
  const run = () => runDailyMail()
    .then((s) => { if (s.queued || s.sent) console.log(`[每日寄信] 排入 ${s.queued} 封，寄出 ${s.sent} 封`); })
    .catch((e) => console.error('[每日寄信] 失敗：', e.message));
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return timer;
};

// ---------- 發送紀錄（儀表板「近期通知發送紀錄」）----------

// 主任只看自己寄出的；副理、管理員看全部；沒有「通知：發送」權限的人（員工）看不到。只含最近 MAIL_LOG_DAYS 天。
export const listMailLog = async (user, rawQuery) => {
  const paging = parsePaging(rawQuery);
  if (!hasPermission(user, 'notification:send')) return toPage([], 0, paging);
  const values = [MAIL_LOG_DAYS];
  let where = `o.status = 'SENT' AND o.sent_at >= now() - ($1 || ' days')::interval`;
  if (user.role === 'LEADER') {
    const me = (await query('SELECT id FROM users WHERE employee_no = $1', [user.no ?? ''])).rows[0]?.id;
    values.push(me ?? 0);
    where += ` AND o.leader_id = $${values.length}::bigint`;
  }
  const total = (await query(`SELECT count(*)::int AS c FROM email_outbox o WHERE ${where}`, values)).rows[0].c;
  values.push(paging.limit, paging.offset);
  const r = await query(`SELECT o.id::text AS id, o.recipient_type, o.recipient_user_id::text AS uid, o.recipient_contact_id::text AS cid,
      o.recipient_name, o.subject, o.body, o.leader_id::text AS leader, o.sent_at, o.items
    FROM email_outbox o WHERE ${where} ORDER BY o.sent_at DESC, o.id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return toPage(r.rows.map((o) => {
    const first = o.items[0] ?? {};
    return {
      id: o.id, type: o.recipient_type === 'CUSTOMER' ? 'CUSTOMER_NOTIFY' : 'EMPLOYEE_DISPATCH',
      recipientType: o.recipient_type, recipientId: o.uid ?? o.cid, recipientName: o.recipient_name,
      subject: o.subject, content: o.body, status: 'NOTIFIED', sentBy: o.leader ?? undefined,
      sentAt: o.sent_at, createdAt: o.sent_at,
      // 前端目前用第一個任務的欄位顯示；多任務時 tasks 放全部（前端之後改成「N 項任務」）
      payload: { kind: 'SEND_LOG', action: first.action, taskDate: first.taskDate, taskTime: first.taskTime, flexible: first.flexible, tasks: o.items },
    };
  }), total, paging);
};

// ---------- 每位主任自己的發送設定（通知設定頁）----------

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const getMySettings = async (user) => {
  const me = (await query('SELECT id FROM users WHERE employee_no = $1', [user.no ?? ''])).rows[0]?.id;
  const r = me ? (await query(`SELECT to_char(send_time, 'HH24:MI') AS "sendTime", is_enabled AS "autoNotifyEnabled" FROM notification_schedules WHERE user_id = $1::bigint`, [me])).rows[0] : null;
  const def = (await query(`SELECT value FROM system_settings WHERE key = 'notify_default_time'`)).rows[0]?.value ?? DEFAULT_SEND_TIME;
  return r ?? { sendTime: def, autoNotifyEnabled: true };
};
export const saveMySettings = async (user, body) => {
  const { sendTime, autoNotifyEnabled } = body ?? {};
  if (typeof sendTime !== 'string' || !HM.test(sendTime) || typeof autoNotifyEnabled !== 'boolean') {
    throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, '資料驗證失敗：sendTime 須為 HH:mm、autoNotifyEnabled 須為布林值');
  }
  const me = (await query('SELECT id FROM users WHERE employee_no = $1', [user.no ?? ''])).rows[0]?.id;
  await query(`INSERT INTO notification_schedules (user_id, send_time, is_enabled) VALUES ($1::bigint, $2::time, $3)
    ON CONFLICT (user_id) DO UPDATE SET send_time = EXCLUDED.send_time, is_enabled = EXCLUDED.is_enabled, updated_at = now()`, [me, sendTime, autoNotifyEnabled]);
  return { sendTime, autoNotifyEnabled };
};
