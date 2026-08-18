import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import type { DatesSetArg, DateSelectArg, EventContentArg } from '@fullcalendar/core';
import type { ResourceLabelContentArg } from '@fullcalendar/resource';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Popover } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import type { ScheduleDimension, ScheduleEvent, ScheduleFilters } from '@/types/schedule';
import { useScheduleData } from '@/queries/useScheduleQueries';
import { isHoliday } from '@/utils/date';
import AlertBadge from '@/components/business/AlertBadge';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { toResourceInputs, toEventInputs } from './adapters';

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
}) => {
  const { t } = useTranslation();
  const calendarRef = useRef<FullCalendar>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // 縮放時間顆粒度：日檢視中支援 15m, 30m, 1h
  const slotDurations = useMemo(() => ['00:15:00', '00:30:00', '01:00:00'], []);
  const [daySlotDurationIndex, setDaySlotDurationIndex] = useState<number>(2); // 預設 1h
  // 時間軸寬度（支援滑鼠拖曳縮放與滾輪手勢微調）
  const [timelineSlotMinWidth, setTimelineSlotMinWidth] = useState<number>(60);
  const isDraggingTimelineRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartWidthRef = useRef<number>(60);

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

  const events = useMemo(
    () => toEventInputs(scheduleData?.events ?? [], viewMode),
    [scheduleData?.events, viewMode],
  );

  const resources = useMemo(
    () =>
      dimension === 'overview' ? [] : toResourceInputs(scheduleData?.resources ?? [], dimension),
    [dimension, scheduleData?.resources],
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
      const target = e.target as HTMLElement;
      const isHeaderOrSlots = Boolean(
        target.closest('.fc-timeline-header') ||
        target.closest('.fc-col-header') ||
        target.closest('.fc-timeline-slots'),
      );

      if (!isHeaderOrSlots && !e.ctrlKey && !e.metaKey && !e.altKey) return;
      e.preventDefault();

      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 2) return;

      // 依滾輪方向微調 slot 寬度
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
    },
    [handleZoom],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      // 當在時間軸標頭、時間格或空表格區域按下左鍵時啟動拖曳縮放
      if (
        target.closest('.fc-timeline-header') ||
        target.closest('.fc-col-header') ||
        (target.closest('.fc-timeline-slots') && !target.closest('.fc-timeline-event'))
      ) {
        isDraggingTimelineRef.current = true;
        dragStartXRef.current = e.clientX;
        dragStartWidthRef.current = timelineSlotMinWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }
    },
    [timelineSlotMinWidth],
  );

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isDraggingTimelineRef.current) return;
      const deltaX = e.clientX - dragStartXRef.current;
      const nextWidth = Math.max(
        35,
        Math.min(160, Math.round(dragStartWidthRef.current + deltaX * 0.5)),
      );
      setTimelineSlotMinWidth(nextWidth);
    };

    const handleWindowMouseUp = () => {
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
            {showOverridden && <span style={{ fontSize: 10 }}>⚠️</span>}
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

  // 資源標籤渲染（兩行設計：上面黑粗體主標題，下面灰色次標題）
  const renderResourceLabelContent = useCallback((arg: ResourceLabelContentArg) => {
    const ext = arg.resource.extendedProps as { mainTitle?: string; subTitle?: string } | undefined;
    const mainTitle = ext?.mainTitle || arg.resource.title;
    const subTitle = ext?.subTitle;

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
        }}
      >
        <span style={{ display: 'none' }}>{arg.resource.title}</span>
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
          {mainTitle}
        </span>
        {subTitle && (
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
            {subTitle}
          </span>
        )}
      </div>
    );
  }, []);

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
        slotEventOverlap={false}
        allDaySlot={false}
        eventMinHeight={38}
        slotMinWidth={timelineSlotMinWidth}
        resourceAreaWidth={isMobile ? '180px' : '300px'}
        resourceAreaHeaderContent={
          isMobile
            ? t('schedule.individual')
            : dimension === 'customer'
              ? () => (
                  <div
                    data-testid="resource-header-customer"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      lineHeight: 1.3,
                      padding: '2px 0',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#1f1f1f', fontSize: '13px' }}>
                      {t('schedule.customerDimension')}
                    </span>
                    <span style={{ color: '#8c8c8c', fontSize: '12px', marginTop: '2px' }}>
                      {t('schedule.branchHeader')}
                    </span>
                  </div>
                )
              : dimension === 'employee'
                ? () => (
                    <div
                      data-testid="resource-header-employee"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        lineHeight: 1.3,
                        padding: '2px 0',
                      }}
                    >
                      <span style={{ fontWeight: 700, color: '#1f1f1f', fontSize: '13px' }}>
                        {t('schedule.employeeDimension')}
                      </span>
                      <span style={{ color: '#8c8c8c', fontSize: '12px', marginTop: '2px' }}>
                        {t('schedule.groupHeader')}
                      </span>
                    </div>
                  )
                : t('schedule.overviewResource')
        }
        height="100%"
        nowIndicator
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
