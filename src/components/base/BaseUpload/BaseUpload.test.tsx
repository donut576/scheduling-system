// 測試對象：BaseUpload（通用檔案上傳元件）
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BaseUpload from './index';

describe('BaseUpload', () => {
  const defaultProps = {
    action: '/api/upload',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload area with default hint text', () => {
    render(<BaseUpload {...defaultProps} />);

    expect(screen.getByText('點擊或拖曳檔案至此區域上傳')).toBeInTheDocument();
    expect(screen.getByText('支援的檔案大小上限：10.0 MB')).toBeInTheDocument();
  });

  it('renders custom hint text when provided', () => {
    render(<BaseUpload {...defaultProps} hint="僅支援 PDF 檔案" />);

    expect(screen.getByText('僅支援 PDF 檔案')).toBeInTheDocument();
  });

  it('rejects files exceeding max size limit', async () => {
    const messageSpy = vi.spyOn((await import('antd')).message, 'error');

    const onChange = vi.fn();
    render(<BaseUpload {...defaultProps} onChange={onChange} />);

    // Create a file larger than 10MB (10485760 bytes)
    const largeFile = new File([new ArrayBuffer(10485761)], 'large.pdf', {
      type: 'application/pdf',
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await userEvent.upload(input, largeFile);

    await waitFor(() => {
      expect(messageSpy).toHaveBeenCalledWith(expect.stringContaining('超過大小限制'));
    });

    messageSpy.mockRestore();
  });

  it('accepts files within size limit', async () => {
    const onChange = vi.fn();
    render(<BaseUpload {...defaultProps} onChange={onChange} />);

    // Create a file smaller than 10MB
    const smallFile = new File(['hello world'], 'small.txt', {
      type: 'text/plain',
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await userEvent.upload(input, smallFile);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });

  it('renders disabled state correctly', () => {
    render(<BaseUpload {...defaultProps} disabled />);

    const dragger = document.querySelector('.ant-upload-disabled');
    expect(dragger).toBeInTheDocument();
  });
});
