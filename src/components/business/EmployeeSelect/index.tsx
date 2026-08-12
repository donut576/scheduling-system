/**
 * EmployeeSelect 元件
 *
 * 業務用途：於任務表單中提供員工指派選擇介面，支援依群組、證照、休假狀態
 * 篩選員工，並以視覺化方式標示員工是否符合客戶要求證照，或該員工於指定
 * 日期是否已排定休假（休假員工將無法被選取）。
 */
import React, { useMemo, useState } from 'react';
import { Select, Tag, Space, Tooltip } from 'antd';
import { StarFilled, WarningFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { Employee } from '@/types/employee';
import type { LicenseType } from '@/types/alert';
import { LICENSE_TYPE_MAP } from '@/constants/licenseTypes';
import { useEmployeeList } from '@/queries/useEmployeeQueries';

/**
 * EmployeeSelectProps
 * - value：已選取之員工 id 清單
 * - onChange：選取狀態變更時的回呼，帶入更新後的員工 id 清單
 * - date：指定日期（YYYY-MM-DD），用於判斷員工是否於當日休假
 * - requiredLicenses：客戶／分店要求之證照清單，用於標示員工是否符合資格
 */
export interface EmployeeSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  date?: string;
  requiredLicenses?: LicenseType[];
}

/**
 * EmployeeSelectFilters - 篩選條件
 * - groupId：依員工所屬群組篩選
 * - licenseType：依員工持有證照類型篩選
 * - hideOnLeave：是否隱藏指定日期已休假之員工
 */
export interface EmployeeSelectFilters {
  groupId?: string;
  licenseType?: LicenseType;
  hideOnLeave?: boolean;
}

/**
 * 員工選擇器 - 按鈕式指派，支援群組、證照、休假狀態篩選
 * - 每位員工以可切換的按鈕（CheckableTag）呈現，點擊即加入／移除指派名單
 * - 高亮符合客戶要求證照之員工；不符合證照需求時顯示警示圖示
 * - 指定日期之休假員工灰顯並停用，無法選取
 *
 * Validates: Requirements 3.6
 */
const EmployeeSelect: React.FC<EmployeeSelectProps> = ({
  value,
  onChange,
  date,
  requiredLicenses = [],
}) => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<EmployeeSelectFilters>({});

  // Fetch all employees (large page size to get all for selection)
  const { data: employeeData, isLoading } = useEmployeeList({
    page: 1,
    pageSize: 500,
    groupId: filters.groupId,
    license: filters.licenseType,
  });

  const employees: Employee[] = useMemo(() => {
    return employeeData?.list ?? [];
  }, [employeeData]);

  // 判斷該員工於指定日期是否為指定休假日（designatedLeaves 命中即視為休假）
  const isOnLeave = (employee: Employee): boolean => {
    if (!date) return false;
    return employee.designatedLeaves.includes(date);
  };

  // 判斷該員工是否持有全部客戶要求之證照；若無證照要求則視為不符合（不特別標示為合格）
  const hasRequiredLicenses = (employee: Employee): boolean => {
    if (requiredLicenses.length === 0) return false;
    return requiredLicenses.every((lic) => employee.licenses.includes(lic));
  };

  // Get unique groups from employees for group filter
  const groupOptions = useMemo(() => {
    const groupMap = new Map<string, { id: string; name: string; color: string }>();
    employees.forEach((emp) => {
      if (!groupMap.has(emp.groupId)) {
        groupMap.set(emp.groupId, {
          id: emp.groupId,
          name: emp.groupName,
          color: emp.groupColor,
        });
      }
    });
    return Array.from(groupMap.values());
  }, [employees]);

  // Filter employees based on current filters
  const filteredEmployees = useMemo(() => {
    let result = employees;

    if (filters.groupId) {
      result = result.filter((emp) => emp.groupId === filters.groupId);
    }

    if (filters.licenseType) {
      result = result.filter((emp) => emp.licenses.includes(filters.licenseType!));
    }

    if (filters.hideOnLeave && date) {
      result = result.filter((emp) => !emp.designatedLeaves.includes(date));
    }

    return result;
  }, [employees, filters, date]);

  // 切換員工選取狀態：休假中之員工直接忽略操作，避免被誤選為指派人員
  const handleToggle = (employee: Employee, checked: boolean) => {
    if (isOnLeave(employee)) return;
    const next = checked ? [...value, employee.id] : value.filter((id) => id !== employee.id);
    onChange(next);
  };

  // License type filter options
  const licenseFilterOptions = Object.entries(LICENSE_TYPE_MAP)
    .filter(([key]) => key !== 'NONE')
    .map(([value, label]) => ({ label, value }));

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      {/* Filter bar */}
      <Space wrap size="small">
        <Select
          placeholder={t('employee.filterGroup')}
          allowClear
          style={{ minWidth: 120 }}
          value={filters.groupId}
          onChange={(val) => setFilters((prev) => ({ ...prev, groupId: val }))}
          options={groupOptions.map((g) => ({
            label: g.name,
            value: g.id,
          }))}
          aria-label={t('employee.filterGroup')}
        />
        <Select
          placeholder={t('employee.filterLicense')}
          allowClear
          style={{ minWidth: 140 }}
          value={filters.licenseType}
          onChange={(val) => setFilters((prev) => ({ ...prev, licenseType: val }))}
          options={licenseFilterOptions}
          aria-label={t('employee.filterLicense')}
        />
        <Select
          placeholder={t('employee.leaveStatus')}
          allowClear
          style={{ minWidth: 120 }}
          value={filters.hideOnLeave ? 'hide' : undefined}
          onChange={(val) => setFilters((prev) => ({ ...prev, hideOnLeave: val === 'hide' }))}
          options={[
            { label: t('employee.hideOnLeave'), value: 'hide' },
            { label: t('employee.showAll'), value: 'all' },
          ]}
          aria-label={t('employee.leaveStatusFilter')}
        />
      </Space>

      {/* Employee toggle buttons */}
      <Space
        wrap
        size={[8, 8]}
        role="group"
        aria-label={t('employee.assignEmployees')}
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          padding: 12,
          minHeight: 48,
          width: '100%',
        }}
      >
        {isLoading && <span>{t('common.loading')}</span>}
        {!isLoading && filteredEmployees.length === 0 && (
          <span>{t('employee.noMatchingEmployees')}</span>
        )}
        {filteredEmployees.map((employee) => {
          const onLeave = isOnLeave(employee);
          const qualified = hasRequiredLicenses(employee);
          const unqualified = requiredLicenses.length > 0 && !qualified;
          const selected = value.includes(employee.id);

          const tag = (
            <Tag.CheckableTag
              key={employee.id}
              checked={selected}
              onChange={(checked) => handleToggle(employee, checked)}
              aria-label={employee.name}
              style={{
                border: '1px solid #d9d9d9',
                padding: '4px 10px',
                opacity: onLeave ? 0.4 : 1,
                cursor: onLeave ? 'not-allowed' : 'pointer',
                pointerEvents: onLeave ? 'none' : undefined,
              }}
            >
              <Space size={4}>
                {qualified && (
                  <Tooltip title={t('employee.licenseQualified')}>
                    <StarFilled
                      style={{ color: '#52c41a' }}
                      aria-label={t('employee.licenseQualified')}
                      role="img"
                    />
                  </Tooltip>
                )}
                {unqualified && (
                  <Tooltip title={t('employee.licenseUnqualified')}>
                    <WarningFilled
                      style={{ color: '#faad14' }}
                      aria-label={t('employee.licenseUnqualified')}
                      role="img"
                    />
                  </Tooltip>
                )}
                <span>{employee.name}</span>
                <Tag color={employee.groupColor} style={{ marginInlineEnd: 0 }}>
                  {employee.groupName}
                </Tag>
                {onLeave && <Tag color="default">{t('employee.onLeave')}</Tag>}
              </Space>
            </Tag.CheckableTag>
          );

          return onLeave ? (
            <Tooltip key={employee.id} title={t('employee.onLeaveDisabled')}>
              {tag}
            </Tooltip>
          ) : (
            tag
          );
        })}
      </Space>
    </Space>
  );
};

export default EmployeeSelect;
