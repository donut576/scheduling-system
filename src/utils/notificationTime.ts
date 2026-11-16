/**
 * 通知／紀錄時間顯示格式（以 Asia/Taipei 日期為準，不是 24 小時）：
 * - 今天：HH:mm
 * - 昨天：昨天 HH:mm
 * - 前天（含）以前：M/D HH:mm
 */
const TZ = 'Asia/Taipei';

interface Parts {
  y: number;
  m: number;
  d: number;
  hh: string;
  mm: string;
}

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const getParts = (date: Date): Parts => {
  const map: Record<string, string> = {};
  formatter.formatToParts(date).forEach((p) => {
    map[p.type] = p.value;
  });
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    hh: map.hour ?? '00',
    mm: map.minute ?? '00',
  };
};

const dayNumber = (p: Parts): number => Date.UTC(p.y, p.m - 1, p.d) / 86400000;

/** 格式化通知時間；now 供測試注入 */
export function formatNotifyTime(iso: string | undefined | null, now: Date = new Date()): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const p = getParts(date);
  const diff = dayNumber(getParts(now)) - dayNumber(p);
  const time = `${p.hh}:${p.mm}`;
  if (diff <= 0) return time;
  if (diff === 1) return `昨天 ${time}`;
  return `${p.m}/${p.d} ${time}`;
}
