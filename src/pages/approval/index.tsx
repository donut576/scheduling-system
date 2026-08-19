import { useCallback, useMemo, useState } from 'react';
import type { FC } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Dropdown,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
  EyeOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import BaseSearchForm, { type SearchFieldConfig } from '@/components/base/BaseSearchForm';
import {
  useApprovalList,
  useApproveRequest,
  useRejectRequest,
  useWithdrawRequest,
} from '@/queries/useApprovalQueries';
import { useSendNotification } from '@/queries/useNotificationQueries';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { useUserStore } from '@/stores/useUserStore';
import type { ApprovalListParams } from '@/api/approval';
import { APPROVAL_STATUS_MAP, APPROVAL_TYPE_MAP } from '@/constants/approvalTypes';
import { formatDateTime } from '@/utils/date';
import type { Approval } from '@/types/notification';
import type { PaginatedResponse } from '@/types/common';

const { TextArea } = Input;
const { Text } = Typography;

const APPROVAL_STATUS_KEYS: Record<string, string> = {
  PENDING: 'approval.status.pending',
  APPROVED: 'approval.status.approved',
  REJECTED: 'approval.status.rejected',
  WITHDRAWN: 'approval.status.withdrawn',
};

const APPROVAL_TYPE_OPTIONS = [
  { label: '任務變更', value: 'TASK_CHANGE' },
  { label: '警示覆蓋', value: 'ALERT_OVERRIDE' },
];

const APPROVAL_STATUS_OPTIONS = [
  { label: '待核准', value: 'PENDING' },
  { label: '已核准', value: 'APPROVED' },
  { label: '已駁回', value: 'REJECTED' },
  { label: '已撤回', value: 'WITHDRAWN' },
];

const DEFAULT_PARAMS: ApprovalListParams = { page: 1, pageSize: 20 };

/** 格式化變更差異數值，將英文代碼（如 BED_BUG、TERMITE）轉為中文名稱 */
const formatDiffValue = (val: string | number | null | undefined): string => {
  if (val == null || val === '') return '(無)';
  const str = String(val);
  return str
    .replace(/BED_BUG/g, '臭蟲')
    .replace(/TERMITE/g, '白蟻')
    .replace(/FIRE_ANT/g, '火蟻')
    .replace(/VEHICLE_MAINTENANCE/g, '車輛保養')
    .replace(/TRAINING_MEETING/g, '培訓')
    .replace(/TRAINING/g, '培訓')
    .replace(/CONTRACT/g, '合約')
    .replace(/ONETIME/g, '單次');
};

/** 欄位標題內嵌篩選下拉選單通用元件 */
interface ColumnFilterTitleProps {
  label: string;
  active?: boolean;
  children: React.ReactNode;
}

function ColumnFilterTitle({ label, active, children }: ColumnFilterTitleProps) {
  return (
    <Space size={4} onClick={(e) => e.stopPropagation()}>
      <span>{label}</span>
      <Dropdown
        trigger={['click']}
        popupRender={() => (
          <div
            style={{
              padding: 8,
              background: '#fff',
              borderRadius: 6,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        )}
      >
        <Button
          type={active ? 'primary' : 'text'}
          size="small"
          icon={<DownOutlined />}
          aria-label={`${label} filter`}
          onClick={(e) => e.stopPropagation()}
        />
      </Dropdown>
    </Space>
  );
}

/**
 * 行動裝置（< 768px）卡片檢視渲染函式。
 */
function renderApprovalCard(
  record: Approval,
  onViewDiff: (record: Approval) => void,
  onWithdraw: (record: Approval) => void,
  t: (key: string) => string,
  isLeader = false,
) {
  const statusConfig = APPROVAL_STATUS_MAP[record.status] ?? {
    label: record.status,
    color: 'default',
  };
  const isTaskChange =
    record.type === 'TASK_CHANGE' ||
    record.type === 'SCHEDULE_CHANGE' ||
    record.type === 'SHIFT_CHANGE';
  const typeLabel = isTaskChange ? '任務變更' : '警示覆蓋';
  const statusLabel = t(APPROVAL_STATUS_KEYS[record.status] || record.status);

  return (
    <Card
      size="small"
      style={{ marginBottom: 8, cursor: 'pointer' }}
      data-testid={`approval-card-${record.id}`}
      onClick={() => onViewDiff(record)}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space>
            {record.status === 'PENDING' && (
              <Button
                type="text"
                danger
                size="small"
                icon={<CloseOutlined style={{ fontSize: 12 }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onWithdraw(record);
                }}
                aria-label="撤回申請"
                title="撤回申請"
                style={{ width: 22, height: 22, padding: 0 }}
              />
            )}
            <Tag color="geekblue">{record.id}</Tag>
            <Tag color={statusConfig.color}>{statusLabel}</Tag>
          </Space>
          <Tag color={isTaskChange ? 'blue' : 'gold'}>{typeLabel}</Tag>
        </Space>
        {!isLeader && (
          <span>
            {t('approval.requester')}：<strong>{record.requestedByName}</strong>
          </span>
        )}
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>
          建立時間：{formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm')}
        </span>
        <div style={{ marginTop: 4 }}>
          <Button
            type="link"
            icon={<EyeOutlined />}
            size="small"
            style={{ padding: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onViewDiff(record);
            }}
          >
            {t('approval.viewDiff')}
          </Button>
        </div>
      </Space>
    </Card>
  );
}

/**
 * 異動核准頁面主元件
 * 主管（Admin / Manager）：審核全體申請並進行核准/駁回
 * 組長（Leader）：追蹤自己提出之申請單審核狀態（隱藏申請人欄位，僅顯示本人提出項目）
 */
const ApprovalPage: FC = () => {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const canApprove = usePermissionStore((state) => state.hasPermission('approval:approve'));
  const isLeader = !canApprove;

  const defaultLeaderFilter = useMemo(() => {
    if (isLeader && user?.name) return user.name;
    if (isLeader && user?.id) return user.id;
    return undefined;
  }, [isLeader, user?.id, user?.name]);

  const [filters, setFilters] = useState<ApprovalListParams>({
    ...DEFAULT_PARAMS,
    requestedBy: defaultLeaderFilter,
  });

  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approvingApproval, setApprovingApproval] = useState<Approval | null>(null);
  const [approveForm] = Form.useForm<{ comment: string }>();

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingApproval, setRejectingApproval] = useState<Approval | null>(null);
  const [rejectForm] = Form.useForm<{ comment: string }>();

  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();
  const withdrawMutation = useWithdrawRequest();
  const sendNotificationMutation = useSendNotification();

  // 撤回申請確認
  const handleWithdrawClick = useCallback(
    (record: Approval) => {
      Modal.confirm({
        title: '撤回確認',
        content: `確定要撤回申請單【${record.id}】嗎？撤回後狀態將變更為「已撤回」。`,
        okText: '確認撤回',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: async () => {
          await withdrawMutation.mutateAsync({ id: record.id });
          message.success('申請單已成功撤回');
          if (selectedApproval?.id === record.id) {
            setDiffModalOpen(false);
            setSelectedApproval(null);
          }
        },
      });
    },
    [withdrawMutation, selectedApproval],
  );

  function useApprovalListQuery(): QueryResult<PaginatedResponse<Approval>> {
    return useApprovalList(filters) as QueryResult<PaginatedResponse<Approval>>;
  }

  const handleTypeFilter = useCallback((type?: string) => {
    setFilters((prev) => ({ ...prev, type, page: 1 }));
  }, []);

  const handleStatusFilter = useCallback((status?: string) => {
    setFilters((prev) => ({ ...prev, status, page: 1 }));
  }, []);

  const localizedSearchFields: SearchFieldConfig[] = useMemo(
    () => [
      {
        name: 'keyword',
        label: t('common.keyword'),
        type: 'input',
        placeholder: isLeader ? '輸入申請單編號' : '輸入申請單編號或申請人',
      },
    ],
    [isLeader, t],
  );

  const handleSearch = useCallback((values: Record<string, unknown>) => {
    const kw = typeof values.keyword === 'string' ? values.keyword.trim() : undefined;
    setFilters((prev) => ({ ...prev, keyword: kw || undefined, page: 1 }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_PARAMS, requestedBy: defaultLeaderFilter });
  }, [defaultLeaderFilter]);

  const notifyApprovalResult = useCallback(
    (approval: Approval, approved: boolean, comment?: string) => {
      const actionText = approved ? '核准通過' : '已駁回';
      const subject = approved
        ? `【已核准】Ecolab 審批通知 - 您的${
            APPROVAL_TYPE_MAP[approval.type] || '變更'
          }申請單（${approval.id}）核准通過`
        : `【已駁回】Ecolab 審批通知 - 您的${
            APPROVAL_TYPE_MAP[approval.type] || '變更'
          }申請單（${approval.id}）已駁回`;
      const content = `申請人 您好：\n\n您的${
        APPROVAL_TYPE_MAP[approval.type] || '變更'
      }申請單【${approval.id}】已由主管完成審批。\n審核結果：${actionText}\n${
        comment ? `審批說明：${comment}\n` : ''
      }\n感謝您的配合。`;

      const payload = {
        templateId: 'approval-result',
        recipientType: 'EMPLOYEE' as const,
        recipientIds: [approval.requestedBy],
        taskId: approval.taskId,
        variables: { subject, content },
      };

      if (sendNotificationMutation.mutateAsync) {
        sendNotificationMutation.mutateAsync(payload);
      } else if (sendNotificationMutation.mutate) {
        sendNotificationMutation.mutate(payload);
      }
    },
    [sendNotificationMutation],
  );

  const handleViewDiff = useCallback((record: Approval) => {
    setSelectedApproval(record);
    setDiffModalOpen(true);
  }, []);

  const handleCloseDiffModal = useCallback(() => {
    setDiffModalOpen(false);
    setSelectedApproval(null);
  }, []);

  const handleApproveClick = useCallback(
    (record: Approval) => {
      setApprovingApproval(record);
      approveForm.resetFields();
      setApproveModalOpen(true);
    },
    [approveForm],
  );

  const handleApproveCancel = useCallback(() => {
    setApproveModalOpen(false);
    setApprovingApproval(null);
    approveForm.resetFields();
  }, [approveForm]);

  const handleApproveOk = useCallback(async () => {
    if (!approvingApproval) return;
    const values = approveForm.getFieldsValue();

    await approveMutation.mutateAsync({
      id: approvingApproval.id,
      comment: values.comment,
    });
    message.success(t('approval.approvedMessage'));

    notifyApprovalResult(approvingApproval, true, values.comment);

    setApproveModalOpen(false);
    setApprovingApproval(null);
    approveForm.resetFields();
    setDiffModalOpen(false);
    setSelectedApproval(null);
  }, [approvingApproval, approveForm, approveMutation, notifyApprovalResult, t]);

  const handleRejectClick = useCallback(
    (record: Approval) => {
      setRejectingApproval(record);
      rejectForm.resetFields();
      setRejectModalOpen(true);
    },
    [rejectForm],
  );

  const handleRejectCancel = useCallback(() => {
    setRejectModalOpen(false);
    setRejectingApproval(null);
    rejectForm.resetFields();
  }, [rejectForm]);

  const handleRejectOk = useCallback(async () => {
    if (!rejectingApproval) return;
    let values: { comment: string };
    try {
      values = await rejectForm.validateFields();
    } catch {
      return;
    }

    await rejectMutation.mutateAsync({
      id: rejectingApproval.id,
      comment: values.comment,
    });
    message.success(t('approval.rejectedMessage'));

    notifyApprovalResult(rejectingApproval, false, values.comment);

    setRejectModalOpen(false);
    setRejectingApproval(null);
    rejectForm.resetFields();
    setDiffModalOpen(false);
    setSelectedApproval(null);
  }, [rejectingApproval, rejectForm, rejectMutation, notifyApprovalResult, t]);

  const columns: ColumnDef<Approval>[] = [
    {
      title: '申請單編號',
      dataIndex: 'id',
      key: 'id',
      width: 170,
      render: (value, record) => (
        <Space size={6} align="center">
          {record.status === 'PENDING' && (
            <Button
              type="text"
              danger
              size="small"
              className="approval-row-withdraw-btn"
              icon={<CloseOutlined style={{ fontSize: 13 }} />}
              onClick={(e) => {
                e.stopPropagation();
                handleWithdrawClick(record);
              }}
              aria-label="撤回申請"
              title="撤回申請"
              style={{ width: 24, height: 24, padding: 0 }}
            />
          )}
          <Tag color="geekblue">{value as string}</Tag>
        </Space>
      ),
    },
    {
      title: (
        <ColumnFilterTitle label={t('approval.statusLabel')} active={!!filters.status}>
          <Select
            placeholder="請選擇狀態"
            style={{ width: 130 }}
            allowClear
            value={filters.status}
            onChange={(val) => handleStatusFilter(val ?? undefined)}
            options={APPROVAL_STATUS_OPTIONS}
          />
        </ColumnFilterTitle>
      ),
      key: 'status',
      width: 110,
      render: (_value, record) => {
        const config = APPROVAL_STATUS_MAP[record.status] ?? {
          label: record.status,
          color: 'default',
        };
        return (
          <Tag color={config.color}>{t(APPROVAL_STATUS_KEYS[record.status] || record.status)}</Tag>
        );
      },
    },
    {
      title: (
        <ColumnFilterTitle label={t('approval.type')} active={!!filters.type}>
          <Select
            placeholder="請選擇類型"
            style={{ width: 130 }}
            allowClear
            value={filters.type}
            onChange={(val) => handleTypeFilter(val ?? undefined)}
            options={APPROVAL_TYPE_OPTIONS}
          />
        </ColumnFilterTitle>
      ),
      key: 'type',
      width: 130,
      render: (_value, record) => {
        const isTaskChange = record.type !== 'ALERT_OVERRIDE';
        const label = APPROVAL_TYPE_MAP[record.type] || '任務變更';
        return <Tag color={isTaskChange ? 'blue' : 'gold'}>{label}</Tag>;
      },
    },
    {
      title: t('approval.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (_value, record) => formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm'),
    },
    ...(!isLeader
      ? [
          {
            title: t('approval.requester'),
            dataIndex: 'requestedByName',
            key: 'requestedByName',
            width: 120,
          },
        ]
      : []),
    {
      title: t('approval.actions'),
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_value, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          size="small"
          style={{ padding: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            handleViewDiff(record);
          }}
        >
          {t('approval.viewDiff')}
        </Button>
      ),
    },
  ];

  return (
    <div className="approval-page">
      <BaseSearchForm
        fields={localizedSearchFields}
        onSearch={handleSearch}
        onReset={handleResetFilters}
      />

      <BaseTable<Approval>
        columns={columns}
        queryHook={useApprovalListQuery}
        exportable={false}
        emptyText="最近無申請紀錄"
        onRowClick={handleViewDiff}
        cardRender={(record) =>
          renderApprovalCard(record, handleViewDiff, handleWithdrawClick, t, isLeader)
        }
        rowKey="id"
      />

      <Modal
        title={
          <Space>
            <EyeOutlined />
            <span>{t('approval.diffTitle')}</span>
          </Space>
        }
        open={diffModalOpen}
        onCancel={handleCloseDiffModal}
        width={650}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {selectedApproval?.status === 'PENDING' && canApprove && (
              <>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => {
                    if (selectedApproval) handleApproveClick(selectedApproval);
                  }}
                >
                  {t('approval.approve')}
                </Button>
                <Button
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => {
                    if (selectedApproval) handleRejectClick(selectedApproval);
                  }}
                >
                  {t('approval.reject')}
                </Button>
              </>
            )}
            {selectedApproval?.status === 'PENDING' && !canApprove && (
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => {
                  if (selectedApproval) handleWithdrawClick(selectedApproval);
                }}
              >
                撤回申請
              </Button>
            )}
            <Button onClick={handleCloseDiffModal}>關閉</Button>
          </div>
        }
      >
        {selectedApproval && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="申請單編號">
                <Tag color="geekblue">{selectedApproval.id}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="申請狀態">
                <Tag color={APPROVAL_STATUS_MAP[selectedApproval.status]?.color}>
                  {t(APPROVAL_STATUS_KEYS[selectedApproval.status] || selectedApproval.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="申請類型">
                <Tag color={selectedApproval.type === 'ALERT_OVERRIDE' ? 'gold' : 'blue'}>
                  {APPROVAL_TYPE_MAP[selectedApproval.type] || '任務變更'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="申請人">
                {selectedApproval.requestedByName}
              </Descriptions.Item>
              <Descriptions.Item label="建立時間" span={2}>
                {formatDateTime(selectedApproval.createdAt, 'YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            {/* 任務變更差異項目對照 */}
            {selectedApproval.type !== 'ALERT_OVERRIDE' && (
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
                  項目對照
                </Text>
                {selectedApproval.diff && selectedApproval.diff.length > 0 ? (
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={selectedApproval.diff}
                    rowKey="field"
                    columns={[
                      {
                        title: '變更欄位',
                        dataIndex: 'label',
                        key: 'label',
                        width: 120,
                        render: (text) => <strong>{text}</strong>,
                      },
                      {
                        title: '變更前',
                        dataIndex: 'before',
                        key: 'before',
                        render: (val) => (
                          <Text type="secondary" delete={Boolean(val)}>
                            {formatDiffValue(val)}
                          </Text>
                        ),
                      },
                      {
                        title: '變更後',
                        dataIndex: 'after',
                        key: 'after',
                        render: (val) => (
                          <Tag color="green" style={{ fontSize: 13 }}>
                            {formatDiffValue(val)}
                          </Tag>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <Alert type="info" message="任務已於編輯表單進行內容調整，待主管核准後生效。" />
                )}
              </div>
            )}

            {/* 警示覆蓋項目對照資訊 */}
            {selectedApproval.type === 'ALERT_OVERRIDE' && (
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
                  項目對照（警示與覆蓋）
                </Text>
                {selectedApproval.violatedRules && selectedApproval.violatedRules.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text
                      type="secondary"
                      style={{ fontSize: 13, display: 'block', marginBottom: 4 }}
                    >
                      違反規則：
                    </Text>
                    {selectedApproval.violatedRules.map((rule, idx) => (
                      <Alert
                        key={idx}
                        type="warning"
                        showIcon
                        icon={<WarningOutlined />}
                        message={rule}
                        style={{ marginBottom: 6 }}
                      />
                    ))}
                  </div>
                )}
                {selectedApproval.overrideRemark && (
                  <Alert
                    type="error"
                    showIcon
                    message="主管覆蓋原因"
                    description={selectedApproval.overrideRemark}
                  />
                )}
              </div>
            )}
          </Space>
        )}
      </Modal>

      {/* 核准確認 Modal：確定在取消左邊 */}
      <Modal
        title={
          <Space>
            <CheckOutlined style={{ color: '#52c41a' }} />
            <span>{t('approval.approveTitle')}</span>
          </Space>
        }
        open={approveModalOpen}
        onCancel={handleApproveCancel}
        width={500}
        footer={
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              loading={approveMutation.isPending}
              onClick={() => void handleApproveOk()}
              aria-label="確定"
            >
              確定核准
            </Button>
            <Button onClick={handleApproveCancel} aria-label="取消">
              取消
            </Button>
          </Space>
        }
      >
        {approvingApproval && (
          <Form form={approveForm} layout="vertical">
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`確定要核准申請單【${approvingApproval.id}】嗎？`}
              description={`申請人：${approvingApproval.requestedByName} ｜ 類型：${
                APPROVAL_TYPE_MAP[approvingApproval.type] || '任務變更'
              }`}
            />
            <Form.Item name="comment" label={t('approval.approveComment')}>
              <TextArea rows={3} placeholder={t('approval.approveCommentPlaceholder')} />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* 駁回確認 Modal：確定在取消左邊 */}
      <Modal
        title={
          <Space>
            <CloseOutlined style={{ color: '#f5222d' }} />
            <span>{t('approval.rejectTitle')}</span>
          </Space>
        }
        open={rejectModalOpen}
        onCancel={handleRejectCancel}
        width={500}
        footer={
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              danger
              loading={rejectMutation.isPending}
              onClick={() => void handleRejectOk()}
              aria-label="確定"
            >
              確定駁回
            </Button>
            <Button onClick={handleRejectCancel} aria-label="取消">
              取消
            </Button>
          </Space>
        }
      >
        {rejectingApproval && (
          <Form form={rejectForm} layout="vertical">
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={`確定要駁回申請單【${rejectingApproval.id}】嗎？`}
              description={`申請人：${rejectingApproval.requestedByName} ｜ 類型：${
                APPROVAL_TYPE_MAP[rejectingApproval.type] || '任務變更'
              }`}
            />
            <Form.Item
              name="comment"
              label={t('approval.rejectReason')}
              rules={[{ required: true, message: t('approval.rejectReasonRequired') }]}
            >
              <TextArea rows={4} placeholder={t('approval.rejectReasonPlaceholder')} />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default ApprovalPage;
