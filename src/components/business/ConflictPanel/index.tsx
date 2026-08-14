/**
 * ConflictPanel 元件
 *
 * 業務用途：於排班表單送出時，若前端預檢（alert rules）偵測到違規
 * （如證照不符、連續工作超時、人數不足等），顯示違規清單供使用者檢視，
 * 並在使用者具備覆蓋權限時，提供輸入覆蓋備註並確認覆蓋違規的操作介面。
 */
import React, { useState, useCallback } from 'react';
import { Alert, List, Input, Button, Space, Tag, Typography } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { AlertViolation, AlertRuleId } from '@/types/alert';

/**
 * ConflictPanelProps
 * - violations：違規清單，為空陣列時元件不渲染任何內容
 * - onOverride：使用者輸入備註並確認覆蓋時呼叫，帶入備註文字
 * - canOverride：目前使用者是否具備覆蓋違規之權限，決定顯示覆蓋操作區或提示無權限訊息
 */
export interface ConflictPanelProps {
  violations: AlertViolation[];
  onOverride: (remark: string) => void;
  canOverride: boolean;
}

const { TextArea } = Input;
const { Text } = Typography;

/**
 * Rule ID to human-readable name mapping
 */
const ALERT_RULE_KEYS: Record<AlertRuleId, string> = {
  LICENSE_REQUIRED: 'alert.rules.licenseRequired',
  CONSECUTIVE_DAYS: 'alert.rules.consecutiveDays',
  DAILY_HOURS_EXCEEDED: 'alert.rules.dailyHoursExceeded',
  DUPLICATE_SLOT: 'alert.rules.duplicateSlot',
  DESIGNATED_LEAVE: 'alert.rules.designatedLeave',
  HEADCOUNT_BELOW_MIN: 'alert.rules.headcountBelowMin',
};

/**
 * Severity to display tag color mapping
 */
const SEVERITY_TAG_COLOR: Record<string, string> = {
  BLOCKING: 'error',
};

/**
 * ConflictPanel - 顯示排班衝突與違規清單
 * 當 canOverride 為 true 時，顯示覆蓋備註輸入與確認覆蓋按鈕
 * 當 canOverride 為 false 時，僅顯示違規清單與無法覆蓋提示
 *
 * @param violations - 待顯示之違規清單
 * @param onOverride - 確認覆蓋時的回呼，帶入已去除前後空白的備註文字
 * @param canOverride - 是否顯示覆蓋操作區（權限控制）
 *
 * Validates: Requirements 3.8, 7.7
 */
const ConflictPanel: React.FC<ConflictPanelProps> = ({ violations, onOverride, canOverride }) => {
  const { t } = useTranslation();
  const [remark, setRemark] = useState('');

  // 送出覆蓋：僅在備註非空白時才觸發，避免無說明之覆蓋操作
  const handleOverride = useCallback(() => {
    if (remark.trim()) {
      onOverride(remark.trim());
    }
  }, [remark, onOverride]);

  const handleRemarkChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRemark(e.target.value);
  }, []);

  // 無違規時完全不渲染面板，避免佔用版面
  if (violations.length === 0) {
    return null;
  }

  return (
    <div data-testid="conflict-panel" role="region" aria-label={t('alert.conflictPanel')}>
      <Alert
        type="error"
        message={t('alert.conflict')}
        description={t('alert.conflictDescription', { count: violations.length })}
        showIcon
        icon={<ExclamationCircleOutlined />}
        style={{ marginBottom: 16 }}
      />

      <List
        dataSource={violations}
        itemLayout="vertical"
        size="small"
        renderItem={(violation) => (
          <List.Item data-testid={`violation-item-${violation.ruleId}`}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Space wrap>
                <Text strong>{t(ALERT_RULE_KEYS[violation.ruleId] ?? violation.ruleId)}</Text>
                <Tag color={SEVERITY_TAG_COLOR[violation.severity] ?? 'default'}>
                  {violation.severity}
                </Tag>
              </Space>
              <Text>{violation.message}</Text>
              {violation.affectedEmployees && violation.affectedEmployees.length > 0 && (
                <Text type="secondary">
                  {t('alert.affectedEmployees')}：{violation.affectedEmployees.join('、')}
                </Text>
              )}
            </Space>
          </List.Item>
        )}
      />

      {canOverride ? (
        <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size="middle">
          <Text strong style={{ color: '#d4380d' }}>
            請填寫備註說明（必填）
          </Text>
          <TextArea
            value={remark}
            onChange={handleRemarkChange}
            placeholder="請填寫備註說明（必填）"
            rows={3}
            maxLength={500}
            showCount
            aria-label={t('alert.overrideRemark')}
          />
          <Button
            type="primary"
            danger
            onClick={handleOverride}
            disabled={!remark.trim()}
            aria-label={t('alert.confirmOverride')}
          >
            {t('alert.confirmOverride')}
          </Button>
        </Space>
      ) : (
        <Alert type="warning" message={t('alert.noOverridePermission')} style={{ marginTop: 16 }} />
      )}
    </div>
  );
};

export default ConflictPanel;
