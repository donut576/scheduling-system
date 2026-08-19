import { useCallback, useState, useMemo } from 'react';
import type { FC } from 'react';
import { Avatar, Button, Card, Form, Input, Select, Space, Tag, message, Modal } from 'antd';
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
import { usePermissionStore } from '@/stores/usePermissionStore';
import { LICENSE_TYPE_MAP } from '@/constants/licenseTypes';
import { getGroupColor } from '@/utils/groupColor';
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
  canDelete = true,
) {
  const hasPest = (record.requiredLicenses ?? []).includes('PEST_CONTROL');
  const hasProf = (record.requiredLicenses ?? []).includes('PROFESSIONAL');
  const avatarColor = getGroupColor(record.groupId || record.groupName);

  return (
    <Card
      hoverable
      className="management-card customer-management-card"
      data-testid={`customer-card-${record.id}`}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space align="start" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space align="center" style={{ flex: 1, minWidth: 0 }}>
            <Avatar style={{ backgroundColor: avatarColor, flexShrink: 0 }}>
              {record.groupName.slice(0, 1)}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <div className="management-card-title" title={record.groupName}>
                {record.groupName}
              </div>
              <div className="management-card-subtitle" title={record.branchName}>
                {record.branchName}
              </div>
            </div>
          </Space>
          {canDelete && (
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
          )}
        </Space>
        <div className="management-card-info management-card-address">{record.address}</div>
        <div className="management-card-info">
          <div>{`${t('customer.contactName')}：${record.contactName}`}</div>
          <div>{`${t('customer.contactPhoneShort')}：${record.contactPhone}`}</div>
          <div style={{ marginTop: 4 }}>
            <span>{t('customer.requiredLicenses')}：</span>
            {hasPest ? (
              <Tag color="blue">{t('customer.licensePestControl')}</Tag>
            ) : hasProf ? (
              <Tag color="purple">{t('customer.licenseProfessional')}</Tag>
            ) : record.licenseRestrictionNote ? (
              <Tag color="orange">{record.licenseRestrictionNote}</Tag>
            ) : (
              <Tag>{t('customer.licenseNone')}</Tag>
            )}
          </div>
          <div
            style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #f0f0f0' }}
            className="management-card-note"
          >
            <div>{t('customer.remarks')}：</div>
            <div
              style={{
                minHeight: '2.8em',
                lineHeight: '1.4',
                color: record.remarks ? 'inherit' : '#bfbfbf',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {record.remarks || '-'}
            </div>
          </div>
        </div>
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

  const hasCustomerCreate = usePermissionStore((state) => state.hasPermission('customer:create'));
  const hasCustomerEdit = usePermissionStore((state) => state.hasPermission('customer:edit'));
  const hasCustomerDelete = usePermissionStore((state) => state.hasPermission('customer:delete'));

  // 取得全量客戶資料，供 AutoComplete 動態產生集團與分店模糊搜尋下拉選單
  const allCustomerQuery = useCustomerList({ page: 1, pageSize: 200 });

  const customerSearchOptions = useMemo(() => {
    const list = allCustomerQuery.data?.list ?? [];
    const optionsMap = new Map<string, { label: string; value: string }>();
    list.forEach((c) => {
      if (c.groupName && !optionsMap.has(`group-${c.groupName}`)) {
        optionsMap.set(`group-${c.groupName}`, {
          label: `${c.groupName} (${t('customer.groupTag')})`,
          value: c.groupName,
        });
      }
      if (c.branchName && !optionsMap.has(`branch-${c.branchName}`)) {
        optionsMap.set(`branch-${c.branchName}`, {
          label: `${c.branchName} (${c.groupName})`,
          value: c.branchName,
        });
      }
    });
    return Array.from(optionsMap.values());
  }, [allCustomerQuery.data?.list, t]);

  const localizedSearchFields: SearchFieldConfig[] = [
    {
      name: 'keyword',
      label: t('common.keyword'),
      type: 'autoComplete',
      placeholder: t('customer.searchPlaceholder'),
      options: customerSearchOptions,
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

      let licenseRestriction = 'NONE';
      if ((record.requiredLicenses ?? []).includes('PEST_CONTROL')) {
        licenseRestriction = 'PEST_CONTROL';
      } else if ((record.requiredLicenses ?? []).includes('PROFESSIONAL')) {
        licenseRestriction = 'PROFESSIONAL';
      } else if (record.licenseRestrictionNote) {
        licenseRestriction = 'CUSTOM';
      }

      form.setFieldsValue({
        groupName: record.groupName,
        branchName: record.branchName,
        address: record.address,
        contactName: record.contactName,
        contactPhone: record.contactPhone,
        licenseRestriction,
        licenseRestrictionNote: record.licenseRestrictionNote,
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

    let requiredLicenses: string[] = [];
    if (values.licenseRestriction === 'PEST_CONTROL') {
      requiredLicenses = ['PEST_CONTROL'];
    } else if (values.licenseRestriction === 'PROFESSIONAL') {
      requiredLicenses = ['PROFESSIONAL'];
    }

    const payload: CustomerFormData = {
      groupName: values.groupName,
      branchName: values.branchName,
      address: values.address,
      contactName: values.contactName,
      contactPhone: values.contactPhone,
      requiredLicenses,
      licenseRestrictionNote:
        values.licenseRestriction === 'CUSTOM' ? values.licenseRestrictionNote : undefined,
      remarks: values.remarks,
    };

    if (editingCustomer) {
      await updateMutation.mutateAsync({ id: editingCustomer.id, data: payload });
      message.success(t('customer.updateSuccess'));
    } else {
      await createMutation.mutateAsync(payload);
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
      render: (_value, record) => {
        const hasPest = (record.requiredLicenses ?? []).includes('PEST_CONTROL');
        const hasProf = (record.requiredLicenses ?? []).includes('PROFESSIONAL');
        return (
          <Space size={[4, 4]} wrap>
            {hasPest ? (
              <Tag color="blue">{t('customer.licensePestControl')}</Tag>
            ) : hasProf ? (
              <Tag color="purple">{t('customer.licenseProfessional')}</Tag>
            ) : record.licenseRestrictionNote ? (
              <Tag color="orange">{record.licenseRestrictionNote}</Tag>
            ) : (
              <Tag>{t('customer.licenseNone')}</Tag>
            )}
          </Space>
        );
      },
      exportHeader: t('customer.requiredLicenses'),
      exportKey: (record) =>
        record.licenseRestrictionNote ||
        (record.requiredLicenses ?? []).map((lic) => LICENSE_TYPE_MAP[lic] ?? lic).join(', ') ||
        t('customer.licenseNone'),
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
    ...(hasCustomerDelete
      ? [
          {
            title: t('common.actions'),
            key: 'actions',
            width: 90,
            fixed: 'right' as const,
            render: (_value: unknown, record: Customer) => (
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
        ]
      : []),
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
        toolbarExtra={
          hasCustomerCreate ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick}>
              {t('customer.createButton')}
            </Button>
          ) : undefined
        }
        onRowClick={hasCustomerEdit ? handleEditClick : undefined}
        cardRender={(record) => renderCustomerCard(record, handleDelete, t, hasCustomerDelete)}
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
          <Form.Item
            name="licenseRestriction"
            label={t('customer.requiredLicenses')}
            initialValue="NONE"
          >
            <Select
              placeholder={t('customer.licenseRestrictionPlaceholder')}
              options={[
                { label: t('customer.licenseNone'), value: 'NONE' },
                { label: t('customer.licensePestControl'), value: 'PEST_CONTROL' },
                { label: t('customer.licenseProfessional'), value: 'PROFESSIONAL' },
                { label: t('customer.licenseCustom'), value: 'CUSTOM' },
              ]}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.licenseRestriction !== currentValues.licenseRestriction
            }
          >
            {({ getFieldValue }) =>
              getFieldValue('licenseRestriction') === 'CUSTOM' ? (
                <Form.Item
                  name="licenseRestrictionNote"
                  label={t('customer.licenseRestrictionNote')}
                  rules={[
                    { required: true, message: t('customer.licenseRestrictionNoteRequired') },
                  ]}
                >
                  <Input placeholder={t('customer.licenseRestrictionNotePlaceholder')} />
                </Form.Item>
              ) : null
            }
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
