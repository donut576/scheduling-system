import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import RecurrenceModifyScopeDialog from './RecurrenceModifyScope';

// Mock matchMedia for Ant Design
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

describe('RecurrenceModifyScopeDialog', () => {
  it('renders modal with title and radio options when open', () => {
    render(<RecurrenceModifyScopeDialog open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('修改週期任務')).toBeInTheDocument();
    expect(screen.getByText('請選擇要修改的範圍：')).toBeInTheDocument();
    expect(screen.getByLabelText('僅此次')).toBeInTheDocument();
    expect(screen.getByLabelText('此次及之後')).toBeInTheDocument();
  });

  it('defaults to "this" (僅此次) selection', () => {
    render(<RecurrenceModifyScopeDialog open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const thisRadio = screen.getByLabelText('僅此次') as HTMLInputElement;
    expect(thisRadio.checked).toBe(true);
  });

  it('calls onConfirm with "this" when confirm button clicked with default', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(<RecurrenceModifyScopeDialog open={true} onConfirm={onConfirm} onCancel={vi.fn()} />);

    // Ant Design renders button text with spaces between characters (確 認)
    const okButton = screen.getByText(/確\s*認/);
    await user.click(okButton);
    expect(onConfirm).toHaveBeenCalledWith('this');
  });

  it('calls onConfirm with "thisAndFuture" when that option is selected', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(<RecurrenceModifyScopeDialog open={true} onConfirm={onConfirm} onCancel={vi.fn()} />);

    await user.click(screen.getByLabelText('此次及之後'));
    const okButton = screen.getByText(/確\s*認/);
    await user.click(okButton);
    expect(onConfirm).toHaveBeenCalledWith('thisAndFuture');
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<RecurrenceModifyScopeDialog open={true} onConfirm={vi.fn()} onCancel={onCancel} />);

    const cancelButton = screen.getByText(/取\s*消/);
    await user.click(cancelButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not render content when open is false', () => {
    render(<RecurrenceModifyScopeDialog open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByText('修改週期任務')).not.toBeInTheDocument();
  });
});
