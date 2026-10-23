/**
 * EmploymentTag 元件
 *
 * 業務用途：在員工姓名旁標示「正職」或「約聘」。
 * 其他職位（組長、經理、行政）不顯示任何內容。
 */
import React from 'react';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';

const TAG_STYLES = {
  STAFF: { labelKey: 'employee.tags.regular', background: '#d6e4ff', color: '#2f54eb' },
  CONTRACT_STAFF: { labelKey: 'employee.tags.contract', background: '#fa8c16', color: '#ffffff' },
} as const;

export interface EmploymentTagProps {
  /** 員工職位代碼 */
  position?: string;
}

const EmploymentTag: React.FC<EmploymentTagProps> = ({ position }) => {
  const { t } = useTranslation();
  const config = position ? TAG_STYLES[position as keyof typeof TAG_STYLES] : undefined;
  if (!config) return null;

  return (
    <Tag
      bordered={false}
      data-testid={`employment-tag-${position}`}
      style={{
        margin: 0,
        padding: '0 8px',
        minWidth: 23,
        textAlign: 'center',
        fontSize: 10,
        lineHeight: '20px',
        fontWeight: 600,
        borderRadius: 6,
        background: config.background,
        color: config.color,
      }}
    >
      {t(config.labelKey)}
    </Tag>
  );
};

export default EmploymentTag;
