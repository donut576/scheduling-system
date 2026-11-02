// 下拉選單字典：從資料庫讀出，組成前端 useDictStore 需要的 { label, value } 格式。
// 任務類型與路線目前沒有對應資料表，沿用前端現有的固定選項。
export const TASK_TYPES = [
  { label: '合約', value: 'CONTRACT' },
  { label: '單次', value: 'ONETIME' },
  { label: 'ESR', value: 'ESR' },
];

export const ROUTES = ['第一路', '第二路', '第三路', '第四路', '第五路', '第六路', '第七路', '第八路']
  .map((r) => ({ label: r, value: r }));

// query 以參數注入，方便測試（正式使用時傳入 db.js 的 query）
export const buildDict = async (query) => {
  const [contents, shifts, licenses, positions] = await Promise.all([
    query('SELECT code, name FROM service_contents ORDER BY id'),
    query('SELECT name FROM shifts ORDER BY id'),
    query('SELECT code, license_name FROM licenses ORDER BY id'),
    query('SELECT code, name FROM positions ORDER BY id'),
  ]);
  return {
    taskTypes: TASK_TYPES,
    shifts: shifts.rows.map((r) => ({ label: r.name, value: r.name })),
    routes: ROUTES,
    contents: contents.rows.map((r) => ({ label: r.name, value: r.code })),
    // 前端的證照選單第一項是「無」
    licenses: [{ label: '無', value: 'NONE' }, ...licenses.rows.map((r) => ({ label: r.license_name, value: r.code }))],
    positions: positions.rows.map((r) => ({ label: r.name, value: r.code })),
  };
};
