import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW server instance used to intercept HTTP requests during tests.
 *
 * Validates: Requirements 17.1
 */
export const server = setupServer(...handlers);
