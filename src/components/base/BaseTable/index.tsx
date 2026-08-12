import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Table, Button, List, Spin, Empty } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import type { SorterResult } from 'antd/es/table/interface';
import type { PaginatedResponse } from '@/types/common';
import { exportToExcel, type ExcelColumn } from '@/utils/excel';
import { useIsMobile } from '@/hooks/useMediaQuery';

// Minimal type matching TanStack Query's UseQueryResult shape
export interface QueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export interface ColumnDef<T> {
  title: string;
  dataIndex?: string;
  key: string;
  sorter?: boolean | ((a: T, b: T) => number);
  render?: (value: unknown, record: T, index: number) => ReactNode;
  width?: number | string;
  fixed?: 'left' | 'right';
  ellipsis?: boolean;
  exportHeader?: string;
  exportKey?: keyof T | ((record: T) => string | number);
}

export interface SearchFieldConfig {
  name: string;
  label: string;
  type: 'input' | 'select' | 'datePicker' | 'rangePicker' | 'cascader';
  options?: { label: string; value: string | number }[];
  placeholder?: string;
}

export interface BaseTableProps<T extends object> {
  columns: ColumnDef<T>[];
  queryHook: () => QueryResult<PaginatedResponse<T>>;
  searchFields?: SearchFieldConfig[];
  exportable?: boolean;
  onRowClick?: (record: T) => void;
  cardRender?: (record: T) => ReactNode;
  rowKey?: string | ((record: T) => string);
}

function BaseTable<T extends object>({
  columns,
  queryHook,
  exportable = false,
  onRowClick,
  cardRender,
  rowKey = 'id',
}: BaseTableProps<T>) {
  const { data, isLoading, isError } = queryHook();
  const isMobile = useIsMobile();

  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const [sortInfo, setSortInfo] = useState<{
    field?: string;
    order?: 'ascend' | 'descend';
  }>({});

  // Sync pagination from server response
  useEffect(() => {
    if (data) {
      setPagination((prev) => ({
        ...prev,
        page: data.page,
        pageSize: data.pageSize,
      }));
    }
  }, [data]);

  const handleTableChange: NonNullable<TableProps<T>['onChange']> = useCallback(
    (paginationConfig, _filters, sorter) => {
      const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const { field, order } = (singleSorter ?? {}) as SorterResult<T>;

      setSortInfo({
        field: field as string | undefined,
        order: order ?? undefined,
      });

      if (paginationConfig?.current && paginationConfig?.pageSize) {
        setPagination({
          page: paginationConfig.current,
          pageSize: paginationConfig.pageSize,
        });
      }
    },
    [],
  );

  const handleExport = useCallback(() => {
    if (!data?.list) return;

    const excelColumns: ExcelColumn<T>[] = columns
      .filter((col) => col.exportHeader || col.dataIndex)
      .map((col) => ({
        header: col.exportHeader || col.title,
        key: col.exportKey || (col.dataIndex as keyof T),
        width: typeof col.width === 'number' ? col.width / 8 : 15,
      }));

    exportToExcel(data.list, excelColumns, `export_${Date.now()}`);
  }, [data, columns]);

  const getRowKey = useCallback(
    (record: T): string => {
      if (typeof rowKey === 'function') {
        return rowKey(record);
      }
      const value = (record as Record<string, unknown>)[rowKey];
      return String(value ?? '');
    },
    [rowKey],
  );

  // Mobile card mode
  if (isMobile && cardRender) {
    return (
      <div className="base-table-mobile">
        {exportable && (
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={!data?.list?.length}
            >
              匯出
            </Button>
          </div>
        )}

        {isLoading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        )}

        {isError && <Empty description="載入失敗" />}

        {!isLoading && !isError && data && (
          <List
            dataSource={data.list}
            pagination={{
              current: pagination.page,
              pageSize: pagination.pageSize,
              total: data.total,
              onChange: (page, pageSize) => {
                setPagination({ page, pageSize });
              },
              size: 'small',
              showSizeChanger: false,
            }}
            renderItem={(item) => (
              <div
                key={getRowKey(item)}
                onClick={() => onRowClick?.(item)}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onRowClick(item);
                  }
                }}
              >
                {cardRender(item)}
              </div>
            )}
          />
        )}
      </div>
    );
  }

  // Desktop table mode
  const antColumns = columns.map((col) => ({
    title: col.title,
    dataIndex: col.dataIndex,
    key: col.key,
    sorter: col.sorter,
    render: col.render,
    width: col.width,
    fixed: col.fixed,
    ellipsis: col.ellipsis,
    sortOrder: sortInfo.field === col.dataIndex ? sortInfo.order : undefined,
  }));

  return (
    <div className="base-table">
      {exportable && (
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!data?.list?.length}>
            匯出
          </Button>
        </div>
      )}

      <Table<T>
        columns={antColumns}
        dataSource={data?.list}
        loading={isLoading}
        rowKey={rowKey}
        onChange={handleTableChange}
        onRow={(record) => ({
          onClick: () => onRowClick?.(record),
          style: { cursor: onRowClick ? 'pointer' : 'default' },
        })}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 筆`,
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
        locale={{
          emptyText: isError ? '載入失敗' : '暫無資料',
        }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}

export default BaseTable;
