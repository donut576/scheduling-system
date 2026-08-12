import { useState, useCallback } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Checkbox, Card, Typography, Space, message } from 'antd';
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useUserStore } from '@/stores/useUserStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { authApi } from '@/api/auth';
import type { LoginRequest } from '@/types/auth';

const { Title, Text } = Typography;

interface LoginFormValues {
  account: string;
  password: string;
  captcha?: string;
  rememberMe?: boolean;
}

const LoginPage: FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginFormValues>();
  const [loading, setLoading] = useState(false);
  const [captchaUrl, setCaptchaUrl] = useState<string>('');

  const { loginFailCount, setToken, setUser, incrementLoginFail, resetLoginFail } = useUserStore();
  const { buildPermissions } = usePermissionStore();

  const showCaptcha = loginFailCount >= 3;

  const refreshCaptcha = useCallback(() => {
    // Generate a new captcha URL with a cache-busting timestamp
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '') + '/api/v1/auth/captcha';
    setCaptchaUrl(`${baseUrl}?t=${Date.now()}`);
  }, []);

  // Initialize captcha URL when the captcha field becomes visible
  useState(() => {
    if (showCaptcha && !captchaUrl) {
      refreshCaptcha();
    }
  });

  const handleSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      const credentials: LoginRequest = {
        account: values.account,
        password: values.password,
        captcha: values.captcha,
        rememberMe: values.rememberMe,
      };

      // Step 1: Call login API
      const loginResponse = await authApi.login(credentials);
      const { accessToken, user } = loginResponse.data.data;

      // Step 2: Store token
      setToken(accessToken);

      // Step 3: Store user profile
      setUser(user);

      // Step 4: Build permissions from profile
      buildPermissions(user.permissions, user.role);

      // Step 5: Reset login fail count
      resetLoginFail();

      message.success('登入成功');

      // Step 6: Navigate to dashboard
      navigate('/dashboard', { replace: true });
    } catch {
      incrementLoginFail();

      // Refresh captcha if needed after failure
      if (loginFailCount + 1 >= 3) {
        refreshCaptcha();
      }

      message.error('帳號或密碼錯誤，請重新嘗試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 16,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        }}
      >
        <Space
          direction="vertical"
          size="middle"
          style={{ width: '100%', textAlign: 'center', marginBottom: 24 }}
        >
          {/* Company Logo Placeholder */}
          <div
            style={{
              width: 64,
              height: 64,
              margin: '0 auto',
              borderRadius: '50%',
              background: '#1677ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>E</Text>
          </div>
          <Title level={3} style={{ margin: 0 }}>
            藝康排班系統
          </Title>
          <Text type="secondary">EcoLab Scheduling System</Text>
        </Space>

        <Form<LoginFormValues>
          form={form}
          name="login"
          onFinish={handleSubmit}
          autoComplete="off"
          layout="vertical"
          size="large"
          initialValues={{ rememberMe: false }}
        >
          <Form.Item
            name="account"
            label="帳號 / 員工編號"
            rules={[{ required: true, message: '請輸入帳號或員工編號' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="請輸入帳號或員工編號"
              aria-label="帳號或員工編號"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密碼"
            rules={[{ required: true, message: '請輸入密碼' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="請輸入密碼" aria-label="密碼" />
          </Form.Item>

          {showCaptcha && (
            <Form.Item
              name="captcha"
              label="驗證碼"
              rules={[{ required: true, message: '請輸入驗證碼' }]}
            >
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  prefix={<SafetyCertificateOutlined />}
                  placeholder="請輸入驗證碼"
                  aria-label="驗證碼"
                  style={{ flex: 1 }}
                />
                <img
                  src={captchaUrl}
                  alt="驗證碼圖片，點擊或按 Enter 鍵刷新"
                  onClick={refreshCaptcha}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      refreshCaptcha();
                    }
                  }}
                  style={{
                    height: 40,
                    cursor: 'pointer',
                    border: '1px solid #d9d9d9',
                    borderRadius: '0 6px 6px 0',
                    marginLeft: -1,
                  }}
                  title="點擊刷新驗證碼"
                />
              </Space.Compact>
            </Form.Item>
          )}

          <Form.Item name="rememberMe" valuePropName="checked">
            <Checkbox>記住我</Checkbox>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block aria-label="登入">
              登入
            </Button>
          </Form.Item>
        </Form>

        {showCaptcha && (
          <Text type="warning" style={{ display: 'block', textAlign: 'center' }}>
            連續登入失敗 {loginFailCount} 次，請輸入驗證碼
          </Text>
        )}
      </Card>
    </div>
  );
};

export default LoginPage;
