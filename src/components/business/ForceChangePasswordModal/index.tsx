import { useState } from 'react';
import type { FC } from 'react';
import { Modal, Form, Input, Button, Alert, Space, message } from 'antd';
import {
  LockOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { authApi } from '@/api/auth';
import { useUserStore } from '@/stores/useUserStore';
import { checkPasswordRules, firstPasswordError } from './passwordRules';

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** 單條規則的提示列：尚未輸入顯示灰色，符合綠色，不符合紅色 */
const RuleRow: FC<{ ok: boolean; touched: boolean; text: string }> = ({ ok, touched, text }) => {
  const color = !touched ? '#8c8c8c' : ok ? '#52c41a' : '#ff4d4f';
  const Icon = !touched ? MinusCircleOutlined : ok ? CheckCircleFilled : CloseCircleFilled;
  return (
    <div style={{ fontSize: 13, color, display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon />
      {text}
    </div>
  );
};

/**
 * 強制改密碼視窗
 *
 * 登入後若後端回報 mustChangePassword（新員工使用預設密碼，或被管理員重設過），
 * 就顯示這個無法關閉的視窗，改完密碼才能使用系統。放在 MainLayout，
 * 所以不管從哪個頁面進來、重新整理後都會擋住。後端也會擋其他 API，不是只靠這個畫面。
 */
const ForceChangePasswordModal: FC = () => {
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const logout = useUserStore((s) => s.logout);
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);

  const current = Form.useWatch('currentPassword', form) ?? '';
  const next = Form.useWatch('newPassword', form) ?? '';
  const confirm = Form.useWatch('confirmPassword', form) ?? '';
  const rules = checkPasswordRules(current, next, confirm);

  const open = Boolean(user?.mustChangePassword);

  const handleSubmit = async (values: FormValues) => {
    const error = firstPasswordError(
      checkPasswordRules(values.currentPassword, values.newPassword, values.confirmPassword),
    );
    if (error) {
      message.error(error);
      return;
    }
    setSubmitting(true);
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      if (user) setUser({ ...user, mustChangePassword: false });
      form.resetFields();
      message.success('密碼已更新');
    } catch {
      // 失敗原因（例如「目前密碼不正確」）已由 API 攔截器（src/api/instance.ts）顯示，這裡不重複提示
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={
        <Space>
          <LockOutlined style={{ color: '#faad14' }} />
          <span>請先設定新密碼</span>
        </Space>
      }
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={null}
      width={420}
      destroyOnClose
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="你目前使用的是預設密碼，設定新密碼後才能使用系統。"
      />
      <Form<FormValues> form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
        <Form.Item
          name="currentPassword"
          label="目前密碼"
          rules={[{ required: true, message: '請輸入目前密碼' }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label="新密碼"
          rules={[{ required: true, message: '請輸入新密碼' }]}
        >
          <Input.Password autoComplete="new-password" placeholder="至少 8 碼" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="再次輸入新密碼"
          rules={[{ required: true, message: '請再次輸入新密碼' }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <div style={{ marginBottom: 16 }}>
          <RuleRow ok={rules.longEnough} touched={next !== ''} text="至少 8 碼" />
          <RuleRow ok={rules.notDefault} touched={next !== ''} text="不能是預設密碼" />
          <RuleRow
            ok={rules.differentFromCurrent}
            touched={next !== '' && current !== ''}
            text="不能與目前密碼相同"
          />
          <RuleRow ok={rules.confirmed} touched={confirm !== ''} text="兩次輸入一致" />
        </div>
        <Button type="primary" htmlType="submit" loading={submitting} block>
          更新密碼並進入系統
        </Button>
        <Button type="link" block onClick={logout} style={{ marginTop: 4 }}>
          登出
        </Button>
      </Form>
    </Modal>
  );
};

export default ForceChangePasswordModal;
