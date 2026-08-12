import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import LoginPage from './index';
import { useUserStore } from '@/stores/useUserStore';
import { usePermissionStore } from '@/stores/usePermissionStore';

// Mock window.matchMedia for Ant Design responsive components
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

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock authApi
vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
  },
}));

// Import the mocked authApi after mocking
import { authApi } from '@/api/auth';

/**
 * Unit Tests for 登入頁面 (Login Page)
 * Validates: Requirements 1.1, 1.2, 1.3
 */
describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset stores
    useUserStore.setState({ token: null, user: null, loginFailCount: 0 });
    usePermissionStore.getState().reset();
  });

  describe('表單渲染 (Form Rendering) - Requirement 1.1', () => {
    it('renders account input field', () => {
      render(<LoginPage />);
      expect(screen.getByLabelText('帳號或員工編號')).toBeInTheDocument();
    });

    it('renders password input field', () => {
      render(<LoginPage />);
      expect(screen.getByLabelText('密碼')).toBeInTheDocument();
    });

    it('renders login button', () => {
      render(<LoginPage />);
      expect(screen.getByRole('button', { name: '登入' })).toBeInTheDocument();
    });

    it('renders system title', () => {
      render(<LoginPage />);
      expect(screen.getByText('藝康排班系統')).toBeInTheDocument();
    });
  });

  describe('驗證碼觸發條件 (Captcha Trigger) - Requirement 1.2', () => {
    it('does NOT show captcha field when loginFailCount < 3', () => {
      useUserStore.setState({ loginFailCount: 0 });
      render(<LoginPage />);
      expect(screen.queryByLabelText('驗證碼')).not.toBeInTheDocument();
    });

    it('does NOT show captcha field when loginFailCount is 2', () => {
      useUserStore.setState({ loginFailCount: 2 });
      render(<LoginPage />);
      expect(screen.queryByLabelText('驗證碼')).not.toBeInTheDocument();
    });

    it('shows captcha field when loginFailCount >= 3', () => {
      useUserStore.setState({ loginFailCount: 3 });
      render(<LoginPage />);
      expect(screen.getByLabelText('驗證碼')).toBeInTheDocument();
    });

    it('shows captcha field when loginFailCount is 5', () => {
      useUserStore.setState({ loginFailCount: 5 });
      render(<LoginPage />);
      expect(screen.getByLabelText('驗證碼')).toBeInTheDocument();
    });

    it('shows warning message when captcha is displayed', () => {
      useUserStore.setState({ loginFailCount: 3 });
      render(<LoginPage />);
      expect(screen.getByText(/連續登入失敗 3 次/)).toBeInTheDocument();
    });
  });

  describe('驗證碼圖片鍵盤導航 (Captcha Keyboard Navigation) - Requirement 16.4', () => {
    it('captcha image is keyboard-focusable and refreshes on Enter key', async () => {
      useUserStore.setState({ loginFailCount: 3 });
      render(<LoginPage />);

      const captchaImg = screen.getByAltText('驗證碼圖片，點擊或按 Enter 鍵刷新');
      expect(captchaImg).toHaveAttribute('tabIndex', '0');
      expect(captchaImg).toHaveAttribute('role', 'button');

      const srcBefore = captchaImg.getAttribute('src');
      captchaImg.focus();
      expect(captchaImg).toHaveFocus();

      await userEvent.setup().keyboard('{Enter}');

      await waitFor(() => {
        expect(captchaImg.getAttribute('src')).not.toBe(srcBefore);
      });
    });
  });

  describe('登入失敗計數遞增 (Login Failure Count) - Requirement 1.2', () => {
    it('increments loginFailCount on login failure', async () => {
      vi.mocked(authApi.login).mockRejectedValueOnce(new Error('Invalid credentials'));

      useUserStore.setState({ loginFailCount: 0 });
      render(<LoginPage />);

      const user = userEvent.setup();
      await user.type(screen.getByLabelText('帳號或員工編號'), 'testuser');
      await user.type(screen.getByLabelText('密碼'), 'wrongpass');
      await user.click(screen.getByRole('button', { name: '登入' }));

      await waitFor(() => {
        expect(useUserStore.getState().loginFailCount).toBe(1);
      });
    });

    it('increments loginFailCount from existing count on subsequent failure', async () => {
      vi.mocked(authApi.login).mockRejectedValueOnce(new Error('Invalid credentials'));

      useUserStore.setState({ loginFailCount: 2 });
      render(<LoginPage />);

      const user = userEvent.setup();
      await user.type(screen.getByLabelText('帳號或員工編號'), 'testuser');
      await user.type(screen.getByLabelText('密碼'), 'wrongpass');
      await user.click(screen.getByRole('button', { name: '登入' }));

      await waitFor(() => {
        expect(useUserStore.getState().loginFailCount).toBe(3);
      });
    });
  });

  describe('登入成功 Token 儲存 (Token Storage) - Requirement 1.3', () => {
    it('stores token in userStore on successful login', async () => {
      const mockResponse = {
        data: {
          data: {
            accessToken: 'mock-jwt-token-12345',
            expiresIn: 3600,
            user: {
              id: 'u1',
              name: 'Test User',
              employeeNo: 'E001',
              role: 'STAFF' as const,
              permissions: ['task:view', 'schedule:view'],
              groupId: 'g1',
            },
          },
        },
      };
      vi.mocked(authApi.login).mockResolvedValueOnce(mockResponse as never);

      render(<LoginPage />);

      const user = userEvent.setup();
      await user.type(screen.getByLabelText('帳號或員工編號'), 'testuser');
      await user.type(screen.getByLabelText('密碼'), 'correctpass');
      await user.click(screen.getByRole('button', { name: '登入' }));

      await waitFor(() => {
        expect(useUserStore.getState().token).toBe('mock-jwt-token-12345');
      });
    });

    it('stores user profile on successful login', async () => {
      const mockUser = {
        id: 'u1',
        name: 'Test User',
        employeeNo: 'E001',
        role: 'ADMIN' as const,
        permissions: ['task:view', 'schedule:view', 'customer:view'],
        groupId: 'g1',
      };
      const mockResponse = {
        data: {
          data: {
            accessToken: 'token-abc',
            expiresIn: 3600,
            user: mockUser,
          },
        },
      };
      vi.mocked(authApi.login).mockResolvedValueOnce(mockResponse as never);

      render(<LoginPage />);

      const user = userEvent.setup();
      await user.type(screen.getByLabelText('帳號或員工編號'), 'admin');
      await user.type(screen.getByLabelText('密碼'), 'adminpass');
      await user.click(screen.getByRole('button', { name: '登入' }));

      await waitFor(() => {
        expect(useUserStore.getState().user).toEqual(mockUser);
      });
    });

    it('resets loginFailCount on successful login', async () => {
      useUserStore.setState({ loginFailCount: 4 });

      const mockResponse = {
        data: {
          data: {
            accessToken: 'token-xyz',
            expiresIn: 3600,
            user: {
              id: 'u2',
              name: 'User 2',
              employeeNo: 'E002',
              role: 'STAFF' as const,
              permissions: [],
            },
          },
        },
      };
      vi.mocked(authApi.login).mockResolvedValueOnce(mockResponse as never);

      render(<LoginPage />);

      const user = userEvent.setup();
      await user.type(screen.getByLabelText('帳號或員工編號'), 'user2');
      await user.type(screen.getByLabelText('密碼'), 'pass123');
      // Since loginFailCount >= 3, captcha is required
      await user.type(screen.getByLabelText('驗證碼'), '1234');
      await user.click(screen.getByRole('button', { name: '登入' }));

      await waitFor(() => {
        expect(useUserStore.getState().loginFailCount).toBe(0);
      });
    });

    it('navigates to dashboard on successful login', async () => {
      const mockResponse = {
        data: {
          data: {
            accessToken: 'token-nav',
            expiresIn: 3600,
            user: {
              id: 'u3',
              name: 'Nav User',
              employeeNo: 'E003',
              role: 'MANAGER' as const,
              permissions: ['task:view'],
            },
          },
        },
      };
      vi.mocked(authApi.login).mockResolvedValueOnce(mockResponse as never);

      render(<LoginPage />);

      const user = userEvent.setup();
      await user.type(screen.getByLabelText('帳號或員工編號'), 'manager');
      await user.type(screen.getByLabelText('密碼'), 'pass456');
      await user.click(screen.getByRole('button', { name: '登入' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });
  });
});
