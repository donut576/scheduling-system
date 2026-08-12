import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import TaskForm from './index';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type { CustomerGroup } from '@/types/customer';
import type { Employee } from '@/types/employee';
import type { Task } from '@/types/task';

/**
 * Integration test for the full task creation flow:
 * 開啟 TaskForm → 填寫欄位 → 儲存 → 預檢觸發 → 覆蓋 → 成功
 *
 * Unlike TaskForm.test.tsx (unit tests that mock ConflictPanel, EmployeeSelect,
 * RecurrenceEditor and the query hooks), this test exercises the REAL
 * ConflictPanel component and lets the real TanStack Query hooks hit the
 * network layer, which is intercepted by MSW (src/test/mocks/server.ts).
 *
 * The HEADCOUNT_BELOW_MIN rule (Requirement 7.6) is used to deterministically
 * trigger the front-end pre-check (Requirement 3.7) violation: headcount is
 * set to 2 while no assignees are selected, which requires no additional
 * license/existing-task setup to reliably fire.
 *
 * Validates: Requirements 3.1, 3.7, 3.8, 7.7
 */

// Mock matchMedia for Ant Design responsive components
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

const ok = <T,>(data: T): ApiResponse<T> => ({ code: 0, message: 'success', data });

const testGroup: CustomerGroup = {
  id: 'test-group-1',
  name: '測試集團X',
  branches: [
    {
      id: 'test-branch-1',
      groupId: 'test-group-1',
      name: '測試分店X',
      address: '台北市信義區',
      contactName: '測試聯絡人',
      contactPhone: '0900000000',
      // No required licenses so only the HEADCOUNT_BELOW_MIN rule can fire.
      requiredLicenses: [],
    },
  ],
};

const testEmployee: Employee = {
  id: 'test-emp-1',
  name: '測試員工',
  phone: '0911111111',
  employeeNo: 'E999',
  position: 'STAFF',
  groupId: 'test-group-1',
  groupName: '測試集團X',
  groupColor: '#1677ff',
  designatedLeaves: [],
  licenses: [],
  isActive: true,
};

/**
 * Override the default MSW handlers for this test so the form has
 * deterministic, known data to interact with: a single customer group with
 * a single branch (no required licenses), a single employee, and an empty
 * existing task list (so no other alert rules can fire).
 */
const useDeterministicHandlers = () => {
  server.use(
    http.get('*/api/v1/customers/groups', () =>
      HttpResponse.json(ok<CustomerGroup[]>([testGroup])),
    ),
    http.get('*/api/v1/employees', () =>
      HttpResponse.json(
        ok<PaginatedResponse<Employee>>({
          list: [testEmployee],
          total: 1,
          page: 1,
          pageSize: 500,
        }),
      ),
    ),
    http.get('*/api/v1/tasks', () =>
      HttpResponse.json(
        ok<PaginatedResponse<Task>>({ list: [], total: 0, page: 1, pageSize: 200 }),
      ),
    ),
    http.post('*/api/v1/tasks', () => HttpResponse.json(ok<null>(null))),
  );
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
};

/**
 * Ant Design's rc-picker based DatePicker/TimePicker inputs don't respond
 * reliably to userEvent.type character-by-character in jsdom. The standard
 * workaround is to fire a `change` event with the full value followed by an
 * `Enter` keydown to confirm the selection and close the panel.
 */
const setPickerValue = (label: string, value: string) => {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
};

describe('TaskForm integration - 完整任務建立流程', () => {
  let onSubmit: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useDeterministicHandlers();
    onSubmit = vi.fn().mockResolvedValue(undefined);
    onCancel = vi.fn();
  });

  it('開啟 TaskForm → 填寫欄位 → 儲存 → 預檢觸發 → 覆蓋 → 成功', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TaskForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);

    // 開啟 TaskForm - wait for customer group data (from MSW) to load
    const groupSelect = screen.getByRole('combobox', { name: '集團' });
    await user.click(groupSelect);
    await user.click(await screen.findByTitle('測試集團X'));

    // 分店 becomes enabled once a group is selected
    const branchSelect = await screen.findByRole('combobox', { name: '分店' });
    await waitFor(() => expect(branchSelect).not.toBeDisabled());
    await user.click(branchSelect);
    await user.click(await screen.findByTitle('測試分店X'));

    // 填寫欄位：日期、起訖時間
    setPickerValue('任務日期', '2026-02-10');

    // 時間下拉選單為 48 筆虛擬捲動清單，先輸入搜尋文字縮小選項範圍再點選，
    // 避免遠端選項因虛擬捲動未渲染而找不到。
    const startTimeSelect = screen.getByRole('combobox', { name: '開始時間' });
    await user.click(startTimeSelect);
    await user.type(startTimeSelect, '09:00');
    await user.click(await screen.findByTitle('09:00'));

    const endTimeSelect = screen.getByRole('combobox', { name: '結束時間' });
    await user.click(endTimeSelect);
    await user.type(endTimeSelect, '17:00');
    await user.click(await screen.findByTitle('17:00'));

    // 班次為必填欄位
    const shiftSelect = screen.getByRole('combobox', { name: '班次' });
    await user.click(shiftSelect);
    await user.click(await screen.findByTitle('早班'));

    // 人數：設為 2，但不指派任何員工，以確保觸發人數不足違規 (Requirement 7.6)
    const headcountInput = screen.getByRole('spinbutton', { name: '人數需求' });
    await user.clear(headcountInput);
    await user.type(headcountInput, '2');

    // 內容：至少勾選一項
    await user.click(screen.getByRole('checkbox', { name: 'P' }));

    // 儲存 - 觸發前端預檢 (Requirement 3.7)
    await user.click(screen.getByRole('button', { name: '儲存' }));

    // 預檢觸發：ConflictPanel（真實元件）顯示 HEADCOUNT_BELOW_MIN 違規 (Requirement 3.8)
    const violationItem = await screen.findByTestId('violation-item-HEADCOUNT_BELOW_MIN');
    expect(violationItem).toBeInTheDocument();
    expect(screen.getByText('人數不足')).toBeInTheDocument();

    // onSubmit must not have been called yet - blocked by the violation
    expect(onSubmit).not.toHaveBeenCalled();

    // 覆蓋：輸入覆蓋備註並點擊「確認覆蓋」(Requirement 7.7)
    const remarkInput = screen.getByLabelText('覆蓋備註');
    await user.type(remarkInput, '人手調度中，先建立任務');

    const overrideButton = screen.getByRole('button', { name: '確認覆蓋' });
    expect(overrideButton).not.toBeDisabled();
    await user.click(overrideButton);

    // 成功：onSubmit 被呼叫並帶有正確的表單資料
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const submittedData = onSubmit.mock.calls[0]?.[0];
    expect(submittedData).toMatchObject({
      groupId: 'test-group-1',
      branchId: 'test-branch-1',
      taskType: 'CONTRACT',
      date: '2026-02-10',
      startTime: '09:00',
      endTime: '17:00',
      headcount: 2,
      contents: ['P'],
      assignees: [],
    });
  }, // ConflictPanel, and multiple Ant Design pickers/selects - allow extra // This test exercises the real query hooks (via MSW), the real
  // time to avoid flakiness under parallel full-suite runs.
  15000);
});
