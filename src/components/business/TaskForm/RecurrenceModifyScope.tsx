import React, { useState } from 'react';
import { Modal, Radio, Space, Typography } from 'antd';
import type { RadioChangeEvent } from 'antd';

const { Text } = Typography;

export type RecurrenceModifyScope = 'this' | 'thisAndFuture';

export interface RecurrenceModifyScopeProps {
  open: boolean;
  onConfirm: (scope: RecurrenceModifyScope) => void;
  onCancel: () => void;
}

/**
 * RecurrenceModifyScope - 週期任務修改範圍選擇對話框
 * 編輯週期任務時提供「僅此次」或「此次及之後」修改範圍選項
 *
 * Validates: Requirements 5.4
 */
const RecurrenceModifyScopeDialog: React.FC<RecurrenceModifyScopeProps> = ({
  open,
  onConfirm,
  onCancel,
}) => {
  const [scope, setScope] = useState<RecurrenceModifyScope>('this');

  const handleScopeChange = (e: RadioChangeEvent) => {
    setScope(e.target.value as RecurrenceModifyScope);
  };

  const handleOk = () => {
    onConfirm(scope);
  };

  return (
    <Modal
      title="修改週期任務"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="確認"
      cancelText="取消"
      width={400}
      data-testid="recurrence-modify-scope-modal"
    >
      <Space direction="vertical" style={{ width: '100%', padding: '16px 0' }}>
        <Text>請選擇要修改的範圍：</Text>
        <Radio.Group value={scope} onChange={handleScopeChange} aria-label="修改範圍">
          <Space direction="vertical">
            <Radio value="this">僅此次</Radio>
            <Radio value="thisAndFuture">此次及之後</Radio>
          </Space>
        </Radio.Group>
      </Space>
    </Modal>
  );
};

export default RecurrenceModifyScopeDialog;
