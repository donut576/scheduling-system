import { useState, useCallback, useMemo } from 'react';
import { Button, Modal, Card, Space, Tag } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import BaseSearchForm, { type SearchFieldConfig } from '@/components/base/BaseSearchForm';
import TaskForm from '@/components/business/TaskForm';
import { useTaskList } from '@/queries/useTaskQueries';
import { useTaskStore } from '@/stores/useTaskStore';
import type { Task, TaskFormData } from '@/types/task';
import type { PaginatedResponse } from '@/types/common';

/**
 * 任務列表頁面
 * 整合 BaseTable + BaseSearchForm，提供完整任務瀏覽、搜尋、匯出功能
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.3
 */

const TASK_TYPE_MAP: Record<string, string> = {
  CONTRACT: '合約',
  ONETIME: '單次',
  ESR: 'ESR',
};

const searchFields: SearchFieldConfig[] = [
  {
    name: 'keyword',
    label: '關鍵字',
    type: 'input',
    placeholder: '搜尋集團/分店名稱',
  },
];

const columns: ColumnDef<Task>[] = [
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
    title: '任務類型',
    dataIndex: 'taskType',
    key: 'taskType',
    width: 100,
    render: (value) => TASK_TYPE_MAP[value as string] ?? (value as string),
    exportHeader: '任務類型',
    exportKey: (record) => TASK_TYPE_MAP[record.taskType] ?? record.taskType,
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
    title: '起訖時間',
    key: 'timeRange',
    width: 120,
    render: (_value, record) =>
      `${record.startTime} - ${record.endTime}${record.isOvernight ? '(跨日)' : ''}`,
    exportHeader: '起訖時間',
    exportKey: (record) =>
      `${record.startTime}-${record.endTime}${record.isOvernight ? '(跨日)' : ''}`,
  },
  {
    title: '人數',
    dataIndex: 'headcount',
    key: 'headcount',
    width: 70,
    exportHeader: '人數',
    exportKey: 'headcount',
  },
  {
    title: '班別',
    dataIndex: 'shift',
    key: 'shift',
    width: 100,
    exportHeader: '班別',
    exportKey: 'shift',
  },
  {
    title: '路線',
    dataIndex: 'route',
    key: 'route',
    width: 100,
    ellipsis: true,
    exportHeader: '路線',
    exportKey: 'route',
  },
  {
    title: '工作內容',
    key: 'contents',
    width: 140,
    ellipsis: true,
    render: (_value, record) => (Array.isArray(record.contents) ? record.contents.join(', ') : ''),
    exportHeader: '工作內容',
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
  {
    title: '週期',
    key: 'recurrence',
    width: 80,
    render: (_value, record) => (record.recurrenceId ? '∞' : '-'),
    exportHeader: '週期',
    exportKey: (record) => (record.recurrenceId ? '週期' : '-'),
  },
  {
    title: '備註',
    dataIndex: 'remarks',
    key: 'remarks',
    width: 150,
    ellipsis: true,
    exportHeader: '備註',
    exportKey: 'remarks',
  },
];

/**
 * 行動裝置（< 768px）卡片檢視渲染函式，將任務列表欄位資訊以卡片形式呈現，
 * 取代桌面表格於小螢幕上難以橫向捲動閱覽之問題。
 *
 * Validates: Requirements 16.1
 */
function renderTaskCard(record: Task) {
  return (
    <Card size="small" style={{ marginBottom: 8 }} data-testid={`task-card-${record.id}`}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <strong>
            {record.groupName} {record.branchName}
          </strong>
          <Tag>{TASK_TYPE_MAP[record.taskType] ?? record.taskType}</Tag>
        </Space>
        <span>
          {record.date} {record.startTime} - {record.endTime}
          {record.isOvernight ? '（跨日）' : ''}
        </span>
        <span>
          班別：{record.shift || '-'} ／ 人數：{record.headcount}
        </span>
        {Array.isArray(record.contents) && record.contents.length > 0 && (
          <span>工作內容：{record.contents.join('、')}</span>
        )}
        {Array.isArray(record.assignees) && record.assignees.length > 0 && (
          <span>指派人員：{record.assignees.map((a) => a.employeeName).join('、')}</span>
        )}
        {record.recurrenceId && <Tag color="blue">週期任務 ∞</Tag>}
        {record.remarks && <span>備註：{record.remarks}</span>}
      </Space>
    </Card>
  );
}

/**
 * 「操作」欄位獨立建立，因其包含之地圖按鈕需要 navigate 函式，
 * 由頁面元件於渲染時透過 onMapClick 回呼注入。
 *
 * Validates: Requirements 15.4
 */
function buildActionColumn(onMapClick: (record: Task) => void): ColumnDef<Task> {
  return {
    title: '操作',
    key: 'actions',
    width: 70,
    fixed: 'right',
    render: (_value, record) => (
      <Button
        type="link"
        icon={<EnvironmentOutlined />}
        aria-label="在地圖上檢視"
        onClick={(e) => {
          e.stopPropagation();
          onMapClick(record);
        }}
      />
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

  const handleSearch = useCallback(
    (values: Record<string, unknown>) => {
      setFilters({
        keyword: (values.keyword as string) || undefined,
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

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setEditingTask(null);
  }, []);

  const handleTaskSubmit = useCallback(async (_task: TaskFormData) => {
    setModalOpen(false);
    setEditingTask(null);
  }, []);

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
    () => [...columns, buildActionColumn(handleMapClick)],
    [handleMapClick],
  );

  return (
    <div className="task-page">
      <BaseSearchForm fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <BaseTable<Task>
        columns={tableColumns}
        queryHook={useTaskListQuery}
        exportable
        onRowClick={handleRowClick}
        cardRender={renderTaskCard}
        rowKey="id"
      />

      <Modal
        title="任務詳情 / 編輯"
        open={modalOpen}
        onCancel={handleModalClose}
        footer={null}
        width={800}
        destroyOnClose
      >
        {editingTask && (
          <TaskForm
            mode="edit"
            initialData={editingTask}
            onSubmit={handleTaskSubmit}
            onCancel={handleModalClose}
          />
        )}
      </Modal>
    </div>
  );
}

export default TaskPage;
