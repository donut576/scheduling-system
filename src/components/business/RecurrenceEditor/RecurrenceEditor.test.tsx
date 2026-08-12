/**
 * 測試對象：RecurrenceEditor 元件
 * 驗證預設值渲染、頻率切換時相關欄位（週幾/每月幾號）顯示與隱藏、
 * 結束條件（永不/指定日期/指定次數）切換行為，以及各欄位變更時的 onChange 回呼。
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RecurrenceEditor from './index';
import type { RecurrenceRule } from '@/types/task';

describe('RecurrenceEditor', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  it('renders with default values when no value is provided', () => {
    render(<RecurrenceEditor onChange={onChange} />);

    expect(screen.getByText('重複頻率')).toBeInTheDocument();
    expect(screen.getByText('結束條件')).toBeInTheDocument();
    expect(screen.getByLabelText('間隔數')).toHaveValue('1');
  });

  it('renders frequency options', () => {
    render(<RecurrenceEditor onChange={onChange} />);

    expect(screen.getByText('每日')).toBeInTheDocument();
    expect(screen.getByText('每週')).toBeInTheDocument();
    expect(screen.getByText('每月')).toBeInTheDocument();
    expect(screen.getByText('自訂')).toBeInTheDocument();
  });

  it('shows days of week when frequency is weekly', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [],
      endType: 'never',
    };

    render(<RecurrenceEditor value={rule} onChange={onChange} />);

    expect(screen.getByText('週幾')).toBeInTheDocument();
    expect(screen.getByText('日')).toBeInTheDocument();
    expect(screen.getByText('一')).toBeInTheDocument();
    expect(screen.getByText('二')).toBeInTheDocument();
    expect(screen.getByText('三')).toBeInTheDocument();
    expect(screen.getByText('四')).toBeInTheDocument();
    expect(screen.getByText('五')).toBeInTheDocument();
    expect(screen.getByText('六')).toBeInTheDocument();
  });

  it('hides days of week when frequency is daily', () => {
    const rule: RecurrenceRule = {
      frequency: 'daily',
      interval: 1,
      endType: 'never',
    };

    render(<RecurrenceEditor value={rule} onChange={onChange} />);

    expect(screen.queryByText('週幾')).not.toBeInTheDocument();
  });

  it('shows day of month input when frequency is monthly', () => {
    const rule: RecurrenceRule = {
      frequency: 'monthly',
      interval: 1,
      dayOfMonth: 15,
      endType: 'never',
    };

    render(<RecurrenceEditor value={rule} onChange={onChange} />);

    expect(screen.getByLabelText('每月幾號')).toHaveValue('15');
  });

  it('shows both days of week and day of month when frequency is custom', () => {
    const rule: RecurrenceRule = {
      frequency: 'custom',
      interval: 2,
      daysOfWeek: [1, 3, 5],
      dayOfMonth: 10,
      endType: 'never',
    };

    render(<RecurrenceEditor value={rule} onChange={onChange} />);

    expect(screen.getByText('週幾')).toBeInTheDocument();
    expect(screen.getByLabelText('每月幾號')).toBeInTheDocument();
  });

  it('calls onChange when frequency is changed', async () => {
    const user = userEvent.setup();
    const rule: RecurrenceRule = {
      frequency: 'daily',
      interval: 1,
      endType: 'never',
    };

    render(<RecurrenceEditor value={rule} onChange={onChange} />);

    await user.click(screen.getByText('每週'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [],
      }),
    );
  });

  it('calls onChange when interval is changed', async () => {
    const user = userEvent.setup();
    const rule: RecurrenceRule = {
      frequency: 'daily',
      interval: 1,
      endType: 'never',
    };

    render(<RecurrenceEditor value={rule} onChange={onChange} />);

    const intervalInput = screen.getByLabelText('間隔數');
    await user.clear(intervalInput);
    await user.type(intervalInput, '3');

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ interval: 3 }));
  });

  it('shows end date picker when endType is date', () => {
    const rule: RecurrenceRule = {
      frequency: 'daily',
      interval: 1,
      endType: 'date',
      endDate: '2025-06-30',
    };

    render(<RecurrenceEditor value={rule} onChange={onChange} />);

    expect(screen.getByText('結束日期：')).toBeInTheDocument();
    expect(screen.getByLabelText('結束日期')).toBeInTheDocument();
  });

  it('shows end count input when endType is count', () => {
    const rule: RecurrenceRule = {
      frequency: 'daily',
      interval: 1,
      endType: 'count',
      endCount: 5,
    };

    render(<RecurrenceEditor value={rule} onChange={onChange} />);

    expect(screen.getByLabelText('重複次數')).toHaveValue('5');
    expect(screen.getByText('次後結束')).toBeInTheDocument();
  });

  it('hides end date and count when endType is never', () => {
    const rule: RecurrenceRule = {
      frequency: 'daily',
      interval: 1,
      endType: 'never',
    };

    render(<RecurrenceEditor value={rule} onChange={onChange} />);

    expect(screen.queryByText('結束日期：')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('重複次數')).not.toBeInTheDocument();
  });

  it('calls onChange when end type changes to count', async () => {
    const user = userEvent.setup();
    const rule: RecurrenceRule = {
      frequency: 'daily',
      interval: 1,
      endType: 'never',
    };

    render(<RecurrenceEditor value={rule} onChange={onChange} />);

    await user.click(screen.getByText('指定次數'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        endType: 'count',
        endCount: 10,
      }),
    );
  });

  it('calls onChange when days of week are toggled', async () => {
    const user = userEvent.setup();
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [],
      endType: 'never',
    };

    render(<RecurrenceEditor value={rule} onChange={onChange} />);

    await user.click(screen.getByText('一'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        daysOfWeek: [1],
      }),
    );
  });

  it('displays correct interval unit label based on frequency', () => {
    const rule: RecurrenceRule = {
      frequency: 'weekly',
      interval: 2,
      daysOfWeek: [],
      endType: 'never',
    };

    const { rerender } = render(<RecurrenceEditor value={rule} onChange={onChange} />);

    expect(screen.getByText('週')).toBeInTheDocument();

    rerender(
      <RecurrenceEditor
        value={{ ...rule, frequency: 'monthly', dayOfMonth: 1 }}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('月')).toBeInTheDocument();
  });
});
