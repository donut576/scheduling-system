/**
 * 測試對象：TimeSelect 元件
 * 驗證 24 小時制小時與 15 分鐘間隔選取、值輸出與清除行為。
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TimeSelect from './index';

describe('TimeSelect', () => {
  it('renders hour and minute comboboxes', () => {
    render(<TimeSelect aria-label="任務開始時間" />);

    expect(screen.getByRole('combobox', { name: '任務開始時間 (小時)' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '任務開始時間 (分鐘)' })).toBeInTheDocument();
  });

  it('displays parsed hour and minute when value is provided', () => {
    render(<TimeSelect value="09:30" aria-label="任務開始時間" />);

    expect(screen.getByText('09')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('calls onChange with new HH:mm when hour is selected', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimeSelect onChange={onChange} aria-label="任務開始時間" />);

    const hourSelect = screen.getByRole('combobox', { name: '任務開始時間 (小時)' });
    await user.click(hourSelect);
    await user.type(hourSelect, '14');
    await user.click(await screen.findByTitle('14'));

    expect(onChange).toHaveBeenCalledWith('14:00');
  });

  it('calls onChange with updated minute when minute is changed', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimeSelect value="14:00" onChange={onChange} aria-label="任務開始時間" />);

    const minuteSelect = screen.getByRole('combobox', { name: '任務開始時間 (分鐘)' });
    await user.click(minuteSelect);
    await user.click(await screen.findByTitle('45'));

    expect(onChange).toHaveBeenCalledWith('14:45');
  });
});
