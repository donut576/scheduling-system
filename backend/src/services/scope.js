import { query } from '../db.js';
import { resolveTaskScope } from './taskScope.js';

const regionOfUser = async (employeeNo) => {
  const r = await query('SELECT rg.name FROM users u JOIN regions rg ON rg.id = u.region_id WHERE u.employee_no = $1', [employeeNo]);
  return r.rows[0]?.name ?? null;
};

// 登入者可看到的轄區範圍（任務、客戶、員工共用同一套規則）
export const getScope = (user) => resolveTaskScope(user, regionOfUser);

// ===== 客戶 ↔ 群組（北早、北一晚…）=====
// 客戶的群組由客戶的縣市、行政區比對 region_areas 算出；一個客戶可能屬於多個群組。
// c 是客戶資料表在 SQL 裡的別名（通常是 'c'）。
const areaMatch = (c) => `ra.city = ${c}.city AND (ra.district IS NULL OR ra.district = ${c}.district)`;

// 客戶的「主要群組」（顯示名稱、顏色用）：符合的群組裡 id 最小的一個。用法：放在 FROM 後面，之後用 r.name、r.color。
export const CUSTOMER_REGION_JOIN = `LEFT JOIN regions r ON r.id = (
  SELECT ra.region_id FROM region_areas ra WHERE ${areaMatch('c')} ORDER BY ra.region_id LIMIT 1)`;

// 客戶是否屬於指定名稱的群組之一。placeholder 是已經放進 values 的參數位置（例如 '$3'，內容是字串陣列）。
export const customerInRegionNames = (c, placeholder) => `EXISTS (
  SELECT 1 FROM region_areas ra JOIN regions rg ON rg.id = ra.region_id
  WHERE ${areaMatch(c)} AND rg.name = ANY(${placeholder}::text[]))`;

// 客戶是否屬於指定 id 的群組（placeholder 的內容是群組 id）
export const customerInRegionId = (c, placeholder) => `EXISTS (
  SELECT 1 FROM region_areas ra WHERE ra.region_id = ${placeholder}::bigint AND ${areaMatch(c)})`;

// 登入者的範圍 → 客戶的 SQL 條件。不限範圍回傳 null；沒有任何群組可看回傳 'FALSE'。
export const customerScopeCondition = (scope, values, c = 'c') => {
  if (scope.all) return null;
  if (scope.regionNames.length === 0) return 'FALSE';
  values.push(scope.regionNames);
  return customerInRegionNames(c, `$${values.length}`);
};

// 把範圍轉成 SQL 條件（員工用：員工自己所屬群組的名稱欄位）。regionNameSql 是轄區名稱欄位（例如 'r.name'）。
// 不限範圍回傳 null；沒有任何轄區可看回傳 'FALSE'。值一律放進 values 用參數傳入。
export const scopeCondition = (scope, regionNameSql, values) => {
  if (scope.all) return null;
  if (scope.regionNames.length === 0) return 'FALSE';
  values.push(scope.regionNames);
  return `${regionNameSql} = ANY($${values.length}::text[])`;
};
