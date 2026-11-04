import { query } from '../db.js';
import { resolveTaskScope } from './taskScope.js';

const regionOfUser = async (employeeNo) => {
  const r = await query('SELECT rg.name FROM users u JOIN regions rg ON rg.id = u.region_id WHERE u.employee_no = $1', [employeeNo]);
  return r.rows[0]?.name ?? null;
};

// 登入者可看到的轄區範圍（任務、客戶、員工共用同一套規則）
export const getScope = (user) => resolveTaskScope(user, regionOfUser);

// 把範圍轉成 SQL 條件。regionNameSql 是轄區名稱欄位（例如 'r.name'）。
// 不限範圍回傳 null；沒有任何轄區可看回傳 'FALSE'。值一律放進 values 用參數傳入。
export const scopeCondition = (scope, regionNameSql, values) => {
  if (scope.all) return null;
  if (scope.regionNames.length === 0) return 'FALSE';
  values.push(scope.regionNames);
  return `${regionNameSql} = ANY($${values.length}::text[])`;
};
