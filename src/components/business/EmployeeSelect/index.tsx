import React, { useMemo, useState } from 'react';
import { Select, Tag, Space, Tooltip } from 'antd';
import { StarFilled, WarningFilled } from '@ant-design/icons';
import type { Employee } from '@/types/employee';
import type { LicenseType } from '@/types/alert';
import { LICENSE_TYPE_MAP } from '@/constants/licenseTypes';
import { useEmployeeList } from '@/queries/useEmployeeQueries';

export interface EmployeeSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  date?: string;
  requiredLicenses?: LicenseType[];
}

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

  // Determine if an employee is on designated leave for the given date
  const isOnLeave = (employee: Employee): boolean => {
    if (!date) return false;
    return employee.designatedLeaves.includes(date);
  };

  // Determine if an employee has all required licenses
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
          placeholder="篩選群組"
          allowClear
          style={{ minWidth: 120 }}
          value={filters.groupId}
          onChange={(val) => setFilters((prev) => ({ ...prev, groupId: val }))}
          options={groupOptions.map((g) => ({
            label: g.name,
            value: g.id,
          }))}
          aria-label="篩選群組"
        />
        <Select
          placeholder="篩選證照"
          allowClear
          style={{ minWidth: 140 }}
          value={filters.licenseType}
          onChange={(val) => setFilters((prev) => ({ ...prev, licenseType: val }))}
          options={licenseFilterOptions}
          aria-label="篩選證照"
        />
        <Select
          placeholder="休假狀態"
          allowClear
          style={{ minWidth: 120 }}
          value={filters.hideOnLeave ? 'hide' : undefined}
          onChange={(val) => setFilters((prev) => ({ ...prev, hideOnLeave: val === 'hide' }))}
          options={[
            { label: '隱藏休假員工', value: 'hide' },
            { label: '顯示全部', value: 'all' },
          ]}
          aria-label="休假狀態篩選"
        />
      </Space>

      {/* Employee toggle buttons */}
      <Space
        wrap
        size={[8, 8]}
        role="group"
        aria-label="指派員工"
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          padding: 12,
          minHeight: 48,
          width: '100%',
        }}
      >
        {isLoading && <span>載入中...</span>}
        {!isLoading && filteredEmployees.length === 0 && <span>無符合條件之員工</span>}
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
                  <Tooltip title="符合客戶要求證照">
                    <StarFilled
                      style={{ color: '#52c41a' }}
                      aria-label="符合客戶要求證照"
                      role="img"
                    />
                  </Tooltip>
                )}
                {unqualified && (
                  <Tooltip title="不符合客戶要求證照">
                    <WarningFilled
                      style={{ color: '#faad14' }}
                      aria-label="不符合客戶要求證照"
                      role="img"
                    />
                  </Tooltip>
                )}
                <span>{employee.name}</span>
                <Tag color={employee.groupColor} style={{ marginInlineEnd: 0 }}>
                  {employee.groupName}
                </Tag>
                {onLeave && <Tag color="default">休假</Tag>}
              </Space>
            </Tag.CheckableTag>
          );

          return onLeave ? (
            <Tooltip key={employee.id} title="該員工於指定日期休假，無法指派">
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
