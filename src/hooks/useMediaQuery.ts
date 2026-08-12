import { useEffect, useState } from 'react';

/**
 * 全域行動裝置斷點（768px），對應需求 16.1、16.2 之響應式規格。
 */
export const MOBILE_BREAKPOINT = 768;

/**
 * useMediaQuery - 訂閱 CSS media query 變化的共用 hook
 *
 * 供 BaseTable（< 768px 卡片模式）、ScheduleCalendar（< 768px 個人/每日檢視模式）、
 * MainLayout（< 768px Sidebar 摺疊為 Drawer）共用，避免重複實作相同邏輯。
 *
 * Validates: Requirements 16.1, 16.2
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * useIsMobile - 判斷目前視窗寬度是否小於行動裝置斷點（768px）
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}
