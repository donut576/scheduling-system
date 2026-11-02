// 分頁：page 從 1 開始；pageSize 預設 20、最多 100。回傳格式對齊前端 PaginatedResponse
export const parsePaging = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
};

export const toPage = (list, total, { page, pageSize }) => ({ list, total, page, pageSize });
