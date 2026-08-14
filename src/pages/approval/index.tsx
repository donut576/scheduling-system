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
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import { useApprovalList, useApproveRequest, useRejectRequest } from '@/queries/useApprovalQueries';
import { useSendNotification } from '@/queries/useNotificationQueries';
import type { ApprovalListParams } from '@/api/approval';
import { APPROVAL_STATUS_MAP } from '@/constants/approvalTypes';
import { formatDateTime } from '@/utils/date';
import type { Approval } from '@/types/notification';
import type { PaginatedResponse } from '@/types/common';

const { TextArea } = Input;
const { Text } = Typography;

const APPROVAL_STATUS_KEYS: Record<string, string> = {
  PENDING: 'approval.status.pending',
  APPROVED: 'approval.status.approved',
  REJECTED: 'approval.status.rejected',
};

const APPROVAL_TYPE_OPTIONS = [
  { label: '任務變更', value: 'TASK_CHANGE' },
  { label: '警示覆蓋', value: 'ALERT_OVERRIDE' },
];

const APPROVAL_STATUS_OPTIONS = [
  { label: '待核准', value: 'PENDING' },
  { label: '已核准', value: 'APPROVED' },
  { label: '已駁回', value: 'REJECTED' },
];

const DEFAULT_PARAMS: ApprovalListParams = { page: 1, pageSize: 20 };

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
  t: (key: string) => string,
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
            <Tag color="geekblue">{record.id}</Tag>
            <Tag color={statusConfig.color}>{statusLabel}</Tag>
          </Space>
          <Tag color={isTaskChange ? 'blue' : 'gold'}>{typeLabel}</Tag>
        </Space>
        <span>
          {t('approval.requester')}：<strong>{record.requestedByName}</strong>
        </span>
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
 * 欄位順序：申請單編號、狀態、類型、建立時間、申請人、功能
 * 左上方提供快速搜尋欄，功能僅保留「檢視變更」，進入彈窗後方可進行核准/駁回
 */
const ApprovalPage: FC = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ApprovalListParams>({ ...DEFAULT_PARAMS });
  const [keywordInput, setKeywordInput] = useState<string>('');

  // 檢視變更 Modal
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);

  // 核准確認 Modal
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approvingApproval, setApprovingApproval] = useState<Approval | null>(null);
  const [approveForm] = Form.useForm<{ comment: string }>();

  // 駁回確認 Modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingApproval, setRejectingApproval] = useState<Approval | null>(null);
  const [rejectForm] = Form.useForm<{ comment: string }>();

  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();
  const sendNotificationMutation = useSendNotification();

  // Wraps useApprovalList to satisfy BaseTable's queryHook signature
  function useApprovalListQuery(): QueryResult<PaginatedResponse<Approval>> {
    return useApprovalList(filters) as QueryResult<PaginatedResponse<Approval>>;
  }

  const handleTypeFilter = useCallback((type?: string) => {
    setFilters((prev) => ({ ...prev, type, page: 1 }));
  }, []);

  const handleStatusFilter = useCallback((status?: string) => {
    setFilters((prev) => ({ ...prev, status, page: 1 }));
  }, []);

  const handleSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, keyword: value.trim() || undefined, page: 1 }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setKeywordInput('');
    setFilters({ ...DEFAULT_PARAMS });
  }, []);

  const isFiltered = useMemo(
    () => Boolean(filters.type || filters.status || filters.keyword),
    [filters],
  );

  /**
   * 審批通過後自動更新通知主旨並重新發送予客戶。
   */
  const notifyApprovalResult = useCallback(
    async (approval: Approval) => {
      const isTaskChange =
        approval.type === 'TASK_CHANGE' ||
        approval.type === 'SCHEDULE_CHANGE' ||
        approval.type === 'SHIFT_CHANGE';
      const typeLabel = isTaskChange ? '任務變更' : '警示覆蓋';
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

  // 開啟檢視變更 Modal
  const handleViewDiff = useCallback((record: Approval) => {
    setSelectedApproval(record);
    setDiffModalOpen(true);
  }, []);

  const handleCloseDiffModal = useCallback(() => {
    setDiffModalOpen(false);
    setSelectedApproval(null);
  }, []);

  // 開啟核准確認 Modal
  const handleApproveClick = useCallback(
    (record: Approval) => {
      setApprovingApproval(record);
      approveForm.resetFields();
      setApproveModalOpen(true);
    },
    [approveForm],
  );

  // 取消核准
  const handleApproveCancel = useCallback(() => {
    setApproveModalOpen(false);
    setApprovingApproval(null);
    approveForm.resetFields();
  }, [approveForm]);

  // 確認核准
  const handleApproveOk = useCallback(async () => {
    if (!approvingApproval) return;
    let values: { comment?: string } = { comment: '' };
    try {
      values = await approveForm.validateFields();
    } catch {
      // 備註為選填，若有非預期錯誤則忽略
    }

    await approveMutation.mutateAsync({
      id: approvingApproval.id,
      comment: values.comment,
    });
    await notifyApprovalResult(approvingApproval);
    message.success(t('approval.approvedMessage'));

    setApproveModalOpen(false);
    setApprovingApproval(null);
    approveForm.resetFields();

    // 同步關閉檢視詳情彈窗
    setDiffModalOpen(false);
    setSelectedApproval(null);
  }, [approvingApproval, approveForm, approveMutation, notifyApprovalResult, t]);

  // 開啟駁回確認 Modal
  const handleRejectClick = useCallback(
    (record: Approval) => {
      setRejectingApproval(record);
      rejectForm.resetFields();
      setRejectModalOpen(true);
    },
    [rejectForm],
  );

  // 取消駁回
  const handleRejectCancel = useCallback(() => {
    setRejectModalOpen(false);
    setRejectingApproval(null);
    rejectForm.resetFields();
  }, [rejectForm]);

  // 確認駁回
  const handleRejectOk = useCallback(async () => {
    if (!rejectingApproval) return;
    let values: { comment: string };
    try {
      values = await rejectForm.validateFields();
    } catch {
      return; // 表單驗證失敗時直接中斷
    }

    await rejectMutation.mutateAsync({
      id: rejectingApproval.id,
      comment: values.comment,
    });
    message.success(t('approval.rejectedMessage'));

    setRejectModalOpen(false);
    setRejectingApproval(null);
    rejectForm.resetFields();

    // 同步關閉檢視詳情彈窗
    setDiffModalOpen(false);
    setSelectedApproval(null);
  }, [rejectingApproval, rejectForm, rejectMutation, t]);

  // 表格欄位定義：申請單編號、狀態、類型、建立時間、申請人、功能
  const columns: ColumnDef<Approval>[] = [
    {
      title: '申請單編號',
      dataIndex: 'id',
      key: 'id',
      width: 140,
      render: (value) => <Tag color="geekblue">{value as string}</Tag>,
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
        const isTaskChange =
          record.type === 'TASK_CHANGE' ||
          record.type === 'SCHEDULE_CHANGE' ||
          record.type === 'SHIFT_CHANGE';
        return (
          <Tag color={isTaskChange ? 'blue' : 'gold'}>{isTaskChange ? '任務變更' : '警示覆蓋'}</Tag>
        );
      },
    },
    {
      title: t('approval.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (_value, record) => formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: t('approval.requester'),
      dataIndex: 'requestedByName',
      key: 'requestedByName',
      width: 120,
    },
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
      <BaseTable<Approval>
        columns={columns}
        queryHook={useApprovalListQuery}
        exportable={false}
        onRowClick={handleViewDiff}
        toolbarExtra={
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              gap: 12,
            }}
          >
            <Space size={8}>
              <Input.Search
                placeholder="請輸入申請單編號或申請人搜尋"
                allowClear
                enterButton
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onSearch={handleSearch}
                style={{ width: 320 }}
              />
              {isFiltered && (
                <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
                  一鍵清除篩選
                </Button>
              )}
            </Space>
          </div>
        }
        cardRender={(record) => renderApprovalCard(record, handleViewDiff, t)}
        rowKey="id"
      />

      {/* 檢視變更詳情 Modal：僅在此處可進行核准與駁回操作 */}
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
            {selectedApproval?.status === 'PENDING' && (
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
                {selectedApproval.type === 'ALERT_OVERRIDE' ? (
                  <Tag color="gold">警示覆蓋</Tag>
                ) : (
                  <Tag color="blue">任務變更</Tag>
                )}
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
                  📋 項目對照
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
                            {String(val ?? '(無)')}
                          </Text>
                        ),
                      },
                      {
                        title: '變更後',
                        dataIndex: 'after',
                        key: 'after',
                        render: (val) => (
                          <Tag color="green" style={{ fontSize: 13 }}>
                            {String(val ?? '(無)')}
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
                  ⚠️ 項目對照（警示與覆蓋）
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
                approvingApproval.type === 'ALERT_OVERRIDE' ? '警示覆蓋' : '任務變更'
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
                rejectingApproval.type === 'ALERT_OVERRIDE' ? '警示覆蓋' : '任務變更'
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
