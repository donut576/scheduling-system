import { useCallback, useMemo, useState } from 'react';
import type { FC } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  TimePicker,
  message,
} from 'antd';
import { PlusOutlined, SwapOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import BaseModal from '@/components/base/BaseModal';
import {
  usePendingCustomerList,
  useCreatePendingCustomer,
  useUpdatePendingCustomer,
  useConvertPendingCustomer,
} from '@/queries/usePendingCustomerQueries';
import { useCustomerGroups } from '@/queries/useCustomerQueries';
import { useDictStore } from '@/stores';
import type {
  PendingCustomerListParams,
  PendingCustomerFormData,
  ConvertToTaskData,
} from '@/api/pending-customer';
import type { PendingCustomer, PendingCustomerStatus } from '@/types/customer';
import type { PaginatedResponse } from '@/types/common';
import { buildConvertedTaskData } from '@/utils/pendingCustomerConversion';

const { TextArea } = Input;

/**
 * 待定時間客戶管理頁面
 * 整合 BaseTable + BaseModal，提供待定時間客戶列表、新增/編輯、
 * 確認服務時間後轉換為正式任務，以及匯出 Excel 之功能
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4
 */

const STATUS_LABEL_MAP: Record<PendingCustomerStatus, string> = {
  PENDING: '待確認',
  CONFIRMED: '已確認',
  CONVERTED: '已轉換',
};

const STATUS_COLOR_MAP: Record<PendingCustomerStatus, string> = {
  PENDING: 'orange',
  CONFIRMED: 'blue',
  CONVERTED: 'green',
};

const DEFAULT_FILTERS: PendingCustomerListParams = { page: 1, pageSize: 20 };

/**
 * 行動裝置（< 768px）卡片檢視渲染函式。
 *
 * Validates: Requirements 16.1
 */
function renderPendingCustomerCard(
  record: PendingCustomer,
  onConvertClick: (record: PendingCustomer) => void,
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
          <Tag color={STATUS_COLOR_MAP[record.status]}>{STATUS_LABEL_MAP[record.status]}</Tag>
        </Space>
        <span>
          {record.date ?? '日期未定'}{' '}
          {record.startTime && record.endTime
            ? `${record.startTime} ~ ${record.endTime}`
            : '時間未定'}
        </span>
        <span>
          人數：{record.headcount} ／ 班別：{record.shift ?? '-'}
        </span>
        {record.remarks && <span>備註：{record.remarks}</span>}
        {record.status !== 'CONVERTED' && (
          <Button
            type="link"
            icon={<SwapOutlined />}
            aria-label="轉換為正式任務"
            style={{ padding: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onConvertClick(record);
            }}
          >
            轉換
          </Button>
        )}
      </Space>
    </Card>
  );
}

interface PendingCustomerFormValues {
  groupId: string;
  branchId: string;
  date?: dayjs.Dayjs;
  startTime?: dayjs.Dayjs;
  endTime?: dayjs.Dayjs;
  headcount: number;
  shift?: string;
  remarks?: string;
}

interface ConvertFormValues {
  date: dayjs.Dayjs;
  startTime: dayjs.Dayjs;
  endTime: dayjs.Dayjs;
  headcount: number;
  shift: string;
}

const PendingCustomerPage: FC = () => {
  const [filters] = useState<PendingCustomerListParams>({ ...DEFAULT_FILTERS });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PendingCustomer | null>(null);
  const [form] = Form.useForm<PendingCustomerFormValues>();

  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertingRecord, setConvertingRecord] = useState<PendingCustomer | null>(null);
  const [convertForm] = Form.useForm<ConvertFormValues>();

  const { data: customerGroups = [] } = useCustomerGroups();
  const { shifts } = useDictStore();

  const createMutation = useCreatePendingCustomer();
  const updateMutation = useUpdatePendingCustomer();
  const convertMutation = useConvertPendingCustomer();

  const selectedGroupId = Form.useWatch('groupId', form);

  // Wraps usePendingCustomerList with page-local filters, satisfying BaseTable's
  // queryHook signature `() => QueryResult<PaginatedResponse<T>>`.
  function usePendingCustomerListQuery(): QueryResult<PaginatedResponse<PendingCustomer>> {
    return usePendingCustomerList(filters) as QueryResult<PaginatedResponse<PendingCustomer>>;
  }

  const groupOptions = useMemo(
    () => customerGroups.map((g) => ({ label: g.name, value: g.id })),
    [customerGroups],
  );

  const branchOptions = useMemo(() => {
    if (!selectedGroupId) return [];
    const group = customerGroups.find((g) => g.id === selectedGroupId);
    return (group?.branches ?? []).map((b) => ({ label: b.name, value: b.id }));
  }, [selectedGroupId, customerGroups]);

  const handleAddClick = useCallback(() => {
    setEditingRecord(null);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

  const handleEditClick = useCallback(
    (record: PendingCustomer) => {
      setEditingRecord(record);
      form.setFieldsValue({
        groupId: record.groupId,
        branchId: record.branchId,
        date: record.date ? dayjs(record.date) : undefined,
        startTime: record.startTime ? dayjs(record.startTime, 'HH:mm') : undefined,
        endTime: record.endTime ? dayjs(record.endTime, 'HH:mm') : undefined,
        headcount: record.headcount,
        shift: record.shift,
        remarks: record.remarks,
      });
      setModalOpen(true);
    },
    [form],
  );

  const handleModalCancel = useCallback(() => {
    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  }, [form]);

  const handleModalOk = useCallback(async () => {
    const values = await form.validateFields();

    const data: PendingCustomerFormData = {
      groupId: values.groupId,
      branchId: values.branchId,
      date: values.date ? values.date.format('YYYY-MM-DD') : undefined,
      startTime: values.startTime ? values.startTime.format('HH:mm') : undefined,
      endTime: values.endTime ? values.endTime.format('HH:mm') : undefined,
      headcount: values.headcount,
      shift: values.shift,
      remarks: values.remarks,
    };

    if (editingRecord) {
      await updateMutation.mutateAsync({ id: editingRecord.id, data });
      message.success('待定客戶資料已更新');
    } else {
      await createMutation.mutateAsync(data);
      message.success('待定客戶資料已新增');
    }

    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  }, [form, editingRecord, createMutation, updateMutation]);

  const handleConvertClick = useCallback(
    (record: PendingCustomer) => {
      setConvertingRecord(record);
      convertForm.setFieldsValue({
        date: record.date ? dayjs(record.date) : undefined,
        startTime: record.startTime ? dayjs(record.startTime, 'HH:mm') : undefined,
        endTime: record.endTime ? dayjs(record.endTime, 'HH:mm') : undefined,
        headcount: record.headcount,
        shift: record.shift,
      });
      setConvertModalOpen(true);
    },
    [convertForm],
  );

  const handleConvertCancel = useCallback(() => {
    setConvertModalOpen(false);
    setConvertingRecord(null);
    convertForm.resetFields();
  }, [convertForm]);

  const handleConvertOk = useCallback(async () => {
    if (!convertingRecord) return;
    const values = await convertForm.validateFields();

    const confirmedValues: ConvertToTaskData = {
      date: values.date.format('YYYY-MM-DD'),
      startTime: values.startTime.format('HH:mm'),
      endTime: values.endTime.format('HH:mm'),
      shift: values.shift,
      headcount: values.headcount,
    };

    const converted = buildConvertedTaskData(convertingRecord, confirmedValues);
    const data: ConvertToTaskData = {
      date: converted.date,
      startTime: converted.startTime,
      endTime: converted.endTime,
      shift: converted.shift,
      headcount: converted.headcount,
    };

    await convertMutation.mutateAsync({ id: convertingRecord.id, data });
    message.success('待定客戶已轉換為正式任務');

    setConvertModalOpen(false);
    setConvertingRecord(null);
    convertForm.resetFields();
  }, [convertForm, convertingRecord, convertMutation]);

  const columns: ColumnDef<PendingCustomer>[] = [
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
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (_value, record) => (
        <Tag color={STATUS_COLOR_MAP[record.status]}>{STATUS_LABEL_MAP[record.status]}</Tag>
      ),
      exportHeader: '狀態',
      exportKey: (record) => STATUS_LABEL_MAP[record.status],
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (_value, record) => record.date ?? '未定',
      exportHeader: '日期',
      exportKey: (record) => record.date ?? '',
    },
    {
      title: '起訖時間',
      key: 'timeRange',
      width: 130,
      render: (_value, record) =>
        record.startTime && record.endTime ? `${record.startTime} ~ ${record.endTime}` : '未定',
      exportHeader: '起訖時間',
      exportKey: (record) =>
        record.startTime && record.endTime ? `${record.startTime} ~ ${record.endTime}` : '',
    },
    {
      title: '人數',
      dataIndex: 'headcount',
      key: 'headcount',
      width: 80,
      exportHeader: '人數',
      exportKey: 'headcount',
    },
    {
      title: '班別',
      dataIndex: 'shift',
      key: 'shift',
      width: 100,
      exportHeader: '班別',
      exportKey: (record) => record.shift ?? '',
    },
    {
      title: '備註',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 150,
      ellipsis: true,
      exportHeader: '備註',
      exportKey: (record) => record.remarks ?? '',
    },
    {
      title: '建立時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      exportHeader: '建立時間',
      exportKey: 'createdAt',
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_value, record) =>
        record.status !== 'CONVERTED' ? (
          <Button
            type="link"
            icon={<SwapOutlined />}
            aria-label="轉換為正式任務"
            onClick={(e) => {
              e.stopPropagation();
              handleConvertClick(record);
            }}
          >
            轉換
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="pending-customer-page">
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick}>
          新增待定客戶
        </Button>
      </Space>

      <BaseTable<PendingCustomer>
        columns={columns}
        queryHook={usePendingCustomerListQuery}
        exportable
        onRowClick={handleEditClick}
        cardRender={(record) => renderPendingCustomerCard(record, handleConvertClick)}
        rowKey="id"
      />

      <BaseModal
        title={editingRecord ? '編輯待定客戶' : '新增待定客戶'}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="groupId"
            label="集團"
            rules={[{ required: true, message: '請選擇集團' }]}
          >
            <Select
              placeholder="請選擇集團"
              options={groupOptions}
              onChange={() => form.setFieldValue('branchId', undefined)}
            />
          </Form.Item>
          <Form.Item
            name="branchId"
            label="分店"
            rules={[{ required: true, message: '請選擇分店' }]}
          >
            <Select placeholder="請選擇分店" options={branchOptions} disabled={!selectedGroupId} />
          </Form.Item>
          <Form.Item name="date" label="日期">
            <DatePicker style={{ width: '100%' }} placeholder="請選擇日期" />
          </Form.Item>
          <Space.Compact block>
            <Form.Item name="startTime" label="開始時間" style={{ width: '50%' }}>
              <TimePicker style={{ width: '100%' }} format="HH:mm" placeholder="開始時間" />
            </Form.Item>
            <Form.Item name="endTime" label="結束時間" style={{ width: '50%' }}>
              <TimePicker style={{ width: '100%' }} format="HH:mm" placeholder="結束時間" />
            </Form.Item>
          </Space.Compact>
          <Form.Item
            name="headcount"
            label="人數"
            rules={[{ required: true, message: '請輸入人數' }]}
          >
            <InputNumber style={{ width: '100%' }} min={1} placeholder="請輸入人數" />
          </Form.Item>
          <Form.Item name="shift" label="班別">
            <Select
              placeholder="請選擇班別"
              options={shifts}
              allowClear
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="remarks" label="備註">
            <TextArea rows={3} placeholder="請輸入備註" />
          </Form.Item>
        </Form>
      </BaseModal>

      <BaseModal
        title="轉換為正式任務"
        open={convertModalOpen}
        onOk={handleConvertOk}
        onCancel={handleConvertCancel}
        width={500}
      >
        <Form form={convertForm} layout="vertical">
          <Form.Item
            name="date"
            label="服務日期"
            rules={[{ required: true, message: '請選擇服務日期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="請選擇服務日期" />
          </Form.Item>
          <Space.Compact block>
            <Form.Item
              name="startTime"
              label="開始時間"
              style={{ width: '50%' }}
              rules={[{ required: true, message: '請選擇開始時間' }]}
            >
              <TimePicker style={{ width: '100%' }} format="HH:mm" placeholder="開始時間" />
            </Form.Item>
            <Form.Item
              name="endTime"
              label="結束時間"
              style={{ width: '50%' }}
              rules={[{ required: true, message: '請選擇結束時間' }]}
            >
              <TimePicker style={{ width: '100%' }} format="HH:mm" placeholder="結束時間" />
            </Form.Item>
          </Space.Compact>
          <Form.Item name="shift" label="班別" rules={[{ required: true, message: '請選擇班別' }]}>
            <Select placeholder="請選擇班別" options={shifts} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item
            name="headcount"
            label="人數"
            rules={[{ required: true, message: '請輸入人數' }]}
          >
            <InputNumber style={{ width: '100%' }} min={1} placeholder="請輸入人數" />
          </Form.Item>
        </Form>
      </BaseModal>
    </div>
  );
};

export default PendingCustomerPage;
