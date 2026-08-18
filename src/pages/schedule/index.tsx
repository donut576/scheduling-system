import { useState, useCallback, useMemo } from 'react';
import type { FC } from 'react';
import { Segmented, DatePicker, Button, Space, Select, Modal, Tabs, Tag } from 'antd';
import type { TabsProps } from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  AppstoreOutlined,
  TeamOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import ScheduleCalendar from '@/components/business/ScheduleCalendar';
import TaskForm from '@/components/business/TaskForm';
import { useScheduleStore } from '@/stores/useScheduleStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { useCustomerGroups } from '@/queries/useCustomerQueries';
import { useEmployeeList } from '@/queries/useEmployeeQueries';
import { useTaskDetail, useUpdateTask } from '@/queries/useTaskQueries';
import { AREA_OPTIONS, EMPLOYEE_SHIFT_OPTIONS } from '@/constants/groups';
import { formatTaskContents } from '@/constants/taskStatus';
import type {
  ScheduleDimension,
  ScheduleEvent,
  ScheduleFilters,
  ScheduleViewMode,
} from '@/types/schedule';
import type { TaskFormData } from '@/types/task';

const { RangePicker } = DatePicker;

/**
 * 排班總覽頁面 (SchedulePage)
 *
 * 具備三大維度 Tabs（總覽、集團、員工）、日/週/月檢視切換、
 * 日期導覽、模糊搜尋與下拉篩選（全部支援 allowClear 小叉叉清除）、
 * 雙行 Resource 標頭、手勢/滾輪時間縮放以及小卡點擊開啟任務詳情/編輯功能。
 */
const SchedulePage: FC = () => {
  const { t } = useTranslation();

  // Zustand Store 狀態
  const currentView = useScheduleStore((state) => state.currentView);
  const dimension = useScheduleStore((state) => state.dimension);
  const dateRange = useScheduleStore((state) => state.dateRange);
  const setView = useScheduleStore((state) => state.setView);
  const setDimension = useScheduleStore((state) => state.setDimension);
  const setDateRange = useScheduleStore((state) => state.setDateRange);
  const hasScheduleEdit = usePermissionStore((state) => state.hasPermission('schedule:edit'));

  // 篩選器狀態（全部支援清除）
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [employeeId, setEmployeeId] = useState<string | undefined>(undefined);
  const [selectedArea, setSelectedArea] = useState<string | undefined>(undefined);
  const [selectedShift, setSelectedShift] = useState<string | undefined>(undefined);

  // 彈出詳情小框與編輯狀態
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [scrollTime, setScrollTime] = useState<string | undefined>(undefined);

  // 查詢客戶集團與員工清單
  const { data: customerGroups } = useCustomerGroups();
  const { data: employeesData } = useEmployeeList({ page: 1, pageSize: 500 });
  const employees = useMemo(() => employeesData?.list ?? [], [employeesData?.list]);

  // 查詢當前選取任務之詳細資料
  const { data: taskDetail } = useTaskDetail(selectedEvent?.taskId ?? '');
  const updateTaskMutation = useUpdateTask();

  // 集團下拉選單選項
  const groupOptions = useMemo(() => {
    if (!customerGroups) return [];
    return customerGroups.map((g) => ({
      label: g.name,
      value: g.id,
    }));
  }, [customerGroups]);

  // 分店下拉選單選項（預設全選，未選特定分店即代表全選）
  const branchOptions = useMemo(() => {
    if (!customerGroups) return [];
    if (groupId) {
      const group = customerGroups.find((g) => g.id === groupId);
      if (!group) return [];
      return group.branches.map((b) => ({
        label: b.name,
        value: b.id,
      }));
    }
    return customerGroups.flatMap((g) =>
      g.branches.map((b) => ({
        label: `${g.name} - ${b.name}`,
        value: b.id,
      })),
    );
  }, [customerGroups, groupId]);

  // 員工模糊搜尋下拉選項（支援姓名與員工編號搜尋，依所選地區與班別即時篩選）
  const employeeOptions = useMemo(() => {
    let list = employees;
    if (selectedArea) {
      list = list.filter((e) => e.area === selectedArea || e.groupName?.includes(selectedArea));
    }
    if (selectedShift) {
      list = list.filter((e) => e.shift === selectedShift || e.groupName?.includes(selectedShift));
    }
    return list.map((e) => ({
      label: `${e.name} (${e.employeeNo})`,
      value: e.id,
      searchValue: `${e.name} ${e.employeeNo}`,
    }));
  }, [employees, selectedArea, selectedShift]);

  // 當集團切換時，自動檢查分店是否有效
  const handleGroupChange = useCallback(
    (value: string | undefined) => {
      setGroupId(value);
      if (!value) {
        setBranchId(undefined);
      } else {
        const group = customerGroups?.find((g) => g.id === value);
        if (group && branchId) {
          const exists = group.branches.some((b) => b.id === branchId);
          if (!exists) {
            setBranchId(undefined);
          }
        }
      }
    },
    [branchId, customerGroups],
  );

  // 維度/Tab 切換
  const handleDimensionChange = useCallback(
    (value: ScheduleDimension) => {
      setDimension(value);
      if (value === 'overview') {
        const now = dayjs();
        if (currentView === 'day') {
          const todayStr = now.format('YYYY-MM-DD');
          setDateRange({ start: todayStr, end: todayStr });
        } else if (currentView === 'week') {
          setDateRange({
            start: now.startOf('week').format('YYYY-MM-DD'),
            end: now.endOf('week').format('YYYY-MM-DD'),
          });
        } else if (currentView === 'month') {
          setDateRange({
            start: now.startOf('month').format('YYYY-MM-DD'),
            end: now.endOf('month').format('YYYY-MM-DD'),
          });
        }
      }
    },
    [currentView, setDateRange, setDimension],
  );

  // 檢視模式切換（日/週/月，預設當前時間：選日為今天、選週為當週、選月為當月）
  const handleViewModeChange = useCallback(
    (value: ScheduleViewMode) => {
      setView(value);
      const now = dayjs();
      if (value === 'day') {
        const todayStr = now.format('YYYY-MM-DD');
        setDateRange({
          start: todayStr,
          end: todayStr,
        });
      } else if (value === 'week') {
        setDateRange({
          start: now.startOf('week').format('YYYY-MM-DD'),
          end: now.endOf('week').format('YYYY-MM-DD'),
        });
      } else if (value === 'month') {
        setDateRange({
          start: now.startOf('month').format('YYYY-MM-DD'),
          end: now.endOf('month').format('YYYY-MM-DD'),
        });
      }
    },
    [setDateRange, setView],
  );

  // 前後導覽按鈕
  const handlePrevDate = useCallback(() => {
    const current = dayjs(dateRange.start);
    if (currentView === 'day') {
      const prev = current.subtract(1, 'day').format('YYYY-MM-DD');
      setDateRange({ start: prev, end: prev });
    } else if (currentView === 'week') {
      const prevStart = current.subtract(1, 'week').startOf('week').format('YYYY-MM-DD');
      const prevEnd = current.subtract(1, 'week').endOf('week').format('YYYY-MM-DD');
      setDateRange({ start: prevStart, end: prevEnd });
    } else if (currentView === 'month') {
      const prevStart = current.subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
      const prevEnd = current.subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
      setDateRange({ start: prevStart, end: prevEnd });
    }
  }, [currentView, dateRange.start, setDateRange]);

  const handleNextDate = useCallback(() => {
    const current = dayjs(dateRange.start);
    if (currentView === 'day') {
      const next = current.add(1, 'day').format('YYYY-MM-DD');
      setDateRange({ start: next, end: next });
    } else if (currentView === 'week') {
      const nextStart = current.add(1, 'week').startOf('week').format('YYYY-MM-DD');
      const nextEnd = current.add(1, 'week').endOf('week').format('YYYY-MM-DD');
      setDateRange({ start: nextStart, end: nextEnd });
    } else if (currentView === 'month') {
      const nextStart = current.add(1, 'month').startOf('month').format('YYYY-MM-DD');
      const nextEnd = current.add(1, 'month').endOf('month').format('YYYY-MM-DD');
      setDateRange({ start: nextStart, end: nextEnd });
    }
  }, [currentView, dateRange.start, setDateRange]);

  // 日期區間選擇變更
  const handlePeriodChange = useCallback(
    (dates: [Dayjs | null, Dayjs | null] | null) => {
      if (dates && dates[0]) {
        const start = dates[0].format('YYYY-MM-DD');
        const end = dates[1] ? dates[1].format('YYYY-MM-DD') : start;
        setDateRange({ start, end });
      }
    },
    [setDateRange],
  );

  // FullCalendar 日期變更回呼
  const handleDateChange = useCallback(
    (range: { start: string; end: string }) => {
      setDateRange(range);
    },
    [setDateRange],
  );

  // 拖曳放大至日檢視
  const handleZoomToDay = useCallback(
    (dateTime: string) => {
      const targetDate = dayjs(dateTime).format('YYYY-MM-DD');
      const targetTime = dayjs(dateTime).format('HH:mm');
      setView('day');
      setDateRange({ start: targetDate, end: targetDate });
      setScrollTime(targetTime);
    },
    [setDateRange, setView],
  );

  // 縮放手勢變更視圖模式
  const handleZoomViewChange = useCallback(
    (newView: ScheduleViewMode) => {
      handleViewModeChange(newView);
    },
    [handleViewModeChange],
  );

  // 組合傳入 ScheduleCalendar 之篩選條件（各維度/Tab 獨立篩選，總覽 Tab 永遠不受集團與員工 Tab 篩選影響）
  const filters: ScheduleFilters = useMemo(() => {
    if (dimension === 'overview') {
      return {};
    }

    if (dimension === 'customer') {
      return {
        groupId: groupId || undefined,
        branchId: branchId || undefined,
      };
    }

    // employee dimension
    const matchedEmployee = employees.find(
      (e) =>
        (selectedArea && e.area === selectedArea && selectedShift && e.shift === selectedShift) ||
        (selectedArea && e.area === selectedArea && !selectedShift),
    );
    const areaId = matchedEmployee?.groupId || selectedArea || undefined;

    return {
      employeeId: employeeId || undefined,
      groupId: areaId,
      areaId,
      area: selectedArea || undefined,
      shift: selectedShift || undefined,
    };
  }, [branchId, dimension, employeeId, employees, groupId, selectedArea, selectedShift]);

  // 事件點擊處理
  const handleEventClick = useCallback((event: ScheduleEvent) => {
    setSelectedEvent(event);
    setDetailOpen(true);
  }, []);

  const handleDetailClose = useCallback(() => {
    setDetailOpen(false);
    setSelectedEvent(null);
  }, []);

  const handleCancelTask = useCallback(() => {
    if (!selectedEvent) return;
    Modal.confirm({
      title: t('schedule.confirmCancel'),
      content: t('schedule.cancelConfirm', { name: selectedEvent?.title ?? '' }),
      onOk: () => {
        setDetailOpen(false);
        setSelectedEvent(null);
      },
    });
  }, [selectedEvent, t]);

  const handleEditClick = useCallback(() => {
    setDetailOpen(false);
    setEditOpen(true);
  }, []);

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
  }, []);

  const handleEditSubmit = useCallback(
    async (formData: TaskFormData) => {
      if (!selectedEvent) return;
      await updateTaskMutation.mutateAsync({
        id: selectedEvent.taskId,
        data: formData,
      });
      setEditOpen(false);
    },
    [selectedEvent, updateTaskMutation],
  );

  // 任務詳情格式化
  const detailRows = useMemo(() => {
    if (!selectedEvent) return null;
    const isOvernight = selectedEvent.isOvernight;
    const startTimeStr = dayjs(selectedEvent.start).format('HH:mm');
    const endTimeStr = `${dayjs(selectedEvent.end).format('HH:mm')}${
      isOvernight ? ` (${t('task.overnight')})` : ''
    }`;

    const assigneesStr =
      selectedEvent.extendedProps.assignees?.map((a) => a.employeeName).join('、') ||
      t('schedule.unassigned');

    const contentsStr = selectedEvent.extendedProps.contents
      ? formatTaskContents(selectedEvent.extendedProps.contents, ', ', t)
      : '-';

    return {
      groupName: selectedEvent.groupName,
      branchName: selectedEvent.branchName,
      taskType: selectedEvent.extendedProps.taskType,
      date: dayjs(selectedEvent.start).format('YYYY-MM-DD'),
      startTime: startTimeStr,
      endTime: endTimeStr,
      headcount: selectedEvent.extendedProps.assignees?.length ?? 1,
      shift: selectedEvent.extendedProps.shift,
      route: '-',
      assignees: assigneesStr,
      contents: contentsStr,
      isRecurring: selectedEvent.isRecurring,
    };
  }, [selectedEvent, t]);

  const renderEventDetail = useCallback(
    (event: ScheduleEvent) => {
      if (!detailRows || event.id !== selectedEvent?.id) return null;
      const eventColor = event.backgroundColor || '#7a69c0';
      const assigneeArea = event.extendedProps?.assignees?.[0]?.area;
      const shiftLabel =
        detailRows.shift === '早班'
          ? t('task.shifts.morning')
          : detailRows.shift === '午班'
            ? t('task.shifts.afternoon')
            : detailRows.shift === '晚班'
              ? t('task.shifts.evening')
              : detailRows.shift === '大夜班'
                ? t('task.shifts.night')
                : detailRows.shift;

      return (
        <div
          data-testid="schedule-event-detail-popover"
          className="schedule-event-detail-popover"
          style={{
            width: 290,
            padding: '12px 14px',
            backgroundColor: eventColor,
            color: '#ffffff',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              paddingBottom: 6,
              borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <span
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              {assigneeArea ? `${assigneeArea} · ${shiftLabel}` : shiftLabel}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {event.alertStatus === 'OVERRIDDEN' && (
                <Tag color="warning" style={{ margin: 0, fontWeight: 600 }}>
                  ⚠️ {t('alert.overriddenTooltip')}
                </Tag>
              )}
              {event.alertStatus === 'VIOLATED' && (
                <Tag color="error" style={{ margin: 0, fontWeight: 600 }}>
                  🚨 {t('alert.warning')}
                </Tag>
              )}
            </div>
          </div>
          {detailRows.isRecurring && (
            <div
              className="schedule-event-detail-alert"
              style={{
                marginBottom: 8,
                padding: '4px 8px',
                fontSize: 12,
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: 4,
                color: '#ffffff',
              }}
            >
              ℹ️ {t('schedule.recurringHint')}
            </div>
          )}
          <div
            className="schedule-event-detail-lines"
            style={{
              display: 'grid',
              gap: 5,
              fontSize: 13,
              lineHeight: 1.3,
              color: '#ffffff',
            }}
          >
            <div>{`${t('task.group')}: ${detailRows.groupName}`}</div>
            <div>{`${t('task.branch')}: ${detailRows.branchName}`}</div>
            <div>{`${t('task.taskType')}: ${detailRows.taskType}`}</div>
            <div>{`${t('task.date')}: ${detailRows.date}`}</div>
            <div>{`${t('task.startTime')}: ${detailRows.startTime}`}</div>
            <div>{`${t('task.endTime')}: ${detailRows.endTime}`}</div>
            <div>{`${t('task.headcount')}: ${detailRows.headcount}`}</div>
            <div>{`${t('task.shift')}: ${detailRows.shift}`}</div>
            <div>{`${t('task.assignees')}: ${detailRows.assignees}`}</div>
            <div>{`${t('schedule.detailContent')}: ${detailRows.contents}`}</div>
          </div>
          {event.alertStatus === 'OVERRIDDEN' && (
            <div
              style={{
                marginTop: 8,
                padding: '6px 8px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: 4,
                fontSize: 12,
                display: 'grid',
                gap: 2,
              }}
            >
              <div>
                <span style={{ opacity: 0.85 }}>
                  ⚠️ {t('alert.violationReason') || '違規項目'}:{' '}
                </span>
                <strong>{event.extendedProps.violationReason || '排班規則特殊放行'}</strong>
              </div>
              {event.extendedProps.overrideReason && (
                <div>
                  <span style={{ opacity: 0.85 }}>
                    📋 {t('alert.overrideReason') || '核准備註'}:{' '}
                  </span>
                  <span>{event.extendedProps.overrideReason}</span>
                </div>
              )}
            </div>
          )}
          {hasScheduleEdit && (
            <Space
              className="schedule-event-detail-actions"
              style={{ marginTop: 12, width: '100%', justifyContent: 'flex-end' }}
            >
              <Button
                size="small"
                onClick={handleEditClick}
                aria-label={t('schedule.editTask')}
                style={{
                  background: '#ffffff',
                  color: '#262626',
                  border: 'none',
                  fontWeight: 600,
                }}
              >
                {t('common.edit')}
              </Button>
              <Button
                size="small"
                danger
                onClick={handleCancelTask}
                aria-label={t('schedule.cancelTask')}
                style={{
                  background: '#ffffff',
                  borderColor: '#ff4d4f',
                  fontWeight: 600,
                }}
              >
                {t('common.cancel')}
              </Button>
            </Space>
          )}
        </div>
      );
    },
    [detailRows, handleCancelTask, handleEditClick, hasScheduleEdit, selectedEvent?.id, t],
  );

  // 三大 Tab 定義（「總覽」、「集團」、「員工」）
  const tabItems: TabsProps['items'] = useMemo(
    () => [
      {
        key: 'overview',
        label: (
          <span>
            <AppstoreOutlined style={{ marginRight: 6 }} />
            {t('schedule.overviewTab')}
          </span>
        ),
      },
      {
        key: 'customer',
        label: (
          <span>
            <ShopOutlined style={{ marginRight: 6 }} />
            {t('schedule.groupTab')}
          </span>
        ),
      },
      {
        key: 'employee',
        label: (
          <span>
            <TeamOutlined style={{ marginRight: 6 }} />
            {t('schedule.employeeTab')}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="schedule-page" data-testid="schedule-page">
      {/* 頂部維度切換 Tabs */}
      <div style={{ marginBottom: 12 }}>
        <Tabs
          aria-label={t('schedule.dimension')}
          activeKey={dimension}
          onChange={(key) => handleDimensionChange(key as ScheduleDimension)}
          items={tabItems}
          type="card"
          className="schedule-dimension-tabs"
          tabBarStyle={{ marginBottom: 0 }}
        />
      </div>

      {/* 工具列 */}
      <div
        className="schedule-toolbar"
        style={{
          background: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 12,
          border: '1px solid #f0f0f0',
        }}
      >
        {/* 第一行：班表視圖（日/週/月）、日期導覽按鈕 */}
        <div
          className="schedule-toolbar-row schedule-toolbar-row1"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            marginBottom: dimension !== 'overview' ? 12 : 0,
          }}
        >
          <Space wrap size="middle" align="center">
            <div className="schedule-toolbar-item">
              <span className="schedule-toolbar-label" style={{ marginRight: 8, fontWeight: 500 }}>
                {t('schedule.viewTitle')}
              </span>
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
            </div>

            <div className="schedule-toolbar-item schedule-date-nav-item">
              <Space.Compact>
                <Button
                  icon={<LeftOutlined />}
                  onClick={handlePrevDate}
                  aria-label={t('schedule.prevDay')}
                />
                <RangePicker
                  aria-label={t('schedule.period')}
                  value={[dayjs(dateRange.start), dayjs(dateRange.end)]}
                  onChange={handlePeriodChange}
                  allowClear={false}
                />
                <Button
                  icon={<RightOutlined />}
                  onClick={handleNextDate}
                  aria-label={t('schedule.nextDay')}
                />
              </Space.Compact>
            </div>
          </Space>
        </div>

        {/* 第二行：依 Tab 維度切換之篩選列（全部具備 allowClear 小叉叉；總覽 Tab 不需 search bar） */}
        {dimension !== 'overview' && (
          <div className="schedule-toolbar-row schedule-toolbar-row2">
            {dimension === 'customer' && (
              <Space wrap size="middle" align="center" className="schedule-filter-group">
                <div className="schedule-filter-item">
                  <span className="schedule-filter-label" style={{ marginRight: 6 }}>
                    {t('schedule.groupNameLabel')}
                  </span>
                  <Select
                    aria-label={t('schedule.groupFilter')}
                    placeholder={t('schedule.selectGroupPlaceholder')}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    style={{ width: 220 }}
                    options={groupOptions}
                    value={groupId}
                    onChange={handleGroupChange}
                  />
                </div>
                <div className="schedule-filter-item">
                  <span className="schedule-filter-label" style={{ marginRight: 6 }}>
                    {t('schedule.branchLabel')}
                  </span>
                  <Select
                    aria-label={t('schedule.branchFilter')}
                    placeholder={t('schedule.selectBranchPlaceholder')}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    style={{ width: 220 }}
                    options={branchOptions}
                    value={branchId}
                    onChange={setBranchId}
                  />
                </div>
              </Space>
            )}

            {dimension === 'employee' && (
              <Space wrap size="middle" align="center" className="schedule-filter-group">
                <div className="schedule-filter-item">
                  <span className="schedule-filter-label" style={{ marginRight: 6 }}>
                    {t('schedule.employeeLabel')}
                  </span>
                  <Select
                    aria-label={t('schedule.employeeFilter')}
                    placeholder={t('schedule.selectEmployeePlaceholder')}
                    allowClear
                    showSearch
                    filterOption={(input, option) => {
                      const label = String(option?.label ?? '').toLowerCase();
                      const search = String(
                        (option as { searchValue?: string })?.searchValue ?? '',
                      ).toLowerCase();
                      const query = input.toLowerCase();
                      return label.includes(query) || search.includes(query);
                    }}
                    style={{ width: 240 }}
                    options={employeeOptions}
                    value={employeeId}
                    onChange={setEmployeeId}
                  />
                </div>
                <div className="schedule-filter-item">
                  <span className="schedule-filter-label" style={{ marginRight: 6 }}>
                    {t('schedule.areaLabel')}
                  </span>
                  <Select
                    aria-label="地區篩選"
                    placeholder={t('schedule.selectAreaPlaceholder')}
                    allowClear
                    style={{ width: 140 }}
                    options={AREA_OPTIONS}
                    value={selectedArea}
                    onChange={setSelectedArea}
                  />
                </div>
                <div className="schedule-filter-item">
                  <span className="schedule-filter-label" style={{ marginRight: 6 }}>
                    {t('schedule.shiftLabel')}
                  </span>
                  <Select
                    aria-label={t('schedule.shiftFilter')}
                    placeholder={t('schedule.selectShiftPlaceholder')}
                    allowClear
                    style={{ width: 140 }}
                    options={EMPLOYEE_SHIFT_OPTIONS}
                    value={selectedShift}
                    onChange={setSelectedShift}
                  />
                </div>
              </Space>
            )}
          </div>
        )}
      </div>

      {/* 排班行事曆 */}
      <div style={{ height: 'calc(100vh - 280px)', minHeight: 520 }}>
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
          onZoomViewChange={handleZoomViewChange}
        />
      </div>

      {/* 編輯任務 Modal */}
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
