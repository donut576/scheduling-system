import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CopyScheduleModal from './index';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('CopyScheduleModal', () => {
  it('renders correctly with default source and target range', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <CopyScheduleModal
          open={true}
          onCancel={vi.fn()}
          defaultSourceRange={{ start: '2026-08-24', end: '2026-08-30' }}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText('快速複製排班')).toBeInTheDocument();
    expect(screen.getByText('來源區間')).toBeInTheDocument();
    expect(screen.getByText('目標區間')).toBeInTheDocument();
    expect(screen.getByText('下一週')).toBeInTheDocument();
    expect(screen.getByText('全體員工')).toBeInTheDocument();
    expect(screen.getByText('開始複製')).toBeInTheDocument();
  });

  it('allows clicking quick target buttons like 下一週', async () => {
    const queryClient = createTestQueryClient();
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <CopyScheduleModal
          open={true}
          onCancel={vi.fn()}
          defaultSourceRange={{ start: '2026-08-24', end: '2026-08-30' }}
        />
      </QueryClientProvider>,
    );

    const nextWeekBtn = screen.getByRole('button', { name: '下一週' });
    await user.click(nextWeekBtn);
  });

  it('calls onCancel when close button is clicked', async () => {
    const queryClient = createTestQueryClient();
    const user = userEvent.setup();
    const handleCancel = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <CopyScheduleModal
          open={true}
          onCancel={handleCancel}
          defaultSourceRange={{ start: '2026-08-24', end: '2026-08-30' }}
        />
      </QueryClientProvider>,
    );

    const closeBtn = screen.getAllByLabelText('Close')[0] as HTMLElement;
    await user.click(closeBtn);
    expect(handleCancel).toHaveBeenCalled();
  });
});
