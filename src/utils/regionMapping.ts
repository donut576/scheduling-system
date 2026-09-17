/**
 * 台灣 22 縣市與四大責任轄區對應 (Taiwan 22 Cities & Regions Mapping)
 *
 * 責任分區劃分：
 * 1. 台北組（北區）：台北市、新北市、基隆市、宜蘭縣、花蓮縣
 * 2. 新竹組（桃竹苗）：桃園市、新竹市、新竹縣、苗栗縣
 * 3. 台中組（中彰投雲）：台中市、彰化縣、南投縣、雲林縣
 * 4. 台南組（南高屏嘉東）：台南市、高雄市、嘉義市、嘉義縣、屏東縣、台東縣
 * 5. 離島/特派：澎湖縣、金門縣、連江縣（支援經理跨區指派）
 */

export type OperationalRegion = '台北' | '新竹' | '台中' | '台南';

export interface CountyOption {
  label: string;
  value: string;
  region: OperationalRegion;
}

/** 台灣 22 縣市完整清單及其所屬預設轄區 */
export const TAIWAN_COUNTIES: CountyOption[] = [
  // 1. 台北組轄區 (北基宜花)
  { label: '台北市', value: '台北市', region: '台北' },
  { label: '新北市', value: '新北市', region: '台北' },
  { label: '基隆市', value: '基隆市', region: '台北' },
  { label: '宜蘭縣', value: '宜蘭縣', region: '台北' },
  { label: '花蓮縣', value: '花蓮縣', region: '台北' },

  // 2. 新竹組轄區 (桃竹苗)
  { label: '桃園市', value: '桃園市', region: '新竹' },
  { label: '新竹市', value: '新竹市', region: '新竹' },
  { label: '新竹縣', value: '新竹縣', region: '新竹' },
  { label: '苗栗縣', value: '苗栗縣', region: '新竹' },

  // 3. 台中組轄區 (中彰投雲)
  { label: '台中市', value: '台中市', region: '台中' },
  { label: '彰化縣', value: '彰化縣', region: '台中' },
  { label: '南投縣', value: '南投縣', region: '台中' },
  { label: '雲林縣', value: '雲林縣', region: '台中' },

  // 4. 台南組轄區 (南高屏嘉東)
  { label: '嘉義市', value: '嘉義市', region: '台南' },
  { label: '嘉義縣', value: '嘉義縣', region: '台南' },
  { label: '台南市', value: '台南市', region: '台南' },
  { label: '高雄市', value: '高雄市', region: '台南' },
  { label: '屏東縣', value: '屏東縣', region: '台南' },
  { label: '台東縣', value: '台東縣', region: '台南' },

  // 5. 離島特派（預設可依需求指派，預設臨近分派）
  { label: '澎湖縣', value: '澎湖縣', region: '台南' },
  { label: '金門縣', value: '金門縣', region: '台北' },
  { label: '連江縣', value: '連江縣', region: '台北' },
];

/** 各組轄區涵蓋之縣市與地標關鍵字清單 */
export const REGION_COUNTIES_MAP: Record<OperationalRegion, string[]> = {
  台北: ['台北', '新北', '基隆', '宜蘭', '花蓮', '金門', '連江'],
  新竹: ['桃園', '新竹', '苗栗'],
  台中: ['台中', '彰化', '南投', '雲林'],
  台南: ['台南', '高雄', '嘉義', '屏東', '台東', '澎湖'],
};

/** 各責任組別之完整說明名稱 */
export const REGION_NAMES_MAP: Record<OperationalRegion, string> = {
  台北: '台北組（台北、新北、基隆、宜蘭、花蓮）',
  新竹: '新竹組（桃園、新竹縣市、苗栗）',
  台中: '台中組（台中、彰化、南投、雲林）',
  台南: '台南組（台南、高雄、嘉義、屏東、台東）',
};

/**
 * 依地址、分店名稱或經理指定支援組別，自動判斷所屬責任轄區
 *
 * @param addressOrText 地址或分店名稱
 * @param designatedRegion 經理/主管在任務上指定由哪一組支援（如有指定則優先採用）
 * @returns 責任組別 ('台北' | '新竹' | '台中' | '台南' | undefined)
 */
export function getRegionByAddress(
  addressOrText?: string,
  designatedRegion?: string,
): OperationalRegion | undefined {
  // 1. 經理指派跨區支援（最高優先權）
  if (
    designatedRegion &&
    (designatedRegion === '台北' ||
      designatedRegion === '新竹' ||
      designatedRegion === '台中' ||
      designatedRegion === '台南')
  ) {
    return designatedRegion as OperationalRegion;
  }

  if (!addressOrText) return undefined;
  const text = addressOrText.trim();

  // 2. 縣市名稱第一優先精確匹配 (County-Level Match)
  // 台中組縣市
  if (
    text.includes('台中') ||
    text.includes('彰化') ||
    text.includes('南投') ||
    text.includes('雲林')
  ) {
    return '台中';
  }
  // 台南組縣市
  if (
    text.includes('台南') ||
    text.includes('高雄') ||
    text.includes('嘉義') ||
    text.includes('屏東') ||
    text.includes('台東') ||
    text.includes('澎湖')
  ) {
    return '台南';
  }
  // 新竹組縣市
  if (text.includes('桃園') || text.includes('新竹') || text.includes('苗栗')) {
    return '新竹';
  }
  // 台北組縣市
  if (
    text.includes('台北') ||
    text.includes('新北') ||
    text.includes('基隆') ||
    text.includes('宜蘭') ||
    text.includes('花蓮') ||
    text.includes('金門') ||
    text.includes('連江') ||
    text.includes('馬祖')
  ) {
    return '台北';
  }

  // 3. 次要分店地標 / 鄉鎮市區關鍵字匹配 (District / Landmark Match)
  if (
    text.includes('內湖') ||
    text.includes('板橋') ||
    text.includes('松菸') ||
    text.includes('101') ||
    text.includes('信義') ||
    text.includes('萬華') ||
    text.includes('新店') ||
    text.includes('測試')
  ) {
    return '台北';
  }

  if (
    text.includes('竹科') ||
    text.includes('竹北') ||
    text.includes('中壢') ||
    text.includes('巨城') ||
    text.includes('平鎮') ||
    text.includes('八德') ||
    text.includes('楊梅') ||
    text.includes('頭份') ||
    text.includes('竹南')
  ) {
    return '新竹';
  }

  if (
    text.includes('西屯') ||
    text.includes('中科') ||
    text.includes('員林') ||
    text.includes('斗六') ||
    text.includes('草屯') ||
    text.includes('虎尾')
  ) {
    return '台中';
  }

  if (
    text.includes('南科') ||
    text.includes('永康') ||
    text.includes('左營') ||
    text.includes('前鎮') ||
    text.includes('楠梓') ||
    text.includes('鳳山') ||
    text.includes('三民')
  ) {
    return '台南';
  }

  return undefined;
}

/**
 * 將各種格式的地區字串（如 'taipei-morning', 'taipei', '台北', '台北-早班'）正規化為標準四大責任轄區
 */
export function normalizeRegion(regionOrGroupId?: string): OperationalRegion {
  if (!regionOrGroupId) return '台北';
  const text = regionOrGroupId.toLowerCase();
  if (text.includes('taipei') || text.includes('台北') || text.includes('北')) return '台北';
  if (text.includes('hsinchu') || text.includes('新竹') || text.includes('竹')) return '新竹';
  if (text.includes('taichung') || text.includes('台中') || text.includes('中')) return '台中';
  if (text.includes('tainan') || text.includes('台南') || text.includes('南')) return '台南';
  return '台北';
}

/**
 * 判斷地址或分店是否屬於指定組長之責任轄區
 *
 * @param addressOrText 地址或分店名稱
 * @param targetRegion 目標組別（如 '台北' 或 'taipei'）
 * @param designatedRegion 任務上指派的支援組別
 */
export function isAddressInRegion(
  addressOrText?: string,
  targetRegion?: string,
  designatedRegion?: string,
): boolean {
  if (!targetRegion) return true;
  const normTarget = normalizeRegion(targetRegion);
  // 若主管指派支援組別
  if (designatedRegion) {
    return normalizeRegion(designatedRegion) === normTarget;
  }
  const detected = getRegionByAddress(addressOrText, designatedRegion);
  return detected === normTarget;
}

/** 四大責任轄區單字縮寫標籤（台北->北、新竹->竹、台中->中、台南->南，避免首字重複） */
export const AREA_SHORT_MAP: Record<OperationalRegion, string> = {
  台北: '北',
  新竹: '竹',
  台中: '中',
  台南: '南',
};

/**
 * 取得責任轄區之單字縮寫標籤（台北->北、新竹->竹、台中->中、台南->南）
 * @param regionOrText 組別、地區或相關字串
 * @returns '北' | '竹' | '中' | '南'
 */
export function getAreaShortLabel(regionOrText?: string): string {
  if (!regionOrText) return '北';
  const norm = normalizeRegion(regionOrText);
  return AREA_SHORT_MAP[norm] || '北';
}
