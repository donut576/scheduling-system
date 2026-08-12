import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { pendingCustomerApi } from '@/api/pending-customer';
import type {
  PendingCustomerListParams,
  PendingCustomerFormData,
  ConvertToTaskData,
} from '@/api/pending-customer';
import type { PendingCustomer } from '@/types/customer';
import type { PaginatedResponse } from '@/types/common';
import { taskKeys } from './useTaskQueries';

// Query key factory for pending-customer-related queries
export const pendingCustomerKeys = {
  all: ['pending-customers'] as const,
  lists: () => [...pendingCustomerKeys.all, 'list'] as const,
  list: (params: PendingCustomerListParams) => [...pendingCustomerKeys.lists(), params] as const,
};

/**
 * Hook for fetching paginated pending customer list with filtering and AbortSignal support.
 * Uses keepPreviousData for smooth pagination transitions.
 *
 * Validates: Requirements 14.1
 */
export function usePendingCustomerList(params: PendingCustomerListParams) {
  return useQuery<PaginatedResponse<PendingCustomer>>({
    queryKey: pendingCustomerKeys.list(params),
    queryFn: async ({ signal }) => {
      const response = await pendingCustomerApi.list(params, signal);
      return response.data.data;
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * Mutation hook for creating a new pending customer.
 * Invalidates pending customer list queries on success.
 */
export function useCreatePendingCustomer() {
  const queryClient = useQueryClient();

  return useMutation<PendingCustomer, Error, PendingCustomerFormData>({
    mutationFn: async (data) => {
      const response = await pendingCustomerApi.create(data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingCustomerKeys.lists() });
    },
  });
}

/**
 * Mutation hook for updating an existing pending customer.
 * Invalidates pending customer list queries on success.
 */
export function useUpdatePendingCustomer() {
  const queryClient = useQueryClient();

  return useMutation<
    PendingCustomer,
    Error,
    { id: string; data: Partial<PendingCustomerFormData> }
  >({
    mutationFn: async ({ id, data }) => {
      const response = await pendingCustomerApi.update(id, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingCustomerKeys.lists() });
    },
  });
}

/**
 * Mutation hook for converting a pending customer to a formal task.
 * Invalidates both pending customer list and task list queries on success,
 * since conversion creates a new task.
 */
export function useConvertPendingCustomer() {
  const queryClient = useQueryClient();

  return useMutation<null, Error, { id: string; data: ConvertToTaskData }>({
    mutationFn: async ({ id, data }) => {
      const response = await pendingCustomerApi.convert(id, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingCustomerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
