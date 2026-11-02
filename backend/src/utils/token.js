import { createHmac, timingSafeEqual } from 'node:crypto';

// 最小可用的 HS256 JWT（不依賴外部套件）。正式登入時可改用 jsonwebtoken。
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

const sign = (data, secret) => createHmac('sha256', secret).update(data).digest('base64url');

export const signToken = (payload, secret, expiresInSec) => {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ ...payload, iat: now, exp: now + expiresInSec });
  return `${head}.${body}.${sign(`${head}.${body}`, secret)}`;
};

// 驗證簽章與到期時間；通過回傳 payload，否則回傳 null
export const verifyToken = (token, secret) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`, secret));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
};
