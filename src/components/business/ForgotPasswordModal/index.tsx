import { useState } from 'react';
import type { FC } from 'react';
import { Modal, Form, Input, Button, Alert, Space } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { authApi } from '@/api/auth';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  account: string;
}

/**
 * 忘記密碼視窗：輸入員工編號，系統寄一封含一次性連結的信到員工信箱。
 * 不論員工編號是否存在，後端都回一樣的結果，所以這裡也只顯示同一句話，不透露帳號資訊。
 */
const ForgotPasswordModal: FC<Props> = ({ open, onClose }) => {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleClose = () => {
    form.resetFields();
    setSent(false);
    onClose();
  };

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await authApi.forgotPassword({ account: values.account.trim() });
      setSent(true);
    } catch {
      // 錯誤訊息（例如網路異常）已由 API 攔截器顯示
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      destroyOnClose
      width={420}
      footer={null}
      title={
        <Space>
          <LockOutlined style={{ color: '#005EB8' }} />
          <span>忘記密碼</span>
        </Space>
      }
    >
      {sent ? (
        <>
          <Alert
            type="success"
            showIcon
            message="若此員工編號存在，重設信已寄出"
            description="請到公司信箱收信，連結 30 分鐘內有效。沒收到的話，請檢查垃圾郵件匣，或稍後再申請一次。"
            style={{ marginBottom: 16 }}
          />
          <Button type="primary" block onClick={handleClose}>
            我知道了
          </Button>
        </>
      ) : (
        <Form<FormValues> form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <p style={{ color: '#595959', marginTop: 0 }}>
            輸入員工編號，我們會寄一封重設密碼的信到你的公司信箱。
          </p>
          <Form.Item
            name="account"
            label="員工編號"
            rules={[{ required: true, whitespace: true, message: '請輸入員工編號' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="例如：T001" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} block>
            寄送重設信
          </Button>
        </Form>
      )}
    </Modal>
  );
};

export default ForgotPasswordModal;
