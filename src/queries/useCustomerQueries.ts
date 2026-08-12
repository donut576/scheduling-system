import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { customerApi } from '@/api/customer';
import type { CustomerListParams, CustomerFormData } from '@/api/customer';
import type { Customer, CustomerGroup } from '@/types/customer';
import type { PaginatedResponse } from '@/types/common';

// Query key factory for customer-related queries
export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (params: CustomerListParams) => [...customerKeys.lists(), params] as const,
  groups: () => [...customerKeys.all, 'groups'] as const,
};

/**
 * Hook for fetching paginated customer list with filtering and AbortSignal support.
 * Uses keepPreviousData for smooth pagination transitions.
 *
 * Validates: Requirements 10.1
 */
export function useCustomerList(params: CustomerListParams) {
  return useQuery<PaginatedResponse<Customer>>({
    queryKey: customerKeys.list(params),
    queryFn: async ({ signal }) => {
      const response = await customerApi.list(params, signal);
      return response.data.data;
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * Hook for fetching customer groups (for cascader/select dropdowns).
 */
export function useCustomerGroups() {
  return useQuery<CustomerGroup[]>({
    queryKey: customerKeys.groups(),
    queryFn: async ({ signal }) => {
      const response = await customerApi.groups(signal);
      return response.data.data;
    },
  });
}

/**
 * Mutation hook for creating a new customer.
 * Invalidates customer list queries on success.
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation<Customer, Error, CustomerFormData>({
    mutationFn: async (data) => {
      const response = await customerApi.create(data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

/**
 * Mutation hook for updating an existing customer.
 * Invalidates customer list queries on success.
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation<Customer, Error, { id: string; data: Partial<CustomerFormData> }>({
    mutationFn: async ({ id, data }) => {
      const response = await customerApi.update(id, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

/**
 * Mutation hook for deleting a customer.
 * Invalidates customer list queries on success.
 */
export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation<null, Error, string>({
    mutationFn: async (id) => {
      const response = await customerApi.delete(id);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}
