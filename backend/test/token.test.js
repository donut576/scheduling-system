import test from 'node:test';
import assert from 'node:assert/strict';
import { signToken, verifyToken } from '../src/utils/token.js';

test('簽發的 token 可以驗證並取回內容', () => {
  const t = signToken({ sub: '1', role: 'ADMIN' }, 'secret', 60);
  const p = verifyToken(t, 'secret');
  assert.equal(p.sub, '1');
  assert.equal(p.role, 'ADMIN');
});

test('密鑰不同、內容被改、已過期、格式錯誤都驗證失敗', () => {
  const t = signToken({ sub: '1' }, 'secret', 60);
  assert.equal(verifyToken(t, 'other'), null);
  const [h, , s] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ sub: '9', exp: 9999999999 })).toString('base64url');
  assert.equal(verifyToken(`${h}.${forged}.${s}`, 'secret'), null);
  assert.equal(verifyToken(signToken({ sub: '1' }, 'secret', -10), 'secret'), null);
  assert.equal(verifyToken('abc', 'secret'), null);
  assert.equal(verifyToken(undefined, 'secret'), null);
});
