/**
 * BaseSearchForm - 通用搜尋表單元件
 *
 * 依據傳入的欄位設定（SearchFieldConfig）動態渲染不同型態的搜尋欄位（輸入框、
 * 下拉選單、日期選擇器、日期區間選擇器、多層級選單），並提供統一的「搜尋」與
 * 「重置」按鈕行為。適用於各列表頁面上方的查詢條件區塊，避免每個頁面重複實作
 * 相同的表單結構與樣式。
 */
import { useCallback } from 'react';
import { Form, Input, Select, DatePicker, Cascader, Button, Space, AutoComplete } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { SelectOption } from '@/types/common';

export interface SearchFieldConfig {
  /** 表單欄位名稱，對應 antd Form 的 name */
  name: string;
  /** 欄位顯示標籤 */
  label: string;
  /** 欄位型態，決定渲染成何種輸入元件 */
  type: 'input' | 'select' | 'autoComplete' | 'datePicker' | 'rangePicker' | 'cascader';
  /** select, autoComplete 或 cascader 型態時所需的選項清單 */
  options?: SelectOption[];
  /** 自訂 placeholder，未提供時會依欄位型態自動組成預設文字 */
  placeholder?: string;
}

export interface BaseSearchFormProps {
  /** 要渲染的搜尋欄位設定清單 */
  fields: SearchFieldConfig[];
  /** 點擊搜尋按鈕（或表單送出）時的回呼，帶入目前表單所有欄位值 */
  onSearch: (values: Record<string, unknown>) => void;
  /** 點擊重置按鈕時的回呼（表單欄位會先被清空） */
  onReset: () => void;
  /** 是否顯示搜尋/重置按鈕的載入中狀態 */
  loading?: boolean;
}

const { RangePicker } = DatePicker;

interface AutoCompleteSearchFieldProps {
  value?: string;
  onChange?: (val: string) => void;
  options?: SelectOption[];
  placeholder?: string;
  onSelectOption?: (val: string) => void;
}

/**
 * 專為搜尋表單打造之 AutoComplete 輸入元件
 * 只有在使用者輸入至少 1 個非空白字元時才提供 options，確保空白搜尋框獲得焦點時絕對不會跳出下拉選單
 */
function AutoCompleteSearchField({
  value = '',
  onChange,
  options = [],
  placeholder,
  onSelectOption,
}: AutoCompleteSearchFieldProps) {
  const hasInputValue = Boolean(value && value.trim().length > 0);
  const activeOptions = hasInputValue ? options : [];

  return (
    <AutoComplete
      value={value}
      options={activeOptions}
      placeholder={placeholder}
      allowClear
      style={{ width: '100%', minWidth: 260 }}
      onChange={(val) => {
        onChange?.(val || '');
      }}
      filterOption={(inputValue, option) => {
        if (!inputValue || !inputValue.trim()) {
          return false;
        }
        return (
          (option?.value?.toString() ?? '').toLowerCase().includes(inputValue.toLowerCase()) ||
          (option?.label?.toString() ?? '').toLowerCase().includes(inputValue.toLowerCase())
        );
      }}
      onSelect={(val) => {
        const valStr = String(val);
        onChange?.(valStr);
        onSelectOption?.(valStr);
      }}
    />
  );
}

// 根據欄位設定的 type，渲染對應的 antd 輸入元件
function renderField(
  field: SearchFieldConfig,
  t: (key: string, options?: Record<string, string>) => string,
  onSelectOption?: (fieldName: string, value: string) => void,
) {
  switch (field.type) {
    case 'input':
      return (
        <Input
          placeholder={field.placeholder ?? t('common.inputPlaceholder', { label: field.label })}
          allowClear
          style={{ width: '100%' }}
        />
      );
    case 'autoComplete':
      return (
        <AutoCompleteSearchField
          options={field.options}
          placeholder={field.placeholder ?? t('common.inputPlaceholder', { label: field.label })}
          onSelectOption={(val) => {
            onSelectOption?.(field.name, val);
          }}
        />
      );
    case 'select':
      return (
        <Select
          placeholder={field.placeholder ?? t('common.selectPlaceholder', { label: field.label })}
          options={field.options}
          allowClear
          style={{ minWidth: 160 }}
        />
      );
    case 'datePicker':
      return (
        <DatePicker
          placeholder={field.placeholder ?? t('common.selectPlaceholder', { label: field.label })}
          style={{ width: '100%' }}
        />
      );
    case 'rangePicker':
      return <RangePicker style={{ width: '100%' }} />;
    case 'cascader':
      return (
        <Cascader
          options={field.options}
          placeholder={field.placeholder ?? t('common.selectPlaceholder', { label: field.label })}
          allowClear
          style={{ minWidth: 200 }}
        />
      );
    default:
      return null;
  }
}

function BaseSearchForm({ fields, onSearch, onReset, loading = false }: BaseSearchFormProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  // 取得目前表單所有欄位值並回傳給呼叫端，由呼叫端決定如何觸發實際查詢
  const handleSearch = useCallback(() => {
    const values = form.getFieldsValue();
    onSearch(values);
  }, [form, onSearch]);

  // 當使用者點選 AutoComplete 下拉選項時，自動更新欄位並觸發搜尋
  const handleSelectOption = useCallback(
    (fieldName: string, value: string) => {
      form.setFieldsValue({ [fieldName]: value });
      const values = form.getFieldsValue();
      onSearch(values);
    },
    [form, onSearch],
  );

  // 先清空表單欄位，再通知呼叫端已重置（讓呼叫端可重新查詢預設資料）
  const handleReset = useCallback(() => {
    form.resetFields();
    onReset();
  }, [form, onReset]);

  return (
    <Form
      form={form}
      layout="inline"
      onFinish={handleSearch}
      className="base-search-form"
      style={{ marginBottom: 16 }}
    >
      <div className="base-search-form-fields">
        {fields.map((field) => (
          <Form.Item
            key={field.name}
            name={field.name}
            label={field.label}
            className="base-search-form-field"
          >
            {renderField(field, t, handleSelectOption)}
          </Form.Item>
        ))}
      </div>
      <Form.Item className="base-search-form-actions">
        <Space>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SearchOutlined />}
            loading={loading}
            style={{ minWidth: 88 }}
          >
            {t('common.search')}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
            loading={loading}
            style={{ minWidth: 88 }}
          >
            {t('common.clearAll')}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}

export default BaseSearchForm;
