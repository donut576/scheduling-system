import { REGION_GROUPS, SEE_ALL_ROLES } from '../config/visibility.js';

// 依登入者決定能看到哪些轄區的任務（以任務所屬客戶的轄區為準）。
// 回傳 { all: true }（不限制）或 { regionNames: [...] }（只能看這些轄區；空陣列代表什麼都看不到）。
// getUserRegionName：傳入員工編號，回傳該員工的轄區名稱（沒有則 null）。方便測試時注入。
export const resolveTaskScope = async (user, getUserRegionName) => {
  if (SEE_ALL_ROLES.includes(user.role)) return { all: true };
  const own = user.no ? await getUserRegionName(user.no) : null;
  if (!own) return { regionNames: [] };
  if (user.role === 'LEADER') {
    const group = REGION_GROUPS.find((g) => g.includes(own));
    return { regionNames: group ? [...group] : [own] };
  }
  return { regionNames: [own] };
};
