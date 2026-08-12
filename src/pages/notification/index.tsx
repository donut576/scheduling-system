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
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import BaseModal from '@/components/base/BaseModal';
import {
  useNotificationList,
  useSendNotification,
  useNotificationTemplates,
  useUpdateTemplate,
} from '@/queries/useNotificationQueries';
import { NOTIFICATION_TYPE_MAP, NOTIFICATION_STATUS_MAP } from '@/constants/notificationTypes';
import { isManualSendEnabled, isScheduleReminderDay } from '@/utils/notificationSchedule';
import { formatDateTime } from '@/utils/date';
import type { Notification, NotificationTemplate } from '@/types/notification';
import type { PaginatedResponse } from '@/types/common';

const { TextArea } = Input;
const { Text } = Typography;

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
function renderNotificationCard(record: Notification) {
  const statusConfig = NOTIFICATION_STATUS_MAP[record.status];
  return (
    <Card size="small" style={{ marginBottom: 8 }} data-testid={`notification-card-${record.id}`}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <strong>{record.subject}</strong>
          <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
        </Space>
        <span>
          {NOTIFICATION_TYPE_MAP[record.type] ?? record.type} ／ 收件者：
          {record.recipientName}
        </span>
        <span>{formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm')}</span>
      </Space>
    </Card>
  );
}

const NotificationPage: FC = () => {
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
    message.success('通知已發送');
  }, [notificationData, sendMutation]);

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
    message.success('通知範本已更新');

    setTemplateModalOpen(false);
    setEditingTemplate(null);
    templateForm.resetFields();
  }, [editingTemplate, templateForm, updateTemplateMutation]);

  const columns: ColumnDef<Notification>[] = [
    {
      title: '類型',
      key: 'type',
      width: 120,
      render: (_value, record) => NOTIFICATION_TYPE_MAP[record.type] ?? record.type,
      exportHeader: '類型',
      exportKey: (record) => NOTIFICATION_TYPE_MAP[record.type] ?? record.type,
    },
    {
      title: '收件者',
      dataIndex: 'recipientName',
      key: 'recipientName',
      width: 120,
      exportHeader: '收件者',
      exportKey: 'recipientName',
    },
    {
      title: '主旨',
      dataIndex: 'subject',
      key: 'subject',
      width: 220,
      ellipsis: true,
      exportHeader: '主旨',
      exportKey: 'subject',
    },
    {
      title: '狀態',
      key: 'status',
      width: 140,
      render: (_value, record) => {
        const config = NOTIFICATION_STATUS_MAP[record.status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
      exportHeader: '狀態',
      exportKey: (record) => NOTIFICATION_STATUS_MAP[record.status].label,
    },
    {
      title: '時間',
      key: 'createdAt',
      width: 160,
      render: (_value, record) => formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm'),
      exportHeader: '時間',
      exportKey: (record) => formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div className="notification-page">
      {showScheduleReminder && (
        <Alert
          type="warning"
          showIcon
          message="排班提醒"
          description="今日為每月 15 日，請各組組長進行下月排班作業。"
          style={{ marginBottom: 16 }}
          data-testid="schedule-reminder-banner"
        />
      )}

      <Tabs
        defaultActiveKey="list"
        items={[
          {
            key: 'list',
            label: '通知列表',
            children: (
              <>
                <Space
                  style={{
                    marginBottom: 16,
                    width: '100%',
                    justifyContent: 'flex-end',
                  }}
                  wrap
                >
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    disabled={!manualSendEnabled}
                    loading={sendMutation.isPending}
                    onClick={handleManualSend}
                    data-testid="manual-send-button"
                  >
                    手動發送通知
                  </Button>
                </Space>

                <BaseTable<Notification>
                  columns={columns}
                  queryHook={useNotificationListQuery}
                  exportable
                  cardRender={renderNotificationCard}
                  rowKey="id"
                />
              </>
            ),
          },
          {
            key: 'templates',
            label: '通知範本管理',
            children: (
              <List
                dataSource={templates}
                rowKey="id"
                renderItem={(template) => (
                  <List.Item
                    key={template.id}
                    actions={[
                      <Button key="edit" type="link" onClick={() => handleEditTemplate(template)}>
                        編輯
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag>{NOTIFICATION_TYPE_MAP[template.type] ?? template.type}</Tag>
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
        title="編輯通知範本"
        open={templateModalOpen}
        onOk={handleTemplateModalOk}
        onCancel={handleTemplateModalCancel}
        width={600}
      >
        <Form form={templateForm} layout="vertical">
          <Form.Item
            name="subject"
            label="主旨"
            rules={[{ required: true, message: '請輸入主旨' }]}
          >
            <Input placeholder="請輸入通知主旨" />
          </Form.Item>
          <Form.Item
            name="content"
            label="內容"
            rules={[{ required: true, message: '請輸入內容' }]}
          >
            <TextArea rows={6} placeholder="請輸入通知內容" />
          </Form.Item>
        </Form>
      </BaseModal>
    </div>
  );
};

export default NotificationPage;
