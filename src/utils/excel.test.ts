/**
 * 測試對象：src/utils/excel.ts
 * 涵蓋 exportToExcel 匯出功能，透過 mock XLSX.writeFile 攔截產生之工作簿，
 * 並使用 property-based tests（fast-check）驗證匯出資料筆數、表頭、
 * 各儲存格數值轉換（含函式型欄位對應）與來源資料完全一致。
 */
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import * as XLSX from 'xlsx';
import { exportToExcel, ExcelColumn } from './excel';

// Mock XLSX.writeFile to prevent file system interaction during tests
vi.mock('xlsx', async () => {
  const actual = await vi.importActual<typeof import('xlsx')>('xlsx');
  return {
    ...actual,
    writeFile: vi.fn(),
  };
});

/**
 * Property 12: 匯出資料一致性
 * 驗證：for any 篩選條件與任務資料集，匯出內容與篩選結果完全一致
 * **Validates: Requirements 6.1**
 */
describe('Property 12: 匯出資料一致性', () => {
  // Generate a non-empty dataset with consistent keys
  const datasetArb = fc
    .array(
      fc.string({ minLength: 1, maxLength: 8 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
      { minLength: 1, maxLength: 5 },
    )
    .chain((keys) => {
      // Generate rows that all have the same keys
      const rowArb = fc.record(
        Object.fromEntries(
          keys.map((key) => [
            key,
            fc.oneof(
              fc.string({ maxLength: 30 }),
              fc.integer({ min: -9999, max: 9999 }).map(String),
              fc.constant(null as unknown),
              fc.constant(undefined as unknown),
              fc.array(fc.string({ minLength: 1, maxLength: 8 }), {
                minLength: 1,
                maxLength: 3,
              }),
            ),
          ]),
        ),
      ) as fc.Arbitrary<Record<string, unknown>>;

      return fc
        .tuple(fc.constant(keys), fc.array(rowArb, { minLength: 1, maxLength: 20 }))
        .map(([k, rows]) => ({ keys: k, rows }));
    });

  it('exported row count matches input data length', () => {
    fc.assert(
      fc.property(datasetArb, ({ keys, rows }) => {
        // Build columns from keys
        const columns: ExcelColumn<Record<string, unknown>>[] = keys.map((key) => ({
          header: `Header_${key}`,
          key: key as keyof Record<string, unknown>,
        }));

        // Capture the workbook by intercepting XLSX.writeFile
        let capturedWb: XLSX.WorkBook | null = null;
        vi.mocked(XLSX.writeFile).mockImplementation((wb) => {
          capturedWb = wb as XLSX.WorkBook;
        });

        exportToExcel(rows, columns, 'test');

        expect(capturedWb).not.toBeNull();
        const ws = capturedWb!.Sheets['Sheet1'];
        expect(ws).toBeDefined();
        const sheetData = XLSX.utils.sheet_to_json<string[]>(ws!, { header: 1 });

        // First row is headers, remaining rows are data
        const dataRows = sheetData.slice(1);
        expect(dataRows.length).toBe(rows.length);
      }),
      { numRuns: 100 },
    );
  });

  it('exported headers match column configuration', () => {
    fc.assert(
      fc.property(datasetArb, ({ keys, rows }) => {
        const columns: ExcelColumn<Record<string, unknown>>[] = keys.map((key) => ({
          header: `Header_${key}`,
          key: key as keyof Record<string, unknown>,
        }));

        let capturedWb: XLSX.WorkBook | null = null;
        vi.mocked(XLSX.writeFile).mockImplementation((wb) => {
          capturedWb = wb as XLSX.WorkBook;
        });

        exportToExcel(rows, columns, 'test');

        expect(capturedWb).not.toBeNull();
        const ws = capturedWb!.Sheets['Sheet1'];
        expect(ws).toBeDefined();
        const sheetData = XLSX.utils.sheet_to_json<string[]>(ws!, { header: 1 });

        const exportedHeaders = sheetData[0];
        const expectedHeaders = columns.map((col) => col.header);
        expect(exportedHeaders).toEqual(expectedHeaders);
      }),
      { numRuns: 100 },
    );
  });

  it('exported cell values match source data after transformation', () => {
    fc.assert(
      fc.property(datasetArb, ({ keys, rows }) => {
        const columns: ExcelColumn<Record<string, unknown>>[] = keys.map((key) => ({
          header: `Header_${key}`,
          key: key as keyof Record<string, unknown>,
        }));

        let capturedWb: XLSX.WorkBook | null = null;
        vi.mocked(XLSX.writeFile).mockImplementation((wb) => {
          capturedWb = wb as XLSX.WorkBook;
        });

        exportToExcel(rows, columns, 'test');

        expect(capturedWb).not.toBeNull();
        const ws = capturedWb!.Sheets['Sheet1'];
        expect(ws).toBeDefined();
        const sheetData = XLSX.utils.sheet_to_json<string[]>(ws!, {
          header: 1,
          raw: false,
          defval: '',
        });

        const dataRows = sheetData.slice(1);

        // For each row, verify each cell matches the expected transformation
        rows.forEach((record, rowIdx) => {
          columns.forEach((col, colIdx) => {
            const value = record[col.key as string];
            let expected: string;
            if (Array.isArray(value)) {
              expected = value.join(', ');
            } else if (value === null || value === undefined) {
              expected = '';
            } else {
              expected = String(value);
            }

            const actual = dataRows[rowIdx]?.[colIdx] ?? '';
            expect(actual).toBe(expected);
          });
        });
      }),
      { numRuns: 100 },
    );
  });

  it('column function mappings produce correct export values', () => {
    // Test with function-based column keys
    const dataArb = fc.array(
      fc.record({
        firstName: fc.string({ minLength: 1, maxLength: 10 }),
        lastName: fc.string({ minLength: 1, maxLength: 10 }),
        age: fc.integer({ min: 0, max: 120 }),
      }),
      { minLength: 1, maxLength: 15 },
    );

    fc.assert(
      fc.property(dataArb, (rows) => {
        type PersonRecord = { firstName: string; lastName: string; age: number };
        const columns: ExcelColumn<PersonRecord>[] = [
          { header: 'Full Name', key: (r) => `${r.firstName} ${r.lastName}` },
          { header: 'Age', key: 'age' as keyof PersonRecord },
        ];

        let capturedWb: XLSX.WorkBook | null = null;
        vi.mocked(XLSX.writeFile).mockImplementation((wb) => {
          capturedWb = wb as XLSX.WorkBook;
        });

        exportToExcel(
          rows as unknown as Record<string, unknown>[],
          columns as unknown as ExcelColumn<Record<string, unknown>>[],
          'test',
        );

        expect(capturedWb).not.toBeNull();
        const ws = capturedWb!.Sheets['Sheet1'];
        expect(ws).toBeDefined();
        const sheetData = XLSX.utils.sheet_to_json<string[]>(ws!, {
          header: 1,
          raw: false,
          defval: '',
        });

        const dataRows = sheetData.slice(1);
        expect(dataRows.length).toBe(rows.length);

        rows.forEach((record, idx) => {
          const expectedFullName = `${record.firstName} ${record.lastName}`;
          const dataRow = dataRows[idx];
          expect(dataRow).toBeDefined();
          expect(dataRow?.[0]).toBe(expectedFullName);
          expect(dataRow?.[1]).toBe(String(record.age));
        });
      }),
      { numRuns: 100 },
    );
  });
});
