import { useState, useCallback } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Checkbox, message, Space, Row, Col } from 'antd';
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '@/stores/useUserStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { authApi } from '@/api/auth';
import { ROLE_PERMISSIONS } from '@/constants/permissions';
import type { LoginRequest, UserProfile, RoleType } from '@/types/auth';
import axios from 'axios';
import ForgotPasswordModal from '@/components/business/ForgotPasswordModal';

const { Title, Text } = Typography;

interface LoginFormValues {
  account: string;
  password: string;
  captcha?: string;
  rememberMe?: boolean;
}

/**
 * 登入頁面
 * 提供帳號密碼登入表單、快速切換角色、忘記密碼與 IT Support 支援說明。
 */
const LoginPage: FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form] = Form.useForm<LoginFormValues>();
  const [loading, setLoading] = useState(false);
  const [captchaUrl, setCaptchaUrl] = useState<string>('');

  // 忘記密碼與首次登入彈窗
  const [forgotModalOpen, setForgotModalOpen] = useState(false);

  const { loginFailCount, setToken, setUser, incrementLoginFail, resetLoginFail } = useUserStore();
  const { buildPermissions } = usePermissionStore();

  // 連續登入失敗達 3 次以上才顯示驗證碼欄位（目前關閉）
  const showCaptcha = false;

  // 產生帶有防快取時間戳的驗證碼圖片網址
  const refreshCaptcha = useCallback(() => {
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '') + '/api/v1/auth/captcha';
    setCaptchaUrl(`${baseUrl}?t=${Date.now()}`);
  }, []);

  useState(() => {
    if (showCaptcha && !captchaUrl) {
      refreshCaptcha();
    }
  });

  // 登入提交
  const handleSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      const credentials: LoginRequest = {
        account: values.account,
        password: values.password,
        captcha: values.captcha,
        rememberMe: values.rememberMe,
      };

      try {
        const loginResponse = await authApi.login(credentials);
        const { accessToken, user } = loginResponse.data.data;

        setToken(accessToken);
        setUser(user);
        buildPermissions(user.permissions, user.role);
        resetLoginFail();

        message.success(t('auth.loginSuccess'));
        navigate('/dashboard', { replace: true });
        return;
      } catch (apiErr) {
        // 若 API 請求失敗（例如在未啟用 ServiceWorker、隱私瀏覽模式或網路受限環境），
        // 針對 Demo 快速切換帳號提供無縫自動登入 fallback
        const acc = values.account.trim().toLowerCase();
        const pwd = values.password;
        const demoMap: Record<
          string,
          { role: RoleType; name: string; employeeNo: string; validPass: string[]; area?: string }
        > = {
          admin: {
            role: 'ADMIN',
            name: 'Demo 系統管理員',
            employeeNo: 'ADMIN01',
            validPass: ['admin123'],
            area: '台北',
          },
          manager: {
            role: 'MANAGER',
            name: 'Demo 副理',
            employeeNo: 'MGR01',
            validPass: ['manager123', 'admin123'],
            area: '台北',
          },
          leader: {
            role: 'LEADER',
            name: 'Demo 台北主任',
            employeeNo: 'LDR01',
            validPass: ['leader123', 'staff123'],
            area: '台北',
          },
          staff: {
            role: 'STAFF',
            name: 'Demo 員工',
            employeeNo: 'STAFF01',
            validPass: ['staff123'],
            area: '台北',
          },
        };

        const matchedDemo = demoMap[acc];
        if (matchedDemo && matchedDemo.validPass.includes(pwd)) {
          const demoUser: UserProfile = {
            id: `emp-${acc}`,
            name: matchedDemo.name,
            employeeNo: matchedDemo.employeeNo,
            role: matchedDemo.role,
            permissions: ROLE_PERMISSIONS[matchedDemo.role] || [],
            groupId:
              matchedDemo.role === 'ADMIN' || matchedDemo.role === 'MANAGER'
                ? 'group-001'
                : 'taipei-morning',
            area: matchedDemo.area,
          };
          setToken(`mock-${acc}-token`);
          setUser(demoUser);
          buildPermissions(demoUser.permissions, demoUser.role);
          resetLoginFail();
          message.success(t('auth.loginSuccess'));
          navigate('/dashboard', { replace: true });
          return;
        }

        throw apiErr;
      }
    } catch (err) {
      incrementLoginFail();
      if (loginFailCount + 1 >= 3) {
        refreshCaptcha();
      }
      const serverMsg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      message.error(serverMsg || t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  // 快捷鍵填入並直接登入
  const handleQuickFillAndLogin = (account: string, password: string) => {
    form.setFieldsValue({ account, password });
    handleSubmit({ account, password, rememberMe: false });
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
      <Card
        style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: 12,
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
        }}
      >
        <Space
          direction="vertical"
          size="middle"
          style={{ width: '100%', textAlign: 'center', marginBottom: 20 }}
        >
          {/* Company Logo */}
          <img
            src={`${import.meta.env.BASE_URL}menu_company-logo.png`}
            alt="Ecolab"
            style={{
              display: 'block',
              margin: '0 auto',
              height: 'clamp(27px, 5.3vw, 43px)',
              width: 'auto',
              maxWidth: '80%',
            }}
          />
          <div>
            <Title level={3} style={{ margin: 0, color: '#057EC0' }}>
              {t('app.title')}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('app.subtitle')}
            </Text>
          </div>
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
            label="帳號"
            extra={<span style={{ fontSize: 12, color: '#8c8c8c' }}>帳號為您的員工編號</span>}
            rules={[{ required: true, message: t('auth.accountRequired') }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#005EB8' }} />}
              placeholder="請輸入帳號"
              aria-label={t('auth.accountAriaLabel')}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={t('auth.password')}
            rules={[{ required: true, message: t('auth.passwordRequired') }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#005EB8' }} />}
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

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Form.Item name="rememberMe" valuePropName="checked" noStyle>
              <Checkbox>{t('auth.rememberMe')}</Checkbox>
            </Form.Item>
            <Space size={8}>
              <Button
                type="link"
                size="small"
                onClick={() => setForgotModalOpen(true)}
                style={{ padding: 0, fontSize: 13 }}
              >
                忘記密碼？
              </Button>
            </Space>
          </div>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 44, fontSize: 16, fontWeight: 600 }}
              aria-label={t('auth.login')}
            >
              {t('auth.login')}
            </Button>
          </Form.Item>
        </Form>

        {showCaptcha && (
          <Text type="warning" style={{ display: 'block', textAlign: 'center', marginBottom: 8 }}>
            {t('auth.captchaNotice', { count: loginFailCount })}
          </Text>
        )}

        {/* 快速切換權限角色測試 */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed #e2e8f0' }}>
          <Text
            type="secondary"
            style={{ fontSize: 12, display: 'block', marginBottom: 8, textAlign: 'center' }}
          >
            快速切換權限角色測試（Demo 帳號）
          </Text>
          <Row gutter={[8, 8]} style={{ width: '100%' }}>
            <Col span={12}>
              <Button
                block
                size="small"
                onClick={() => handleQuickFillAndLogin('admin', 'admin123')}
              >
                管理員 (admin)
              </Button>
            </Col>
            <Col span={12}>
              <Button
                block
                size="small"
                onClick={() => handleQuickFillAndLogin('manager', 'manager123')}
              >
                副理 (manager)
              </Button>
            </Col>
            <Col span={12}>
              <Button
                block
                size="small"
                onClick={() => handleQuickFillAndLogin('leader', 'leader123')}
              >
                主任 (leader)
              </Button>
            </Col>
            <Col span={12}>
              <Button
                block
                size="small"
                onClick={() => handleQuickFillAndLogin('staff', 'staff123')}
              >
                員工 (staff)
              </Button>
            </Col>
          </Row>
        </div>
      </Card>
      {/*忘記密碼*/}
      <ForgotPasswordModal open={forgotModalOpen} onClose={() => setForgotModalOpen(false)} />
    </div>
  );
};

export default LoginPage;
