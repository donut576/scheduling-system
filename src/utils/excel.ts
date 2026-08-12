/**
 * Excel 匯出工具模組。
 *
 * 提供將任意物件陣列匯出為 .xlsx 檔案並觸發瀏覽器下載之功能，
 * 支援自訂欄位標題、資料對應（含函式運算欄位）與欄寬設定。
 */
import * as XLSX from 'xlsx';

export interface ExcelColumn<T> {
  /** 顯示於 Excel 表頭之欄位名稱 */
  header: string;
  /** 資料來源鍵值：可為物件屬性名稱，或接收整筆記錄並回傳顯示值之函式 */
  key: keyof T | ((record: T) => string | number);
  /** 欄寬（字元數），未指定時預設為 15 */
  width?: number;
}

/**
 * 將資料匯出為 Excel (.xlsx) 檔案並觸發下載。
 *
 * @param data 欲匯出之記錄陣列
 * @param columns 欄位設定，定義表頭文字與資料對應方式
 * @param filename 下載檔案名稱（不含副檔名）
 */
export const exportToExcel = <T extends object>(
  data: T[],
  columns: ExcelColumn<T>[],
  filename: string,
): void => {
  // 依欄位設定建立表頭列
  const headers = columns.map((col) => col.header);

  // 依欄位設定將每筆記錄轉換為對應的資料列
  const rows = data.map((record) =>
    columns.map((col) => {
      if (typeof col.key === 'function') {
        // 欄位為函式時，直接以整筆記錄呼叫取得顯示值
        return col.key(record);
      }
      const value = (record as Record<string, unknown>)[col.key as string];
      if (Array.isArray(value)) {
        // 陣列類型的值以逗號串接顯示
        return value.join(', ');
      }
      if (value === null || value === undefined) {
        return '';
      }
      return String(value);
    }),
  );

  // 建立工作表：第一列為表頭，其餘為資料列
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 依欄位設定套用各欄寬度，未指定則預設 15 字元寬
  ws['!cols'] = columns.map((col) => ({ wch: col.width || 15 }));

  // 建立工作簿並將工作表附加進去
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  // 觸發瀏覽器下載該 Excel 檔案
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * 匯出資料並自動於檔名加上目前日期（格式：prefix_YYYY-MM-DD.xlsx）。
 *
 * @param data 欲匯出之記錄陣列
 * @param columns 欄位設定
 * @param prefix 檔名前綴，日期會自動附加於其後
 */
export const exportToExcelWithDate = <T extends object>(
  data: T[],
  columns: ExcelColumn<T>[],
  prefix: string,
): void => {
  const dateStr = new Date().toISOString().split('T')[0];
  exportToExcel(data, columns, `${prefix}_${dateStr}`);
};
