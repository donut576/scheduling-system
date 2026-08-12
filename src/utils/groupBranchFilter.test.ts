import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getBranchesForGroup } from './groupBranchFilter';
import type { CustomerGroup, CustomerBranch } from '@/types/customer';

/**
 * Property 6: 集團分店連動篩選
 * **Validates: Requirements 3.2**
 *
 * For any selected group, the branch options should contain only and all branches
 * belonging to that group — no extras, no omissions.
 */
describe('Property 6: 集團分店連動篩選 (Group-Branch Cascading Filter)', () => {
  // Generator for a CustomerBranch with a specific groupId
  const arbBranch = (groupId: string): fc.Arbitrary<CustomerBranch> =>
    fc.record({
      id: fc.uuid(),
      groupId: fc.constant(groupId),
      name: fc.string({ minLength: 1, maxLength: 20 }),
      address: fc.string({ minLength: 1, maxLength: 50 }),
      latitude: fc.option(fc.double({ min: -90, max: 90, noNaN: true }), { nil: undefined }),
      longitude: fc.option(fc.double({ min: -180, max: 180, noNaN: true }), { nil: undefined }),
      contactName: fc.string({ minLength: 1, maxLength: 10 }),
      contactPhone: fc.string({ minLength: 8, maxLength: 12 }),
      requiredLicenses: fc.constant([]),
    });

  // Generator for a CustomerGroup with 0-10 branches
  const arbGroup: fc.Arbitrary<CustomerGroup> = fc.uuid().chain((groupId) =>
    fc.record({
      id: fc.constant(groupId),
      name: fc.string({ minLength: 1, maxLength: 20 }),
      branches: fc.array(arbBranch(groupId), { minLength: 0, maxLength: 10 }),
    }),
  );

  // Generator for a list of 1-5 groups
  const arbGroups: fc.Arbitrary<CustomerGroup[]> = fc.array(arbGroup, {
    minLength: 1,
    maxLength: 5,
  });

  it('should return only branches with groupId matching the selected group', () => {
    fc.assert(
      fc.property(arbGroups, (groups) => {
        // Pick a random group from the list
        const selectedGroup = groups[0]!;
        const result = getBranchesForGroup(groups, selectedGroup.id);

        // All returned branches must have groupId === selectedGroup.id
        for (const branch of result) {
          expect(branch.groupId).toBe(selectedGroup.id);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('should not omit any branch belonging to the selected group', () => {
    fc.assert(
      fc.property(arbGroups, (groups) => {
        const selectedGroup = groups[0]!;
        const result = getBranchesForGroup(groups, selectedGroup.id);

        // Every branch in the original group should appear in the result
        for (const branch of selectedGroup.branches) {
          expect(result).toContainEqual(branch);
        }

        // The count should match exactly
        expect(result.length).toBe(selectedGroup.branches.length);
      }),
      { numRuns: 200 },
    );
  });

  it('should return a subset of all branches across all groups', () => {
    fc.assert(
      fc.property(arbGroups, (groups) => {
        const selectedGroup = groups[0]!;
        const result = getBranchesForGroup(groups, selectedGroup.id);

        // Collect all branches from all groups
        const allBranches = groups.flatMap((g) => g.branches);

        // Every returned branch should exist in the complete branch pool
        for (const branch of result) {
          expect(allBranches).toContainEqual(branch);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('should return empty array when groupId does not exist', () => {
    fc.assert(
      fc.property(arbGroups, fc.uuid(), (groups, nonExistentId) => {
        // Ensure the generated ID is not in the groups list
        const existingIds = new Set(groups.map((g) => g.id));
        fc.pre(!existingIds.has(nonExistentId));

        const result = getBranchesForGroup(groups, nonExistentId);
        expect(result).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it('should not include branches from other groups', () => {
    fc.assert(
      fc.property(
        // Need at least 2 groups to test cross-group isolation
        fc.array(arbGroup, { minLength: 2, maxLength: 5 }),
        (groups) => {
          const selectedGroup = groups[0]!;
          const result = getBranchesForGroup(groups, selectedGroup.id);

          // Collect branches from OTHER groups
          const otherBranches = groups
            .filter((g) => g.id !== selectedGroup.id)
            .flatMap((g) => g.branches);

          // No branch from another group should appear in the result
          for (const otherBranch of otherBranches) {
            expect(result).not.toContainEqual(otherBranch);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
