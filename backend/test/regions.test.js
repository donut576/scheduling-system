import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAreaTree } from '../src/services/regions.js';
import { restrictionFrom } from '../src/services/customerWrite.js';
import { WHOLE_CITY_DISTRICTS } from '../src/data/districts.js';

test('縣市行政區：部分行政區的縣市只列出規則內的區，並合併多個群組', () => {
  const tree = buildAreaTree([
    { city: '台北市', district: '士林區', region: '北一晚' },
    { city: '台北市', district: '士林區', region: '北早' },
    { city: '台北市', district: '大安區', region: '北二晚' },
  ]);
  assert.deepEqual(tree, [{ city: '台北市', districts: [
    { district: '士林區', regions: ['北一晚', '北早'] },
    { district: '大安區', regions: ['北二晚'] },
  ] }]);
});

test('縣市行政區：整個縣市的規則展開成該縣市所有行政區', () => {
  const tree = buildAreaTree([{ city: '嘉義市', district: null, region: '嘉義' }]);
  assert.deepEqual(tree[0].districts.map((d) => d.district), ['東區', '西區']);
  assert.deepEqual(tree[0].districts[0].regions, ['嘉義']);
});

test('縣市行政區：縣市由北到南排序，行政區清單數量正確', () => {
  const tree = buildAreaTree([
    { city: '台南市', district: null, region: '南區' },
    { city: '台北市', district: '士林區', region: '北早' },
    { city: '基隆市', district: null, region: '北早' },
  ]);
  assert.deepEqual(tree.map((c) => c.city), ['台北市', '基隆市', '台南市']);
  const n = Object.fromEntries(Object.entries(WHOLE_CITY_DISTRICTS).map(([k, v]) => [k, v.length]));
  assert.deepEqual(n, { 基隆市: 7, 台中市: 29, 彰化縣: 26, 南投縣: 13, 雲林縣: 20, 嘉義市: 2, 嘉義縣: 18, 台南市: 37, 高雄市: 38, 屏東縣: 33, 台東縣: 16, 澎湖縣: 6 });
  for (const list of Object.values(WHOLE_CITY_DISTRICTS)) assert.equal(new Set(list).size, list.length);
});

test('證照限制：前端傳證照清單時換成單一限制，專技優先於施藥', () => {
  assert.equal(restrictionFrom({ requiredLicenses: ['NONE'] }), 'NONE');
  assert.equal(restrictionFrom({ requiredLicenses: ['PEST_CONTROL'] }), 'PEST_CONTROL');
  assert.equal(restrictionFrom({ requiredLicenses: ['PEST_CONTROL', 'PROFESSIONAL'] }), 'PROFESSIONAL');
  assert.equal(restrictionFrom({ licenseRestriction: 'CUSTOM', requiredLicenses: [] }), 'CUSTOM');
  assert.equal(restrictionFrom({}), undefined);
});
