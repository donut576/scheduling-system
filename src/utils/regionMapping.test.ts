import { describe, it, expect } from 'vitest';
import {
  TAIWAN_COUNTIES,
  REGION_COUNTIES_MAP,
  getRegionByAddress,
  isAddressInRegion,
  getAreaShortLabel,
} from './regionMapping';

describe('regionMapping (台灣22縣市與責任轄區對應)', () => {
  it('contains all 22 Taiwan counties plus offshore islands', () => {
    expect(TAIWAN_COUNTIES.length).toBe(22);
    expect(REGION_COUNTIES_MAP['台北']).toContain('台北');
    expect(REGION_COUNTIES_MAP['新竹']).toContain('桃園');
  });

  describe('getRegionByAddress', () => {
    it('maps Taipei region counties correctly (台北、新北、基隆、宜蘭、花蓮)', () => {
      expect(getRegionByAddress('台北市信義區菸廠路88號')).toBe('台北');
      expect(getRegionByAddress('新北市新店區中興路三段70號')).toBe('台北');
      expect(getRegionByAddress('基隆市仁愛區愛三路')).toBe('台北');
      expect(getRegionByAddress('宜蘭縣礁溪鄉溫泉路')).toBe('台北');
      expect(getRegionByAddress('花蓮縣花蓮市中正路')).toBe('台北');
    });

    it('maps Hsinchu region counties correctly (桃園、新竹市、新竹縣、苗栗)', () => {
      expect(getRegionByAddress('桃園市中壢區中正路')).toBe('新竹');
      expect(getRegionByAddress('新竹市東區光復路二段')).toBe('新竹');
      expect(getRegionByAddress('新竹縣竹北市光明六路')).toBe('新竹');
      expect(getRegionByAddress('苗栗縣頭份市中央路')).toBe('新竹');
    });

    it('maps Taichung region counties correctly (台中、彰化、南投、雲林)', () => {
      expect(getRegionByAddress('台中市西屯區台灣大道三段')).toBe('台中');
      expect(getRegionByAddress('彰化縣員林市中山路')).toBe('台中');
      expect(getRegionByAddress('南投縣草屯鎮中正路')).toBe('台中');
      expect(getRegionByAddress('雲林縣斗六市民生路')).toBe('台中');
    });

    it('maps Tainan region counties correctly (台南、高雄、嘉義市/縣、屏東、台東)', () => {
      expect(getRegionByAddress('台南市中西區和意路1號')).toBe('台南');
      expect(getRegionByAddress('高雄市前鎮區中華五路')).toBe('台南');
      expect(getRegionByAddress('嘉義市東區中山路')).toBe('台南');
      expect(getRegionByAddress('屏東縣屏東市自由路')).toBe('台南');
      expect(getRegionByAddress('台東縣台東市大同路')).toBe('台南');
    });

    it('honors manager cross-region designated support override (經理跨區指定支援)', () => {
      // 雖然地址在花蓮，但經理指定由新竹組支援
      expect(getRegionByAddress('花蓮縣花蓮市中正路', '新竹')).toBe('新竹');
      // 雖然地址在高雄，但經理指定由台北組支援
      expect(getRegionByAddress('高雄市前鎮區中華五路', '台北')).toBe('台北');
    });
  });

  describe('isAddressInRegion', () => {
    it('returns true when address belongs to the leader target region', () => {
      expect(isAddressInRegion('宜蘭縣礁溪鄉', '台北')).toBe(true);
      expect(isAddressInRegion('桃園市中壢區', '新竹')).toBe(true);
      expect(isAddressInRegion('彰化縣員林市', '台中')).toBe(true);
      expect(isAddressInRegion('屏東縣屏東市', '台南')).toBe(true);
    });

    it('returns false when address is outside the leader target region and not designated', () => {
      expect(isAddressInRegion('桃園市中壢區', '台北')).toBe(false);
      expect(isAddressInRegion('台南市中西區', '台北')).toBe(false);
    });

    it('returns true when manager explicitly designates the task to this region', () => {
      expect(isAddressInRegion('花蓮縣花蓮市', '新竹', '新竹')).toBe(true);
    });
  });

  describe('getAreaShortLabel', () => {
    it('returns "北" for Taipei region strings', () => {
      expect(getAreaShortLabel('台北')).toBe('北');
      expect(getAreaShortLabel('台北組')).toBe('北');
      expect(getAreaShortLabel('台北 早班')).toBe('北');
      expect(getAreaShortLabel('taipei')).toBe('北');
    });

    it('returns "竹" for Hsinchu region strings', () => {
      expect(getAreaShortLabel('新竹')).toBe('竹');
      expect(getAreaShortLabel('新竹組')).toBe('竹');
      expect(getAreaShortLabel('hsinchu')).toBe('竹');
    });

    it('returns "中" for Taichung region strings', () => {
      expect(getAreaShortLabel('台中')).toBe('中');
      expect(getAreaShortLabel('台中組')).toBe('中');
      expect(getAreaShortLabel('taichung')).toBe('中');
    });

    it('returns "南" for Tainan region strings', () => {
      expect(getAreaShortLabel('台南')).toBe('南');
      expect(getAreaShortLabel('台南組')).toBe('南');
      expect(getAreaShortLabel('tainan')).toBe('南');
    });
  });
});
