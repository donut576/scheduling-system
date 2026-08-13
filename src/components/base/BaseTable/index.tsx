/**
 * BaseTable - 通用資料表格元件
 *
 * 封裝 antd 的 Table，並整合分頁、排序、匯出 Excel、以及在行動裝置上自動切換
 * 為卡片清單（List）檢視等常見需求。資料來源透過泛型的 queryHook（相容 TanStack
 * Query 的 UseQueryResult 形狀）注入，使元件與實際的資料抓取邏輯解耦，方便各業務
 * 頁面重複使用同一套表格 UI 與互動行為。
 */
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Table, Button, List, Spin, Empty, Space } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import type { SorterResult } from 'antd/es/table/interface';
import { useTranslation } from 'react-i18next';
import type { PaginatedResponse } from '@/types/common';
import { exportToExcel, type ExcelColumn } from '@/utils/excel';
import { useIsMobile } from '@/hooks/useMediaQuery';

// 對應 TanStack Query 的 UseQueryResult 最小必要形狀，
// 讓 BaseTable 不需直接依賴 TanStack Query 套件即可相容任何回傳此結構的 hook
export interface QueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export interface ColumnDef<T> {
  /** 欄位標題 */
  title: ReactNode;
  /** 對應資料物件的欄位鍵名 */
  dataIndex?: string;
  /** React key，需在同一組 columns 中唯一 */
  key: string;
  /** 是否可排序，可傳入 boolean 或自訂比較函式 */
  sorter?: boolean | ((a: T, b: T) => number);
  /** 自訂該欄位的渲染方式 */
  render?: (value: unknown, record: T, index: number) => ReactNode;
  width?: number | string;
  /** 固定在表格左側或右側 */
  fixed?: 'left' | 'right';
  ellipsis?: boolean;
  /** 匯出 Excel 時使用的欄位標題，未提供則使用 title */
  exportHeader?: string;
  /** 匯出 Excel 時取值用的欄位鍵名或自訂取值函式 */
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
  /** 表格欄位設定 */
  columns: ColumnDef<T>[];
  /** 提供分頁資料的查詢 hook，回傳值需符合 QueryResult<PaginatedResponse<T>> 形狀 */
  queryHook: () => QueryResult<PaginatedResponse<T>>;
  searchFields?: SearchFieldConfig[];
  /** 是否顯示「匯出」按鈕，匯出成 Excel 檔案 */
  exportable?: boolean;
  /** 點擊資料列（桌面表格列或行動卡片）時的回呼 */
  onRowClick?: (record: T) => void;
  /** 行動裝置（或 cardLayout='always'）時，自訂每筆資料的卡片渲染內容 */
  cardRender?: (record: T) => ReactNode;
  /** 卡片檢視啟用時機：'mobile' 僅在偵測為行動裝置時啟用，'always' 一律使用卡片檢視 */
  cardLayout?: 'mobile' | 'always';
  /** 資料列唯一 key，可為欄位名稱字串或自訂取值函式 */
  rowKey?: string | ((record: T) => string);
  /** 顯示在工具列（匯出按鈕旁）的額外自訂內容 */
  toolbarExtra?: ReactNode;
  /** 依資料列回傳額外的 CSS class（例如標示已修改的資料列），桌面表格與行動卡片檢視皆會套用 */
  rowClassName?: (record: T) => string;
}

function BaseTable<T extends object>({
  columns,
  queryHook,
  exportable = false,
  onRowClick,
  cardRender,
  cardLayout = 'mobile',
  rowKey = 'id',
  toolbarExtra,
  rowClassName,
}: BaseTableProps<T>) {
  const { t } = useTranslation();
  // T 為泛型參數，代表單筆資料的型別；queryHook 由呼叫端注入，
  // 使 BaseTable 不需知道實際的 API 或狀態管理實作細節
  const { data, isLoading, isError } = queryHook();
  const isMobile = useIsMobile();

  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const [sortInfo, setSortInfo] = useState<{
    field?: string;
    order?: 'ascend' | 'descend';
  }>({});

  // 當伺服器回應的分頁資料（page/pageSize）改變時，同步更新本地分頁狀態，
  // 確保分頁元件顯示的頁碼與實際資料一致
  useEffect(() => {
    if (data) {
      setPagination((prev) => ({
        ...prev,
        page: data.page,
        pageSize: data.pageSize,
      }));
    }
  }, [data]);

  // antd Table 的 onChange 排序參數可能是單一物件或陣列（多欄排序），
  // 此處統一只取第一個排序條件，並同步分頁狀態
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

  // 依 columns 設定組出匯出 Excel 所需的欄位定義，
  // 僅匯出有設定 exportHeader 或 dataIndex 的欄位；width 由 px 概略轉換為 Excel 欄寬單位
  const handleExport = useCallback(() => {
    if (!data?.list) return;

    const excelColumns: ExcelColumn<T>[] = columns
      .filter((col) => col.exportHeader || col.dataIndex)
      .map((col) => ({
        header: col.exportHeader || (typeof col.title === 'string' ? col.title : col.key),
        key: col.exportKey || (col.dataIndex as keyof T),
        width: typeof col.width === 'number' ? col.width / 8 : 15,
      }));

    exportToExcel(data.list, excelColumns, `export_${Date.now()}`);
  }, [data, columns]);

  // 統一取得資料列 key 的邏輯：rowKey 可為欄位名稱字串或自訂函式
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

  const toolbar =
    toolbarExtra || exportable ? (
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Space wrap>
          {toolbarExtra}
          {exportable && (
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={!data?.list?.length}
            >
              {t('common.export')}
            </Button>
          )}
        </Space>
      </div>
    ) : null;

  // 卡片檢視模式：當偵測為行動裝置（或強制指定 cardLayout='always'）
  // 且呼叫端提供了 cardRender 時，改用 List 元件以卡片形式呈現每筆資料，
  // 取代原本的表格列，較適合小螢幕操作
  if ((isMobile || cardLayout === 'always') && cardRender) {
    return (
      <div className="base-table-mobile">
        {toolbar}

        {isLoading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        )}

        {isError && <Empty description={t('common.loadFailed')} />}

        {!isLoading && !isError && data && (
          <List
            // cardLayout='always' 時改用自訂 CSS Grid（見 index.css 的
            // .base-table-card-grid 規則）取代 antd 內建 Row/Col 斷點，精確控制
            // 欄數切換：<= 820px 單欄（卡片撐滿寬度）、> 820px 雙欄（固定卡寬 + 間隙）。
            className={cardLayout === 'always' ? 'base-table-card-grid' : undefined}
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
              <List.Item key={getRowKey(item)} style={{ display: 'block' }}>
                <div
                  className={['base-table-mobile-card', rowClassName?.(item)]
                    .filter(Boolean)
                    .join(' ')}
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
              </List.Item>
            )}
          />
        )}
      </div>
    );
  }

  // 桌面表格模式：將 ColumnDef 轉換為 antd Table 所需的欄位設定，
  // 並依目前的排序狀態（sortInfo）標記出對應欄位的 sortOrder
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
      {toolbar}

      <Table<T>
        columns={antColumns}
        dataSource={data?.list}
        loading={isLoading}
        rowKey={rowKey}
        rowClassName={rowClassName}
        onChange={handleTableChange}
        onRow={(record) => ({
          onClick: () => onRowClick?.(record),
          style: { cursor: onRowClick ? 'pointer' : 'default' },
        })}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: data?.total ?? 0,
          position: ['bottomCenter'],
          showSizeChanger: true,
          showTotal: (total) => t('common.totalItems', { total }),
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
        locale={{
          emptyText: isError ? t('common.loadFailed') : t('common.noData'),
        }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}

export default BaseTable;
