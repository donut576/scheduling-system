import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useUserStore } from './useUserStore';
import type { UserProfile, RoleType } from '@/types/auth';

/**
 * Property 1: 登入後使用者資料儲存完整性 (Login Profile Round-Trip)
 * Validates: Requirements 1.4
 *
 * For any UserProfile，存入 useUserStore 後取出之資料應完全一致。
 */
describe('Property 1: 登入後使用者資料儲存完整性 (Login Profile Round-Trip)', () => {
  // Arbitrary for RoleType
  const roleArb: fc.Arbitrary<RoleType> = fc.constantFrom(
    'ADMIN',
    'ADMIN_STAFF',
    'MANAGER',
    'LEADER',
    'STAFF',
  );

  // Arbitrary for UserProfile
  const userProfileArb: fc.Arbitrary<UserProfile> = fc.record({
    id: fc.string({ minLength: 1 }),
    name: fc.string({ minLength: 1 }),
    employeeNo: fc.string({ minLength: 1 }),
    role: roleArb,
    permissions: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 20 }),
    groupId: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
  });

  beforeEach(() => {
    // Reset store state before each test
    useUserStore.setState({ token: null, user: null, loginFailCount: 0 });
  });

  it('for any UserProfile, storing via setUser and retrieving yields identical data', () => {
    /**
     * **Validates: Requirements 1.4**
     */
    fc.assert(
      fc.property(userProfileArb, (profile) => {
        // Store the user profile
        useUserStore.getState().setUser(profile);

        // Retrieve the stored profile
        const stored = useUserStore.getState().user;

        // Verify all fields are identical
        expect(stored).not.toBeNull();
        expect(stored!.id).toBe(profile.id);
        expect(stored!.name).toBe(profile.name);
        expect(stored!.employeeNo).toBe(profile.employeeNo);
        expect(stored!.role).toBe(profile.role);
        expect(stored!.permissions).toEqual(profile.permissions);
        expect(stored!.groupId).toBe(profile.groupId);

        // Deep equality check
        expect(stored).toEqual(profile);
      }),
      { numRuns: 100 },
    );
  });

  it('for any UserProfile with token, both token and user are stored correctly after login simulation', () => {
    /**
     * **Validates: Requirements 1.4**
     */
    fc.assert(
      fc.property(userProfileArb, fc.string({ minLength: 1 }), (profile, token) => {
        // Simulate login: set token and user
        useUserStore.getState().setToken(token);
        useUserStore.getState().setUser(profile);

        // Retrieve state
        const state = useUserStore.getState();

        // Verify token is stored
        expect(state.token).toBe(token);

        // Verify user profile is stored identically
        expect(state.user).toEqual(profile);
      }),
      { numRuns: 100 },
    );
  });
});
