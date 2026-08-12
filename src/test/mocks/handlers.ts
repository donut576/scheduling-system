import { http, HttpResponse } from 'msw';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type { Task } from '@/types/task';
import type { Employee } from '@/types/employee';
import type { Customer, CustomerGroup, PendingCustomer } from '@/types/customer';
import type { Notification, NotificationTemplate, Approval } from '@/types/notification';
import type { UserProfile, LoginResponse } from '@/types/auth';
import type { AlertValidationResult } from '@/types/alert';
import type { ScheduleData } from '@/types/schedule';

/**
 * MSW request handlers mocking all API endpoints defined in src/api/*.ts.
 * All responses are wrapped in the ApiResponse<T> / PaginatedResponse<T>
 * envelope shapes used by this codebase (see src/types/common.ts) and
 * match against the `/api/v1` baseURL prefix configured in src/api/instance.ts.
 *
 * The `*` wildcard origin prefix is used so handlers match requests
 * regardless of the actual origin resolved from VITE_API_BASE_URL.
 *
 * Validates: Requirements 17.1
 */

const ok = <T>(data: T): ApiResponse<T> => ({ code: 0, message: 'success', data });

const paginated = <T>(list: T[]): PaginatedResponse<T> => ({
  list,
  total: list.length,
  page: 1,
  pageSize: 20,
});

// --- Mock domain data -------------------------------------------------

const mockUser: UserProfile = {
  id: 'emp-001',
  name: '測試使用者',
  employeeNo: 'E0001',
  role: 'MANAGER',
  permissions: ['task:view', 'task:edit', 'schedule:view'],
  groupId: 'group-001',
};

const mockTask: Task = {
  id: 'task-001',
  groupId: 'group-001',
  groupName: '測試集團',
  branchId: 'branch-001',
  branchName: '測試分店',
  taskType: 'CONTRACT',
  date: '2026-01-15',
  startTime: '09:00',
  endTime: '17:00',
  isOvernight: false,
  headcount: 2,
  shift: '早班',
  route: '路線A',
  contents: ['P', 'R'],
  assignees: [{ employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] }],
  remarks: '',
  status: 'SCHEDULED',
  alertStatus: 'CLEAN',
  createdBy: 'emp-001',
  createdAt: '2026-01-01T09:00:00+08:00',
  updatedAt: '2026-01-01T09:00:00+08:00',
};

const mockEmployee: Employee = {
  id: 'emp-001',
  name: '測試使用者',
  phone: '0912345678',
  employeeNo: 'E0001',
  position: 'STAFF',
  groupId: 'group-001',
  groupName: '測試集團',
  groupColor: '#1677ff',
  designatedLeaves: [],
  licenses: ['PROFESSIONAL'],
  isActive: true,
};

const mockCustomer: Customer = {
  id: 'cust-001',
  groupId: 'group-001',
  groupName: '測試集團',
  branchId: 'branch-001',
  branchName: '測試分店',
  address: '台北市信義區測試路1號',
  latitude: 25.033,
  longitude: 121.5654,
  contactName: '王小明',
  contactPhone: '02-12345678',
  requiredLicenses: ['PROFESSIONAL'],
  remarks: '',
};

const mockCustomerGroup: CustomerGroup = {
  id: 'group-001',
  name: '測試集團',
  branches: [
    {
      id: 'branch-001',
      groupId: 'group-001',
      name: '測試分店',
      address: '台北市信義區測試路1號',
      contactName: '王小明',
      contactPhone: '02-12345678',
      requiredLicenses: ['PROFESSIONAL'],
    },
  ],
};

const mockPendingCustomer: PendingCustomer = {
  id: 'pending-001',
  groupId: 'group-001',
  groupName: '測試集團',
  branchId: 'branch-001',
  branchName: '測試分店',
  status: 'PENDING',
  headcount: 2,
  createdAt: '2026-01-01T09:00:00+08:00',
  updatedAt: '2026-01-01T09:00:00+08:00',
};

const mockNotification: Notification = {
  id: 'notif-001',
  type: 'CUSTOMER_NOTIFY',
  recipientType: 'CUSTOMER',
  recipientId: 'cust-001',
  recipientName: '測試分店',
  subject: '排班通知',
  content: '您的排班已確認',
  status: 'NOTIFIED',
  createdAt: '2026-01-01T09:00:00+08:00',
};

const mockNotificationTemplate: NotificationTemplate = {
  id: 'template-001',
  name: '客戶通知範本',
  type: 'CUSTOMER_NOTIFY',
  subject: '排班通知',
  content: '親愛的{{customerName}}，您的排班已確認',
  variables: ['customerName'],
};

const mockApproval: Approval = {
  id: 'approval-001',
  taskId: 'task-001',
  type: 'SCHEDULE_CHANGE',
  status: 'PENDING',
  requestedBy: 'emp-001',
  requestedByName: '測試使用者',
  approvers: [
    {
      approverId: 'emp-002',
      approverName: '測試主任',
      role: 'DIRECTOR',
      status: 'PENDING',
    },
  ],
  createdAt: '2026-01-01T09:00:00+08:00',
  updatedAt: '2026-01-01T09:00:00+08:00',
};

const mockAlertValidationResult: AlertValidationResult = {
  isValid: true,
  violations: [],
  canOverride: true,
};

const mockScheduleData: ScheduleData = {
  events: [
    {
      id: 'event-001',
      taskId: 'task-001',
      resourceId: 'emp-001',
      title: '測試集團 - 測試分店',
      start: '2026-01-15T09:00:00+08:00',
      end: '2026-01-15T17:00:00+08:00',
      groupName: '測試集團',
      branchName: '測試分店',
      alertStatus: 'CLEAN',
      isRecurring: false,
      isOvernight: false,
      extendedProps: {
        taskType: 'CONTRACT',
        shift: '早班',
        assignees: [
          { employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] },
        ],
        contents: ['P', 'R'],
      },
    },
  ],
  resources: [{ id: 'emp-001', title: '測試使用者', groupColor: '#1677ff' }],
};

// --- Handlers -----------------------------------------------------------

export const handlers = [
  // auth.ts
  http.post('*/api/v1/auth/login', () =>
    HttpResponse.json(
      ok<LoginResponse>({
        accessToken: 'mock-access-token',
        expiresIn: 3600,
        user: mockUser,
      }),
    ),
  ),
  http.get('*/api/v1/auth/profile', () => HttpResponse.json(ok<UserProfile>(mockUser))),

  // task.ts
  http.get('*/api/v1/tasks', () => HttpResponse.json(ok(paginated<Task>([mockTask])))),
  http.get('*/api/v1/tasks/:id', () => HttpResponse.json(ok<Task>(mockTask))),
  http.post('*/api/v1/tasks', () => HttpResponse.json(ok<Task>(mockTask))),
  http.patch('*/api/v1/tasks/:id', () => HttpResponse.json(ok<Task>(mockTask))),
  http.post('*/api/v1/tasks/:id/validate', () =>
    HttpResponse.json(ok<AlertValidationResult>(mockAlertValidationResult)),
  ),
  http.post('*/api/v1/tasks/:id/override-warning', () => HttpResponse.json(ok(null))),

  // schedule.ts
  http.get('*/api/v1/schedule', () => HttpResponse.json(ok<ScheduleData>(mockScheduleData))),
  http.patch('*/api/v1/schedule', () => HttpResponse.json(ok(null))),

  // customer.ts
  http.get('*/api/v1/customers', () => HttpResponse.json(ok(paginated<Customer>([mockCustomer])))),
  http.get('*/api/v1/customers/groups', () =>
    HttpResponse.json(ok<CustomerGroup[]>([mockCustomerGroup])),
  ),
  http.post('*/api/v1/customers', () => HttpResponse.json(ok<Customer>(mockCustomer))),
  http.patch('*/api/v1/customers/:id', () => HttpResponse.json(ok<Customer>(mockCustomer))),
  http.delete('*/api/v1/customers/:id', () => HttpResponse.json(ok(null))),

  // employee.ts
  http.get('*/api/v1/employees', () => HttpResponse.json(ok(paginated<Employee>([mockEmployee])))),
  http.get('*/api/v1/employees/:id', () => HttpResponse.json(ok<Employee>(mockEmployee))),
  http.post('*/api/v1/employees', () => HttpResponse.json(ok<Employee>(mockEmployee))),
  http.patch('*/api/v1/employees/:id', () => HttpResponse.json(ok<Employee>(mockEmployee))),

  // notification.ts
  http.get('*/api/v1/notifications', () =>
    HttpResponse.json(ok(paginated<Notification>([mockNotification]))),
  ),
  http.post('*/api/v1/notifications/send', () => HttpResponse.json(ok(null))),
  http.get('*/api/v1/notifications/templates', () =>
    HttpResponse.json(ok<NotificationTemplate[]>([mockNotificationTemplate])),
  ),
  http.patch('*/api/v1/notifications/templates/:id', () =>
    HttpResponse.json(ok<NotificationTemplate>(mockNotificationTemplate)),
  ),

  // approval.ts
  http.get('*/api/v1/approvals', () => HttpResponse.json(ok(paginated<Approval>([mockApproval])))),
  http.post('*/api/v1/approvals/:id/approve', () => HttpResponse.json(ok(null))),
  http.post('*/api/v1/approvals/:id/reject', () => HttpResponse.json(ok(null))),

  // pending-customer.ts
  http.get('*/api/v1/pending-customers', () =>
    HttpResponse.json(ok(paginated<PendingCustomer>([mockPendingCustomer]))),
  ),
  http.post('*/api/v1/pending-customers', () =>
    HttpResponse.json(ok<PendingCustomer>(mockPendingCustomer)),
  ),
  http.patch('*/api/v1/pending-customers/:id', () =>
    HttpResponse.json(ok<PendingCustomer>(mockPendingCustomer)),
  ),
  http.post('*/api/v1/pending-customers/:id/convert', () => HttpResponse.json(ok(null))),
];
