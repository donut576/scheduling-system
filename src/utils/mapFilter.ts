/**
 * Map Marker Filtering Utility
 *
 * Pure filtering logic used by the map page to narrow down which customer
 * branch markers should be displayed based on the currently selected group
 * and/or branch filters.
 *
 * Design (Property 27: 地圖篩選正確性):
 * A customer is included in the result if and only if it matches every
 * *active* (defined) filter condition. An undefined filter value means that
 * dimension is not filtered (all values pass). This makes the function total
 * and side-effect free, so it can be property-tested independently of the
 * React/Leaflet rendering layer.
 *
 * Validates: Requirements 15.3
 */

import type { Customer } from '@/types/customer';

export interface MapFilterCriteria {
  groupId?: string;
  branchId?: string;
}

/**
 * Filters `customers` down to only those matching all active filter
 * conditions in `filters`. A filter dimension left `undefined` is treated as
 * "no constraint" for that dimension.
 *
 * @param customers - full list of customer branches to filter
 * @param filters - filter criteria (groupId/branchId), undefined = unconstrained
 * @returns the subset of `customers` matching every active filter condition
 */
export function filterCustomersByLocation(
  customers: Customer[],
  filters: MapFilterCriteria,
): Customer[] {
  const { groupId, branchId } = filters;

  return customers.filter((c) => {
    if (groupId && c.groupId !== groupId) return false;
    if (branchId && c.branchId !== branchId) return false;
    return true;
  });
}
