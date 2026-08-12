import { useState, useCallback, useMemo } from 'react';
import { Button, Modal, Card, Space, Tag } from 'antd';
import { EnvironmentOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import BaseSearchForm, { type SearchFieldConfig } from '@/components/base/BaseSearchForm';
import TaskForm from '@/components/business/TaskForm';
import { useTaskList, useCreateTask, useUpdateTask } from '@/queries/useTaskQueries';
import { useCustomerGroups } from '@/queries/useCustomerQueries';
import { useTaskStore } from '@/stores/useTaskStore';
import { TASK_STATUS_MAP } from '@/constants/taskStatus';
import type { Task, TaskFormData, TaskStatus } from '@/types/task';
import type { CustomerGroup } from '@/types/customer';
import type { PaginatedResponse } from '@/types/common';

/**
 * 任務建立及一覽頁面
 * 整合 BaseTable + BaseSearchForm，提供完整任務瀏覽、搜尋、匯出功能
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.3
 */

const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS_MAP).map(([value, { label }]) => ({
  label,
  value,
}));

const columns: ColumnDef<Task>[] = [
  {
    title: '狀態',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    render: (value) => {
      const config = TASK_STATUS_MAP[value as TaskStatus];
      return <Tag color={config?.color}>{config?.label ?? (value as string)}</Tag>;
    },
    exportHeader: '狀態',
    exportKey: (record) => TASK_STATUS_MAP[record.status]?.label ?? record.status,
  },
  {
    title: '集團',
    dataIndex: 'groupName',
    key: 'groupName',
    width: 120,
    ellipsis: true,
    exportHeader: '集團',
    exportKey: 'groupName',
  },
  {
    title: '分店',
    dataIndex: 'branchName',
    key: 'branchName',
    width: 120,
    ellipsis: true,
    exportHeader: '分店',
    exportKey: 'branchName',
  },
  {
    title: '日期',
    dataIndex: 'date',
    key: 'date',
    width: 110,
    sorter: true,
    exportHeader: '日期',
    exportKey: 'date',
  },
  {
    title: '開始時間',
    dataIndex: 'startTime',
    key: 'startTime',
    width: 90,
    exportHeader: '開始時間',
    exportKey: 'startTime',
  },
  {
    title: '結束時間',
    dataIndex: 'endTime',
    key: 'endTime',
    width: 90,
    render: (value, record) => `${value as string}${record.isOvernight ? '（跨日）' : ''}`,
    exportHeader: '結束時間',
    exportKey: (record) => `${record.endTime}${record.isOvernight ? '（跨日）' : ''}`,
  },
  {
    title: '人數需求',
    dataIndex: 'headcount',
    key: 'headcount',
    width: 90,
    exportHeader: '人數需求',
    exportKey: 'headcount',
  },
  {
    title: '班次',
    dataIndex: 'shift',
    key: 'shift',
    width: 100,
    exportHeader: '班次',
    exportKey: 'shift',
  },
  {
    title: '路次',
    dataIndex: 'route',
    key: 'route',
    width: 100,
    ellipsis: true,
    exportHeader: '路次',
    exportKey: 'route',
  },
  {
    title: '內容',
    key: 'contents',
    width: 140,
    ellipsis: true,
    render: (_value, record) => (Array.isArray(record.contents) ? record.contents.join(', ') : ''),
    exportHeader: '內容',
    exportKey: (record) => (Array.isArray(record.contents) ? record.contents.join(', ') : ''),
  },
  {
    title: '指派人員',
    key: 'assignees',
    width: 150,
    ellipsis: true,
    render: (_value, record) =>
      Array.isArray(record.assignees) ? record.assignees.map((a) => a.employeeName).join(', ') : '',
    exportHeader: '指派人員',
    exportKey: (record) =>
      Array.isArray(record.assignees) ? record.assignees.map((a) => a.employeeName).join(', ') : '',
  },
];

/**
 * 行動裝置（< 768px）卡片檢視渲染函式，將任務列表欄位資訊以卡片形式呈現，
 * 取代桌面表格於小螢幕上難以橫向捲動閱覽之問題。
 *
 * Validates: Requirements 16.1
 */
function renderTaskCard(record: Task) {
  const statusConfig = TASK_STATUS_MAP[record.status];
  return (
    <Card size="small" style={{ marginBottom: 8 }} data-testid={`task-card-${record.id}`}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <strong>
            {record.groupName} {record.branchName}
          </strong>
          <Tag color={statusConfig?.color}>{statusConfig?.label ?? record.status}</Tag>
        </Space>
        <span>
          {record.date} {record.startTime} - {record.endTime}
          {record.isOvernight ? '（跨日）' : ''}
        </span>
        <span>
          班次：{record.shift || '-'} ／ 人數需求：{record.headcount}
        </span>
        {Array.isArray(record.contents) && record.contents.length > 0 && (
          <span>內容：{record.contents.join('、')}</span>
        )}
        {Array.isArray(record.assignees) && record.assignees.length > 0 && (
          <span>指派人員：{record.assignees.map((a) => a.employeeName).join('、')}</span>
        )}
      </Space>
    </Card>
  );
}

/**
 * 「功能」欄位獨立建立，因其包含之編輯／地圖按鈕需要頁面層級的回呼（開啟編輯視窗、
 * navigate 至地圖），由頁面元件於渲染時注入。
 *
 * Validates: Requirements 15.4
 */
function buildActionColumn(
  onEditClick: (record: Task) => void,
  onMapClick: (record: Task) => void,
): ColumnDef<Task> {
  return {
    title: '功能',
    key: 'actions',
    width: 120,
    fixed: 'right',
    render: (_value, record) => (
      <Space size={4}>
        <Button
          type="link"
          icon={<EditOutlined />}
          aria-label="編輯"
          onClick={(e) => {
            e.stopPropagation();
            onEditClick(record);
          }}
        >
          編輯
        </Button>
        <Button
          type="link"
          icon={<EnvironmentOutlined />}
          aria-label="在地圖上檢視"
          onClick={(e) => {
            e.stopPropagation();
            onMapClick(record);
          }}
        />
      </Space>
    ),
  };
}

/**
 * Custom hook that wraps useTaskList with store-based filters.
 * This satisfies BaseTable's queryHook signature: () => QueryResult<PaginatedResponse<T>>
 */
function useTaskListQuery(): QueryResult<PaginatedResponse<Task>> {
  const filters = useTaskStore((state) => state.filters);
  return useTaskList(filters) as QueryResult<PaginatedResponse<Task>>;
}

function TaskPage() {
  const navigate = useNavigate();
  const { setFilters, resetFilters } = useTaskStore();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();

  // 集團／分店篩選選項，來源與任務建立表單之集團／分店連動下拉一致
  const { data: customerGroups = [] } = useCustomerGroups();

  const groupOptions = useMemo(
    () => customerGroups.map((g: CustomerGroup) => ({ label: g.name, value: g.id })),
    [customerGroups],
  );

  const branchOptions = useMemo(
    () =>
      customerGroups.flatMap((g: CustomerGroup) =>
        g.branches.map((b) => ({ label: b.name, value: b.id })),
      ),
    [customerGroups],
  );

  const searchFields: SearchFieldConfig[] = useMemo(
    () => [
      { name: 'status', label: '狀態', type: 'select', options: TASK_STATUS_OPTIONS },
      { name: 'groupId', label: '集團', type: 'select', options: groupOptions },
      { name: 'branchId', label: '分店', type: 'select', options: branchOptions },
      { name: 'dateRange', label: '日期', type: 'rangePicker' },
    ],
    [groupOptions, branchOptions],
  );

  const handleSearch = useCallback(
    (values: Record<string, unknown>) => {
      const dateRange = values.dateRange as [dayjs.Dayjs, dayjs.Dayjs] | undefined;

      setFilters({
        status: (values.status as TaskStatus) || undefined,
        groupId: (values.groupId as string) || undefined,
        branchId: (values.branchId as string) || undefined,
        startDate: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
        endDate: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
        page: 1,
      });
    },
    [setFilters],
  );

  const handleReset = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  const handleRowClick = useCallback((record: Task) => {
    setEditingTask(record);
    setModalOpen(true);
  }, []);

  const handleCreateClick = useCallback(() => {
    setEditingTask(null);
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setEditingTask(null);
  }, []);

  const handleTaskSubmit = useCallback(
    async (data: TaskFormData) => {
      if (editingTask) {
        await updateMutation.mutateAsync({ id: editingTask.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      setModalOpen(false);
      setEditingTask(null);
    },
    [editingTask, createMutation, updateMutation],
  );

  // 從任務列表點擊「在地圖上檢視」按鈕後，定位至該任務對應之集團/分店
  // Validates: Requirements 15.4
  const handleMapClick = useCallback(
    (record: Task) => {
      navigate('/map', {
        state: { groupId: record.groupId, branchId: record.branchId },
      });
    },
    [navigate],
  );

  const tableColumns = useMemo(
    () => [...columns, buildActionColumn(handleRowClick, handleMapClick)],
    [handleRowClick, handleMapClick],
  );

  const rowClassName = useCallback(
    (record: Task) => (record.status === 'MODIFIED' ? 'row-modified' : ''),
    [],
  );

  return (
    <div className="task-page">
      <BaseSearchForm fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateClick}>
          新增任務
        </Button>
      </div>

      <BaseTable<Task>
        columns={tableColumns}
        queryHook={useTaskListQuery}
        exportable
        onRowClick={handleRowClick}
        cardRender={renderTaskCard}
        rowKey="id"
        rowClassName={rowClassName}
      />

      <Modal
        title={editingTask ? '任務詳情 / 編輯' : '新增任務'}
        open={modalOpen}
        onCancel={handleModalClose}
        footer={null}
        width={800}
        destroyOnClose
      >
        {modalOpen && (
          <TaskForm
            mode={editingTask ? 'edit' : 'create'}
            initialData={editingTask ?? undefined}
            onSubmit={handleTaskSubmit}
            onCancel={handleModalClose}
          />
        )}
      </Modal>
    </div>
  );
}

export default TaskPage;
