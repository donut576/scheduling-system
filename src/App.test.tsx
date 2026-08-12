// React Router's data router (createBrowserRouter) internally constructs a
// `Request` with an AbortSignal on every navigation. Node 24's undici-backed
// `Request` implementation rejects jsdom's AbortSignal instances as invalid,
// causing an unrelated crash during navigation in the jsdom test environment
// (see https://github.com/vitest-dev/vitest/issues/8374). happy-dom does not
// hit this incompatibility, so this file only is run under happy-dom.
// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from './App';
import { useUserStore } from '@/stores/useUserStore';

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

describe('App', () => {
  beforeEach(() => {
    // No token: default route (/) → /dashboard (RouteGuard) → redirected to /login
    useUserStore.setState({ token: null, user: null, loginFailCount: 0 });
  });

  it('renders without crashing and redirects unauthenticated users to the login page', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('藝康排班系統')).toBeInTheDocument();
    });
    // LoginPage's form should be present, confirming the router + guard chain resolved
    expect(screen.getByRole('button', { name: '登入' })).toBeInTheDocument();
  });
});
