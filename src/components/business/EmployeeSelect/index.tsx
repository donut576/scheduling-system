import React, { useMemo, useState } from 'react';
import { Select, Tag, Space, Tooltip } from 'antd';
import { StarFilled } from '@ant-design/icons';
import type { Employee } from '@/types/employee';
import type { LicenseType } from '@/types/alert';
import { LICENSE_TYPE_MAP } from '@/constants/licenseTypes';
import { useEmployeeList } from '@/queries/useEmployeeQueries';

export interface EmployeeSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  date?: string;
  requiredLicenses?: LicenseType[];
  multiple?: boolean;
}

export interface EmployeeSelectFilters {
  groupId?: string;
  licenseType?: LicenseType;
  hideOnLeave?: boolean;
}

/**
 * 員工選擇器 - 支援群組、證照、休假狀態篩選
 * - 多選模式
 * - 高亮符合客戶要求證照之員工
 * - 指定日期之休假員工灰顯標示
 *
 * Validates: Requirements 3.6
 */
const EmployeeSelect: React.FC<EmployeeSelectProps> = ({
  value,
  onChange,
  date,
  requiredLicenses = [],
  multiple = true,
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

  // Build select options
  const selectOptions = useMemo(() => {
    return filteredEmployees.map((emp) => {
      const onLeave = isOnLeave(emp);
      const qualified = hasRequiredLicenses(emp);

      return {
        value: emp.id,
        label: emp.name,
        employee: emp,
        disabled: onLeave,
        onLeave,
        qualified,
      };
    });
  }, [filteredEmployees, date, requiredLicenses]);

  // Custom option render
  const optionRender = (option: {
    value?: string | number | null;
    label?: React.ReactNode;
    data?: {
      employee: Employee;
      onLeave: boolean;
      qualified: boolean;
    };
  }) => {
    const { employee, onLeave, qualified } = option.data ?? {};
    if (!employee) return <span>{String(option.label)}</span>;

    return (
      <Space
        style={{
          width: '100%',
          opacity: onLeave ? 0.4 : 1,
          color: onLeave ? '#999' : undefined,
        }}
      >
        <span>{employee.name}</span>
        <Tag color={employee.groupColor} style={{ marginInlineEnd: 0 }}>
          {employee.groupName}
        </Tag>
        {qualified && (
          <Tooltip title="符合客戶要求證照">
            <StarFilled style={{ color: '#52c41a' }} aria-label="符合客戶要求證照" role="img" />
          </Tooltip>
        )}
        {onLeave && <Tag color="default">休假</Tag>}
        {employee.licenses
          .filter((lic) => lic !== 'NONE')
          .slice(0, 2)
          .map((lic) => (
            <Tag key={lic} style={{ fontSize: 11 }}>
              {LICENSE_TYPE_MAP[lic]}
            </Tag>
          ))}
      </Space>
    );
  };

  // Custom tag render for selected items
  const tagRender = (props: {
    label: React.ReactNode;
    value: string;
    closable: boolean;
    onClose: () => void;
  }) => {
    const { label, value: empId, closable, onClose } = props;
    const emp = employees.find((e) => e.id === empId);

    if (!emp) {
      return (
        <Tag closable={closable} onClose={onClose}>
          {label}
        </Tag>
      );
    }

    const qualified = hasRequiredLicenses(emp);
    const onLeave = isOnLeave(emp);

    return (
      <Tag
        closable={closable}
        onClose={onClose}
        color={onLeave ? 'default' : qualified ? 'success' : undefined}
        style={{
          marginInlineEnd: 4,
          opacity: onLeave ? 0.6 : 1,
        }}
      >
        {qualified && <StarFilled style={{ marginInlineEnd: 4, color: '#52c41a' }} />}
        {emp.name}
      </Tag>
    );
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

      {/* Employee multi-select */}
      <Select
        mode={multiple ? 'multiple' : undefined}
        value={value}
        onChange={(ids: string[]) => onChange(ids)}
        loading={isLoading}
        placeholder="請選擇指派員工"
        style={{ width: '100%' }}
        optionFilterProp="label"
        showSearch
        options={selectOptions}
        optionRender={optionRender}
        tagRender={tagRender}
        aria-label="指派員工"
      />
    </Space>
  );
};

export default EmployeeSelect;
