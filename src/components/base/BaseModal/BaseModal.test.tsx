import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import BaseModal from './index';

describe('BaseModal', () => {
  const defaultProps = {
    title: 'Test Modal',
    open: true,
    onOk: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with title and children', () => {
    render(
      <BaseModal {...defaultProps}>
        <p>Modal content</p>
      </BaseModal>,
    );

    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render content when open is false', () => {
    render(
      <BaseModal {...defaultProps} open={false}>
        <p>Modal content</p>
      </BaseModal>,
    );

    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('calls onOk when confirm button is clicked', () => {
    render(
      <BaseModal {...defaultProps}>
        <p>Content</p>
      </BaseModal>,
    );

    fireEvent.click(screen.getByText('OK'));
    expect(defaultProps.onOk).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <BaseModal {...defaultProps}>
        <p>Content</p>
      </BaseModal>,
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses default width of 520px', () => {
    render(
      <BaseModal {...defaultProps}>
        <p>Content</p>
      </BaseModal>,
    );

    const modal = document.querySelector('.ant-modal');
    expect(modal).toHaveStyle({ width: '520px' });
  });

  it('accepts custom width as number', () => {
    render(
      <BaseModal {...defaultProps} width={800}>
        <p>Content</p>
      </BaseModal>,
    );

    const modal = document.querySelector('.ant-modal');
    expect(modal).toHaveStyle({ width: '800px' });
  });

  it('accepts custom width as string', () => {
    render(
      <BaseModal {...defaultProps} width="60%">
        <p>Content</p>
      </BaseModal>,
    );

    const modal = document.querySelector('.ant-modal');
    expect(modal).toHaveStyle({ width: '60%' });
  });

  it('shows loading state when loading prop is true', () => {
    render(
      <BaseModal {...defaultProps} loading={true}>
        <p>Content</p>
      </BaseModal>,
    );

    // Cancel button should be disabled during loading
    const cancelBtn = screen.getByText('Cancel').closest('button');
    expect(cancelBtn).toBeDisabled();
  });

  it('disables cancel button while loading', () => {
    render(
      <BaseModal {...defaultProps} loading={true}>
        <p>Content</p>
      </BaseModal>,
    );

    const cancelBtn = screen.getByText('Cancel').closest('button');
    expect(cancelBtn).toBeDisabled();
  });

  it('handles async onOk and shows loading during promise resolution', async () => {
    let resolvePromise: () => void;
    const asyncOnOk = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePromise = resolve;
        }),
    );

    render(
      <BaseModal {...defaultProps} onOk={asyncOnOk}>
        <p>Content</p>
      </BaseModal>,
    );

    // Click OK to start async operation
    await act(async () => {
      fireEvent.click(screen.getByText('OK'));
    });

    // Cancel button should be disabled during async operation
    const cancelBtn = screen.getByText('Cancel').closest('button');
    expect(cancelBtn).toBeDisabled();

    // Resolve the promise
    await act(async () => {
      resolvePromise!();
    });

    // Cancel button should be enabled again after resolution
    await waitFor(() => {
      const btn = screen.getByText('Cancel').closest('button');
      expect(btn).not.toBeDisabled();
    });
  });

  it('clears loading state even if async onOk rejects', async () => {
    const asyncOnOk = vi.fn(() => Promise.reject(new Error('fail')));

    render(
      <BaseModal {...defaultProps} onOk={asyncOnOk}>
        <p>Content</p>
      </BaseModal>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('OK'));
    });

    // After rejection, cancel button should be re-enabled
    await waitFor(() => {
      const cancelBtn = screen.getByText('Cancel').closest('button');
      expect(cancelBtn).not.toBeDisabled();
    });
  });

  it('handles synchronous onOk without showing loading', () => {
    const syncOnOk = vi.fn();

    render(
      <BaseModal {...defaultProps} onOk={syncOnOk}>
        <p>Content</p>
      </BaseModal>,
    );

    fireEvent.click(screen.getByText('OK'));

    // Cancel button should remain enabled for sync operations
    const cancelBtn = screen.getByText('Cancel').closest('button');
    expect(cancelBtn).not.toBeDisabled();
  });
});
