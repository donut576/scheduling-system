import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { employeeApi } from '@/api/employee';
import type { EmployeeListParams, EmployeeFormData } from '@/api/employee';
import type { Employee } from '@/types/employee';
import type { PaginatedResponse } from '@/types/common';

// Query key factory for employee-related queries
export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (params: EmployeeListParams) => [...employeeKeys.lists(), params] as const,
  details: () => [...employeeKeys.all, 'detail'] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
};

/**
 * Hook for fetching paginated employee list with filtering and AbortSignal support.
 * Uses keepPreviousData for smooth pagination transitions.
 *
 * Validates: Requirements 11.1
 */
export function useEmployeeList(params: EmployeeListParams) {
  return useQuery<PaginatedResponse<Employee>>({
    queryKey: employeeKeys.list(params),
    queryFn: async ({ signal }) => {
      const response = await employeeApi.list(params, signal);
      return response.data.data;
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * Hook for fetching a single employee detail by ID.
 * Only enabled when id is provided.
 */
export function useEmployeeDetail(id: string | undefined) {
  return useQuery<Employee>({
    queryKey: employeeKeys.detail(id!),
    queryFn: async ({ signal }) => {
      const response = await employeeApi.detail(id!, signal);
      return response.data.data;
    },
    enabled: !!id,
  });
}

/**
 * Mutation hook for creating a new employee.
 * Invalidates employee list queries on success.
 */
export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation<Employee, Error, EmployeeFormData>({
    mutationFn: async (data) => {
      const response = await employeeApi.create(data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
}

/**
 * Mutation hook for updating an existing employee.
 * Invalidates both the employee list and the specific employee detail on success.
 */
export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation<Employee, Error, { id: string; data: Partial<EmployeeFormData> }>({
    mutationFn: async ({ id, data }) => {
      const response = await employeeApi.update(id, data);
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: employeeKeys.detail(variables.id),
      });
    },
  });
}
