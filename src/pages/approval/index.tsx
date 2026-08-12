import { useCallback, useState } from 'react';
import type { FC } from 'react';
import { Button, Card, Form, Input, Space, Tag, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import BaseModal from '@/components/base/BaseModal';
import { useApprovalList, useApproveRequest, useRejectRequest } from '@/queries/useApprovalQueries';
import { useSendNotification } from '@/queries/useNotificationQueries';
import { APPROVAL_STATUS_MAP } from '@/constants/approvalTypes';
import { POSITION_MAP } from '@/constants/positions';
import { formatDateTime } from '@/utils/date';
import type { Approval } from '@/types/notification';
import type { PaginatedResponse } from '@/types/common';

const { TextArea } = Input;

const APPROVAL_TYPE_KEYS = {
  SCHEDULE_CHANGE: 'approval.types.scheduleChange',
  SHIFT_CHANGE: 'approval.types.shiftChange',
  ALERT_OVERRIDE: 'approval.types.alertOverride',
} as const;

const APPROVAL_STATUS_KEYS = {
  PENDING: 'approval.status.pending',
  APPROVED: 'approval.status.approved',
  REJECTED: 'approval.status.rejected',
  WITHDRAWN: 'approval.status.withdrawn',
} as const;

/**
 * 審批流程頁面
 *
 * 提供異動審批列表與核准/駁回操作介面：
 * - 所有審批類型（排班變更 SCHEDULE_CHANGE、班別變更 SHIFT_CHANGE、警示覆蓋
 *   ALERT_OVERRIDE）皆為單一審批人核准即完成（Requirement 13.1）。
 * - 審批通過後自動更新通知主旨並重新發送予客戶（Requirement 13.3）。由於 Approval 與
 *   Notification 之間並無明確定義之關聯欄位，此處以 approval.taskId 作為關聯依據
 *   （Approval 與 Notification 皆帶有 taskId），並在主旨前加註「【已核准】」後透過
 *   useSendNotification 重新發送客戶通知。
 *
 * Validates: Requirements 13.1, 13.3
 */

const DEFAULT_PARAMS = { page: 1, pageSize: 20 };

/**
 * 行動裝置（< 768px）卡片檢視渲染函式。
 *
 * Validates: Requirements 16.1
 */
function renderApprovalCard(
  record: Approval,
  onApprove: (record: Approval) => void,
  onReject: (record: Approval) => void,
  t: (key: string) => string,
) {
  const statusConfig = APPROVAL_STATUS_MAP[record.status];
  const typeLabel = t(APPROVAL_TYPE_KEYS[record.type]);
  const statusLabel = t(APPROVAL_STATUS_KEYS[record.status]);
  return (
    <Card size="small" style={{ marginBottom: 8 }} data-testid={`approval-card-${record.id}`}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <strong>{typeLabel}</strong>
          <Tag color={statusConfig.color}>{statusLabel}</Tag>
        </Space>
        <span>
          {t('approval.requester')}：{record.requestedByName}
        </span>
        <span>{formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm')}</span>
        {record.status === 'PENDING' && (
          <Space>
            <Button
              type="link"
              icon={<CheckOutlined />}
              aria-label={t('approval.approve')}
              style={{ padding: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                onApprove(record);
              }}
            >
              {t('approval.approve')}
            </Button>
            <Button
              type="link"
              danger
              icon={<CloseOutlined />}
              aria-label={t('approval.reject')}
              style={{ padding: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                onReject(record);
              }}
            >
              {t('approval.reject')}
            </Button>
          </Space>
        )}
      </Space>
    </Card>
  );
}

/**
 * 審批流程頁面主元件
 * 負責審批列表呈現、核准操作與駁回 Modal 之狀態管理
 */
const ApprovalPage: FC = () => {
  const { t } = useTranslation();
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingApproval, setRejectingApproval] = useState<Approval | null>(null);
  const [rejectForm] = Form.useForm<{ comment: string }>();

  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();
  const sendNotificationMutation = useSendNotification();

  // Wraps useApprovalList to satisfy BaseTable's queryHook signature
  function useApprovalListQuery(): QueryResult<PaginatedResponse<Approval>> {
    return useApprovalList(DEFAULT_PARAMS) as QueryResult<PaginatedResponse<Approval>>;
  }

  /**
   * Requirement 13.3：審批通過後自動更新通知主旨並重新發送予客戶。
   *
   * 以 approval.taskId 關聯原排班任務，重新發送一則以「【已核准】」為主旨前綴的客戶通知，
   * 告知客戶該筆排班變更已完成審批。實際專案中通知範本 ID 與收件人應由後端依 taskId
   * 查詢對應客戶資料決定；此處以合理假設之預設範本 ID 呈現流程串接。
   */
  const notifyApprovalResult = useCallback(
    async (approval: Approval) => {
      const typeLabel = t(APPROVAL_TYPE_KEYS[approval.type]);
      await sendNotificationMutation.mutateAsync({
        templateId: 'approval-result',
        recipientType: 'CUSTOMER',
        recipientIds: [],
        taskId: approval.taskId,
        variables: {
          subject: t('approval.approvedSubject', { type: typeLabel }),
        },
      });
    },
    [sendNotificationMutation, t],
  );

  // 核准審批：呼叫核准 API 後觸發客戶重新通知
  const handleApprove = useCallback(
    async (record: Approval) => {
      await approveMutation.mutateAsync({ id: record.id });
      await notifyApprovalResult(record);
      message.success(t('approval.approvedMessage'));
    },
    [approveMutation, notifyApprovalResult, t],
  );

  // 開啟駁回原因填寫 Modal
  const handleRejectClick = useCallback((record: Approval) => {
    setRejectingApproval(record);
    setRejectModalOpen(true);
  }, []);

  // 取消駁回操作並清空表單
  const handleRejectModalCancel = useCallback(() => {
    setRejectModalOpen(false);
    setRejectingApproval(null);
    rejectForm.resetFields();
  }, [rejectForm]);

  // 送出駁回原因並呼叫駁回 API
  const handleRejectModalOk = useCallback(async () => {
    if (!rejectingApproval) return;
    const values = await rejectForm.validateFields();

    await rejectMutation.mutateAsync({
      id: rejectingApproval.id,
      comment: values.comment,
    });
    message.success(t('approval.rejectedMessage'));

    setRejectModalOpen(false);
    setRejectingApproval(null);
    rejectForm.resetFields();
  }, [rejectingApproval, rejectForm, rejectMutation, t]);

  const columns: ColumnDef<Approval>[] = [
    {
      title: t('approval.type'),
      key: 'type',
      width: 100,
      render: (_value, record) => t(APPROVAL_TYPE_KEYS[record.type]),
      exportHeader: t('approval.type'),
      exportKey: (record) => t(APPROVAL_TYPE_KEYS[record.type]),
    },
    {
      title: t('approval.requester'),
      dataIndex: 'requestedByName',
      key: 'requestedByName',
      width: 100,
      exportHeader: t('approval.requester'),
      exportKey: 'requestedByName',
    },
    {
      title: t('approval.statusLabel'),
      key: 'status',
      width: 100,
      render: (_value, record) => {
        const config = APPROVAL_STATUS_MAP[record.status];
        return <Tag color={config.color}>{t(APPROVAL_STATUS_KEYS[record.status])}</Tag>;
      },
      exportHeader: t('approval.statusLabel'),
      exportKey: (record) => t(APPROVAL_STATUS_KEYS[record.status]),
    },
    {
      title: t('approval.approver'),
      key: 'approvers',
      width: 260,
      render: (_value, record) => (
        <Space size={[4, 4]} wrap>
          {record.approvers.map((step) => {
            const stepStatusConfig =
              step.status === 'APPROVED'
                ? { label: t('approval.status.approved'), color: '#52C41A' }
                : step.status === 'REJECTED'
                  ? { label: t('approval.status.rejected'), color: '#F5222D' }
                  : { label: t('approval.status.pending'), color: '#FAAD14' };
            return (
              <Tag key={step.approverId} color={stepStatusConfig.color}>
                {step.approverName}（
                {POSITION_MAP[step.role as keyof typeof POSITION_MAP] ?? step.role}）
                {stepStatusConfig.label}
              </Tag>
            );
          })}
        </Space>
      ),
      exportHeader: t('approval.approver'),
      exportKey: (record) =>
        record.approvers
          .map(
            (step) =>
              `${step.approverName}(${POSITION_MAP[step.role as keyof typeof POSITION_MAP] ?? step.role}):${step.status}`,
          )
          .join(', '),
    },
    {
      title: t('approval.createdAt'),
      key: 'createdAt',
      width: 160,
      render: (_value, record) => formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm'),
      exportHeader: t('approval.createdAt'),
      exportKey: (record) => formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_value, record) => {
        if (record.status !== 'PENDING') return null;
        return (
          <Space>
            <Button
              type="link"
              icon={<CheckOutlined />}
              aria-label={t('approval.approve')}
              onClick={(e) => {
                e.stopPropagation();
                void handleApprove(record);
              }}
            >
              {t('approval.approve')}
            </Button>
            <Button
              type="link"
              danger
              icon={<CloseOutlined />}
              aria-label={t('approval.reject')}
              onClick={(e) => {
                e.stopPropagation();
                handleRejectClick(record);
              }}
            >
              {t('approval.reject')}
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="approval-page">
      <BaseTable<Approval>
        columns={columns}
        queryHook={useApprovalListQuery}
        exportable
        cardRender={(record) =>
          renderApprovalCard(record, (r) => void handleApprove(r), handleRejectClick, t)
        }
        rowKey="id"
      />

      <BaseModal
        title={t('approval.rejectTitle')}
        open={rejectModalOpen}
        onOk={handleRejectModalOk}
        onCancel={handleRejectModalCancel}
        width={480}
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="comment"
            label={t('approval.rejectReason')}
            rules={[{ required: true, message: t('approval.rejectReasonRequired') }]}
          >
            <TextArea rows={4} placeholder={t('approval.rejectReasonPlaceholder')} />
          </Form.Item>
        </Form>
      </BaseModal>
    </div>
  );
};

export default ApprovalPage;
