import { useState, useCallback } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Checkbox,
  message,
  Space,
  Modal,
  Alert,
  Row,
  Col,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  CustomerServiceOutlined,
  KeyOutlined,
  MailOutlined,
} from '@ant-design/icons';
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
 * 提供帳號密碼登入表單、快速切換角色、忘記密碼、首次登入設定密碼與 IT Support 支援說明。
 */
const LoginPage: FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form] = Form.useForm<LoginFormValues>();
  const [loading, setLoading] = useState(false);
  const [captchaUrl, setCaptchaUrl] = useState<string>('');

  // 忘記密碼與首次登入彈窗
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [firstLoginModalOpen, setFirstLoginModalOpen] = useState(false);
  const [forgotForm] = Form.useForm();
  const [firstLoginForm] = Form.useForm();

  const { loginFailCount, setToken, setUser, incrementLoginFail, resetLoginFail } = useUserStore();
  const { buildPermissions } = usePermissionStore();

  // 連續登入失敗達 3 次以上才顯示驗證碼欄位
  const showCaptcha = loginFailCount >= 3;

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

      const loginResponse = await authApi.login(credentials);
      const { accessToken, user } = loginResponse.data.data;

      setToken(accessToken);
      setUser(user);
      buildPermissions(user.permissions, user.role);
      resetLoginFail();

      message.success(t('auth.loginSuccess'));
      navigate('/dashboard', { replace: true });
    } catch {
      incrementLoginFail();
      if (loginFailCount + 1 >= 3) {
        refreshCaptcha();
      }
      message.error(t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  // 忘記密碼送出
  const handleForgotSubmit = async () => {
    try {
      const values = await forgotForm.validateFields();
      message.success(
        `重設密碼驗證信已發送至與員工編號【${values.employeeNo}】綁定之信箱，請至信箱收取驗證連結！`,
      );
      setForgotModalOpen(false);
      forgotForm.resetFields();
    } catch {
      // Form validation failed
    }
  };

  // 首次登入設定密碼送出
  const handleFirstLoginSubmit = async () => {
    try {
      const values = await firstLoginForm.validateFields();
      form.setFieldsValue({ account: values.employeeNo, password: values.newPassword });
      message.success('密碼設定成功！已為您自動帶入新密碼，請點擊登入。');
      setFirstLoginModalOpen(false);
      firstLoginForm.resetFields();
    } catch {
      // Form validation failed
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
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto',
              borderRadius: '50%',
              background: '#005EB8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 94, 184, 0.3)',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>E</Text>
          </div>
          <div>
            <Title level={3} style={{ margin: 0, color: '#005EB8' }}>
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
            label="員工編號 / 登入帳號"
            rules={[{ required: true, message: t('auth.accountRequired') }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#005EB8' }} />}
              placeholder="請輸入員工編號（例如：staff、admin、E001）"
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
                onClick={() => setFirstLoginModalOpen(true)}
                style={{ padding: 0, fontSize: 13 }}
              >
                首次登入？
              </Button>
              <Text type="secondary">|</Text>
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
                onClick={() => form.setFieldsValue({ account: 'admin', password: 'admin123' })}
              >
                管理員 (admin)
              </Button>
            </Col>
            <Col span={12}>
              <Button
                block
                size="small"
                onClick={() => form.setFieldsValue({ account: 'manager', password: 'manager123' })}
              >
                經理 (manager)
              </Button>
            </Col>
            <Col span={12}>
              <Button
                block
                size="small"
                onClick={() => form.setFieldsValue({ account: 'leader', password: 'leader123' })}
              >
                組長 (leader)
              </Button>
            </Col>
            <Col span={12}>
              <Button
                block
                size="small"
                onClick={() => form.setFieldsValue({ account: 'staff', password: 'staff123' })}
              >
                員工 (staff)
              </Button>
            </Col>
          </Row>
        </div>

        {/* IT Support 支援提示區塊 */}
        <div
          style={{
            marginTop: 16,
            padding: '10px 14px',
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
          }}
        >
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Text strong style={{ fontSize: 12, color: '#334155' }}>
              <CustomerServiceOutlined style={{ marginRight: 6, color: '#005EB8' }} />
              聯絡系統管理員（IT Support）
            </Text>
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6, marginTop: 2 }}>
              <div>
                • <strong>IT 服務專線</strong>：內線 <code>#8888</code>（外線 02-2345-6789）
              </div>
              <div>
                • <strong>支援信箱</strong>：<code>it-support@ecolab.com</code>
              </div>
              <div>• 若帳號遭鎖定、忘記員工編號或離職異動，請洽 IT 處協助。</div>
            </div>
          </Space>
        </div>
      </Card>

      {/* 忘記密碼彈窗 */}
      <Modal
        title={
          <Space>
            <MailOutlined style={{ color: '#005EB8' }} />
            <span>忘記密碼 / 密碼重設申請</span>
          </Space>
        }
        open={forgotModalOpen}
        onOk={handleForgotSubmit}
        onCancel={() => setForgotModalOpen(false)}
        okText="發送重設驗證信"
        cancelText="取消"
        width={420}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="重設密碼說明"
          description="請輸入您的「員工編號」或「公司電子信箱」，系統將自動寄發密碼重設連結至您留存的公司信箱中。"
        />
        <Form form={forgotForm} layout="vertical">
          <Form.Item
            name="employeeNo"
            label="員工編號 / 電子信箱"
            rules={[{ required: true, message: '請輸入員工編號或公司信箱' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="例如：STAFF01 或 user@ecolab.com" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 首次登入設定密碼彈窗 */}
      <Modal
        title={
          <Space>
            <KeyOutlined style={{ color: '#52c41a' }} />
            <span>首次登入啟用與設定密碼</span>
          </Space>
        }
        open={firstLoginModalOpen}
        onOk={handleFirstLoginSubmit}
        onCancel={() => setFirstLoginModalOpen(false)}
        okText="確認設定並登入"
        cancelText="取消"
        width={440}
      >
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="新進員工帳號開通"
          description={
            <div>
              新進員工預設初始密碼為 <code>Ecolab1234</code>
              。為確保帳號安全，首次登入請設定您的個人專屬密碼。
            </div>
          }
        />
        <Form form={firstLoginForm} layout="vertical">
          <Form.Item
            name="employeeNo"
            label="員工編號"
            rules={[{ required: true, message: '請輸入員工編號' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="例如：STAFF01、E001" />
          </Form.Item>
          <Form.Item
            name="initialPassword"
            label="預設初始密碼"
            initialValue="Ecolab1234"
            rules={[{ required: true, message: '請輸入預設初始密碼' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="預設為 Ecolab1234" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="設定新密碼"
            rules={[
              { required: true, message: '請輸入新密碼' },
              { min: 6, message: '密碼長度至少需 6 個字元' },
            ]}
          >
            <Input.Password prefix={<KeyOutlined />} placeholder="請輸入至少 6 位英數新密碼" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="確認新密碼"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '請再次輸入新密碼' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('兩次輸入的新密碼不一致！'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<KeyOutlined />} placeholder="請再次輸入新密碼" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LoginPage;
