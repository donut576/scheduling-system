import React, { useEffect, useMemo } from 'react';
import { Modal, Form, Input, Typography, Tag, Space, Alert, message } from 'antd';
import { PlusCircleOutlined, ShopOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCreateCustomer } from '@/queries/useCustomerQueries';
import { getRegionByAddress, REGION_NAMES_MAP } from '@/utils/regionMapping';
import type { Customer } from '@/types/customer';

const { Text } = Typography;

export interface QuickCreateCustomerModalProps {
  open: boolean;
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
  initialGroupName = '',
  initialBranchName = '',
  isNewGroup = true,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<QuickCreateFormValues>();
  const createCustomerMutation = useCreateCustomer();

  const watchAddress = Form.useWatch('address', form);
  const detectedRegion = useMemo(() => {
    return getRegionByAddress(watchAddress);
  }, [watchAddress]);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        groupName: initialGroupName,
        branchName: initialBranchName || (isNewGroup ? '總部 / 一店' : ''),
        address: '',
        contactName: '現場負責人',
        contactPhone: '02-23456789',
      });
    } else {
      form.resetFields();
    }
  }, [open, initialGroupName, initialBranchName, isNewGroup, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        groupName: values.groupName.trim(),
        branchName: values.branchName.trim(),
        address: values.address.trim(),
        contactName: values.contactName?.trim() || '現場負責人',
        contactPhone: values.contactPhone?.trim() || '02-23456789',
        requiredLicenses: ['NONE'],
      };

      const result = await createCustomerMutation.mutateAsync(payload);
      message.success(
        t('task.quickCreateSuccess', {
          defaultValue: `已成功建立客戶「${payload.groupName} - ${payload.branchName}」並帶入表單！`,
          group: payload.groupName,
          branch: payload.branchName,
        }),
      );
      onSuccess(result);
      onClose();
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
            {isNewGroup ? '快速建立新客戶集團與分店' : `為「${initialGroupName}」新增分店`}
          </span>
        </Space>
      }
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={createCustomerMutation.isPending}
      okText="確定建立並帶入"
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
          label={
            <Space size={4}>
              <ShopOutlined />
              <span style={{ fontWeight: 600 }}>客戶集團名稱</span>
            </Space>
          }
          rules={[{ required: true, message: '請輸入集團名稱' }]}
        >
          <Input
            placeholder="例如：王品集團、乾杯集團"
            disabled={!isNewGroup}
            data-testid="quick-create-group-name"
          />
        </Form.Item>

        <Form.Item
          name="branchName"
          label={
            <Space size={4}>
              <ShopOutlined />
              <span style={{ fontWeight: 600 }}>分店／據點名稱</span>
            </Space>
          }
          rules={[{ required: true, message: '請輸入分店名稱' }]}
        >
          <Input
            placeholder="例如：信義店、總部大樓、竹科一廠"
            data-testid="quick-create-branch-name"
          />
        </Form.Item>

        <Form.Item
          name="address"
          label={
            <Space size={4}>
              <EnvironmentOutlined />
              <span style={{ fontWeight: 600 }}>分店地址</span>
            </Space>
          }
          rules={[{ required: true, message: '請輸入分店地址' }]}
          help={
            detectedRegion ? (
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
                請包含縣市（如台北市、新竹市、台中市、高雄市）以利自動辨識責任轄區與地圖標記
              </Text>
            )
          }
        >
          <Input placeholder="例如：台北市信義區松壽路12號" data-testid="quick-create-address" />
        </Form.Item>

        <Form.Item
          name="contactName"
          label={<span style={{ color: '#595959' }}>現場聯絡人（選填）</span>}
          style={{ marginBottom: 12 }}
        >
          <Input placeholder="預設：現場負責人" data-testid="quick-create-contact-name" />
        </Form.Item>

        <Form.Item
          name="contactPhone"
          label={<span style={{ color: '#595959' }}>聯絡電話（選填）</span>}
          style={{ marginBottom: 0 }}
        >
          <Input placeholder="預設：02-23456789" data-testid="quick-create-contact-phone" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default QuickCreateCustomerModal;
