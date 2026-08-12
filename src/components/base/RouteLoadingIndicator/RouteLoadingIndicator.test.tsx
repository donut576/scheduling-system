import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import NProgress from 'nprogress';
import RouteLoadingIndicator from './index';

// Mock useNavigation from react-router-dom so we can control navigation.state
// without needing a full router setup.
const mockUseNavigation = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigation: () => mockUseNavigation(),
}));

vi.mock('nprogress', () => ({
  default: {
    configure: vi.fn(),
    start: vi.fn(),
    done: vi.fn(),
  },
}));

/**
 * Unit tests for RouteLoadingIndicator.
 * Validates: Requirements 17.3（路由切換時顯示全域載入指示器）
 */
describe('RouteLoadingIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts NProgress when navigation state is "loading"', () => {
    mockUseNavigation.mockReturnValue({ state: 'loading' });
    render(<RouteLoadingIndicator />);
    expect(NProgress.start).toHaveBeenCalledTimes(1);
    expect(NProgress.done).not.toHaveBeenCalled();
  });

  it('starts NProgress when navigation state is "submitting"', () => {
    mockUseNavigation.mockReturnValue({ state: 'submitting' });
    render(<RouteLoadingIndicator />);
    expect(NProgress.start).toHaveBeenCalledTimes(1);
    expect(NProgress.done).not.toHaveBeenCalled();
  });

  it('calls NProgress.done when navigation state is "idle"', () => {
    mockUseNavigation.mockReturnValue({ state: 'idle' });
    render(<RouteLoadingIndicator />);
    expect(NProgress.done).toHaveBeenCalledTimes(1);
    expect(NProgress.start).not.toHaveBeenCalled();
  });

  it('renders nothing visible in the DOM', () => {
    mockUseNavigation.mockReturnValue({ state: 'idle' });
    const { container } = render(<RouteLoadingIndicator />);
    expect(container).toBeEmptyDOMElement();
  });
});
