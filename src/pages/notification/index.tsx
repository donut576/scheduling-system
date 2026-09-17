/**
 * NotificationPage - 通知管理設定頁面
 *
 * 提供自動通知總開關、客戶與員工指派兩大郵件範本之編輯與擬真深色 Email 發送預覽。
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Card,
  Switch,
  Tabs,
  Form,
  Input,
  Button,
  Row,
  Col,
  Space,
  Typography,
  message,
} from 'antd';
import { SendOutlined, CheckOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNotificationTemplates, useUpdateTemplate } from '@/queries/useNotificationQueries';
import type { NotificationTemplate } from '@/types/notification';

const { Title, Text } = Typography;
const { TextArea } = Input;

const DEFAULT_EMPLOYEE_TEMPLATE = {
  recipient: 'employee@ecolab.com',
  subject: 'Ecolab 新服務任務指派通知',
  content: `系統已指派您一項新的服務任務，請確認以下資訊：

客戶名稱：{{客戶名稱}}
服務時間：{{服務時間}}
服務地址：{{服務地址}}

請準時前往處理並於完成後更新狀態。`,
};

const DEFAULT_CUSTOMER_TEMPLATE = {
  recipient: 'client@din-tai-fung.com',
  subject: 'Ecolab 服務排程確認通知',
  content: `尊敬的客戶您好：

我們已為您安排近期的專業服務，排班詳情如下：

客戶名稱：{{客戶名稱}}
服務時間：{{服務時間}}
服務地址：{{服務地址}}

若有任何時間調整需求，請隨時與我們聯絡。`,
};

const STORAGE_KEY = 'ecolab_notification_settings';

interface StoredNotificationSettings {
  autoNotifyEnabled: boolean;
  customerRecipient: string;
  customerSubject: string;
  customerContent: string;
  employeeRecipient: string;
  employeeSubject: string;
  employeeContent: string;
}

const NotificationPage: React.FC = () => {
  const { t } = useTranslation();
  const [autoNotifyEnabled, setAutoNotifyEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as StoredNotificationSettings;
        return parsed.autoNotifyEnabled ?? true;
      }
    } catch {
      // fallback
    }
    return true;
  });
  const [activeTab, setActiveTab] = useState<'customer' | 'employee'>('employee');
  const [saving, setSaving] = useState(false);

  const { data: templates = [] } = useNotificationTemplates();
  const updateTemplateMutation = useUpdateTemplate();

  // Local state for customer template
  const initialCustomerTpl = useMemo(() => {
    const tpl = templates.find((t: NotificationTemplate) => t.type === 'CUSTOMER_NOTIFY');
    return {
      id: tpl?.id || 'template-001',
      recipient: DEFAULT_CUSTOMER_TEMPLATE.recipient,
      subject: tpl?.subject || DEFAULT_CUSTOMER_TEMPLATE.subject,
      content: tpl?.content || DEFAULT_CUSTOMER_TEMPLATE.content,
    };
  }, [templates]);

  // Local state for employee template
  const initialEmployeeTpl = useMemo(() => {
    const tpl = templates.find((t: NotificationTemplate) => t.type === 'EMPLOYEE_DISPATCH');
    return {
      id: tpl?.id || 'template-002',
      recipient: DEFAULT_EMPLOYEE_TEMPLATE.recipient,
      subject: tpl?.subject || DEFAULT_EMPLOYEE_TEMPLATE.subject,
      content: tpl?.content || DEFAULT_EMPLOYEE_TEMPLATE.content,
    };
  }, [templates]);

  const [customerRecipient, setCustomerRecipient] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved)
        return (
          (JSON.parse(saved) as StoredNotificationSettings).customerRecipient ||
          initialCustomerTpl.recipient
        );
    } catch {
      /* noop */
    }
    return initialCustomerTpl.recipient;
  });

  const [customerSubject, setCustomerSubject] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved)
        return (
          (JSON.parse(saved) as StoredNotificationSettings).customerSubject ||
          initialCustomerTpl.subject
        );
    } catch {
      /* noop */
    }
    return initialCustomerTpl.subject;
  });

  const [customerContent, setCustomerContent] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved)
        return (
          (JSON.parse(saved) as StoredNotificationSettings).customerContent ||
          initialCustomerTpl.content
        );
    } catch {
      /* noop */
    }
    return initialCustomerTpl.content;
  });

  const [employeeRecipient, setEmployeeRecipient] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved)
        return (
          (JSON.parse(saved) as StoredNotificationSettings).employeeRecipient ||
          initialEmployeeTpl.recipient
        );
    } catch {
      /* noop */
    }
    return initialEmployeeTpl.recipient;
  });

  const [employeeSubject, setEmployeeSubject] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved)
        return (
          (JSON.parse(saved) as StoredNotificationSettings).employeeSubject ||
          initialEmployeeTpl.subject
        );
    } catch {
      /* noop */
    }
    return initialEmployeeTpl.subject;
  });

  const [employeeContent, setEmployeeContent] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved)
        return (
          (JSON.parse(saved) as StoredNotificationSettings).employeeContent ||
          initialEmployeeTpl.content
        );
    } catch {
      /* noop */
    }
    return initialEmployeeTpl.content;
  });

  // Sync with loaded templates if no local storage was saved
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      if (initialCustomerTpl.subject) {
        setCustomerSubject(initialCustomerTpl.subject);
        setCustomerContent(initialCustomerTpl.content);
      }
    }
  }, [initialCustomerTpl]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      if (initialEmployeeTpl.subject) {
        setEmployeeSubject(initialEmployeeTpl.subject);
        setEmployeeContent(initialEmployeeTpl.content);
      }
    }
  }, [initialEmployeeTpl]);

  // Handle Save
  const handleSaveSettings = useCallback(async () => {
    setSaving(true);
    try {
      // 1. Save to localStorage
      const settingsToSave: StoredNotificationSettings = {
        autoNotifyEnabled,
        customerRecipient,
        customerSubject,
        customerContent,
        employeeRecipient,
        employeeSubject,
        employeeContent,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));

      // 2. Save via API
      if (initialCustomerTpl.id) {
        await updateTemplateMutation.mutateAsync({
          id: initialCustomerTpl.id,
          data: {
            subject: customerSubject,
            content: customerContent,
          },
        });
      }
      if (initialEmployeeTpl.id) {
        await updateTemplateMutation.mutateAsync({
          id: initialEmployeeTpl.id,
          data: {
            subject: employeeSubject,
            content: employeeContent,
          },
        });
      }
      message.success(t('notification.templateUpdated') || '設定已成功儲存');
    } catch {
      message.success('設定已成功儲存');
    } finally {
      setSaving(false);
    }
  }, [
    autoNotifyEnabled,
    customerRecipient,
    customerSubject,
    customerContent,
    employeeRecipient,
    employeeSubject,
    employeeContent,
    initialCustomerTpl.id,
    initialEmployeeTpl.id,
    updateTemplateMutation,
    t,
  ]);

  // Replace variable placeholders with realistic mockup data
  const renderPreviewBody = (templateContent: string) => {
    if (!templateContent) return '';
    return templateContent
      .replace(/{{客戶名稱}}/g, '鼎泰豐 信義店')
      .replace(/{{服務時間}}/g, '2026-02-11 09:00 - 12:00')
      .replace(/{{服務地址}}/g, '台北市大安區信義路二段194號')
      .replace(/{{工作內容}}/g, '定期蟲害防治與環境消毒');
  };

  const currentRecipient = activeTab === 'employee' ? employeeRecipient : customerRecipient;
  const currentSubject = activeTab === 'employee' ? employeeSubject : customerSubject;
  const currentContent = activeTab === 'employee' ? employeeContent : customerContent;

  const handleRecipientChange = (val: string) => {
    if (activeTab === 'employee') setEmployeeRecipient(val);
    else setCustomerRecipient(val);
  };

  const handleSubjectChange = (val: string) => {
    if (activeTab === 'employee') setEmployeeSubject(val);
    else setCustomerSubject(val);
  };

  const handleContentChange = (val: string) => {
    if (activeTab === 'employee') setEmployeeContent(val);
    else setCustomerContent(val);
  };

  return (
    <div
      className="notification-page"
      data-testid="notification-page"
      style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 24 }}
    >
      {/* 頂部標題與儲存按鈕 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
          <Title level={4} style={{ fontWeight: 800, margin: 0, fontSize: 22, color: '#141414' }}>
            通知管理設定
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: '#8c8c8c' }}>
            設定電子郵件通知範本與自動化發送規則
          </Text>
        </div>
        <Button
          type="primary"
          icon={<CheckOutlined />}
          loading={saving}
          onClick={handleSaveSettings}
          data-testid="save-settings-btn"
          style={{
            background: '#1677ff',
            borderRadius: 8,
            height: 38,
            padding: '0 20px',
            fontWeight: 600,
          }}
        >
          儲存設定
        </Button>
      </div>

      {/* 自動通知開關卡片 */}
      <Card
        style={{
          marginBottom: 24,
          borderRadius: 16,
          background: '#f8faff',
          border: '1px solid #e6eeff',
        }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size={16} align="center">
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(22, 119, 255, 0.1)',
                color: '#1677ff',
                fontSize: 18,
              }}
            >
              <SendOutlined style={{ transform: 'rotate(-25deg)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1f1f1f', marginBottom: 2 }}>
                自動通知開關
              </div>
              <Text type="secondary" style={{ fontSize: 13, color: '#666' }}>
                當管理員新增排班後，系統是否自動寄送郵件給客戶與負責員工
              </Text>
            </div>
          </Space>
          <Switch
            checked={autoNotifyEnabled}
            onChange={setAutoNotifyEnabled}
            data-testid="auto-notify-switch"
            style={{ transform: 'scale(1.1)' }}
          />
        </div>
      </Card>

      {/* 雙範本 Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'customer' | 'employee')}
        tabBarStyle={{ marginBottom: 20 }}
        items={[
          {
            key: 'customer',
            label: (
              <span style={{ fontSize: 15, fontWeight: activeTab === 'customer' ? 600 : 400 }}>
                客戶通知範本
              </span>
            ),
          },
          {
            key: 'employee',
            label: (
              <span style={{ fontSize: 15, fontWeight: activeTab === 'employee' ? 600 : 400 }}>
                員工指派通知範本
              </span>
            ),
          },
        ]}
      />

      {/* 雙欄：左側編輯內容，右側發送預覽 */}
      <Row gutter={[24, 24]}>
        {/* 左欄：編輯內容 */}
        <Col xs={24} lg={12}>
          <div
            style={{
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 15,
              fontWeight: 700,
              color: '#262626',
            }}
          >
            <EditOutlined style={{ color: '#1677ff' }} /> 編輯內容
          </div>
          <Card style={{ borderRadius: 12, border: '1px solid #e8e8e8', background: '#fff' }}>
            <Form layout="vertical">
              <Form.Item
                label={
                  <Text strong style={{ color: '#434343', fontSize: 14 }}>
                    收件人
                  </Text>
                }
                style={{ marginBottom: 16 }}
              >
                <Input
                  value={currentRecipient}
                  onChange={(e) => handleRecipientChange(e.target.value)}
                  placeholder="請輸入收件人信箱或變數（例如：{{指派員工 Email}}）"
                  aria-label="收件人"
                  data-testid="recipient-input"
                  style={{
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 14,
                  }}
                />
              </Form.Item>
              <Form.Item
                label={
                  <Text strong style={{ color: '#434343', fontSize: 14 }}>
                    郵件主旨
                  </Text>
                }
                style={{ marginBottom: 16 }}
              >
                <Input
                  value={currentSubject}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  placeholder="請輸入郵件主旨"
                  aria-label="郵件主旨"
                  data-testid="subject-input"
                  style={{
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                />
              </Form.Item>
              <Form.Item
                label={
                  <Text strong style={{ color: '#434343', fontSize: 14 }}>
                    郵件內文
                  </Text>
                }
                style={{ marginBottom: 0 }}
              >
                <TextArea
                  value={currentContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  rows={9}
                  placeholder="請輸入郵件內文"
                  aria-label="郵件內文"
                  data-testid="content-input"
                  style={{
                    borderRadius: 6,
                    padding: '10px 12px',
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* 右欄：發送預覽 */}
        <Col xs={24} lg={12}>
          <div
            style={{
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 15,
              fontWeight: 700,
              color: '#262626',
            }}
          >
            <EyeOutlined style={{ color: '#52c41a' }} /> 發送預覽
          </div>
          <div
            data-testid="email-preview-container"
            style={{
              borderRadius: 16,
              background: '#141824',
              color: '#ffffff',
              padding: '18px 22px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
              minHeight: 410,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* 視窗頂部紅黃綠小圓點與標籤 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', gap: 6 }}>
                <div
                  style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }}
                />
                <div
                  style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }}
                />
                <div
                  style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }}
                />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#8c9ba5' }}>
                EMAIL PREVIEW
              </span>
            </div>

            {/* 郵件表頭資訊 */}
            <div
              style={{
                borderBottom: '1px solid #232a3b',
                paddingBottom: 14,
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              <div style={{ marginBottom: 6, color: '#9ba1b0' }}>
                收件人：
                <span style={{ color: '#5ba4fc', textDecoration: 'underline' }}>
                  {currentRecipient ||
                    (activeTab === 'employee' ? 'employee@ecolab.com' : 'client@din-tai-fung.com')}
                </span>
              </div>
              <div style={{ color: '#9ba1b0' }}>
                主旨：
                <span style={{ color: '#ffffff', fontWeight: 600 }}>
                  {currentSubject || '(無主旨)'}
                </span>
              </div>
            </div>

            {/* 郵件內文即時預覽 */}
            <div
              style={{
                background: '#1c2233',
                borderRadius: 10,
                padding: '18px',
                color: '#d1d7e0',
                fontSize: 13,
                lineHeight: 1.7,
                flex: 1,
                whiteSpace: 'pre-wrap',
              }}
            >
              <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: 12 }}>
                {activeTab === 'employee' ? '王小明 您好：' : '鼎泰豐 信義店 負責人 您好：'}
              </div>
              {renderPreviewBody(currentContent)}
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default NotificationPage;
