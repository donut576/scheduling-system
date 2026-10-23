/**
 * EmployeeSelect 元件
 *
 * 業務用途：於任務表單中提供員工指派選擇介面，支援依「地區」、「班別」與「證照」
 * 篩選員工，並以按鈕（CheckableTag）呈現員工姓名與工號供點選。
 * 點選後即加入/移除指派名單；若所選員工有休假或證照不符，將於送出時由警示引擎觸發警示。
 */
import React, { useMemo, useState } from 'react';
import { Select, Tag, Space, Tooltip } from 'antd';
import EmploymentTag from '@/components/business/EmploymentTag';
import { StarFilled, WarningFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { Employee } from '@/types/employee';
import type { LicenseType } from '@/types/alert';
import { LICENSE_TYPE_MAP } from '@/constants/licenseTypes';
import { AREA_OPTIONS, EMPLOYEE_SHIFT_OPTIONS } from '@/constants/groups';
import { useEmployeeList } from '@/queries/useEmployeeQueries';
import { ASSIGNABLE_POSITIONS } from '@/constants/positions';

export interface EmployeeSelectProps {
  value?: string[];
  onChange: (ids: string[]) => void;
  date?: string;
  requiredLicenses?: LicenseType[];
  disabled?: boolean;
}

export interface EmployeeSelectFilters {
  area?: string;
  shift?: string;
  licenseType?: LicenseType;
}

/**
 * 員工選擇器 - 按鈕式指派，支援「地區」、「班別」與「證照」篩選
 */
const EmployeeSelect: React.FC<EmployeeSelectProps> = ({
  value = [],
  onChange,
  date,
  requiredLicenses = [],
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<EmployeeSelectFilters>({});

  // 取得全部員工清單
  const { data: employeeData, isLoading } = useEmployeeList({
    page: 1,
    pageSize: 500,
    license: filters.licenseType,
  });

  const employees: Employee[] = useMemo(() => {
    const list = employeeData?.list ?? [];
    return list.filter(
      (emp) =>
        ASSIGNABLE_POSITIONS.includes(emp.position) ||
        (!emp.position && !emp.name.includes('組長') && !emp.name.includes('經理')),
    );
  }, [employeeData]);

  // 判斷該員工於指定日期是否為指定休假日
  const isOnLeave = (employee: Employee): boolean => {
    if (!date) return false;
    return employee.designatedLeaves?.includes(date) ?? false;
  };

  // 判斷該員工是否持有客戶要求之證照
  const hasRequiredLicenses = (employee: Employee): boolean => {
    if (requiredLicenses.length === 0) return false;
    return requiredLicenses.every((lic) => employee.licenses.includes(lic));
  };

  // 地區選項（台北、新竹、台南、台中）
  const areaOptions = useMemo(() => {
    const map: Record<string, string> = {
      台北: t('employee.areas.taipei'),
      新竹: t('employee.areas.hsinchu'),
      台中: t('employee.areas.taichung'),
      台南: t('employee.areas.tainan'),
    };
    return AREA_OPTIONS.map((opt) => ({
      label: map[String(opt.value)] ?? opt.label,
      value: opt.value,
    }));
  }, [t]);

  // 班別選項（早班、午班、晚班、大夜班）
  const shiftOptions = useMemo(() => {
    const map: Record<string, string> = {
      早班: t('task.shifts.morning'),
      午班: t('task.shifts.afternoon'),
      晚班: t('task.shifts.evening'),
      大夜班: t('task.shifts.night'),
    };
    return EMPLOYEE_SHIFT_OPTIONS.map((opt) => ({
      label: map[String(opt.value)] ?? opt.label,
      value: opt.value,
    }));
  }, [t]);

  // 依「地區」、「班別」與「證照」篩選出的員工列表
  const filteredEmployees = useMemo(() => {
    let result = employees;

    if (filters.area) {
      result = result.filter((emp) => emp.area === filters.area);
    }

    if (filters.shift) {
      result = result.filter((emp) => emp.shift === filters.shift);
    }

    if (filters.licenseType) {
      result = result.filter((emp) => emp.licenses.includes(filters.licenseType!));
    }

    return result;
  }, [employees, filters]);

  // 切換員工選取狀態
  const handleToggle = (employee: Employee, checked: boolean) => {
    if (disabled) return;
    const next = checked ? [...value, employee.id] : value.filter((id) => id !== employee.id);
    onChange(next);
  };

  // 證照篩選下拉選項
  const licenseFilterOptions = useMemo(() => {
    const map: Record<string, string> = {
      PROFESSIONAL: t('employee.licensesMap.professional'),
      PEST_CONTROL: t('employee.licensesMap.pestControl'),
      FIRE_ANT: t('employee.licensesMap.fireAnt'),
      SAFETY_6HR: t('employee.licensesMap.safety6hr'),
      SAFETY_MANAGER_A: t('employee.licensesMap.safetyManagerA'),
      SAFETY_MANAGER_B: t('employee.licensesMap.safetyManagerB'),
      SAFETY_MANAGER_C: t('employee.licensesMap.safetyManagerC'),
    };
    return Object.entries(LICENSE_TYPE_MAP)
      .filter(([key]) => key !== 'NONE')
      .map(([val, label]) => ({ label: map[val] ?? label, value: val }));
  }, [t]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      {/* 篩選列：地區 ＆ 班別 ＆ 證照 */}
      <Space wrap size="small" style={{ width: '100%', marginBottom: 4 }}>
        <Select
          placeholder="地區"
          allowClear
          disabled={disabled}
          style={{ width: 110 }}
          value={filters.area}
          onChange={(val) => setFilters((prev) => ({ ...prev, area: val }))}
          options={areaOptions}
          aria-label="篩選地區"
        />
        <Select
          placeholder="班別"
          allowClear
          disabled={disabled}
          style={{ width: 110 }}
          value={filters.shift}
          onChange={(val) => setFilters((prev) => ({ ...prev, shift: val }))}
          options={shiftOptions}
          aria-label="篩選班別"
        />
        <Select
          placeholder="證照"
          allowClear
          disabled={disabled}
          style={{ width: 150 }}
          value={filters.licenseType}
          onChange={(val) => setFilters((prev) => ({ ...prev, licenseType: val }))}
          options={licenseFilterOptions}
          aria-label={t('employee.filterLicense')}
        />
      </Space>

      {/* 員工名單按鈕式呈現：純員工姓名 (工號) */}
      <div
        role="group"
        aria-label={t('employee.assignEmployees')}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 12,
          padding: 12,
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          minHeight: 48,
          width: '100%',
          boxSizing: 'border-box',
          background: disabled ? '#f5f5f5' : '#fafafa',
          cursor: disabled ? 'not-allowed' : 'default',
        }}
      >
        {isLoading && <span>{t('common.loading')}</span>}
        {!isLoading && filteredEmployees.length === 0 && (
          <span style={{ color: '#8c8c8c' }}>{t('employee.noMatchingEmployees')}</span>
        )}
        {filteredEmployees.map((employee) => {
          const onLeave = isOnLeave(employee);
          const qualified = hasRequiredLicenses(employee);
          const unqualified = requiredLicenses.length > 0 && !qualified;
          const selected = value.includes(employee.id);

          return (
            <Tag.CheckableTag
              key={employee.id}
              data-testid={`employee-tag-${employee.id}`}
              checked={selected}
              onChange={(checked) => handleToggle(employee, checked)}
              aria-label={employee.name}
              style={{
                display: 'block',
                width: '100%',
                minWidth: 0,
                margin: 0,
                boxSizing: 'border-box',
                padding: '8px 12px',
                borderRadius: 6,
                border: selected ? '1px solid #1677ff' : '1px solid #d9d9d9',
                background: selected ? (disabled ? '#bae0ff' : '#e6f4ff') : '#ffffff',
                opacity: disabled && !selected ? 0.6 : 1,
                transition: 'all 0.2s',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                  width: '100%',
                }}
              >
                {(qualified || unqualified) && (
                  <span style={{ flexShrink: 0, display: 'inline-flex' }}>
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
                  </span>
                )}
                <span
                  title={`${employee.name}${employee.employeeNo ? ` (${employee.employeeNo})` : ''}`}
                  style={{
                    flex: 1,
                    fontWeight: selected ? 600 : 400,
                    color: selected ? '#1677ff' : 'inherit',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {employee.name}
                  {employee.employeeNo ? ` (${employee.employeeNo})` : ''}
                </span>
                {onLeave && (
                  <Tag
                    color="error"
                    style={{ marginInlineEnd: 0, fontSize: 11, padding: '0 4px', flexShrink: 0 }}
                  >
                    {t('employee.onLeave')}
                  </Tag>
                )}
                <span style={{ flexShrink: 0, display: 'inline-flex' }}>
                  <EmploymentTag position={employee.position} />
                </span>
              </div>
            </Tag.CheckableTag>
          );
        })}
      </div>
      {disabled && (
        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
          📌 未排班任務之人員指派請至「班表總覽」進行拖曳排班。
        </div>
      )}
    </Space>
  );
};

export default EmployeeSelect;
