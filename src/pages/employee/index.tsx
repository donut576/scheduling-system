import { useCallback, useState } from 'react';
import type { FC } from 'react';
import { Button, Card, Form, Input, Select, Space, Tag, message, DatePicker } from 'antd';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import BaseModal from '@/components/base/BaseModal';
import {
  useEmployeeList,
  useCreateEmployee,
  useUpdateEmployee,
} from '@/queries/useEmployeeQueries';
import { useDictStore } from '@/stores/useDictStore';
import { LICENSE_TYPE_MAP, LICENSE_TYPE_OPTIONS } from '@/constants/licenseTypes';
import { POSITION_MAP, POSITION_OPTIONS } from '@/constants/positions';
import { hasLicenseConflict } from '@/utils/licenseValidation';
import { getGroupColor } from '@/utils/groupColor';
import type { EmployeeFormData } from '@/api/employee';
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
        placeholder="選擇日期以新增指定休假"
        aria-label="新增指定休假日期"
      />
      <Space size={[4, 4]} wrap>
        {value.map((d) => (
          <Tag
            key={d}
            closable
            onClose={() => handleRemove(d)}
            closeIcon={<CloseOutlined aria-label={`移除休假日 ${d}`} />}
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
function renderEmployeeCard(record: Employee) {
  return (
    <Card size="small" style={{ marginBottom: 8 }} data-testid={`employee-card-${record.id}`}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <strong>{record.name}</strong>
          <Tag color={record.groupColor || getGroupColor(record.groupId)}>{record.groupName}</Tag>
        </Space>
        <span>
          {POSITION_MAP[record.position] ?? record.position} ／ {record.phone}
        </span>
        <span>員工編號：{record.employeeNo}</span>
        {(record.designatedLeaves ?? []).length > 0 && (
          <span>指定休假：{(record.designatedLeaves ?? []).join('、')}</span>
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

const EmployeePage: FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form] = Form.useForm<EmployeeFormData>();

  const groups = useDictStore((state) => state.groups);

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();

  // Wraps useEmployeeList to satisfy BaseTable's queryHook signature
  function useEmployeeListQuery(): QueryResult<PaginatedResponse<Employee>> {
    return useEmployeeList(DEFAULT_PARAMS) as QueryResult<PaginatedResponse<Employee>>;
  }

  const handleAddClick = useCallback(() => {
    setEditingEmployee(null);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

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

  const handleModalCancel = useCallback(() => {
    setModalOpen(false);
    setEditingEmployee(null);
    form.resetFields();
  }, [form]);

  const handleModalOk = useCallback(async () => {
    const values = await form.validateFields();

    if (editingEmployee) {
      await updateMutation.mutateAsync({ id: editingEmployee.id, data: values });
      message.success('員工資料已更新');
    } else {
      await createMutation.mutateAsync(values);
      message.success('員工資料已新增');
    }

    setModalOpen(false);
    setEditingEmployee(null);
    form.resetFields();
  }, [form, editingEmployee, createMutation, updateMutation]);

  const columns: ColumnDef<Employee>[] = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      exportHeader: '姓名',
      exportKey: 'name',
    },
    {
      title: '電話',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      exportHeader: '電話',
      exportKey: 'phone',
    },
    {
      title: '員工編號',
      dataIndex: 'employeeNo',
      key: 'employeeNo',
      width: 100,
      exportHeader: '員工編號',
      exportKey: 'employeeNo',
    },
    {
      title: '職位',
      key: 'position',
      width: 100,
      render: (_value, record) => POSITION_MAP[record.position] ?? record.position,
      exportHeader: '職位',
      exportKey: (record) => POSITION_MAP[record.position] ?? record.position,
    },
    {
      title: '群組',
      key: 'group',
      width: 120,
      render: (_value, record) => (
        <Tag color={record.groupColor || getGroupColor(record.groupId)}>{record.groupName}</Tag>
      ),
      exportHeader: '群組',
      exportKey: 'groupName',
    },
    {
      title: '指定休假',
      key: 'designatedLeaves',
      width: 200,
      render: (_value, record) => (
        <Space size={[4, 4]} wrap>
          {(record.designatedLeaves ?? []).map((d) => (
            <Tag key={d}>{d}</Tag>
          ))}
        </Space>
      ),
      exportHeader: '指定休假',
      exportKey: (record) => (record.designatedLeaves ?? []).join(', '),
    },
    {
      title: '證照',
      key: 'licenses',
      width: 220,
      render: (_value, record) => (
        <Space size={[4, 4]} wrap>
          {(record.licenses ?? []).map((lic) => (
            <Tag key={lic}>{LICENSE_TYPE_MAP[lic] ?? lic}</Tag>
          ))}
        </Space>
      ),
      exportHeader: '證照',
      exportKey: (record) =>
        (record.licenses ?? []).map((lic) => LICENSE_TYPE_MAP[lic] ?? lic).join(', '),
    },
  ];

  return (
    <div className="employee-page">
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-end' }} wrap>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick}>
          新增員工
        </Button>
      </Space>

      <BaseTable<Employee>
        columns={columns}
        queryHook={useEmployeeListQuery}
        exportable
        onRowClick={handleEditClick}
        cardRender={renderEmployeeCard}
        rowKey="id"
      />

      <BaseModal
        title={editingEmployee ? '編輯員工資料' : '新增員工資料'}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '請輸入姓名' }]}>
            <Input placeholder="請輸入姓名" />
          </Form.Item>
          <Form.Item name="phone" label="電話" rules={[{ required: true, message: '請輸入電話' }]}>
            <Input placeholder="請輸入電話" />
          </Form.Item>
          <Form.Item
            name="employeeNo"
            label="員工編號"
            rules={[{ required: true, message: '請輸入員工編號' }]}
          >
            <Input placeholder="請輸入員工編號" />
          </Form.Item>
          <Form.Item
            name="position"
            label="職位"
            rules={[{ required: true, message: '請選擇職位' }]}
          >
            <Select placeholder="請選擇職位" options={POSITION_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="groupId"
            label="群組"
            rules={[{ required: true, message: '請選擇群組' }]}
          >
            <Select placeholder="請選擇群組" options={groups} />
          </Form.Item>
          <Form.Item name="designatedLeaves" label="指定休假" initialValue={[]}>
            <DesignatedLeavesEditor />
          </Form.Item>
          <Form.Item
            name="licenses"
            label="證照"
            rules={[
              {
                validator: (_rule, value: LicenseType[] = []) => {
                  if (hasLicenseConflict(value)) {
                    return Promise.reject(new Error('證照設定衝突'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Select
              mode="multiple"
              placeholder="請選擇證照"
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
