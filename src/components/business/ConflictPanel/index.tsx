import React, { useState, useCallback } from 'react';
import { Alert, List, Input, Button, Space, Tag, Typography } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import type { AlertViolation, AlertRuleId } from '@/types/alert';

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
const ALERT_RULE_NAMES: Record<AlertRuleId, string> = {
  LICENSE_REQUIRED: '證照要求',
  CONSECUTIVE_DAYS: '連續工作超過七日',
  DAILY_HOURS_EXCEEDED: '日工時超過十小時',
  DUPLICATE_SLOT: '同時段重複排班',
  DESIGNATED_LEAVE: '指定休假日排班',
  HEADCOUNT_BELOW_MIN: '人數不足',
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
 * Validates: Requirements 3.8, 7.7
 */
const ConflictPanel: React.FC<ConflictPanelProps> = ({ violations, onOverride, canOverride }) => {
  const [remark, setRemark] = useState('');

  const handleOverride = useCallback(() => {
    if (remark.trim()) {
      onOverride(remark.trim());
    }
  }, [remark, onOverride]);

  const handleRemarkChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRemark(e.target.value);
  }, []);

  if (violations.length === 0) {
    return null;
  }

  return (
    <div data-testid="conflict-panel" role="region" aria-label="排班衝突面板">
      <Alert
        type="error"
        message="排班衝突"
        description={`偵測到 ${violations.length} 項違規，請確認後再進行儲存。`}
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
                <Text strong>{ALERT_RULE_NAMES[violation.ruleId] ?? violation.ruleId}</Text>
                <Tag color={SEVERITY_TAG_COLOR[violation.severity] ?? 'default'}>
                  {violation.severity}
                </Tag>
              </Space>
              <Text>{violation.message}</Text>
              {violation.affectedEmployees && violation.affectedEmployees.length > 0 && (
                <Text type="secondary">影響員工：{violation.affectedEmployees.join('、')}</Text>
              )}
            </Space>
          </List.Item>
        )}
      />

      {canOverride ? (
        <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size="middle">
          <Text strong>覆蓋備註</Text>
          <TextArea
            value={remark}
            onChange={handleRemarkChange}
            placeholder="請輸入覆蓋原因說明"
            rows={3}
            maxLength={500}
            showCount
            aria-label="覆蓋備註"
          />
          <Button
            type="primary"
            danger
            onClick={handleOverride}
            disabled={!remark.trim()}
            aria-label="確認覆蓋"
          >
            確認覆蓋
          </Button>
        </Space>
      ) : (
        <Alert
          type="warning"
          message="您無權限覆蓋此違規，請聯繫授權人員處理。"
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  );
};

export default ConflictPanel;
