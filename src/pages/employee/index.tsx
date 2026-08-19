import { useCallback, useState, useMemo, useEffect } from 'react';
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
import { useUserStore } from '@/stores/useUserStore';
import { LICENSE_TYPE_MAP } from '@/constants/licenseTypes';
import { POSITION_MAP } from '@/constants/positions';
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

const getPositionLabel = (pos: string | undefined, t: (k: string) => string): string => {
  if (!pos) return '-';
  const map: Record<string, string> = {
    STAFF: t('employee.positions.staff'),
    LEADER: t('employee.positions.leader'),
    MANAGER: t('employee.positions.manager'),
    ADMIN_STAFF: t('employee.positions.adminStaff'),
  };
  return map[pos] ?? POSITION_MAP[pos as keyof typeof POSITION_MAP] ?? pos;
};

const getLicenseLabel = (lic: LicenseType | string, t: (k: string) => string): string => {
  const map: Record<string, string> = {
    NONE: t('customer.licenseNone'),
    PROFESSIONAL: t('employee.licensesMap.professional'),
    PEST_CONTROL: t('employee.licensesMap.pestControl'),
    FIRE_ANT: t('employee.licensesMap.fireAnt'),
    SAFETY_6HR: t('employee.licensesMap.safety6hr'),
    SAFETY_MANAGER_A: t('employee.licensesMap.safetyManagerA'),
    SAFETY_MANAGER_B: t('employee.licensesMap.safetyManagerB'),
    SAFETY_MANAGER_C: t('employee.licensesMap.safetyManagerC'),
  };
  return map[lic] ?? LICENSE_TYPE_MAP[lic as LicenseType] ?? lic;
};

const getLeaveTypeLabel = (lt: string | undefined, t: (k: string) => string): string => {
  if (!lt) return '';
  const map: Record<string, string> = {
    REGULAR_LEAVE: t('employee.leaveTypes.regular'),
    ANNUAL_LEAVE: t('employee.leaveTypes.annual'),
    OTHER_LEAVE: t('employee.leaveTypes.other'),
  };
  return map[lt] ?? LEAVE_TYPE_MAP[lt as keyof typeof LEAVE_TYPE_MAP] ?? lt;
};

const getAreaLabel = (area: string | undefined, t: (k: string) => string): string => {
  if (!area) return '';
  const map: Record<string, string> = {
    台北: t('employee.areas.taipei'),
    新竹: t('employee.areas.hsinchu'),
    台中: t('employee.areas.taichung'),
    台南: t('employee.areas.tainan'),
  };
  return map[area] ?? area;
};

const getShiftLabel = (shift: string | undefined, t: (k: string) => string): string => {
  if (!shift) return '';
  const map: Record<string, string> = {
    早班: t('task.shifts.morning'),
    午班: t('task.shifts.afternoon'),
    晚班: t('task.shifts.evening'),
    大夜班: t('task.shifts.night'),
  };
  return map[shift] ?? shift;
};

const getDisplayGroup = (record: Employee, t: (k: string) => string): string => {
  if (record.area && record.shift) {
    return `${getAreaLabel(record.area, t)} ${getShiftLabel(record.shift, t)}`;
  }
  return record.groupName || '-';
};

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
  const displayGroup = getDisplayGroup(record, t);
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
            {getPositionLabel(record.position, t)}
          </div>
          <div>{`${t('employee.phoneLabel')}：${formatPhone(record.phone)}`}</div>
          <div className="management-card-group-line">
            <span>{t('employee.group')}：</span>
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
          <span>{t('employee.designatedLeave')}：</span>
          {record.leaveType && (
            <Tag color="orange" style={{ marginInlineEnd: 4 }}>
              {getLeaveTypeLabel(record.leaveType, t)}
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
                  {getLicenseLabel(lic, t)}
                </Tag>
              ))
            ) : (
              <Tag>{t('customer.licenseNone')}</Tag>
            )}
            {isOnlyPest && (
              <Tag color="error" icon={<WarningOutlined />}>
                {t('employee.onlyPestControlWarningTitle')}
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
      placeholder: t('employee.searchPlaceholder'),
      options: employeeSearchOptions,
    },
  ];

  // 指定排休功能僅組長／經理／管理員（具備 employee:designate_leave 權限者）可鍵入
  const canDesignateLeave = usePermissionStore((state) =>
    state.hasPermission(PERMISSIONS.EMPLOYEE_DESIGNATE_LEAVE),
  );

  const user = useUserStore((state) => state.user);
  const isStaff = user?.role === 'STAFF';

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();

  const [staffForm] = Form.useForm<EmployeeFormData>();

  // Wraps useEmployeeList to satisfy BaseTable's queryHook signature
  function useEmployeeListQuery(): QueryResult<PaginatedResponse<Employee>> {
    return useEmployeeList(filters) as QueryResult<PaginatedResponse<Employee>>;
  }

  const { data: allEmployeesData } = useEmployeeList({ page: 1, pageSize: 100 });
  const currentStaffEmployee = useMemo(() => {
    if (!isStaff) return null;
    return (
      allEmployeesData?.list.find(
        (e) =>
          e.id === user?.id ||
          (user?.employeeNo && e.employeeNo === user.employeeNo) ||
          (user?.name && e.name === user.name),
      ) ||
      (user
        ? ({
            id: user.id || 'emp-staff',
            name: user.name || '員工',
            employeeNo: user.employeeNo || 'STAFF01',
            phone: '0912-345-678',
            position: 'SPECIALIST',
            area: '台北',
            shift: '早班',
            groupName: '台北 早班',
            groupId: '台北-早班',
            leaveType: 'REGULAR_LEAVE',
            designatedLeaves: [],
            licenses: ['PEST_CONTROL'],
          } as unknown as Employee)
        : null)
    );
  }, [allEmployeesData?.list, isStaff, user]);

  useEffect(() => {
    if (isStaff && currentStaffEmployee) {
      staffForm.setFieldsValue({
        name: currentStaffEmployee.name,
        phone: currentStaffEmployee.phone,
        employeeNo: currentStaffEmployee.employeeNo,
        position: currentStaffEmployee.position,
        area: currentStaffEmployee.area || '台北',
        shift: currentStaffEmployee.shift || '早班',
        leaveType: currentStaffEmployee.leaveType || 'REGULAR_LEAVE',
        designatedLeaves: currentStaffEmployee.designatedLeaves || [],
        licenses:
          (currentStaffEmployee.licenses ?? []).length > 0
            ? currentStaffEmployee.licenses
            : ['NONE'],
      });
    }
  }, [currentStaffEmployee, isStaff, staffForm]);

  const handleStaffSave = useCallback(async () => {
    if (!currentStaffEmployee) return;
    const values = await staffForm.validateFields();
    const area = currentStaffEmployee.area || values.area || '台北';
    const shift = currentStaffEmployee.shift || values.shift || '早班';
    const payload = {
      ...values,
      area,
      shift,
      groupName: `${area} ${shift}`,
      groupId: `${area}-${shift}`,
      position: currentStaffEmployee.position,
      employeeNo: currentStaffEmployee.employeeNo,
      designatedLeaves: currentStaffEmployee.designatedLeaves || [],
    };
    await updateMutation.mutateAsync({ id: currentStaffEmployee.id, data: payload });
    message.success(t('employee.updateSuccess'));
  }, [currentStaffEmployee, staffForm, updateMutation, t]);

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

  const localizedPositionOptions = useMemo(
    () => [
      { label: t('employee.positions.staff'), value: 'STAFF' },
      { label: t('employee.positions.leader'), value: 'LEADER' },
      { label: t('employee.positions.manager'), value: 'MANAGER' },
      { label: t('employee.positions.adminStaff'), value: 'ADMIN_STAFF' },
    ],
    [t],
  );

  const localizedAreaOptions = useMemo(
    () => [
      { label: t('employee.areas.taipei'), value: '台北' },
      { label: t('employee.areas.hsinchu'), value: '新竹' },
      { label: t('employee.areas.taichung'), value: '台中' },
      { label: t('employee.areas.tainan'), value: '台南' },
    ],
    [t],
  );

  const localizedShiftOptions = useMemo(
    () => [
      { label: t('task.shifts.morning'), value: '早班' },
      { label: t('task.shifts.evening'), value: '晚班' },
      { label: t('task.shifts.afternoon'), value: '午班' },
      { label: t('task.shifts.night'), value: '大夜班' },
    ],
    [t],
  );

  const localizedLicenseOptions = useMemo(
    () => [
      { label: t('customer.licenseNone'), value: 'NONE' },
      { label: t('employee.licensesMap.professional'), value: 'PROFESSIONAL' },
      { label: t('employee.licensesMap.pestControl'), value: 'PEST_CONTROL' },
      { label: t('employee.licensesMap.fireAnt'), value: 'FIRE_ANT' },
      { label: t('employee.licensesMap.safety6hr'), value: 'SAFETY_6HR' },
      { label: t('employee.licensesMap.safetyManagerA'), value: 'SAFETY_MANAGER_A' },
      { label: t('employee.licensesMap.safetyManagerB'), value: 'SAFETY_MANAGER_B' },
      { label: t('employee.licensesMap.safetyManagerC'), value: 'SAFETY_MANAGER_C' },
    ],
    [t],
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
      render: (_value, record) => getPositionLabel(record.position, t),
      exportHeader: t('employee.position'),
      exportKey: (record) => getPositionLabel(record.position, t),
    },
    {
      title: t('employee.group'),
      key: 'group',
      width: 120,
      render: (_value, record) => {
        const displayGroup = getDisplayGroup(record, t);
        return (
          <Tag color={record.groupColor || getGroupColor(record.area || record.groupId)}>
            {displayGroup}
          </Tag>
        );
      },
      exportHeader: t('employee.group'),
      exportKey: (record) => getDisplayGroup(record, t),
    },
    {
      title: t('employee.designatedLeave'),
      key: 'designatedLeaves',
      width: 220,
      render: (_value, record) => (
        <Space size={[4, 4]} wrap>
          {record.leaveType && <Tag color="orange">{getLeaveTypeLabel(record.leaveType, t)}</Tag>}
          {(record.designatedLeaves ?? []).map((d) => (
            <Tag key={d}>{d}</Tag>
          ))}
        </Space>
      ),
      exportHeader: t('employee.designatedLeave'),
      exportKey: (record) =>
        `${record.leaveType ? getLeaveTypeLabel(record.leaveType, t) + ' ' : ''}${(record.designatedLeaves ?? []).join(', ')}`,
    },
    {
      title: t('employee.licenses'),
      key: 'licenses',
      width: 220,
      render: (_value, record) => (
        <Space size={[4, 4]} wrap>
          {(record.licenses ?? []).map((lic) => (
            <Tag key={lic}>{getLicenseLabel(lic, t)}</Tag>
          ))}
        </Space>
      ),
      exportHeader: t('employee.licenses'),
      exportKey: (record) =>
        (record.licenses ?? []).map((lic) => getLicenseLabel(lic, t)).join(', '),
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
      {isStaff ? (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Card
            title={
              <Space>
                <Avatar style={{ backgroundColor: '#1677ff' }}>{user?.name?.[0] || '員'}</Avatar>
                <span style={{ fontSize: 16, fontWeight: 700 }}>員工個人資料</span>
              </Space>
            }
            style={{ borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
          >
            <Form form={staffForm} layout="vertical">
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
                tooltip="此員工編號即為系統登入帳號"
                extra="此編號為系統登入帳號（不可修改）"
              >
                <Input disabled />
              </Form.Item>
              <Form.Item name="position" label={t('employee.position')}>
                <Select disabled options={localizedPositionOptions} />
              </Form.Item>
              <Form.Item label={t('employee.group')} style={{ marginBottom: 16 }}>
                <Space style={{ width: '100%', display: 'flex' }} size={8}>
                  <Form.Item name="area" noStyle>
                    <Select disabled options={localizedAreaOptions} style={{ width: '50%' }} />
                  </Form.Item>
                  <Form.Item name="shift" noStyle>
                    <Select disabled options={localizedShiftOptions} style={{ width: '50%' }} />
                  </Form.Item>
                </Space>
              </Form.Item>

              <Form.Item label={t('employee.designatedLeave')}>
                <Alert
                  type="info"
                  showIcon
                  message="此欄位僅限組長以上職位編輯"
                  description="員工個人如需安排指定排休或特休，請向直屬組長提出申請由組長統一排定。"
                  style={{ marginBottom: 12 }}
                />
                <Form.Item name="leaveType" noStyle initialValue="REGULAR_LEAVE">
                  <Radio.Group disabled style={{ marginBottom: 8 }}>
                    <Radio value="REGULAR_LEAVE">{t('employee.leaveTypes.regular')}</Radio>
                    <Radio value="ANNUAL_LEAVE">{t('employee.leaveTypes.annual')}</Radio>
                    <Radio value="OTHER_LEAVE">{t('employee.leaveTypes.other')}</Radio>
                  </Radio.Group>
                </Form.Item>
                <Form.Item name="designatedLeaves" initialValue={[]}>
                  <DesignatedLeavesEditor disabled={true} />
                </Form.Item>
              </Form.Item>

              <Form.Item
                name="licenses"
                label={t('employee.licenses')}
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
                  options={localizedLicenseOptions}
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
                    staffForm.setFieldsValue({ licenses: newValues });
                  }}
                />
              </Form.Item>

              <div style={{ marginTop: 24, textAlign: 'right' }}>
                <Button
                  type="primary"
                  size="large"
                  loading={updateMutation.isPending}
                  onClick={handleStaffSave}
                  style={{ minWidth: 140 }}
                >
                  儲存個人資料
                </Button>
              </div>
            </Form>
          </Card>
        </div>
      ) : (
        <>
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
        </>
      )}

      <BaseModal
        title={editingEmployee ? t('employee.edit') : t('employee.create')}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="系統登入帳號說明"
          description={
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <div>
                • <strong>預設登入帳號</strong>：即為下方所填寫之「員工編號」（例如：E001、STAFF01）
              </div>
              <div>
                • <strong>預設初始密碼</strong>：<code>Ecolab1234</code>
                （新進員工首次登入時可自訂專屬密碼）
              </div>
              <div>
                • <strong>系統權限</strong>：將依所選「職位」自動指派系統操作權限
              </div>
            </div>
          }
        />
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
            tooltip="此員工編號即為系統登入帳號"
            extra="此編號將作為該員工登入排班系統之唯一帳號"
          >
            <Input placeholder="例如：E001、STAFF01" />
          </Form.Item>
          <Form.Item
            name="position"
            label={t('employee.position')}
            rules={[{ required: true, message: t('employee.positionRequired') }]}
          >
            <Select
              placeholder={t('employee.positionPlaceholder')}
              options={localizedPositionOptions}
            />
          </Form.Item>
          <Form.Item label={t('employee.group')} required style={{ marginBottom: 16 }}>
            <Space style={{ width: '100%', display: 'flex' }} size={8}>
              <Form.Item
                name="area"
                noStyle
                rules={[{ required: true, message: t('employee.groupRequired') }]}
              >
                <Select
                  placeholder={t('employee.groupPlaceholder')}
                  options={localizedAreaOptions}
                  style={{ width: 260 }}
                />
              </Form.Item>
              <Form.Item
                name="shift"
                noStyle
                rules={[{ required: true, message: t('task.shiftRequired') }]}
              >
                <Select
                  placeholder={t('task.shiftPlaceholder')}
                  options={localizedShiftOptions}
                  style={{ width: 260 }}
                />
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item label={t('employee.designatedLeave')}>
            <Form.Item name="leaveType" noStyle initialValue="REGULAR_LEAVE">
              <Radio.Group style={{ marginBottom: 8 }} onChange={() => setDatePickerOpen(true)}>
                <Radio value="REGULAR_LEAVE">{t('employee.leaveTypes.regular')}</Radio>
                <Radio value="ANNUAL_LEAVE">{t('employee.leaveTypes.annual')}</Radio>
                <Radio value="OTHER_LEAVE">{t('employee.leaveTypes.other')}</Radio>
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
            label={t('employee.licenses')}
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
              options={localizedLicenseOptions}
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
                    message={`${t('employee.onlyPestControlWarningTitle')}：${t('employee.onlyPestControlWarningContent')}`}
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
