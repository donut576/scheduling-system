/**
 * 測試對象：AlertBadge 元件
 * 驗證各狀態（normal/warning/overridden/recurring）之顯示文字、色彩、
 * 自訂與預設 tooltip 內容，以及無障礙 aria-label 屬性是否正確。
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import AlertBadge from './index';

describe('AlertBadge', () => {
  it('renders normal status with green tag', () => {
    render(<AlertBadge status="normal" />);
    const badge = screen.getByTestId('alert-badge-normal');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('正常');
  });

  it('renders warning status with red tag', () => {
    render(<AlertBadge status="warning" />);
    const badge = screen.getByTestId('alert-badge-warning');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('警示');
  });

  it('renders overridden status with orange tag', () => {
    render(<AlertBadge status="overridden" />);
    const badge = screen.getByTestId('alert-badge-overridden');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('已核准');
  });

  it('renders recurring status with infinity symbol', () => {
    render(<AlertBadge status="recurring" />);
    const badge = screen.getByTestId('alert-badge-recurring');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('∞');
    expect(badge).toHaveTextContent('週期任務');
  });

  it('uses custom tooltip text when provided', async () => {
    const user = userEvent.setup();
    render(<AlertBadge status="warning" tooltip="有 2 項違規" />);
    const badge = screen.getByTestId('alert-badge-warning');
    expect(badge).toHaveAttribute('aria-label', '有 2 項違規');

    // Hover to trigger tooltip
    await user.hover(badge);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('有 2 項違規');
  });

  it('uses default label as tooltip when tooltip prop is not provided', async () => {
    const user = userEvent.setup();
    render(<AlertBadge status="normal" />);
    const badge = screen.getByTestId('alert-badge-normal');
    expect(badge).toHaveAttribute('aria-label', '正常');

    await user.hover(badge);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('正常');
  });

  it('has correct aria-label for accessibility', () => {
    render(<AlertBadge status="overridden" tooltip="違規已由主管覆蓋" />);
    const badge = screen.getByTestId('alert-badge-overridden');
    expect(badge).toHaveAttribute('aria-label', '違規已由主管覆蓋');
  });
});
