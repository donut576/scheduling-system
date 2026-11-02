import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, parseId } from '../src/utils/validate.js';
import { parsePaging, toPage } from '../src/utils/pagination.js';
import { requirePermission } from '../src/middleware/permission.js';
import { errorHandler } from '../src/middleware/error.js';
import { AppError, ERROR_CODES } from '../src/utils/response.js';

const schema = {
  name: { type: 'string', required: true, max: 5 },
  count: { type: 'int', min: 1, max: 10 },
  day: { type: 'date' },
  at: { type: 'time' },
  kind: { type: 'enum', values: ['A', 'B'] },
  tags: { type: 'array', of: { type: 'string' }, max: 2 },
};
const fail = (input) => {
  try { validate(input, schema); } catch (e) { return e; }
  assert.fail('應該驗證失敗');
};

test('validate：通過時只留下有定義的欄位', () => {
  const out = validate({ name: 'abc', count: 3, extra: 'x', day: '2026-11-02', at: '08:30', kind: 'A', tags: ['a'] }, schema);
  assert.deepEqual(out, { name: 'abc', count: 3, day: '2026-11-02', at: '08:30', kind: 'A', tags: ['a'] });
});

test('validate：必填缺漏、空字串都算沒給；選填沒給不出現', () => {
  assert.equal(fail({}).details[0].field, 'name');
  assert.equal(fail({ name: '' }).details[0].field, 'name');
  assert.deepEqual(validate({ name: 'a' }, schema), { name: 'a' });
});

test('validate：型別、範圍、格式錯誤都回 422 並指出欄位', () => {
  const e = fail({ name: 'toolong', count: 0, day: '2026-02-30', at: '25:00', kind: 'Z', tags: ['a', 'b', 'c'] });
  assert.equal(e.status, 422);
  assert.equal(e.code, ERROR_CODES.VALIDATION_ERROR);
  assert.deepEqual(e.details.map((d) => d.field), ['name', 'count', 'day', 'at', 'kind', 'tags']);
  assert.equal(fail({ name: 'a', count: '3' }).details[0].field, 'count'); // 字串數字不算整數
});

test('validate：body 不是物件也不會當掉', () => {
  assert.equal(fail(null).details[0].field, 'name');
});

test('parseId：只接受正整數字串', () => {
  assert.equal(parseId('12'), '12');
  for (const bad of ['0', '-1', 'abc', '1; DROP TABLE tasks', '', '012']) {
    assert.throws(() => parseId(bad), (e) => e.status === 422);
  }
});

test('分頁：預設值、上下限與偏移量', () => {
  assert.deepEqual(parsePaging({}), { page: 1, pageSize: 20, limit: 20, offset: 0 });
  assert.equal(parsePaging({ page: '3', pageSize: '10' }).offset, 20);
  assert.equal(parsePaging({ pageSize: '9999' }).pageSize, 100);
  assert.equal(parsePaging({ page: '-5', pageSize: 'x' }).page, 1);
  assert.deepEqual(toPage([1], 1, { page: 2, pageSize: 5 }), { list: [1], total: 1, page: 2, pageSize: 5 });
});

test('權限檢查：有權限放行，沒有權限回 403', () => {
  const run = (role, code) => {
    let result;
    requirePermission(code)({ user: { role } }, {}, (e) => { result = e; });
    return result;
  };
  assert.equal(run('LEADER', 'task:create'), undefined);
  assert.equal(run('STAFF', 'task:create').status, 403);
  assert.equal(run('UNKNOWN', 'task:view').status, 403);
});

const callHandler = (err) => {
  const res = { status(s) { this.s = s; return this; }, json(b) { this.b = b; return this; } };
  const orig = console.error; console.error = () => {};
  errorHandler(err, {}, res, () => {});
  console.error = orig;
  return res;
};

test('錯誤處理：驗證錯誤帶欄位清單，格式維持 { code, message, data }', () => {
  const res = callHandler(new AppError(422, 42201, '資料驗證失敗：name 必填', [{ field: 'name', message: '必填' }]));
  assert.equal(res.s, 422);
  assert.deepEqual(res.b.data.errors, [{ field: 'name', message: '必填' }]);
});

test('錯誤處理：資料庫錯誤轉成友善訊息，不洩漏細節；未知錯誤回 500', () => {
  assert.equal(callHandler({ code: '23505', constraint: 'uq_customers_group_name_active' }).s, 409);
  assert.equal(callHandler({ code: '23503' }).s, 422);
  const res = callHandler(new Error('connection to 10.0.0.5 refused'));
  assert.equal(res.s, 500);
  assert.equal(res.b.message, '伺服器發生錯誤');
  assert.equal(callHandler({ type: 'entity.parse.failed' }).s, 400);
});
