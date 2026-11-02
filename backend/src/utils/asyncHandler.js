// Express 4 不會自動接住 async 函式裡的錯誤；包一層讓錯誤交給統一錯誤處理
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
