import * as XLSX from 'xlsx';

export interface ExcelColumn<T> {
  header: string;
  key: keyof T | ((record: T) => string | number);
  width?: number;
}

/**
 * Export data to Excel (.xlsx) file
 * @param data Array of records to export
 * @param columns Column configuration with headers and data mapping
 * @param filename Name of the downloaded file (without extension)
 */
export const exportToExcel = <T extends object>(
  data: T[],
  columns: ExcelColumn<T>[],
  filename: string,
): void => {
  // Build headers
  const headers = columns.map((col) => col.header);

  // Build data rows
  const rows = data.map((record) =>
    columns.map((col) => {
      if (typeof col.key === 'function') {
        return col.key(record);
      }
      const value = (record as Record<string, unknown>)[col.key as string];
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      if (value === null || value === undefined) {
        return '';
      }
      return String(value);
    }),
  );

  // Create worksheet
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = columns.map((col) => ({ wch: col.width || 15 }));

  // Create workbook and append worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  // Trigger download
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * Export data with auto-generated filename including current date
 */
export const exportToExcelWithDate = <T extends object>(
  data: T[],
  columns: ExcelColumn<T>[],
  prefix: string,
): void => {
  const dateStr = new Date().toISOString().split('T')[0];
  exportToExcel(data, columns, `${prefix}_${dateStr}`);
};
