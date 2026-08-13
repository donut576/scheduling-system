// 測試對象：BaseSearchForm（通用搜尋表單元件）
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BaseSearchForm, { type SearchFieldConfig } from './index';

// Mock window.matchMedia for Ant Design Grid components
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const basicFields: SearchFieldConfig[] = [
  { name: 'keyword', label: '關鍵字', type: 'input', placeholder: '搜尋集團或分店' },
  {
    name: 'taskType',
    label: '任務類型',
    type: 'select',
    options: [
      { label: '合約', value: 'CONTRACT' },
      { label: '單次', value: 'ONETIME' },
    ],
  },
  { name: 'date', label: '日期', type: 'datePicker' },
  { name: 'dateRange', label: '日期區間', type: 'rangePicker' },
  {
    name: 'area',
    label: '區域',
    type: 'cascader',
    options: [
      {
        label: '北區',
        value: 'north',
        children: [
          { label: '台北', value: 'taipei' },
          { label: '新北', value: 'newtaipei' },
        ],
      },
    ],
  },
];

describe('BaseSearchForm', () => {
  it('renders all field types correctly', () => {
    const onSearch = vi.fn();
    const onReset = vi.fn();

    render(<BaseSearchForm fields={basicFields} onSearch={onSearch} onReset={onReset} />);

    // Input field
    expect(screen.getByPlaceholderText('搜尋集團或分店')).toBeInTheDocument();

    // Select field
    expect(screen.getByText('任務類型')).toBeInTheDocument();

    // DatePicker field
    expect(screen.getByText('日期')).toBeInTheDocument();

    // RangePicker field
    expect(screen.getByText('日期區間')).toBeInTheDocument();

    // Cascader field
    expect(screen.getByText('區域')).toBeInTheDocument();

    // Buttons
    expect(screen.getByText('搜尋')).toBeInTheDocument();
    expect(screen.getByText('全部清除')).toBeInTheDocument();
  });

  it('calls onSearch with form values when 搜尋 button is clicked', async () => {
    const onSearch = vi.fn();
    const onReset = vi.fn();

    render(
      <BaseSearchForm
        fields={[{ name: 'keyword', label: '關鍵字', type: 'input' }]}
        onSearch={onSearch}
        onReset={onReset}
      />,
    );

    const input = screen.getByPlaceholderText('請輸入關鍵字');
    fireEvent.change(input, { target: { value: '台北' } });

    const searchBtn = screen.getByText('搜尋');
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith({ keyword: '台北' });
    });
  });

  it('calls onReset and clears form when 全部清除 button is clicked', async () => {
    const onSearch = vi.fn();
    const onReset = vi.fn();

    render(
      <BaseSearchForm
        fields={[{ name: 'keyword', label: '關鍵字', type: 'input' }]}
        onSearch={onSearch}
        onReset={onReset}
      />,
    );

    const input = screen.getByPlaceholderText('請輸入關鍵字');
    fireEvent.change(input, { target: { value: '台北' } });

    const resetBtn = screen.getByText('全部清除');
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(onReset).toHaveBeenCalled();
    });

    // After reset, submitting the form should yield cleared values
    const searchBtn = screen.getByText('搜尋');
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith({ keyword: undefined });
    });
  });

  it('shows loading state on both buttons', () => {
    const onSearch = vi.fn();
    const onReset = vi.fn();

    render(
      <BaseSearchForm
        fields={[{ name: 'keyword', label: '關鍵字', type: 'input' }]}
        onSearch={onSearch}
        onReset={onReset}
        loading={true}
      />,
    );

    const searchBtn = screen.getByText('搜尋').closest('button');
    const resetBtn = screen.getByText('全部清除').closest('button');

    expect(searchBtn).toHaveClass('ant-btn-loading');
    expect(resetBtn).toHaveClass('ant-btn-loading');
  });

  it('uses default placeholder when none provided', () => {
    const onSearch = vi.fn();
    const onReset = vi.fn();

    render(
      <BaseSearchForm
        fields={[{ name: 'name', label: '名稱', type: 'input' }]}
        onSearch={onSearch}
        onReset={onReset}
      />,
    );

    expect(screen.getByPlaceholderText('請輸入名稱')).toBeInTheDocument();
  });

  it('renders select with provided options', () => {
    const onSearch = vi.fn();
    const onReset = vi.fn();

    render(
      <BaseSearchForm
        fields={[
          {
            name: 'status',
            label: '狀態',
            type: 'select',
            options: [
              { label: '啟用', value: 'active' },
              { label: '停用', value: 'inactive' },
            ],
          },
        ]}
        onSearch={onSearch}
        onReset={onReset}
      />,
    );

    expect(screen.getByText('狀態')).toBeInTheDocument();
  });

  it('renders with empty fields array', () => {
    const onSearch = vi.fn();
    const onReset = vi.fn();

    render(<BaseSearchForm fields={[]} onSearch={onSearch} onReset={onReset} />);

    expect(screen.getByText('搜尋')).toBeInTheDocument();
    expect(screen.getByText('全部清除')).toBeInTheDocument();
  });

  it('submits form via Enter key in input field', async () => {
    const onSearch = vi.fn();
    const onReset = vi.fn();

    render(
      <BaseSearchForm
        fields={[{ name: 'keyword', label: '關鍵字', type: 'input' }]}
        onSearch={onSearch}
        onReset={onReset}
      />,
    );

    const input = screen.getByPlaceholderText('請輸入關鍵字');
    fireEvent.change(input, { target: { value: '測試' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith({ keyword: '測試' });
    });
  });
});
