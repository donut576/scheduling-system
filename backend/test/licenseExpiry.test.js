import test from 'node:test';
import assert from 'node:assert/strict';
import { bucketOf, buildLicensePayload } from '../src/services/licenseExpiry.js';

test('剩餘天數落在哪個門檻（7、14、30）', () => {
  assert.equal(bucketOf(0), 7);
  assert.equal(bucketOf(7), 7);
  assert.equal(bucketOf(8), 14);
  assert.equal(bucketOf(14), 14);
  assert.equal(bucketOf(15), 30);
  assert.equal(bucketOf(30), 30);
});

test('已過期或還很久：不在通知範圍', () => {
  assert.equal(bucketOf(-1), null);
  assert.equal(bucketOf(31), null);
  assert.equal(bucketOf(Number.NaN), null);
});

test('payload 對齊前端 LicenseExpiryPayload，並帶去重用的 key', () => {
  const p = buildLicensePayload({ uid: '3', lid: '1', name: 'Demo 員工', license_name: '專技', exp: '2026-12-01', days_left: 15 });
  assert.equal(p.kind, 'LICENSE_EXPIRY');
  assert.equal(p.employeeName, 'Demo 員工');
  assert.equal(p.license, '專技');
  assert.equal(p.expiryDate, '2026-12-01');
  assert.equal(p.daysLeft, 15);
  assert.equal(p.bucket, 30);
  assert.equal(p.key, '3:1:2026-12-01');
});
