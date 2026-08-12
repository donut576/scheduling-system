import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { debounce } from './debounce';

/**
 * **Validates: Requirements 17.6**
 *
 * Property 29: 防抖行為
 * For any 在 200 毫秒內之連續輸入序列，驗證請求應僅在最後一次輸入後 200 毫秒觸發一次，
 * 中間輸入不應產生請求。
 */

describe('debounce - property tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * **Validates: Requirements 17.6**
   *
   * Property 29: 防抖行為
   * For any sequence of rapid calls within 200ms, only the last call's argument
   * should trigger execution, and it should happen exactly once after the 200ms delay.
   */
  it('for any rapid call sequence within 200ms, only the last call triggers execution once', () => {
    fc.assert(
      fc.property(
        // Generate a sequence of 2-20 calls, each with a delay < 200ms between them
        fc.array(fc.integer({ min: 1, max: 199 }), { minLength: 2, maxLength: 20 }),
        (delays) => {
          const callback = vi.fn();
          const debounced = debounce(callback, 200);

          // Simulate rapid calls: each call happens within 200ms of the previous
          for (let i = 0; i < delays.length; i++) {
            debounced(i);
            // Advance time by less than 200ms (simulating rapid input)
            if (i < delays.length - 1) {
              vi.advanceTimersByTime(delays[i] as number);
            }
          }

          // Before the delay passes, callback should not have been called
          expect(callback).not.toHaveBeenCalled();

          // Advance time by 200ms to trigger the debounced execution
          vi.advanceTimersByTime(200);

          // Callback should be called exactly once with the last argument
          expect(callback).toHaveBeenCalledTimes(1);
          expect(callback).toHaveBeenCalledWith(delays.length - 1);

          // Clean up
          debounced.cancel();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 17.6**
   *
   * Property: intermediate inputs never produce a request during the debounce window.
   * At no point during the rapid call sequence should the callback have been invoked.
   */
  it('intermediate inputs within 200ms window never trigger the callback', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 199 }), { minLength: 2, maxLength: 15 }),
        (delays) => {
          const callback = vi.fn();
          const debounced = debounce(callback, 200);

          // Make all calls with less than 200ms gaps
          for (let i = 0; i < delays.length; i++) {
            debounced(i);

            if (i < delays.length - 1) {
              vi.advanceTimersByTime(delays[i] as number);
              // After each intermediate call, callback should still not have fired
              expect(callback).not.toHaveBeenCalled();
            }
          }

          // Clean up
          debounced.cancel();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 17.6**
   *
   * Property: execution happens exactly after 200ms from the last input.
   * At 199ms after last input, callback is not called. At 200ms, it is called.
   */
  it('execution triggers exactly after 200ms delay from the last input', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 10 }), (callCount) => {
        const callback = vi.fn();
        const debounced = debounce(callback, 200);

        // Make multiple rapid calls (all at once, no time gap)
        for (let i = 0; i < callCount; i++) {
          debounced(i);
        }

        // At 199ms, callback should not have been called
        vi.advanceTimersByTime(199);
        expect(callback).not.toHaveBeenCalled();

        // At 200ms (1 more ms), callback should fire
        vi.advanceTimersByTime(1);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(callCount - 1);

        // Clean up
        debounced.cancel();
      }),
      { numRuns: 100 },
    );
  });
});
