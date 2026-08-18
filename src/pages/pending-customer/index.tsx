import { useCallback, useMemo, useState } from 'react';
import type { FC } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Modal,
  Alert,
  message,
  Row,
  Col,
  Checkbox,
  Radio,
  Typography,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  CalendarOutlined,
  EditOutlined,
  DownloadOutlined,
  DownOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import TimeSelect from '@/components/business/TimeSelect';
import EmployeeSelect from '@/components/business/EmployeeSelect';
import RecurrenceEditor from '@/components/business/RecurrenceEditor';
import {
  usePendingCustomerList,
  useCreatePendingCustomer,
  useUpdatePendingCustomer,
  useConvertPendingCustomer,
} from '@/queries/usePendingCustomerQueries';
import { useCustomerGroups } from '@/queries/useCustomerQueries';
import { useDictStore } from '@/stores';
import { formatTaskContents } from '@/constants/taskStatus';
import { HOLIDAYS_2026 } from '@/constants/holidays';
import { isHoliday } from '@/utils/date';
import { pendingCustomerApi } from '@/api/pending-customer';
import type {
  PendingCustomerListParams,
  PendingCustomerFormData,
  ConvertToTaskData,
} from '@/api/pending-customer';
import type { CustomerGroup, PendingCustomer } from '@/types/customer';
import type { PaginatedResponse } from '@/types/common';
import type { RecurrenceRule, TaskType } from '@/types/task';
import { exportToExcel, type ExcelColumn } from '@/utils/excel';

const { TextArea } = Input;
const { RangePicker } = DatePicker;
const { Text } = Typography;

const DEFAULT_FILTERS: PendingCustomerListParams = { page: 1, pageSize: 20 };

const DEFAULT_RECURRENCE_RULE: RecurrenceRule = {
  frequency: 'monthly',
  interval: 1,
  endType: 'never',
};

/** 欄位標題內嵌篩選下拉選單通用元件 */
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
        popupRender={() => (
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

/**
 * 待排客戶匯出 Excel 欄位定義
 */
const getPendingCustomerExportColumns = (
  t: (key: string) => string,
): ExcelColumn<PendingCustomer>[] => [
  {
    header: t('approval.createdAt'),
    key: (record) => dayjs(record.createdAt).format('YYYY-MM-DD HH:mm'),
    width: 20,
  },
  {
    header: t('task.group'),
    key: 'groupName',
    width: 20,
  },
  {
    header: t('task.branch'),
    key: 'branchName',
    width: 20,
  },
  {
    header: t('task.date'),
    key: (record) => record.date ?? '待排',
    width: 14,
  },
  {
    header: t('task.startTime'),
    key: (record) => record.startTime ?? '-',
    width: 12,
  },
  {
    header: t('task.endTime'),
    key: (record) =>
      record.endTime
        ? `${record.endTime}${record.isOvernight ? ` (${t('task.overnight')})` : ''}`
        : '-',
    width: 14,
  },
  {
    header: t('task.headcount'),
    key: 'headcount',
    width: 12,
  },
  {
    header: t('task.shift'),
    key: (record) => record.shift ?? '-',
    width: 12,
  },
  {
    header: t('task.route'),
    key: (record) => record.route ?? '-',
    width: 14,
  },
  {
    header: t('task.content'),
    key: (record) => formatTaskContents(record.contents, '、'),
    width: 26,
  },
  {
    header: t('task.assignees'),
    key: (record) =>
      Array.isArray(record.assignees) && record.assignees.length > 0
        ? record.assignees.map((a) => a.employeeName).join('、')
        : '待排',
    width: 20,
  },
  {
    header: t('task.remarks'),
    key: (record) => record.remarks ?? '-',
    width: 26,
  },
];

/**
 * 行動裝置卡片檢視渲染函式
 */
function renderPendingCustomerCard(
  record: PendingCustomer,
  onConvertClick: (record: PendingCustomer) => void,
  onEditClick: (record: PendingCustomer) => void,
  t: (key: string) => string,
) {
  return (
    <Card
      size="small"
      style={{ marginBottom: 8 }}
      data-testid={`pending-customer-card-${record.id}`}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <strong>
            {record.groupName} {record.branchName}
          </strong>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>
            {dayjs(record.createdAt).format('YYYY-MM-DD HH:mm')}
          </span>
        </Space>
        <span>
          {t('task.date')}：
          {record.date ? (
            record.date
          ) : (
            <Tag color="warning" style={{ margin: 0 }}>
              待排
            </Tag>
          )}
          {'  '}
          {record.startTime && record.endTime
            ? `${record.startTime} ~ ${record.endTime}`
            : '（時段待排）'}
        </span>
        <span>
          {t('task.headcount')}：{record.headcount} ／ {t('task.shift')}：{record.shift || '-'} ／{' '}
          {t('task.route')}：{record.route || '-'}
        </span>
        {Array.isArray(record.contents) && record.contents.length > 0 && (
          <span>
            {t('task.content')}：{formatTaskContents(record.contents, '、')}
          </span>
        )}
        {record.remarks && (
          <span>
            {t('task.remarks')}：{record.remarks}
          </span>
        )}
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onEditClick(record);
            }}
          >
            {t('pendingCustomer.edit')}
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<CalendarOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onConvertClick(record);
            }}
          >
            {t('pendingCustomer.confirmTime')}
          </Button>
        </div>
      </Space>
    </Card>
  );
}

/** 新增/編輯待定時間客戶表單之欄位值型別 */
interface PendingCustomerFormValues {
  groupId: string;
  branchId: string;
  taskType?: TaskType;
  date?: Dayjs;
  startTime?: string;
  endTime?: string;
  headcount?: number;
  shift: string;
  route?: string;
  contents: string[];
  otherContentNote?: string;
  assignees?: string[];
  remarks?: string;
}

/** 「排定任務」確認表單之欄位值型別 */
interface ConvertFormValues {
  groupId: string;
  branchId: string;
  taskType?: TaskType;
  date: Dayjs;
  startTime: string;
  endTime: string;
  headcount: number;
  shift: string;
  route: string;
  contents: string[];
  otherContentNote?: string;
  assignees?: string[];
  remarks?: string;
}

/**
 * 待排客戶管理頁面主元件
 * 仿照任務列表欄位展示年度合約預排但時間未定案之客戶，並支援篩選、動態匯出與「排定任務」轉入正式任務
 */
const PendingCustomerPage: FC = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<PendingCustomerListParams>({ ...DEFAULT_FILTERS });
  const [isExporting, setIsExporting] = useState(false);

  // 新增/編輯 Modal 狀態
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PendingCustomer | null>(null);
  const [form] = Form.useForm<PendingCustomerFormValues>();
  const [enableRecurrence, setEnableRecurrence] = useState<boolean>(true);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(DEFAULT_RECURRENCE_RULE);

  // 排定任務 Modal 狀態
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertingRecord, setConvertingRecord] = useState<PendingCustomer | null>(null);
  const [convertForm] = Form.useForm<ConvertFormValues>();
  const [convertEnableRecurrence, setConvertEnableRecurrence] = useState<boolean>(true);
  const [convertRecurrenceRule, setConvertRecurrenceRule] =
    useState<RecurrenceRule>(DEFAULT_RECURRENCE_RULE);

  const { data: customerGroups = [] } = useCustomerGroups();
  const { taskTypes, shifts, routes, contents } = useDictStore();

  const createMutation = useCreatePendingCustomer();
  const updateMutation = useUpdatePendingCustomer();
  const convertMutation = useConvertPendingCustomer();

  // 監控表單內集團欄位變化，用於連動更新分店選項
  const selectedGroupId = Form.useWatch('groupId', form);
  const selectedBranchId = Form.useWatch('branchId', form);
  const formTaskType = Form.useWatch('taskType', form);
  const formDate = Form.useWatch('date', form);
  const formContents: string[] = Form.useWatch('contents', form) ?? [];
  const formAssignees: string[] = Form.useWatch('assignees', form) ?? [];

  const convertGroupId = Form.useWatch('groupId', convertForm);
  const convertBranchId = Form.useWatch('branchId', convertForm);
  const convertTaskType = Form.useWatch('taskType', convertForm);
  const convertDate = Form.useWatch('date', convertForm);
  const convertContents: string[] = Form.useWatch('contents', convertForm) ?? [];
  const convertAssignees: string[] = Form.useWatch('assignees', convertForm) ?? [];

  function usePendingCustomerListQuery(): QueryResult<PaginatedResponse<PendingCustomer>> {
    return usePendingCustomerList(filters) as QueryResult<PaginatedResponse<PendingCustomer>>;
  }

  // 集團下拉選項
  const groupOptions = useMemo(
    () => customerGroups.map((g: CustomerGroup) => ({ label: g.name, value: g.id })),
    [customerGroups],
  );

  // 依所選集團連動出的分店下拉選項（新增/編輯表單用）
  const formBranchOptions = useMemo(() => {
    if (!selectedGroupId) return [];
    const group = customerGroups.find((g: CustomerGroup) => g.id === selectedGroupId);
    return (group?.branches ?? []).map((b) => ({ label: b.name, value: b.id }));
  }, [selectedGroupId, customerGroups]);

  // 依所選集團連動出的分店下拉選項（排定任務表單用）
  const convertBranchOptions = useMemo(() => {
    if (!convertGroupId) return [];
    const group = customerGroups.find((g: CustomerGroup) => g.id === convertGroupId);
    return (group?.branches ?? []).map((b) => ({ label: b.name, value: b.id }));
  }, [convertGroupId, customerGroups]);

  // 客戶要求證照
  const requiredLicenses = useMemo(() => {
    if (!selectedGroupId || !selectedBranchId) return [];
    const group = customerGroups.find((g) => g.id === selectedGroupId);
    const branch = group?.branches.find((b) => b.id === selectedBranchId);
    return branch?.requiredLicenses ?? [];
  }, [customerGroups, selectedGroupId, selectedBranchId]);

  const convertRequiredLicenses = useMemo(() => {
    if (!convertGroupId || !convertBranchId) return [];
    const group = customerGroups.find((g) => g.id === convertGroupId);
    const branch = group?.branches.find((b) => b.id === convertBranchId);
    return branch?.requiredLicenses ?? [];
  }, [customerGroups, convertGroupId, convertBranchId]);

  // 表格篩選用分店下拉選項
  const filterBranchOptions = useMemo(() => {
    const groups = filters.groupId
      ? customerGroups.filter((g: CustomerGroup) => g.id === filters.groupId)
      : customerGroups;

    return groups.flatMap((g: CustomerGroup) =>
      g.branches.map((b) => ({ label: b.name, value: b.id })),
    );
  }, [customerGroups, filters.groupId]);

  // 篩選處理常式
  const handleGroupFilter = useCallback(
    (groupId?: string) =>
      setFilters((prev) => ({ ...prev, groupId, branchId: undefined, page: 1 })),
    [],
  );

  const handleBranchFilter = useCallback(
    (branchId?: string) => setFilters((prev) => ({ ...prev, branchId, page: 1 })),
    [],
  );

  const handleDateFilter = useCallback(
    (dates: null | [dayjs.Dayjs | null, dayjs.Dayjs | null]) =>
      setFilters((prev) => ({
        ...prev,
        startDate: dates?.[0] ? dates[0].format('YYYY-MM-DD') : undefined,
        endDate: dates?.[1] ? dates[1].format('YYYY-MM-DD') : undefined,
        page: 1,
      })),
    [],
  );

  const handleResetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  const isFiltered = useMemo(
    () => Boolean(filters.groupId || filters.branchId || filters.startDate || filters.endDate),
    [filters],
  );

  // 匯出目前篩選結果之待排客戶清單
  const handleExportPendingCustomers = useCallback(async () => {
    try {
      setIsExporting(true);
      const response = await pendingCustomerApi.list({ ...filters, page: 1, pageSize: 10000 });
      const recordsToExport = response.data.data.list ?? [];

      const activeFiltersText: string[] = [];
      if (filters.groupId) {
        const groupName = customerGroups.find((g) => g.id === filters.groupId)?.name;
        if (groupName) activeFiltersText.push(`集團-${groupName}`);
      }
      if (filters.branchId) {
        const branchName = customerGroups
          .flatMap((g) => g.branches)
          .find((b) => b.id === filters.branchId)?.name;
        if (branchName) activeFiltersText.push(`分店-${branchName}`);
      }
      if (filters.startDate || filters.endDate) {
        activeFiltersText.push(`日期-${filters.startDate || ''}~${filters.endDate || ''}`);
      }
      const filenameSuffix =
        activeFiltersText.length > 0 ? `_篩選(${activeFiltersText.join('_')})` : '';

      exportToExcel(
        recordsToExport,
        getPendingCustomerExportColumns(t),
        `待排客戶列表${filenameSuffix}_${dayjs().format('YYYYMMDD_HHmmss')}`,
      );
    } catch {
      message.error(t('common.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  }, [filters, customerGroups, t]);

  // 開啟新增待排客戶的 Modal
  const handleAddClick = useCallback(() => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      taskType: 'CONTRACT',
      shift: (shifts[0]?.value as string) || '早班',
      headcount: 1,
      contents: ['P'],
    });
    setEnableRecurrence(true);
    setRecurrenceRule(DEFAULT_RECURRENCE_RULE);
    setModalOpen(true);
  }, [form, shifts]);

  // 點擊資料列時，帶入現有資料並開啟編輯 Modal
  const handleEditClick = useCallback(
    (record: PendingCustomer) => {
      setEditingRecord(record);
      form.setFieldsValue({
        groupId: record.groupId,
        branchId: record.branchId,
        taskType: 'CONTRACT',
        date: record.date ? dayjs(record.date) : undefined,
        startTime: record.startTime || undefined,
        endTime: record.endTime || undefined,
        headcount: record.headcount || 1,
        shift: record.shift || (shifts[0]?.value as string) || '早班',
        route: record.route || undefined,
        contents: record.contents || ['P'],
        assignees: record.assignees?.map((a) => a.employeeId) ?? [],
        remarks: record.remarks,
      });
      setEnableRecurrence(true);
      setRecurrenceRule(DEFAULT_RECURRENCE_RULE);
      setModalOpen(true);
    },
    [form, shifts],
  );

  // 取消新增/編輯 Modal 並清空表單
  const handleModalCancel = useCallback(() => {
    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  }, [form]);

  // 送出新增/編輯表單
  const handleModalOk = useCallback(async () => {
    const values = await form.validateFields();

    const dateStr = values.date
      ? typeof values.date.format === 'function'
        ? values.date.format('YYYY-MM-DD')
        : String(values.date)
      : undefined;

    const data: PendingCustomerFormData = {
      groupId: values.groupId,
      branchId: values.branchId,
      date: dateStr,
      startTime: values.startTime || undefined,
      endTime: values.endTime || undefined,
      headcount: values.headcount ?? 1,
      shift: values.shift,
      route: values.route || undefined,
      contents: values.contents,
      assignees: values.assignees?.map((id) => ({ employeeId: id, employeeName: '' })),
      remarks: values.remarks,
    };

    if (editingRecord) {
      await updateMutation.mutateAsync({ id: editingRecord.id, data });
      message.success(t('pendingCustomer.updateSuccess'));
    } else {
      await createMutation.mutateAsync(data);
      message.success(t('pendingCustomer.createSuccess'));
    }

    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  }, [form, editingRecord, createMutation, updateMutation, t]);

  // 開啟「排定任務」確認 Modal，並帶入預排之基本資料供填寫具體日期與時段
  const handleConvertClick = useCallback(
    (record: PendingCustomer) => {
      setConvertingRecord(record);
      convertForm.setFieldsValue({
        groupId: record.groupId,
        branchId: record.branchId,
        taskType: 'CONTRACT',
        date: record.date ? dayjs(record.date) : dayjs(),
        startTime: record.startTime || '09:00',
        endTime: record.endTime || '18:00',
        headcount: record.headcount || 1,
        shift: record.shift || (shifts[0]?.value as string) || '早班',
        route: record.route || '第一路',
        contents: record.contents || ['P'],
        assignees: record.assignees?.map((a) => a.employeeId) ?? [],
        remarks: record.remarks,
      });
      setConvertEnableRecurrence(true);
      setConvertRecurrenceRule(DEFAULT_RECURRENCE_RULE);
      setConvertModalOpen(true);
    },
    [convertForm, shifts],
  );

  // 取消排定任務 Modal
  const handleConvertCancel = useCallback(() => {
    setConvertModalOpen(false);
    setConvertingRecord(null);
    convertForm.resetFields();
  }, [convertForm]);

  // 確認排定：建立正式排班任務並移入任務列表
  const handleConvertOk = useCallback(async () => {
    if (!convertingRecord) return;
    const values = await convertForm.validateFields();

    const dateStr = values.date
      ? typeof values.date.format === 'function'
        ? values.date.format('YYYY-MM-DD')
        : String(values.date)
      : dayjs().format('YYYY-MM-DD');

    const data: ConvertToTaskData = {
      date: dateStr,
      startTime: values.startTime,
      endTime: values.endTime,
      shift: values.shift,
      headcount: values.headcount,
      route: values.route,
      contents: values.contents,
      assignees: values.assignees?.map((id) => ({ employeeId: id, employeeName: '' })),
      remarks: values.remarks,
    };

    await convertMutation.mutateAsync({ id: convertingRecord.id, data });
    message.success(t('pendingCustomer.convertSuccess'));

    setConvertModalOpen(false);
    setConvertingRecord(null);
    convertForm.resetFields();
  }, [convertForm, convertingRecord, convertMutation, t]);

  // 仿照任務列表之欄位結構，將狀態改為建立時間，未確認項目以「-」或「待排」呈現
  const columns: ColumnDef<PendingCustomer>[] = [
    {
      title: t('approval.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (_value, record) => dayjs(record.createdAt).format('YYYY-MM-DD HH:mm'),
      exportHeader: t('approval.createdAt'),
      exportKey: (record) => dayjs(record.createdAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: (
        <ColumnFilterTitle label={t('task.group')} active={!!filters.groupId}>
          <Select
            placeholder={t('task.groupPlaceholder')}
            style={{ width: 180 }}
            allowClear
            showSearch
            optionFilterProp="label"
            value={filters.groupId}
            onChange={handleGroupFilter}
            options={groupOptions}
          />
        </ColumnFilterTitle>
      ),
      dataIndex: 'groupName',
      key: 'groupId',
      width: 180,
      exportHeader: t('task.group'),
      exportKey: 'groupName',
    },
    {
      title: (
        <ColumnFilterTitle label={t('task.branch')} active={!!filters.branchId}>
          <Select
            placeholder={t('task.branchPlaceholder')}
            style={{ width: 180 }}
            allowClear
            showSearch
            optionFilterProp="label"
            value={filters.branchId}
            onChange={handleBranchFilter}
            options={filterBranchOptions}
          />
        </ColumnFilterTitle>
      ),
      dataIndex: 'branchName',
      key: 'branchId',
      width: 160,
      exportHeader: t('task.branch'),
      exportKey: 'branchName',
    },
    {
      title: (
        <ColumnFilterTitle
          label={t('task.date')}
          active={Boolean(filters.startDate || filters.endDate)}
        >
          <RangePicker
            style={{ width: 240 }}
            value={
              filters.startDate && filters.endDate
                ? [dayjs(filters.startDate), dayjs(filters.endDate)]
                : null
            }
            onChange={handleDateFilter}
          />
        </ColumnFilterTitle>
      ),
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (_value: unknown, record: PendingCustomer) =>
        record.date ? record.date : <Tag color="warning">待排</Tag>,
      exportHeader: t('task.date'),
      exportKey: (record) => record.date ?? '待排',
    },
    {
      title: t('task.startTime'),
      dataIndex: 'startTime',
      key: 'startTime',
      width: 100,
      render: (_value: unknown, record: PendingCustomer) => record.startTime || '-',
      exportHeader: t('task.startTime'),
      exportKey: (record) => record.startTime ?? '-',
    },
    {
      title: t('task.endTime'),
      dataIndex: 'endTime',
      key: 'endTime',
      width: 110,
      render: (_value: unknown, record: PendingCustomer) =>
        record.endTime
          ? `${record.endTime}${record.isOvernight ? ` (${t('task.overnight')})` : ''}`
          : '-',
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
      render: (_value: unknown, record: PendingCustomer) => record.headcount ?? '-',
      exportHeader: t('task.headcount'),
      exportKey: 'headcount',
    },
    {
      title: t('task.shift'),
      dataIndex: 'shift',
      key: 'shift',
      width: 100,
      render: (_value: unknown, record: PendingCustomer) => record.shift || '-',
      exportHeader: t('task.shift'),
      exportKey: (record) => record.shift ?? '-',
    },
    {
      title: t('task.route'),
      dataIndex: 'route',
      key: 'route',
      width: 110,
      render: (_value: unknown, record: PendingCustomer) => record.route || '-',
      exportHeader: t('task.route'),
      exportKey: (record) => record.route ?? '-',
    },
    {
      title: t('task.content'),
      dataIndex: 'contents',
      key: 'contents',
      width: 160,
      ellipsis: true,
      render: (_value: unknown, record: PendingCustomer) =>
        formatTaskContents(record.contents, '、'),
      exportHeader: t('task.content'),
      exportKey: (record) => formatTaskContents(record.contents, '、'),
    },
    {
      title: t('task.assignees'),
      dataIndex: 'assignees',
      key: 'assignees',
      width: 120,
      ellipsis: true,
      render: (_value: unknown, record: PendingCustomer) =>
        Array.isArray(record.assignees) && record.assignees.length > 0 ? (
          record.assignees.map((a) => a.employeeName).join('、')
        ) : (
          <span style={{ color: '#8c8c8c' }}>待排</span>
        ),
      exportHeader: t('task.assignees'),
      exportKey: (record) =>
        Array.isArray(record.assignees) && record.assignees.length > 0
          ? record.assignees.map((a) => a.employeeName).join('、')
          : '待排',
    },
    {
      title: t('task.remarks'),
      dataIndex: 'remarks',
      key: 'remarks',
      width: 140,
      ellipsis: true,
      render: (_value: unknown, record: PendingCustomer) => record.remarks || '-',
      exportHeader: t('task.remarks'),
      exportKey: (record) => record.remarks ?? '-',
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 140,
      render: (_value: unknown, record: PendingCustomer) => (
        <Space size="small" onClick={(e) => e.stopPropagation()}>
          <Button
            size="small"
            type="primary"
            icon={<CalendarOutlined />}
            onClick={() => handleConvertClick(record)}
          >
            {t('pendingCustomer.confirmTime')}
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditClick(record)}
            aria-label={t('pendingCustomer.edit')}
          />
        </Space>
      ),
    },
  ];

  const showOtherNote = formContents.includes('OTHER') || formContents.includes('其他');
  const convertShowOtherNote =
    convertContents.includes('OTHER') || convertContents.includes('其他');

  return (
    <div className="pending-customer-page">
      {/* 頂部操作列 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          {isFiltered && (
            <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
              {t('common.clearAllFilters')}
            </Button>
          )}
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick}>
            {t('pendingCustomer.createButton')}
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportPendingCustomers}
            loading={isExporting}
          >
            列表匯出
          </Button>
        </Space>
      </div>

      {/* 待排客戶列表 */}
      <BaseTable<PendingCustomer>
        columns={columns}
        queryHook={usePendingCustomerListQuery}
        onRowClick={handleEditClick}
        cardRender={(record) =>
          renderPendingCustomerCard(record, handleConvertClick, handleEditClick, t)
        }
        rowKey="id"
      />

      {/* 新增/編輯待排客戶 Modal（與新增任務相同之 4 Card 分區架構，非必填項可留空） */}
      {modalOpen && (
        <Modal
          title={editingRecord ? '編輯待排客戶表單' : '新增待排客戶表單'}
          open={modalOpen}
          onCancel={handleModalCancel}
          width={980}
          destroyOnClose
          footer={null}
        >
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              {/* 左側欄 */}
              <Col xs={24} lg={12}>
                {/* 區塊 1: 基本資訊 */}
                <Card
                  size="small"
                  title="🏢 基本資訊"
                  style={{ marginBottom: 16, borderRadius: 8 }}
                >
                  <Form.Item
                    name="groupId"
                    label={t('task.group')}
                    rules={[{ required: true, message: t('task.groupRequired') }]}
                  >
                    <Select
                      placeholder={t('task.groupSearchPlaceholder')}
                      options={groupOptions}
                      showSearch
                      optionFilterProp="label"
                      onChange={() => form.setFieldValue('branchId', undefined)}
                      aria-label={t('task.group')}
                    />
                  </Form.Item>

                  <Form.Item
                    name="taskType"
                    label="任務類型"
                    rules={[{ required: true, message: '請選擇任務類型' }]}
                  >
                    <Checkbox.Group
                      options={taskTypes}
                      value={formTaskType ? [formTaskType] : []}
                      onChange={(checkedValues) => {
                        const last = checkedValues[checkedValues.length - 1];
                        form.setFieldValue('taskType', last);
                      }}
                    />
                  </Form.Item>

                  <Form.Item
                    name="branchId"
                    label={t('task.branch')}
                    rules={[{ required: true, message: t('task.branchRequired') }]}
                  >
                    <Select
                      placeholder={
                        selectedGroupId
                          ? t('task.branchSearchPlaceholder')
                          : t('task.selectGroupFirst')
                      }
                      options={formBranchOptions}
                      showSearch
                      optionFilterProp="label"
                      disabled={!selectedGroupId}
                      aria-label={t('task.branch')}
                    />
                  </Form.Item>
                </Card>

                {/* 區塊 2: 排程與週期（待排客戶：日期與起訖時間可留空） */}
                <Card size="small" title="排程與週期" style={{ borderRadius: 8 }}>
                  <Form.Item
                    name="date"
                    label={t('task.taskDate')}
                    extra="未填寫日期將視為待排時間客戶"
                  >
                    <DatePicker
                      style={{ width: '100%' }}
                      placeholder="未定案可留空"
                      cellRender={(current, info) => {
                        if (info.type !== 'date') return info.originNode;
                        const d = current as Dayjs;
                        const dateStr = d.format('YYYY-MM-DD');
                        const isSun = d.day() === 0;
                        const isSat = d.day() === 6;
                        const isHol = isHoliday(dateStr, HOLIDAYS_2026) || isSun;
                        return (
                          <div
                            className={`ant-picker-cell-inner ${
                              isHol
                                ? 'calendar-cell-holiday'
                                : isSat
                                  ? 'calendar-cell-saturday'
                                  : ''
                            }`}
                          >
                            {d.date()}
                          </div>
                        );
                      }}
                      aria-label={t('task.taskDate')}
                    />
                  </Form.Item>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="startTime" label={t('task.startTime')}>
                        <TimeSelect aria-label={t('task.startTime')} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="endTime" label={t('task.endTime')}>
                        <TimeSelect aria-label={t('task.endTime')} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Text
                    type="secondary"
                    style={{ display: 'block', marginTop: -8, marginBottom: 12, fontSize: 12 }}
                  >
                    {t('task.overnightHint')}
                  </Text>

                  <Divider style={{ margin: '12px 0' }} />

                  <Form.Item label="週期" required style={{ marginBottom: 8 }}>
                    <Radio.Group
                      value={enableRecurrence}
                      onChange={(e) => setEnableRecurrence(e.target.value)}
                      style={{ marginBottom: enableRecurrence ? 12 : 0 }}
                    >
                      <Radio.Button value={false}>無週期</Radio.Button>
                      <Radio.Button value={true}>有週期</Radio.Button>
                    </Radio.Group>
                    {enableRecurrence && (
                      <div style={{ marginTop: 8 }}>
                        <RecurrenceEditor
                          value={recurrenceRule}
                          onChange={(rule) => setRecurrenceRule(rule)}
                        />
                      </div>
                    )}
                  </Form.Item>
                </Card>
              </Col>

              {/* 右側欄 */}
              <Col xs={24} lg={12}>
                {/* 區塊 3: 內容與指派人員 */}
                <Card
                  size="small"
                  title="內容與指派人員"
                  style={{ marginBottom: 16, borderRadius: 8 }}
                >
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="shift"
                        label={t('task.shift')}
                        rules={[{ required: true, message: t('task.shiftRequired') }]}
                      >
                        <Select
                          placeholder={t('task.shiftPlaceholder')}
                          options={shifts}
                          allowClear
                          showSearch
                          optionFilterProp="label"
                          aria-label={t('task.shift')}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="route" label={t('task.route')}>
                        <Select
                          placeholder={t('task.routePlaceholder')}
                          options={routes}
                          allowClear
                          showSearch
                          optionFilterProp="label"
                          aria-label={t('task.route')}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="contents"
                    label="內容"
                    rules={[{ required: true, message: t('task.contentRequired') }]}
                  >
                    <Checkbox.Group options={contents} />
                  </Form.Item>

                  {showOtherNote && (
                    <Form.Item
                      name="otherContentNote"
                      label="其他內容說明"
                      rules={[{ required: true, message: '勾選「其他」時，請務必填寫說明' }]}
                    >
                      <Input placeholder="請輸入自訂服務項目內容" maxLength={100} showCount />
                    </Form.Item>
                  )}

                  <Form.Item name="headcount" label="人數需求">
                    <InputNumber
                      min={1}
                      max={50}
                      style={{ width: '100%' }}
                      placeholder="人數需求（預設 1 人）"
                      aria-label={t('task.headcount')}
                    />
                  </Form.Item>

                  <Form.Item name="assignees" label="指派人員（按鈕式點選）">
                    <EmployeeSelect
                      value={formAssignees}
                      onChange={(ids) => form.setFieldValue('assignees', ids)}
                      date={formDate?.format('YYYY-MM-DD')}
                      requiredLicenses={requiredLicenses}
                    />
                  </Form.Item>
                </Card>

                {/* 區塊 4: 備註說明 */}
                <Card size="small" title="備註說明" style={{ borderRadius: 8 }}>
                  <Form.Item name="remarks" style={{ marginBottom: 0 }}>
                    <TextArea
                      rows={3}
                      maxLength={500}
                      showCount
                      placeholder={t('task.remarksPlaceholder')}
                      aria-label={t('task.remarks')}
                    />
                  </Form.Item>
                </Card>
              </Col>
            </Row>

            <Divider style={{ margin: '16px 0' }} />

            {/* 表單操作按鈕：確定在取消左邊 */}
            <Form.Item style={{ marginBottom: 0 }}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button
                  type="primary"
                  htmlType="button"
                  onClick={() => void handleModalOk()}
                  loading={createMutation.isPending || updateMutation.isPending}
                  aria-label="確定"
                >
                  確定
                </Button>
                <Button htmlType="button" onClick={handleModalCancel} aria-label="取消">
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      )}

      {/* 排定任務 Modal（將待排客戶留空欄位確認為必填，確認鍵在取消鍵左邊） */}
      {convertModalOpen && (
        <Modal
          title="排定任務表單"
          open={convertModalOpen}
          onCancel={handleConvertCancel}
          width={980}
          destroyOnClose
          footer={null}
        >
          {convertingRecord && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`【${convertingRecord.groupName} - ${convertingRecord.branchName}】`}
              description="請確認並填寫以下服務日期、時段、路線與指派人員（皆為必填），確認後將正式排入任務列表。"
            />
          )}
          <Form form={convertForm} layout="vertical">
            <Row gutter={16}>
              {/* 左側欄 */}
              <Col xs={24} lg={12}>
                {/* 區塊 1: 基本資訊 */}
                <Card
                  size="small"
                  title="🏢 基本資訊"
                  style={{ marginBottom: 16, borderRadius: 8 }}
                >
                  <Form.Item
                    name="groupId"
                    label={t('task.group')}
                    rules={[{ required: true, message: t('task.groupRequired') }]}
                  >
                    <Select
                      placeholder={t('task.groupSearchPlaceholder')}
                      options={groupOptions}
                      showSearch
                      optionFilterProp="label"
                      onChange={() => convertForm.setFieldValue('branchId', undefined)}
                      aria-label={t('task.group')}
                    />
                  </Form.Item>

                  <Form.Item
                    name="taskType"
                    label="任務類型"
                    rules={[{ required: true, message: '請選擇任務類型' }]}
                  >
                    <Checkbox.Group
                      options={taskTypes}
                      value={convertTaskType ? [convertTaskType] : []}
                      onChange={(checkedValues) => {
                        const last = checkedValues[checkedValues.length - 1];
                        convertForm.setFieldValue('taskType', last);
                      }}
                    />
                  </Form.Item>

                  <Form.Item
                    name="branchId"
                    label={t('task.branch')}
                    rules={[{ required: true, message: t('task.branchRequired') }]}
                  >
                    <Select
                      placeholder={
                        convertGroupId
                          ? t('task.branchSearchPlaceholder')
                          : t('task.selectGroupFirst')
                      }
                      options={convertBranchOptions}
                      showSearch
                      optionFilterProp="label"
                      disabled={!convertGroupId}
                      aria-label={t('task.branch')}
                    />
                  </Form.Item>
                </Card>

                {/* 區塊 2: 排程與週期（排定任務：日期與起訖時間改為必填） */}
                <Card size="small" title="排程與週期" style={{ borderRadius: 8 }}>
                  <Form.Item
                    name="date"
                    label={t('task.taskDate')}
                    rules={[{ required: true, message: t('pendingCustomer.serviceDateRequired') }]}
                  >
                    <DatePicker
                      style={{ width: '100%' }}
                      placeholder={t('pendingCustomer.serviceDateRequired')}
                      cellRender={(current, info) => {
                        if (info.type !== 'date') return info.originNode;
                        const d = current as Dayjs;
                        const dateStr = d.format('YYYY-MM-DD');
                        const isSun = d.day() === 0;
                        const isSat = d.day() === 6;
                        const isHol = isHoliday(dateStr, HOLIDAYS_2026) || isSun;
                        return (
                          <div
                            className={`ant-picker-cell-inner ${
                              isHol
                                ? 'calendar-cell-holiday'
                                : isSat
                                  ? 'calendar-cell-saturday'
                                  : ''
                            }`}
                          >
                            {d.date()}
                          </div>
                        );
                      }}
                      aria-label={t('task.taskDate')}
                    />
                  </Form.Item>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="startTime"
                        label={t('task.startTime')}
                        rules={[{ required: true, message: t('task.startTimeRequired') }]}
                      >
                        <TimeSelect aria-label={t('task.startTime')} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="endTime"
                        label={t('task.endTime')}
                        rules={[{ required: true, message: t('task.endTimeRequired') }]}
                      >
                        <TimeSelect aria-label={t('task.endTime')} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Text
                    type="secondary"
                    style={{ display: 'block', marginTop: -8, marginBottom: 12, fontSize: 12 }}
                  >
                    {t('task.overnightHint')}
                  </Text>

                  <Divider style={{ margin: '12px 0' }} />

                  <Form.Item label="週期" required style={{ marginBottom: 8 }}>
                    <Radio.Group
                      value={convertEnableRecurrence}
                      onChange={(e) => setConvertEnableRecurrence(e.target.value)}
                      style={{ marginBottom: convertEnableRecurrence ? 12 : 0 }}
                    >
                      <Radio.Button value={false}>無週期</Radio.Button>
                      <Radio.Button value={true}>有週期</Radio.Button>
                    </Radio.Group>
                    {convertEnableRecurrence && (
                      <div style={{ marginTop: 8 }}>
                        <RecurrenceEditor
                          value={convertRecurrenceRule}
                          onChange={(rule) => setConvertRecurrenceRule(rule)}
                        />
                      </div>
                    )}
                  </Form.Item>
                </Card>
              </Col>

              {/* 右側欄 */}
              <Col xs={24} lg={12}>
                {/* 區塊 3: 內容與指派人員（排定任務：班次、路次、內容、人數需求、指派人員皆為必填） */}
                <Card
                  size="small"
                  title="內容與指派人員"
                  style={{ marginBottom: 16, borderRadius: 8 }}
                >
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="shift"
                        label={t('task.shift')}
                        rules={[{ required: true, message: t('task.shiftRequired') }]}
                      >
                        <Select
                          placeholder={t('task.shiftPlaceholder')}
                          options={shifts}
                          allowClear
                          showSearch
                          optionFilterProp="label"
                          aria-label={t('task.shift')}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="route"
                        label={t('task.route')}
                        rules={[{ required: true, message: '請選擇路次' }]}
                      >
                        <Select
                          placeholder={t('task.routePlaceholder')}
                          options={routes}
                          allowClear
                          showSearch
                          optionFilterProp="label"
                          aria-label={t('task.route')}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="contents"
                    label="內容"
                    rules={[{ required: true, message: t('task.contentRequired') }]}
                  >
                    <Checkbox.Group options={contents} />
                  </Form.Item>

                  {convertShowOtherNote && (
                    <Form.Item
                      name="otherContentNote"
                      label="其他內容說明"
                      rules={[{ required: true, message: '勾選「其他」時，請務必填寫說明' }]}
                    >
                      <Input placeholder="請輸入自訂服務項目內容" maxLength={100} showCount />
                    </Form.Item>
                  )}

                  <Form.Item
                    name="headcount"
                    label="人數需求"
                    rules={[{ required: true, message: t('task.headcountRequired') }]}
                  >
                    <InputNumber
                      min={1}
                      max={50}
                      style={{ width: '100%' }}
                      placeholder={t('task.headcountRequired')}
                      aria-label={t('task.headcount')}
                    />
                  </Form.Item>

                  <Form.Item
                    name="assignees"
                    label="指派人員（按鈕式點選）"
                    rules={[{ required: true, message: '請至少指派一名員工' }]}
                  >
                    <EmployeeSelect
                      value={convertAssignees}
                      onChange={(ids) => convertForm.setFieldValue('assignees', ids)}
                      date={convertDate?.format('YYYY-MM-DD')}
                      requiredLicenses={convertRequiredLicenses}
                    />
                  </Form.Item>
                </Card>

                {/* 區塊 4: 備註說明 */}
                <Card size="small" title="備註說明" style={{ borderRadius: 8 }}>
                  <Form.Item name="remarks" style={{ marginBottom: 0 }}>
                    <TextArea
                      rows={3}
                      maxLength={500}
                      showCount
                      placeholder={t('task.remarksPlaceholder')}
                      aria-label={t('task.remarks')}
                    />
                  </Form.Item>
                </Card>
              </Col>
            </Row>

            <Divider style={{ margin: '16px 0' }} />

            {/* 表單操作按鈕：確定在取消左邊 */}
            <Form.Item style={{ marginBottom: 0 }}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button
                  type="primary"
                  htmlType="button"
                  onClick={() => void handleConvertOk()}
                  loading={convertMutation.isPending}
                  aria-label="確定"
                >
                  確定
                </Button>
                <Button htmlType="button" onClick={handleConvertCancel} aria-label="取消">
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  );
};

export default PendingCustomerPage;
