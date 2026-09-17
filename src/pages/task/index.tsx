import { useState, useCallback, useMemo } from 'react';
import { Button, Modal, Card, Space, Tag, Dropdown, Select, DatePicker, Tabs, message } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DownOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import TaskForm from '@/components/business/TaskForm';
import ApprovalPage from '@/pages/approval';
import { taskApi } from '@/api/task';
import { useTaskList, useCreateTask, useUpdateTask } from '@/queries/useTaskQueries';
import { useCustomerGroups } from '@/queries/useCustomerQueries';
import { useTaskStore } from '@/stores/useTaskStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { useUserStore } from '@/stores/useUserStore';
import { isAddressInRegion, normalizeRegion } from '@/utils/regionMapping';
import { TASK_STATUS_MAP, formatTaskContents } from '@/constants/taskStatus';
import { exportToExcel, type ExcelColumn } from '@/utils/excel';
import type { Task, TaskFormData, TaskStatus } from '@/types/task';
import type { CustomerGroup } from '@/types/customer';
import type { PaginatedResponse } from '@/types/common';

const getTaskStatusLabel = (status: TaskStatus, t: (key: string) => string): string => {
  switch (status) {
    case 'SCHEDULED':
      return t('task.statusScheduled');
    case 'UNSCHEDULED':
      return t('task.statusUnscheduled');
    case 'MODIFIED':
      return t('task.statusModified');
    case 'CANCELLED':
      return t('task.statusCancelled');
    case 'CONFIRMED':
      return t('task.statusConfirmed');
    case 'PENDING_APPROVAL':
      return t('task.statusPendingApproval');
    default:
      return (TASK_STATUS_MAP as Record<string, { label: string }>)[status]?.label ?? status;
  }
};

const getShiftLabel = (shift: string | undefined, t: (key: string) => string): string => {
  if (!shift) return '-';
  if (shift === '早班') return t('task.shifts.morning');
  if (shift === '午班') return t('task.shifts.afternoon');
  if (shift === '晚班') return t('task.shifts.evening');
  if (shift === '大夜班') return t('task.shifts.night');
  return shift;
};

const getRouteLabel = (route: string | undefined, t: (key: string) => string): string => {
  if (!route) return '';
  const routeMap: Record<string, string> = {
    第一路: t('task.routes.route1'),
    第二路: t('task.routes.route2'),
    第三路: t('task.routes.route3'),
    第四路: t('task.routes.route4'),
    第五路: t('task.routes.route5'),
    第六路: t('task.routes.route6'),
    第七路: t('task.routes.route7'),
    第八路: t('task.routes.route8'),
  };
  return routeMap[route] ?? route;
};

const getTaskExportColumns = (t: (key: string) => string): ExcelColumn<Task>[] => [
  {
    header: t('task.status'),
    key: (record) => {
      if (record.status === 'MODIFIED') {
        const approvedSuffix = record.isApproved
          ? ` (${t('approval.status.approved')})`
          : ` (${t('approval.status.pending')})`;
        return `${t('task.statusModified')}${approvedSuffix}`;
      }
      return getTaskStatusLabel(record.status, t);
    },
    width: 16,
  },
  { header: t('task.group'), key: 'groupName', width: 22 },
  { header: t('task.branch'), key: 'branchName', width: 18 },
  { header: t('task.date'), key: 'date', width: 14 },
  { header: t('task.startTime'), key: 'startTime', width: 12 },
  {
    header: t('task.endTime'),
    key: (record) => `${record.endTime}${record.isOvernight ? ` (${t('task.overnight')})` : ''}`,
    width: 14,
  },
  { header: t('task.headcount'), key: 'headcount', width: 12 },
  { header: t('task.shift'), key: (record) => getShiftLabel(record.shift, t), width: 12 },
  { header: t('task.route'), key: (record) => getRouteLabel(record.route, t), width: 16 },
  {
    header: t('task.content'),
    key: (record) => formatTaskContents(record.contents, ', ', t),
    width: 20,
  },
  {
    header: t('task.assignees'),
    key: (record) =>
      Array.isArray(record.assignees)
        ? record.assignees.map((assignee) => assignee.employeeName).join(', ')
        : '',
    width: 24,
  },
  {
    header: t('task.reportSection'),
    key: (record) => {
      const parts: string[] = [];
      if (record.reportTypes?.length) parts.push(record.reportTypes.join(', '));
      if (record.requirePhotos) parts.push('需照片');
      return parts.join(' / ') || '-';
    },
    width: 20,
  },
];

interface ColumnFilterTitleProps {
  label: string;
  active?: boolean;
  children: React.ReactNode;
}

function ColumnFilterTitle({ label, active, children }: ColumnFilterTitleProps) {
  return (
    <Space size={4} onClick={(e) => e.stopPropagation()}>
      <span>{label}</span>
      <Dropdown
        trigger={['click']}
        dropdownRender={() => (
          <div
            style={{
              padding: 8,
              background: '#fff',
              borderRadius: 6,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        )}
      >
        <Button
          type={active ? 'primary' : 'text'}
          size="small"
          icon={<DownOutlined />}
          aria-label={`${label} filter`}
          onClick={(e) => e.stopPropagation()}
        />
      </Dropdown>
    </Space>
  );
}

function baseColumns(
  statusTitle: React.ReactNode,
  groupTitle: React.ReactNode,
  branchTitle: React.ReactNode,
  dateTitle: React.ReactNode,
  t: (key: string) => string,
): ColumnDef<Task>[] {
  return [
    {
      title: statusTitle,
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (value, record) => {
        if (record.status === 'MODIFIED') {
          return (
            <Tag
              color={record.isApproved ? '#1677FF' : '#F5222D'}
              style={{ color: '#ffffff', fontWeight: 600 }}
            >
              {getTaskStatusLabel('MODIFIED', t)}
            </Tag>
          );
        }
        const config = TASK_STATUS_MAP[value as TaskStatus];
        return (
          <Tag color={config?.color} style={{ color: '#ffffff', fontWeight: 600 }}>
            {getTaskStatusLabel(value as TaskStatus, t)}
          </Tag>
        );
      },
      exportHeader: t('task.status'),
      exportKey: (record) => getTaskStatusLabel(record.status, t),
    },
    {
      title: groupTitle,
      dataIndex: 'groupName',
      key: 'groupName',
      width: 120,
      ellipsis: true,
      exportHeader: t('task.group'),
      exportKey: 'groupName',
    },
    {
      title: branchTitle,
      dataIndex: 'branchName',
      key: 'branchName',
      width: 120,
      ellipsis: true,
      exportHeader: t('task.branch'),
      exportKey: 'branchName',
    },
    {
      title: dateTitle,
      dataIndex: 'date',
      key: 'date',
      width: 140,
      sorter: (a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return -1;
        if (!b.date) return 1;

        const today = dayjs().format('YYYY-MM-DD');
        const isPastA = a.date < today;
        const isPastB = b.date < today;

        if (!isPastA && isPastB) return -1;
        if (isPastA && !isPastB) return 1;

        if (!isPastA && !isPastB) {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          if (a.status === 'UNSCHEDULED' && b.status !== 'UNSCHEDULED') return -1;
          if (a.status !== 'UNSCHEDULED' && b.status === 'UNSCHEDULED') return 1;
          return (a.startTime || '').localeCompare(b.startTime || '');
        }

        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (a.startTime || '').localeCompare(b.startTime || '');
      },
      render: (value, record) => (
        <Space direction="vertical" size={2}>
          <span>{(value as string) || '-'}</span>
          {record.isMakeup && (
            <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>
              補做{record.originalDate ? ` (原 ${record.originalDate.slice(5)})` : ''}
            </Tag>
          )}
        </Space>
      ),
      exportHeader: t('task.date'),
      exportKey: (record) =>
        `${record.date || ''}${record.isMakeup ? ` (補做 原${record.originalDate || ''})` : ''}`,
    },
    {
      title: t('task.startTime'),
      dataIndex: 'startTime',
      key: 'startTime',
      width: 90,
      exportHeader: t('task.startTime'),
      exportKey: 'startTime',
    },
    {
      title: t('task.endTime'),
      dataIndex: 'endTime',
      key: 'endTime',
      width: 90,
      render: (value, record) =>
        value ? `${value as string}${record.isOvernight ? ` (${t('task.overnight')})` : ''}` : '-',
      exportHeader: t('task.endTime'),
      exportKey: (record) =>
        record.endTime
          ? `${record.endTime}${record.isOvernight ? ` (${t('task.overnight')})` : ''}`
          : '-',
    },
    {
      title: t('task.headcount'),
      dataIndex: 'headcount',
      key: 'headcount',
      width: 90,
      exportHeader: t('task.headcount'),
      exportKey: 'headcount',
    },
    {
      title: t('task.shift'),
      dataIndex: 'shift',
      key: 'shift',
      width: 100,
      render: (value) => getShiftLabel(value as string, t),
      exportHeader: t('task.shift'),
      exportKey: (record) => getShiftLabel(record.shift, t),
    },
    {
      title: t('task.route'),
      dataIndex: 'route',
      key: 'route',
      width: 100,
      ellipsis: true,
      render: (value) => getRouteLabel(value as string, t),
      exportHeader: t('task.route'),
      exportKey: (record) => getRouteLabel(record.route, t),
    },
    {
      title: t('task.content'),
      key: 'contents',
      width: 140,
      ellipsis: true,
      render: (_value, record) => formatTaskContents(record.contents, ', ', t),
      exportHeader: t('task.content'),
      exportKey: (record) => formatTaskContents(record.contents, ', ', t),
    },
    {
      title: t('task.assignees'),
      key: 'assignees',
      width: 160,
      ellipsis: true,
      render: (_value, record) => {
        const assignees = Array.isArray(record.assignees) ? record.assignees : [];
        const required = record.headcount || 1;
        if (assignees.length === 0) {
          return (
            <Tag color="red" style={{ margin: 0, fontSize: 11 }}>
              未指派 (0/{required})
            </Tag>
          );
        }
        if (assignees.length < required) {
          return (
            <Space size={4} wrap>
              <span>{assignees.map((a) => a.employeeName).join(', ')}</span>
              <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>
                缺 {required - assignees.length} 人
              </Tag>
            </Space>
          );
        }
        return assignees.map((a) => a.employeeName).join(', ');
      },
      exportHeader: t('task.assignees'),
      exportKey: (record) =>
        Array.isArray(record.assignees)
          ? record.assignees.map((a) => a.employeeName).join(', ')
          : '',
    },
  ];
}

/**
 * 行動裝置（< 768px）卡片檢視渲染函式，將任務列表欄位資訊以卡片形式呈現，
 * 取代桌面表格於小螢幕上難以橫向捲動閱覽之問題。
 *
 * Validates: Requirements 16.1
 */
function renderTaskCard(record: Task, t: (key: string) => string) {
  const isApproved = Boolean(record.isApproved);
  const cardClassName =
    record.status === 'CANCELLED'
      ? 'row-task-cancelled'
      : record.status === 'MODIFIED'
        ? isApproved
          ? 'row-modified-approved'
          : 'row-modified-pending'
        : '';
  const tagColor =
    record.status === 'MODIFIED'
      ? isApproved
        ? '#1677FF'
        : '#F5222D'
      : TASK_STATUS_MAP[record.status]?.color;
  const tagLabel = getTaskStatusLabel(record.status, t);

  return (
    <Card
      size="small"
      className={cardClassName}
      style={{ width: '100%', boxSizing: 'border-box' }}
      data-testid={`task-card-${record.id}`}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <strong>
            {record.groupName} {record.branchName}
          </strong>
          <Space size={4}>
            {record.isMakeup && (
              <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>
                補做{record.originalDate ? ` (原 ${record.originalDate.slice(5)})` : ''}
              </Tag>
            )}
            <Tag color={tagColor} style={{ color: '#ffffff', fontWeight: 600, margin: 0 }}>
              {tagLabel}
            </Tag>
          </Space>
        </Space>
        <span>
          {record.date || record.startTime || record.endTime ? (
            <>
              {record.date ? `${record.date} ` : ''}
              {record.startTime && record.endTime
                ? `${record.startTime} ~ ${record.endTime}`
                : record.startTime || record.endTime || ''}
              {record.isOvernight ? ` (${t('task.overnight')})` : ''}
            </>
          ) : (
            <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>
              待排日期與時段
            </Tag>
          )}
        </span>
        <span>
          {t('task.shift')}：{getShiftLabel(record.shift, t)} ／ {t('task.headcount')}：
          {record.headcount}
        </span>
        {Array.isArray(record.contents) && record.contents.length > 0 && (
          <span>
            {t('task.content')}：{formatTaskContents(record.contents, ', ', t)}
          </span>
        )}
        {(() => {
          const assignees = Array.isArray(record.assignees) ? record.assignees : [];
          const required = record.headcount || 1;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span>{t('task.assignees')}：</span>
              {assignees.length === 0 ? (
                <Tag color="red" style={{ margin: 0, fontSize: 11 }}>
                  ⚠️ 未指派 (0/{required} 人)
                </Tag>
              ) : assignees.length < required ? (
                <>
                  <span>{assignees.map((a) => a.employeeName).join('、')}</span>
                  <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>
                    ⚠️ 缺 {required - assignees.length} 人 ({assignees.length}/{required})
                  </Tag>
                </>
              ) : (
                <span>{assignees.map((a) => a.employeeName).join('、')}</span>
              )}
            </div>
          );
        })()}
        {(Boolean(record.requirePhotos) ||
          (record.reportTypes && record.reportTypes.length > 0)) && (
          <Space size={4} wrap>
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>{t('task.reportSection')}：</span>
            {record.reportTypes
              ?.filter(
                (type) =>
                  !(record.requirePhotos && (type === 'PHOTO' || (type as string) === '拍照')),
              )
              .map((type) => (
                <Tag key={type} style={{ fontSize: 11, margin: 0 }}>
                  {type === 'APP'
                    ? 'APP'
                    : type === 'EDM'
                      ? 'EDM'
                      : type === 'PAPER'
                        ? '紙本'
                        : '拍照'}
                </Tag>
              ))}
            {record.requirePhotos && (
              <Tag color="cyan" style={{ fontSize: 11, margin: 0 }}>
                拍照存證
              </Tag>
            )}
          </Space>
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
  t: (key: string) => string,
): ColumnDef<Task> {
  return {
    title: t('common.actions'),
    key: 'actions',
    width: 120,
    fixed: 'right',
    render: (_value, record) => (
      <Space size={4}>
        <Button
          type="link"
          icon={<EditOutlined />}
          aria-label={t('common.edit')}
          onClick={(e) => {
            e.stopPropagation();
            onEditClick(record);
          }}
        >
          {t('common.edit')}
        </Button>
      </Space>
    ),
  };
}

/**
 * 任務頁面主元件
 * 以 Tabs 整合任務列表、待定時間客戶、審批流程三個子頁面（依權限決定顯示的分頁）
 */
function TaskPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const user = useUserStore((state) => state.user);
  const isLeader = user?.role === 'LEADER';

  const leaderArea = useMemo(() => {
    if (!isLeader) return undefined;
    return normalizeRegion((user as unknown as { area?: string })?.area || user?.groupId);
  }, [isLeader, user]);

  const { filters, setFilters, resetFilters } = useTaskStore();
  const effectiveTaskFilters = useMemo(
    () => ({
      ...filters,
      area: isLeader ? leaderArea : undefined,
    }),
    [filters, isLeader, leaderArea],
  );
  const taskListQuery = useTaskList(effectiveTaskFilters) as QueryResult<PaginatedResponse<Task>>;
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();

  // 集團／分店篩選選項，來源與任務建立表單之集團／分店連動下拉一致
  const { data: customerGroups = [] } = useCustomerGroups();

  const isBranchInLeaderArea = useCallback(
    (b: { address?: string; name?: string; designatedRegion?: string }) => {
      if (!isLeader || !leaderArea) return true;
      return isAddressInRegion(b.address || b.name, leaderArea, b.designatedRegion);
    },
    [isLeader, leaderArea],
  );

  const groupOptions = useMemo(() => {
    let list = customerGroups;
    if (isLeader) {
      list = list.filter((g) => g.branches.some(isBranchInLeaderArea));
    }
    return list.map((g: CustomerGroup) => ({ label: g.name, value: g.id }));
  }, [customerGroups, isBranchInLeaderArea, isLeader]);

  const branchOptions = useMemo(() => {
    let groups = filters.groupId
      ? customerGroups.filter((g: CustomerGroup) => g.id === filters.groupId)
      : customerGroups;
    if (isLeader) {
      groups = groups.filter((g) => g.branches.some(isBranchInLeaderArea));
    }

    return groups.flatMap((g: CustomerGroup) =>
      g.branches.filter(isBranchInLeaderArea).map((b) => ({ label: b.name, value: b.id })),
    );
  }, [customerGroups, filters.groupId, isBranchInLeaderArea, isLeader]);

  // 依狀態欄位篩選（表格欄位標題內建之下拉篩選）
  const handleStatusFilter = useCallback(
    (status?: TaskStatus) => setFilters({ status, page: 1 }),
    [setFilters],
  );

  // 依集團篩選，切換集團時重置分店篩選避免殘留不相關的分店條件
  const handleGroupFilter = useCallback(
    (groupId?: string) => setFilters({ groupId, branchId: undefined, page: 1 }),
    [setFilters],
  );

  // 依分店篩選
  const handleBranchFilter = useCallback(
    (branchId?: string) => setFilters({ branchId, page: 1 }),
    [setFilters],
  );

  // 依日期區間篩選
  const handleDateFilter = useCallback(
    (dates: null | [dayjs.Dayjs | null, dayjs.Dayjs | null]) =>
      setFilters({
        startDate: dates?.[0] ? dates[0].format('YYYY-MM-DD') : undefined,
        endDate: dates?.[1] ? dates[1].format('YYYY-MM-DD') : undefined,
        page: 1,
      }),
    [setFilters],
  );

  // 點擊資料列開啟編輯任務 Modal，帶入該筆任務資料
  const handleRowClick = useCallback((record: Task) => {
    setEditingTask(record);
    setModalOpen(true);
  }, []);

  // 開啟新增任務 Modal
  const handleCreateClick = useCallback(() => {
    setEditingTask(null);
    setModalOpen(true);
  }, []);

  // 匯出目前篩選結果之任務列表為 Excel 檔案
  const handleExportTasks = useCallback(async () => {
    try {
      setIsExporting(true);
      // 根據當前篩選狀態（狀態、集團、分店、日期區間等）取得符合條件之完整資料
      const response = await taskApi.list({ ...filters, page: 1, pageSize: 10000 });
      const tasksToExport = response.data.data.list ?? [];

      const filterSummary: string[] = [];
      if (filters.status) {
        filterSummary.push(`狀態-${TASK_STATUS_MAP[filters.status]?.label ?? filters.status}`);
      }
      if (filters.startDate || filters.endDate) {
        filterSummary.push(`日期-${filters.startDate || ''}~${filters.endDate || ''}`);
      }
      const filenameSuffix = filterSummary.length > 0 ? `_${filterSummary.join('_')}` : '';

      exportToExcel(
        tasksToExport,
        getTaskExportColumns(t),
        `任務列表${filenameSuffix}_${dayjs().format('YYYYMMDD_HHmmss')}`,
      );
    } catch (err) {
      console.error('Export failed', err);
      exportToExcel(
        taskListQuery.data?.list ?? [],
        getTaskExportColumns(t),
        `任務列表_${Date.now()}`,
      );
    } finally {
      setIsExporting(false);
    }
  }, [filters, t, taskListQuery.data?.list]);

  // 關閉新增/編輯任務 Modal
  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setEditingTask(null);
  }, []);

  // 送出任務表單：依是否為編輯模式呼叫更新或建立 API
  const handleTaskSubmit = useCallback(
    async (data: TaskFormData) => {
      if (editingTask) {
        await updateMutation.mutateAsync({ id: editingTask.id, data });
        message.success(t('common.saveSuccess') || '儲存成功');
      } else {
        await createMutation.mutateAsync(data);
        message.success(t('common.createSuccess') || '新增成功');
      }
      setModalOpen(false);
      setEditingTask(null);
    },
    [editingTask, createMutation, updateMutation, t],
  );

  // 組合表格欄位定義，將狀態/集團/分店/日期篩選 UI 注入對應欄位標題
  const tableColumns = useMemo(() => {
    const statusOptions = [
      { label: t('task.statusScheduled'), value: 'SCHEDULED' },
      { label: t('task.statusUnscheduled'), value: 'UNSCHEDULED' },
      { label: t('task.statusModified'), value: 'MODIFIED' },
      { label: t('task.statusCancelled'), value: 'CANCELLED' },
    ];

    const statusTitle = (
      <ColumnFilterTitle label={t('task.status')} active={!!filters.status}>
        <Select
          value={filters.status}
          options={statusOptions}
          placeholder={t('task.selectStatus')}
          allowClear
          style={{ width: 140 }}
          onChange={handleStatusFilter}
        />
      </ColumnFilterTitle>
    );
    const groupTitle = (
      <ColumnFilterTitle label={t('task.group')} active={!!filters.groupId}>
        <Select
          value={filters.groupId}
          options={groupOptions}
          placeholder={t('task.selectGroup')}
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: 180 }}
          onChange={handleGroupFilter}
        />
      </ColumnFilterTitle>
    );
    const branchTitle = (
      <ColumnFilterTitle label={t('task.branch')} active={!!filters.branchId}>
        <Select
          value={filters.branchId}
          options={branchOptions}
          placeholder={t('task.selectBranch')}
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: 180 }}
          onChange={handleBranchFilter}
        />
      </ColumnFilterTitle>
    );
    const dateTitle = (
      <ColumnFilterTitle label={t('task.date')} active={!!filters.startDate || !!filters.endDate}>
        <DatePicker.RangePicker
          value={[
            filters.startDate ? dayjs(filters.startDate) : null,
            filters.endDate ? dayjs(filters.endDate) : null,
          ]}
          placeholder={[t('task.selectStartDate'), t('task.selectEndDate')]}
          format="YYYY-MM-DD"
          allowClear
          onChange={handleDateFilter}
        />
      </ColumnFilterTitle>
    );

    return [
      ...baseColumns(statusTitle, groupTitle, branchTitle, dateTitle, t),
      buildActionColumn(handleRowClick, t),
    ];
  }, [
    branchOptions,
    filters.branchId,
    filters.endDate,
    filters.groupId,
    filters.startDate,
    filters.status,
    groupOptions,
    handleBranchFilter,
    handleDateFilter,
    handleGroupFilter,
    handleRowClick,
    handleStatusFilter,
    t,
  ]);

  const rowClassName = useCallback((record: Task) => {
    if (record.status === 'CANCELLED') {
      return 'row-task-cancelled';
    }
    if (record.status === 'MODIFIED') {
      return record.isApproved ? 'row-modified-approved' : 'row-modified-pending';
    }
    return '';
  }, []);

  const useCurrentTaskListQuery = useCallback(() => taskListQuery, [taskListQuery]);

  const hasActiveFilters = Boolean(
    filters.status ||
    filters.groupId ||
    filters.branchId ||
    filters.startDate ||
    filters.endDate ||
    filters.keyword,
  );

  const taskListContent = (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          {hasActiveFilters && (
            <Button icon={<ReloadOutlined />} onClick={() => resetFilters()}>
              {t('common.clearFilters')}
            </Button>
          )}
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateClick}>
            {t('task.create')}
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportTasks}
            loading={isExporting}
            disabled={!taskListQuery.data?.total}
          >
            {t('task.export')}
          </Button>
        </Space>
      </div>

      <BaseTable<Task>
        columns={tableColumns}
        queryHook={useCurrentTaskListQuery}
        onRowClick={handleRowClick}
        scroll={{ x: 1350 }}
        cardRender={(record) => renderTaskCard(record, t)}
        rowKey="id"
        rowClassName={rowClassName}
        onPaginationChange={(page, pageSize) => setFilters({ page, pageSize })}
      />

      <Modal
        title={editingTask ? t('task.editTitle') : t('task.createTitle')}
        open={modalOpen}
        onCancel={handleModalClose}
        footer={null}
        width={980}
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
    </>
  );

  const tabItems = [
    {
      key: 'tasks',
      label: t('task.list'),
      children: taskListContent,
    },
    hasPermission('approval:view')
      ? {
          key: 'approval',
          label: t('menu.approval'),
          children: <ApprovalPage />,
        }
      : null,
  ].filter((item): item is Exclude<typeof item, null> => item !== null);

  const requestedTab = searchParams.get('tab') ?? 'tasks';
  const activeTab = tabItems.some((item) => item.key === requestedTab) ? requestedTab : 'tasks';

  // 切換分頁時同步更新網址查詢參數（tab），任務列表分頁為預設分頁不加參數
  const handleTabChange = (key: string) => {
    setSearchParams(key === 'tasks' ? {} : { tab: key });
  };

  return (
    <div className="task-page">
      <Tabs activeKey={activeTab} items={tabItems} onChange={handleTabChange} />
    </div>
  );
}

export default TaskPage;
