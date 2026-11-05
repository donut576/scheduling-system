// 轄區（Regions）相關 API 呼叫層
import apiInstance from './instance';
import type { RegionAreas } from '@/types/region';
import type { ApiResponse } from '@/types/common';

export const regionApi = {
  // 取得 12 個群組與客戶可選的縣市、行政區（含每個行政區所屬群組）
  areas: (signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<RegionAreas>>('/regions/areas', { signal }),
};
