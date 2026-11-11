import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Result, Spin, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { authApi } from '@/api/auth';
import {
  checkPasswordRules,
  firstPasswordError,
} from '@/components/business/ForceChangePasswordModal/passwordRules';

const { Title, Text } = Typography;

interface FormValues {
  newPassword: string;
  confirmPassword: string;
}

type LinkState = 'checking' | 'valid' | 'invalid';

/**
 * 設定新密碼頁（從忘記密碼的信件連結進入：/reset-password?token=...）
 * 先向後端確認連結是否有效，有效才顯示表單；成功後回登入頁。公開頁面，不需要登入。
 */
const ResetPasswordPage: FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [form] = Form.useForm<FormValues>();
  const [state, setState] = useState<LinkState>(token ? 'checking' : 'invalid');
  const [employeeNo, setEmployeeNo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi
      .checkResetToken(token)
      .then((res) => {
        if (cancelled) return;
        setEmployeeNo(res.data.data.employeeNo);
        setState('valid');
      })
      .catch(() => {
        if (!cancelled) setState('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (values: FormValues) => {
    const error = firstPasswordError(
      checkPasswordRules('', values.newPassword, values.confirmPassword),
    );
    if (error) {
      message.error(error);
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, newPassword: values.newPassword });
      message.success('密碼已更新，請用新密碼登入');
      navigate('/login', { replace: true });
    } catch {
      // 失敗原因（例如連結已失效）已由 API 攔截器顯示
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #005EB8 0%, #0072CE 48%, #EAF7EF 100%)',
        padding: '24px 16px',
      }}
    >
      <Card style={{ width: '100%', maxWidth: 420, borderRadius: 12 }}>
        {state === 'checking' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        )}

        {state === 'invalid' && (
          <Result
            status="warning"
            title="連結已失效"
            subTitle="這個連結已過期或已使用過，請回到登入頁重新申請。"
            extra={
              <Button type="primary" onClick={() => navigate('/login', { replace: true })}>
                回到登入頁
              </Button>
            }
          />
        )}

        {state === 'valid' && (
          <>
            <Title level={4} style={{ marginTop: 0 }}>
              設定新密碼
            </Title>
            <Text type="secondary">員工編號：{employeeNo}</Text>
            <Form<FormValues>
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              autoComplete="off"
              style={{ marginTop: 16 }}
            >
              <Form.Item
                name="newPassword"
                label="新密碼"
                rules={[{ required: true, message: '請輸入新密碼' }]}
                extra="至少 8 碼，且不能是預設密碼"
              >
                <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="再次輸入新密碼"
                rules={[{ required: true, message: '請再次輸入新密碼' }]}
              >
                <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={submitting} block>
                儲存並回到登入頁
              </Button>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
