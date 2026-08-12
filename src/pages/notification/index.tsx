import { useCallback, useMemo, useState } from 'react';
import type { FC } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  List,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import BaseModal from '@/components/base/BaseModal';
import {
  useNotificationList,
  useSendNotification,
  useNotificationTemplates,
  useUpdateTemplate,
} from '@/queries/useNotificationQueries';
import { NOTIFICATION_STATUS_MAP } from '@/constants/notificationTypes';
import { isManualSendEnabled, isScheduleReminderDay } from '@/utils/notificationSchedule';
import { formatDateTime } from '@/utils/date';
import type { Notification, NotificationTemplate } from '@/types/notification';
import type { PaginatedResponse } from '@/types/common';

const { TextArea } = Input;
const { Text } = Typography;

const NOTIFICATION_TYPE_KEYS = {
  SCHEDULE_REMINDER: 'notification.types.scheduleReminder',
  CUSTOMER_NOTIFY: 'notification.types.customerNotify',
  EMPLOYEE_DISPATCH: 'notification.types.employeeDispatch',
  CHANGE_APPROVAL: 'notification.types.changeApproval',
  APPROVAL_RESULT: 'notification.types.approvalResult',
} as const;

const NOTIFICATION_STATUS_KEYS = {
  NOTIFIED: 'notification.status.notified',
  NOT_NOTIFIED: 'notification.status.notNotified',
  CHANGED_NOTIFIED: 'notification.status.changedNotified',
  CHANGED_NOT_NOTIFIED: 'notification.status.changedNotNotified',
} as const;

/**
 * 通知管理頁面
 * 整合 BaseTable 顯示通知列表與狀態追蹤，提供每月 20-31 日手動通知發送功能、
 * 通知範本管理（客戶通知/員工派工/變更審批）與每月 15 日排班提醒指示。
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5
 */

const DEFAULT_PARAMS = { page: 1, pageSize: 20 };

/**
 * 行動裝置（< 768px）卡片檢視渲染函式。
 *
 * Validates: Requirements 16.1
 */
function renderNotificationCard(record: Notification, t: (key: string) => string) {
  const statusConfig = NOTIFICATION_STATUS_MAP[record.status];
  return (
    <Card size="small" style={{ marginBottom: 8 }} data-testid={`notification-card-${record.id}`}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <strong>{record.subject}</strong>
          <Tag color={statusConfig.color}>{t(NOTIFICATION_STATUS_KEYS[record.status])}</Tag>
        </Space>
        <span>
          {t(NOTIFICATION_TYPE_KEYS[record.type])} ／ {t('notification.recipient')}：
          {record.recipientName}
        </span>
        <span>{formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm')}</span>
      </Space>
    </Card>
  );
}

/**
 * 通知管理頁面主元件
 * 負責通知列表、範本編輯 Modal 與手動發送邏輯之狀態管理
 */
const NotificationPage: FC = () => {
  const { t } = useTranslation();
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [templateForm] = Form.useForm<Pick<NotificationTemplate, 'subject' | 'content'>>();

  const { data: notificationData } = useNotificationList(DEFAULT_PARAMS);
  const { data: templates = [] } = useNotificationTemplates();
  const sendMutation = useSendNotification();
  const updateTemplateMutation = useUpdateTemplate();

  // Wraps useNotificationList to satisfy BaseTable's queryHook signature
  function useNotificationListQuery(): QueryResult<PaginatedResponse<Notification>> {
    return useNotificationList(DEFAULT_PARAMS) as QueryResult<PaginatedResponse<Notification>>;
  }

  // Requirement 12.2: 手動通知發送功能僅於每月 20-31 日且存在新排班（以目前資料集中
  // 尚有 NOT_NOTIFIED/CHANGED_NOT_NOTIFIED 通知代表有新排班待通知）時啟用。
  const hasPendingNotifications = useMemo(
    () =>
      (notificationData?.list ?? []).some(
        (n) => n.status === 'NOT_NOTIFIED' || n.status === 'CHANGED_NOT_NOTIFIED',
      ),
    [notificationData],
  );
  const manualSendEnabled = isManualSendEnabled(hasPendingNotifications);
  const showScheduleReminder = isScheduleReminderDay();

  const handleManualSend = useCallback(async () => {
    const pending = (notificationData?.list ?? []).filter(
      (n) => n.status === 'NOT_NOTIFIED' || n.status === 'CHANGED_NOT_NOTIFIED',
    );

    if (pending.length === 0) return;

    await Promise.all(
      pending.map((n) =>
        sendMutation.mutateAsync({
          templateId: n.templateId ?? '',
          recipientType: n.recipientType,
          recipientIds: [n.recipientId],
          taskId: n.taskId,
        }),
      ),
    );
    message.success(t('notification.sentMessage'));
  }, [notificationData, sendMutation, t]);

  const handleEditTemplate = useCallback(
    (template: NotificationTemplate) => {
      setEditingTemplate(template);
      templateForm.setFieldsValue({
        subject: template.subject,
        content: template.content,
      });
      setTemplateModalOpen(true);
    },
    [templateForm],
  );

  const handleTemplateModalCancel = useCallback(() => {
    setTemplateModalOpen(false);
    setEditingTemplate(null);
    templateForm.resetFields();
  }, [templateForm]);

  const handleTemplateModalOk = useCallback(async () => {
    if (!editingTemplate) return;
    const values = await templateForm.validateFields();

    await updateTemplateMutation.mutateAsync({
      id: editingTemplate.id,
      data: values,
    });
    message.success(t('notification.templateUpdated'));

    setTemplateModalOpen(false);
    setEditingTemplate(null);
    templateForm.resetFields();
  }, [editingTemplate, templateForm, updateTemplateMutation, t]);

  const columns: ColumnDef<Notification>[] = [
    {
      title: t('notification.type'),
      key: 'type',
      width: 120,
      render: (_value, record) => t(NOTIFICATION_TYPE_KEYS[record.type]),
      exportHeader: t('notification.type'),
      exportKey: (record) => t(NOTIFICATION_TYPE_KEYS[record.type]),
    },
    {
      title: t('notification.recipient'),
      dataIndex: 'recipientName',
      key: 'recipientName',
      width: 120,
      exportHeader: t('notification.recipient'),
      exportKey: 'recipientName',
    },
    {
      title: t('notification.subject'),
      dataIndex: 'subject',
      key: 'subject',
      width: 220,
      ellipsis: true,
      exportHeader: t('notification.subject'),
      exportKey: 'subject',
    },
    {
      title: t('notification.statusLabel'),
      key: 'status',
      width: 140,
      render: (_value, record) => {
        const config = NOTIFICATION_STATUS_MAP[record.status];
        return <Tag color={config.color}>{t(NOTIFICATION_STATUS_KEYS[record.status])}</Tag>;
      },
      exportHeader: t('notification.statusLabel'),
      exportKey: (record) => t(NOTIFICATION_STATUS_KEYS[record.status]),
    },
    {
      title: t('notification.time'),
      key: 'createdAt',
      width: 160,
      render: (_value, record) => formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm'),
      exportHeader: t('notification.time'),
      exportKey: (record) => formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div className="notification-page">
      {showScheduleReminder && (
        <Alert
          type="warning"
          showIcon
          message={t('notification.scheduleReminder')}
          description={t('notification.scheduleReminderDescription')}
          style={{ marginBottom: 16 }}
          data-testid="schedule-reminder-banner"
        />
      )}

      <Tabs
        defaultActiveKey="list"
        items={[
          {
            key: 'list',
            label: t('notification.list'),
            children: (
              <BaseTable<Notification>
                columns={columns}
                queryHook={useNotificationListQuery}
                exportable
                toolbarExtra={
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    disabled={!manualSendEnabled}
                    loading={sendMutation.isPending}
                    onClick={handleManualSend}
                    data-testid="manual-send-button"
                  >
                    {t('notification.manualSend')}
                  </Button>
                }
                cardRender={(record) => renderNotificationCard(record, t)}
                rowKey="id"
              />
            ),
          },
          {
            key: 'templates',
            label: t('notification.templates'),
            children: (
              <List
                dataSource={templates}
                rowKey="id"
                renderItem={(template) => (
                  <List.Item
                    key={template.id}
                    actions={[
                      <Button key="edit" type="link" onClick={() => handleEditTemplate(template)}>
                        {t('common.edit')}
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag>{t(NOTIFICATION_TYPE_KEYS[template.type])}</Tag>
                          <Text strong>{template.name}</Text>
                        </Space>
                      }
                      description={template.subject}
                    />
                  </List.Item>
                )}
              />
            ),
          },
        ]}
      />

      <BaseModal
        title={t('notification.editTemplate')}
        open={templateModalOpen}
        onOk={handleTemplateModalOk}
        onCancel={handleTemplateModalCancel}
        width={600}
      >
        <Form form={templateForm} layout="vertical">
          <Form.Item
            name="subject"
            label={t('notification.subject')}
            rules={[{ required: true, message: t('notification.subjectRequired') }]}
          >
            <Input placeholder={t('notification.subjectPlaceholder')} />
          </Form.Item>
          <Form.Item
            name="content"
            label={t('notification.content')}
            rules={[{ required: true, message: t('notification.contentRequired') }]}
          >
            <TextArea rows={6} placeholder={t('notification.contentPlaceholder')} />
          </Form.Item>
        </Form>
      </BaseModal>
    </div>
  );
};

export default NotificationPage;
