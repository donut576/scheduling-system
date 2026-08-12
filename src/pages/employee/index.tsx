import { useCallback, useState } from 'react';
import type { FC } from 'react';
import {
  Avatar,
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Tag,
  message,
  DatePicker,
  Modal,
} from 'antd';
import { PlusOutlined, CloseOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { Dayjs } from 'dayjs';
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import BaseModal from '@/components/base/BaseModal';
import {
  useEmployeeList,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
} from '@/queries/useEmployeeQueries';
import { useDictStore } from '@/stores/useDictStore';
import { LICENSE_TYPE_MAP, LICENSE_TYPE_OPTIONS } from '@/constants/licenseTypes';
import { POSITION_MAP, POSITION_OPTIONS } from '@/constants/positions';
import { hasLicenseConflict } from '@/utils/licenseValidation';
import { getGroupColor } from '@/utils/groupColor';
import type { EmployeeFormData, EmployeeListParams } from '@/api/employee';
import type { Employee } from '@/types/employee';
import type { LicenseType } from '@/types/alert';
import type { PaginatedResponse } from '@/types/common';

/**
 * 員工資料管理頁面
 * 整合 BaseTable，提供員工資料 CRUD、群組色彩編碼、指定休假設定與證照衝突驗證
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

interface DesignatedLeavesEditorProps {
  value?: string[];
  onChange?: (value: string[]) => void;
}

/**
 * 指定休假日設定介面
 * 提供 DatePicker 選取日期新增，並以可移除之 Tag 列表呈現已選日期
 */
const DesignatedLeavesEditor: FC<DesignatedLeavesEditorProps> = ({ value = [], onChange }) => {
  const { t } = useTranslation();
  // 新增一筆指定休假日期，並依日期字串排序，避免重複加入相同日期
  const handleAdd = useCallback(
    (date: Dayjs | null) => {
      if (!date) return;
      const dateStr = date.format('YYYY-MM-DD');
      if (!value.includes(dateStr)) {
        onChange?.([...value, dateStr].sort());
      }
    },
    [value, onChange],
  );

  // 移除指定的休假日期
  const handleRemove = useCallback(
    (dateStr: string) => {
      onChange?.(value.filter((d) => d !== dateStr));
    },
    [value, onChange],
  );

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      <DatePicker
        style={{ width: '100%' }}
        format="YYYY-MM-DD"
        value={null}
        onChange={handleAdd}
        placeholder={t('employee.addDesignatedLeave')}
        aria-label={t('employee.addDesignatedLeave')}
      />
      <Space size={[4, 4]} wrap>
        {value.map((d) => (
          <Tag
            key={d}
            closable
            onClose={() => handleRemove(d)}
            closeIcon={
              <CloseOutlined aria-label={t('employee.removeDesignatedLeave', { date: d })} />
            }
          >
            {d}
          </Tag>
        ))}
      </Space>
    </Space>
  );
};

const DEFAULT_PARAMS = { page: 1, pageSize: 20 };

/**
 * 行動裝置（< 768px）卡片檢視渲染函式。
 *
 * Validates: Requirements 16.1
 */
function renderEmployeeCard(
  record: Employee,
  onDelete: (record: Employee) => void,
  t: (key: string) => string,
) {
  const groupColor = record.groupColor || getGroupColor(record.groupId);

  return (
    <Card
      hoverable
      className="management-card employee-management-card"
      data-testid={`employee-card-${record.id}`}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space align="start" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space align="center">
            <Avatar style={{ backgroundColor: groupColor }}>{record.name.slice(0, 1)}</Avatar>
            <div>
              <div className="management-card-title">{record.name}</div>
              <div className="management-card-subtitle">
                {t('employee.employeeNo')}：{record.employeeNo}
              </div>
            </div>
          </Space>
          <Space>
            <Tag color={groupColor}>{record.groupName}</Tag>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label={t('employee.deleteEmployee')}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(record);
              }}
            />
          </Space>
        </Space>
        <div className="management-card-info">
          <span>{POSITION_MAP[record.position] ?? record.position}</span>
          <span>{record.phone}</span>
        </div>
        {(record.designatedLeaves ?? []).length > 0 && (
          <div className="management-card-note">
            {t('employee.designatedLeave')}：{(record.designatedLeaves ?? []).join('、')}
          </div>
        )}
        {(record.licenses ?? []).length > 0 && (
          <Space size={[4, 4]} wrap>
            {(record.licenses ?? []).map((lic) => (
              <Tag key={lic}>{LICENSE_TYPE_MAP[lic] ?? lic}</Tag>
            ))}
          </Space>
        )}
      </Space>
    </Card>
  );
}

/**
 * 員工資料管理頁面主元件
 * 負責搜尋條件、分頁、新增/編輯 Modal 與刪除確認的狀態管理
 */
const EmployeePage: FC = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<EmployeeListParams>(DEFAULT_PARAMS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form] = Form.useForm<EmployeeFormData>();

  const groups = useDictStore((state) => state.groups);

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();

  // Wraps useEmployeeList to satisfy BaseTable's queryHook signature
  function useEmployeeListQuery(): QueryResult<PaginatedResponse<Employee>> {
    return useEmployeeList(filters) as QueryResult<PaginatedResponse<Employee>>;
  }

  // 依關鍵字（姓名/員工編號）搜尋，重設回第一頁
  const handleKeywordSearch = useCallback((value: string) => {
    setFilters({
      ...DEFAULT_PARAMS,
      keyword: value.trim() || undefined,
    });
  }, []);

  // 開啟新增員工的 Modal
  const handleAddClick = useCallback(() => {
    setEditingEmployee(null);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

  // 點擊資料列時，帶入現有資料並開啟編輯 Modal
  const handleEditClick = useCallback(
    (record: Employee) => {
      setEditingEmployee(record);
      form.setFieldsValue({
        name: record.name,
        phone: record.phone,
        employeeNo: record.employeeNo,
        position: record.position,
        groupId: record.groupId,
        designatedLeaves: record.designatedLeaves,
        licenses: record.licenses,
      });
      setModalOpen(true);
    },
    [form],
  );

  // 取消 Modal 並清空表單
  const handleModalCancel = useCallback(() => {
    setModalOpen(false);
    setEditingEmployee(null);
    form.resetFields();
  }, [form]);

  // 送出表單：依是否為編輯模式呼叫更新或建立 API
  const handleModalOk = useCallback(async () => {
    const values = await form.validateFields();

    if (editingEmployee) {
      await updateMutation.mutateAsync({ id: editingEmployee.id, data: values });
      message.success(t('employee.updateSuccess'));
    } else {
      await createMutation.mutateAsync(values);
      message.success(t('employee.createSuccess'));
    }

    setModalOpen(false);
    setEditingEmployee(null);
    form.resetFields();
  }, [form, editingEmployee, createMutation, updateMutation, t]);

  // 彈出刪除確認 Modal，確認後呼叫刪除 API
  const handleDelete = useCallback(
    (record: Employee) => {
      Modal.confirm({
        title: t('employee.deleteTitle'),
        content: t('employee.deleteConfirm', {
          name: `${record.name} ${record.employeeNo}`,
        }),
        okText: t('employee.confirmDelete'),
        cancelText: t('common.cancel'),
        okButtonProps: { danger: true },
        onOk: async () => {
          await deleteMutation.mutateAsync(record.id);
          message.success(t('employee.deleteSuccess'));
        },
      });
    },
    [deleteMutation, t],
  );

  const columns: ColumnDef<Employee>[] = [
    {
      title: t('employee.name'),
      dataIndex: 'name',
      key: 'name',
      width: 100,
      exportHeader: t('employee.name'),
      exportKey: 'name',
    },
    {
      title: t('employee.phone'),
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      exportHeader: t('employee.phone'),
      exportKey: 'phone',
    },
    {
      title: t('employee.employeeNo'),
      dataIndex: 'employeeNo',
      key: 'employeeNo',
      width: 100,
      exportHeader: t('employee.employeeNo'),
      exportKey: 'employeeNo',
    },
    {
      title: t('employee.position'),
      key: 'position',
      width: 100,
      render: (_value, record) => POSITION_MAP[record.position] ?? record.position,
      exportHeader: t('employee.position'),
      exportKey: (record) => POSITION_MAP[record.position] ?? record.position,
    },
    {
      title: t('employee.group'),
      key: 'group',
      width: 120,
      render: (_value, record) => (
        <Tag color={record.groupColor || getGroupColor(record.groupId)}>{record.groupName}</Tag>
      ),
      exportHeader: t('employee.group'),
      exportKey: 'groupName',
    },
    {
      title: t('employee.designatedLeave'),
      key: 'designatedLeaves',
      width: 200,
      render: (_value, record) => (
        <Space size={[4, 4]} wrap>
          {(record.designatedLeaves ?? []).map((d) => (
            <Tag key={d}>{d}</Tag>
          ))}
        </Space>
      ),
      exportHeader: t('employee.designatedLeave'),
      exportKey: (record) => (record.designatedLeaves ?? []).join(', '),
    },
    {
      title: t('employee.licenses'),
      key: 'licenses',
      width: 220,
      render: (_value, record) => (
        <Space size={[4, 4]} wrap>
          {(record.licenses ?? []).map((lic) => (
            <Tag key={lic}>{LICENSE_TYPE_MAP[lic] ?? lic}</Tag>
          ))}
        </Space>
      ),
      exportHeader: t('employee.licenses'),
      exportKey: (record) =>
        (record.licenses ?? []).map((lic) => LICENSE_TYPE_MAP[lic] ?? lic).join(', '),
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
          aria-label={t('employee.deleteEmployee')}
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(record);
          }}
        />
      ),
    },
  ];

  return (
    <div className="employee-page">
      <Form layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item label={t('common.keyword')}>
          <Input.Search
            allowClear
            enterButton={
              <Button type="primary" icon={<SearchOutlined />}>
                {t('common.search')}
              </Button>
            }
            placeholder={t('employee.searchPlaceholder')}
            onSearch={handleKeywordSearch}
            style={{ minWidth: 260 }}
          />
        </Form.Item>
      </Form>

      <BaseTable<Employee>
        columns={columns}
        queryHook={useEmployeeListQuery}
        toolbarExtra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick}>
            {t('employee.createButton')}
          </Button>
        }
        onRowClick={handleEditClick}
        cardRender={(record) => renderEmployeeCard(record, handleDelete, t)}
        cardLayout="always"
        rowKey="id"
      />

      <BaseModal
        title={editingEmployee ? t('employee.edit') : t('employee.create')}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('employee.name')}
            rules={[{ required: true, message: t('employee.nameRequired') }]}
          >
            <Input placeholder={t('employee.namePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="phone"
            label={t('employee.phone')}
            rules={[{ required: true, message: t('employee.phoneRequired') }]}
          >
            <Input placeholder={t('employee.phonePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="employeeNo"
            label={t('employee.employeeNo')}
            rules={[{ required: true, message: t('employee.employeeNoRequired') }]}
          >
            <Input placeholder={t('employee.employeeNoPlaceholder')} />
          </Form.Item>
          <Form.Item
            name="position"
            label={t('employee.position')}
            rules={[{ required: true, message: t('employee.positionRequired') }]}
          >
            <Select placeholder={t('employee.positionPlaceholder')} options={POSITION_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="groupId"
            label={t('employee.group')}
            rules={[{ required: true, message: t('employee.groupRequired') }]}
          >
            <Select placeholder={t('employee.groupPlaceholder')} options={groups} />
          </Form.Item>
          <Form.Item
            name="designatedLeaves"
            label={t('employee.designatedLeave')}
            initialValue={[]}
          >
            <DesignatedLeavesEditor />
          </Form.Item>
          <Form.Item
            name="licenses"
            label={t('employee.licenses')}
            rules={[
              {
                validator: (_rule, value: LicenseType[] = []) => {
                  if (hasLicenseConflict(value)) {
                    return Promise.reject(new Error(t('employee.licenseConflict')));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Select
              mode="multiple"
              placeholder={t('employee.licensesPlaceholder')}
              options={LICENSE_TYPE_OPTIONS}
              allowClear
            />
          </Form.Item>
        </Form>
      </BaseModal>
    </div>
  );
};

export default EmployeePage;
