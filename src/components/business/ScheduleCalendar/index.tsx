import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import type { DateSelectArg, EventContentArg, EventInput } from '@fullcalendar/core';
import type { ResourceInput, ResourceLabelContentArg } from '@fullcalendar/resource';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Popover } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import type { ScheduleEvent, ScheduleFilters, ScheduleResource } from '@/types/schedule';
import { useScheduleData } from '@/queries/useScheduleQueries';
import { isHoliday } from '@/utils/date';
import AlertBadge from '@/components/business/AlertBadge';
import { useIsMobile } from '@/hooks/useMediaQuery';

const ECOLAB_BLUE = '#0067a0';

export interface ScheduleCalendarProps {
  viewMode: 'day' | 'week' | 'month';
  dimension: 'customer' | 'employee';
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
}

/**
 * 檢視模式對應 FullCalendar resourceTimeline 視圖名稱
 */
const VIEW_MODE_MAP: Record<ScheduleCalendarProps['viewMode'], string> = {
  day: 'resourceTimelineDay',
  week: 'resourceTimelineWeek',
  month: 'resourceTimelineMonth',
};

const flattenResourcesWithParentTitle = (resources: ScheduleResource[]): ScheduleResource[] => {
  const result: ScheduleResource[] = [];

  const visit = (nodes: ScheduleResource[], parentTitle?: string) => {
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        visit(node.children, node.title);
        return;
      }

      result.push({
        id: node.id,
        title: parentTitle ? `${parentTitle} ${node.title}` : node.title,
        groupColor: node.groupColor,
      });
    });
  };

  visit(resources);
  return result;
};

/**
 * 將 ScheduleResource 轉換為 FullCalendar 所需之單層 ResourceInput 陣列。
 * 左側資源列直接顯示「集團 分店」，避免父子節點拆成兩列造成辨識困難。
 */
const toResourceInputs = (resources: ScheduleResource[]): ResourceInput[] => {
  return flattenResourcesWithParentTitle(resources).map((resource) => ({
    id: resource.id,
    title: resource.title,
    eventColor: resource.groupColor,
  }));
};

/**
 * 將 ScheduleEvent 轉換為 FullCalendar 所需之 EventInput
 * 跨日事件（isOvernight）自動延伸 end 至隔日，以確保方塊延伸至隔日顯示
 *
 * Exported for direct unit/property testing of the conversion logic.
 */
export const toEventInputs = (events: ScheduleEvent[]): EventInput[] => {
  return events.map((event) => {
    let end = event.end;

    if (event.isOvernight) {
      const startDay = dayjs(event.start);
      const endDay = dayjs(event.end);
      // 若結束時間未落在隔日（後端未展開），則手動延伸至隔日同一時刻，
      // 確保 FullCalendar 將事件方塊跨日渲染
      if (!endDay.isAfter(startDay, 'day')) {
        end = dayjs(event.end).add(1, 'day').toISOString();
      }
    }

    const backgroundColor = ECOLAB_BLUE;
    const borderColor = ECOLAB_BLUE;

    return {
      id: event.id,
      resourceId: event.resourceId,
      title: event.title,
      start: event.start,
      end,
      backgroundColor,
      borderColor,
      extendedProps: {
        scheduleEvent: {
          ...event,
          backgroundColor,
          borderColor,
        },
      },
    };
  });
};

/**
 * ScheduleCalendar - 排班行事曆元件，基於 FullCalendar v6 resourceTimeline
 *
 * - 支援日/週/月三種檢視模式
 * - 支援 customer（集團_分店）與 employee（員工_區域）兩種資源維度
 * - 事件方塊顯示集團、分店、時間區間
 * - 跨日事件自動延伸至隔日顯示
 * - 整合 AlertBadge：overridden 事件顯示警示色彩、recurring 事件顯示 ∞ 符號
 * - 國定假日以紅色標示
 * - 響應式（< 768px）：切換為「個人/每日檢視模式」——
 *   「每日」指強制以日檢視（resourceTimelineDay）呈現，忽略傳入之週/月 viewMode；
 *   「個人」指將資源維度（集團_分店 / 員工_區域）之巢狀群組結構壓平為單層列表，
 *   使小螢幕使用者可逐一檢視個別員工或分店之當日排班，無需展開巢狀節點
 *
 * Validates: Requirements 8.1, 8.3, 8.4, 8.5, 8.6, 8.7, 5.3, 7.8, 16.2
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
}) => {
  const { t } = useTranslation();
  const calendarRef = useRef<FullCalendar>(null);

  // 響應式：< 768px 時切換為「個人/每日檢視模式」（Requirement 16.2）
  // - 每日：強制以日檢視呈現，忽略 viewMode 傳入之週/月設定，避免小螢幕上
  //   resourceTimeline 因時間軸過寬而難以操作
  // - 個人：將資源樹狀結構（集團_分店 / 員工_區域）壓平為單層列表，
  //   讓使用者可直接逐一檢視每位員工／每個分店當日排班，無需展開巢狀群組
  const isMobile = useIsMobile();

  const { data, isLoading } = useScheduleData({
    dimension,
    startDate: dateRange.start,
    endDate: dateRange.end,
    groupId: filters.groupId,
    branchId: filters.branchId,
    employeeId: filters.employeeId,
    areaId: filters.areaId,
  });

  const resources = useMemo<ResourceInput[]>(() => {
    const raw = data?.resources ?? [];
    return toResourceInputs(raw);
  }, [data?.resources]);

  const effectiveView = isMobile ? VIEW_MODE_MAP.day : VIEW_MODE_MAP[viewMode];

  const events = useMemo<EventInput[]>(() => toEventInputs(data?.events ?? []), [data?.events]);

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

  // FullCalendar 的 initialView 僅套用於首次渲染，viewMode 或行動裝置斷點變化時
  // 需透過 API 呼叫 changeView 切換目前檢視（含強制切換至日檢視之「每日」模式）
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    if (api.view.type !== effectiveView) {
      api.changeView(effectiveView, dateRange.start);
      return;
    }

    const currentStart = dayjs(api.view.currentStart).format('YYYY-MM-DD');
    if (currentStart !== dateRange.start) {
      api.gotoDate(dateRange.start);
    }
  }, [dateRange.start, effectiveView]);

  useEffect(() => {
    if (!scrollTime) return;
    calendarRef.current?.getApi().scrollToTime(scrollTime);
  }, [scrollTime]);

  // 檢視範圍變更（日期切換、上一頁/下一頁）
  const handleDatesSet = useCallback(
    (arg: { startStr: string; endStr: string }) => {
      onDateChange({
        start: dayjs(arg.startStr).format('YYYY-MM-DD'),
        end: dayjs(arg.endStr).format('YYYY-MM-DD'),
      });
    },
    [onDateChange],
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

  // 事件方塊自訂渲染：顯示集團、分店、日期時間 + 週期角標
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

      const eventCard = (
        <div
          data-testid={`schedule-event-${scheduleEvent.id}`}
          style={{
            position: 'relative',
            display: 'grid',
            gap: 1,
            padding: '3px 18px 3px 5px',
            overflow: 'hidden',
            width: '100%',
            minHeight: 46,
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
          placement="rightTop"
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
    [onEventClick, onEventDetailClose, openEventId, renderEventDetail, t],
  );

  // 資源標籤渲染（客戶維度：集團_分店；員工維度：員工_區域）
  const renderResourceLabelContent = useCallback((arg: ResourceLabelContentArg) => {
    return <span>{arg.resource.title}</span>;
  }, []);

  // 日期格線：國定假日以紅色標示
  const dayHeaderClassNames = useCallback(
    (arg: { date: Date }) => {
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
      data-testid="schedule-calendar"
      className="schedule-calendar-container"
      style={{ height: '100%' }}
    >
      <style>{`
        .schedule-calendar-holiday {
          color: #F5222D !important;
        }
      `}</style>
      <FullCalendar
        ref={calendarRef}
        plugins={[resourceTimelinePlugin, dayGridPlugin, interactionPlugin]}
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
        resourceAreaWidth={isMobile ? '180px' : '300px'}
        resourceAreaHeaderContent={
          isMobile
            ? t('schedule.individual')
            : dimension === 'customer'
              ? t('schedule.branchResource')
              : t('schedule.employeeResource')
        }
        height="100%"
        nowIndicator
        // 效能優化：延遲載入 lazyFetching，避免不必要的重複請求
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
