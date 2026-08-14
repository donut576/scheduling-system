import { useCallback, useState, useMemo } from 'react';
import type { FC } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Tag,
  message,
  DatePicker,
  Modal,
} from 'antd';
import { PlusOutlined, CloseOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { Dayjs } from 'dayjs';
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import BaseSearchForm, { type SearchFieldConfig } from '@/components/base/BaseSearchForm';
import BaseModal from '@/components/base/BaseModal';
import {
  useEmployeeList,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
} from '@/queries/useEmployeeQueries';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { LICENSE_TYPE_MAP, LICENSE_TYPE_OPTIONS } from '@/constants/licenseTypes';
import { POSITION_MAP, POSITION_OPTIONS } from '@/constants/positions';
import { AREA_OPTIONS, EMPLOYEE_SHIFT_OPTIONS } from '@/constants/groups';
import { PERMISSIONS } from '@/constants/permissions';
import { hasLicenseConflict, hasOnlyPestControlLicense } from '@/utils/licenseValidation';
import { getGroupColor } from '@/utils/groupColor';
import { formatPhone } from '@/utils/format';
import type { EmployeeFormData, EmployeeListParams } from '@/api/employee';
import { LEAVE_TYPE_MAP, type Employee } from '@/types/employee';
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
  /** 是否停用編輯（例如目前使用者不具備 employee:designate_leave 權限，僅組長／經理／
   * 管理員可鍵入已知休假日），停用時僅顯示現有休假日清單，不可新增或移除 */
  disabled?: boolean;
  pickerOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
}

/**
 * 指定排休設定介面
 * 由具備 employee:designate_leave 權限之組長／經理／管理員鍵入員工已知休假日
 * （年/月/日），提供 DatePicker 選取日期新增，並以可移除之 Tag 列表呈現已選日期
 */
const DesignatedLeavesEditor: FC<DesignatedLeavesEditorProps> = ({
  value = [],
  onChange,
  disabled = false,
  pickerOpen,
  onPickerOpenChange,
}) => {
  const { t } = useTranslation();
  // 新增一筆指定休假日期，並依日期字串排序，避免重複加入相同日期
  const handleAdd = useCallback(
    (date: Dayjs | null) => {
      if (!date) return;
      const dateStr = date.format('YYYY-MM-DD');
      if (!value.includes(dateStr)) {
        onChange?.([...value, dateStr].sort());
      }
      onPickerOpenChange?.(false);
    },
    [value, onChange, onPickerOpenChange],
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
        open={pickerOpen}
        onOpenChange={onPickerOpenChange}
        style={{ width: '100%' }}
        format="YYYY-MM-DD"
        value={null}
        onChange={handleAdd}
        placeholder={t('employee.addDesignatedLeave')}
        aria-label={t('employee.addDesignatedLeave')}
        disabled={disabled}
      />
      <Space size={[4, 4]} wrap>
        {value.map((d) => (
          <Tag
            key={d}
            closable={!disabled}
            onClose={() => handleRemove(d)}
            closeIcon={
              disabled ? undefined : (
                <CloseOutlined aria-label={t('employee.removeDesignatedLeave', { date: d })} />
              )
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
  const groupColor = record.groupColor || getGroupColor(record.area || record.groupId);
  const displayGroup =
    record.area && record.shift ? `${record.area} ${record.shift}` : record.groupName;
  const isOnlyPest = hasOnlyPestControlLicense(record.licenses ?? []);

  return (
    <Card
      hoverable
      className="management-card employee-management-card"
      data-testid={`employee-card-${record.id}`}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space align="start" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space align="center" style={{ flex: 1, minWidth: 0 }}>
            <Avatar style={{ backgroundColor: groupColor, flexShrink: 0 }}>
              {record.name.slice(0, 1)}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <div className="management-card-title" title={record.name}>
                {record.name}
              </div>
              <div className="management-card-subtitle">
                {t('employee.employeeNo')}：{record.employeeNo}
              </div>
            </div>
          </Space>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            aria-label={t('employee.deleteEmployee')}
            style={{ flexShrink: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(record);
            }}
          />
        </Space>
        <div className="management-card-info">
          {/* 職位行：移除「職位：」前綴，字體加黑加粗，並在下方空一行/留邊距 */}
          <div style={{ fontWeight: 700, color: '#000', fontSize: 15, marginBottom: 8 }}>
            {POSITION_MAP[record.position] ?? record.position}
          </div>
          <div>{`${t('employee.phoneLabel')}：${formatPhone(record.phone)}`}</div>
          <div className="management-card-group-line">
            <span>組別：</span>
            {/* 組別以地區色彩 + 文字呈現 */}
            <span
              className="management-card-group-dot"
              style={{ backgroundColor: groupColor }}
              aria-hidden="true"
            />
            <span className="management-card-group-name" title={displayGroup}>
              {displayGroup}
            </span>
          </div>
        </div>
        <div className="management-card-note" style={{ minHeight: '2.8em', marginBottom: 8 }}>
          <span>指定排休：</span>
          {record.leaveType && (
            <Tag color="orange" style={{ marginInlineEnd: 4 }}>
              {LEAVE_TYPE_MAP[record.leaveType] ?? record.leaveType}
            </Tag>
          )}
          <span>
            {(record.designatedLeaves ?? []).length > 0
              ? (record.designatedLeaves ?? []).join('、')
              : record.leaveType
                ? ''
                : '-'}
          </span>
        </div>
        <div className="management-card-licenses">
          <Space size={[4, 4]} wrap>
            {(record.licenses ?? []).length > 0 ? (
              (record.licenses ?? []).map((lic) => (
                <Tag key={lic} color={lic === 'PEST_CONTROL' && isOnlyPest ? 'red' : undefined}>
                  {LICENSE_TYPE_MAP[lic] ?? lic}
                </Tag>
              ))
            ) : (
              <Tag>無</Tag>
            )}
            {isOnlyPest && (
              <Tag color="error" icon={<WarningOutlined />}>
                ⚠️ 僅有施藥證 (Alarm)
              </Tag>
            )}
          </Space>
        </div>
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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  // 取得全量員工資料，供 AutoComplete 動態產生姓名與員工編號模糊搜尋下拉選單
  const allEmployeeQuery = useEmployeeList({ page: 1, pageSize: 200 });

  const employeeSearchOptions = useMemo(() => {
    const list = allEmployeeQuery.data?.list ?? [];
    const optionsMap = new Map<string, { label: string; value: string }>();
    list.forEach((e) => {
      if (e.name && !optionsMap.has(`name-${e.name}`)) {
        optionsMap.set(`name-${e.name}`, {
          label: `${e.name} (${e.employeeNo || '員工'})`,
          value: e.name,
        });
      }
      if (e.employeeNo && !optionsMap.has(`no-${e.employeeNo}`)) {
        optionsMap.set(`no-${e.employeeNo}`, {
          label: `${e.employeeNo} (${e.name})`,
          value: e.employeeNo,
        });
      }
    });
    return Array.from(optionsMap.values());
  }, [allEmployeeQuery.data?.list]);

  const localizedSearchFields: SearchFieldConfig[] = [
    {
      name: 'keyword',
      label: t('common.keyword'),
      type: 'autoComplete',
      placeholder: '搜尋員工姓名或員工編號',
      options: employeeSearchOptions,
    },
  ];

  // 指定排休功能僅組長／經理／管理員（具備 employee:designate_leave 權限者）可鍵入
  const canDesignateLeave = usePermissionStore((state) =>
    state.hasPermission(PERMISSIONS.EMPLOYEE_DESIGNATE_LEAVE),
  );

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();

  // Wraps useEmployeeList to satisfy BaseTable's queryHook signature
  function useEmployeeListQuery(): QueryResult<PaginatedResponse<Employee>> {
    return useEmployeeList(filters) as QueryResult<PaginatedResponse<Employee>>;
  }

  // 依關鍵字（姓名/員工編號）搜尋，重設回第一頁
  const handleSearch = useCallback((values: Record<string, unknown>) => {
    setFilters({
      ...DEFAULT_PARAMS,
      keyword: (values.keyword as string) || undefined,
    });
  }, []);

  // 重置搜尋條件為預設值
  const handleReset = useCallback(() => {
    setFilters(DEFAULT_PARAMS);
  }, []);

  // 開啟新增員工的 Modal
  const handleAddClick = useCallback(() => {
    setEditingEmployee(null);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

  // 點擊資料列時，帶入現有資料並開啟編輯 Modal；若該員工僅持有施藥證（缺乏其他
  // 安全衛生相關證照），先彈出提醒對話框告知管理者留意資格是否足夠
  const handleEditClick = useCallback(
    (record: Employee) => {
      if (hasOnlyPestControlLicense(record.licenses)) {
        Modal.warning({
          title: t('employee.onlyPestControlWarningTitle'),
          content: t('employee.onlyPestControlWarningContent'),
        });
      }

      const area = record.area || '台北';
      const shift = record.shift || '早班';

      setEditingEmployee(record);
      form.setFieldsValue({
        name: record.name,
        phone: record.phone,
        employeeNo: record.employeeNo,
        position: record.position,
        groupId: record.groupId || `${area}-${shift}`,
        area,
        shift,
        groupName: record.groupName || `${area} ${shift}`,
        leaveType: record.leaveType || 'REGULAR_LEAVE',
        designatedLeaves: record.designatedLeaves || [],
        licenses: (record.licenses ?? []).length > 0 ? record.licenses : ['NONE'],
      });
      setModalOpen(true);
    },
    [form, t],
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
    const area = values.area || '台北';
    const shift = values.shift || '早班';
    const payload = {
      ...values,
      area,
      shift,
      groupName: `${area} ${shift}`,
      groupId: `${area}-${shift}`,
    };

    if (editingEmployee) {
      await updateMutation.mutateAsync({ id: editingEmployee.id, data: payload });
      message.success(t('employee.updateSuccess'));
    } else {
      await createMutation.mutateAsync(payload);
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
      title: '組別',
      key: 'group',
      width: 120,
      render: (_value, record) => {
        const displayGroup =
          record.area && record.shift ? `${record.area} ${record.shift}` : record.groupName;
        return (
          <Tag color={record.groupColor || getGroupColor(record.area || record.groupId)}>
            {displayGroup}
          </Tag>
        );
      },
      exportHeader: '組別',
      exportKey: (record) =>
        record.area && record.shift ? `${record.area} ${record.shift}` : record.groupName,
    },
    {
      title: '指定排休',
      key: 'designatedLeaves',
      width: 220,
      render: (_value, record) => (
        <Space size={[4, 4]} wrap>
          {record.leaveType && (
            <Tag color="orange">{LEAVE_TYPE_MAP[record.leaveType] ?? record.leaveType}</Tag>
          )}
          {(record.designatedLeaves ?? []).map((d) => (
            <Tag key={d}>{d}</Tag>
          ))}
        </Space>
      ),
      exportHeader: '指定排休',
      exportKey: (record) =>
        `${record.leaveType ? LEAVE_TYPE_MAP[record.leaveType] + ' ' : ''}${(record.designatedLeaves ?? []).join(', ')}`,
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
      <BaseSearchForm
        fields={localizedSearchFields}
        onSearch={handleSearch}
        onReset={handleReset}
      />

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
          <Form.Item label="組別" required style={{ marginBottom: 16 }}>
            <Space style={{ width: '100%', display: 'flex' }} size={8}>
              <Form.Item name="area" noStyle rules={[{ required: true, message: '請選擇地區' }]}>
                <Select
                  placeholder="選地區 (例如: 台北)"
                  options={AREA_OPTIONS}
                  style={{ width: 260 }}
                />
              </Form.Item>
              <Form.Item name="shift" noStyle rules={[{ required: true, message: '請選擇班別' }]}>
                <Select
                  placeholder="選班別 (例如: 早班)"
                  options={EMPLOYEE_SHIFT_OPTIONS}
                  style={{ width: 260 }}
                />
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item label="指定排休">
            <Form.Item name="leaveType" noStyle initialValue="REGULAR_LEAVE">
              <Radio.Group style={{ marginBottom: 8 }} onChange={() => setDatePickerOpen(true)}>
                <Radio value="REGULAR_LEAVE">例假</Radio>
                <Radio value="ANNUAL_LEAVE">年假</Radio>
                <Radio value="OTHER_LEAVE">其他</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item
              name="designatedLeaves"
              initialValue={[]}
              extra={!canDesignateLeave ? t('employee.designatedLeavePermissionHint') : undefined}
            >
              <DesignatedLeavesEditor
                disabled={!canDesignateLeave}
                pickerOpen={datePickerOpen}
                onPickerOpenChange={setDatePickerOpen}
              />
            </Form.Item>
          </Form.Item>

          <Form.Item
            name="licenses"
            label="證照"
            initialValue={['NONE']}
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
              onChange={(selectedValues: LicenseType[]) => {
                let newValues = selectedValues;
                if (selectedValues.includes('NONE')) {
                  if (selectedValues[selectedValues.length - 1] === 'NONE') {
                    newValues = ['NONE'];
                  } else {
                    newValues = selectedValues.filter((v) => v !== 'NONE');
                  }
                }
                if (newValues.length === 0) {
                  newValues = ['NONE'];
                }
                form.setFieldsValue({ licenses: newValues });
              }}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.licenses !== currentValues.licenses
            }
          >
            {({ getFieldValue }) => {
              const currentLicenses: LicenseType[] = getFieldValue('licenses') || [];
              if (hasOnlyPestControlLicense(currentLicenses)) {
                return (
                  <Alert
                    type="warning"
                    message="⚠️ 警示：該員工僅持有「施藥」證照，請留意資格是否足夠！"
                    showIcon
                    style={{ marginTop: 8 }}
                  />
                );
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </BaseModal>
    </div>
  );
};

export default EmployeePage;
