/**
 * 證照有效期間工具。
 *
 * 員工的每張證照可以有「生效日」與「到期日」（都可以留白，留白代表沒有限制）。
 * 判斷規則與後端一致：生效日當天起有效，到期日當天仍有效，隔天起失效。
 */
import dayjs from 'dayjs';
import type { LicenseDetail } from '@/types/employee';

/** 幾天內到期算「即將到期」 */
export const EXPIRING_SOON_DAYS = 30;

export type LicenseStatus =
  | 'permanent' // 沒有到期日
  | 'valid' // 有到期日，且離到期還很久
  | 'expiring' // 即將到期（含到期日當天）
  | 'expired' // 已過到期日
  | 'notYet'; // 還沒到生效日

export interface LicenseState {
  status: LicenseStatus;
  /** 距離到期日還有幾天（到期日當天為 0）；只有 valid、expiring 有值 */
  daysLeft?: number;
}

/** 今天的日期字串（YYYY-MM-DD，本機時區） */
export const todayString = (): string => dayjs().format('YYYY-MM-DD');

const toUtcMs = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** 兩個日期字串相差幾天（b 減 a） */
export const daysBetween = (a: string, b: string): number =>
  Math.round((toUtcMs(b) - toUtcMs(a)) / 86400000);

/** 證照在指定日期的狀態（預設今天） */
export const getLicenseState = (
  d: Pick<LicenseDetail, 'effectiveOn' | 'expiresOn'>,
  today: string = todayString(),
): LicenseState => {
  if (d.effectiveOn && today < d.effectiveOn) return { status: 'notYet' };
  if (!d.expiresOn) return { status: 'permanent' };
  if (today > d.expiresOn) return { status: 'expired' };
  const daysLeft = daysBetween(today, d.expiresOn);
  return { status: daysLeft <= EXPIRING_SOON_DAYS ? 'expiring' : 'valid', daysLeft };
};

/** 證照在指定日期是否可用（即排班檢查用的「有效」） */
export const isLicenseValidOn = (
  d: Pick<LicenseDetail, 'effectiveOn' | 'expiresOn'>,
  date: string = todayString(),
): boolean => {
  const { status } = getLicenseState(d, date);
  return status !== 'expired' && status !== 'notYet';
};

/** 指定日期可用的證照代碼清單。date 為空（待排任務）時以今天為準。 */
export const licenseCodesValidOn = (details: readonly LicenseDetail[], date?: string): string[] =>
  details.filter((d) => isLicenseValidOn(d, date || todayString())).map((d) => d.code);

/**
 * 表單送出時，把「選了哪些證照」與「使用者填過的期間」組成 licenseDetails。
 * - 只保留目前選取的證照（取消選取的就不送）
 * - 沒填過期間的證照，兩個日期都是 null（長期有效）
 * - 'NONE'（無）不是真正的證照，會被排除
 */
export const buildLicenseDetails = (
  selected: readonly string[],
  periods: readonly LicenseDetail[] = [],
): LicenseDetail[] =>
  [...new Set(selected)]
    .filter((code) => code !== 'NONE')
    .map((code) => {
      const p = periods.find((x) => x.code === code);
      return { code, effectiveOn: p?.effectiveOn ?? null, expiresOn: p?.expiresOn ?? null };
    });
