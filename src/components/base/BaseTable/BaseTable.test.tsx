import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BaseTable, { type QueryResult, type ColumnDef } from './index';
import type { PaginatedResponse } from '@/types/common';

interface TestRecord extends Record<string, unknown> {
  id: string;
  name: string;
  status: string;
}

const mockData: PaginatedResponse<TestRecord> = {
  list: [
    { id: '1', name: 'Alice', status: 'active' },
    { id: '2', name: 'Bob', status: 'inactive' },
    { id: '3', name: 'Charlie', status: 'active' },
  ],
  total: 3,
  page: 1,
  pageSize: 10,
};

const columns: ColumnDef<TestRecord>[] = [
  { title: 'Name', dataIndex: 'name', key: 'name', sorter: true },
  { title: 'Status', dataIndex: 'status', key: 'status' },
];

function createMockQueryHook(
  overrides: Partial<QueryResult<PaginatedResponse<TestRecord>>> = {},
): () => QueryResult<PaginatedResponse<TestRecord>> {
  return () => ({
    data: mockData,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  });
}

// Mock window.matchMedia
function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('BaseTable', () => {
  beforeEach(() => {
    mockMatchMedia(false); // Desktop by default
  });

  it('renders table with data', () => {
    render(<BaseTable columns={columns} queryHook={createMockQueryHook()} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<BaseTable columns={columns} queryHook={createMockQueryHook()} />);

    expect(screen.getAllByText('Name').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading state', () => {
    render(
      <BaseTable
        columns={columns}
        queryHook={createMockQueryHook({ data: undefined, isLoading: true })}
      />,
    );

    const spinner = document.querySelector('.ant-spin-spinning');
    expect(spinner).toBeInTheDocument();
  });

  it('shows pagination with total count', () => {
    render(<BaseTable columns={columns} queryHook={createMockQueryHook()} />);

    expect(screen.getByText('共 3 筆')).toBeInTheDocument();
  });

  it('handles onRowClick callback', () => {
    const onRowClick = vi.fn();
    render(
      <BaseTable columns={columns} queryHook={createMockQueryHook()} onRowClick={onRowClick} />,
    );

    fireEvent.click(screen.getByText('Alice'));
    expect(onRowClick).toHaveBeenCalledWith(mockData.list[0]);
  });

  it('supports custom rowKey as string', () => {
    render(<BaseTable columns={columns} queryHook={createMockQueryHook()} rowKey="id" />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('supports custom rowKey as function', () => {
    render(
      <BaseTable
        columns={columns}
        queryHook={createMockQueryHook()}
        rowKey={(record) => `custom-${record.id}`}
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders export button when exportable is true', () => {
    render(<BaseTable columns={columns} queryHook={createMockQueryHook()} exportable />);

    expect(screen.getByText('匯出')).toBeInTheDocument();
  });

  it('does not render export button when exportable is false', () => {
    render(<BaseTable columns={columns} queryHook={createMockQueryHook()} exportable={false} />);

    expect(screen.queryByText('匯出')).not.toBeInTheDocument();
  });

  it('shows error message on error state', () => {
    render(
      <BaseTable
        columns={columns}
        queryHook={createMockQueryHook({
          data: undefined,
          isError: true,
          error: new Error('Failed'),
        })}
      />,
    );

    expect(screen.getByText('載入失敗')).toBeInTheDocument();
  });

  describe('responsive card mode', () => {
    beforeEach(() => {
      mockMatchMedia(true); // Mobile
    });

    it('renders card list when isMobile and cardRender is provided', () => {
      const cardRender = (record: TestRecord) => (
        <div data-testid={`card-${record.id}`}>{record.name} Card</div>
      );

      render(
        <BaseTable columns={columns} queryHook={createMockQueryHook()} cardRender={cardRender} />,
      );

      expect(screen.getByTestId('card-1')).toBeInTheDocument();
      expect(screen.getByText('Alice Card')).toBeInTheDocument();
      expect(screen.getByText('Bob Card')).toBeInTheDocument();
    });

    it('renders table when isMobile but cardRender is not provided', () => {
      mockMatchMedia(true);

      render(<BaseTable columns={columns} queryHook={createMockQueryHook()} />);

      // Should render table (column headers present)
      expect(screen.getAllByText('Name').length).toBeGreaterThanOrEqual(1);
    });

    it('handles onRowClick in card mode', () => {
      const onRowClick = vi.fn();
      const cardRender = (record: TestRecord) => <div>{record.name} Card</div>;

      render(
        <BaseTable
          columns={columns}
          queryHook={createMockQueryHook()}
          cardRender={cardRender}
          onRowClick={onRowClick}
        />,
      );

      fireEvent.click(screen.getByText('Alice Card'));
      expect(onRowClick).toHaveBeenCalledWith(mockData.list[0]);
    });

    it('shows loading state in card mode', () => {
      const cardRender = (record: TestRecord) => <div>{record.name} Card</div>;

      render(
        <BaseTable
          columns={columns}
          queryHook={createMockQueryHook({ data: undefined, isLoading: true })}
          cardRender={cardRender}
        />,
      );

      const spinner = document.querySelector('.ant-spin-spinning');
      expect(spinner).toBeInTheDocument();
    });

    it('shows error state in card mode', () => {
      const cardRender = (record: TestRecord) => <div>{record.name} Card</div>;

      render(
        <BaseTable
          columns={columns}
          queryHook={createMockQueryHook({
            data: undefined,
            isError: true,
            error: new Error('Fail'),
          })}
          cardRender={cardRender}
        />,
      );

      expect(screen.getByText('載入失敗')).toBeInTheDocument();
    });

    it('renders export button in card mode', () => {
      const cardRender = (record: TestRecord) => <div>{record.name} Card</div>;

      render(
        <BaseTable
          columns={columns}
          queryHook={createMockQueryHook()}
          cardRender={cardRender}
          exportable
        />,
      );

      expect(screen.getByText('匯出')).toBeInTheDocument();
    });

    it('supports keyboard navigation on cards when onRowClick provided', () => {
      const onRowClick = vi.fn();
      const cardRender = (record: TestRecord) => <div>{record.name} Card</div>;

      render(
        <BaseTable
          columns={columns}
          queryHook={createMockQueryHook()}
          cardRender={cardRender}
          onRowClick={onRowClick}
        />,
      );

      const card = screen.getByText('Alice Card').parentElement!;
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(onRowClick).toHaveBeenCalledWith(mockData.list[0]);
    });
  });
});
