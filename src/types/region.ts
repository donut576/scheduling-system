/**
 * 轄區群組與縣市／行政區對照型別。對應後端 GET /regions/areas。
 */

/** 轄區群組（北早、北一晚、北二晚、桃一早、桃二早、桃竹晚、中區、嘉義、南區） */
export interface RegionGroup {
  id: string;
  name: string;
  /** 群組代表色（hex） */
  color: string;
}

/** 行政區與它所屬的群組名稱（一個行政區可能同時屬於多個群組） */
export interface RegionDistrict {
  district: string;
  regions: string[];
}

/** 縣市與其可選的行政區 */
export interface RegionCity {
  city: string;
  districts: RegionDistrict[];
}

/** GET /regions/areas 的回應 */
export interface RegionAreas {
  regions: RegionGroup[];
  cities: RegionCity[];
}
