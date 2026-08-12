import { useCallback, useState } from 'react';
import type { FC } from 'react';
import { Button, Card, Form, Input, Space, Tag, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import BaseModal from '@/components/base/BaseModal';
import { useApprovalList, useApproveRequest, useRejectRequest } from '@/queries/useApprovalQueries';
import { useSendNotification } from '@/queries/useNotificationQueries';
import { APPROVAL_TYPE_MAP, APPROVAL_STATUS_MAP } from '@/constants/approvalTypes';
import { POSITION_MAP } from '@/constants/positions';
import { isDualApprovalComplete, markNextPendingApproverApproved } from '@/utils/approvalWorkflow';
import { formatDateTime } from '@/utils/date';
import type { Approval } from '@/types/notification';
import type { PaginatedResponse } from '@/types/common';

const { TextArea } = Input;

/**
 * 審批流程頁面
 *
 * 提供異動審批列表與核准/駁回操作介面：
 * - 排班變更（SCHEDULE_CHANGE）：通知主任與 SO，單一審批人核准即完成（Requirement 13.1）。
 * - 班別變更（SHIFT_CHANGE）：要求主任（DIRECTOR）與經理（MANAGER）雙重審批，兩者皆核准
 *   後才視為整體核准完成（Requirement 13.2，判斷邏輯見 utils/approvalWorkflow.ts 之
 *   isDualApprovalComplete 純函式）。
 * - 審批通過後（單一審批完成，或雙重審批皆完成），自動更新通知主旨並重新發送予客戶
 *   （Requirement 13.3）。由於 Approval 與 Notification 之間並無明確定義之關聯欄位，
 *   此處以 approval.taskId 作為關聯依據（Approval 與 Notification 皆帶有 taskId），並在
 *   主旨前加註「【已核准】」後透過 useSendNotification 重新發送客戶通知。
 *
 * Validates: Requirements 13.1, 13.2, 13.3
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
) {
  const statusConfig = APPROVAL_STATUS_MAP[record.status];
  return (
    <Card size="small" style={{ marginBottom: 8 }} data-testid={`approval-card-${record.id}`}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <strong>{APPROVAL_TYPE_MAP[record.type] ?? record.type}</strong>
          <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
        </Space>
        <span>申請人：{record.requestedByName}</span>
        <span>{formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm')}</span>
        {record.status === 'PENDING' && (
          <Space>
            <Button
              type="link"
              icon={<CheckOutlined />}
              aria-label="核准"
              style={{ padding: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                onApprove(record);
              }}
            >
              核准
            </Button>
            <Button
              type="link"
              danger
              icon={<CloseOutlined />}
              aria-label="駁回"
              style={{ padding: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                onReject(record);
              }}
            >
              駁回
            </Button>
          </Space>
        )}
      </Space>
    </Card>
  );
}

const ApprovalPage: FC = () => {
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
      const typeLabel = APPROVAL_TYPE_MAP[approval.type] ?? approval.type;
      await sendNotificationMutation.mutateAsync({
        templateId: 'approval-result',
        recipientType: 'CUSTOMER',
        recipientIds: [],
        taskId: approval.taskId,
        variables: {
          subject: `【已核准】${typeLabel}審批通過通知`,
        },
      });
    },
    [sendNotificationMutation],
  );

  const handleApprove = useCallback(
    async (record: Approval) => {
      await approveMutation.mutateAsync({ id: record.id });

      // Requirement 13.2：SHIFT_CHANGE 類型需主任與經理雙重審批皆完成才視為整體核准。
      // 由於 approve API 未回傳更新後的審批單，這裡以 markNextPendingApproverApproved
      // 模擬本次核准動作反映在審批人清單上的結果，再交由 isDualApprovalComplete 判斷是否
      // 已達成整體核准，決定是否觸發 Requirement 13.3 之重新通知流程。
      const simulatedApproval = markNextPendingApproverApproved(record);
      if (isDualApprovalComplete(simulatedApproval)) {
        await notifyApprovalResult(record);
      }

      message.success('審批已核准');
    },
    [approveMutation, notifyApprovalResult],
  );

  const handleRejectClick = useCallback((record: Approval) => {
    setRejectingApproval(record);
    setRejectModalOpen(true);
  }, []);

  const handleRejectModalCancel = useCallback(() => {
    setRejectModalOpen(false);
    setRejectingApproval(null);
    rejectForm.resetFields();
  }, [rejectForm]);

  const handleRejectModalOk = useCallback(async () => {
    if (!rejectingApproval) return;
    const values = await rejectForm.validateFields();

    await rejectMutation.mutateAsync({
      id: rejectingApproval.id,
      comment: values.comment,
    });
    message.success('審批已駁回');

    setRejectModalOpen(false);
    setRejectingApproval(null);
    rejectForm.resetFields();
  }, [rejectingApproval, rejectForm, rejectMutation]);

  const columns: ColumnDef<Approval>[] = [
    {
      title: '類型',
      key: 'type',
      width: 100,
      render: (_value, record) => APPROVAL_TYPE_MAP[record.type] ?? record.type,
      exportHeader: '類型',
      exportKey: (record) => APPROVAL_TYPE_MAP[record.type] ?? record.type,
    },
    {
      title: '申請人',
      dataIndex: 'requestedByName',
      key: 'requestedByName',
      width: 100,
      exportHeader: '申請人',
      exportKey: 'requestedByName',
    },
    {
      title: '狀態',
      key: 'status',
      width: 100,
      render: (_value, record) => {
        const config = APPROVAL_STATUS_MAP[record.status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
      exportHeader: '狀態',
      exportKey: (record) => APPROVAL_STATUS_MAP[record.status].label,
    },
    {
      title: '審批人',
      key: 'approvers',
      width: 260,
      render: (_value, record) => (
        <Space size={[4, 4]} wrap>
          {record.approvers.map((step) => {
            const stepStatusConfig =
              step.status === 'APPROVED'
                ? { label: '已核准', color: '#52C41A' }
                : step.status === 'REJECTED'
                  ? { label: '已駁回', color: '#F5222D' }
                  : { label: '待審批', color: '#FAAD14' };
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
      exportHeader: '審批人',
      exportKey: (record) =>
        record.approvers
          .map(
            (step) =>
              `${step.approverName}(${POSITION_MAP[step.role as keyof typeof POSITION_MAP] ?? step.role}):${step.status}`,
          )
          .join(', '),
    },
    {
      title: '建立時間',
      key: 'createdAt',
      width: 160,
      render: (_value, record) => formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm'),
      exportHeader: '建立時間',
      exportKey: (record) => formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
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
              aria-label="核准"
              onClick={(e) => {
                e.stopPropagation();
                void handleApprove(record);
              }}
            >
              核准
            </Button>
            <Button
              type="link"
              danger
              icon={<CloseOutlined />}
              aria-label="駁回"
              onClick={(e) => {
                e.stopPropagation();
                handleRejectClick(record);
              }}
            >
              駁回
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
          renderApprovalCard(record, (r) => void handleApprove(r), handleRejectClick)
        }
        rowKey="id"
      />

      <BaseModal
        title="駁回審批"
        open={rejectModalOpen}
        onOk={handleRejectModalOk}
        onCancel={handleRejectModalCancel}
        width={480}
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="comment"
            label="駁回原因"
            rules={[{ required: true, message: '請輸入駁回原因' }]}
          >
            <TextArea rows={4} placeholder="請輸入駁回原因" />
          </Form.Item>
        </Form>
      </BaseModal>
    </div>
  );
};

export default ApprovalPage;
