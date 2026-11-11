import { pool } from '../db.js';
import { ROLE_PERMISSIONS } from '../data/rolePermissions.js';

// 角色的權限從資料庫（roles、permissions、role_permissions）讀取，放在記憶體裡快取，
// 所以 hasPermission 這類同步判斷不需要改成 async。
//   - 每個請求經過 requireAuth 時會呼叫 ensurePermissions()，快取超過 TTL 才會重新查資料庫。
//     在資料庫改了權限，最多 TTL 秒後生效，不用重啟後端。
//   - 還沒載入過（例如單元測試直接呼叫）時，退回 data/rolePermissions.js 的預設值。
//   - 載入後以資料庫為準：資料庫沒有的角色，或沒授權的權限，一律視為沒有（寧可擋掉，不放行）。
//   - 資料庫暫時查不到時，沿用上一次的快取；從來沒載入成功過才丟錯。

// 資料庫的角色代碼 → 程式與前端使用的代碼
const ROLE_ALIAS = { EMPLOYEE: 'STAFF' };
export const PERMISSIONS_TTL_MS = 30_000;

let cache = null; // Map<角色, Set<權限代碼>>
let loadedAt = 0;
let loading = null;

export const loadPermissions = async () => {
  const r = await pool.query(
    `SELECT ro.code AS role, p.code AS permission
     FROM roles ro
     LEFT JOIN role_permissions rp ON rp.role_id = ro.id
     LEFT JOIN permissions p ON p.id = rp.permission_id`);
  const map = new Map();
  for (const row of r.rows) {
    const role = ROLE_ALIAS[row.role] || row.role;
    if (!map.has(role)) map.set(role, new Set());
    if (row.permission) map.get(role).add(row.permission);
  }
  cache = map;
  loadedAt = Date.now();
  return map;
};

// 快取還新就直接返回；過期才重新載入。同時有很多請求時只會查一次。
export const ensurePermissions = async () => {
  if (cache && Date.now() - loadedAt < PERMISSIONS_TTL_MS) return;
  loading ??= loadPermissions().finally(() => { loading = null; });
  try {
    await loading;
  } catch (e) {
    if (!cache) throw e;
    console.error('[permissions] 重新載入失敗，沿用舊的權限快取：', e.message);
    loadedAt = Date.now() - PERMISSIONS_TTL_MS + 5000; // 5 秒後再試
  }
};

// 立刻讓快取失效（改了權限、或測試用）；下一個請求會重新載入
export const invalidatePermissions = () => { loadedAt = 0; };

export const permissionsOf = (role) => {
  if (!cache) return ROLE_PERMISSIONS[role] || [];
  return [...(cache.get(role) || [])];
};

export const roleHasPermission = (role, code) => {
  if (!cache) return (ROLE_PERMISSIONS[role] || []).includes(code);
  return cache.get(role)?.has(code) ?? false;
};
