import { useState, useCallback } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Checkbox, Card, Typography, Space, message } from 'antd';
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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

/**
 * 登入頁面
 * 提供帳號密碼登入表單，連續登入失敗達 3 次後顯示驗證碼欄位，
 * 登入成功後儲存 token/使用者資料並建立權限，最後導向 Dashboard。
 */
const LoginPage: FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form] = Form.useForm<LoginFormValues>();
  const [loading, setLoading] = useState(false);
  const [captchaUrl, setCaptchaUrl] = useState<string>('');

  const { loginFailCount, setToken, setUser, incrementLoginFail, resetLoginFail } = useUserStore();
  const { buildPermissions } = usePermissionStore();

  // 連續登入失敗達 3 次以上才顯示驗證碼欄位
  const showCaptcha = loginFailCount >= 3;

  // 產生帶有防快取時間戳的驗證碼圖片網址，用於初次顯示或使用者點擊/按 Enter 刷新驗證碼
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

  // 表單送出：呼叫登入 API，成功則儲存 token/使用者資料並導向 Dashboard，
  // 失敗則遞增失敗次數並視需要刷新驗證碼
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

      message.success(t('auth.loginSuccess'));

      // Step 6: Navigate to dashboard
      navigate('/dashboard', { replace: true });
    } catch {
      incrementLoginFail();

      // Refresh captcha if needed after failure
      if (loginFailCount + 1 >= 3) {
        refreshCaptcha();
      }

      message.error(t('auth.invalidCredentials'));
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
        background: 'linear-gradient(135deg, #005EB8 0%, #0072CE 48%, #EAF7EF 100%)',
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
              background: '#005EB8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>E</Text>
          </div>
          <Title level={3} style={{ margin: 0 }}>
            {t('app.title')}
          </Title>
          <Text type="secondary">{t('app.subtitle')}</Text>
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
            label={t('auth.account')}
            rules={[{ required: true, message: t('auth.accountRequired') }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder={t('auth.accountPlaceholder')}
              aria-label={t('auth.accountAriaLabel')}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={t('auth.password')}
            rules={[{ required: true, message: t('auth.passwordRequired') }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('auth.passwordPlaceholder')}
              aria-label={t('auth.password')}
            />
          </Form.Item>

          {showCaptcha && (
            <Form.Item
              name="captcha"
              label={t('auth.captcha')}
              rules={[{ required: true, message: t('auth.captchaRequired') }]}
            >
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  prefix={<SafetyCertificateOutlined />}
                  placeholder={t('auth.captchaPlaceholder')}
                  aria-label={t('auth.captcha')}
                  style={{ flex: 1 }}
                />
                <img
                  src={captchaUrl}
                  alt={t('auth.captchaImageAlt')}
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
                  title={t('auth.refreshCaptcha')}
                />
              </Space.Compact>
            </Form.Item>
          )}

          <Form.Item name="rememberMe" valuePropName="checked">
            <Checkbox>{t('auth.rememberMe')}</Checkbox>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              aria-label={t('auth.login')}
            >
              {t('auth.login')}
            </Button>
          </Form.Item>
        </Form>

        {showCaptcha && (
          <Text type="warning" style={{ display: 'block', textAlign: 'center' }}>
            {t('auth.captchaNotice', { count: loginFailCount })}
          </Text>
        )}
      </Card>
    </div>
  );
};

export default LoginPage;
