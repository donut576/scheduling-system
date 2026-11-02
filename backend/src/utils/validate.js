import { AppError, ERROR_CODES } from './response.js';

// 輕量欄位驗證（不依賴外部套件）。用法：
//   const body = validate(req.body, { name: { type: 'string', required: true, max: 50 } });
// 通過回傳「只含有定義欄位」的新物件（多餘欄位會被丟掉），失敗丟出 422 並列出每個欄位的問題。
// type：string / int / boolean / date（YYYY-MM-DD）/ time（HH:mm）/ enum / array
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const isEmpty = (v) => v === undefined || v === null || v === '';

const check = (v, rule) => {
  switch (rule.type) {
    case 'string':
      if (typeof v !== 'string') return '必須是文字';
      if (rule.max && v.length > rule.max) return `不可超過 ${rule.max} 字`;
      return null;
    case 'int':
      if (!Number.isInteger(v)) return '必須是整數';
      if (rule.min !== undefined && v < rule.min) return `不可小於 ${rule.min}`;
      if (rule.max !== undefined && v > rule.max) return `不可大於 ${rule.max}`;
      return null;
    case 'boolean':
      return typeof v === 'boolean' ? null : '必須是 true 或 false';
    case 'date': {
      if (typeof v !== 'string' || !DATE.test(v)) return '日期格式須為 YYYY-MM-DD';
      const d = new Date(`${v}T00:00:00Z`);
      return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? '不是有效的日期' : null;
    }
    case 'time':
      return typeof v === 'string' && TIME.test(v) ? null : '時間格式須為 HH:mm';
    case 'enum':
      return rule.values.includes(v) ? null : `只能是：${rule.values.join('、')}`;
    case 'array': {
      if (!Array.isArray(v)) return '必須是清單';
      if (rule.max !== undefined && v.length > rule.max) return `最多 ${rule.max} 筆`;
      if (rule.of) {
        for (const item of v) {
          const msg = check(item, rule.of);
          if (msg) return `清單內容錯誤：${msg}`;
        }
      }
      return null;
    }
    default:
      return '未知的欄位型別';
  }
};

export const validate = (input, schema) => {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  const errors = [];
  for (const [field, rule] of Object.entries(schema)) {
    const v = src[field];
    if (isEmpty(v)) {
      if (rule.required) errors.push({ field, message: '必填' });
      continue; // 選填且沒給：不放進結果
    }
    const msg = check(v, rule);
    if (msg) errors.push({ field, message: msg });
    else out[field] = v;
  }
  if (errors.length) {
    throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, `資料驗證失敗：${errors[0].field} ${errors[0].message}`, errors);
  }
  return out;
};

// 路徑上的 id（例如 /tasks/12）必須是正整數字串，避免把亂字串送進資料庫
export const parseId = (value) => {
  if (!/^[1-9]\d{0,17}$/.test(String(value))) {
    throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'id 格式錯誤');
  }
  return String(value);
};
