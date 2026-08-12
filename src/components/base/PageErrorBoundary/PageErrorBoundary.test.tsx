import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PageErrorBoundary from './index';

/** Component that throws during render to trigger the error boundary. */
function Bomb(): React.ReactElement {
  throw new Error('Boom!');
}

describe('PageErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress React's error boundary console noise while keeping our own spy assertions.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children normally when no error occurs', () => {
    render(
      <PageErrorBoundary>
        <div>Normal content</div>
      </PageErrorBoundary>,
    );

    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('catches a thrown error from a child and renders the fallback UI', () => {
    render(
      <PageErrorBoundary>
        <Bomb />
      </PageErrorBoundary>,
    );

    expect(screen.getByText('頁面發生錯誤')).toBeInTheDocument();
    expect(screen.getByText('Boom!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新載入' })).toBeInTheDocument();
  });

  it('logs the caught error via console.error', () => {
    render(
      <PageErrorBoundary>
        <Bomb />
      </PageErrorBoundary>,
    );

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('calls window.location.reload when the reload button is clicked', () => {
    const reloadMock = vi.fn();
    const originalLocation = window.location;

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });

    render(
      <PageErrorBoundary>
        <Bomb />
      </PageErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: '重新載入' }));

    expect(reloadMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
