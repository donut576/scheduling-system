import { http, HttpResponse } from 'msw';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type { Task, TaskAssignee, TaskFormData, ShiftType, TaskContent } from '@/types/task';
import type { Employee } from '@/types/employee';
import type { Customer, CustomerGroup, PendingCustomer } from '@/types/customer';
import type { PendingCustomerFormData, ConvertToTaskData } from '@/api/pending-customer';
import type { Notification, NotificationTemplate, Approval } from '@/types/notification';
import type { UserProfile, LoginResponse } from '@/types/auth';
import type { AlertValidationResult, LicenseType } from '@/types/alert';
import type { ScheduleData, ScheduleEvent, ScheduleResource } from '@/types/schedule';
import { ROLE_PERMISSIONS } from '@/constants/permissions';
import { getGroupColor } from '@/utils/groupColor';

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

/** 將陣列資料包裝成 PaginatedResponse<T> 分頁回應格式 */
const paginated = <T>(list: T[], page = 1, pageSize = 20): PaginatedResponse<T> => {
  const start = (page - 1) * pageSize;
  const pagedList = list.slice(start, start + pageSize);
  return {
    list: pagedList,
    total: list.length,
    page,
    pageSize,
  };
};

// --- Mock domain data -------------------------------------------------

const mockUser: UserProfile = {
  id: 'emp-001',
  name: '測試使用者',
  employeeNo: 'E0001',
  role: 'MANAGER',
  permissions: ['task:view', 'task:edit', 'schedule:view'],
  groupId: 'group-001',
};

// Demo admin account (login: admin / admin123)
const mockAdminUser: UserProfile = {
  id: 'emp-admin',
  name: 'Demo 系統管理員',
  employeeNo: 'ADMIN01',
  role: 'ADMIN',
  permissions: ROLE_PERMISSIONS.ADMIN!,
  groupId: 'group-001',
};

// Demo admin_staff account (login: admin_staff / admin123)
const mockAdminStaffUser: UserProfile = {
  id: 'emp-admin-staff',
  name: 'Demo 行政專員',
  employeeNo: 'ASTAFF01',
  role: 'ADMIN_STAFF',
  permissions: ROLE_PERMISSIONS.ADMIN_STAFF!,
  groupId: 'group-001',
};

// Demo manager account (login: manager / manager123)
const mockManagerUser: UserProfile = {
  id: 'emp-manager',
  name: 'Demo 經理',
  employeeNo: 'MGR01',
  role: 'MANAGER',
  permissions: ROLE_PERMISSIONS.MANAGER!,
  groupId: 'group-001',
};

// Demo leader account (login: leader / leader123)
const mockLeaderUser: UserProfile = {
  id: 'emp-leader',
  name: 'Demo 組長',
  employeeNo: 'LDR01',
  role: 'LEADER',
  permissions: ROLE_PERMISSIONS.LEADER!,
  groupId: 'group-001',
};

// Demo staff account (login: staff / staff123)
const mockStaffUser: UserProfile = {
  id: 'emp-staff',
  name: 'Demo 服務專員',
  employeeNo: 'STAFF01',
  role: 'STAFF',
  permissions: ROLE_PERMISSIONS.STAFF!,
  groupId: 'taipei-morning',
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
  route: '第一路',
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
  groupId: 'taipei-morning',
  groupName: '台北 早班',
  area: '台北',
  shift: '早班',
  groupColor: '#7a69c0',
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
        name: '台南永康門市',
        address: '台南市永康區中華路12號',
        latitude: 23.0185,
        longitude: 120.2312,
        contactName: '李佳穎',
        contactPhone: '06-2531234',
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
  {
    id: 'group-005',
    name: '鼎泰豐餐飲股份有限公司',
    branches: [
      {
        id: 'branch-005-1',
        groupId: 'group-005',
        name: '信義旗艦店',
        address: '台北市大安區信義路二段194號',
        latitude: 25.0337,
        longitude: 121.5301,
        contactName: '林經理',
        contactPhone: '02-23218928',
        requiredLicenses: ['PEST_CONTROL'],
      },
      {
        id: 'branch-005-2',
        groupId: 'group-005',
        name: '101店',
        address: '台北市信義區市府路45號B1',
        latitude: 25.0336,
        longitude: 121.5645,
        contactName: '張店長',
        contactPhone: '02-81017799',
        requiredLicenses: ['PEST_CONTROL', 'SAFETY_6HR'],
      },
    ],
  },
  {
    id: 'group-006',
    name: '台北金融大樓股份有限公司',
    branches: [
      {
        id: 'branch-006-1',
        groupId: 'group-006',
        name: '台北101購物中心',
        address: '台北市信義區信義路五段7號',
        latitude: 25.0339,
        longitude: 121.5644,
        contactName: '高主任',
        contactPhone: '02-81018800',
        requiredLicenses: ['PROFESSIONAL'],
      },
      {
        id: 'branch-006-2',
        groupId: 'group-006',
        name: '台北101辦公大樓',
        address: '台北市信義區信義路五段7號35F',
        latitude: 25.0339,
        longitude: 121.5644,
        contactName: '周專員',
        contactPhone: '02-81018888',
        requiredLicenses: ['PROFESSIONAL'],
      },
    ],
  },
  {
    id: 'group-007',
    name: '台灣積體電路製造',
    branches: [
      {
        id: 'branch-007-1',
        groupId: 'group-007',
        name: '竹科八廠',
        address: '新竹市東區力行二路3號',
        latitude: 24.7758,
        longitude: 121.0142,
        contactName: '劉工程師',
        contactPhone: '03-5678888',
        requiredLicenses: ['PROFESSIONAL', 'SAFETY_MANAGER_C'],
      },
      {
        id: 'branch-007-2',
        groupId: 'group-007',
        name: '中科十五廠',
        address: '台中市大雅區科雅六路1號',
        latitude: 24.2125,
        longitude: 120.6189,
        contactName: '郭經理',
        contactPhone: '04-25678888',
        requiredLicenses: ['PROFESSIONAL'],
      },
      {
        id: 'branch-007-3',
        groupId: 'group-007',
        name: '南科十八廠',
        address: '台南市善化區善工一路1號',
        latitude: 23.1167,
        longitude: 120.2798,
        contactName: '謝副理',
        contactPhone: '06-5058888',
        requiredLicenses: ['PEST_CONTROL', 'FIRE_ANT'],
      },
    ],
  },
  {
    id: 'group-008',
    name: '遠東百貨股份有限公司',
    branches: [
      {
        id: 'branch-008-1',
        groupId: 'group-008',
        name: '信義A13',
        address: '台北市信義區松仁路58號',
        latitude: 25.0366,
        longitude: 121.5678,
        contactName: '陳副理',
        contactPhone: '02-77458888',
        requiredLicenses: ['PEST_CONTROL'],
      },
      {
        id: 'branch-008-2',
        groupId: 'group-008',
        name: '板橋大遠百',
        address: '新北市板橋區新站路28號',
        latitude: 25.0135,
        longitude: 121.4651,
        contactName: '楊課長',
        contactPhone: '02-77053988',
        requiredLicenses: ['PEST_CONTROL'],
      },
    ],
  },
  {
    id: 'group-009',
    name: '晶華國際酒店集團',
    branches: [
      {
        id: 'branch-009-1',
        groupId: 'group-009',
        name: '台北晶華酒店',
        address: '台北市中山區中山北路二段39巷3號',
        latitude: 25.0538,
        longitude: 121.5242,
        contactName: '房務部李副理',
        contactPhone: '02-25238000',
        requiredLicenses: ['PEST_CONTROL', 'PROFESSIONAL'],
      },
      {
        id: 'branch-009-2',
        groupId: 'group-009',
        name: '台南晶英酒店',
        address: '台南市中西區和意路1號',
        latitude: 22.9881,
        longitude: 120.1989,
        contactName: '總務組王副理',
        contactPhone: '06-2136290',
        requiredLicenses: ['PEST_CONTROL'],
      },
    ],
  },
  {
    id: 'group-010',
    name: '誠品生活股份有限公司',
    branches: [
      {
        id: 'branch-010-1',
        groupId: 'group-010',
        name: '松菸店',
        address: '台北市信義區菸廠路88號',
        latitude: 25.0441,
        longitude: 121.5606,
        contactName: '賴專員',
        contactPhone: '02-66365888',
        requiredLicenses: ['PROFESSIONAL'],
      },
      {
        id: 'branch-010-2',
        groupId: 'group-010',
        name: '新店裕隆城店',
        address: '新北市新店區中興路三段70號',
        latitude: 24.9785,
        longitude: 121.5456,
        contactName: '徐副理',
        contactPhone: '02-29189888',
        requiredLicenses: ['PEST_CONTROL'],
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
let mockCustomers: Customer[] = [mockCustomer, ...demoCustomers];

// 額外的員工假資料，分散於不同集團／職位／證照，供指派員工下拉選單使用
const demoEmployees: Employee[] = [
  // 台北組
  {
    id: 'emp-002',
    name: '林志豪',
    phone: '0922334455',
    employeeNo: 'E0002',
    position: 'LEADER',
    groupId: 'taipei-evening',
    groupName: '台北 晚班',
    area: '台北',
    shift: '晚班',
    groupColor: '#7a69c0',
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
    groupId: 'taipei-morning',
    groupName: '台北 早班',
    area: '台北',
    shift: '早班',
    groupColor: '#7a69c0',
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
    groupId: 'taipei-afternoon',
    groupName: '台北 午班',
    area: '台北',
    shift: '午班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['SAFETY_MANAGER_B'],
    isActive: true,
  },
  // 新竹組
  {
    id: 'emp-005',
    name: '陳雅婷',
    phone: '0955667788',
    employeeNo: 'E0005',
    position: 'STAFF',
    groupId: 'hsinchu-evening',
    groupName: '新竹 晚班',
    area: '新竹',
    shift: '晚班',
    groupColor: '#69c0a5',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'SAFETY_MANAGER_C'],
    isActive: true,
  },
  {
    id: 'emp-006',
    name: '張家豪',
    phone: '0955667799',
    employeeNo: 'E0006',
    position: 'STAFF',
    groupId: 'hsinchu-morning',
    groupName: '新竹 早班',
    area: '新竹',
    shift: '早班',
    groupColor: '#69c0a5',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL'],
    isActive: true,
  },
  {
    id: 'emp-007',
    name: '李佩珊',
    phone: '0955667700',
    employeeNo: 'E0007',
    position: 'STAFF',
    groupId: 'hsinchu-afternoon',
    groupName: '新竹 午班',
    area: '新竹',
    shift: '午班',
    groupColor: '#69c0a5',
    designatedLeaves: [],
    licenses: ['SAFETY_6HR'],
    isActive: true,
  },
  // 台中組
  {
    id: 'emp-008',
    name: '王文欽',
    phone: '0966778811',
    employeeNo: 'E0008',
    position: 'STAFF',
    groupId: 'taichung-morning',
    groupName: '台中 早班',
    area: '台中',
    shift: '早班',
    groupColor: '#c09569',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'SAFETY_6HR'],
    isActive: true,
  },
  {
    id: 'emp-009',
    name: '周冠宇',
    phone: '0966778822',
    employeeNo: 'E0009',
    position: 'STAFF',
    groupId: 'taichung-evening',
    groupName: '台中 晚班',
    area: '台中',
    shift: '晚班',
    groupColor: '#c09569',
    designatedLeaves: [],
    licenses: ['FIRE_ANT'],
    isActive: true,
  },
  // 台南組
  {
    id: 'emp-010',
    name: '劉美玲',
    phone: '0977889933',
    employeeNo: 'E0010',
    position: 'STAFF',
    groupId: 'tainan-morning',
    groupName: '台南 早班',
    area: '台南',
    shift: '早班',
    groupColor: '#c06984',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'SAFETY_6HR'],
    isActive: true,
  },
  {
    id: 'emp-011',
    name: '許維倫',
    phone: '0977889944',
    employeeNo: 'E0011',
    position: 'STAFF',
    groupId: 'tainan-afternoon',
    groupName: '台南 午班',
    area: '台南',
    shift: '午班',
    groupColor: '#c06984',
    designatedLeaves: [],
    licenses: ['PEST_CONTROL'],
    isActive: true,
  },
  {
    id: 'emp-staff',
    name: 'Demo 員工',
    phone: '0912345678',
    employeeNo: 'staff',
    position: 'STAFF',
    groupId: 'taipei-morning',
    groupName: '台北 早班',
    area: '台北',
    shift: '早班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PEST_CONTROL'],
    isActive: true,
  },
];

const demoTasks: Task[] = [
  {
    id: 'task-002',
    groupId: 'group-002',
    groupName: '星耀科技股份有限公司',
    branchId: 'branch-002-1',
    branchName: '內湖三期辦公室',
    taskType: 'CONTRACT',
    date: '2026-08-02',
    startTime: '13:30',
    endTime: '17:30',
    isOvernight: false,
    headcount: 2,
    shift: '早班',
    route: '第一路',
    contents: ['P', 'S'],
    assignees: [
      { employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-004', employeeName: '吳建宏', licenses: ['SAFETY_MANAGER_B'] },
    ],
    remarks: '辦公區例行消毒',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-01T09:00:00+08:00',
    updatedAt: '2026-08-01T09:00:00+08:00',
  },
  {
    id: 'task-003',
    groupId: 'group-002',
    groupName: '星耀科技股份有限公司',
    branchId: 'branch-002-2',
    branchName: '新竹科學園區廠',
    taskType: 'CONTRACT',
    date: '2026-08-03',
    startTime: '08:30',
    endTime: '16:30',
    isOvernight: false,
    headcount: 3,
    shift: '早班',
    route: '第二路',
    contents: ['P', 'TERMITE'],
    assignees: [
      {
        employeeId: 'emp-005',
        employeeName: '陳雅婷',
        licenses: ['PROFESSIONAL', 'SAFETY_MANAGER_C'],
      },
      { employeeId: 'emp-006', employeeName: '張家豪', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-007', employeeName: '李佩珊', licenses: ['SAFETY_6HR'] },
    ],
    remarks: '無塵室周邊防蟲與白蟻檢測',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-01T09:30:00+08:00',
    updatedAt: '2026-08-01T09:30:00+08:00',
  },
  {
    id: 'task-004',
    groupId: 'group-003',
    groupName: '陽光連鎖餐飲集團',
    branchId: 'branch-003-1',
    branchName: '台中西屯門市',
    taskType: 'CONTRACT',
    date: '2026-08-04',
    startTime: '22:00',
    endTime: '02:00',
    isOvernight: true,
    headcount: 2,
    shift: '晚班',
    route: '第三路',
    contents: ['P', 'R', 'FIRE_ANT'],
    assignees: [
      { employeeId: 'emp-008', employeeName: '王文欽', licenses: ['PROFESSIONAL', 'SAFETY_6HR'] },
      { employeeId: 'emp-009', employeeName: '周冠宇', licenses: ['FIRE_ANT'] },
    ],
    remarks: '打烊後廚房重油污區消毒除鼠',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-01T10:00:00+08:00',
    updatedAt: '2026-08-01T10:00:00+08:00',
  },
  {
    id: 'task-005',
    groupId: 'group-003',
    groupName: '陽光連鎖餐飲集團',
    branchId: 'branch-003-2',
    branchName: '台南永康門市',
    taskType: 'ONETIME',
    date: '2026-08-05',
    startTime: '14:00',
    endTime: '18:00',
    isOvernight: false,
    headcount: 1,
    shift: '早班',
    route: '第一路',
    contents: ['BED_BUG'],
    assignees: [
      {
        employeeId: 'emp-010',
        employeeName: '劉美玲',
        licenses: ['PROFESSIONAL', 'SAFETY_6HR'],
        area: '台南',
      },
    ],
    remarks: '緊急臭蟲熱處理防治',
    status: 'MODIFIED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-02T11:00:00+08:00',
    updatedAt: '2026-08-03T14:20:00+08:00',
  },
  {
    id: 'task-006',
    groupId: 'group-004',
    groupName: '綠地物業管理顧問',
    branchId: 'branch-004-1',
    branchName: '板橋大樓管理處',
    taskType: 'CONTRACT',
    date: '2026-08-06',
    startTime: '09:00',
    endTime: '12:00',
    isOvernight: false,
    headcount: 2,
    shift: '早班',
    route: '第二路',
    contents: ['P', 'R'],
    assignees: [
      { employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-staff', employeeName: 'Demo 員工', licenses: ['PEST_CONTROL'] },
    ],
    remarks: '地下停車場與公共區域噴藥',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-02T15:00:00+08:00',
    updatedAt: '2026-08-02T15:00:00+08:00',
  },
  {
    id: 'task-007',
    groupId: 'group-004',
    groupName: '綠地物業管理顧問',
    branchId: 'branch-004-2',
    branchName: '桃園青埔社區',
    taskType: 'CONTRACT',
    date: '2026-08-07',
    startTime: '13:00',
    endTime: '17:00',
    isOvernight: false,
    headcount: 2,
    shift: '早班',
    route: '第三路',
    contents: ['P', 'TERMITE'],
    assignees: [
      { employeeId: 'emp-002', employeeName: '林志豪', licenses: ['PROFESSIONAL', 'SAFETY_6HR'] },
      { employeeId: 'emp-004', employeeName: '吳建宏', licenses: ['SAFETY_MANAGER_B'] },
    ],
    remarks: '中庭花園白蟻防治及公共管線投藥',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-03T09:00:00+08:00',
    updatedAt: '2026-08-03T09:00:00+08:00',
  },
  {
    id: 'task-008',
    groupId: 'group-005',
    groupName: '鼎泰豐餐飲股份有限公司',
    branchId: 'branch-005-1',
    branchName: '信義旗艦店',
    taskType: 'CONTRACT',
    date: '2026-08-08',
    startTime: '22:30',
    endTime: '01:30',
    isOvernight: true,
    headcount: 2,
    shift: '晚班',
    route: '第四路',
    contents: ['P', 'R'],
    assignees: [
      { employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-003', employeeName: '黃俊傑', licenses: ['PEST_CONTROL', 'FIRE_ANT'] },
    ],
    remarks: '打烊後全店病媒防治施作',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-03T10:00:00+08:00',
    updatedAt: '2026-08-03T10:00:00+08:00',
  },
  {
    id: 'task-009',
    groupId: 'group-005',
    groupName: '鼎泰豐餐飲股份有限公司',
    branchId: 'branch-005-2',
    branchName: '101店',
    taskType: 'CONTRACT',
    date: '2026-08-09',
    startTime: '23:00',
    endTime: '02:00',
    isOvernight: true,
    headcount: 2,
    shift: '晚班',
    route: '第四路',
    contents: ['P', 'R', 'S'],
    assignees: [
      { employeeId: 'emp-004', employeeName: '吳建宏', licenses: ['SAFETY_MANAGER_B'] },
      { employeeId: 'emp-staff', employeeName: 'Demo 員工', licenses: ['PEST_CONTROL'] },
    ],
    remarks: '商場打烊後廚區徹底清消',
    status: 'MODIFIED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-04T11:00:00+08:00',
    updatedAt: '2026-08-04T11:00:00+08:00',
  },
  {
    id: 'task-010',
    groupId: 'group-006',
    groupName: '台北金融大樓股份有限公司',
    branchId: 'branch-006-1',
    branchName: '台北101購物中心',
    taskType: 'CONTRACT',
    date: '2026-08-10',
    startTime: '00:00',
    endTime: '06:00',
    isOvernight: false,
    headcount: 4,
    shift: '大夜班',
    route: '第五路',
    contents: ['P', 'R', 'TERMITE', 'FIRE_ANT'],
    assignees: [
      { employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-002', employeeName: '林志豪', licenses: ['PROFESSIONAL', 'SAFETY_6HR'] },
      { employeeId: 'emp-003', employeeName: '黃俊傑', licenses: ['PEST_CONTROL', 'FIRE_ANT'] },
      { employeeId: 'emp-004', employeeName: '吳建宏', licenses: ['SAFETY_MANAGER_B'] },
    ],
    remarks: 'B1-5F 美食街與商場大範圍夜間施作',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-04T14:00:00+08:00',
    updatedAt: '2026-08-04T14:00:00+08:00',
  },
  {
    id: 'task-011',
    groupId: 'group-006',
    groupName: '台北金融大樓股份有限公司',
    branchId: 'branch-006-2',
    branchName: '台北101辦公大樓',
    taskType: 'CONTRACT',
    date: '2026-08-11',
    startTime: '18:30',
    endTime: '22:30',
    isOvernight: false,
    headcount: 2,
    shift: '晚班',
    route: '第五路',
    contents: ['P', 'R'],
    assignees: [
      { employeeId: 'emp-004', employeeName: '吳建宏', licenses: ['SAFETY_MANAGER_B'] },
      { employeeId: 'emp-staff', employeeName: 'Demo 員工', licenses: ['PEST_CONTROL'] },
    ],
    remarks: '高樓層辦公區茶水間與梯廳防蟲',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-05T09:00:00+08:00',
    updatedAt: '2026-08-05T09:00:00+08:00',
  },
  {
    id: 'task-012',
    groupId: 'group-007',
    groupName: '台灣積體電路製造',
    branchId: 'branch-007-1',
    branchName: '竹科八廠',
    taskType: 'CONTRACT',
    date: '2026-08-12',
    startTime: '08:00',
    endTime: '17:00',
    isOvernight: false,
    headcount: 3,
    shift: '早班',
    route: '第一路',
    contents: ['P', 'S'],
    assignees: [
      {
        employeeId: 'emp-005',
        employeeName: '陳雅婷',
        licenses: ['PROFESSIONAL', 'SAFETY_MANAGER_C'],
      },
      { employeeId: 'emp-006', employeeName: '張家豪', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-007', employeeName: '李佩珊', licenses: ['SAFETY_6HR'] },
    ],
    remarks: '全廠區年度環境消毒作業（主管已核准）',
    status: 'MODIFIED',
    isApproved: true,
    alertStatus: 'OVERRIDDEN',
    overrideRemark: '經理核准特種環境作業人員調派',
    createdBy: 'emp-001',
    createdAt: '2026-08-05T10:30:00+08:00',
    updatedAt: '2026-08-05T10:30:00+08:00',
  },
  {
    id: 'task-013',
    groupId: 'group-007',
    groupName: '台灣積體電路製造',
    branchId: 'branch-007-2',
    branchName: '中科十五廠',
    taskType: 'CONTRACT',
    date: '2026-08-13',
    startTime: '09:00',
    endTime: '18:00',
    isOvernight: false,
    headcount: 2,
    shift: '午班',
    route: '第二路',
    contents: ['P', 'TERMITE'],
    assignees: [
      { employeeId: 'emp-008', employeeName: '王文欽', licenses: ['PROFESSIONAL', 'SAFETY_6HR'] },
      { employeeId: 'emp-009', employeeName: '周冠宇', licenses: ['FIRE_ANT'] },
    ],
    remarks: '廠務區例行防護作業',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-06T09:00:00+08:00',
    updatedAt: '2026-08-06T09:00:00+08:00',
  },
  {
    id: 'task-014',
    groupId: 'group-007',
    groupName: '台灣積體電路製造',
    branchId: 'branch-007-3',
    branchName: '南科十八廠',
    taskType: 'CONTRACT',
    date: '2026-08-14',
    startTime: '08:30',
    endTime: '17:30',
    isOvernight: false,
    headcount: 2,
    shift: '早班',
    route: '第三路',
    contents: ['P', 'FIRE_ANT'],
    assignees: [
      { employeeId: 'emp-010', employeeName: '劉美玲', licenses: ['PROFESSIONAL', 'SAFETY_6HR'] },
      { employeeId: 'emp-011', employeeName: '許維倫', licenses: ['PEST_CONTROL'] },
    ],
    remarks: '紅火蟻熱點巡查與誘餌施放',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-06T11:00:00+08:00',
    updatedAt: '2026-08-06T11:00:00+08:00',
  },
  {
    id: 'task-015',
    groupId: 'group-008',
    groupName: '遠東百貨股份有限公司',
    branchId: 'branch-008-1',
    branchName: '信義A13',
    taskType: 'CONTRACT',
    date: '2026-08-15',
    startTime: '22:00',
    endTime: '02:00',
    isOvernight: true,
    headcount: 2,
    shift: '晚班',
    route: '第四路',
    contents: ['P', 'R', 'BED_BUG'],
    assignees: [
      { employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-002', employeeName: '林志豪', licenses: ['PROFESSIONAL', 'SAFETY_6HR'] },
    ],
    remarks: '美食街及影城夜間防蟲清消',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-07T14:00:00+08:00',
    updatedAt: '2026-08-07T14:00:00+08:00',
  },
  {
    id: 'task-016',
    groupId: 'group-008',
    groupName: '遠東百貨股份有限公司',
    branchId: 'branch-008-2',
    branchName: '板橋大遠百',
    taskType: 'CONTRACT',
    date: '2026-08-16',
    startTime: '22:30',
    endTime: '02:30',
    isOvernight: true,
    headcount: 2,
    shift: '晚班',
    route: '第二路',
    contents: ['P', 'R'],
    assignees: [
      { employeeId: 'emp-003', employeeName: '黃俊傑', licenses: ['PEST_CONTROL', 'FIRE_ANT'] },
      { employeeId: 'emp-004', employeeName: '吳建宏', licenses: ['SAFETY_MANAGER_B'] },
    ],
    remarks: '地下超市與餐飲街消毒除鼠',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-07T16:00:00+08:00',
    updatedAt: '2026-08-07T16:00:00+08:00',
  },
  {
    id: 'task-017',
    groupId: 'group-009',
    groupName: '晶華國際酒店集團',
    branchId: 'branch-009-1',
    branchName: '台北晶華酒店',
    taskType: 'CONTRACT',
    date: '2026-08-17',
    startTime: '00:30',
    endTime: '05:30',
    isOvernight: false,
    headcount: 3,
    shift: '大夜班',
    route: '第五路',
    contents: ['P', 'R', 'BED_BUG', 'S'],
    assignees: [
      { employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-003', employeeName: '黃俊傑', licenses: ['PEST_CONTROL', 'FIRE_ANT'] },
      { employeeId: 'emp-staff', employeeName: 'Demo 員工', licenses: ['PEST_CONTROL'] },
    ],
    remarks: '宴會廳、廚房後場與指定客房深度清消（組長已核准）',
    status: 'MODIFIED',
    isApproved: true,
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-08T09:00:00+08:00',
    updatedAt: '2026-08-08T09:00:00+08:00',
  },
  {
    id: 'task-018',
    groupId: 'group-009',
    groupName: '晶華國際酒店集團',
    branchId: 'branch-009-2',
    branchName: '台南晶英酒店',
    taskType: 'CONTRACT',
    date: '2026-08-18',
    startTime: '01:00',
    endTime: '05:00',
    isOvernight: false,
    headcount: 2,
    shift: '大夜班',
    route: '第一路',
    contents: ['P', 'BED_BUG'],
    assignees: [
      { employeeId: 'emp-010', employeeName: '劉美玲', licenses: ['PROFESSIONAL', 'SAFETY_6HR'] },
      { employeeId: 'emp-011', employeeName: '許維倫', licenses: ['PEST_CONTROL'] },
    ],
    remarks: '客房樓層防蟲與中餐廳滅鼠',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-08T10:30:00+08:00',
    updatedAt: '2026-08-08T10:30:00+08:00',
  },
  {
    id: 'task-019',
    groupId: 'group-010',
    groupName: '誠品生活股份有限公司',
    branchId: 'branch-010-1',
    branchName: '松菸店',
    taskType: 'CONTRACT',
    date: '2026-08-19',
    startTime: '08:00',
    endTime: '11:00',
    isOvernight: false,
    headcount: 2,
    shift: '早班',
    route: '第二路',
    contents: ['P', 'TERMITE'],
    assignees: [
      { employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-004', employeeName: '吳建宏', licenses: ['SAFETY_MANAGER_B'] },
    ],
    remarks: '木造書區白蟻檢查與開館前防蟲',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-09T09:00:00+08:00',
    updatedAt: '2026-08-09T09:00:00+08:00',
  },
  {
    id: 'task-020',
    groupId: 'group-010',
    groupName: '誠品生活股份有限公司',
    branchId: 'branch-010-2',
    branchName: '新店裕隆城店',
    taskType: 'ONETIME',
    date: '2026-08-20',
    startTime: '09:30',
    endTime: '13:30',
    isOvernight: false,
    headcount: 2,
    shift: '早班',
    route: '第三路',
    contents: ['FIRE_ANT', 'OTHER'],
    otherContentNote: '戶外造景花圃紅火蟻清消',
    assignees: [
      { employeeId: 'emp-003', employeeName: '黃俊傑', licenses: ['PEST_CONTROL', 'FIRE_ANT'] },
      { employeeId: 'emp-004', employeeName: '吳建宏', licenses: ['SAFETY_MANAGER_B'] },
    ],
    remarks: '戶外綠化造景特別防治案',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-09T14:00:00+08:00',
    updatedAt: '2026-08-09T14:00:00+08:00',
  },
  {
    id: 'task-021',
    groupId: 'group-001',
    groupName: '測試集團',
    branchId: 'branch-001',
    branchName: '測試分店',
    taskType: 'ESR',
    date: '2026-08-21',
    startTime: '14:00',
    endTime: '16:00',
    isOvernight: false,
    headcount: 1,
    shift: '早班',
    route: '第六路',
    contents: ['P'],
    assignees: [
      { employeeId: 'emp-002', employeeName: '林志豪', licenses: ['PROFESSIONAL', 'SAFETY_6HR'] },
    ],
    remarks: '臨時客戶急件呼叫（ESR）',
    status: 'UNSCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-10T08:30:00+08:00',
    updatedAt: '2026-08-10T08:30:00+08:00',
  },
  {
    id: 'task-022',
    groupId: 'group-002',
    groupName: '星耀科技股份有限公司',
    branchId: 'branch-002-1',
    branchName: '內湖三期辦公室',
    taskType: 'ESR',
    date: '2026-08-22',
    startTime: '10:00',
    endTime: '12:00',
    isOvernight: false,
    headcount: 1,
    shift: '早班',
    route: '第一路',
    contents: ['R'],
    assignees: [{ employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] }],
    remarks: '會議室老鼠侵入緊急處理',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-10T11:00:00+08:00',
    updatedAt: '2026-08-10T11:00:00+08:00',
  },
  {
    id: 'task-023',
    groupId: 'group-003',
    groupName: '陽光連鎖餐飲集團',
    branchId: 'branch-003-1',
    branchName: '台中西屯門市',
    taskType: 'ONETIME',
    date: '2026-08-23',
    startTime: '15:00',
    endTime: '18:00',
    isOvernight: false,
    headcount: 2,
    shift: '午班',
    route: '第二路',
    contents: ['VEHICLE_MAINTENANCE'],
    assignees: [
      { employeeId: 'emp-008', employeeName: '王文欽', licenses: ['PROFESSIONAL', 'SAFETY_6HR'] },
      { employeeId: 'emp-009', employeeName: '周冠宇', licenses: ['FIRE_ANT'] },
    ],
    remarks: '外送車隊與物流冷鏈車輛消毒',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-11T09:00:00+08:00',
    updatedAt: '2026-08-11T09:00:00+08:00',
  },
  {
    id: 'task-024',
    groupId: 'group-004',
    groupName: '綠地物業管理顧問',
    branchId: 'branch-004-1',
    branchName: '板橋大樓管理處',
    taskType: 'CONTRACT',
    date: '2026-08-24',
    startTime: '13:30',
    endTime: '16:30',
    isOvernight: false,
    headcount: 2,
    shift: '早班',
    route: '第三路',
    contents: ['P', 'S'],
    assignees: [
      { employeeId: 'emp-002', employeeName: '林志豪', licenses: ['PROFESSIONAL', 'SAFETY_6HR'] },
      { employeeId: 'emp-004', employeeName: '吳建宏', licenses: ['SAFETY_MANAGER_B'] },
    ],
    remarks: '社區公設定期殺菌消毒',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-11T13:00:00+08:00',
    updatedAt: '2026-08-11T13:00:00+08:00',
  },
  {
    id: 'task-025',
    groupId: 'group-005',
    groupName: '鼎泰豐餐飲股份有限公司',
    branchId: 'branch-005-1',
    branchName: '信義旗艦店',
    taskType: 'CONTRACT',
    date: '2026-08-25',
    startTime: '22:30',
    endTime: '01:30',
    isOvernight: true,
    headcount: 2,
    shift: '晚班',
    route: '第四路',
    contents: ['P', 'R'],
    assignees: [
      { employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-003', employeeName: '黃俊傑', licenses: ['PEST_CONTROL', 'FIRE_ANT'] },
    ],
    remarks: '調整施作時間與藥劑項目',
    status: 'MODIFIED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-12T10:00:00+08:00',
    updatedAt: '2026-08-12T16:00:00+08:00',
  },
  {
    id: 'task-026',
    groupId: 'group-006',
    groupName: '台北金融大樓股份有限公司',
    branchId: 'branch-006-1',
    branchName: '台北101購物中心',
    taskType: 'CONTRACT',
    date: '2026-08-26',
    startTime: '00:00',
    endTime: '05:00',
    isOvernight: false,
    headcount: 2,
    shift: '大夜班',
    route: '第五路',
    contents: ['P', 'R'],
    assignees: [
      { employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-004', employeeName: '吳建宏', licenses: ['SAFETY_MANAGER_B'] },
    ],
    remarks: '美食街夜間維護作業',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-12T11:00:00+08:00',
    updatedAt: '2026-08-12T11:00:00+08:00',
  },
  {
    id: 'task-027',
    groupId: 'group-007',
    groupName: '台灣積體電路製造',
    branchId: 'branch-007-1',
    branchName: '竹科八廠',
    taskType: 'CONTRACT',
    date: '2026-08-27',
    startTime: '08:00',
    endTime: '17:00',
    isOvernight: false,
    headcount: 2,
    shift: '早班',
    route: '第一路',
    contents: ['P', 'TRAINING'],
    assignees: [
      {
        employeeId: 'emp-005',
        employeeName: '陳雅婷',
        licenses: ['PROFESSIONAL', 'SAFETY_MANAGER_C'],
      },
      { employeeId: 'emp-006', employeeName: '張家豪', licenses: ['PROFESSIONAL'] },
    ],
    remarks: '廠務新進人員安全作業教育訓練與示範',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-13T09:00:00+08:00',
    updatedAt: '2026-08-13T09:00:00+08:00',
  },
  {
    id: 'task-028',
    groupId: 'group-008',
    groupName: '遠東百貨股份有限公司',
    branchId: 'branch-008-1',
    branchName: '信義A13',
    taskType: 'ONETIME',
    date: '2026-08-28',
    startTime: '21:00',
    endTime: '23:00',
    isOvernight: false,
    headcount: 1,
    shift: '晚班',
    route: '第四路',
    contents: ['P'],
    assignees: [
      { employeeId: 'emp-002', employeeName: '林志豪', licenses: ['PROFESSIONAL', 'SAFETY_6HR'] },
    ],
    remarks: '因客戶活動臨時取消排班',
    status: 'CANCELLED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-13T10:00:00+08:00',
    updatedAt: '2026-08-13T15:00:00+08:00',
  },
  {
    id: 'task-029',
    groupId: 'group-009',
    groupName: '晶華國際酒店集團',
    branchId: 'branch-009-1',
    branchName: '台北晶華酒店',
    taskType: 'CONTRACT',
    date: '2026-08-29',
    startTime: '01:00',
    endTime: '05:00',
    isOvernight: false,
    headcount: 2,
    shift: '大夜班',
    route: '第五路',
    contents: ['P', 'R', 'BED_BUG'],
    assignees: [
      { employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-003', employeeName: '黃俊傑', licenses: ['PEST_CONTROL', 'FIRE_ANT'] },
    ],
    remarks: '夜間跨日排班證照違規示警範例',
    status: 'SCHEDULED',
    alertStatus: 'VIOLATED',
    createdBy: 'emp-001',
    createdAt: '2026-08-13T14:00:00+08:00',
    updatedAt: '2026-08-13T14:00:00+08:00',
  },
  {
    id: 'task-030',
    groupId: 'group-010',
    groupName: '誠品生活股份有限公司',
    branchId: 'branch-010-1',
    branchName: '松菸店',
    taskType: 'CONTRACT',
    date: '2026-08-30',
    startTime: '08:30',
    endTime: '11:30',
    isOvernight: false,
    headcount: 2,
    shift: '早班',
    route: '第二路',
    contents: ['P', 'R'],
    assignees: [
      { employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-002', employeeName: '林志豪', licenses: ['PROFESSIONAL', 'SAFETY_6HR'] },
    ],
    remarks: '週末商場開館前環境維護',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-14T08:00:00+08:00',
    updatedAt: '2026-08-14T08:00:00+08:00',
  },
];

// 合併基本測試用員工與額外的 demo 員工，供指派員工下拉選單等端點使用
let mockEmployees: Employee[] = [mockEmployee, ...demoEmployees];

// 任務清單改為可變狀態，包含 30 筆示範任務（task-001 到 task-030）
let mockTasks: Task[] = [mockTask, ...demoTasks];

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

let mockPendingCustomers: PendingCustomer[] = [
  {
    id: 'pending-001',
    groupId: 'group-001',
    groupName: '測試集團',
    branchId: 'branch-001',
    branchName: '測試分店',
    status: 'PENDING',
    date: undefined,
    startTime: undefined,
    endTime: undefined,
    headcount: 2,
    shift: '早班',
    route: '第一路',
    contents: ['P', 'R'],
    assignees: [],
    remarks: '2026年度合約預排，客戶預計8月底確認具體施作日期',
    createdAt: '2026-08-01T09:30:00+08:00',
    updatedAt: '2026-08-01T09:30:00+08:00',
  },
  {
    id: 'pending-002',
    groupId: 'group-002',
    groupName: '星耀科技股份有限公司',
    branchId: 'branch-002-1',
    branchName: '內湖三期辦公室',
    status: 'PENDING',
    date: undefined,
    startTime: undefined,
    endTime: undefined,
    headcount: 3,
    shift: '晚班',
    route: '第二路',
    contents: ['P', 'S'],
    assignees: [],
    remarks: '年度合約季度保養，需配合大樓週末夜間門禁施作',
    createdAt: '2026-08-03T11:15:00+08:00',
    updatedAt: '2026-08-03T11:15:00+08:00',
  },
  {
    id: 'pending-003',
    groupId: 'group-003',
    groupName: '陽光連鎖餐飲集團',
    branchId: 'branch-003-1',
    branchName: '台中西屯門市',
    status: 'PENDING',
    date: '2026-09-10',
    startTime: undefined,
    endTime: undefined,
    headcount: 2,
    shift: '午班',
    route: '第三路',
    contents: ['P', 'FIRE_ANT'],
    assignees: [],
    remarks: '客戶已指定9/10施工，詳細進場時段待店長回覆',
    createdAt: '2026-08-05T14:20:00+08:00',
    updatedAt: '2026-08-05T14:20:00+08:00',
  },
  {
    id: 'pending-004',
    groupId: 'group-004',
    groupName: '綠地物業管理顧問',
    branchId: 'branch-004-1',
    branchName: '板橋大樓管理處',
    status: 'PENDING',
    date: undefined,
    startTime: undefined,
    endTime: undefined,
    headcount: 2,
    shift: '早班',
    route: '第一路',
    contents: ['P', 'TERMITE'],
    assignees: [],
    remarks: '2026年度新簽合約，待管委會確認施作時段',
    createdAt: '2026-08-08T10:00:00+08:00',
    updatedAt: '2026-08-08T10:00:00+08:00',
  },
  {
    id: 'pending-005',
    groupId: 'group-002',
    groupName: '星耀科技股份有限公司',
    branchId: 'branch-002-2',
    branchName: '新竹科學園區廠',
    status: 'PENDING',
    date: undefined,
    startTime: undefined,
    endTime: undefined,
    headcount: 4,
    shift: '早班',
    route: '第二路',
    contents: ['P', 'TRAINING'],
    assignees: [],
    remarks: '年度廠區歲修預排，進場人員需具備6小時工安證照',
    createdAt: '2026-08-10T16:45:00+08:00',
    updatedAt: '2026-08-10T16:45:00+08:00',
  },
  {
    id: 'pending-006',
    groupId: 'group-005',
    groupName: '鼎泰豐餐飲股份有限公司',
    branchId: 'branch-005-1',
    branchName: '信義旗艦店',
    status: 'PENDING',
    date: undefined,
    startTime: undefined,
    endTime: undefined,
    headcount: 2,
    shift: '晚班',
    route: '第四路',
    contents: ['P', 'R'],
    assignees: [],
    remarks: '信義店下半年度夜間例行清消，待店長回簽排程',
    createdAt: '2026-08-11T09:00:00+08:00',
    updatedAt: '2026-08-11T09:00:00+08:00',
  },
  {
    id: 'pending-007',
    groupId: 'group-006',
    groupName: '台北金融大樓股份有限公司',
    branchId: 'branch-006-1',
    branchName: '台北101購物中心',
    status: 'PENDING',
    date: undefined,
    startTime: undefined,
    endTime: undefined,
    headcount: 3,
    shift: '大夜班',
    route: '第五路',
    contents: ['P', 'R', 'TERMITE'],
    assignees: [],
    remarks: '購物中心公共管道間大範圍白蟻防治工程',
    createdAt: '2026-08-11T14:30:00+08:00',
    updatedAt: '2026-08-11T14:30:00+08:00',
  },
  {
    id: 'pending-008',
    groupId: 'group-007',
    groupName: '台灣積體電路製造',
    branchId: 'branch-007-1',
    branchName: '竹科八廠',
    status: 'PENDING',
    date: '2026-09-15',
    startTime: undefined,
    endTime: undefined,
    headcount: 2,
    shift: '早班',
    route: '第一路',
    contents: ['P', 'S'],
    assignees: [],
    remarks: '竹科廠區無塵室周邊定期防護，時間待工安主管確認',
    createdAt: '2026-08-12T10:00:00+08:00',
    updatedAt: '2026-08-12T10:00:00+08:00',
  },
  {
    id: 'pending-009',
    groupId: 'group-007',
    groupName: '台灣積體電路製造',
    branchId: 'branch-007-2',
    branchName: '中科十五廠',
    status: 'PENDING',
    date: undefined,
    startTime: undefined,
    endTime: undefined,
    headcount: 2,
    shift: '午班',
    route: '第二路',
    contents: ['P', 'FIRE_ANT'],
    assignees: [],
    remarks: '中科園區綠化帶紅火蟻熱點預防性施藥',
    createdAt: '2026-08-12T15:20:00+08:00',
    updatedAt: '2026-08-12T15:20:00+08:00',
  },
  {
    id: 'pending-010',
    groupId: 'group-008',
    groupName: '遠東百貨股份有限公司',
    branchId: 'branch-008-1',
    branchName: '信義A13',
    status: 'PENDING',
    date: undefined,
    startTime: undefined,
    endTime: undefined,
    headcount: 2,
    shift: '晚班',
    route: '第四路',
    contents: ['BED_BUG', 'P'],
    assignees: [],
    remarks: '百貨專櫃換季前深度臭蟲防治預約',
    createdAt: '2026-08-13T09:40:00+08:00',
    updatedAt: '2026-08-13T09:40:00+08:00',
  },
  {
    id: 'pending-011',
    groupId: 'group-008',
    groupName: '遠東百貨股份有限公司',
    branchId: 'branch-008-2',
    branchName: '板橋大遠百',
    status: 'PENDING',
    date: undefined,
    startTime: undefined,
    endTime: undefined,
    headcount: 1,
    shift: '早班',
    route: '第三路',
    contents: ['VEHICLE_MAINTENANCE'],
    assignees: [],
    remarks: '物流配送車輛全車消毒與設備檢驗',
    createdAt: '2026-08-13T11:00:00+08:00',
    updatedAt: '2026-08-13T11:00:00+08:00',
  },
  {
    id: 'pending-012',
    groupId: 'group-009',
    groupName: '晶華國際酒店集團',
    branchId: 'branch-009-1',
    branchName: '台北晶華酒店',
    status: 'PENDING',
    date: undefined,
    startTime: undefined,
    endTime: undefined,
    headcount: 3,
    shift: '大夜班',
    route: '第五路',
    contents: ['P', 'R', 'BED_BUG'],
    assignees: [],
    remarks: '客房樓層全面除蟲作業，等候房務部排房確認',
    createdAt: '2026-08-13T16:00:00+08:00',
    updatedAt: '2026-08-13T16:00:00+08:00',
  },
  {
    id: 'pending-013',
    groupId: 'group-009',
    groupName: '晶華國際酒店集團',
    branchId: 'branch-009-2',
    branchName: '台南晶英酒店',
    status: 'PENDING',
    date: '2026-09-20',
    startTime: undefined,
    endTime: undefined,
    headcount: 2,
    shift: '早班',
    route: '第一路',
    contents: ['P', 'TERMITE'],
    assignees: [],
    remarks: '古蹟周邊園區木構建物白蟻防治',
    createdAt: '2026-08-14T08:30:00+08:00',
    updatedAt: '2026-08-14T08:30:00+08:00',
  },
  {
    id: 'pending-014',
    groupId: 'group-010',
    groupName: '誠品生活股份有限公司',
    branchId: 'branch-010-1',
    branchName: '松菸店',
    status: 'PENDING',
    date: undefined,
    startTime: undefined,
    endTime: undefined,
    headcount: 2,
    shift: '早班',
    route: '第二路',
    contents: ['P', 'TRAINING'],
    assignees: [],
    remarks: '松菸店員工病媒防治與衛生安全講習',
    createdAt: '2026-08-14T10:00:00+08:00',
    updatedAt: '2026-08-14T10:00:00+08:00',
  },
  {
    id: 'pending-015',
    groupId: 'group-010',
    groupName: '誠品生活股份有限公司',
    branchId: 'branch-010-2',
    branchName: '新店裕隆城店',
    status: 'PENDING',
    date: undefined,
    startTime: undefined,
    endTime: undefined,
    headcount: 2,
    shift: '午班',
    route: '第三路',
    contents: ['OTHER'],
    otherContentNote: '戶外造景特約清消',
    assignees: [],
    remarks: '裕隆城戶外水景與植栽區特殊環境維護',
    createdAt: '2026-08-14T11:30:00+08:00',
    updatedAt: '2026-08-14T11:30:00+08:00',
  },
];

const mockNotifications: Notification[] = [
  {
    id: 'notif-001',
    type: 'CUSTOMER_NOTIFY',
    recipientType: 'CUSTOMER',
    recipientId: 'branch-002-1',
    recipientName: '星耀科技 - 內湖三期辦公室',
    subject: '【Ecolab】服務排程確認通知 - 內湖三期辦公室',
    content: `尊敬的客戶您好：

我們已為您安排近期的專業服務，排班詳情如下：

客戶名稱：星耀科技 - 內湖三期辦公室
服務時間：2026-08-18 08:30 ~ 12:00
服務地址：台北市內湖區行愛路168號
施作項目：病媒防治（P）、鼠害防制（R）

若有任何時間調整需求，請隨時與我們聯絡。`,
    status: 'NOTIFIED',
    createdAt: '2026-08-18T08:30:00+08:00',
  },
  {
    id: 'notif-002',
    type: 'EMPLOYEE_DISPATCH',
    recipientType: 'EMPLOYEE',
    recipientId: 'emp-001',
    recipientName: '測試使用者 (專員)',
    subject: '【Ecolab】新服務任務指派通知 - 鼎泰豐 101店',
    content: `系統已指派您一項新的服務任務，請確認以下資訊：

客戶名稱：鼎泰美食王國 - 台北101旗艦店
服務時間：2026-08-18 13:30 ~ 17:30
服務地址：台北市信義區市府路45號B1
施作項目：定期病媒防治（P）

請準時前往處理並於完成後更新任務狀態。`,
    status: 'NOTIFIED',
    createdAt: '2026-08-18T08:35:00+08:00',
  },
  {
    id: 'notif-003',
    type: 'CUSTOMER_NOTIFY',
    recipientType: 'CUSTOMER',
    recipientId: 'branch-003-1',
    recipientName: '陽光連鎖餐飲 - 台中西屯門市',
    subject: '【Ecolab】ESR 專案排程確認通知',
    content: `尊敬的客戶您好：

我們已為您安排近期的專業服務，排班詳情如下：

客戶名稱：陽光連鎖餐飲 - 台中西屯門市
服務時間：2026-08-17 10:00 ~ 15:30
服務地址：台中市西屯區台灣大道三段99號
施作項目：ESR 特約防制專案

若有任何時間調整需求，請隨時與我們聯絡。`,
    status: 'NOTIFIED',
    createdAt: '2026-08-17T15:20:00+08:00',
  },
  {
    id: 'notif-004',
    type: 'EMPLOYEE_DISPATCH',
    recipientType: 'EMPLOYEE',
    recipientId: 'emp-010',
    recipientName: '劉美玲 (專員)',
    subject: '【Ecolab】特許覆蓋任務指派 - 台南南科生醫館',
    content: `系統已指派您一項新的服務任務，請確認以下資訊：

客戶名稱：遠東生技園區 - 台南南科生醫館
服務時間：2026-08-17 14:00 ~ 18:30
服務地址：台南市新市區南科三路22號
施作項目：特約清消

備註：主管已核准特許覆蓋支援。
請準時前往處理並於完成後更新狀態。`,
    status: 'NOTIFIED',
    createdAt: '2026-08-17T11:00:00+08:00',
  },
  {
    id: 'notif-005',
    type: 'CUSTOMER_NOTIFY',
    recipientType: 'CUSTOMER',
    recipientId: 'branch-001',
    recipientName: '晶圓精密工業 - 竹科總部一廠',
    subject: '【Ecolab】服務排程確認通知 - 竹科總部一廠',
    content: `尊敬的客戶您好：

我們已為您安排近期的專業服務，排班詳情如下：

客戶名稱：晶圓精密工業 - 竹科總部一廠
服務時間：2026-08-16 09:00 ~ 17:00
服務地址：新竹市東區研發二路1號
施作項目：合約常態清消

若有任何時間調整需求，請隨時與我們聯絡。`,
    status: 'NOTIFIED',
    createdAt: '2026-08-16T14:10:00+08:00',
  },
];

const mockNotificationTemplates: NotificationTemplate[] = [
  {
    id: 'template-001',
    name: '客戶通知範本',
    type: 'CUSTOMER_NOTIFY',
    subject: 'Ecolab 服務排程確認通知',
    content: `尊敬的客戶您好：

我們已為您安排近期的專業服務，排班詳情如下：

客戶名稱：{{客戶名稱}}
服務時間：{{服務時間}}
服務地址：{{服務地址}}

若有任何時間調整需求，請隨時與我們聯絡。`,
    variables: ['{{客戶名稱}}', '{{服務時間}}', '{{服務地址}}'],
  },
  {
    id: 'template-002',
    name: '員工指派通知範本',
    type: 'EMPLOYEE_DISPATCH',
    subject: 'Ecolab 新服務任務指派通知',
    content: `系統已指派您一項新的服務任務，請確認以下資訊：

客戶名稱：{{客戶名稱}}
服務時間：{{服務時間}}
服務地址：{{服務地址}}

請準時前往處理並於完成後更新狀態。`,
    variables: ['{{客戶名稱}}', '{{服務時間}}', '{{服務地址}}'],
  },
];

let mockApprovals: Approval[] = [
  {
    id: 'approval-001',
    taskId: 'task-005',
    type: 'TASK_CHANGE',
    status: 'PENDING',
    requestedBy: 'emp-002',
    requestedByName: '林志豪',
    changeSummary: '調整施作項目與服務時段（改為臭蟲緊急熱處理）',
    diff: [
      { field: 'contents', label: '工作內容', before: '病媒、鼠害', after: '臭蟲' },
      { field: 'time', label: '時段', before: '09:00 ~ 13:00', after: '14:00 ~ 18:00' },
    ],
    approvers: [
      {
        approverId: 'emp-admin',
        approverName: 'Demo 管理員',
        role: 'ADMIN',
        status: 'PENDING',
      },
    ],
    createdAt: '2026-08-03T14:20:00+08:00',
    updatedAt: '2026-08-03T14:20:00+08:00',
  },
  {
    id: 'approval-002',
    taskId: 'task-009',
    type: 'TASK_CHANGE',
    status: 'PENDING',
    requestedBy: 'emp-004',
    requestedByName: '吳建宏',
    changeSummary: '商場打烊後深度清消時段微調',
    diff: [
      { field: 'time', label: '時段', before: '22:00 ~ 01:00', after: '23:00 ~ 02:00' },
      { field: 'contents', label: '工作內容', before: 'P、R', after: 'P、R、S' },
    ],
    approvers: [
      {
        approverId: 'emp-admin',
        approverName: 'Demo 管理員',
        role: 'ADMIN',
        status: 'PENDING',
      },
    ],
    createdAt: '2026-08-04T11:00:00+08:00',
    updatedAt: '2026-08-04T11:00:00+08:00',
  },
  {
    id: 'approval-003',
    taskId: 'task-025',
    type: 'TASK_CHANGE',
    status: 'PENDING',
    requestedBy: 'emp-001',
    requestedByName: '測試使用者',
    changeSummary: '客戶要求調整施作路線與指派人員',
    diff: [{ field: 'route', label: '路次', before: '第二路', after: '第四路' }],
    approvers: [
      {
        approverId: 'emp-admin',
        approverName: 'Demo 管理員',
        role: 'ADMIN',
        status: 'PENDING',
      },
    ],
    createdAt: '2026-08-12T16:00:00+08:00',
    updatedAt: '2026-08-12T16:00:00+08:00',
  },
  {
    id: 'approval-004',
    taskId: 'task-029',
    type: 'ALERT_OVERRIDE',
    status: 'PENDING',
    requestedBy: 'emp-003',
    requestedByName: '黃俊傑',
    changeSummary: '夜間跨日排班工安證照覆蓋',
    overrideRemark: '經理評估現場有主管陪同施作，核准證照覆蓋',
    violatedRules: ['該任務需至少一人持有病媒防治專業技術人員證照', '夜間工時連續超過限制'],
    approvers: [
      {
        approverId: 'emp-admin',
        approverName: 'Demo 管理員',
        role: 'ADMIN',
        status: 'PENDING',
      },
    ],
    createdAt: '2026-08-13T14:00:00+08:00',
    updatedAt: '2026-08-13T14:00:00+08:00',
  },
  {
    id: 'approval-005',
    taskId: 'task-012',
    type: 'ALERT_OVERRIDE',
    status: 'APPROVED',
    requestedBy: 'emp-005',
    requestedByName: '陳雅婷',
    changeSummary: '竹科八廠年度環境消毒特種作業',
    overrideRemark: '經理核准特種環境作業人員調派',
    violatedRules: ['連續工作天數達上限警示'],
    approvers: [
      {
        approverId: 'emp-admin',
        approverName: 'Demo 管理員',
        role: 'ADMIN',
        status: 'APPROVED',
        decidedAt: '2026-08-05T10:30:00+08:00',
        comment: '同意特種環境派工',
      },
    ],
    createdAt: '2026-08-05T10:30:00+08:00',
    updatedAt: '2026-08-05T10:30:00+08:00',
  },
  {
    id: 'approval-006',
    taskId: 'task-028',
    type: 'TASK_CHANGE',
    status: 'REJECTED',
    requestedBy: 'emp-002',
    requestedByName: '林志豪',
    changeSummary: '臨時夜間縮減排班人力',
    diff: [{ field: 'headcount', label: '人數需求', before: '2 人', after: '1 人' }],
    approvers: [
      {
        approverId: 'emp-admin',
        approverName: 'Demo 管理員',
        role: 'ADMIN',
        status: 'REJECTED',
        decidedAt: '2026-08-13T15:00:00+08:00',
        comment: '商場施作面積過大，維持需至少 2 人進行作業',
      },
    ],
    createdAt: '2026-08-13T10:00:00+08:00',
    updatedAt: '2026-08-13T15:00:00+08:00',
  },
];

const mockAlertValidationResult: AlertValidationResult = {
  isValid: true,
  violations: [],
  canOverride: true,
};

const mockScheduleEvents: ScheduleEvent[] = [
  // --- 2026-08-16 (昨日) ---
  {
    id: 'event-001',
    taskId: 'task-001',
    resourceId: 'branch-001',
    title: '星耀科技 - 內湖三期辦公室',
    start: '2026-08-16T09:00:00+08:00',
    end: '2026-08-16T12:30:00+08:00',
    groupName: '星耀科技股份有限公司',
    branchName: '內湖三期辦公室',
    alertStatus: 'CLEAN',
    isRecurring: true,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '早班',
      assignees: [
        {
          employeeId: 'emp-001',
          employeeName: '測試使用者',
          licenses: ['PROFESSIONAL'],
          area: '台北',
        },
      ],
      contents: ['P', 'R'],
    },
  },
  {
    id: 'event-002',
    taskId: 'task-demo-002',
    resourceId: 'branch-003-1',
    title: '陽光餐飲 - 台中西屯門市',
    start: '2026-08-16T14:00:00+08:00',
    end: '2026-08-16T18:00:00+08:00',
    groupName: '陽光連鎖餐飲集團',
    branchName: '台中西屯門市',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'ONETIME',
      shift: '午班',
      assignees: [
        {
          employeeId: 'emp-008',
          employeeName: '王文欽',
          licenses: ['PROFESSIONAL', 'SAFETY_6HR'],
          area: '台中',
        },
      ],
      contents: ['S', 'TERMITE'],
    },
  },
  {
    id: 'event-003',
    taskId: 'task-demo-003',
    resourceId: 'branch-004-1',
    title: '綠地物業 - 板橋大樓管理處',
    start: '2026-08-16T22:00:00+08:00',
    end: '2026-08-17T04:30:00+08:00',
    groupName: '綠地物業管理顧問',
    branchName: '板橋大樓管理處',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: true,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '大夜班',
      assignees: [
        {
          employeeId: 'emp-004',
          employeeName: '吳建宏',
          licenses: ['SAFETY_MANAGER_B'],
          area: '台北',
        },
      ],
      contents: ['R'],
    },
  },

  // --- 2026-08-17 (今日 / Demo 主力) ---
  {
    id: 'event-010',
    taskId: 'task-002',
    resourceId: 'branch-002-1',
    title: '星耀科技 - 內湖三期辦公室',
    start: '2026-08-17T08:30:00+08:00',
    end: '2026-08-17T12:00:00+08:00',
    groupName: '星耀科技股份有限公司',
    branchName: '內湖三期辦公室',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '早班',
      assignees: [
        {
          employeeId: 'emp-001',
          employeeName: '測試使用者',
          licenses: ['PROFESSIONAL'],
          area: '台北',
        },
      ],
      contents: ['P', 'R'],
    },
  },
  {
    id: 'event-011',
    taskId: 'task-003',
    resourceId: 'branch-010-1',
    title: '鼎泰美食王國 - 台北101旗艦店',
    start: '2026-08-17T13:30:00+08:00',
    end: '2026-08-17T17:30:00+08:00',
    groupName: '鼎泰美食王國',
    branchName: '台北101旗艦店',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '午班',
      assignees: [
        {
          employeeId: 'emp-002',
          employeeName: '林志豪',
          licenses: ['PROFESSIONAL', 'SAFETY_6HR'],
          area: '台北',
        },
      ],
      contents: ['P', 'S'],
    },
  },
  {
    id: 'event-012',
    taskId: 'task-004',
    resourceId: 'branch-006-1',
    title: '晶圓精密工業 - 竹科總部一廠',
    start: '2026-08-17T09:00:00+08:00',
    end: '2026-08-17T17:00:00+08:00',
    groupName: '晶圓精密工業',
    branchName: '竹科總部一廠',
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
          area: '新竹',
        },
      ],
      contents: ['P', 'FIRE_ANT'],
    },
  },
  {
    id: 'event-013',
    taskId: 'task-005',
    resourceId: 'branch-003-1',
    title: '陽光連鎖餐飲集團 - 台中西屯門市',
    start: '2026-08-17T10:00:00+08:00',
    end: '2026-08-17T15:30:00+08:00',
    groupName: '陽光連鎖餐飲集團',
    branchName: '台中西屯門市',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'ESR',
      shift: '早班',
      assignees: [
        { employeeId: 'emp-008', employeeName: '王文欽', licenses: ['PEST_CONTROL'], area: '台中' },
      ],
      contents: ['P', 'TERMITE'],
    },
  },
  {
    id: 'event-014',
    taskId: 'task-006',
    resourceId: 'branch-008-1',
    title: '遠東生技園區 - 台南南科生醫館',
    start: '2026-08-17T14:00:00+08:00',
    end: '2026-08-17T18:30:00+08:00',
    groupName: '遠東生技園區',
    branchName: '台南南科生醫館',
    alertStatus: 'OVERRIDDEN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'ONETIME',
      shift: '午班',
      assignees: [
        { employeeId: 'emp-010', employeeName: '劉美玲', licenses: ['PROFESSIONAL'], area: '台南' },
      ],
      contents: ['S', 'OTHER'],
      violationReason: '連續排班第 7 日',
      overrideReason: '主管已簽核特許覆蓋（南科專案緊急支援）',
    },
  },
  {
    id: 'event-015',
    taskId: 'task-007',
    resourceId: 'branch-004-1',
    title: '綠地物業 - 板橋大樓管理處',
    start: '2026-08-17T22:00:00+08:00',
    end: '2026-08-18T05:00:00+08:00',
    groupName: '綠地物業管理顧問',
    branchName: '板橋大樓管理處',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: true,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '大夜班',
      assignees: [
        {
          employeeId: 'emp-004',
          employeeName: '吳建宏',
          licenses: ['SAFETY_MANAGER_B'],
          area: '台北',
        },
      ],
      contents: ['R'],
    },
  },

  // --- 2026-08-18 (明日) ---
  {
    id: 'event-020',
    taskId: 'task-008',
    resourceId: 'branch-002-2',
    title: '星耀科技 - 新竹科學園區廠',
    start: '2026-08-18T08:30:00+08:00',
    end: '2026-08-18T12:00:00+08:00',
    groupName: '星耀科技股份有限公司',
    branchName: '新竹科學園區廠',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '早班',
      assignees: [
        { employeeId: 'emp-006', employeeName: '張家豪', licenses: ['PROFESSIONAL'], area: '新竹' },
      ],
      contents: ['P', 'R'],
    },
  },
  {
    id: 'event-021',
    taskId: 'task-009',
    resourceId: 'branch-010-2',
    title: '鼎泰美食王國 - 新竹巨城店',
    start: '2026-08-18T13:00:00+08:00',
    end: '2026-08-18T17:30:00+08:00',
    groupName: '鼎泰美食王國',
    branchName: '新竹巨城店',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'ONETIME',
      shift: '晚班',
      assignees: [
        { employeeId: 'emp-007', employeeName: '李佩珊', licenses: ['SAFETY_6HR'], area: '新竹' },
      ],
      contents: ['P', 'BED_BUG'],
    },
  },
  {
    id: 'event-022',
    taskId: 'task-010',
    resourceId: 'branch-003-2',
    title: '陽光連鎖餐飲集團 - 台北信義旗艦店',
    start: '2026-08-18T09:00:00+08:00',
    end: '2026-08-18T16:00:00+08:00',
    groupName: '陽光連鎖餐飲集團',
    branchName: '台北信義旗艦店',
    alertStatus: 'CLEAN',
    isRecurring: true,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '早班',
      assignees: [
        {
          employeeId: 'emp-001',
          employeeName: '測試使用者',
          licenses: ['PROFESSIONAL'],
          area: '台北',
        },
      ],
      contents: ['P', 'S'],
    },
  },
  {
    id: 'event-023',
    taskId: 'task-011',
    resourceId: 'branch-006-2',
    title: '晶圓精密工業 - 中科研發大樓',
    start: '2026-08-18T14:00:00+08:00',
    end: '2026-08-18T18:30:00+08:00',
    groupName: '晶圓精密工業',
    branchName: '中科研發大樓',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'ESR',
      shift: '晚班',
      assignees: [
        { employeeId: 'emp-009', employeeName: '周冠宇', licenses: ['FIRE_ANT'], area: '台中' },
      ],
      contents: ['P', 'FIRE_ANT'],
    },
  },

  // --- 2026-08-19 (週三) ---
  {
    id: 'event-030',
    taskId: 'task-012',
    resourceId: 'branch-002-3',
    title: '星耀科技 - 台南南科二廠',
    start: '2026-08-19T09:00:00+08:00',
    end: '2026-08-19T13:00:00+08:00',
    groupName: '星耀科技股份有限公司',
    branchName: '台南南科二廠',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '早班',
      assignees: [
        { employeeId: 'emp-010', employeeName: '劉美玲', licenses: ['PROFESSIONAL'], area: '台南' },
      ],
      contents: ['P', 'R'],
    },
  },
  {
    id: 'event-031',
    taskId: 'task-013',
    resourceId: 'branch-003-2',
    title: '陽光連鎖餐飲集團 - 台南永康門市',
    start: '2026-08-19T14:00:00+08:00',
    end: '2026-08-19T18:00:00+08:00',
    groupName: '陽光連鎖餐飲集團',
    branchName: '台南永康門市',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'ONETIME',
      shift: '午班',
      assignees: [
        { employeeId: 'emp-011', employeeName: '許維倫', licenses: ['PEST_CONTROL'], area: '台南' },
      ],
      contents: ['S', 'TERMITE'],
    },
  },
  {
    id: 'event-032',
    taskId: 'task-014',
    resourceId: 'branch-010-1',
    title: '鼎泰美食王國 - 台北101旗艦店',
    start: '2026-08-19T08:30:00+08:00',
    end: '2026-08-19T12:30:00+08:00',
    groupName: '鼎泰美食王國',
    branchName: '台北101旗艦店',
    alertStatus: 'OVERRIDDEN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '早班',
      assignees: [
        { employeeId: 'emp-002', employeeName: '林志豪', licenses: ['PROFESSIONAL'], area: '台北' },
      ],
      contents: ['P'],
    },
  },

  // --- 2026-08-20 (週四) ---
  {
    id: 'event-040',
    taskId: 'task-015',
    resourceId: 'branch-004-1',
    title: '綠地物業 - 板橋大樓管理處',
    start: '2026-08-20T09:00:00+08:00',
    end: '2026-08-20T17:00:00+08:00',
    groupName: '綠地物業管理顧問',
    branchName: '板橋大樓管理處',
    alertStatus: 'CLEAN',
    isRecurring: true,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '早班',
      assignees: [
        {
          employeeId: 'emp-001',
          employeeName: '測試使用者',
          licenses: ['PROFESSIONAL'],
          area: '台北',
        },
      ],
      contents: ['R', 'VEHICLE_MAINTENANCE'],
    },
  },
  {
    id: 'event-041',
    taskId: 'task-016',
    resourceId: 'branch-002-1',
    title: '星耀科技 - 內湖三期辦公室',
    start: '2026-08-20T13:30:00+08:00',
    end: '2026-08-20T18:00:00+08:00',
    groupName: '星耀科技股份有限公司',
    branchName: '內湖三期辦公室',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'ESR',
      shift: '午班',
      assignees: [
        { employeeId: 'emp-003', employeeName: '黃俊傑', licenses: ['PEST_CONTROL'], area: '台北' },
      ],
      contents: ['P', 'TERMITE'],
    },
  },

  // --- 2026-08-21 (週五) ---
  {
    id: 'event-050',
    taskId: 'task-017',
    resourceId: 'branch-006-1',
    title: '晶圓精密工業 - 竹科總部一廠',
    start: '2026-08-21T08:30:00+08:00',
    end: '2026-08-21T16:30:00+08:00',
    groupName: '晶圓精密工業',
    branchName: '竹科總部一廠',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '早班',
      assignees: [
        { employeeId: 'emp-006', employeeName: '張家豪', licenses: ['PROFESSIONAL'], area: '新竹' },
      ],
      contents: ['P', 'S'],
    },
  },
  {
    id: 'event-051',
    taskId: 'task-018',
    resourceId: 'branch-010-2',
    title: '鼎泰美食王國 - 新竹巨城店',
    start: '2026-08-21T14:00:00+08:00',
    end: '2026-08-21T19:00:00+08:00',
    groupName: '鼎泰美食王國',
    branchName: '新竹巨城店',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'ONETIME',
      shift: '晚班',
      assignees: [
        { employeeId: 'emp-007', employeeName: '李佩珊', licenses: ['SAFETY_6HR'], area: '新竹' },
      ],
      contents: ['P', 'BED_BUG'],
    },
  },

  // --- 2026-08-22 (週六) ---
  {
    id: 'event-060',
    taskId: 'task-019',
    resourceId: 'branch-003-2',
    title: '陽光連鎖餐飲集團 - 台北信義旗艦店',
    start: '2026-08-22T10:00:00+08:00',
    end: '2026-08-22T16:00:00+08:00',
    groupName: '陽光連鎖餐飲集團',
    branchName: '台北信義旗艦店',
    alertStatus: 'CLEAN',
    isRecurring: true,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '午班',
      assignees: [
        { employeeId: 'emp-002', employeeName: '林志豪', licenses: ['PROFESSIONAL'], area: '台北' },
      ],
      contents: ['P', 'S'],
    },
  },

  // --- 2026-08-23 (週日) ---
  {
    id: 'event-070',
    taskId: 'task-020',
    resourceId: 'branch-010-1',
    title: '鼎泰美食王國 - 台北101旗艦店',
    start: '2026-08-23T11:00:00+08:00',
    end: '2026-08-23T17:00:00+08:00',
    groupName: '鼎泰美食王國',
    branchName: '台北101旗艦店',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '早班',
      assignees: [
        {
          employeeId: 'emp-001',
          employeeName: '測試使用者',
          licenses: ['PROFESSIONAL'],
          area: '台北',
        },
      ],
      contents: ['P', 'R'],
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
        { id: 'branch-002-3', title: '台南南科二廠', groupColor: '#0067a0' },
      ],
    },
    {
      id: 'group-003',
      title: '陽光連鎖餐飲集團',
      groupColor: '#c09569',
      children: [
        { id: 'branch-003-1', title: '台中西屯門市', groupColor: '#c09569' },
        { id: 'branch-003-2', title: '台南永康門市', groupColor: '#c06984' },
      ],
    },
    {
      id: 'group-004',
      title: '綠地物業管理顧問',
      groupColor: '#722ed1',
      children: [{ id: 'branch-004-1', title: '板橋大樓管理處', groupColor: '#722ed1' }],
    },
    {
      id: 'group-006',
      title: '晶圓精密工業',
      groupColor: '#52c41a',
      children: [
        { id: 'branch-006-1', title: '竹科總部一廠', groupColor: '#52c41a' },
        { id: 'branch-006-2', title: '中科研發大樓', groupColor: '#52c41a' },
      ],
    },
    {
      id: 'group-008',
      title: '遠東生技園區',
      groupColor: '#faad14',
      children: [{ id: 'branch-008-1', title: '台南南科生醫館', groupColor: '#faad14' }],
    },
    {
      id: 'group-010',
      title: '鼎泰美食王國',
      groupColor: '#eb2f96',
      children: [
        { id: 'branch-010-1', title: '台北101旗艦店', groupColor: '#eb2f96' },
        { id: 'branch-010-2', title: '新竹巨城店', groupColor: '#eb2f96' },
      ],
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

    if (
      (body.account === 'admin_staff' || body.account === 'adminstaff') &&
      (body.password === 'admin123' || body.password === 'staff123')
    ) {
      return HttpResponse.json(
        ok<LoginResponse>({
          accessToken: 'mock-admin-staff-token',
          expiresIn: 3600,
          user: mockAdminStaffUser,
        }),
      );
    }

    if (
      body.account === 'manager' &&
      (body.password === 'manager123' || body.password === 'admin123')
    ) {
      return HttpResponse.json(
        ok<LoginResponse>({
          accessToken: 'mock-manager-token',
          expiresIn: 3600,
          user: mockManagerUser,
        }),
      );
    }

    if (
      body.account === 'leader' &&
      (body.password === 'leader123' || body.password === 'staff123')
    ) {
      return HttpResponse.json(
        ok<LoginResponse>({
          accessToken: 'mock-leader-token',
          expiresIn: 3600,
          user: mockLeaderUser,
        }),
      );
    }

    if (body.account === 'staff' && body.password === 'staff123') {
      return HttpResponse.json(
        ok<LoginResponse>({
          accessToken: 'mock-staff-token',
          expiresIn: 3600,
          user: mockStaffUser,
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
  http.get('*/api/v1/tasks', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword');
    const groupId = url.searchParams.get('groupId');
    const branchId = url.searchParams.get('branchId');
    const taskType = url.searchParams.get('taskType');
    const status = url.searchParams.get('status');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const page = Number(url.searchParams.get('page')) || 1;
    const pageSize = Number(url.searchParams.get('pageSize')) || 20;

    let list = mockTasks;
    if (keyword) {
      const kw = keyword.toLowerCase();
      list = list.filter(
        (t) =>
          t.groupName.toLowerCase().includes(kw) ||
          t.branchName.toLowerCase().includes(kw) ||
          t.route?.toLowerCase().includes(kw) ||
          t.assignees.some((a) => a.employeeName.toLowerCase().includes(kw)),
      );
    }
    if (groupId) {
      list = list.filter((t) => t.groupId === groupId);
    }
    if (branchId) {
      list = list.filter((t) => t.branchId === branchId);
    }
    if (taskType) {
      list = list.filter((t) => t.taskType === taskType);
    }
    if (status) {
      list = list.filter((t) => t.status === status);
    }
    if (startDate) {
      list = list.filter((t) => t.date >= startDate);
    }
    if (endDate) {
      list = list.filter((t) => t.date <= endDate);
    }

    return HttpResponse.json(ok(paginated<Task>(list, page, pageSize)));
  }),
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
    // 編輯修改後，狀態設為「更改」(MODIFIED)，未核准 (isApproved: false)，字體反紅
    updated.status = 'MODIFIED';
    updated.isApproved = false;
    updated.updatedAt = new Date().toISOString();
    mockTasks = mockTasks.map((t) => (t.id === updated.id ? updated : t));

    // 比較前後差異
    const diff: {
      field: string;
      label: string;
      before?: string | number | null;
      after?: string | number | null;
    }[] = [];
    if (data.date && data.date !== existing.date) {
      diff.push({ field: 'date', label: '服務日期', before: existing.date, after: data.date });
    }
    if (
      (data.startTime && data.startTime !== existing.startTime) ||
      (data.endTime && data.endTime !== existing.endTime)
    ) {
      diff.push({
        field: 'time',
        label: '服務時段',
        before: `${existing.startTime} ~ ${existing.endTime}`,
        after: `${data.startTime || existing.startTime} ~ ${data.endTime || existing.endTime}`,
      });
    }
    if (data.shift && data.shift !== existing.shift) {
      diff.push({ field: 'shift', label: '班別', before: existing.shift, after: data.shift });
    }
    if (data.route && data.route !== existing.route) {
      diff.push({ field: 'route', label: '路次', before: existing.route, after: data.route });
    }
    if (data.headcount && data.headcount !== existing.headcount) {
      diff.push({
        field: 'headcount',
        label: '人數需求',
        before: `${existing.headcount} 人`,
        after: `${data.headcount} 人`,
      });
    }
    if (data.contents && JSON.stringify(data.contents) !== JSON.stringify(existing.contents)) {
      diff.push({
        field: 'contents',
        label: '工作內容',
        before: existing.contents.join('、'),
        after: data.contents.join('、'),
      });
    }
    if (data.remarks !== undefined && data.remarks !== existing.remarks) {
      diff.push({
        field: 'remarks',
        label: '備註說明',
        before: existing.remarks || '(無)',
        after: data.remarks || '(無)',
      });
    }

    // 同步將該筆異動申請送至「異動核准」列表 (狀態為 PENDING)
    const newApproval: Approval = {
      id: `approval-${Date.now()}`,
      taskId: updated.id,
      type: 'TASK_CHANGE',
      status: 'PENDING',
      requestedBy: mockUser.id,
      requestedByName: mockUser.name,
      changeSummary:
        diff.length > 0 ? diff.map((d) => `${d.label}變更`).join('、') : '任務內容變更',
      diff: diff.length > 0 ? diff : undefined,
      approvers: [
        {
          approverId: 'emp-admin',
          approverName: 'Demo 管理員',
          role: 'ADMIN',
          status: 'PENDING',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockApprovals = [newApproval, ...mockApprovals.filter((a) => a.taskId !== updated.id)];

    return HttpResponse.json(ok<Task>(updated));
  }),
  http.post('*/api/v1/tasks/:id/validate', () =>
    HttpResponse.json(ok<AlertValidationResult>(mockAlertValidationResult)),
  ),
  http.post('*/api/v1/tasks/:id/override-warning', () => HttpResponse.json(ok(null))),

  // schedule.ts
  http.get('*/api/v1/schedule', ({ request }) => {
    const url = new URL(request.url);
    const dim = url.searchParams.get('dimension') || 'customer';
    const groupId = url.searchParams.get('groupId');
    const branchId = url.searchParams.get('branchId');
    const employeeId = url.searchParams.get('employeeId');
    const area = url.searchParams.get('area');
    const shift = url.searchParams.get('shift');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    let events = mockScheduleEvents.map((e) => {
      if (dim === 'employee') {
        const empId = e.extendedProps.assignees[0]?.employeeId;
        return { ...e, resourceId: empId || e.resourceId };
      }
      return e;
    });

    if (startDate) {
      events = events.filter((e) => (e.start.split('T')[0] ?? '') >= startDate);
    }
    if (endDate) {
      events = events.filter((e) => (e.start.split('T')[0] ?? '') <= endDate);
    }

    if (groupId) {
      const targetGroup = mockCustomerGroups.find((g) => g.id === groupId);
      const groupName = targetGroup?.name;
      events = events.filter(
        (e) =>
          (groupName && e.groupName.includes(groupName)) ||
          e.groupName.includes(groupId) ||
          e.resourceId.includes(groupId),
      );
    }
    if (branchId) {
      events = events.filter((e) => e.resourceId === branchId);
    }
    if (employeeId) {
      events = events.filter((e) =>
        e.extendedProps.assignees.some((a) => a.employeeId === employeeId),
      );
    }
    if (area) {
      events = events.filter((e) => e.extendedProps.assignees.some((a) => a.area === area));
    }
    if (shift) {
      events = events.filter((e) => e.extendedProps.shift === shift);
    }

    let resources: ScheduleResource[] = [];
    if (dim === 'customer') {
      let groups = mockScheduleData.resources;
      if (groupId) {
        groups = groups.filter((g) => g.id === groupId || g.title.includes(groupId));
      }
      if (branchId) {
        groups = groups
          .map((g) => ({
            ...g,
            children: g.children?.filter((b) => b.id === branchId),
          }))
          .filter((g) => g.children && g.children.length > 0);
      }
      resources = groups;
    } else if (dim === 'employee') {
      let emps = mockEmployees;
      if (employeeId) {
        emps = emps.filter((e) => e.id === employeeId);
      }
      if (area) emps = emps.filter((e) => e.area === area || e.groupName?.includes(area));
      if (shift) emps = emps.filter((e) => e.shift === shift || e.groupName?.includes(shift));
      resources = emps.map((e) => ({
        id: e.id,
        title: `${e.name} (${e.area || '台北'} ${e.shift || '早班'})`,
        groupColor: e.groupColor || getGroupColor(e.area || '台北'),
      }));
    }

    return HttpResponse.json(
      ok<ScheduleData>({
        events,
        resources,
      }),
    );
  }),
  http.patch('*/api/v1/schedule', () => HttpResponse.json(ok(null))),

  // customer.ts
  http.get('*/api/v1/customers', () => HttpResponse.json(ok(paginated<Customer>(mockCustomers)))),
  http.get('*/api/v1/customers/groups', () =>
    HttpResponse.json(ok<CustomerGroup[]>(mockCustomerGroups)),
  ),
  http.post('*/api/v1/customers', async ({ request }) => {
    const data = (await request.json()) as Record<string, unknown>;
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      groupId: (data.groupId as string) || 'group-001',
      groupName: (data.groupName as string) || '測試集團',
      branchId: `branch-${Date.now()}`,
      branchName: (data.branchName as string) || '測試分店',
      address: (data.address as string) || '',
      contactName: (data.contactName as string) || '',
      contactPhone: (data.contactPhone as string) || '',
      requiredLicenses: (data.requiredLicenses as LicenseType[]) || [],
      licenseRestrictionNote: data.licenseRestrictionNote as string,
      remarks: (data.remarks as string) || '',
    };
    mockCustomers.unshift(newCust);
    return HttpResponse.json(ok<Customer>(newCust));
  }),
  http.patch('*/api/v1/customers/:id', async ({ params, request }) => {
    const data = (await request.json()) as Record<string, unknown>;
    const index = mockCustomers.findIndex((c) => c.id === params.id);
    if (index !== -1) {
      const existing = mockCustomers[index]!;
      const updated: Customer = {
        ...existing,
        ...data,
      };
      mockCustomers[index] = updated;
      return HttpResponse.json(ok<Customer>(updated));
    }
    return HttpResponse.json(ok<Customer>(mockCustomers[0]!));
  }),
  http.delete('*/api/v1/customers/:id', ({ params }) => {
    mockCustomers = mockCustomers.filter((c) => c.id !== params.id);
    return HttpResponse.json(ok(null));
  }),

  // employee.ts
  http.get('*/api/v1/employees', () => HttpResponse.json(ok(paginated<Employee>(mockEmployees)))),
  http.get('*/api/v1/employees/:id', ({ params }) => {
    const emp = mockEmployees.find((e) => e.id === params.id) || mockEmployees[0]!;
    return HttpResponse.json(ok<Employee>(emp));
  }),
  http.post('*/api/v1/employees', async ({ request }) => {
    const data = (await request.json()) as Record<string, unknown>;
    const area = (data.area as string) || '台北';
    const shift = (data.shift as string) || '早班';
    const groupName = (data.groupName as string) || `${area} ${shift}`;
    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      name: (data.name as string) || '',
      phone: (data.phone as string) || '',
      employeeNo: (data.employeeNo as string) || '',
      position: (data.position as Employee['position']) || 'STAFF',
      groupId: (data.groupId as string) || 'taipei-morning',
      groupName,
      area,
      shift,
      groupColor: getGroupColor(area),
      leaveType: data.leaveType as Employee['leaveType'],
      designatedLeaves: (data.designatedLeaves as string[]) || [],
      licenses: (data.licenses as LicenseType[]) || ['NONE'],
      isActive: true,
    };
    mockEmployees.unshift(newEmp);
    return HttpResponse.json(ok<Employee>(newEmp));
  }),
  http.patch('*/api/v1/employees/:id', async ({ params, request }) => {
    const data = (await request.json()) as Record<string, unknown>;
    const index = mockEmployees.findIndex((e) => e.id === params.id);
    if (index !== -1) {
      const existing = mockEmployees[index]!;
      const area = (data.area !== undefined ? data.area : existing.area) as string;
      const shift = (data.shift !== undefined ? data.shift : existing.shift) as string;
      const groupName =
        data.groupName !== undefined
          ? (data.groupName as string)
          : area && shift
            ? `${area} ${shift}`
            : existing.groupName;
      const updated: Employee = {
        ...existing,
        name: data.name !== undefined ? (data.name as string) : existing.name,
        phone: data.phone !== undefined ? (data.phone as string) : existing.phone,
        employeeNo:
          data.employeeNo !== undefined ? (data.employeeNo as string) : existing.employeeNo,
        position:
          data.position !== undefined ? (data.position as Employee['position']) : existing.position,
        groupId: data.groupId !== undefined ? (data.groupId as string) : existing.groupId,
        area,
        shift,
        groupName,
        groupColor: area ? getGroupColor(area) : existing.groupColor,
        leaveType:
          data.leaveType !== undefined
            ? (data.leaveType as Employee['leaveType'])
            : existing.leaveType,
        designatedLeaves:
          data.designatedLeaves !== undefined
            ? (data.designatedLeaves as string[])
            : existing.designatedLeaves,
        licenses:
          data.licenses !== undefined ? (data.licenses as LicenseType[]) : existing.licenses,
      };
      mockEmployees[index] = updated;
      return HttpResponse.json(ok<Employee>(updated));
    }
    return HttpResponse.json(ok<Employee>(mockEmployees[0]!));
  }),
  http.delete('*/api/v1/employees/:id', ({ params }) => {
    mockEmployees = mockEmployees.filter((e) => e.id !== params.id);
    return HttpResponse.json(ok(null));
  }),

  // notification.ts
  http.get('*/api/v1/notifications', () =>
    HttpResponse.json(ok(paginated<Notification>(mockNotifications))),
  ),
  http.post('*/api/v1/notifications/send', () => HttpResponse.json(ok(null))),
  http.get('*/api/v1/notifications/templates', () =>
    HttpResponse.json(ok<NotificationTemplate[]>(mockNotificationTemplates)),
  ),
  http.patch('*/api/v1/notifications/templates/:id', async ({ params, request }) => {
    const body = (await request.json()) as Partial<NotificationTemplate>;
    const idx = mockNotificationTemplates.findIndex((t) => t.id === params.id);
    if (idx !== -1) {
      mockNotificationTemplates[idx] = { ...mockNotificationTemplates[idx]!, ...body };
      return HttpResponse.json(ok<NotificationTemplate>(mockNotificationTemplates[idx]!));
    }
    const newTpl: NotificationTemplate = {
      id: String(params.id),
      name: '自訂範本',
      type: 'CUSTOMER_NOTIFY',
      subject: body.subject || '',
      content: body.content || '',
      variables: [],
    };
    mockNotificationTemplates.push(newTpl);
    return HttpResponse.json(ok<NotificationTemplate>(newTpl));
  }),

  // approval.ts
  http.get('*/api/v1/approvals', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const keyword = url.searchParams.get('keyword');
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 20);
    let list = mockApprovals;
    if (status) {
      list = list.filter((a) => a.status === status);
    }
    if (type) {
      list = list.filter((a) => a.type === type);
    }
    if (keyword) {
      const kw = keyword.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.id.toLowerCase().includes(kw) ||
          a.requestedByName.toLowerCase().includes(kw) ||
          (a.taskId && a.taskId.toLowerCase().includes(kw)) ||
          (a.changeSummary && a.changeSummary.toLowerCase().includes(kw)),
      );
    }
    return HttpResponse.json(ok(paginated<Approval>(list, page, pageSize)));
  }),
  http.post('*/api/v1/approvals/:id/approve', ({ params }) => {
    const approval = mockApprovals.find((a) => a.id === params.id);
    if (approval) {
      approval.status = 'APPROVED';
      approval.approvers = approval.approvers.map((s) => ({
        ...s,
        status: 'APPROVED',
        decidedAt: new Date().toISOString(),
      }));
      // 管理員/組長核准後，將關聯任務之 isApproved 設為 true（狀態仍為「更改」，字體在任務列表轉為藍色）
      mockTasks = mockTasks.map((t) =>
        t.id === approval.taskId
          ? { ...t, status: 'MODIFIED', isApproved: true, updatedAt: new Date().toISOString() }
          : t,
      );
    }
    return HttpResponse.json(ok(null));
  }),
  http.post('*/api/v1/approvals/:id/reject', async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as { comment?: string };
    const approval = mockApprovals.find((a) => a.id === params.id);
    if (approval) {
      approval.status = 'REJECTED';
      approval.approvers = approval.approvers.map((s) => ({
        ...s,
        status: 'REJECTED',
        comment: body.comment,
        decidedAt: new Date().toISOString(),
      }));
    }
    return HttpResponse.json(ok(null));
  }),

  // pending-customer.ts
  http.get('*/api/v1/pending-customers', ({ request }) => {
    const url = new URL(request.url);
    const groupId = url.searchParams.get('groupId');
    const branchId = url.searchParams.get('branchId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 20);
    let list = mockPendingCustomers.filter((p) => p.status !== 'CONVERTED');
    if (groupId) {
      list = list.filter((p) => p.groupId === groupId);
    }
    if (branchId) {
      list = list.filter((p) => p.branchId === branchId);
    }
    if (startDate) {
      list = list.filter((p) => !p.date || p.date >= startDate);
    }
    if (endDate) {
      list = list.filter((p) => !p.date || p.date <= endDate);
    }
    return HttpResponse.json(ok(paginated<PendingCustomer>(list, page, pageSize)));
  }),
  http.post('*/api/v1/pending-customers', async ({ request }) => {
    const data = (await request.json()) as PendingCustomerFormData;
    const { groupName, branchName } = resolveGroupBranchNames(data.groupId, data.branchId);
    const newPending: PendingCustomer = {
      id: `pending-${Date.now()}`,
      groupId: data.groupId,
      groupName,
      branchId: data.branchId,
      branchName,
      status: 'PENDING',
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      headcount: data.headcount || 1,
      shift: data.shift,
      route: data.route,
      contents: data.contents ?? ['定期環境清潔'],
      assignees: data.assignees ?? [],
      remarks: data.remarks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockPendingCustomers = [newPending, ...mockPendingCustomers];
    return HttpResponse.json(ok<PendingCustomer>(newPending));
  }),
  http.patch('*/api/v1/pending-customers/:id', async ({ params, request }) => {
    const data = (await request.json()) as Partial<PendingCustomerFormData>;
    const existing = mockPendingCustomers.find((p) => p.id === params.id);
    if (!existing) {
      return HttpResponse.json(ok<PendingCustomer | null>(null));
    }
    const { groupName, branchName } = resolveGroupBranchNames(
      data.groupId ?? existing.groupId,
      data.branchId ?? existing.branchId,
    );
    const updated: PendingCustomer = {
      ...existing,
      ...data,
      groupName,
      branchName,
      updatedAt: new Date().toISOString(),
    };
    mockPendingCustomers = mockPendingCustomers.map((p) => (p.id === updated.id ? updated : p));
    return HttpResponse.json(ok<PendingCustomer>(updated));
  }),
  http.post('*/api/v1/pending-customers/:id/convert', async ({ params, request }) => {
    const data = (await request.json()) as ConvertToTaskData;
    const pending = mockPendingCustomers.find((p) => p.id === params.id);
    if (pending) {
      pending.status = 'CONVERTED';
      const newTask: Task = {
        id: `task-${Date.now()}`,
        groupId: pending.groupId,
        groupName: pending.groupName,
        branchId: pending.branchId,
        branchName: pending.branchName,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        isOvernight: isOvernightRange(data.startTime, data.endTime),
        headcount: data.headcount || 1,
        shift: (data.shift || '早班') as ShiftType,
        route: data.route ?? pending.route ?? '路線A',
        contents: (data.contents ?? pending.contents ?? ['定期環境清潔']) as TaskContent[],
        assignees: [],
        remarks: data.remarks ?? pending.remarks,
        taskType: 'CONTRACT',
        status: 'SCHEDULED',
        alertStatus: 'CLEAN',
        isApproved: true,
        createdBy: 'emp-admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockTasks = [newTask, ...mockTasks];
    }
    return HttpResponse.json(ok(null));
  }),
];
