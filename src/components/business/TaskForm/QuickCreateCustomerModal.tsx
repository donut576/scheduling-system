import React, { useEffect, useMemo } from 'react';
import { Modal, Form, Input, Typography, Tag, Space, Alert, message } from 'antd';
import { PlusCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCreateCustomer, useCustomerGroups } from '@/queries/useCustomerQueries';
import { getRegionByAddress, REGION_NAMES_MAP } from '@/utils/regionMapping';
import { checkCustomerDuplicate } from '@/utils/customerValidation';
import type { Customer } from '@/types/customer';

const { Text } = Typography;

export interface QuickCreateCustomerModalProps {
  open: boolean;
  initialGroupId?: string;
  initialGroupName?: string;
  initialBranchName?: string;
  /** 是否為建立新集團（true: 新建集團+分店；false: 為既有集團新增分店） */
  isNewGroup?: boolean;
  onClose: () => void;
  onSuccess: (createdCustomer: Customer) => void;
}

interface QuickCreateFormValues {
  groupName: string;
  branchName: string;
  address: string;
  contactName?: string;
  contactPhone?: string;
}

export const QuickCreateCustomerModal: React.FC<QuickCreateCustomerModalProps> = ({
  open,
  initialGroupId,
  initialGroupName = '',
  initialBranchName = '',
  isNewGroup = true,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<QuickCreateFormValues>();
  const createCustomerMutation = useCreateCustomer();
  const { data: customerGroups = [] } = useCustomerGroups();

  const watchAddress = Form.useWatch('address', form);
  const watchGroupName = Form.useWatch('groupName', form) || '';
  const watchBranchName = Form.useWatch('branchName', form) || '';

  const detectedRegion = useMemo(() => {
    return getRegionByAddress(watchAddress);
  }, [watchAddress]);

  const validationResult = useMemo(() => {
    if (!isNewGroup || !watchGroupName) {
      return { isExactCustomerDuplicate: false, similarGroups: [] };
    }
    return checkCustomerDuplicate(watchGroupName, watchBranchName, customerGroups);
  }, [isNewGroup, watchGroupName, watchBranchName, customerGroups]);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        groupName: initialGroupName,
        branchName: initialBranchName || '',
        address: '',
      });
    } else {
      form.resetFields();
    }
  }, [open, initialGroupName, initialBranchName, isNewGroup, form]);

  const submitCustomer = async (payload: {
    groupId?: string;
    groupName: string;
    branchName: string;
    address: string;
    contactName: string;
    contactPhone: string;
    requiredLicenses: string[];
  }) => {
    const result = await createCustomerMutation.mutateAsync(payload);
    message.success(
      t('task.quickCreateSuccess', {
        defaultValue: `已成功建立客戶「${payload.groupName} - ${payload.branchName}」並代入表單！`,
        group: payload.groupName,
        branch: payload.branchName,
      }),
    );
    onSuccess(result);
    onClose();
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        groupId: !isNewGroup ? initialGroupId : undefined,
        groupName: values.groupName.trim(),
        branchName: (values.branchName ?? '').trim(),
        address: values.address.trim(),
        contactName: values.contactName?.trim() || '現場負責人',
        contactPhone: values.contactPhone?.trim() || '02-23456789',
        requiredLicenses: ['NONE'],
      };

      if (isNewGroup) {
        const check = checkCustomerDuplicate(payload.groupName, payload.branchName, customerGroups);

        if (check.isExactCustomerDuplicate) {
          message.error(`已存在相同客戶「${check.exactCustomerName}」，請勿重複建立！`);
          return;
        }
      }

      await submitCustomer(payload);
    } catch (err) {
      // Form validation error or API error
      console.error('Failed to quick create customer:', err);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <PlusCircleOutlined style={{ color: '#1677ff' }} />
          <span style={{ fontWeight: 700 }}>
            {isNewGroup ? '快速建立新客戶集團／公司與分店' : `為「${initialGroupName}」新增分店`}
          </span>
        </Space>
      }
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={createCustomerMutation.isPending}
      okText="確定建立並代入"
      cancelText="取消"
      width={520}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16, marginTop: 8 }}
        message="快速建檔提示"
        description="填寫基本名稱與地址即可立即用於排班建單。後續可至「客戶資料管理」補全證照限制等詳細資料。"
      />

      <Form form={form} layout="vertical">
        <Form.Item
          name="groupName"
          label={t('customer.groupName')}
          rules={[{ required: true, message: '請輸入集團／公司名稱' }]}
          validateStatus={
            isNewGroup &&
            (validationResult.exactGroupMatch || validationResult.similarGroups.length > 0)
              ? 'error'
              : undefined
          }
          help={
            isNewGroup &&
            (validationResult.exactGroupMatch ? (
              <div style={{ color: '#ff4d4f', fontSize: 13, marginTop: 4 }}>
                ⚠️ 系統中已經有這個集團／公司了（共 {validationResult.exactGroupMatch.branchCount}{' '}
                間分店）
              </div>
            ) : validationResult.similarGroups.length > 0 ? (
              <div style={{ color: '#ff4d4f', fontSize: 13, marginTop: 4 }}>
                ⚠️ 系統中已經有類似的集團／公司了（
                {validationResult.similarGroups.map((g) => g.name).join('、')}）
              </div>
            ) : undefined)
          }
        >
          <Input
            placeholder="請輸入集團／公司名稱"
            disabled={!isNewGroup}
            data-testid="quick-create-group-name"
          />
        </Form.Item>

        <Form.Item
          name="branchName"
          label={t('customer.branchName')}
          validateStatus={
            isNewGroup && validationResult.isExactCustomerDuplicate ? 'error' : undefined
          }
          help={
            isNewGroup && validationResult.isExactCustomerDuplicate ? (
              <div style={{ color: '#ff4d4f', fontSize: 13, marginTop: 4 }}>
                ⚠️ 此集團／公司已存在相同分店名稱（{validationResult.exactCustomerName}）
              </div>
            ) : undefined
          }
        >
          <Input placeholder="請輸入分店名稱" data-testid="quick-create-branch-name" />
        </Form.Item>

        <Form.Item
          name="address"
          label={t('customer.address')}
          rules={[{ required: true, message: '請輸入地址' }]}
          extra={
            <div style={{ marginBottom: 12 }}>
              {detectedRegion ? (
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    系統自動識別所屬轄區：
                  </Text>
                  <Tag color="geekblue" style={{ marginLeft: 6 }}>
                    {REGION_NAMES_MAP[detectedRegion] || `${detectedRegion}組`}
                  </Tag>
                </div>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  請包含縣市（如台北市），以利辨識轄區與地圖標記
                </Text>
              )}
            </div>
          }
        >
          <Input placeholder="請輸入地址" data-testid="quick-create-address" />
        </Form.Item>

        <Form.Item name="contactName" label={t('customer.contactName')}>
          <Input placeholder="選填" data-testid="quick-create-contact-name" />
        </Form.Item>

        <Form.Item name="contactPhone" label={t('customer.contactPhone')}>
          <Input placeholder="選填" data-testid="quick-create-contact-phone" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default QuickCreateCustomerModal;
