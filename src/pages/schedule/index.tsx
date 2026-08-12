import { useCallback, useMemo, useState } from 'react';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, DatePicker, Modal, Segmented, Select, Space, message } from 'antd';
import dayjs from 'dayjs';
import ScheduleCalendar from '@/components/business/ScheduleCalendar';
import TaskForm from '@/components/business/TaskForm';
import { useScheduleStore } from '@/stores/useScheduleStore';
import { useDictStore } from '@/stores/useDictStore';
import { useCustomerGroups } from '@/queries/useCustomerQueries';
import { useEmployeeList } from '@/queries/useEmployeeQueries';
import { useTaskDetail, useUpdateTask } from '@/queries/useTaskQueries';
import { TASK_TYPE_OPTIONS } from '@/constants/taskStatus';
import { TIME_OPTIONS } from '@/constants/timeOptions';
import type { ScheduleEvent, ScheduleViewMode, ScheduleDimension } from '@/types/schedule';
import type { TaskFormData } from '@/types/task';

const { RangePicker } = DatePicker;

const ECOLAB_BLUE = '#0067a0';

// 依背景色亮度計算應使用深色或淺色文字，確保事件詳情面板文字有足夠對比度可讀
const getReadableTextColor = (backgroundColor: string) => {
  const hex = backgroundColor.replace('#', '');
  if (hex.length !== 6) return '#fff';

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? '#1f2937' : '#fff';
};

/**
 * 排班總覽頁面
 *
 * 工具列：檢視切換（日/週/月）、期間選擇、集團篩選、分店篩選、員工/區域篩選、地圖按鈕
 * 整合 ScheduleCalendar 元件，點擊事件開啟詳情抽屜，提供編輯/取消操作
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 9.1, 9.2, 9.3
 */
/**
 * 排班總覽頁面主元件
 * 負責檢視模式/篩選條件狀態、事件點擊詳情顯示與編輯/取消任務之流程
 */
const SchedulePage: FC = () => {
  const { t } = useTranslation();
  const contents = useDictStore((state) => state.contents);

  const { currentView, dimension, dateRange, setView, setDimension, setDateRange } =
    useScheduleStore();

  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [employeeId, setEmployeeId] = useState<string | undefined>(undefined);
  const [areaId, setAreaId] = useState<string | undefined>(undefined);

  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [scrollTime, setScrollTime] = useState<string | undefined>(undefined);

  const { data: customerGroups = [] } = useCustomerGroups();
  const { data: employeeData } = useEmployeeList({ page: 1, pageSize: 500 });
  const employees = useMemo(() => employeeData?.list ?? [], [employeeData]);

  const updateTaskMutation = useUpdateTask();

  const customerBranchOptions = useMemo(
    () =>
      customerGroups.flatMap((group) =>
        group.branches.map((branch) => ({
          label: `${group.name} ${branch.name}`,
          value: `${group.id}::${branch.id}`,
          groupId: group.id,
          branchId: branch.id,
        })),
      ),
    [customerGroups],
  );

  const employeeOptions = useMemo(
    () => employees.map((e) => ({ label: e.name, value: e.id })),
    [employees],
  );

  // 區域選項（依員工群組彙整，作為簡易區域篩選）
  const areaOptions = useMemo(() => {
    const groups = new Map<string, string>();
    employees.forEach((e) => {
      if (e.groupId && e.groupName) {
        groups.set(e.groupId, e.groupName);
      }
    });
    return Array.from(groups.entries()).map(([value, label]) => ({ label, value }));
  }, [employees]);

  const filters = useMemo(
    () => ({ groupId, branchId, employeeId, areaId }),
    [groupId, branchId, employeeId, areaId],
  );

  // 切換日/週/月檢視模式；若切換至日檢視，優先使用今日日期（若落於目前區間內）
  const handleViewModeChange = useCallback(
    (value: string | number) => {
      const nextView = value as ScheduleViewMode;
      setView(nextView);
      if (nextView === 'day') {
        const today = dayjs().format('YYYY-MM-DD');
        const isTodayInRange =
          !dayjs(today).isBefore(dateRange.start, 'day') &&
          !dayjs(today).isAfter(dateRange.end, 'day');
        const nextDate = isTodayInRange ? today : dateRange.start;
        setDateRange({
          start: nextDate,
          end: nextDate,
        });
      }
    },
    [dateRange.end, dateRange.start, setDateRange, setView],
  );

  // 切換排班檢視維度（依客戶或依員工）
  const handleDimensionChange = useCallback(
    (value: string | number) => {
      setDimension(value as ScheduleDimension);
    },
    [setDimension],
  );

  // 客戶/分店篩選：下拉選項值為 "groupId::branchId" 組合字串，選取後拆解回獨立的
  // groupId 與 branchId 狀態
  const handleCustomerBranchChange = useCallback((value: string | undefined) => {
    if (!value) {
      setGroupId(undefined);
      setBranchId(undefined);
      return;
    }

    const [nextGroupId, nextBranchId] = value.split('::');
    setGroupId(nextGroupId);
    setBranchId(nextBranchId);
  }, []);

  // 期間選擇器（RangePicker）變更時更新查詢日期區間
  const handlePeriodChange = useCallback(
    (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
      if (dates && dates[0] && dates[1]) {
        setDateRange({
          start: dates[0].format('YYYY-MM-DD'),
          end: dates[1].format('YYYY-MM-DD'),
        });
      }
    },
    [setDateRange],
  );

  // 行事曆內部導覽（例如切換週/月頁面）造成的日期範圍變更；日檢視時強制起訖日相同
  const handleDateChange = useCallback(
    (range: { start: string; end: string }) => {
      setDateRange(
        currentView === 'day'
          ? {
              start: range.start,
              end: range.start,
            }
          : range,
      );
    },
    [currentView, setDateRange],
  );

  // 選擇時間快速跳轉：設定行事曆捲動位置，並自動切換至日檢視以便聚焦查看
  const handleScrollTimeChange = useCallback(
    (value: string | undefined) => {
      setScrollTime(value);
      if (value) {
        setView('day');
      }
    },
    [setView],
  );

  // 從週/月檢視點擊某時刻放大聚焦至日檢視，並關閉可能開啟的事件詳情彈窗
  const handleZoomToDay = useCallback(
    (dateTime: string) => {
      const target = dayjs(dateTime);
      if (!target.isValid()) return;

      const targetDate = target.format('YYYY-MM-DD');
      setDateRange({ start: targetDate, end: targetDate });
      setScrollTime(target.format('HH:mm'));
      setView('day');
      setDetailOpen(false);
      setSelectedEvent(null);
    },
    [setDateRange, setView],
  );

  // 點擊行事曆事件：切換至該事件所在日期之日檢視，並開啟詳情彈窗
  const handleEventClick = useCallback(
    (event: ScheduleEvent) => {
      const eventDate = dayjs(event.start).format('YYYY-MM-DD');
      setSelectedEvent(event);
      setScrollTime(dayjs(event.start).format('HH:mm'));
      setDateRange({ start: eventDate, end: eventDate });
      setView('day');
      setDetailOpen(true);
    },
    [setDateRange, setView],
  );

  // 關閉事件詳情彈窗
  const handleDetailClose = useCallback(() => {
    setDetailOpen(false);
    setSelectedEvent(null);
  }, []);

  // 從詳情彈窗點擊「編輯」：關閉詳情彈窗，開啟編輯任務 Modal
  const handleEditClick = useCallback(() => {
    setDetailOpen(false);
    setEditOpen(true);
  }, []);

  // 關閉編輯任務 Modal
  const handleEditClose = useCallback(() => {
    setEditOpen(false);
  }, []);

  // 取得選定事件對應之完整任務資料（供編輯表單帶入當前資料）
  const { data: taskDetail } = useTaskDetail(selectedEvent?.taskId);

  // 編輯表單送出：呼叫更新任務 API，成功後關閉所有彈窗並清空選定事件
  const handleEditSubmit = useCallback(
    async (data: TaskFormData) => {
      if (!selectedEvent) return;
      await updateTaskMutation.mutateAsync({ id: selectedEvent.taskId, data });
      message.success(t('schedule.taskUpdated'));
      setEditOpen(false);
      setDetailOpen(false);
      setSelectedEvent(null);
    },
    [selectedEvent, updateTaskMutation, t],
  );

  // 取消任務：彈出確認對話框，確認後將任務狀態更新為 CANCELLED
  const handleCancelTask = useCallback(() => {
    if (!selectedEvent) return;
    Modal.confirm({
      title: t('schedule.cancelTask'),
      content: t('schedule.cancelConfirm', {
        name: `${selectedEvent.groupName} ${selectedEvent.branchName}`,
      }),
      okText: t('schedule.confirmCancel'),
      cancelText: t('common.back'),
      okButtonProps: { danger: true },
      onOk: async () => {
        await updateTaskMutation.mutateAsync({
          id: selectedEvent.taskId,
          data: { status: 'CANCELLED' } as Partial<TaskFormData> & {
            status: string;
          },
        });
        message.success(t('schedule.taskCancelled'));
        setDetailOpen(false);
        setSelectedEvent(null);
      },
    });
  }, [selectedEvent, updateTaskMutation, t]);

  const taskTypeLabelMap = useMemo(
    () => new Map(TASK_TYPE_OPTIONS.map((option) => [option.value, option.label])),
    [],
  );

  const contentLabelMap = useMemo(
    () => new Map(contents.map((option) => [option.value, option.label])),
    [contents],
  );

  // 組合事件詳情彈窗所需之顯示資料，優先使用完整任務詳情（taskDetail），
  // 若尚未載入完成則暫用行事曆事件本身帶有的簡略資料（extendedProps）
  const detailRows = useMemo(() => {
    if (!selectedEvent) return null;

    const matchedTaskDetail = taskDetail?.id === selectedEvent.taskId ? taskDetail : undefined;
    const date = dayjs(selectedEvent.start).format('YYYY-MM-DD');
    const startTime = dayjs(selectedEvent.start).format('HH:mm');
    const endTime = dayjs(selectedEvent.end).format('HH:mm');
    const isOvernight = selectedEvent.isOvernight;
    const rawContents = matchedTaskDetail?.contents ?? selectedEvent.extendedProps.contents;
    const contentText = rawContents
      .map((content) =>
        content === 'OTHER' && matchedTaskDetail?.otherContentNote
          ? matchedTaskDetail.otherContentNote
          : (contentLabelMap.get(content) ?? content),
      )
      .join('/');

    return {
      groupName: matchedTaskDetail?.groupName ?? selectedEvent.groupName,
      branchName: matchedTaskDetail?.branchName ?? selectedEvent.branchName,
      taskType:
        taskTypeLabelMap.get(matchedTaskDetail?.taskType ?? selectedEvent.extendedProps.taskType) ??
        matchedTaskDetail?.taskType ??
        selectedEvent.extendedProps.taskType,
      date: dayjs(date).format('YYYY/M/D'),
      startTime,
      endTime: `${endTime}${isOvernight ? '+1' : ''}`,
      headcount: matchedTaskDetail?.headcount ?? '-',
      shift: matchedTaskDetail?.shift ?? selectedEvent.extendedProps.shift,
      route: matchedTaskDetail?.route || '-',
      assignees:
        (matchedTaskDetail?.assignees ?? selectedEvent.extendedProps.assignees)
          .map((assignee) => assignee.employeeName)
          .join('、') || t('schedule.unassigned'),
      contents: contentText || '-',
      isRecurring: Boolean(matchedTaskDetail?.recurrenceRule ?? selectedEvent.isRecurring),
    };
  }, [contentLabelMap, selectedEvent, taskDetail, taskTypeLabelMap, t]);

  // 渲染事件詳情彈出面板內容（僅在該事件為目前選定事件時渲染）
  const renderEventDetail = useCallback(
    (event: ScheduleEvent) => {
      if (!detailRows || selectedEvent?.id !== event.id) return null;

      const detailColor = ECOLAB_BLUE;
      const detailTextColor = getReadableTextColor(detailColor);

      return (
        <div
          className="schedule-event-detail-popover"
          style={{ backgroundColor: detailColor, color: detailTextColor }}
        >
          {detailRows.isRecurring && (
            <Alert
              className="schedule-event-detail-alert"
              type="info"
              showIcon
              message={t('schedule.recurringHint')}
            />
          )}
          <div className="schedule-event-detail-lines">
            <div>{`${t('task.group')}: ${detailRows.groupName}`}</div>
            <div>{`${t('task.branch')}: ${detailRows.branchName}`}</div>
            <div>{`${t('task.taskType')}: ${detailRows.taskType}`}</div>
            <div>{`${t('task.date')}: ${detailRows.date}`}</div>
            <div>{`${t('task.startTime')}: ${detailRows.startTime}`}</div>
            <div>{`${t('task.endTime')}: ${detailRows.endTime}`}</div>
            <div>{`${t('task.headcount')}: ${detailRows.headcount}`}</div>
            <div>{`${t('task.shift')}: ${detailRows.shift}`}</div>
            <div>{`${t('task.route')}: ${detailRows.route}`}</div>
            <div>{`${t('task.assignees')}: ${detailRows.assignees}`}</div>
            <div>{`${t('schedule.detailContent')}: ${detailRows.contents}`}</div>
          </div>
          <Space className="schedule-event-detail-actions">
            <Button onClick={handleEditClick} aria-label={t('schedule.editTask')}>
              {t('common.edit')}
            </Button>
            <Button onClick={handleCancelTask} aria-label={t('schedule.cancelTask')}>
              {t('common.cancel')}
            </Button>
          </Space>
        </div>
      );
    },
    [detailRows, handleCancelTask, handleEditClick, selectedEvent?.id, t],
  );

  return (
    <div className="schedule-page" data-testid="schedule-page">
      {/* 工具列 */}
      <div className="schedule-toolbar">
        <Space wrap className="schedule-view-toolbar">
          <Segmented
            aria-label={t('schedule.viewMode')}
            value={currentView}
            onChange={handleViewModeChange}
            options={[
              { label: t('schedule.dayView'), value: 'day' },
              { label: t('schedule.weekView'), value: 'week' },
              { label: t('schedule.monthView'), value: 'month' },
            ]}
          />
          <Segmented
            aria-label={t('schedule.dimension')}
            value={dimension}
            onChange={handleDimensionChange}
            options={[
              { label: t('schedule.customerDimension'), value: 'customer' },
              { label: t('schedule.employeeDimension'), value: 'employee' },
            ]}
          />
          <RangePicker
            aria-label={t('schedule.period')}
            value={[dayjs(dateRange.start), dayjs(dateRange.end)]}
            onChange={handlePeriodChange}
          />
        </Space>

        <Space wrap className="schedule-filter-toolbar">
          <Select
            aria-label={t('schedule.timeJump')}
            placeholder={t('schedule.timeJump')}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 140 }}
            options={TIME_OPTIONS}
            value={scrollTime}
            onChange={handleScrollTimeChange}
          />
          <Select
            aria-label={t('schedule.customerBranchFilter')}
            placeholder={t('schedule.customerBranchFilter')}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 240 }}
            options={customerBranchOptions}
            value={groupId && branchId ? `${groupId}::${branchId}` : undefined}
            onChange={handleCustomerBranchChange}
          />
          <Select
            aria-label={t('schedule.employeeFilter')}
            placeholder={t('schedule.employeeFilter')}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 140 }}
            options={employeeOptions}
            value={employeeId}
            onChange={setEmployeeId}
          />
          <Select
            aria-label={t('schedule.areaFilter')}
            placeholder={t('schedule.areaFilter')}
            allowClear
            style={{ minWidth: 140 }}
            options={areaOptions}
            value={areaId}
            onChange={setAreaId}
          />
        </Space>
      </div>

      {/* 排班行事曆 */}
      <div style={{ height: 'calc(100vh - 220px)' }}>
        <ScheduleCalendar
          viewMode={currentView}
          dimension={dimension}
          dateRange={dateRange}
          filters={filters}
          onEventClick={handleEventClick}
          onDateChange={handleDateChange}
          scrollTime={scrollTime}
          openEventId={detailOpen ? selectedEvent?.id : undefined}
          renderEventDetail={renderEventDetail}
          onEventDetailClose={handleDetailClose}
          onZoomToDay={handleZoomToDay}
        />
      </div>

      {/* 編輯任務 Modal - 帶入當前資料 */}
      <Modal
        title={t('task.edit')}
        open={editOpen}
        onCancel={handleEditClose}
        footer={null}
        width={800}
        destroyOnClose
      >
        {taskDetail && (
          <TaskForm
            mode="edit"
            initialData={taskDetail}
            onSubmit={handleEditSubmit}
            onCancel={handleEditClose}
          />
        )}
      </Modal>
    </div>
  );
};

export default SchedulePage;
