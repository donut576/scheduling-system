import { useCallback, useState } from 'react';
import type { FC } from 'react';
import { Button, Card, Form, Input, Select, Space, Tag, message, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
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

const searchFields: SearchFieldConfig[] = [
  {
    name: 'keyword',
    label: '關鍵字',
    type: 'input',
    placeholder: '搜尋集團/分店名稱',
  },
];

const DEFAULT_FILTERS: CustomerListParams = { page: 1, pageSize: 20 };

/**
 * 行動裝置（< 768px）卡片檢視渲染函式。
 *
 * Validates: Requirements 16.1
 */
function renderCustomerCard(record: Customer) {
  return (
    <Card size="small" style={{ marginBottom: 8 }} data-testid={`customer-card-${record.id}`}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <strong>
          {record.groupName} {record.branchName}
        </strong>
        <span>{record.address}</span>
        <span>
          聯絡窗口：{record.contactName} ／ 電話：{record.contactPhone}
        </span>
        {(record.requiredLicenses ?? []).length > 0 && (
          <Space size={[4, 4]} wrap>
            {(record.requiredLicenses ?? []).map((lic) => (
              <Tag key={lic}>{LICENSE_TYPE_MAP[lic] ?? lic}</Tag>
            ))}
          </Space>
        )}
        {record.remarks && <span>備註：{record.remarks}</span>}
      </Space>
    </Card>
  );
}

const CustomerPage: FC = () => {
  const [filters, setFilters] = useState<CustomerListParams>({
    ...DEFAULT_FILTERS,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form] = Form.useForm<CustomerFormData>();

  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();

  // Wraps useCustomerList with page-local filters, satisfying BaseTable's
  // queryHook signature `() => QueryResult<PaginatedResponse<T>>`.
  function useCustomerListQuery(): QueryResult<PaginatedResponse<Customer>> {
    return useCustomerList(filters) as QueryResult<PaginatedResponse<Customer>>;
  }

  const handleSearch = useCallback((values: Record<string, unknown>) => {
    setFilters((prev) => ({
      ...prev,
      keyword: (values.keyword as string) || undefined,
      page: 1,
    }));
  }, []);

  const handleReset = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  const handleAddClick = useCallback(() => {
    setEditingCustomer(null);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

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

  const handleModalCancel = useCallback(() => {
    setModalOpen(false);
    setEditingCustomer(null);
    form.resetFields();
  }, [form]);

  const handleModalOk = useCallback(async () => {
    const values = await form.validateFields();

    if (editingCustomer) {
      await updateMutation.mutateAsync({ id: editingCustomer.id, data: values });
      message.success('客戶資料已更新');
    } else {
      await createMutation.mutateAsync(values);
      message.success('客戶資料已新增');
    }

    setModalOpen(false);
    setEditingCustomer(null);
    form.resetFields();
  }, [form, editingCustomer, createMutation, updateMutation]);

  const handleDelete = useCallback(
    (record: Customer) => {
      Modal.confirm({
        title: '刪除客戶資料',
        content: `確定要刪除「${record.groupName} ${record.branchName}」的客戶資料嗎？`,
        okText: '確定刪除',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: async () => {
          await deleteMutation.mutateAsync(record.id);
          message.success('客戶資料已刪除');
        },
      });
    },
    [deleteMutation],
  );

  const columns: ColumnDef<Customer>[] = [
    {
      title: '集團名稱',
      dataIndex: 'groupName',
      key: 'groupName',
      width: 120,
      ellipsis: true,
      exportHeader: '集團名稱',
      exportKey: 'groupName',
    },
    {
      title: '分店名稱',
      dataIndex: 'branchName',
      key: 'branchName',
      width: 120,
      ellipsis: true,
      exportHeader: '分店名稱',
      exportKey: 'branchName',
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      width: 220,
      ellipsis: true,
      exportHeader: '地址',
      exportKey: 'address',
    },
    {
      title: '聯絡窗口',
      dataIndex: 'contactName',
      key: 'contactName',
      width: 100,
      exportHeader: '聯絡窗口',
      exportKey: 'contactName',
    },
    {
      title: '電話',
      dataIndex: 'contactPhone',
      key: 'contactPhone',
      width: 120,
      exportHeader: '電話',
      exportKey: 'contactPhone',
    },
    {
      title: '證照限制',
      key: 'requiredLicenses',
      width: 220,
      render: (_value, record) => (
        <Space size={[4, 4]} wrap>
          {(record.requiredLicenses ?? []).map((lic) => (
            <Tag key={lic}>{LICENSE_TYPE_MAP[lic] ?? lic}</Tag>
          ))}
        </Space>
      ),
      exportHeader: '證照限制',
      exportKey: (record) =>
        (record.requiredLicenses ?? []).map((lic) => LICENSE_TYPE_MAP[lic] ?? lic).join(', '),
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
    {
      title: '操作',
      key: 'actions',
      width: 90,
      fixed: 'right',
      render: (_value, record) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          aria-label="刪除客戶"
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
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
        <BaseSearchForm fields={searchFields} onSearch={handleSearch} onReset={handleReset} />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick}>
          新增客戶
        </Button>
      </Space>

      <BaseTable<Customer>
        columns={columns}
        queryHook={useCustomerListQuery}
        exportable
        onRowClick={handleEditClick}
        cardRender={renderCustomerCard}
        rowKey="id"
      />

      <BaseModal
        title={editingCustomer ? '編輯客戶資料' : '新增客戶資料'}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="groupName"
            label="集團名稱"
            rules={[{ required: true, message: '請輸入集團名稱' }]}
          >
            <Input placeholder="請輸入集團名稱" />
          </Form.Item>
          <Form.Item
            name="branchName"
            label="分店名稱"
            rules={[{ required: true, message: '請輸入分店名稱' }]}
          >
            <Input placeholder="請輸入分店名稱" />
          </Form.Item>
          <Form.Item
            name="address"
            label="地址"
            rules={[{ required: true, message: '請輸入地址' }]}
          >
            <Input placeholder="請輸入地址" />
          </Form.Item>
          <Form.Item
            name="contactName"
            label="聯絡窗口"
            rules={[{ required: true, message: '請輸入聯絡窗口' }]}
          >
            <Input placeholder="請輸入聯絡窗口" />
          </Form.Item>
          <Form.Item
            name="contactPhone"
            label="電話"
            rules={[{ required: true, message: '請輸入電話' }]}
          >
            <Input placeholder="請輸入電話" />
          </Form.Item>
          <Form.Item name="requiredLicenses" label="證照限制">
            <Select
              mode="multiple"
              placeholder="請選擇證照限制"
              options={LICENSE_TYPE_OPTIONS}
              allowClear
            />
          </Form.Item>
          <Form.Item name="remarks" label="備註">
            <TextArea rows={3} placeholder="請輸入備註" />
          </Form.Item>
        </Form>
      </BaseModal>
    </div>
  );
};

export default CustomerPage;
