import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { approvalApi } from '@/api/approval';
import type { ApprovalListParams } from '@/api/approval';
import type { Approval } from '@/types/notification';
import type { PaginatedResponse } from '@/types/common';

// Query key factory for approval-related queries
export const approvalKeys = {
  all: ['approvals'] as const,
  lists: () => [...approvalKeys.all, 'list'] as const,
  list: (params: ApprovalListParams) => [...approvalKeys.lists(), params] as const,
};

/**
 * Hook for fetching paginated approval request list with filtering and AbortSignal support.
 * Uses keepPreviousData for smooth pagination transitions.
 *
 * Validates: Requirements 13.1, 13.2
 */
export function useApprovalList(params: ApprovalListParams) {
  return useQuery<PaginatedResponse<Approval>>({
    queryKey: approvalKeys.list(params),
    queryFn: async ({ signal }) => {
      const response = await approvalApi.list(params, signal);
      return response.data.data;
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * Mutation hook for approving an approval request.
 * Invalidates approval list queries on success.
 *
 * Validates: Requirements 13.2
 */
export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation<null, Error, { id: string; comment?: string }>({
    mutationFn: async ({ id, comment }) => {
      const response = await approvalApi.approve(id, comment);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.lists() });
    },
  });
}

/**
 * Mutation hook for rejecting an approval request. A comment is required per
 * approvalApi.reject's contract.
 * Invalidates approval list queries on success.
 *
 * Validates: Requirements 13.2
 */
export function useRejectRequest() {
  const queryClient = useQueryClient();

  return useMutation<null, Error, { id: string; comment: string }>({
    mutationFn: async ({ id, comment }) => {
      const response = await approvalApi.reject(id, comment);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.lists() });
    },
  });
}
