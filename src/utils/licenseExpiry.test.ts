import { describe, expect, it } from 'vitest';
import {
  buildLicenseDetails,
  daysBetween,
  getLicenseState,
  isLicenseValidOn,
  licenseCodesValidOn,
} from './licenseExpiry';

const TODAY = '2026-11-09';

describe('licenseExpiry', () => {
  it('沒有到期日 = 長期有效', () => {
    expect(getLicenseState({ effectiveOn: null, expiresOn: null }, TODAY)).toEqual({
      status: 'permanent',
    });
  });

  it('到期日當天仍有效（即將到期、剩 0 天），隔天起已到期', () => {
    expect(getLicenseState({ effectiveOn: null, expiresOn: '2026-11-09' }, TODAY)).toEqual({
      status: 'expiring',
      daysLeft: 0,
    });
    expect(getLicenseState({ effectiveOn: null, expiresOn: '2026-11-08' }, TODAY)).toEqual({
      status: 'expired',
    });
  });

  it('30 天內是即將到期，31 天以上是有效', () => {
    expect(getLicenseState({ effectiveOn: null, expiresOn: '2026-12-09' }, TODAY)).toEqual({
      status: 'expiring',
      daysLeft: 30,
    });
    expect(getLicenseState({ effectiveOn: null, expiresOn: '2026-12-10' }, TODAY)).toEqual({
      status: 'valid',
      daysLeft: 31,
    });
  });

  it('還沒到生效日 = 尚未生效；生效日當天起有效', () => {
    expect(getLicenseState({ effectiveOn: '2026-11-10', expiresOn: null }, TODAY)).toEqual({
      status: 'notYet',
    });
    expect(getLicenseState({ effectiveOn: '2026-11-09', expiresOn: null }, TODAY)).toEqual({
      status: 'permanent',
    });
  });

  it('跨月跨年的天數計算', () => {
    expect(daysBetween('2026-12-25', '2027-01-05')).toBe(11);
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3);
  });

  it('isLicenseValidOn：以指定日期判斷，不是以今天', () => {
    const d = { effectiveOn: '2026-01-01', expiresOn: '2026-12-01' };
    expect(isLicenseValidOn(d, '2026-11-09')).toBe(true);
    expect(isLicenseValidOn(d, '2026-12-01')).toBe(true);
    expect(isLicenseValidOn(d, '2026-12-02')).toBe(false); // 排在到期後的任務
    expect(isLicenseValidOn(d, '2025-12-31')).toBe(false); // 排在生效前的任務
  });

  it('licenseCodesValidOn：只留指定日期有效的證照', () => {
    const details = [
      { code: 'PROFESSIONAL', effectiveOn: null, expiresOn: '2026-11-30' },
      { code: 'PEST_CONTROL', effectiveOn: null, expiresOn: null },
      { code: 'FIRE_ANT', effectiveOn: '2027-01-01', expiresOn: null },
    ];
    expect(licenseCodesValidOn(details, '2026-11-20')).toEqual(['PROFESSIONAL', 'PEST_CONTROL']);
    expect(licenseCodesValidOn(details, '2026-12-05')).toEqual(['PEST_CONTROL']);
    expect(licenseCodesValidOn(details, '2027-01-02')).toEqual(['PEST_CONTROL', 'FIRE_ANT']);
    expect(licenseCodesValidOn([], '2026-11-20')).toEqual([]);
  });

  it('buildLicenseDetails：只送選取的證照，沒填期間的用 null，排除 NONE', () => {
    const periods = [
      { code: 'PROFESSIONAL', effectiveOn: '2024-01-01', expiresOn: '2027-01-01' },
      { code: 'FIRE_ANT', effectiveOn: null, expiresOn: '2026-05-05' }, // 已取消選取
    ];
    expect(buildLicenseDetails(['PROFESSIONAL', 'PEST_CONTROL', 'PROFESSIONAL'], periods)).toEqual([
      { code: 'PROFESSIONAL', effectiveOn: '2024-01-01', expiresOn: '2027-01-01' },
      { code: 'PEST_CONTROL', effectiveOn: null, expiresOn: null },
    ]);
    expect(buildLicenseDetails(['NONE'], periods)).toEqual([]);
    expect(buildLicenseDetails([])).toEqual([]);
  });
});
