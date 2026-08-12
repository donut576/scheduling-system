import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import fc from 'fast-check';
import { server } from './mocks/server';

/**
 * Global test setup.
 * - Configures fast-check global defaults (numRuns: 100+) as a baseline
 *   for property-based tests that don't specify numRuns explicitly.
 * - Sets up the MSW server lifecycle. `onUnhandledRequest: 'bypass'` is
 *   used so tests that mock query hooks / axios directly (the prevailing
 *   pattern in this codebase) are unaffected by unmatched requests.
 * - Ensures RTL cleanup runs after every test.
 *
 * Validates: Requirements 17.1
 */

fc.configureGlobal({ numRuns: 100 });

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
