/**
 * NotificationPage - 通知管理設定頁面
 *
 * 提供自動通知總開關、每日合併發送時間、客戶／員工／證照到期三種郵件範本之編輯，
 * 以及擬真深色 Email 發送預覽（每日將新增、修改、取消的異動合併成一封信）。
 *
 * 權限：
 * - notification:send（管理員、副理、主任）可進入頁面並設定每日發送時間
 * - notification:manage_template（管理員、副理）才能編輯範本與總開關；主任唯讀
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Alert,
  Card,
  Switch,
  Tabs,
  Form,
  Input,
  Button,
  Checkbox,
  Row,
  Col,
  Select,
  Space,
  Typography,
  message,
} from 'antd';
import { SendOutlined, CheckOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useNotificationTemplates, useUpdateTemplate } from '@/queries/useNotificationQueries';
import { usePermissionStore } from '@/stores/usePermissionStore';
import type { NotificationTemplate } from '@/types/notification';

const { Title, Text } = Typography;
const { TextArea } = Input;

type TabKey = 'customer' | 'employee' | 'license';

/** 單一範本（客戶或員工）的編輯內容 */
interface TemplateDraft {
  recipient: string;
  subject: string;
  header: string;
  createdBlock: string;
  updatedBlock: string;
  canceledBlock: string;
  /** 證照到期信：每位員工一行 */
  itemBlock: string;
  footer: string;
}

const DEFAULT_DRAFTS: Record<TabKey, TemplateDraft> = {
  customer: {
    recipient: 'client@din-tai-fung.com',
    subject: 'Ecolab 服務異動通知（{{日期}}）',
    header: '{{客戶名稱}} 您好，以下是 {{日期}} 的服務異動：',
    createdBlock: '新增：{{服務時間}}　{{服務地址}}',
    updatedBlock: '修改：{{服務地址}}　{{原時間}} → {{新時間}}',
    canceledBlock: '取消：{{服務時間}}　{{服務地址}}',
    itemBlock: '',
    footer: '若有任何時間調整需求，請隨時與我們聯絡。',
  },
  employee: {
    recipient: 'employee@ecolab.com',
    subject: 'Ecolab 您的排班異動（{{日期}}）',
    header: '{{員工姓名}} 您好，以下是 {{日期}} 的排班異動：',
    createdBlock: '新增：{{客戶名稱}}　{{服務時間}}　{{服務地址}}',
    updatedBlock: '修改：{{客戶名稱}}　{{原時間}} → {{新時間}}',
    canceledBlock: '取消：{{客戶名稱}}　{{服務時間}}',
    itemBlock: '',
    footer: '請準時前往處理並於完成後更新狀態。',
  },
  license: {
    recipient: 'leader@ecolab.com',
    subject: 'Ecolab 證照到期提醒（{{日期}}）',
    header: '{{主任姓名}} 您好，您轄區有下列員工的證照即將到期：',
    createdBlock: '',
    updatedBlock: '',
    canceledBlock: '',
    itemBlock: '{{員工姓名}}　{{證照名稱}}　到期日 {{到期日}}（剩 {{剩餘天數}} 天）',
    footer: '請提醒員工儘早辦理續證。',
  },
};

const TEMPLATE_TYPE: Record<TabKey, NotificationTemplate['type']> = {
  customer: 'CUSTOMER_NOTIFY',
  employee: 'EMPLOYEE_DISPATCH',
  license: 'LICENSE_EXPIRY',
};

const FALLBACK_TEMPLATE_ID: Record<TabKey, string> = {
  customer: 'template-001',
  employee: 'template-002',
  license: 'template-003',
};

const SEND_TIME_OPTIONS = ['08:00', '10:00', '12:00', '14:00', '16:00', '17:00', '18:00'].map(
  (v) => ({ label: v, value: v }),
);

const LICENSE_DAY_OPTIONS = [
  { label: '到期前 30 天', value: 30 },
  { label: '到期前 14 天', value: 14 },
  { label: '到期前 7 天', value: 7 },
];

const STORAGE_KEY = 'ecolab_notification_settings';

/** 目前尚未有後端設定 API，先存在瀏覽器 localStorage */
interface StoredNotificationSettings {
  autoNotifyEnabled: boolean;
  sendTime: string;
  ccBackup: boolean;
  licenseDays: number[];
  recipients: Record<'customer' | 'employee', string>;
}

const loadStoredSettings = (): Partial<StoredNotificationSettings> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as Partial<StoredNotificationSettings>;
  } catch {
    /* noop */
  }
  return {};
};

/** 由 API 範本組出編輯內容；範本沒有分段欄位時使用預設分段 */
const draftFromTemplate = (
  key: TabKey,
  tpl: NotificationTemplate | undefined,
  recipient: string | undefined,
): TemplateDraft => {
  const d = DEFAULT_DRAFTS[key];
  return {
    recipient: recipient || d.recipient,
    subject: tpl?.subject || d.subject,
    header: tpl?.header ?? d.header,
    createdBlock: tpl?.createdBlock ?? d.createdBlock,
    updatedBlock: tpl?.updatedBlock ?? d.updatedBlock,
    canceledBlock: tpl?.canceledBlock ?? d.canceledBlock,
    itemBlock: tpl?.itemBlock ?? d.itemBlock,
    footer: tpl?.footer ?? d.footer,
  };
};

/** 把五段組成純文字內文（相容仍只讀取 content 的舊程式） */
const composeContent = (d: TemplateDraft): string =>
  [d.header, d.createdBlock, d.updatedBlock, d.canceledBlock, d.itemBlock, d.footer]
    .filter(Boolean)
    .join('\n');

/** 以範例資料取代變數，供預覽使用 */
const fillSample = (text: string): string =>
  text
    .replace(/{{客戶名稱}}/g, '鼎泰豐 信義店')
    .replace(/{{員工姓名}}/g, '王小明')
    .replace(/{{日期}}/g, '2026/11/12')
    .replace(/{{服務時間}}/g, '11/15 09:00 - 12:00')
    .replace(/{{服務地址}}/g, '台北市大安區信義路二段194號')
    .replace(/{{原時間}}/g, '11/14 10:00')
    .replace(/{{新時間}}/g, '11/14 14:00')
    .replace(/{{工作內容}}/g, '定期蟲害防治與環境消毒')
    .replace(/{{主任姓名}}/g, '林主任')
    .replace(/{{證照名稱}}/g, '登革熱防治證照')
    .replace(/{{到期日}}/g, '2026/11/26')
    .replace(/{{剩餘天數}}/g, '14');

const NotificationPage: React.FC = () => {
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const canEditTemplate = hasPermission('notification:manage_template');
  const canSetSendTime = hasPermission('notification:send');

  const [stored] = useState(loadStoredSettings);
  const [autoNotifyEnabled, setAutoNotifyEnabled] = useState<boolean>(
    stored.autoNotifyEnabled ?? true,
  );
  const [sendTime, setSendTime] = useState<string>(stored.sendTime ?? '17:00');
  const [ccBackup, setCcBackup] = useState<boolean>(stored.ccBackup ?? true);
  const [licenseDays, setLicenseDays] = useState<number[]>(stored.licenseDays ?? [30, 14, 7]);
  const [activeTab, setActiveTab] = useState<TabKey>('employee');
  const [saving, setSaving] = useState(false);

  const { data: templateData } = useNotificationTemplates();
  // 固定空陣列的參考，避免每次渲染產生新陣列讓 useEffect 無限重跑
  const templates = useMemo(() => templateData ?? [], [templateData]);
  const updateTemplateMutation = useUpdateTemplate();

  const findTemplate = useCallback(
    (key: TabKey) => templates.find((tpl: NotificationTemplate) => tpl.type === TEMPLATE_TYPE[key]),
    [templates],
  );

  const [drafts, setDrafts] = useState<Record<TabKey, TemplateDraft>>(() => ({
    customer: draftFromTemplate('customer', undefined, stored.recipients?.customer),
    employee: draftFromTemplate('employee', undefined, stored.recipients?.employee),
    license: draftFromTemplate('license', undefined, undefined),
  }));

  // 範本載入（或儲存後重新載入）時，更新主旨與各段內容；收件人沿用目前輸入
  useEffect(() => {
    setDrafts((prev) => ({
      customer: draftFromTemplate('customer', findTemplate('customer'), prev.customer.recipient),
      employee: draftFromTemplate('employee', findTemplate('employee'), prev.employee.recipient),
      license: draftFromTemplate('license', findTemplate('license'), undefined),
    }));
  }, [findTemplate]);

  const draft = drafts[activeTab];
  const setField = (field: keyof TemplateDraft, value: string) =>
    setDrafts((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab], [field]: value } }));

  const handleSaveSettings = useCallback(async () => {
    setSaving(true);
    try {
      const settingsToSave: StoredNotificationSettings = {
        autoNotifyEnabled,
        sendTime,
        ccBackup,
        licenseDays,
        recipients: { customer: drafts.customer.recipient, employee: drafts.employee.recipient },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));

      // 只有管理員／副理能改範本；主任儲存時只會存發送時間
      if (canEditTemplate) {
        for (const key of ['customer', 'employee', 'license'] as TabKey[]) {
          const d = drafts[key];
          await updateTemplateMutation.mutateAsync({
            id: findTemplate(key)?.id ?? FALLBACK_TEMPLATE_ID[key],
            data: {
              subject: d.subject,
              content: composeContent(d),
              header: d.header,
              createdBlock: d.createdBlock,
              updatedBlock: d.updatedBlock,
              canceledBlock: d.canceledBlock,
              itemBlock: d.itemBlock,
              footer: d.footer,
            },
          });
        }
      }
      message.success('設定已成功儲存');
    } catch {
      message.error('儲存失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  }, [
    autoNotifyEnabled,
    sendTime,
    ccBackup,
    licenseDays,
    drafts,
    canEditTemplate,
    findTemplate,
    updateTemplateMutation,
  ]);

  const label = (text: string) => (
    <Text strong style={{ color: '#434343', fontSize: 14 }}>
      {text}
    </Text>
  );

  const inputStyle = { borderRadius: 6, padding: '8px 12px', fontSize: 14 };
  const blockPreview = (color: string, title: string, text: string) => (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 10, margin: '8px 0' }}>
      <b style={{ color: '#ffffff' }}>{title}</b>
      {'　'}
      {fillSample(text).replace(/^(新增|修改|取消)：/, '')}
    </div>
  );

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

      {!canEditTemplate && (
        <Alert
          type="info"
          showIcon
          data-testid="template-readonly-alert"
          message="範本由管理員／副理統一維護，您可以預覽範本並設定自己轄區的每日發送時間。"
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
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
                任務新增、修改、取消後，系統每日合併寄送郵件給客戶與負責員工，員工同時會收到站內通知；證照即將到期則自動寄給轄區主任
              </Text>
            </div>
          </Space>
          <Space size={16} align="center">
            <Space size={8} align="center">
              <Text style={{ fontSize: 13, color: '#434343' }}>每日發送時間</Text>
              <Select
                value={sendTime}
                onChange={setSendTime}
                options={SEND_TIME_OPTIONS}
                disabled={!canSetSendTime}
                style={{ width: 96 }}
                aria-label="每日發送時間"
                data-testid="send-time-select"
              />
            </Space>
            <Switch
              checked={autoNotifyEnabled}
              onChange={setAutoNotifyEnabled}
              disabled={!canEditTemplate}
              data-testid="auto-notify-switch"
              style={{ transform: 'scale(1.1)' }}
            />
          </Space>
        </div>
      </Card>

      {/* 雙範本 Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as TabKey)}
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
          {
            key: 'license',
            label: (
              <span style={{ fontSize: 15, fontWeight: activeTab === 'license' ? 600 : 400 }}>
                證照到期通知範本
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
                label={label(
                  activeTab === 'license'
                    ? '收件人（依員工所屬轄區，自動寄給該轄區主任）'
                    : '收件人',
                )}
                style={{ marginBottom: 16 }}
              >
                <Input
                  value={draft.recipient}
                  onChange={(e) => setField('recipient', e.target.value)}
                  placeholder="請輸入收件人信箱或變數（例如：{{指派員工 Email}}）"
                  aria-label="收件人"
                  data-testid="recipient-input"
                  disabled={!canEditTemplate || activeTab === 'license'}
                  style={inputStyle}
                />
              </Form.Item>
              {activeTab === 'customer' && (
                <Form.Item style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    {label('副本（CC）給備用聯絡人')}
                    <Switch
                      checked={ccBackup}
                      onChange={setCcBackup}
                      disabled={!canEditTemplate}
                      data-testid="cc-backup-switch"
                    />
                  </div>
                </Form.Item>
              )}
              <Form.Item label={label('郵件主旨')} style={{ marginBottom: 16 }}>
                <Input
                  value={draft.subject}
                  onChange={(e) => setField('subject', e.target.value)}
                  placeholder="請輸入郵件主旨"
                  aria-label="郵件主旨"
                  data-testid="subject-input"
                  disabled={!canEditTemplate}
                  style={{ ...inputStyle, fontWeight: 600 }}
                />
              </Form.Item>
              <Form.Item label={label('郵件開頭')} style={{ marginBottom: 16 }}>
                <Input
                  value={draft.header}
                  onChange={(e) => setField('header', e.target.value)}
                  aria-label="郵件開頭"
                  data-testid="header-input"
                  disabled={!canEditTemplate}
                  style={inputStyle}
                />
              </Form.Item>
              {activeTab !== 'license' && (
                <>
                  <Form.Item label={label('新增任務（每筆）')} style={{ marginBottom: 16 }}>
                    <TextArea
                      value={draft.createdBlock}
                      onChange={(e) => setField('createdBlock', e.target.value)}
                      rows={2}
                      aria-label="新增任務"
                      data-testid="created-input"
                      disabled={!canEditTemplate}
                      style={inputStyle}
                    />
                  </Form.Item>
                  <Form.Item label={label('修改任務（每筆）')} style={{ marginBottom: 16 }}>
                    <TextArea
                      value={draft.updatedBlock}
                      onChange={(e) => setField('updatedBlock', e.target.value)}
                      rows={2}
                      aria-label="修改任務"
                      data-testid="updated-input"
                      disabled={!canEditTemplate}
                      style={inputStyle}
                    />
                  </Form.Item>
                  <Form.Item label={label('取消任務（每筆）')} style={{ marginBottom: 16 }}>
                    <TextArea
                      value={draft.canceledBlock}
                      onChange={(e) => setField('canceledBlock', e.target.value)}
                      rows={2}
                      aria-label="取消任務"
                      data-testid="canceled-input"
                      disabled={!canEditTemplate}
                      style={inputStyle}
                    />
                  </Form.Item>
                </>
              )}
              {activeTab === 'license' && (
                <>
                  <Form.Item label={label('每位員工證照（每筆）')} style={{ marginBottom: 16 }}>
                    <TextArea
                      value={draft.itemBlock}
                      onChange={(e) => setField('itemBlock', e.target.value)}
                      rows={2}
                      aria-label="每位員工證照"
                      data-testid="license-item-input"
                      disabled={!canEditTemplate}
                      style={inputStyle}
                    />
                  </Form.Item>
                  <Form.Item label={label('提前提醒天數')} style={{ marginBottom: 16 }}>
                    <Checkbox.Group
                      options={LICENSE_DAY_OPTIONS}
                      value={licenseDays}
                      onChange={(v) => setLicenseDays(v as number[])}
                      disabled={!canEditTemplate}
                      data-testid="license-days"
                    />
                  </Form.Item>
                </>
              )}
              <Form.Item label={label('郵件結尾')} style={{ marginBottom: 8 }}>
                <TextArea
                  value={draft.footer}
                  onChange={(e) => setField('footer', e.target.value)}
                  rows={2}
                  aria-label="郵件結尾"
                  data-testid="footer-input"
                  disabled={!canEditTemplate}
                  style={inputStyle}
                />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 12 }}>
                可用變數：
                {activeTab === 'license'
                  ? '{{主任姓名}} {{員工姓名}} {{證照名稱}} {{到期日}} {{剩餘天數}} {{日期}}'
                  : '{{客戶名稱}} {{員工姓名}} {{日期}} {{服務時間}} {{服務地址}} {{原時間}} {{新時間}}'}
              </Text>
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
                  {draft.recipient || DEFAULT_DRAFTS[activeTab].recipient}
                </span>
              </div>
              {activeTab === 'customer' && ccBackup && (
                <div style={{ marginBottom: 6, color: '#9ba1b0' }} data-testid="preview-cc">
                  副本：
                  <span style={{ color: '#5ba4fc', textDecoration: 'underline' }}>
                    backup@din-tai-fung.com
                  </span>
                </div>
              )}
              <div style={{ color: '#9ba1b0' }}>
                主旨：
                <span style={{ color: '#ffffff', fontWeight: 600 }}>
                  {fillSample(draft.subject) || '(無主旨)'}
                </span>
              </div>
            </div>

            {/* 郵件內文即時預覽（範例：同一天有新增、修改、取消各一筆） */}
            <div
              style={{
                background: '#1c2233',
                borderRadius: 10,
                padding: '18px',
                color: '#d1d7e0',
                fontSize: 13,
                lineHeight: 1.7,
                flex: 1,
              }}
            >
              <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: 8 }}>
                {fillSample(draft.header)}
              </div>
              {activeTab === 'license' ? (
                <>
                  <div
                    style={{ borderLeft: '3px solid #faad14', paddingLeft: 10, margin: '8px 0' }}
                  >
                    {fillSample(draft.itemBlock)}
                  </div>
                  <div
                    style={{ borderLeft: '3px solid #ff4d4f', paddingLeft: 10, margin: '8px 0' }}
                  >
                    {fillSample(draft.itemBlock)
                      .replace('登革熱防治證照', '有害生物防治員')
                      .replace('2026/11/26', '2026/11/19')
                      .replace('剩 14 天', '剩 7 天')}
                  </div>
                </>
              ) : (
                <>
                  {blockPreview('#52c41a', '新增', draft.createdBlock)}
                  {blockPreview('#faad14', '修改', draft.updatedBlock)}
                  {blockPreview('#ff4d4f', '取消', draft.canceledBlock)}
                </>
              )}
              <div style={{ marginTop: 12 }}>{fillSample(draft.footer)}</div>
            </div>
            <Text style={{ color: '#8c9ba5', fontSize: 12, marginTop: 10 }}>
              {activeTab === 'license'
                ? '預覽顯示一封信列出 2 位員工的範例；系統每天檢查一次，符合提醒天數的證照合併成一封寄給轄區主任（同一張證照同一個天數只寄一次）。'
                : '預覽顯示當天新增、修改、取消各一筆的範例；實際信件只會出現當天有發生的區塊。'}
            </Text>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default NotificationPage;
