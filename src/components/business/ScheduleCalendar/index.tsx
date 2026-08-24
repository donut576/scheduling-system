import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import type { DatesSetArg, DateSelectArg, EventContentArg } from '@fullcalendar/core';
import type { ResourceLabelContentArg } from '@fullcalendar/resource';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Popover, Tooltip, Button } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import type { ScheduleDimension, ScheduleEvent, ScheduleFilters } from '@/types/schedule';
import { useScheduleData } from '@/queries/useScheduleQueries';
import { useUserStore } from '@/stores/useUserStore';
import { isHoliday } from '@/utils/date';
import AlertBadge from '@/components/business/AlertBadge';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { toResourceInputs, toEventInputs } from './adapters';

export interface ExternalDropArg {
  date: Date;
  dateStr: string;
  allDay: boolean;
  resourceId?: string;
  draggedEl: HTMLElement;
  jsEvent: MouseEvent;
}

export interface ScheduleCalendarProps {
  viewMode: 'day' | 'week' | 'month';
  dimension: ScheduleDimension;
  dateRange: { start: string; end: string };
  filters: ScheduleFilters;
  onEventClick: (event: ScheduleEvent) => void;
  onDateChange: (range: { start: string; end: string }) => void;
  holidays?: string[];
  scrollTime?: string;
  openEventId?: string;
  renderEventDetail?: (event: ScheduleEvent) => React.ReactNode;
  onEventDetailClose?: () => void;
  onZoomToDay?: (dateTime: string) => void;
  onZoomViewChange?: (viewMode: 'day' | 'week' | 'month') => void;
  droppable?: boolean;
  onExternalDrop?: (arg: ExternalDropArg) => void;
  editable?: boolean;
  onEventDragStart?: (event: { id: string; title: string }) => void;
  onEventDragStop?: (info: {
    event: { id: string; title: string; extendedProps?: Record<string, unknown> };
    jsEvent: MouseEvent;
  }) => void;
}

/**
 * ScheduleCalendar 元件：負責 FullCalendar 容器渲染、事件方塊展示、資源列表與縮放互動
 */
const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  viewMode,
  dimension,
  dateRange,
  filters,
  onEventClick,
  onDateChange,
  holidays = [],
  scrollTime,
  openEventId,
  renderEventDetail,
  onEventDetailClose,
  onZoomToDay,
  onZoomViewChange,
  droppable = true,
  onExternalDrop,
  editable = true,
  onEventDragStart,
  onEventDragStop,
}) => {
  const { t } = useTranslation();
  const calendarRef = useRef<FullCalendar>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const user = useUserStore((state) => state.user);

  // 縮放時間顆粒度：日檢視中支援 15m, 30m, 1h
  const slotDurations = useMemo(() => ['00:15:00', '00:30:00', '01:00:00'], []);
  const [daySlotDurationIndex, setDaySlotDurationIndex] = useState<number>(2); // 預設 1h
  // 時間軸寬度（支援滑鼠拖曳縮放與滾輪手勢微調）
  const [timelineSlotMinWidth, setTimelineSlotMinWidth] = useState<number>(60);
  const isDraggingTimelineRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartWidthRef = useRef<number>(60);

  // 左側標頭欄位寬度（支援滑鼠拖曳拉大/拉小與一鍵收合/展開）
  const [resourceAreaWidth, setResourceAreaWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('ecolab_resource_area_width');
      if (saved) {
        const num = Number(saved);
        if (num >= 80 && num <= 600) return num;
      }
    }
    return isMobile ? 180 : 260;
  });
  const [isResourceCollapsed, setIsResourceCollapsed] = useState<boolean>(false);
  const isDraggingResourceDividerRef = useRef<boolean>(false);
  const dragResourceStartXRef = useRef<number>(0);
  const dragResourceStartWidthRef = useRef<number>(260);

  // 查詢排班資料（由 TanStack Query 管理快取）
  const queryParams = useMemo(
    () => ({
      dimension,
      startDate: dateRange.start,
      endDate: dateRange.end,
      groupId: filters.groupId,
      branchId: filters.branchId,
      employeeId: filters.employeeId,
      areaId: filters.areaId,
      area: filters.area,
      shift: filters.shift,
    }),
    [dateRange.end, dateRange.start, dimension, filters],
  );

  const { data: scheduleData, isLoading } = useScheduleData(queryParams);

  // 當前時間標記紅線：週與月檢視（以天為格子）將時間設為正午 12:00，確保紅線精準置中切在該日期格子正中間
  const calendarNow = useMemo(() => {
    if (viewMode === 'week' || viewMode === 'month') {
      return `${dayjs().format('YYYY-MM-DD')}T12:00:00`;
    }
    return new Date();
  }, [viewMode]);

  const events = useMemo(
    () => toEventInputs(scheduleData?.events ?? [], viewMode),
    [scheduleData?.events, viewMode],
  );

  const resources = useMemo(
    () =>
      dimension === 'overview'
        ? []
        : toResourceInputs(scheduleData?.resources ?? [], dimension, user?.id, user?.name),
    [dimension, scheduleData?.resources, user?.id, user?.name],
  );

  // 依據維度與 viewMode 決定 FullCalendar 視圖
  const effectiveView = useMemo(() => {
    if (dimension === 'overview') {
      if (viewMode === 'day') return 'timeGridDay';
      if (viewMode === 'week') return 'timeGridWeek';
      return 'dayGridMonth';
    }

    if (viewMode === 'day') return 'resourceTimelineDay';
    if (viewMode === 'week') return 'resourceTimelineWeek';
    return 'resourceTimelineMonth';
  }, [dimension, viewMode]);

  // 縮放處理函式：放大（Zoom In）與縮小（Zoom Out）
  const handleZoom = useCallback(
    (direction: 'in' | 'out') => {
      if (direction === 'in') {
        if (viewMode === 'month') {
          onZoomViewChange?.('week');
        } else if (viewMode === 'week') {
          onZoomViewChange?.('day');
        } else if (viewMode === 'day') {
          setDaySlotDurationIndex((prev) => Math.max(0, prev - 1));
        }
      } else {
        if (viewMode === 'day') {
          if (daySlotDurationIndex < slotDurations.length - 1) {
            setDaySlotDurationIndex((prev) => prev + 1);
          } else {
            onZoomViewChange?.('week');
          }
        } else if (viewMode === 'week') {
          onZoomViewChange?.('month');
        }
      }
    },
    [daySlotDurationIndex, onZoomViewChange, slotDurations.length, viewMode],
  );

  // 滑鼠滾輪與觸控板 Pinch-to-zoom 監聽
  const lastWheelTimeRef = useRef<number>(0);
  const touchStartDistRef = useRef<number | null>(null);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // 只有在按下 Ctrl / Meta（觸控板雙指捏合 Pinch-to-zoom 或 Ctrl+滾輪）時才進行時間軸縮放
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (Math.abs(delta) < 2) return;

        // 依手勢方向微調 slot 寬度
        if (delta < 0) {
          setTimelineSlotMinWidth((prev) => Math.min(160, prev + 5));
        } else {
          setTimelineSlotMinWidth((prev) => Math.max(35, prev - 5));
        }

        const now = Date.now();
        if (now - lastWheelTimeRef.current < 300) return;
        lastWheelTimeRef.current = now;

        if (delta < -40) {
          handleZoom('in');
        } else if (delta > 40) {
          handleZoom('out');
        }
      }
      // 一般觸控板雙指左右滑動、上下滾動：不呼叫 e.preventDefault()，放行給 FullCalendar 原生平滑滑動！
    },
    [handleZoom],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      // 檢查是否點擊在左側標頭欄位與時間軸的分割線上（支援滑鼠拖曳拉大/拉小）
      const isDivider = Boolean(
        target.closest('.fc-resource-timeline-divider') ||
        target.classList.contains('fc-resource-timeline-divider') ||
        target.closest('.fc-col-resizer'),
      );

      if (isDivider) {
        isDraggingResourceDividerRef.current = true;
        dragResourceStartXRef.current = e.clientX;
        dragResourceStartWidthRef.current = isResourceCollapsed ? 60 : resourceAreaWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
        return;
      }

      // 僅在點擊時間軸頂部「時間標頭」時啟動標頭寬度拖曳縮放
      if (target.closest('.fc-timeline-header') || target.closest('.fc-col-header')) {
        isDraggingTimelineRef.current = true;
        dragStartXRef.current = e.clientX;
        dragStartWidthRef.current = timelineSlotMinWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }
    },
    [isResourceCollapsed, resourceAreaWidth, timelineSlotMinWidth],
  );

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (isDraggingResourceDividerRef.current) {
        const deltaX = e.clientX - dragResourceStartXRef.current;
        const newWidth = Math.max(
          60,
          Math.min(600, Math.round(dragResourceStartWidthRef.current + deltaX)),
        );
        if (newWidth <= 75) {
          setIsResourceCollapsed(true);
        } else {
          setIsResourceCollapsed(false);
          setResourceAreaWidth(newWidth);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('ecolab_resource_area_width', String(newWidth));
          }
        }
        return;
      }

      if (!isDraggingTimelineRef.current) return;
      const deltaX = e.clientX - dragStartXRef.current;
      const nextWidth = Math.max(
        35,
        Math.min(160, Math.round(dragStartWidthRef.current + deltaX * 0.5)),
      );
      setTimelineSlotMinWidth(nextWidth);
    };

    const handleWindowMouseUp = () => {
      if (isDraggingResourceDividerRef.current) {
        isDraggingResourceDividerRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      if (isDraggingTimelineRef.current) {
        isDraggingTimelineRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && e.touches[0] && e.touches[1]) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      touchStartDistRef.current = Math.hypot(
        touch1.pageX - touch2.pageX,
        touch1.pageY - touch2.pageY,
      );
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (
        e.touches.length === 2 &&
        e.touches[0] &&
        e.touches[1] &&
        touchStartDistRef.current !== null
      ) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDist = Math.hypot(touch1.pageX - touch2.pageX, touch1.pageY - touch2.pageY);
        const distRatio = currentDist / touchStartDistRef.current;

        const now = Date.now();
        if (now - lastWheelTimeRef.current > 300) {
          if (distRatio > 1.35) {
            lastWheelTimeRef.current = now;
            handleZoom('in');
            touchStartDistRef.current = currentDist;
          } else if (distRatio < 0.75) {
            lastWheelTimeRef.current = now;
            handleZoom('out');
            touchStartDistRef.current = currentDist;
          }
        }
      }
    },
    [handleZoom],
  );

  const handleTouchEnd = useCallback(() => {
    touchStartDistRef.current = null;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchEnd, handleTouchMove, handleTouchStart, handleWheel]);

  // 事件點擊：回傳原始 ScheduleEvent 資料
  const handleEventClick = useCallback(
    (arg: { event: { extendedProps: { scheduleEvent?: ScheduleEvent } } }) => {
      const scheduleEvent = arg.event.extendedProps.scheduleEvent;
      if (scheduleEvent) {
        onEventClick(scheduleEvent);
      }
    },
    [onEventClick],
  );

  // FullCalendar viewMode 變化時切換視圖
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    if (api.view.type !== effectiveView) {
      api.changeView(effectiveView, dateRange.start);
      return;
    }

    if (viewMode === 'month') {
      const currentMonth = dayjs(api.view.currentStart).format('YYYY-MM');
      const targetMonth = dayjs(dateRange.start).format('YYYY-MM');
      if (currentMonth !== targetMonth) {
        api.gotoDate(dateRange.start);
      }
    } else {
      const currentStart = dayjs(api.view.currentStart).format('YYYY-MM-DD');
      if (currentStart !== dateRange.start) {
        api.gotoDate(dateRange.start);
      }
    }
  }, [dateRange.start, effectiveView, viewMode]);

  useEffect(() => {
    if (!scrollTime) return;
    calendarRef.current?.getApi().scrollToTime(scrollTime);
  }, [scrollTime]);

  // 檢視範圍變更（日期切換、上一頁/下一頁）
  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      const currentStart = arg.view?.currentStart
        ? dayjs(arg.view.currentStart)
        : dayjs(arg.startStr);
      let s = currentStart.format('YYYY-MM-DD');
      let e = s;

      if (viewMode === 'day') {
        s = currentStart.format('YYYY-MM-DD');
        e = s;
      } else if (viewMode === 'week') {
        s = currentStart.startOf('week').format('YYYY-MM-DD');
        e = currentStart.endOf('week').format('YYYY-MM-DD');
      } else if (viewMode === 'month') {
        s = currentStart.startOf('month').format('YYYY-MM-DD');
        e = currentStart.endOf('month').format('YYYY-MM-DD');
      }

      onDateChange({
        start: s,
        end: e,
      });
    },
    [onDateChange, viewMode],
  );

  const handleDateSelect = useCallback(
    (arg: DateSelectArg) => {
      if (viewMode !== 'day') {
        onZoomToDay?.(arg.startStr);
      }
      arg.view.calendar.unselect();
    },
    [onZoomToDay, viewMode],
  );

  // 事件方塊自訂渲染：小卡形式顯示集團、分店、時間、指派人員與週期標籤
  const renderEventContent = useCallback(
    (arg: EventContentArg) => {
      const scheduleEvent = arg.event.extendedProps.scheduleEvent as ScheduleEvent | undefined;
      if (!scheduleEvent) {
        return <span>{arg.event.title}</span>;
      }

      const isOvernight = scheduleEvent.isOvernight;
      const timeLabel = `${dayjs(scheduleEvent.start).format('M/D HH:mm')}-${dayjs(
        scheduleEvent.end,
      ).format('HH:mm')}${isOvernight ? '+1' : ''}`;

      const showOverridden = scheduleEvent.alertStatus === 'OVERRIDDEN';
      const eventColor = scheduleEvent.backgroundColor || arg.event.backgroundColor || '#7a69c0';
      const isMonthGrid = effectiveView === 'dayGridMonth';

      const eventCard = isMonthGrid ? (
        <div
          data-testid={`schedule-event-${scheduleEvent.id}`}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 4,
            padding: '2px 6px',
            backgroundColor: eventColor,
            borderRadius: 4,
            width: '100%',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 600,
            overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.12)',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
            <span style={{ opacity: 0.9, fontSize: 10, flexShrink: 0 }}>
              {dayjs(scheduleEvent.start).format('HH:mm')}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {scheduleEvent.groupName} · {scheduleEvent.branchName}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            {scheduleEvent.isRecurring && <span style={{ fontSize: 12, lineHeight: 1 }}>∞</span>}
          </div>
        </div>
      ) : (
        <div
          data-testid={`schedule-event-${scheduleEvent.id}`}
          style={{
            position: 'relative',
            display: 'grid',
            gap: 1,
            padding: '3px 18px 3px 5px',
            backgroundColor: eventColor,
            borderRadius: 6,
            overflow: 'hidden',
            width: '100%',
            minHeight: 46,
            color: '#ffffff',
          }}
        >
          {scheduleEvent.isRecurring && (
            <span
              data-testid={`schedule-recurring-corner-${scheduleEvent.id}`}
              aria-label={t('alert.recurring')}
              style={{
                position: 'absolute',
                top: 2,
                right: 4,
                fontWeight: 700,
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              ∞
            </span>
          )}
          <span
            style={{
              fontWeight: 700,
              fontSize: 12,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {scheduleEvent.groupName}
          </span>
          <span
            style={{
              fontWeight: 600,
              fontSize: 12,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {scheduleEvent.branchName}
          </span>
          <span style={{ fontSize: 11, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{timeLabel}</span>
          {showOverridden && (
            <span style={{ marginTop: 2 }}>
              <AlertBadge status="overridden" tooltip={t('alert.overriddenTooltip')} />
            </span>
          )}
        </div>
      );

      if (!renderEventDetail) {
        return eventCard;
      }

      return (
        <Popover
          trigger="click"
          placement="bottomLeft"
          autoAdjustOverflow
          destroyTooltipOnHide
          color={eventColor}
          overlayInnerStyle={{
            padding: 0,
            backgroundColor: eventColor,
            borderRadius: 8,
            overflow: 'hidden',
          }}
          open={openEventId === scheduleEvent.id}
          content={renderEventDetail(scheduleEvent)}
          onOpenChange={(open) => {
            if (open) {
              onEventClick(scheduleEvent);
            } else {
              onEventDetailClose?.();
            }
          }}
        >
          {eventCard}
        </Popover>
      );
    },
    [effectiveView, onEventClick, onEventDetailClose, openEventId, renderEventDetail, t],
  );

  // 資源標籤渲染（支援一般兩行設計，與收合狀態下的緊湊頭像/縮圖）
  const renderResourceLabelContent = useCallback(
    (arg: ResourceLabelContentArg) => {
      const ext = arg.resource.extendedProps as
        { mainTitle?: string; subTitle?: string; isSelf?: boolean } | undefined;
      const mainTitle = ext?.mainTitle || arg.resource.title;
      const subTitle = ext?.subTitle;
      const isSelf = ext?.isSelf || false;

      if (isResourceCollapsed) {
        return (
          <Tooltip title={`${mainTitle}${subTitle ? ` (${subTitle})` : ''}`} placement="right">
            <div
              aria-label={arg.resource.title}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: isSelf ? '#1677ff' : '#f0f5ff',
                  color: isSelf ? '#ffffff' : '#0958d9',
                  fontSize: '13px',
                  fontWeight: 700,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                }}
              >
                {mainTitle ? mainTitle.slice(0, 2) : ''}
              </span>
            </div>
          </Tooltip>
        );
      }

      return (
        <div
          aria-label={arg.resource.title}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '4px 6px',
            lineHeight: 1.3,
            overflow: 'hidden',
            backgroundColor: isSelf ? '#f0f7ff' : 'transparent',
            borderRadius: 4,
          }}
        >
          <span style={{ display: 'none' }}>{arg.resource.title}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <span
              style={{
                fontWeight: 700,
                color: isSelf ? '#0958d9' : '#1f1f1f',
                fontSize: '13px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {mainTitle}
            </span>
          </div>
          {subTitle && (
            <span
              style={{
                color: isSelf ? '#1677ff' : '#8c8c8c',
                fontSize: '12px',
                marginTop: '2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontWeight: isSelf ? 500 : 400,
              }}
            >
              {subTitle}
            </span>
          )}
        </div>
      );
    },
    [isResourceCollapsed],
  );

  const renderResourceAreaHeader = useCallback(() => {
    if (isMobile) {
      return <span>{t('schedule.individual')}</span>;
    }

    if (isResourceCollapsed) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            padding: '2px 0',
          }}
        >
          <Tooltip title="展開標頭欄位" placement="right">
            <Button
              type="text"
              size="small"
              aria-label="展開標頭欄位"
              icon={<MenuUnfoldOutlined style={{ fontSize: 15, color: '#1677ff' }} />}
              onClick={(e) => {
                e.stopPropagation();
                setIsResourceCollapsed(false);
              }}
              style={{
                width: 32,
                height: 32,
                padding: 0,
                minWidth: 32,
                borderRadius: 6,
                backgroundColor: '#f0f5ff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          </Tooltip>
        </div>
      );
    }

    const titleText =
      dimension === 'customer'
        ? t('schedule.customerDimension')
        : dimension === 'employee'
          ? t('schedule.employeeDimension')
          : t('schedule.overviewResource');

    const subText =
      dimension === 'customer'
        ? t('schedule.branchHeader')
        : dimension === 'employee'
          ? t('schedule.groupHeader')
          : undefined;

    return (
      <div
        data-testid={
          dimension === 'customer'
            ? 'resource-header-customer'
            : dimension === 'employee'
              ? 'resource-header-employee'
              : undefined
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '2px 2px 2px 4px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            lineHeight: 1.3,
            overflow: 'hidden',
            flex: 1,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              color: '#1f1f1f',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {titleText}
          </span>
          {subText && (
            <span
              style={{
                color: '#8c8c8c',
                fontSize: '12px',
                marginTop: '2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {subText}
            </span>
          )}
        </div>
        <Tooltip title="收合標頭欄位" placement="bottom">
          <Button
            type="text"
            size="small"
            aria-label="收合標頭欄位"
            icon={<MenuFoldOutlined style={{ fontSize: 14, color: '#595959' }} />}
            onClick={(e) => {
              e.stopPropagation();
              setIsResourceCollapsed(true);
            }}
            style={{
              width: 26,
              height: 26,
              padding: 0,
              minWidth: 26,
              borderRadius: 4,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          />
        </Tooltip>
      </div>
    );
  }, [dimension, isMobile, isResourceCollapsed, t]);

  // 日期格線：國定假日以紅色標示
  const dayHeaderClassNames = useCallback(
    (arg: { date?: Date }) => {
      if (!arg.date) return [];
      const dateStr = dayjs(arg.date).format('YYYY-MM-DD');
      return isHoliday(dateStr, holidays) ? ['schedule-calendar-holiday'] : [];
    },
    [holidays],
  );

  const slotLabelClassNames = useCallback(
    (arg: { date?: Date }) => {
      if (!arg.date) return [];
      const dateStr = dayjs(arg.date).format('YYYY-MM-DD');
      return isHoliday(dateStr, holidays) ? ['schedule-calendar-holiday'] : [];
    },
    [holidays],
  );

  return (
    <div
      ref={containerRef}
      data-testid="schedule-calendar"
      className="schedule-calendar-container"
      onMouseDown={handleMouseDown}
      style={{ height: '100%' }}
    >
      <style>{`
        .schedule-calendar-holiday {
          color: #F5222D !important;
        }
        .fc-timegrid-event-harness {
          margin-right: 2px !important;
        }
        .fc-timegrid-event {
          border-radius: 6px !important;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12) !important;
          overflow: hidden !important;
          color: #ffffff !important;
          cursor: pointer;
        }
        .fc-timegrid-event .fc-event-main {
          padding: 0 !important;
        }
        .fc-timegrid-col-events {
          margin: 0 1px !important;
        }
        .fc-timeGridDay-view .fc-timegrid {
          max-width: 480px;
          margin: 0 auto !important;
        }
        .fc-timeGridDay-view .fc-col-header {
          max-width: 480px;
          margin: 0 auto !important;
        }
        .fc-timeGridDay-view .fc-scrollgrid {
          max-width: 480px;
          margin: 0 auto !important;
          border-radius: 8px;
          overflow: hidden;
          background: #ffffff;
        }
        .fc-timeGridDay-view .fc-timegrid-col-events {
          max-width: 400px;
          margin: 0 auto !important;
        }
        .fc-timeGridDay-view .fc-timegrid-col-bg {
          max-width: 400px;
          margin: 0 auto !important;
        }
        /* 嚴格固定每一行資源列與時間軸軌道的高度一致（統一 64px） */
        .fc-datagrid-cell-frame {
          min-height: 64px !important;
          height: 64px !important;
          padding: 8px 12px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          box-sizing: border-box !important;
        }
        .fc-datagrid-cell-cushion {
          width: 100%;
          padding: 0 !important;
        }
        .fc-timeline-lane {
          min-height: 64px !important;
          height: 64px !important;
        }
        .fc-timeline-lane-frame {
          min-height: 64px !important;
          height: 64px !important;
          display: flex !important;
          align-items: center !important;
        }
        .fc-timeline-event-harness {
          top: 50% !important;
          transform: translateY(-50%) !important;
        }
        .fc-timeline-event {
          min-height: 46px !important;
          height: 46px !important;
          border-radius: 6px !important;
          overflow: hidden !important;
          display: flex !important;
          align-items: center !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08) !important;
        }
        /* 總覽月視圖事件卡片樣式 */
        .fc-daygrid-event-harness {
          margin: 1px 2px !important;
        }
        .fc-daygrid-event {
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
        }
        .fc-daygrid-event-dot {
          display: none !important;
        }
        .fc-daygrid-dot-event {
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
        }
        .fc-daygrid-block-event {
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
        }
        /* 時間軸標頭支援拖曳縮放游標樣式 */
        .fc-timeline-header,
        .fc-timeline-header .fc-timeline-slot {
          cursor: col-resize;
          user-select: none;
        }
        /* 左側標頭欄位分割線：支援滑鼠拖曳拉大/拉小與懸停藍色高亮 */
        .fc-resource-timeline-divider {
          width: 6px !important;
          cursor: col-resize !important;
          background-color: #f0f2f5 !important;
          border-left: 1px solid #d9e2ec !important;
          border-right: 1px solid #d9e2ec !important;
          transition: background-color 0.15s ease;
          user-select: none;
        }
        .fc-resource-timeline-divider:hover,
        .fc-resource-timeline-divider:active {
          background-color: #1677ff !important;
        }
        /* 支援觸控板與觸控螢幕原生雙向平滑滑動 */
        .schedule-calendar-container .fc-scroller {
          -webkit-overflow-scrolling: touch !important;
          touch-action: pan-x pan-y !important;
          overscroll-behavior: contain !important;
        }
        /* 當前時間紅線樣式：置中清晰顯眼 */
        .fc-timeline-now-indicator-line,
        .fc-timegrid-now-indicator-line {
          border-left: 2px solid #ff4d4f !important;
          z-index: 10 !important;
        }
        .fc-timeline-now-indicator-arrow,
        .fc-timegrid-now-indicator-arrow {
          border-top-color: #ff4d4f !important;
          border-bottom-color: #ff4d4f !important;
        }
        /* 隱藏 FullCalendar 商業版權提示訊息 */
        .fc-license-message {
          display: none !important;
        }
      `}</style>
      <FullCalendar
        ref={calendarRef}
        schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
        plugins={[resourceTimelinePlugin, timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView={effectiveView}
        headerToolbar={false}
        initialDate={dateRange.start}
        resources={resources}
        events={events}
        eventContent={renderEventContent}
        resourceLabelContent={renderResourceLabelContent}
        dayHeaderClassNames={dayHeaderClassNames}
        slotLabelClassNames={slotLabelClassNames}
        eventClick={handleEventClick}
        selectable={viewMode !== 'day'}
        selectMirror
        selectMinDistance={8}
        select={handleDateSelect}
        datesSet={handleDatesSet}
        droppable={droppable}
        editable={editable}
        eventDragStart={(info: { event: { id: string; title: string } }) => {
          onEventDragStart?.(info.event);
        }}
        eventDragStop={(info: {
          event: { id: string; title: string; extendedProps?: Record<string, unknown> };
          jsEvent: MouseEvent;
        }) => {
          onEventDragStop?.({
            event: {
              id: info.event.id,
              title: info.event.title,
              extendedProps: info.event.extendedProps,
            },
            jsEvent: info.jsEvent,
          });
        }}
        drop={(arg: {
          date: Date;
          dateStr: string;
          allDay: boolean;
          resource?: { id: string; title: string };
          draggedEl: HTMLElement;
          jsEvent: MouseEvent;
        }) => {
          onExternalDrop?.({
            date: arg.date,
            dateStr: arg.dateStr,
            allDay: arg.allDay,
            resourceId: arg.resource?.id,
            draggedEl: arg.draggedEl,
            jsEvent: arg.jsEvent,
          });
        }}
        slotEventOverlap={false}
        allDaySlot={false}
        eventMinHeight={38}
        slotMinWidth={timelineSlotMinWidth}
        resourceAreaWidth={isResourceCollapsed ? '60px' : `${resourceAreaWidth}px`}
        resourceAreaHeaderContent={renderResourceAreaHeader}
        height="100%"
        nowIndicator
        now={calendarNow}
        views={{
          timeGridDay: {
            type: 'timeGrid',
            duration: { days: 1 },
            slotDuration: slotDurations[daySlotDurationIndex] || '01:00',
            slotLabelFormat: [{ hour: '2-digit', minute: '2-digit', hour12: false }],
          },
          timeGridWeek: {
            type: 'timeGrid',
            duration: { weeks: 1 },
            slotDuration: '01:00',
            slotLabelFormat: [{ hour: '2-digit', minute: '2-digit', hour12: false }],
            dayHeaderFormat: {
              weekday: 'short',
              month: 'numeric',
              day: 'numeric',
              omitCommas: true,
            },
          },
          dayGridMonth: {
            type: 'dayGridMonth',
            dayHeaderFormat: { weekday: 'short' },
            eventDisplay: 'block',
          },
          resourceTimelineDay: {
            type: 'resourceTimeline',
            duration: { days: 1 },
            slotDuration: slotDurations[daySlotDurationIndex] || '01:00',
            slotLabelFormat: [{ hour: '2-digit', minute: '2-digit', hour12: false }],
          },
          resourceTimelineWeek: {
            type: 'resourceTimeline',
            duration: { weeks: 1 },
            slotDuration: { days: 1 },
            slotLabelFormat: [
              { weekday: 'short', month: 'numeric', day: 'numeric', omitCommas: true },
            ],
          },
          resourceTimelineMonth: {
            type: 'resourceTimeline',
            duration: { months: 1 },
            slotDuration: { days: 1 },
            slotLabelFormat: [{ month: 'numeric', day: 'numeric' }],
          },
        }}
        lazyFetching
        loading={() => isLoading}
        eventDidMount={(arg) => {
          const scheduleEvent = arg.event.extendedProps.scheduleEvent as ScheduleEvent | undefined;
          if (scheduleEvent) {
            arg.el.setAttribute(
              'aria-label',
              `${scheduleEvent.groupName} ${scheduleEvent.branchName}`,
            );
          }
        }}
      />
    </div>
  );
};

export default ScheduleCalendar;
