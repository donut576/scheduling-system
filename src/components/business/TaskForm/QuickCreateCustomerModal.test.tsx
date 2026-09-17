import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuickCreateCustomerModal from './QuickCreateCustomerModal';

const mockMutateAsync = vi.fn();

vi.mock('@/queries/useCustomerQueries', () => ({
  useCreateCustomer: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

describe('QuickCreateCustomerModal', () => {
  const defaultProps = {
    open: true,
    initialGroupName: '王品集團',
    initialBranchName: '',
    isNewGroup: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with initial values for new group', () => {
    render(<QuickCreateCustomerModal {...defaultProps} />);

    expect(screen.getByText('快速建立新客戶集團與分店')).toBeInTheDocument();
    const groupInput = screen.getByTestId('quick-create-group-name') as HTMLInputElement;
    expect(groupInput.value).toBe('王品集團');
    expect(groupInput).not.toBeDisabled();

    const branchInput = screen.getByTestId('quick-create-branch-name') as HTMLInputElement;
    expect(branchInput.value).toBe('總部 / 一店');

    const addressInput = screen.getByTestId('quick-create-address') as HTMLInputElement;
    expect(addressInput.value).toBe('');
  });

  it('renders disabled group name input when adding a branch to existing group', () => {
    render(
      <QuickCreateCustomerModal
        {...defaultProps}
        isNewGroup={false}
        initialGroupName="鼎泰豐"
        initialBranchName="微風店"
      />,
    );

    expect(screen.getByText('為「鼎泰豐」新增分店')).toBeInTheDocument();
    const groupInput = screen.getByTestId('quick-create-group-name') as HTMLInputElement;
    expect(groupInput.value).toBe('鼎泰豐');
    expect(groupInput).toBeDisabled();

    const branchInput = screen.getByTestId('quick-create-branch-name') as HTMLInputElement;
    expect(branchInput.value).toBe('微風店');
  });

  it('detects and shows region when address is typed', async () => {
    const user = userEvent.setup();
    render(<QuickCreateCustomerModal {...defaultProps} />);

    const addressInput = screen.getByTestId('quick-create-address');
    await user.type(addressInput, '新竹市科學園區研新二路1號');

    expect(await screen.findByText(/新竹組/)).toBeInTheDocument();
  });

  it('validates fields and calls create mutation and onSuccess when submitted', async () => {
    const user = userEvent.setup();
    const fakeCustomer = {
      id: 'branch-new-1',
      groupId: 'group-new-1',
      groupName: '王品集團',
      branchName: '信義旗艦店',
      address: '台北市信義區松壽路12號',
    };
    mockMutateAsync.mockResolvedValueOnce(fakeCustomer);

    render(<QuickCreateCustomerModal {...defaultProps} />);

    const branchInput = screen.getByTestId('quick-create-branch-name');
    await user.clear(branchInput);
    await user.type(branchInput, '信義旗艦店');

    const addressInput = screen.getByTestId('quick-create-address');
    await user.type(addressInput, '台北市信義區松壽路12號');

    const submitBtn = screen.getByText('確定建立並帶入');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          groupName: '王品集團',
          branchName: '信義旗艦店',
          address: '台北市信義區松壽路12號',
        }),
      );
      expect(defaultProps.onSuccess).toHaveBeenCalledWith(fakeCustomer);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });
});
