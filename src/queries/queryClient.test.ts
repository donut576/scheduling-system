import { describe, it, expect } from 'vitest';
import { queryClient } from './queryClient';

describe('queryClient', () => {
  it('configures queries with retry 3', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(3);
  });

  it('configures queries with exponential backoff retryDelay', () => {
    const defaults = queryClient.getDefaultOptions();
    const retryDelay = defaults.queries?.retryDelay as (attempt: number) => number;
    expect(retryDelay(0)).toBe(1000); // 1000 * 2^0 = 1000
    expect(retryDelay(1)).toBe(2000); // 1000 * 2^1 = 2000
    expect(retryDelay(2)).toBe(4000); // 1000 * 2^2 = 4000
    expect(retryDelay(3)).toBe(8000); // 1000 * 2^3 = 8000
    expect(retryDelay(10)).toBe(30000); // capped at 30000
  });

  it('configures queries with staleTime of 5 minutes', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(5 * 60 * 1000);
  });

  it('configures queries with gcTime of 10 minutes', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.gcTime).toBe(10 * 60 * 1000);
  });

  it('disables refetchOnWindowFocus', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('configures mutations with retry 0', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.mutations?.retry).toBe(0);
  });

  it('configures mutations with global onError handler', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.mutations?.onError).toBeDefined();
    expect(typeof defaults.mutations?.onError).toBe('function');
  });
});
