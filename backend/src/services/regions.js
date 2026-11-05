import { query } from '../db.js';
import { WHOLE_CITY_DISTRICTS } from '../data/districts.js';

// 下拉選單的縣市排序（北到南）。沒列到的縣市排最後。
const CITY_ORDER = ['台北市', '新北市', '基隆市', '桃園市', '新竹市', '新竹縣', '苗栗縣', '台中市', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣', '台南市', '高雄市', '屏東縣', '台東縣', '澎湖縣'];
const cityRank = (c) => (CITY_ORDER.includes(c) ? CITY_ORDER.indexOf(c) : CITY_ORDER.length);

// 把 region_areas 的資料列整理成「縣市 → 行政區 → 所屬群組」。純函式，方便測試。
// areaRows: [{ city, district|null, region }]；整個縣市的列（district 為 null）用 WHOLE_CITY_DISTRICTS 展開成各行政區。
export const buildAreaTree = (areaRows) => {
  const cities = new Map(); // city -> Map(district -> Set(region))
  const add = (city, district, region) => {
    if (!cities.has(city)) cities.set(city, new Map());
    const m = cities.get(city);
    if (!m.has(district)) m.set(district, new Set());
    m.get(district).add(region);
  };
  for (const r of areaRows) {
    if (r.district) add(r.city, r.district, r.region);
    else for (const d of WHOLE_CITY_DISTRICTS[r.city] || []) add(r.city, d, r.region);
  }
  return [...cities.entries()]
    .sort((a, b) => cityRank(a[0]) - cityRank(b[0]) || a[0].localeCompare(b[0], 'zh-Hant'))
    .map(([city, ds]) => ({
      city,
      districts: [...ds.entries()].map(([district, regions]) => ({ district, regions: [...regions].sort() })),
    }));
};

const AREA_SQL = `SELECT ra.city, ra.district, r.name AS region
  FROM region_areas ra JOIN regions r ON r.id = ra.region_id ORDER BY r.id, ra.city, ra.district NULLS FIRST`;

// GET /regions/areas：9 個群組（含顏色）與客戶可選的縣市、行政區
export const getRegionAreas = async (q = query) => {
  const [regions, areas] = await Promise.all([
    q('SELECT id, name, color FROM regions ORDER BY id'),
    q(AREA_SQL),
  ]);
  return {
    regions: regions.rows.map((r) => ({ id: String(r.id), name: r.name, color: r.color })),
    cities: buildAreaTree(areas.rows),
  };
};

// 某個縣市＋行政區屬於哪些群組（名稱）。不在任何規則內（含行政區不屬於該縣市）回傳空陣列。
export const regionsOfArea = async (q, city, district) => {
  const areas = await q(AREA_SQL);
  const tree = buildAreaTree(areas.rows);
  const d = tree.find((c) => c.city === city)?.districts.find((x) => x.district === district);
  return d ? d.regions : [];
};
