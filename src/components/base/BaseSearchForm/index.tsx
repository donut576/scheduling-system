import { useCallback } from 'react';
import { Form, Input, Select, DatePicker, Cascader, Button, Space } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { SelectOption } from '@/types/common';

export interface SearchFieldConfig {
  name: string;
  label: string;
  type: 'input' | 'select' | 'datePicker' | 'rangePicker' | 'cascader';
  options?: SelectOption[];
  placeholder?: string;
}

export interface BaseSearchFormProps {
  fields: SearchFieldConfig[];
  onSearch: (values: Record<string, unknown>) => void;
  onReset: () => void;
  loading?: boolean;
}

const { RangePicker } = DatePicker;

function renderField(field: SearchFieldConfig) {
  switch (field.type) {
    case 'input':
      return <Input placeholder={field.placeholder ?? `請輸入${field.label}`} allowClear />;
    case 'select':
      return (
        <Select
          placeholder={field.placeholder ?? `請選擇${field.label}`}
          options={field.options}
          allowClear
          style={{ minWidth: 160 }}
        />
      );
    case 'datePicker':
      return (
        <DatePicker
          placeholder={field.placeholder ?? `請選擇${field.label}`}
          style={{ width: '100%' }}
        />
      );
    case 'rangePicker':
      return <RangePicker style={{ width: '100%' }} />;
    case 'cascader':
      return (
        <Cascader
          options={field.options}
          placeholder={field.placeholder ?? `請選擇${field.label}`}
          allowClear
          style={{ minWidth: 200 }}
        />
      );
    default:
      return null;
  }
}

function BaseSearchForm({ fields, onSearch, onReset, loading = false }: BaseSearchFormProps) {
  const [form] = Form.useForm();

  const handleSearch = useCallback(() => {
    const values = form.getFieldsValue();
    onSearch(values);
  }, [form, onSearch]);

  const handleReset = useCallback(() => {
    form.resetFields();
    onReset();
  }, [form, onReset]);

  return (
    <Form
      form={form}
      layout="inline"
      onFinish={handleSearch}
      style={{ marginBottom: 16, flexWrap: 'wrap', gap: '8px 0' }}
    >
      {fields.map((field) => (
        <Form.Item key={field.name} name={field.name} label={field.label}>
          {renderField(field)}
        </Form.Item>
      ))}
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
            搜尋
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset} loading={loading}>
            重置
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}

export default BaseSearchForm;
