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
import { useTranslation } from 'react-i18next';
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

const STATUS_KEY_MAP: Record<PendingCustomerStatus, string> = {
  PENDING: 'pendingCustomer.status.pending',
  CONFIRMED: 'pendingCustomer.status.confirmed',
  CONVERTED: 'pendingCustomer.status.converted',
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
          <Tag color={STATUS_COLOR_MAP[record.status]}>{t(STATUS_KEY_MAP[record.status])}</Tag>
        </Space>
        <span>
          {record.date ?? t('pendingCustomer.dateUnset')}{' '}
          {record.startTime && record.endTime
            ? `${record.startTime} ~ ${record.endTime}`
            : t('pendingCustomer.timeUnset')}
        </span>
        <span>
          {t('pendingCustomer.headcount')}：{record.headcount} ／ {t('task.shift')}：
          {record.shift ?? '-'}
        </span>
        {record.remarks && (
          <span>
            {t('task.remarks')}：{record.remarks}
          </span>
        )}
        {record.status !== 'CONVERTED' && (
          <Button
            type="link"
            icon={<SwapOutlined />}
            aria-label={t('pendingCustomer.convert')}
            style={{ padding: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onConvertClick(record);
            }}
          >
            {t('pendingCustomer.convertShort')}
          </Button>
        )}
      </Space>
    </Card>
  );
}

/** 新增/編輯待定時間客戶表單之欄位值型別 */
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

/** 「轉為正式任務」確認表單之欄位值型別 */
interface ConvertFormValues {
  date: dayjs.Dayjs;
  startTime: dayjs.Dayjs;
  endTime: dayjs.Dayjs;
  headcount: number;
  shift: string;
}

/**
 * 待定時間客戶管理頁面主元件
 * 負責列表查詢、新增/編輯 Modal，以及確認服務時間後轉換為正式任務之流程
 */
const PendingCustomerPage: FC = () => {
  const { t } = useTranslation();
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

  // 監控表單內集團欄位變化，用於連動更新分店選項
  const selectedGroupId = Form.useWatch('groupId', form);

  // Wraps usePendingCustomerList with page-local filters, satisfying BaseTable's
  // queryHook signature `() => QueryResult<PaginatedResponse<T>>`.
  function usePendingCustomerListQuery(): QueryResult<PaginatedResponse<PendingCustomer>> {
    return usePendingCustomerList(filters) as QueryResult<PaginatedResponse<PendingCustomer>>;
  }

  // 集團下拉選項
  const groupOptions = useMemo(
    () => customerGroups.map((g) => ({ label: g.name, value: g.id })),
    [customerGroups],
  );

  // 依所選集團連動出的分店下拉選項
  const branchOptions = useMemo(() => {
    if (!selectedGroupId) return [];
    const group = customerGroups.find((g) => g.id === selectedGroupId);
    return (group?.branches ?? []).map((b) => ({ label: b.name, value: b.id }));
  }, [selectedGroupId, customerGroups]);

  // 開啟新增待定客戶的 Modal
  const handleAddClick = useCallback(() => {
    setEditingRecord(null);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

  // 點擊資料列時，帶入現有資料並開啟編輯 Modal
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

  // 取消新增/編輯 Modal 並清空表單
  const handleModalCancel = useCallback(() => {
    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  }, [form]);

  // 送出新增/編輯表單：依是否為編輯模式呼叫更新或建立 API
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
      message.success(t('pendingCustomer.updateSuccess'));
    } else {
      await createMutation.mutateAsync(data);
      message.success(t('pendingCustomer.createSuccess'));
    }

    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  }, [form, editingRecord, createMutation, updateMutation, t]);

  // 開啟「轉為正式任務」確認 Modal，並帶入既有時間/人數等資料供確認或修改
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

  // 取消轉換操作並清空表單
  const handleConvertCancel = useCallback(() => {
    setConvertModalOpen(false);
    setConvertingRecord(null);
    convertForm.resetFields();
  }, [convertForm]);

  // 確認轉換：組合最終服務時間/人數資料後呼叫轉換 API，將待定客戶轉為正式排班任務
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

    // 依待定客戶原始資料與使用者確認之時間/人數，組合出最終要送出之任務資料
    const converted = buildConvertedTaskData(convertingRecord, confirmedValues);
    const data: ConvertToTaskData = {
      date: converted.date,
      startTime: converted.startTime,
      endTime: converted.endTime,
      shift: converted.shift,
      headcount: converted.headcount,
    };

    await convertMutation.mutateAsync({ id: convertingRecord.id, data });
    message.success(t('pendingCustomer.convertSuccess'));

    setConvertModalOpen(false);
    setConvertingRecord(null);
    convertForm.resetFields();
  }, [convertForm, convertingRecord, convertMutation, t]);

  const columns: ColumnDef<PendingCustomer>[] = [
    {
      title: t('task.group'),
      dataIndex: 'groupName',
      key: 'groupName',
      width: 120,
      ellipsis: true,
      exportHeader: t('task.group'),
      exportKey: 'groupName',
    },
    {
      title: t('task.branch'),
      dataIndex: 'branchName',
      key: 'branchName',
      width: 120,
      ellipsis: true,
      exportHeader: t('task.branch'),
      exportKey: 'branchName',
    },
    {
      title: t('task.status'),
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (_value, record) => (
        <Tag color={STATUS_COLOR_MAP[record.status]}>{t(STATUS_KEY_MAP[record.status])}</Tag>
      ),
      exportHeader: t('task.status'),
      exportKey: (record) => t(STATUS_KEY_MAP[record.status]),
    },
    {
      title: t('task.date'),
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (_value, record) => record.date ?? t('pendingCustomer.unset'),
      exportHeader: t('task.date'),
      exportKey: (record) => record.date ?? '',
    },
    {
      title: t('pendingCustomer.timeRange'),
      key: 'timeRange',
      width: 130,
      render: (_value, record) =>
        record.startTime && record.endTime
          ? `${record.startTime} ~ ${record.endTime}`
          : t('pendingCustomer.unset'),
      exportHeader: t('pendingCustomer.timeRange'),
      exportKey: (record) =>
        record.startTime && record.endTime ? `${record.startTime} ~ ${record.endTime}` : '',
    },
    {
      title: t('pendingCustomer.headcount'),
      dataIndex: 'headcount',
      key: 'headcount',
      width: 80,
      exportHeader: t('pendingCustomer.headcount'),
      exportKey: 'headcount',
    },
    {
      title: t('task.shift'),
      dataIndex: 'shift',
      key: 'shift',
      width: 100,
      exportHeader: t('task.shift'),
      exportKey: (record) => record.shift ?? '',
    },
    {
      title: t('task.remarks'),
      dataIndex: 'remarks',
      key: 'remarks',
      width: 150,
      ellipsis: true,
      exportHeader: t('task.remarks'),
      exportKey: (record) => record.remarks ?? '',
    },
    {
      title: t('approval.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      exportHeader: t('approval.createdAt'),
      exportKey: 'createdAt',
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_value, record) =>
        record.status !== 'CONVERTED' ? (
          <Button
            type="link"
            icon={<SwapOutlined />}
            aria-label={t('pendingCustomer.convert')}
            onClick={(e) => {
              e.stopPropagation();
              handleConvertClick(record);
            }}
          >
            {t('pendingCustomer.convertShort')}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="pending-customer-page">
      <BaseTable<PendingCustomer>
        columns={columns}
        queryHook={usePendingCustomerListQuery}
        exportable
        toolbarExtra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick}>
            {t('pendingCustomer.createButton')}
          </Button>
        }
        onRowClick={handleEditClick}
        cardRender={(record) => renderPendingCustomerCard(record, handleConvertClick, t)}
        rowKey="id"
      />

      <BaseModal
        title={editingRecord ? t('pendingCustomer.edit') : t('pendingCustomer.create')}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="groupId"
            label={t('task.group')}
            rules={[{ required: true, message: t('task.groupRequired') }]}
          >
            <Select
              placeholder={t('task.groupSearchPlaceholder')}
              options={groupOptions}
              onChange={() => form.setFieldValue('branchId', undefined)}
            />
          </Form.Item>
          <Form.Item
            name="branchId"
            label={t('task.branch')}
            rules={[{ required: true, message: t('task.branchRequired') }]}
          >
            <Select
              placeholder={t('task.branchSearchPlaceholder')}
              options={branchOptions}
              disabled={!selectedGroupId}
            />
          </Form.Item>
          <Form.Item name="date" label={t('task.date')}>
            <DatePicker style={{ width: '100%' }} placeholder={t('task.dateRequired')} />
          </Form.Item>
          <Space.Compact block>
            <Form.Item name="startTime" label={t('task.startTime')} style={{ width: '50%' }}>
              <TimePicker
                style={{ width: '100%' }}
                format="HH:mm"
                placeholder={t('task.startTime')}
              />
            </Form.Item>
            <Form.Item name="endTime" label={t('task.endTime')} style={{ width: '50%' }}>
              <TimePicker
                style={{ width: '100%' }}
                format="HH:mm"
                placeholder={t('task.endTime')}
              />
            </Form.Item>
          </Space.Compact>
          <Form.Item
            name="headcount"
            label={t('pendingCustomer.headcount')}
            rules={[{ required: true, message: t('task.headcountRequired') }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              placeholder={t('task.headcountRequired')}
            />
          </Form.Item>
          <Form.Item name="shift" label={t('task.shift')}>
            <Select
              placeholder={t('task.shiftPlaceholder')}
              options={shifts}
              allowClear
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="remarks" label={t('task.remarks')}>
            <TextArea rows={3} placeholder={t('task.remarksPlaceholder')} />
          </Form.Item>
        </Form>
      </BaseModal>

      <BaseModal
        title={t('pendingCustomer.convert')}
        open={convertModalOpen}
        onOk={handleConvertOk}
        onCancel={handleConvertCancel}
        width={500}
      >
        <Form form={convertForm} layout="vertical">
          <Form.Item
            name="date"
            label={t('pendingCustomer.serviceDate')}
            rules={[{ required: true, message: t('pendingCustomer.serviceDateRequired') }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder={t('pendingCustomer.serviceDateRequired')}
            />
          </Form.Item>
          <Space.Compact block>
            <Form.Item
              name="startTime"
              label={t('task.startTime')}
              style={{ width: '50%' }}
              rules={[{ required: true, message: t('task.startTimeRequired') }]}
            >
              <TimePicker
                style={{ width: '100%' }}
                format="HH:mm"
                placeholder={t('task.startTime')}
              />
            </Form.Item>
            <Form.Item
              name="endTime"
              label={t('task.endTime')}
              style={{ width: '50%' }}
              rules={[{ required: true, message: t('task.endTimeRequired') }]}
            >
              <TimePicker
                style={{ width: '100%' }}
                format="HH:mm"
                placeholder={t('task.endTime')}
              />
            </Form.Item>
          </Space.Compact>
          <Form.Item
            name="shift"
            label={t('task.shift')}
            rules={[{ required: true, message: t('task.shiftRequired') }]}
          >
            <Select
              placeholder={t('task.shiftPlaceholder')}
              options={shifts}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            name="headcount"
            label={t('pendingCustomer.headcount')}
            rules={[{ required: true, message: t('task.headcountRequired') }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              placeholder={t('task.headcountRequired')}
            />
          </Form.Item>
        </Form>
      </BaseModal>
    </div>
  );
};

export default PendingCustomerPage;
