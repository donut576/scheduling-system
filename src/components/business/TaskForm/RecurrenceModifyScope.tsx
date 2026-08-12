/**
 * RecurrenceModifyScope 元件
 *
 * 業務用途：編輯週期任務之單一實例時，詢問使用者本次修改要套用之範圍，
 * 由 TaskForm 於送出編輯前彈出此對話框確認。
 */
import React, { useState } from 'react';
import { Modal, Radio, Space, Typography } from 'antd';
import type { RadioChangeEvent } from 'antd';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

/**
 * 修改範圍：
 * - this：僅修改此次任務實例
 * - thisAndFuture：修改此次及之後所有未發生之任務實例
 */
export type RecurrenceModifyScope = 'this' | 'thisAndFuture';

/**
 * RecurrenceModifyScopeProps
 * - open：是否顯示對話框
 * - onConfirm：使用者確認選擇之修改範圍時呼叫
 * - onCancel：使用者取消時呼叫
 */
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
  const { t } = useTranslation();
  const [scope, setScope] = useState<RecurrenceModifyScope>('this');

  const handleScopeChange = (e: RadioChangeEvent) => {
    setScope(e.target.value as RecurrenceModifyScope);
  };

  const handleOk = () => {
    onConfirm(scope);
  };

  return (
    <Modal
      title={t('recurrence.modifyTitle')}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      width={400}
      data-testid="recurrence-modify-scope-modal"
    >
      <Space direction="vertical" style={{ width: '100%', padding: '16px 0' }}>
        <Text>{t('recurrence.modifyPrompt')}</Text>
        <Radio.Group
          value={scope}
          onChange={handleScopeChange}
          aria-label={t('recurrence.modifyScope')}
        >
          <Space direction="vertical">
            <Radio value="this">{t('recurrence.thisOnly')}</Radio>
            <Radio value="thisAndFuture">{t('recurrence.thisAndFuture')}</Radio>
          </Space>
        </Radio.Group>
      </Space>
    </Modal>
  );
};

export default RecurrenceModifyScopeDialog;
