import { http, HttpResponse } from 'msw';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type { Task, TaskAssignee, TaskFormData } from '@/types/task';
import type { Employee } from '@/types/employee';
import type { Customer, CustomerGroup, PendingCustomer } from '@/types/customer';
import type { Notification, NotificationTemplate, Approval } from '@/types/notification';
import type { UserProfile, LoginResponse } from '@/types/auth';
import type { AlertValidationResult } from '@/types/alert';
import type { ScheduleData, ScheduleEvent } from '@/types/schedule';
import { PERMISSIONS } from '@/constants/permissions';

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

/** 將任意資料包裝成 ApiResponse<T> 的成功回應格式 */
const ok = <T>(data: T): ApiResponse<T> => ({ code: 0, message: 'success', data });

/** 將陣列資料包裝成 PaginatedResponse<T> 分頁回應格式（固定回傳第 1 頁、每頁 20 筆） */
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

// Demo admin account for local frontend development (login: admin / admin123)
const mockAdminUser: UserProfile = {
  id: 'emp-admin',
  name: 'Demo 管理員',
  employeeNo: 'ADMIN01',
  role: 'ADMIN',
  permissions: Object.values(PERMISSIONS),
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

// 額外的集團/分店假資料，供本地 demo 使用（讓任務建立表單的集團/分店連動下拉選單有多組選項可選）
const demoCustomerGroups: CustomerGroup[] = [
  {
    id: 'group-002',
    name: '星耀科技股份有限公司',
    branches: [
      {
        id: 'branch-002-1',
        groupId: 'group-002',
        name: '內湖三期辦公室',
        address: '台北市內湖區瑞光路588號',
        latitude: 25.0796,
        longitude: 121.5766,
        contactName: '林志豪',
        contactPhone: '02-87911234',
        requiredLicenses: ['SAFETY_6HR'],
      },
      {
        id: 'branch-002-2',
        groupId: 'group-002',
        name: '新竹科學園區廠',
        address: '新竹市東區科學園路2號',
        latitude: 24.7867,
        longitude: 120.9847,
        contactName: '陳雅婷',
        contactPhone: '03-5781234',
        requiredLicenses: ['PROFESSIONAL', 'SAFETY_MANAGER_C'],
      },
    ],
  },
  {
    id: 'group-003',
    name: '陽光連鎖餐飲集團',
    branches: [
      {
        id: 'branch-003-1',
        groupId: 'group-003',
        name: '台中西屯門市',
        address: '台中市西屯區台灣大道三段99號',
        latitude: 24.1626,
        longitude: 120.6407,
        contactName: '黃俊傑',
        contactPhone: '04-24621234',
        requiredLicenses: ['PEST_CONTROL'],
      },
      {
        id: 'branch-003-2',
        groupId: 'group-003',
        name: '高雄三多門市',
        address: '高雄市苓雅區三多三路217號',
        latitude: 22.6163,
        longitude: 120.3007,
        contactName: '李佳穎',
        contactPhone: '07-3351234',
        requiredLicenses: ['PEST_CONTROL', 'FIRE_ANT'],
      },
    ],
  },
  {
    id: 'group-004',
    name: '綠地物業管理顧問',
    branches: [
      {
        id: 'branch-004-1',
        groupId: 'group-004',
        name: '板橋大樓管理處',
        address: '新北市板橋區文化路二段182號',
        latitude: 25.0143,
        longitude: 121.4626,
        contactName: '吳建宏',
        contactPhone: '02-29681234',
        requiredLicenses: ['SAFETY_MANAGER_B'],
      },
      {
        id: 'branch-004-2',
        groupId: 'group-004',
        name: '桃園青埔社區',
        address: '桃園市中壢區青埔一街66號',
        latitude: 24.9836,
        longitude: 121.2168,
        contactName: '許雅雯',
        contactPhone: '03-4831234',
        requiredLicenses: ['NONE'],
      },
    ],
  },
];

// 合併基本測試用集團與額外的 demo 集團，供各端點共用
const mockCustomerGroups: CustomerGroup[] = [mockCustomerGroup, ...demoCustomerGroups];

// 將額外集團之分店攤平為 Customer 記錄，供客戶列表／地圖檢視等端點使用
const demoCustomers: Customer[] = demoCustomerGroups.flatMap((group) =>
  group.branches.map((branch) => ({
    id: `cust-${branch.id}`,
    groupId: group.id,
    groupName: group.name,
    branchId: branch.id,
    branchName: branch.name,
    address: branch.address,
    latitude: branch.latitude,
    longitude: branch.longitude,
    contactName: branch.contactName,
    contactPhone: branch.contactPhone,
    requiredLicenses: branch.requiredLicenses,
    remarks: '',
  })),
);

// 合併基本測試用客戶與攤平後的 demo 客戶清單，供客戶列表／地圖端點使用
const mockCustomers: Customer[] = [mockCustomer, ...demoCustomers];

// 額外的員工假資料，分散於不同集團／職位／證照，供指派員工下拉選單使用
const demoEmployees: Employee[] = [
  {
    id: 'emp-002',
    name: '林志豪',
    phone: '0922334455',
    employeeNo: 'E0002',
    position: 'LEADER',
    groupId: 'group-002',
    groupName: '星耀科技股份有限公司',
    groupColor: '#0067a0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'SAFETY_6HR'],
    isActive: true,
  },
  {
    id: 'emp-003',
    name: '黃俊傑',
    phone: '0933445566',
    employeeNo: 'E0003',
    position: 'MANAGER',
    groupId: 'group-003',
    groupName: '陽光連鎖餐飲集團',
    groupColor: '#fa8c16',
    designatedLeaves: [],
    licenses: ['PEST_CONTROL', 'FIRE_ANT'],
    isActive: true,
  },
  {
    id: 'emp-004',
    name: '吳建宏',
    phone: '0944556677',
    employeeNo: 'E0004',
    position: 'ADMIN_STAFF',
    groupId: 'group-004',
    groupName: '綠地物業管理顧問',
    groupColor: '#722ed1',
    designatedLeaves: [],
    licenses: ['SAFETY_MANAGER_B'],
    isActive: true,
  },
  {
    id: 'emp-005',
    name: '陳雅婷',
    phone: '0955667788',
    employeeNo: 'E0005',
    position: 'STAFF',
    groupId: 'group-002',
    groupName: '星耀科技股份有限公司',
    groupColor: '#0067a0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'SAFETY_MANAGER_C'],
    isActive: true,
  },
];

// 合併基本測試用員工與額外的 demo 員工，供指派員工下拉選單等端點使用
const mockEmployees: Employee[] = [mockEmployee, ...demoEmployees];

// 任務清單改為可變狀態，讓新增／編輯任務後重新查詢時能看到實際變化（例如編輯後狀態變為「更改」）
let mockTasks: Task[] = [mockTask];

/** 判斷結束時間是否早於或等於開始時間，藉此判斷任務是否為跨日（overnight）任務 */
const isOvernightRange = (startTime: string, endTime: string): boolean => {
  const [sh = 0, sm = 0] = startTime.split(':').map(Number);
  const [eh = 0, em = 0] = endTime.split(':').map(Number);
  return eh * 60 + em <= sh * 60 + sm;
};

/** 依員工 id 陣列查出對應的員工資料，轉換為任務指派人員（TaskAssignee）格式 */
const resolveAssignees = (employeeIds: string[]): TaskAssignee[] =>
  employeeIds
    .map((id) => mockEmployees.find((emp) => emp.id === id))
    .filter((emp): emp is Employee => !!emp)
    .map((emp) => ({ employeeId: emp.id, employeeName: emp.name, licenses: emp.licenses }));

/** 依集團/分店 id 查出對應的名稱；找不到時退回使用 id 本身作為顯示名稱 */
const resolveGroupBranchNames = (groupId: string, branchId: string) => {
  const group = mockCustomerGroups.find((g) => g.id === groupId);
  const branch = group?.branches.find((b) => b.id === branchId);
  return { groupName: group?.name ?? groupId, branchName: branch?.name ?? branchId };
};

/** 依表單資料建立新任務（狀態預設為 SCHEDULED） */
const buildNewTask = (data: TaskFormData): Task => {
  const { groupName, branchName } = resolveGroupBranchNames(data.groupId, data.branchId);
  const now = new Date().toISOString();
  return {
    id: `task-${Date.now()}`,
    groupId: data.groupId,
    groupName,
    branchId: data.branchId,
    branchName,
    taskType: data.taskType,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    isOvernight: isOvernightRange(data.startTime, data.endTime),
    headcount: data.headcount,
    shift: data.shift,
    route: data.route,
    contents: data.contents,
    otherContentNote: data.otherContentNote,
    assignees: resolveAssignees(data.assignees),
    remarks: data.remarks,
    recurrenceRule: data.recurrence,
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: now,
    updatedAt: now,
  };
};

/** 依表單資料更新既有任務，並將狀態強制標記為「更改」(MODIFIED)，模擬後端行為 */
const applyTaskUpdate = (existing: Task, data: Partial<TaskFormData>): Task => {
  const groupId = data.groupId ?? existing.groupId;
  const branchId = data.branchId ?? existing.branchId;
  const { groupName, branchName } = resolveGroupBranchNames(groupId, branchId);
  const startTime = data.startTime ?? existing.startTime;
  const endTime = data.endTime ?? existing.endTime;

  return {
    ...existing,
    ...data,
    groupId,
    branchId,
    groupName,
    branchName,
    startTime,
    endTime,
    isOvernight: isOvernightRange(startTime, endTime),
    assignees: data.assignees ? resolveAssignees(data.assignees) : existing.assignees,
    recurrenceRule: data.recurrence ?? existing.recurrenceRule,
    status: 'MODIFIED',
    updatedAt: new Date().toISOString(),
  };
};

// --- 其他模組的假資料（待排時間客戶、通知、審批、警示、班表） ---

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
      approverName: '測試經理',
      role: 'MANAGER',
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

const mockScheduleEvents: ScheduleEvent[] = [
  {
    id: 'event-001',
    taskId: 'task-001',
    resourceId: 'branch-001',
    title: '測試集團 - 測試分店',
    start: '2026-08-10T09:00:00+08:00',
    end: '2026-08-10T17:00:00+08:00',
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
  {
    id: 'event-002',
    taskId: 'task-demo-002',
    resourceId: 'branch-002-1',
    title: '星耀科技 - 內湖三期辦公室',
    start: '2026-08-11T13:30:00+08:00',
    end: '2026-08-11T17:30:00+08:00',
    groupName: '星耀科技股份有限公司',
    branchName: '內湖三期辦公室',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'ONETIME',
      shift: '午班',
      assignees: [
        { employeeId: 'emp-002', employeeName: '林志豪', licenses: ['PROFESSIONAL', 'SAFETY_6HR'] },
      ],
      contents: ['S', 'TERMITE'],
    },
  },
  {
    id: 'event-003',
    taskId: 'task-demo-003',
    resourceId: 'branch-003-1',
    title: '陽光餐飲 - 台中西屯門市',
    start: '2026-08-12T08:30:00+08:00',
    end: '2026-08-12T12:00:00+08:00',
    groupName: '陽光連鎖餐飲集團',
    branchName: '台中西屯門市',
    alertStatus: 'VIOLATED',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'ESR',
      shift: '早班',
      assignees: [
        { employeeId: 'emp-003', employeeName: '黃俊傑', licenses: ['PEST_CONTROL', 'FIRE_ANT'] },
      ],
      contents: ['P', 'OTHER'],
    },
  },
  {
    id: 'event-004',
    taskId: 'task-demo-004',
    resourceId: 'branch-004-1',
    title: '綠地物業 - 板橋大樓管理處',
    start: '2026-08-13T22:00:00+08:00',
    end: '2026-08-14T04:00:00+08:00',
    groupName: '綠地物業管理顧問',
    branchName: '板橋大樓管理處',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: true,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '大夜班',
      assignees: [
        { employeeId: 'emp-004', employeeName: '吳建宏', licenses: ['SAFETY_MANAGER_B'] },
      ],
      contents: ['R'],
    },
  },
  {
    id: 'event-005',
    taskId: 'task-demo-005',
    resourceId: 'branch-002-2',
    title: '星耀科技 - 新竹科學園區廠',
    start: '2026-08-14T09:00:00+08:00',
    end: '2026-08-14T16:30:00+08:00',
    groupName: '星耀科技股份有限公司',
    branchName: '新竹科學園區廠',
    alertStatus: 'OVERRIDDEN',
    isRecurring: true,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '早班',
      assignees: [
        {
          employeeId: 'emp-005',
          employeeName: '陳雅婷',
          licenses: ['PROFESSIONAL', 'SAFETY_MANAGER_C'],
        },
      ],
      contents: ['P', 'S'],
    },
  },
];

const mockScheduleData: ScheduleData = {
  events: mockScheduleEvents,
  resources: [
    {
      id: 'group-001',
      title: '測試集團',
      groupColor: '#1677ff',
      children: [{ id: 'branch-001', title: '測試分店', groupColor: '#1677ff' }],
    },
    {
      id: 'group-002',
      title: '星耀科技股份有限公司',
      groupColor: '#0067a0',
      children: [
        { id: 'branch-002-1', title: '內湖三期辦公室', groupColor: '#0067a0' },
        { id: 'branch-002-2', title: '新竹科學園區廠', groupColor: '#0067a0' },
      ],
    },
    {
      id: 'group-003',
      title: '陽光連鎖餐飲集團',
      groupColor: '#fa8c16',
      children: [{ id: 'branch-003-1', title: '台中西屯門市', groupColor: '#fa8c16' }],
    },
    {
      id: 'group-004',
      title: '綠地物業管理顧問',
      groupColor: '#722ed1',
      children: [{ id: 'branch-004-1', title: '板橋大樓管理處', groupColor: '#722ed1' }],
    },
  ],
};

// --- Handlers -----------------------------------------------------------

export const handlers = [
  // auth.ts
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      account?: string;
      password?: string;
    };

    if (body.account === 'admin' && body.password === 'admin123') {
      return HttpResponse.json(
        ok<LoginResponse>({
          accessToken: 'mock-admin-token',
          expiresIn: 3600,
          user: mockAdminUser,
        }),
      );
    }

    return HttpResponse.json(
      ok<LoginResponse>({
        accessToken: 'mock-access-token',
        expiresIn: 3600,
        user: mockUser,
      }),
    );
  }),
  http.get('*/api/v1/auth/profile', () => HttpResponse.json(ok<UserProfile>(mockUser))),

  // task.ts
  http.get('*/api/v1/tasks', () => HttpResponse.json(ok(paginated<Task>(mockTasks)))),
  http.get('*/api/v1/tasks/:id', ({ params }) => {
    const task = mockTasks.find((t) => t.id === params.id) ?? mockTask;
    return HttpResponse.json(ok<Task>(task));
  }),
  http.post('*/api/v1/tasks', async ({ request }) => {
    const data = (await request.json()) as TaskFormData;
    const created = buildNewTask(data);
    mockTasks = [...mockTasks, created];
    return HttpResponse.json(ok<Task>(created));
  }),
  http.patch('*/api/v1/tasks/:id', async ({ params, request }) => {
    const data = (await request.json()) as Partial<TaskFormData>;
    const existing = mockTasks.find((t) => t.id === params.id);
    if (!existing) {
      return HttpResponse.json(ok<Task>(mockTask));
    }
    const updated = applyTaskUpdate(existing, data);
    mockTasks = mockTasks.map((t) => (t.id === updated.id ? updated : t));
    return HttpResponse.json(ok<Task>(updated));
  }),
  http.post('*/api/v1/tasks/:id/validate', () =>
    HttpResponse.json(ok<AlertValidationResult>(mockAlertValidationResult)),
  ),
  http.post('*/api/v1/tasks/:id/override-warning', () => HttpResponse.json(ok(null))),

  // schedule.ts
  http.get('*/api/v1/schedule', () => HttpResponse.json(ok<ScheduleData>(mockScheduleData))),
  http.patch('*/api/v1/schedule', () => HttpResponse.json(ok(null))),

  // customer.ts
  http.get('*/api/v1/customers', () => HttpResponse.json(ok(paginated<Customer>(mockCustomers)))),
  http.get('*/api/v1/customers/groups', () =>
    HttpResponse.json(ok<CustomerGroup[]>(mockCustomerGroups)),
  ),
  http.post('*/api/v1/customers', () => HttpResponse.json(ok<Customer>(mockCustomer))),
  http.patch('*/api/v1/customers/:id', () => HttpResponse.json(ok<Customer>(mockCustomer))),
  http.delete('*/api/v1/customers/:id', () => HttpResponse.json(ok(null))),

  // employee.ts
  http.get('*/api/v1/employees', () => HttpResponse.json(ok(paginated<Employee>(mockEmployees)))),
  http.get('*/api/v1/employees/:id', () => HttpResponse.json(ok<Employee>(mockEmployee))),
  http.post('*/api/v1/employees', () => HttpResponse.json(ok<Employee>(mockEmployee))),
  http.patch('*/api/v1/employees/:id', () => HttpResponse.json(ok<Employee>(mockEmployee))),
  http.delete('*/api/v1/employees/:id', () => HttpResponse.json(ok(null))),

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
