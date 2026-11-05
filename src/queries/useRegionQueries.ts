/**
 * 轄區（Regions）相關的 React Query hooks。
 */
import { useQuery } from '@tanstack/react-query';
import { regionApi } from '@/api/regions';
import type { RegionAreas } from '@/types/region';

export const regionKeys = {
  all: ['regions'] as const,
  areas: () => [...regionKeys.all, 'areas'] as const,
};

/**
 * 取得縣市／行政區對照（客戶表單的下拉選單用）。規則很少變動，快取 10 分鐘。
 */
export function useRegionAreas() {
  return useQuery<RegionAreas>({
    queryKey: regionKeys.areas(),
    queryFn: async ({ signal }) => {
      const response = await regionApi.areas(signal);
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}
