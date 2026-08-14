import { useCallback, useMemo, useState } from 'react';
import type { FC } from 'react';
import { Button, Card, Dropdown, Form, Input, Select, Space, Tag, message } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  DownloadOutlined,
  DownOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import BaseTable, { type ColumnDef, type QueryResult } from '@/components/base/BaseTable';
import BaseModal from '@/components/base/BaseModal';
import { useApprovalList, useApproveRequest, useRejectRequest } from '@/queries/useApprovalQueries';
import { useSendNotification } from '@/queries/useNotificationQueries';
import { approvalApi, type ApprovalListParams } from '@/api/approval';
import { APPROVAL_STATUS_MAP } from '@/constants/approvalTypes';
import { POSITION_MAP } from '@/constants/positions';
import { formatDateTime } from '@/utils/date';
import type { Approval } from '@/types/notification';
import type { PaginatedResponse } from '@/types/common';
import { exportToExcel, type ExcelColumn } from '@/utils/excel';

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

const APPROVAL_TYPE_OPTIONS = [
  { label: '排班變更', value: 'SCHEDULE_CHANGE' },
  { label: '班別變更', value: 'SHIFT_CHANGE' },
  { label: '警示覆蓋', value: 'ALERT_OVERRIDE' },
];

const APPROVAL_STATUS_OPTIONS = [
  { label: '待核准', value: 'PENDING' },
  { label: '已核准', value: 'APPROVED' },
  { label: '已駁回', value: 'REJECTED' },
  { label: '已撤回', value: 'WITHDRAWN' },
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
        dropdownRender={() => (
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

/** 審批列表 Excel 匯出欄位定義 */
const getApprovalExportColumns = (t: (key: string) => string): ExcelColumn<Approval>[] => [
  {
    header: t('approval.type'),
    key: (record) => t(APPROVAL_TYPE_KEYS[record.type]),
    width: 16,
  },
  {
    header: t('approval.requester'),
    key: 'requestedByName',
    width: 14,
  },
  {
    header: '關聯任務編號',
    key: (record) => record.taskId || '-',
    width: 18,
  },
  {
    header: t('approval.statusLabel'),
    key: (record) => t(APPROVAL_STATUS_KEYS[record.status]),
    width: 14,
  },
  {
    header: t('approval.approver'),
    key: (record) =>
      record.approvers
        .map(
          (step) =>
            `${step.approverName}(${POSITION_MAP[step.role as keyof typeof POSITION_MAP] ?? step.role}):${step.status}`,
        )
        .join(', '),
    width: 28,
  },
  {
    header: t('approval.createdAt'),
    key: (record) => formatDateTime(record.createdAt, 'YYYY-MM-DD HH:mm'),
    width: 20,
  },
];

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
        {record.taskId && (
          <span>
            關聯任務：<Tag color="geekblue">{record.taskId}</Tag>
          </span>
        )}
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
 * 負責審批列表呈現、篩選、核准操作與駁回 Modal 之狀態管理
 */
const ApprovalPage: FC = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ApprovalListParams>({ ...DEFAULT_PARAMS });
  const [isExporting, setIsExporting] = useState(false);

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

  const handleResetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_PARAMS });
  }, []);

  const isFiltered = useMemo(() => Boolean(filters.type || filters.status), [filters]);

  // 匯出目前篩選結果之審批列表
  const handleExportApprovals = useCallback(async () => {
    try {
      setIsExporting(true);
      const response = await approvalApi.list({ ...filters, page: 1, pageSize: 10000 });
      const approvalsToExport = response.data.data.list ?? [];

      const filterSummary: string[] = [];
      if (filters.type) {
        const typeLabel = APPROVAL_TYPE_OPTIONS.find((opt) => opt.value === filters.type)?.label;
        if (typeLabel) filterSummary.push(`類型-${typeLabel}`);
      }
      if (filters.status) {
        const statusLabel = APPROVAL_STATUS_OPTIONS.find(
          (opt) => opt.value === filters.status,
        )?.label;
        if (statusLabel) filterSummary.push(`狀態-${statusLabel}`);
      }
      const filenameSuffix = filterSummary.length > 0 ? `_${filterSummary.join('_')}` : '';

      exportToExcel(
        approvalsToExport,
        getApprovalExportColumns(t),
        `異動核准列表${filenameSuffix}_${dayjs().format('YYYYMMDD_HHmmss')}`,
      );
    } catch (err) {
      console.error('Export approvals failed', err);
    } finally {
      setIsExporting(false);
    }
  }, [filters, t]);

  /**
   * Requirement 13.3：審批通過後自動更新通知主旨並重新發送予客戶。
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
      title: (
        <ColumnFilterTitle label={t('approval.type')} active={!!filters.type}>
          <Select
            placeholder="請選擇類型"
            style={{ width: 140 }}
            allowClear
            value={filters.type}
            onChange={(val) => handleTypeFilter(val ?? undefined)}
            options={APPROVAL_TYPE_OPTIONS}
          />
        </ColumnFilterTitle>
      ),
      key: 'type',
      width: 110,
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
      title: '關聯任務編號',
      dataIndex: 'taskId',
      key: 'taskId',
      width: 130,
      render: (value) => (value ? <Tag color="geekblue">{value as string}</Tag> : '-'),
      exportHeader: '關聯任務編號',
      exportKey: 'taskId',
    },
    {
      title: (
        <ColumnFilterTitle label={t('approval.statusLabel')} active={!!filters.status}>
          <Select
            placeholder="請選擇狀態"
            style={{ width: 140 }}
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
        exportable={false}
        toolbarExtra={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div>
              {isFiltered && (
                <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
                  一鍵清除篩選條件
                </Button>
              )}
            </div>
            <Button
              icon={<DownloadOutlined />}
              loading={isExporting}
              onClick={handleExportApprovals}
            >
              列表匯出
            </Button>
          </div>
        }
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
