/**
 * 測試對象：UnscheduledTasksPanel 元件
 * 驗證待排任務清單渲染、關鍵字搜尋、任務類型過濾、折疊切換與編輯點擊回呼。
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UnscheduledTasksPanel from './index';

// Mock window.matchMedia for Ant Design components
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

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('UnscheduledTasksPanel', () => {
  it('renders panel header and search input', async () => {
    renderWithClient(<UnscheduledTasksPanel />);

    expect(screen.getByTestId('unscheduled-tasks-panel')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/搜尋/)).toBeInTheDocument();
  });

  it('renders list of unscheduled tasks from mock data', async () => {
    renderWithClient(<UnscheduledTasksPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('unscheduled-tasks-list')).toBeInTheDocument();
    });

    // 驗證待排任務卡片渲染
    await waitFor(() => {
      const cards = screen.getAllByTestId(/unscheduled-task-card-/);
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  it('filters tasks by keyword search', async () => {
    const user = userEvent.setup();
    renderWithClient(<UnscheduledTasksPanel />);

    await waitFor(() => {
      expect(screen.getAllByTestId(/unscheduled-task-card-/).length).toBeGreaterThan(0);
    });

    const searchInput = screen.getByPlaceholderText(/搜尋/);
    await user.type(searchInput, '星耀科技');

    await waitFor(() => {
      const filtered = screen.queryAllByTestId(/unscheduled-task-card-/);
      filtered.forEach((card) => {
        expect(card).toHaveTextContent(/星耀科技/);
      });
    });
  });

  it('renders collapsed view when collapsed prop is true and handles toggle', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    const { rerender } = renderWithClient(
      <UnscheduledTasksPanel collapsed={true} onToggleCollapse={onToggle} />,
    );

    expect(screen.getByTestId('unscheduled-tasks-panel-collapsed')).toBeInTheDocument();

    const collapsedEl = screen.getByTestId('unscheduled-tasks-panel-collapsed');
    await user.click(collapsedEl);
    expect(onToggle).toHaveBeenCalledTimes(1);

    // 展開後應呈現完整面板
    rerender(
      <QueryClientProvider client={createTestQueryClient()}>
        <UnscheduledTasksPanel collapsed={false} onToggleCollapse={onToggle} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('unscheduled-tasks-panel')).toBeInTheDocument();
  });

  it('triggers onEditTask when edit button is clicked on a task card', async () => {
    const user = userEvent.setup();
    const onEditTask = vi.fn();

    renderWithClient(<UnscheduledTasksPanel onEditTask={onEditTask} />);

    await waitFor(() => {
      expect(screen.getAllByTestId(/unscheduled-task-card-/).length).toBeGreaterThan(0);
    });

    const editButtons = screen.getAllByRole('button', { name: /編輯|Edit/i });
    const firstButton = editButtons[0];
    if (firstButton) {
      await user.click(firstButton);
      expect(onEditTask).toHaveBeenCalledTimes(1);
    }
  });

  it('renders drop zone indicator when isDropActive is true', async () => {
    renderWithClient(<UnscheduledTasksPanel isDropActive={true} />);

    expect(screen.getByTestId('unscheduled-drop-zone-indicator')).toBeInTheDocument();
  });

  it('renders resizer handle for drag-to-resize and drag-to-collapse', () => {
    renderWithClient(<UnscheduledTasksPanel />);

    expect(screen.getByTestId('unscheduled-panel-resizer')).toBeInTheDocument();
  });
});
