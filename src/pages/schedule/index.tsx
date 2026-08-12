import { useCallback, useMemo, useState } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Modal,
  Segmented,
  Select,
  Space,
  Tag,
  message,
} from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import ScheduleCalendar from '@/components/business/ScheduleCalendar';
import TaskForm from '@/components/business/TaskForm';
import AlertBadge from '@/components/business/AlertBadge';
import { useScheduleStore } from '@/stores/useScheduleStore';
import { useCustomerGroups } from '@/queries/useCustomerQueries';
import { useEmployeeList } from '@/queries/useEmployeeQueries';
import { useTaskDetail, useUpdateTask } from '@/queries/useTaskQueries';
import type { ScheduleEvent, ScheduleViewMode, ScheduleDimension } from '@/types/schedule';
import type { TaskFormData } from '@/types/task';

const { RangePicker } = DatePicker;

/**
 * 排班總覽頁面
 *
 * 工具列：檢視切換（日/週/月）、期間選擇、集團篩選、分店篩選、員工/區域篩選、地圖按鈕
 * 整合 ScheduleCalendar 元件，點擊事件開啟詳情抽屜，提供編輯/取消操作
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 9.1, 9.2, 9.3
 */
const SchedulePage: FC = () => {
  const navigate = useNavigate();

  const { currentView, dimension, dateRange, setView, setDimension, setDateRange } =
    useScheduleStore();

  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [employeeId, setEmployeeId] = useState<string | undefined>(undefined);
  const [areaId, setAreaId] = useState<string | undefined>(undefined);

  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: customerGroups = [] } = useCustomerGroups();
  const { data: employeeData } = useEmployeeList({ page: 1, pageSize: 500 });
  const employees = useMemo(() => employeeData?.list ?? [], [employeeData]);

  const updateTaskMutation = useUpdateTask();

  // 選定分店選項（依集團連動）
  const branchOptions = useMemo(() => {
    if (!groupId) return [];
    const group = customerGroups.find((g) => g.id === groupId);
    return (group?.branches ?? []).map((b) => ({ label: b.name, value: b.id }));
  }, [groupId, customerGroups]);

  const groupOptions = useMemo(
    () => customerGroups.map((g) => ({ label: g.name, value: g.id })),
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

  const handleViewModeChange = useCallback(
    (value: string | number) => {
      setView(value as ScheduleViewMode);
    },
    [setView],
  );

  const handleDimensionChange = useCallback(
    (value: string | number) => {
      setDimension(value as ScheduleDimension);
    },
    [setDimension],
  );

  const handleGroupChange = useCallback((value: string | undefined) => {
    setGroupId(value);
    setBranchId(undefined);
  }, []);

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

  const handleDateChange = useCallback(
    (range: { start: string; end: string }) => {
      setDateRange(range);
    },
    [setDateRange],
  );

  const handleMapClick = useCallback(() => {
    navigate('/map', {
      state: selectedEvent
        ? { groupId: selectedEvent.groupName, branchId: selectedEvent.branchName }
        : undefined,
    });
  }, [navigate, selectedEvent]);

  const handleEventClick = useCallback((event: ScheduleEvent) => {
    setSelectedEvent(event);
    setDetailOpen(true);
  }, []);

  const handleDetailClose = useCallback(() => {
    setDetailOpen(false);
    setSelectedEvent(null);
  }, []);

  const handleEditClick = useCallback(() => {
    setEditOpen(true);
  }, []);

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
  }, []);

  // 取得選定事件對應之完整任務資料（供編輯表單帶入當前資料）
  const { data: taskDetail } = useTaskDetail(selectedEvent?.taskId);

  const handleEditSubmit = useCallback(
    async (data: TaskFormData) => {
      if (!selectedEvent) return;
      await updateTaskMutation.mutateAsync({ id: selectedEvent.taskId, data });
      message.success('任務已更新');
      setEditOpen(false);
      setDetailOpen(false);
      setSelectedEvent(null);
    },
    [selectedEvent, updateTaskMutation],
  );

  const handleCancelTask = useCallback(() => {
    if (!selectedEvent) return;
    Modal.confirm({
      title: '取消任務',
      content: `確定要取消「${selectedEvent.groupName} ${selectedEvent.branchName}」此任務嗎？`,
      okText: '確定取消',
      cancelText: '返回',
      okButtonProps: { danger: true },
      onOk: async () => {
        await updateTaskMutation.mutateAsync({
          id: selectedEvent.taskId,
          data: { status: 'CANCELLED' } as Partial<TaskFormData> & {
            status: string;
          },
        });
        message.success('任務已取消');
        setDetailOpen(false);
        setSelectedEvent(null);
      },
    });
  }, [selectedEvent, updateTaskMutation]);

  const alertBadgeStatus = useMemo(() => {
    if (!selectedEvent) return null;
    if (selectedEvent.alertStatus === 'OVERRIDDEN') return 'overridden';
    if (selectedEvent.isRecurring) return 'recurring';
    return null;
  }, [selectedEvent]);

  return (
    <div className="schedule-page" data-testid="schedule-page">
      {/* 工具列 */}
      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Segmented
            aria-label="檢視切換"
            value={currentView}
            onChange={handleViewModeChange}
            options={[
              { label: '日', value: 'day' },
              { label: '週', value: 'week' },
              { label: '月', value: 'month' },
            ]}
          />
          <Segmented
            aria-label="維度切換"
            value={dimension}
            onChange={handleDimensionChange}
            options={[
              { label: '集團_分店', value: 'customer' },
              { label: '員工_區域', value: 'employee' },
            ]}
          />
          <RangePicker
            aria-label="期間選擇"
            value={[dayjs(dateRange.start), dayjs(dateRange.end)]}
            onChange={handlePeriodChange}
          />
        </Space>

        <Space wrap>
          <Select
            aria-label="集團篩選"
            placeholder="集團篩選"
            allowClear
            style={{ minWidth: 140 }}
            options={groupOptions}
            value={groupId}
            onChange={handleGroupChange}
          />
          <Select
            aria-label="分店篩選"
            placeholder="分店篩選"
            allowClear
            style={{ minWidth: 140 }}
            options={branchOptions}
            value={branchId}
            disabled={!groupId}
            onChange={setBranchId}
          />
          <Select
            aria-label="員工篩選"
            placeholder="員工篩選"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 140 }}
            options={employeeOptions}
            value={employeeId}
            onChange={setEmployeeId}
          />
          <Select
            aria-label="區域篩選"
            placeholder="區域篩選"
            allowClear
            style={{ minWidth: 140 }}
            options={areaOptions}
            value={areaId}
            onChange={setAreaId}
          />
          <Button icon={<EnvironmentOutlined />} onClick={handleMapClick} aria-label="地圖檢視">
            地圖
          </Button>
        </Space>
      </Space>

      {/* 排班行事曆 */}
      <div style={{ height: 'calc(100vh - 220px)' }}>
        <ScheduleCalendar
          viewMode={currentView}
          dimension={dimension}
          dateRange={dateRange}
          filters={filters}
          onEventClick={handleEventClick}
          onDateChange={handleDateChange}
        />
      </div>

      {/* 詳情抽屜 */}
      <Drawer
        title="任務詳情"
        open={detailOpen}
        onClose={handleDetailClose}
        width={420}
        destroyOnClose
        footer={
          <Space>
            <Button type="primary" onClick={handleEditClick} aria-label="編輯任務">
              編輯
            </Button>
            <Button danger onClick={handleCancelTask} aria-label="取消任務">
              取消任務
            </Button>
          </Space>
        }
      >
        {selectedEvent && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="集團">{selectedEvent.groupName}</Descriptions.Item>
            <Descriptions.Item label="分店">{selectedEvent.branchName}</Descriptions.Item>
            <Descriptions.Item label="任務類型">
              {selectedEvent.extendedProps.taskType}
            </Descriptions.Item>
            <Descriptions.Item label="班別">{selectedEvent.extendedProps.shift}</Descriptions.Item>
            <Descriptions.Item label="時間">
              {dayjs(selectedEvent.start).format('YYYY-MM-DD HH:mm')} ~{' '}
              {dayjs(selectedEvent.end).format('YYYY-MM-DD HH:mm')}
              {selectedEvent.isOvernight && <Tag style={{ marginLeft: 8 }}>跨日</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="工作內容">
              {selectedEvent.extendedProps.contents.join(', ')}
            </Descriptions.Item>
            <Descriptions.Item label="指派員工">
              {selectedEvent.extendedProps.assignees.map((a) => a.employeeName).join(', ') ||
                '尚未指派'}
            </Descriptions.Item>
            <Descriptions.Item label="狀態">
              {alertBadgeStatus ? (
                <AlertBadge status={alertBadgeStatus} />
              ) : (
                <Tag color="success">正常</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* 編輯任務 Modal - 帶入當前資料 */}
      <Modal
        title="編輯任務"
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
