/**
 * 測試對象：ConflictPanel 元件
 * 驗證違規清單渲染（規則名稱、嚴重度、訊息、受影響員工）、
 * 覆蓋備註輸入與確認覆蓋按鈕行為，以及無覆蓋權限時的提示訊息。
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import ConflictPanel from './index';
import type { AlertViolation } from '@/types/alert';

// Mock window.matchMedia for Ant Design responsive components
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

const mockViolations: AlertViolation[] = [
  {
    ruleId: 'LICENSE_REQUIRED',
    severity: 'BLOCKING',
    message: '指派員工中無人持有客戶要求之證照',
    details: { required: ['PROFESSIONAL'] },
    affectedEmployees: ['emp-001', 'emp-002'],
  },
  {
    ruleId: 'CONSECUTIVE_DAYS',
    severity: 'BLOCKING',
    message: '指派員工連續工作超過七日',
    details: { maxAllowed: 7 },
    affectedEmployees: ['emp-001'],
  },
];

describe('ConflictPanel', () => {
  let onOverride: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onOverride = vi.fn();
  });

  it('renders nothing when violations array is empty', () => {
    const { container } = render(
      <ConflictPanel violations={[]} onOverride={onOverride} canOverride={true} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders alert banner with violation count', () => {
    render(
      <ConflictPanel violations={mockViolations} onOverride={onOverride} canOverride={true} />,
    );
    expect(screen.getByText(/偵測到 2 項違規/)).toBeInTheDocument();
  });

  it('renders each violation with rule name, severity, message, and affected employees', () => {
    render(
      <ConflictPanel violations={mockViolations} onOverride={onOverride} canOverride={true} />,
    );

    // Rule names
    expect(screen.getByText('證照要求')).toBeInTheDocument();
    expect(screen.getByText('連續工作超過七日')).toBeInTheDocument();

    // Severity tags
    const blockingTags = screen.getAllByText('BLOCKING');
    expect(blockingTags).toHaveLength(2);

    // Messages
    expect(screen.getByText('指派員工中無人持有客戶要求之證照')).toBeInTheDocument();
    expect(screen.getByText('指派員工連續工作超過七日')).toBeInTheDocument();

    // Affected employees
    expect(screen.getByText('影響員工：emp-001、emp-002')).toBeInTheDocument();
    expect(screen.getByText('影響員工：emp-001')).toBeInTheDocument();
  });

  it('does not render affected employees when the array is absent', () => {
    const violationsWithout: AlertViolation[] = [
      {
        ruleId: 'HEADCOUNT_BELOW_MIN',
        severity: 'BLOCKING',
        message: '指派人數低於最低需求人數',
        details: { required: 3, actual: 1 },
      },
    ];

    render(
      <ConflictPanel violations={violationsWithout} onOverride={onOverride} canOverride={true} />,
    );

    expect(screen.queryByText(/影響員工/)).not.toBeInTheDocument();
  });

  describe('when canOverride is true', () => {
    it('renders the remark text area and override button', () => {
      render(
        <ConflictPanel violations={mockViolations} onOverride={onOverride} canOverride={true} />,
      );

      expect(screen.getByLabelText('覆蓋備註')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '確認覆蓋' })).toBeInTheDocument();
    });

    it('disables the override button when remark is empty', () => {
      render(
        <ConflictPanel violations={mockViolations} onOverride={onOverride} canOverride={true} />,
      );

      expect(screen.getByRole('button', { name: '確認覆蓋' })).toBeDisabled();
    });

    it('enables the override button when remark is entered', async () => {
      const user = userEvent.setup();
      render(
        <ConflictPanel violations={mockViolations} onOverride={onOverride} canOverride={true} />,
      );

      await user.type(screen.getByLabelText('覆蓋備註'), '主管核准');
      expect(screen.getByRole('button', { name: '確認覆蓋' })).toBeEnabled();
    });

    it('calls onOverride with trimmed remark when override button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ConflictPanel violations={mockViolations} onOverride={onOverride} canOverride={true} />,
      );

      await user.type(screen.getByLabelText('覆蓋備註'), '  主管已核准覆蓋  ');
      await user.click(screen.getByRole('button', { name: '確認覆蓋' }));

      expect(onOverride).toHaveBeenCalledWith('主管已核准覆蓋');
    });

    it('does not call onOverride when remark is only whitespace', async () => {
      const user = userEvent.setup();
      render(
        <ConflictPanel violations={mockViolations} onOverride={onOverride} canOverride={true} />,
      );

      await user.type(screen.getByLabelText('覆蓋備註'), '   ');
      // Button should still be disabled
      expect(screen.getByRole('button', { name: '確認覆蓋' })).toBeDisabled();
    });

    it('does not show the no-permission alert', () => {
      render(
        <ConflictPanel violations={mockViolations} onOverride={onOverride} canOverride={true} />,
      );

      expect(screen.queryByText(/您無權限覆蓋此違規/)).not.toBeInTheDocument();
    });
  });

  describe('when canOverride is false', () => {
    it('shows the no-permission alert message', () => {
      render(
        <ConflictPanel violations={mockViolations} onOverride={onOverride} canOverride={false} />,
      );

      expect(screen.getByText(/您無權限覆蓋此違規/)).toBeInTheDocument();
    });

    it('does not render the remark text area or override button', () => {
      render(
        <ConflictPanel violations={mockViolations} onOverride={onOverride} canOverride={false} />,
      );

      expect(screen.queryByLabelText('覆蓋備註')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '確認覆蓋' })).not.toBeInTheDocument();
    });

    it('still shows all violations', () => {
      render(
        <ConflictPanel violations={mockViolations} onOverride={onOverride} canOverride={false} />,
      );

      expect(screen.getByText('證照要求')).toBeInTheDocument();
      expect(screen.getByText('連續工作超過七日')).toBeInTheDocument();
    });
  });

  it('has accessible region role with label', () => {
    render(
      <ConflictPanel violations={mockViolations} onOverride={onOverride} canOverride={true} />,
    );

    expect(screen.getByRole('region', { name: '排班衝突面板' })).toBeInTheDocument();
  });
});
