import { useCallback, useState } from 'react';
import type { FC } from 'react';
import { Button, Card, Form, Input, Select, Space, Tag, message, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import BaseSearchForm, { type SearchFieldConfig } from '@/components/base/BaseSearchForm';
import BaseModal from '@/components/base/BaseModal';
import {
  useCustomerList,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
} from '@/queries/useCustomerQueries';
import { LICENSE_TYPE_MAP, LICENSE_TYPE_OPTIONS } from '@/constants/licenseTypes';
import type { CustomerListParams, CustomerFormData } from '@/api/customer';
import type { Customer } from '@/types/customer';
import type { PaginatedResponse } from '@/types/common';

const { TextArea } = Input;

/**
 * 客戶資料管理頁面
 * 整合 BaseTable + BaseSearchForm，提供客戶集團/分店資料 CRUD 與搜尋篩選功能
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */

const DEFAULT_FILTERS: CustomerListParams = { page: 1, pageSize: 20 };

/**
 * 行動裝置（< 768px）卡片檢視渲染函式。
 *
 * Validates: Requirements 16.1
 */
function renderCustomerCard(
  record: Customer,
  onDelete: (record: Customer) => void,
  t: (key: string) => string,
) {
  return (
    <Card
      hoverable
      className="management-card customer-management-card"
      data-testid={`customer-card-${record.id}`}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space align="start" style={{ justifyContent: 'space-between', width: '100%' }}>
          <div>
            <div className="management-card-title">
              {record.groupName} {record.branchName}
            </div>
            <div className="management-card-subtitle">{record.branchName}</div>
          </div>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            aria-label={t('customer.deleteCustomer')}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(record);
            }}
          />
        </Space>
        <div className="management-card-info">{record.address}</div>
        <div className="management-card-info">
          {`${t('customer.contactName')}：${record.contactName} ／ ${t('customer.contactPhoneShort')}：${record.contactPhone}`}
        </div>
        {(record.requiredLicenses ?? []).length > 0 && (
          <Space size={[4, 4]} wrap>
            {(record.requiredLicenses ?? []).map((lic) => (
              <Tag key={lic}>{LICENSE_TYPE_MAP[lic] ?? lic}</Tag>
            ))}
          </Space>
        )}
        {record.remarks && (
          <div className="management-card-note">
            {t('customer.remarks')}：{record.remarks}
          </div>
        )}
      </Space>
    </Card>
  );
}

/**
 * 客戶資料管理頁面主元件
 * 負責搜尋條件、分頁、新增/編輯 Modal 與刪除確認的狀態管理
 */
const CustomerPage: FC = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<CustomerListParams>({
    ...DEFAULT_FILTERS,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form] = Form.useForm<CustomerFormData>();
  const localizedSearchFields: SearchFieldConfig[] = [
    {
      name: 'keyword',
      label: t('common.keyword'),
      type: 'input',
      placeholder: t('customer.searchPlaceholder'),
    },
  ];

  // 建立/更新/刪除客戶資料的 mutation hooks
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();

  // Wraps useCustomerList with page-local filters, satisfying BaseTable's
  // queryHook signature `() => QueryResult<PaginatedResponse<T>>`.
  function useCustomerListQuery(): QueryResult<PaginatedResponse<Customer>> {
    return useCustomerList(filters) as QueryResult<PaginatedResponse<Customer>>;
  }

  // 依關鍵字搜尋，重設回第一頁
  const handleSearch = useCallback((values: Record<string, unknown>) => {
    setFilters((prev) => ({
      ...prev,
      keyword: (values.keyword as string) || undefined,
      page: 1,
    }));
  }, []);

  // 重置搜尋條件為預設值
  const handleReset = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  // 開啟新增客戶的 Modal
  const handleAddClick = useCallback(() => {
    setEditingCustomer(null);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

  // 點擊資料列時，帶入現有資料並開啟編輯 Modal
  const handleEditClick = useCallback(
    (record: Customer) => {
      setEditingCustomer(record);
      form.setFieldsValue({
        groupName: record.groupName,
        branchName: record.branchName,
        address: record.address,
        contactName: record.contactName,
        contactPhone: record.contactPhone,
        requiredLicenses: record.requiredLicenses,
        remarks: record.remarks,
      });
      setModalOpen(true);
    },
    [form],
  );

  // 取消 Modal 並清空表單
  const handleModalCancel = useCallback(() => {
    setModalOpen(false);
    setEditingCustomer(null);
    form.resetFields();
  }, [form]);

  // 送出表單：依是否為編輯模式呼叫更新或建立 API
  const handleModalOk = useCallback(async () => {
    const values = await form.validateFields();

    if (editingCustomer) {
      await updateMutation.mutateAsync({ id: editingCustomer.id, data: values });
      message.success(t('customer.updateSuccess'));
    } else {
      await createMutation.mutateAsync(values);
      message.success(t('customer.createSuccess'));
    }

    setModalOpen(false);
    setEditingCustomer(null);
    form.resetFields();
  }, [form, editingCustomer, createMutation, updateMutation, t]);

  // 彈出刪除確認 Modal，確認後呼叫刪除 API
  const handleDelete = useCallback(
    (record: Customer) => {
      Modal.confirm({
        title: t('customer.deleteTitle'),
        content: t('customer.deleteConfirm', {
          name: `${record.groupName} ${record.branchName}`,
        }),
        okText: t('customer.confirmDelete'),
        cancelText: t('common.cancel'),
        okButtonProps: { danger: true },
        onOk: async () => {
          await deleteMutation.mutateAsync(record.id);
          message.success(t('customer.deleteSuccess'));
        },
      });
    },
    [deleteMutation, t],
  );

  const columns: ColumnDef<Customer>[] = [
    {
      title: t('customer.groupName'),
      dataIndex: 'groupName',
      key: 'groupName',
      width: 120,
      ellipsis: true,
      exportHeader: t('customer.groupName'),
      exportKey: 'groupName',
    },
    {
      title: t('customer.branchName'),
      dataIndex: 'branchName',
      key: 'branchName',
      width: 120,
      ellipsis: true,
      exportHeader: t('customer.branchName'),
      exportKey: 'branchName',
    },
    {
      title: t('customer.address'),
      dataIndex: 'address',
      key: 'address',
      width: 220,
      ellipsis: true,
      exportHeader: t('customer.address'),
      exportKey: 'address',
    },
    {
      title: t('customer.contactName'),
      dataIndex: 'contactName',
      key: 'contactName',
      width: 100,
      exportHeader: t('customer.contactName'),
      exportKey: 'contactName',
    },
    {
      title: t('customer.contactPhone'),
      dataIndex: 'contactPhone',
      key: 'contactPhone',
      width: 120,
      exportHeader: t('customer.contactPhone'),
      exportKey: 'contactPhone',
    },
    {
      title: t('customer.requiredLicenses'),
      key: 'requiredLicenses',
      width: 220,
      render: (_value, record) => (
        <Space size={[4, 4]} wrap>
          {(record.requiredLicenses ?? []).map((lic) => (
            <Tag key={lic}>{LICENSE_TYPE_MAP[lic] ?? lic}</Tag>
          ))}
        </Space>
      ),
      exportHeader: t('customer.requiredLicenses'),
      exportKey: (record) =>
        (record.requiredLicenses ?? []).map((lic) => LICENSE_TYPE_MAP[lic] ?? lic).join(', '),
    },
    {
      title: t('customer.remarks'),
      dataIndex: 'remarks',
      key: 'remarks',
      width: 150,
      ellipsis: true,
      exportHeader: t('customer.remarks'),
      exportKey: 'remarks',
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 90,
      fixed: 'right',
      render: (_value, record) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          aria-label={t('customer.deleteCustomer')}
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(record);
          }}
        />
      ),
    },
  ];

  return (
    <div className="customer-page">
      <BaseSearchForm
        fields={localizedSearchFields}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      <BaseTable<Customer>
        columns={columns}
        queryHook={useCustomerListQuery}
        exportable
        toolbarExtra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick}>
            {t('customer.createButton')}
          </Button>
        }
        onRowClick={handleEditClick}
        cardRender={(record) => renderCustomerCard(record, handleDelete, t)}
        cardLayout="always"
        rowKey="id"
      />

      <BaseModal
        title={editingCustomer ? t('customer.edit') : t('customer.create')}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="groupName"
            label={t('customer.groupName')}
            rules={[{ required: true, message: t('customer.groupNameRequired') }]}
          >
            <Input placeholder={t('customer.groupNamePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="branchName"
            label={t('customer.branchName')}
            rules={[{ required: true, message: t('customer.branchNameRequired') }]}
          >
            <Input placeholder={t('customer.branchNamePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="address"
            label={t('customer.address')}
            rules={[{ required: true, message: t('customer.addressRequired') }]}
          >
            <Input placeholder={t('customer.addressPlaceholder')} />
          </Form.Item>
          <Form.Item
            name="contactName"
            label={t('customer.contactName')}
            rules={[{ required: true, message: t('customer.contactNameRequired') }]}
          >
            <Input placeholder={t('customer.contactNamePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="contactPhone"
            label={t('customer.contactPhone')}
            rules={[{ required: true, message: t('customer.contactPhoneRequired') }]}
          >
            <Input placeholder={t('customer.contactPhonePlaceholder')} />
          </Form.Item>
          <Form.Item name="requiredLicenses" label={t('customer.requiredLicenses')}>
            <Select
              mode="multiple"
              placeholder={t('customer.requiredLicensesPlaceholder')}
              options={LICENSE_TYPE_OPTIONS}
              allowClear
            />
          </Form.Item>
          <Form.Item name="remarks" label={t('customer.remarks')}>
            <TextArea rows={3} placeholder={t('customer.remarksPlaceholder')} />
          </Form.Item>
        </Form>
      </BaseModal>
    </div>
  );
};

export default CustomerPage;
