import { http, HttpResponse } from 'msw';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type {
  Task,
  TaskAssignee,
  TaskFormData,
  ShiftType,
  TaskContent,
  TaskType,
  TaskStatus,
  RecurrenceRule,
} from '@/types/task';
import type { Employee } from '@/types/employee';
import type { Customer, CustomerGroup, CustomerBranch, PendingCustomer } from '@/types/customer';
import type { PendingCustomerFormData, ConvertToTaskData } from '@/api/pending-customer';
import type { Notification, NotificationTemplate, Approval } from '@/types/notification';
import type { UserProfile, LoginResponse } from '@/types/auth';
import type { AlertValidationResult, LicenseType } from '@/types/alert';
import type {
  ScheduleData,
  ScheduleEvent,
  ScheduleResource,
  CopyScheduleParams,
  CopyScheduleResult,
} from '@/types/schedule';
import dayjs from 'dayjs';
import { ROLE_PERMISSIONS } from '@/constants/permissions';
import { getGroupColor } from '@/utils/groupColor';
import { isAddressInRegion, normalizeRegion } from '@/utils/regionMapping';

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
  name: 'Demo 台北組長',
  employeeNo: 'LDR01',
  role: 'LEADER',
  permissions: ROLE_PERMISSIONS.LEADER!,
  groupId: 'taipei-morning',
  area: '台北',
};

// Demo staff account (login: staff / staff123)
const mockStaffUser: UserProfile = {
  id: 'emp-staff',
  name: 'Demo 員工',
  employeeNo: 'STAFF01',
  role: 'STAFF',
  permissions: ROLE_PERMISSIONS.STAFF!,
  groupId: 'taipei-morning',
  area: '台北',
};

const mockTask: Task = {
  id: 'task-001',
  groupId: 'group-001',
  groupName: '測試集團',
  branchId: 'branch-001',
  branchName: '測試分店',
  taskType: 'CONTRACT',
  date: '2026-01-15',
  startTime: '08:00',
  endTime: '16:00',
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
  {
    id: 'group-011',
    name: '台灣麥當勞餐廳股份有限公司',
    branches: [
      {
        id: 'branch-011-1',
        groupId: 'group-011',
        name: '台北民生店',
        address: '台北市松山區民生東路三段135號',
        latitude: 25.0583,
        longitude: 121.5478,
        contactName: '王經理',
        contactPhone: '02-27138899',
        requiredLicenses: ['PEST_CONTROL'],
      },
      {
        id: 'branch-011-2',
        groupId: 'group-011',
        name: '台北桂林店',
        address: '台北市萬華區桂林路1號',
        latitude: 25.0381,
        longitude: 121.5065,
        contactName: '李副理',
        contactPhone: '02-23886677',
        requiredLicenses: ['PEST_CONTROL'],
      },
    ],
  },
  {
    id: 'group-012',
    name: '全家便利商店股份有限公司',
    branches: [
      {
        id: 'branch-012-1',
        groupId: 'group-012',
        name: '宜蘭礁溪門市',
        address: '宜蘭縣礁溪鄉礁溪路五段100號',
        latitude: 24.8272,
        longitude: 121.7745,
        contactName: '林店長',
        contactPhone: '03-9881234',
        requiredLicenses: ['PEST_CONTROL'],
      },
      {
        id: 'branch-012-2',
        groupId: 'group-012',
        name: '基隆海洋門市',
        address: '基隆市仁愛區忠一路1號',
        latitude: 25.1312,
        longitude: 121.7415,
        contactName: '張店長',
        contactPhone: '02-24221234',
        requiredLicenses: ['PEST_CONTROL'],
      },
      {
        id: 'branch-012-3',
        groupId: 'group-012',
        name: '花蓮中正門市',
        address: '花蓮縣花蓮市中正路550號',
        latitude: 23.9785,
        longitude: 121.6065,
        contactName: '陳店長',
        contactPhone: '03-8321234',
        requiredLicenses: ['PEST_CONTROL'],
      },
    ],
  },
];

// 合併基本測試用集團與額外的 demo 集團，供各端點共用
let mockCustomerGroups: CustomerGroup[] = [mockCustomerGroup, ...demoCustomerGroups];

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
  // ===================== 台北 早班 (06:00 ~ 18:00) =====================
  {
    id: 'emp-leader',
    name: 'Demo 台北組長',
    phone: '0912-345-678',
    employeeNo: 'LDR01',
    position: 'LEADER',
    groupId: 'taipei-morning',
    groupName: '台北 早班',
    area: '台北',
    shift: '早班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'SAFETY_6HR'],
    isActive: true,
  },
  {
    id: 'emp-staff',
    name: 'Demo 員工',
    phone: '0988776655',
    employeeNo: 'STAFF01',
    position: 'STAFF',
    groupId: 'taipei-morning',
    groupName: '台北 早班',
    area: '台北',
    shift: '早班',
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
    id: 'emp-tp-m01',
    name: '陳建志',
    phone: '0911223344',
    employeeNo: 'TPM01',
    position: 'STAFF',
    groupId: 'taipei-morning',
    groupName: '台北 早班',
    area: '台北',
    shift: '早班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'SAFETY_6HR'],
    isActive: true,
  },
  {
    id: 'emp-tp-m02',
    name: '楊雅雯',
    phone: '0912334455',
    employeeNo: 'TPM02',
    position: 'STAFF',
    groupId: 'taipei-morning',
    groupName: '台北 早班',
    area: '台北',
    shift: '早班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PEST_CONTROL', 'SAFETY_6HR'],
    isActive: true,
  },
  {
    id: 'emp-tp-m03',
    name: '張育誠',
    phone: '0913445566',
    employeeNo: 'TPM03',
    position: 'STAFF',
    groupId: 'taipei-morning',
    groupName: '台北 早班',
    area: '台北',
    shift: '早班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'FIRE_ANT'],
    isActive: true,
  },
  {
    id: 'emp-tp-m04',
    name: '劉冠廷',
    phone: '0914556677',
    employeeNo: 'TPM04',
    position: 'STAFF',
    groupId: 'taipei-morning',
    groupName: '台北 早班',
    area: '台北',
    shift: '早班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['SAFETY_6HR', 'PEST_CONTROL'],
    isActive: true,
  },
  {
    id: 'emp-tp-m05',
    name: '謝佳穎',
    phone: '0915667788',
    employeeNo: 'TPM05',
    position: 'STAFF',
    groupId: 'taipei-morning',
    groupName: '台北 早班',
    area: '台北',
    shift: '早班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'SAFETY_MANAGER_C'],
    isActive: true,
  },
  {
    id: 'emp-tp-m06',
    name: '吳佩璇',
    phone: '0916778899',
    employeeNo: 'TPM06',
    position: 'STAFF',
    groupId: 'taipei-morning',
    groupName: '台北 早班',
    area: '台北',
    shift: '早班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PEST_CONTROL', 'SAFETY_6HR'],
    isActive: true,
  },

  // ===================== 台北 午班 (12:00 ~ 24:00) =====================
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
  {
    id: 'emp-tp-a01',
    name: '柯志強',
    phone: '0921223344',
    employeeNo: 'TPA01',
    position: 'LEADER',
    groupId: 'taipei-afternoon',
    groupName: '台北 午班',
    area: '台北',
    shift: '午班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'SAFETY_6HR'],
    isActive: true,
  },
  {
    id: 'emp-tp-a02',
    name: '蔡孟潔',
    phone: '0922334466',
    employeeNo: 'TPA02',
    position: 'STAFF',
    groupId: 'taipei-afternoon',
    groupName: '台北 午班',
    area: '台北',
    shift: '午班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PEST_CONTROL', 'SAFETY_6HR'],
    isActive: true,
  },
  {
    id: 'emp-tp-a03',
    name: '鄭宇軒',
    phone: '0923445577',
    employeeNo: 'TPA03',
    position: 'STAFF',
    groupId: 'taipei-afternoon',
    groupName: '台北 午班',
    area: '台北',
    shift: '午班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'SAFETY_6HR'],
    isActive: true,
  },
  {
    id: 'emp-tp-a04',
    name: '許博翔',
    phone: '0924556688',
    employeeNo: 'TPA04',
    position: 'STAFF',
    groupId: 'taipei-afternoon',
    groupName: '台北 午班',
    area: '台北',
    shift: '午班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'PEST_CONTROL'],
    isActive: true,
  },
  {
    id: 'emp-tp-a05',
    name: '賴怡君',
    phone: '0925667799',
    employeeNo: 'TPA05',
    position: 'STAFF',
    groupId: 'taipei-afternoon',
    groupName: '台北 午班',
    area: '台北',
    shift: '午班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['SAFETY_6HR', 'PEST_CONTROL'],
    isActive: true,
  },
  {
    id: 'emp-tp-a06',
    name: '曾品睿',
    phone: '0926778800',
    employeeNo: 'TPA06',
    position: 'STAFF',
    groupId: 'taipei-afternoon',
    groupName: '台北 午班',
    area: '台北',
    shift: '午班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'FIRE_ANT'],
    isActive: true,
  },

  // ===================== 台北 大夜班 (18:00 ~ 06:00 隔夜) =====================
  {
    id: 'emp-002',
    name: '林志豪',
    phone: '0922334455',
    employeeNo: 'E0002',
    position: 'LEADER',
    groupId: 'taipei-night',
    groupName: '台北 大夜班',
    area: '台北',
    shift: '大夜班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'SAFETY_6HR'],
    isActive: true,
  },
  {
    id: 'emp-tp-n01',
    name: '洪大為',
    phone: '0931223344',
    employeeNo: 'TPN01',
    position: 'LEADER',
    groupId: 'taipei-night',
    groupName: '台北 大夜班',
    area: '台北',
    shift: '大夜班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'SAFETY_MANAGER_B'],
    isActive: true,
  },
  {
    id: 'emp-tp-n02',
    name: '郭俊廷',
    phone: '0932334466',
    employeeNo: 'TPN02',
    position: 'STAFF',
    groupId: 'taipei-night',
    groupName: '台北 大夜班',
    area: '台北',
    shift: '大夜班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'PEST_CONTROL'],
    isActive: true,
  },
  {
    id: 'emp-tp-n03',
    name: '蕭凱文',
    phone: '0933445577',
    employeeNo: 'TPN03',
    position: 'STAFF',
    groupId: 'taipei-night',
    groupName: '台北 大夜班',
    area: '台北',
    shift: '大夜班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'SAFETY_6HR'],
    isActive: true,
  },
  {
    id: 'emp-tp-n04',
    name: '廖士豪',
    phone: '0934556688',
    employeeNo: 'TPN04',
    position: 'STAFF',
    groupId: 'taipei-night',
    groupName: '台北 大夜班',
    area: '台北',
    shift: '大夜班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['FIRE_ANT', 'SAFETY_6HR'],
    isActive: true,
  },
  {
    id: 'emp-tp-n05',
    name: '曾冠宇',
    phone: '0935667799',
    employeeNo: 'TPN05',
    position: 'STAFF',
    groupId: 'taipei-night',
    groupName: '台北 大夜班',
    area: '台北',
    shift: '大夜班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'SAFETY_MANAGER_C'],
    isActive: true,
  },
  {
    id: 'emp-tp-n06',
    name: '蘇柏翰',
    phone: '0936778800',
    employeeNo: 'TPN06',
    position: 'STAFF',
    groupId: 'taipei-night',
    groupName: '台北 大夜班',
    area: '台北',
    shift: '大夜班',
    groupColor: '#7a69c0',
    designatedLeaves: [],
    licenses: ['PROFESSIONAL', 'SAFETY_6HR'],
    isActive: true,
  },
  // 新竹組
  {
    id: 'emp-005',
    name: '陳雅婷',
    phone: '0955667788',
    employeeNo: 'E0005',
    position: 'STAFF',
    groupId: 'hsinchu-afternoon',
    groupName: '新竹 午班',
    area: '新竹',
    shift: '午班',
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
    groupId: 'taichung-night',
    groupName: '台中 大夜班',
    area: '台中',
    shift: '大夜班',
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
];

const demoTasks: Task[] = [
  {
    id: 'task-undated-001',
    groupId: 'group-001',
    groupName: '測試集團',
    branchId: 'branch-001',
    branchName: '測試分店',
    taskType: 'CONTRACT',
    date: '',
    startTime: '',
    endTime: '',
    isOvernight: false,
    headcount: 2,
    shift: '早班',
    route: '第一路',
    contents: ['P', 'R'],
    assignees: [],
    remarks: '年度定期合約任務（待排定日期與時段）',
    status: 'UNSCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-01T09:00:00+08:00',
    updatedAt: '2026-08-01T09:00:00+08:00',
  },
  {
    id: 'task-undated-002',
    groupId: 'group-003',
    groupName: '陽光連鎖餐飲集團',
    branchId: 'branch-003-1',
    branchName: '台中西屯門市',
    taskType: 'CONTRACT',
    date: '',
    startTime: '',
    endTime: '',
    isOvernight: false,
    headcount: 2,
    shift: '午班',
    route: '第三路',
    contents: ['P', 'FIRE_ANT'],
    assignees: [],
    remarks: '第三季常態清消合約（客戶尚未指定進場日期）',
    status: 'UNSCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-01T09:00:00+08:00',
    updatedAt: '2026-08-01T09:00:00+08:00',
  },
  {
    id: 'task-undated-003',
    groupId: 'group-005',
    groupName: '鼎泰豐餐飲股份有限公司',
    branchId: 'branch-005-1',
    branchName: '信義旗艦店',
    taskType: 'CONTRACT',
    date: '',
    startTime: '',
    endTime: '',
    isOvernight: true,
    headcount: 2,
    shift: '大夜班',
    route: '第四路',
    contents: ['P', 'R'],
    assignees: [],
    remarks: '年度夜間大消毒預排（待店長回簽排程日期）',
    status: 'UNSCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: '2026-08-01T09:00:00+08:00',
    updatedAt: '2026-08-01T09:00:00+08:00',
  },
  {
    id: 'task-002',
    groupId: 'group-002',
    groupName: '星耀科技股份有限公司',
    branchId: 'branch-002-1',
    branchName: '內湖三期辦公室',
    taskType: 'CONTRACT',
    date: '2026-08-02',
    startTime: '08:30',
    endTime: '15:30',
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
    endTime: '15:30',
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
    startTime: '23:00',
    endTime: '03:00',
    isOvernight: true,
    headcount: 2,
    shift: '大夜班',
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
    startTime: '16:00',
    endTime: '20:00',
    isOvernight: false,
    headcount: 1,
    shift: '午班',
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
    startTime: '08:00',
    endTime: '15:00',
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
    startTime: '16:00',
    endTime: '20:00',
    isOvernight: false,
    headcount: 2,
    shift: '午班',
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
    startTime: '23:30',
    endTime: '03:30',
    isOvernight: true,
    headcount: 2,
    shift: '大夜班',
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
    endTime: '03:00',
    isOvernight: true,
    headcount: 2,
    shift: '大夜班',
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
    startTime: '16:30',
    endTime: '21:30',
    isOvernight: false,
    headcount: 2,
    shift: '午班',
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
    endTime: '15:00',
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
    startTime: '08:30',
    endTime: '15:30',
    isOvernight: false,
    headcount: 2,
    shift: '早班',
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
    endTime: '15:30',
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
    startTime: '23:00',
    endTime: '03:00',
    isOvernight: true,
    headcount: 2,
    shift: '大夜班',
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
    startTime: '23:00',
    endTime: '03:00',
    isOvernight: true,
    headcount: 2,
    shift: '大夜班',
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
    startTime: '09:00',
    endTime: '13:00',
    isOvernight: false,
    headcount: 1,
    shift: '早班',
    route: '第六路',
    contents: ['P'],
    assignees: [],
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
    startTime: '16:00',
    endTime: '20:00',
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
    startTime: '08:30',
    endTime: '15:30',
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
    startTime: '23:30',
    endTime: '03:30',
    isOvernight: true,
    headcount: 2,
    shift: '大夜班',
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
    endTime: '15:00',
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
    startTime: '16:00',
    endTime: '21:00',
    isOvernight: false,
    headcount: 1,
    shift: '午班',
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
  {
    id: 'task-demo-tpe-01',
    groupId: 'group-005',
    groupName: '鼎泰豐餐飲股份有限公司',
    branchId: 'branch-005-1',
    branchName: '信義旗艦店',
    taskType: 'CONTRACT',
    date: '2026-09-02',
    startTime: '08:30',
    endTime: '12:30',
    isOvernight: false,
    headcount: 2,
    shift: '早班',
    route: '第一路',
    contents: ['P', 'R'],
    assignees: [
      { employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-staff', employeeName: 'Demo 員工', licenses: ['PEST_CONTROL'] },
    ],
    remarks: '台北信義旗艦店早班例行清消作業',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-leader',
    createdAt: '2026-09-01T09:00:00+08:00',
    updatedAt: '2026-09-01T09:00:00+08:00',
  },
  {
    id: 'task-demo-tpe-02',
    groupId: 'group-010',
    groupName: '誠品生活股份有限公司',
    branchId: 'branch-010-1',
    branchName: '松菸店',
    taskType: 'CONTRACT',
    date: '2026-09-03',
    startTime: '13:00',
    endTime: '17:00',
    isOvernight: false,
    headcount: 2,
    shift: '午班',
    route: '第二路',
    contents: ['P', 'S'],
    assignees: [
      { employeeId: 'emp-002', employeeName: '林志豪', licenses: ['PROFESSIONAL', 'SAFETY_6HR'] },
      { employeeId: 'emp-004', employeeName: '吳建宏', licenses: ['SAFETY_MANAGER_B'] },
    ],
    remarks: '台北松菸商場例行病媒防治',
    status: 'CONFIRMED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-leader',
    createdAt: '2026-09-01T09:00:00+08:00',
    updatedAt: '2026-09-01T09:00:00+08:00',
  },
  {
    id: 'task-demo-tpe-03',
    groupId: 'group-004',
    groupName: '綠地物業管理顧問',
    branchId: 'branch-004-1',
    branchName: '板橋大樓管理處',
    taskType: 'CONTRACT',
    date: '2026-09-04',
    startTime: '08:00',
    endTime: '14:00',
    isOvernight: false,
    headcount: 2,
    shift: '早班',
    route: '第一路',
    contents: ['P', 'R'],
    assignees: [
      { employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-002', employeeName: '林志豪', licenses: ['PROFESSIONAL', 'SAFETY_6HR'] },
    ],
    remarks: '新北市板橋社區大樓公共空間消毒',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-leader',
    createdAt: '2026-09-01T09:00:00+08:00',
    updatedAt: '2026-09-01T09:00:00+08:00',
  },
  {
    id: 'task-demo-tpe-04',
    groupId: 'group-012',
    groupName: '全家便利商店股份有限公司',
    branchId: 'branch-012-1',
    branchName: '宜蘭礁溪門市',
    taskType: 'CONTRACT',
    date: '2026-09-05',
    startTime: '09:00',
    endTime: '13:00',
    isOvernight: false,
    headcount: 1,
    shift: '早班',
    route: '第三路',
    contents: ['P'],
    assignees: [{ employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] }],
    remarks: '宜蘭責任轄區定期合約清消任務',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-leader',
    createdAt: '2026-09-01T09:00:00+08:00',
    updatedAt: '2026-09-01T09:00:00+08:00',
  },
  {
    id: 'task-demo-tpe-05',
    groupId: 'group-012',
    groupName: '全家便利商店股份有限公司',
    branchId: 'branch-012-2',
    branchName: '基隆海洋門市',
    taskType: 'CONTRACT',
    date: '2026-09-06',
    startTime: '14:00',
    endTime: '18:00',
    isOvernight: false,
    headcount: 1,
    shift: '午班',
    route: '第二路',
    contents: ['P', 'R'],
    assignees: [{ employeeId: 'emp-staff', employeeName: 'Demo 員工', licenses: ['PEST_CONTROL'] }],
    remarks: '基隆責任轄區門市定期防蟲投藥',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-leader',
    createdAt: '2026-09-01T09:00:00+08:00',
    updatedAt: '2026-09-01T09:00:00+08:00',
  },
  {
    id: 'task-demo-tpe-06',
    groupId: 'group-012',
    groupName: '全家便利商店股份有限公司',
    branchId: 'branch-012-3',
    branchName: '花蓮中正門市',
    taskType: 'CONTRACT',
    date: '2026-09-08',
    startTime: '09:30',
    endTime: '15:30',
    isOvernight: false,
    headcount: 2,
    shift: '早班',
    route: '第三路',
    contents: ['P', 'TERMITE'],
    assignees: [
      { employeeId: 'emp-001', employeeName: '測試使用者', licenses: ['PROFESSIONAL'] },
      { employeeId: 'emp-004', employeeName: '吳建宏', licenses: ['SAFETY_MANAGER_B'] },
    ],
    remarks: '花蓮責任轄區白蟻與綜合害蟲防治特派',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'emp-leader',
    createdAt: '2026-09-01T09:00:00+08:00',
    updatedAt: '2026-09-01T09:00:00+08:00',
  },
];

const STORAGE_KEYS = {
  TASKS: 'ecolab_mock_tasks_v7',
  SCHEDULE_EVENTS: 'ecolab_mock_schedule_events_v7',
  PENDING_CUSTOMERS: 'ecolab_mock_pending_customers_v7',
  EMPLOYEES: 'ecolab_mock_employees_v7',
  CUSTOMERS: 'ecolab_mock_customers_v7',
  CUSTOMER_GROUPS: 'ecolab_mock_customer_groups_v7',
};

// 清除舊版本的 localStorage 快取
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const legacyKeys = [
      'ecolab_mock_tasks',
      'ecolab_mock_tasks_v2',
      'ecolab_mock_tasks_v3',
      'ecolab_mock_tasks_v4',
      'ecolab_mock_tasks_v5',
      'ecolab_mock_tasks_v6',
      'ecolab_mock_schedule_events',
      'ecolab_mock_schedule_events_v2',
      'ecolab_mock_schedule_events_v3',
      'ecolab_mock_schedule_events_v4',
      'ecolab_mock_schedule_events_v5',
      'ecolab_mock_schedule_events_v6',
      'ecolab_mock_pending_customers',
      'ecolab_mock_pending_customers_v2',
      'ecolab_mock_pending_customers_v3',
      'ecolab_mock_pending_customers_v4',
      'ecolab_mock_pending_customers_v5',
      'ecolab_mock_pending_customers_v6',
      'ecolab_mock_employees',
      'ecolab_mock_employees_v2',
      'ecolab_mock_employees_v3',
      'ecolab_mock_employees_v4',
      'ecolab_mock_employees_v5',
      'ecolab_mock_employees_v6',
    ];
    legacyKeys.forEach((k) => window.localStorage.removeItem(k));
  } catch (e) {
    void e;
  }
}

function normalizeItemShift<T>(item: T): T {
  if (!item || typeof item !== 'object') return item;
  const anyItem = item as Record<string, unknown>;
  if (anyItem.shift === '晚班') {
    const startTime = typeof anyItem.startTime === 'string' ? anyItem.startTime : '';
    const sh = startTime ? Number(startTime.split(':')[0]) : 16;
    anyItem.shift = sh >= 23 || sh < 7 ? '大夜班' : '午班';
  }
  if (anyItem.groupName && typeof anyItem.groupName === 'string') {
    anyItem.groupName = anyItem.groupName.replace('晚班', '大夜班');
  }
  if (anyItem.extendedProps && typeof anyItem.extendedProps === 'object') {
    const ext = anyItem.extendedProps as Record<string, unknown>;
    if (ext.shift === '晚班') {
      ext.shift = '午班';
    }
  }
  return item;
}

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as T;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeItemShift) as unknown as T;
      }
      if (parsed && typeof parsed === 'object') return normalizeItemShift(parsed);
    }
  } catch (e) {
    void e;
  }
  return fallback;
}

function persistStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    void e;
  }
}

mockCustomerGroups = loadStorage(STORAGE_KEYS.CUSTOMER_GROUPS, mockCustomerGroups);
mockCustomers = loadStorage(STORAGE_KEYS.CUSTOMERS, mockCustomers);

// 清理 mockCustomerGroups 中若有的流水號名稱
mockCustomerGroups = mockCustomerGroups.map((g) => {
  const gName = g.name && !g.name.startsWith('group-') ? g.name : '花蓮集團';
  const branches = g.branches.map((b) => ({
    ...b,
    name: b.name && !b.name.startsWith('branch-') ? b.name : '花蓮分店',
  }));
  return { ...g, name: gName, branches };
});

// 合併基本測試用員工與額外的 demo 員工，供指派員工下拉選單等端點使用（並補齊新增的員工資料）
let mockEmployees: Employee[] = (() => {
  const base = [mockEmployee, ...demoEmployees];
  const loaded = loadStorage<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
  if (!loaded || loaded.length === 0) return base;
  const map = new Map(loaded.map((e) => [e.id, e]));
  for (const b of base) {
    if (!map.has(b.id)) {
      map.set(b.id, b);
    }
  }
  return Array.from(map.values());
})();

// 任務清單改為可變狀態，包含 30 筆示範任務（task-001 到 task-030）
let mockTasks: Task[] = loadStorage(STORAGE_KEYS.TASKS, [mockTask, ...demoTasks]);

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

/** 依集團/分店 id 查出對應的名稱；優先比對集團/分店資料庫，若缺少則嘗試由客戶記錄修復 */
const resolveGroupBranchNames = (groupId?: string, branchId?: string) => {
  if (!groupId && !branchId) return { groupName: '花蓮集團', branchName: '花蓮分店' };

  let group = mockCustomerGroups.find((g) => g.id === groupId || (g.name && g.name === groupId));
  let branch = group?.branches.find((b) => b.id === branchId || (b.name && b.name === branchId));

  if (!branch && branchId) {
    for (const g of mockCustomerGroups) {
      const b = g.branches.find((br) => br.id === branchId || (br.name && br.name === branchId));
      if (b) {
        branch = b;
        if (!group) group = g;
        break;
      }
    }
  }

  const groupHasValidName = Boolean(
    group?.name && !group.name.startsWith('group-') && !group.name.startsWith('cust-'),
  );
  const branchHasValidName = Boolean(
    branch?.name && !branch.name.startsWith('branch-') && !branch.name.startsWith('cust-'),
  );

  if (groupHasValidName && branchHasValidName) {
    return { groupName: group!.name, branchName: branch!.name };
  }

  const cust = mockCustomers.find(
    (c) =>
      c.groupId === groupId ||
      c.branchId === branchId ||
      c.id === branchId ||
      c.id === `cust-${branchId}` ||
      (c.groupName && c.groupName === groupId) ||
      (c.branchName && c.branchName === branchId),
  );

  const groupName = groupHasValidName
    ? group!.name
    : cust?.groupName && !cust.groupName.startsWith('group-')
      ? cust.groupName
      : group?.name && !group.name.startsWith('group-')
        ? group.name
        : groupId && !groupId.startsWith('group-')
          ? groupId
          : '花蓮集團';

  const branchName = branchHasValidName
    ? branch!.name
    : cust?.branchName && !cust.branchName.startsWith('branch-')
      ? cust.branchName
      : branch?.name && !branch.name.startsWith('branch-')
        ? branch.name
        : branchId && !branchId.startsWith('branch-')
          ? branchId
          : '花蓮分店';

  // 若發現新集團/分店，動態補入 mockCustomerGroups 以確保前端所有下拉選單一致
  if (groupId && !group && (groupName !== groupId || cust)) {
    const newG: CustomerGroup = {
      id: groupId,
      name: groupName,
      branches: branchId
        ? [
            {
              id: branchId,
              groupId,
              name: branchName,
              address: cust?.address || '',
              contactName: cust?.contactName || '現場負責人',
              contactPhone: cust?.contactPhone || '02-12345678',
              requiredLicenses: cust?.requiredLicenses || [],
            },
          ]
        : [],
    };
    mockCustomerGroups = [newG, ...mockCustomerGroups];
    persistStorage(STORAGE_KEYS.CUSTOMER_GROUPS, mockCustomerGroups);
  } else if (group && branchId && !branch && branchName !== branchId) {
    group.branches.push({
      id: branchId,
      groupId: groupId || group.id,
      name: branchName,
      address: cust?.address || '',
      contactName: cust?.contactName || '現場負責人',
      contactPhone: cust?.contactPhone || '02-12345678',
      requiredLicenses: cust?.requiredLicenses || [],
    });
    persistStorage(STORAGE_KEYS.CUSTOMER_GROUPS, mockCustomerGroups);
  }

  return { groupName, branchName };
};

// 修復既有快取任務中若有流水號名稱的情況
mockTasks = mockTasks.map((t) => {
  if (
    (t.groupName && t.groupName.startsWith('group-')) ||
    (t.branchName && t.branchName.startsWith('branch-'))
  ) {
    const { groupName, branchName } = resolveGroupBranchNames(t.groupId, t.branchId);
    return { ...t, groupName, branchName };
  }
  return t;
});

/** 依表單資料建立新任務（依日期、時間與指派人員判定 SCHEDULED 或 UNSCHEDULED） */
const buildNewTask = (data: TaskFormData): Task => {
  const resolved = resolveGroupBranchNames(data.groupId, data.branchId);
  const groupName =
    data.groupName && !data.groupName.startsWith('group-') ? data.groupName : resolved.groupName;
  const branchName =
    data.branchName && !data.branchName.startsWith('branch-')
      ? data.branchName
      : resolved.branchName;
  const now = new Date().toISOString();
  const assignees = resolveAssignees(data.assignees);
  const isFullyStaffed = assignees.length > 0 && assignees.length >= (data.headcount || 1);
  const hasDate = Boolean(data.date);
  const hasTime = Boolean(data.startTime || data.endTime);
  const computedStatus: TaskStatus =
    data.status || (isFullyStaffed && hasDate && hasTime ? 'SCHEDULED' : 'UNSCHEDULED');
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
    assignees,
    remarks: data.remarks,
    isMakeup: data.isMakeup,
    originalDate: data.originalDate,
    makeupReason: data.makeupReason,
    requirePhotos: data.requirePhotos,
    photoCount: data.photoCount,
    reportTypes: data.reportTypes,
    photos: data.photos,
    reportNotes: data.reportNotes,
    recurrenceRule: data.recurrence,
    status: computedStatus,
    alertStatus: 'CLEAN',
    createdBy: 'emp-001',
    createdAt: now,
    updatedAt: now,
  };
};

/** 依表單資料更新既有任務，並依日期、時間與指派人員判定狀態 */
const applyTaskUpdate = (existing: Task, data: Partial<TaskFormData>): Task => {
  const groupId = data.groupId ?? existing.groupId;
  const branchId = data.branchId ?? existing.branchId;
  const resolved = resolveGroupBranchNames(groupId, branchId);
  const groupName =
    data.groupName && !data.groupName.startsWith('group-')
      ? data.groupName
      : existing.groupName && !existing.groupName.startsWith('group-')
        ? existing.groupName
        : resolved.groupName;
  const branchName =
    data.branchName && !data.branchName.startsWith('branch-')
      ? data.branchName
      : existing.branchName && !existing.branchName.startsWith('branch-')
        ? existing.branchName
        : resolved.branchName;
  const startTime = data.startTime ?? existing.startTime;
  const endTime = data.endTime ?? existing.endTime;
  const date = data.date ?? existing.date;
  const headcount = data.headcount ?? existing.headcount;
  const assignees =
    data.assignees !== undefined ? resolveAssignees(data.assignees) : existing.assignees;
  const isFullyStaffed = assignees.length > 0 && assignees.length >= (headcount || 1);
  const hasDate = Boolean(date);
  const hasTime = Boolean(startTime || endTime);

  let newStatus: TaskStatus;
  if (data.status) {
    newStatus = data.status;
  } else if (!isFullyStaffed || !hasDate || !hasTime) {
    newStatus = 'UNSCHEDULED';
  } else if (existing.status === 'UNSCHEDULED') {
    newStatus = 'SCHEDULED';
  } else {
    newStatus = 'MODIFIED';
  }

  return {
    ...existing,
    ...data,
    groupId,
    branchId,
    groupName,
    branchName,
    date,
    startTime,
    endTime,
    headcount,
    isOvernight: isOvernightRange(startTime, endTime),
    assignees,
    requirePhotos: data.requirePhotos !== undefined ? data.requirePhotos : existing.requirePhotos,
    photoCount: data.photoCount !== undefined ? data.photoCount : existing.photoCount,
    reportTypes: data.reportTypes !== undefined ? data.reportTypes : existing.reportTypes,
    photos: data.photos !== undefined ? data.photos : existing.photos,
    reportNotes: data.reportNotes !== undefined ? data.reportNotes : existing.reportNotes,
    recurrenceRule: data.recurrence ?? existing.recurrenceRule,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };
};

// --- 其他模組的假資料（待排時間客戶、通知、審批、警示、班表） ---

const defaultPendingCustomers: PendingCustomer[] = [
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
    shift: '大夜班',
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
    shift: '午班',
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
    shift: '大夜班',
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

let mockPendingCustomers: PendingCustomer[] = loadStorage(
  STORAGE_KEYS.PENDING_CUSTOMERS,
  defaultPendingCustomers,
);

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
    sentBy: 'emp-leader',
    senderName: 'Demo 組長',
    senderRole: 'LEADER',
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
    sentBy: 'emp-leader',
    senderName: 'Demo 組長',
    senderRole: 'LEADER',
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
    sentBy: 'emp-manager',
    senderName: 'Demo 經理',
    senderRole: 'MANAGER',
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
    sentBy: 'emp-manager',
    senderName: 'Demo 經理',
    senderRole: 'MANAGER',
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
    sentBy: 'admin',
    senderName: 'Demo 管理員',
    senderRole: 'ADMIN',
    createdAt: '2026-08-16T14:10:00+08:00',
  },
  {
    id: 'notif-demo-1',
    type: 'EMPLOYEE_DISPATCH',
    recipientType: 'EMPLOYEE',
    recipientId: 'emp-staff',
    recipientName: 'Demo 員工',
    subject: '【Ecolab】新服務任務指派通知 - 鼎泰豐 信義店',
    content: `Demo 員工 您好：\n\n系統已指派您一項新的服務任務，請確認以下資訊：\n\n客戶名稱：鼎泰美食王國 - 台北信義旗艦店\n服務時間：2026-08-18 09:00 ~ 12:00\n服務地址：台北市大安區信義路二段194號\n施作項目：定期病媒防治（P）\n\n請準時前往處理並於完成後更新任務狀態。`,
    status: 'NOTIFIED',
    sentBy: 'emp-leader',
    senderName: 'Demo 組長',
    senderRole: 'LEADER',
    createdAt: '2026-08-18T08:00:00+08:00',
  },
  {
    id: 'notif-demo-2',
    type: 'SCHEDULE_REMINDER',
    recipientType: 'EMPLOYEE',
    recipientId: 'emp-staff',
    recipientName: 'Demo 員工',
    subject: '【Ecolab】今日排班行程提醒',
    content: `Demo 員工 您好：\n\n提醒您今日（2026-08-18）有 1 項既定服務行程，首站為 09:00 鼎泰豐信義店，請攜帶安全護具準時前往。`,
    status: 'NOTIFIED',
    sentBy: 'emp-leader',
    senderName: 'Demo 組長',
    senderRole: 'LEADER',
    createdAt: '2026-08-18T08:15:00+08:00',
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
    requestedBy: 'emp-leader',
    requestedByName: '林志豪 (組長)',
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
    requestedBy: 'emp-leader',
    requestedByName: '吳建宏 (組長)',
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
    requestedBy: 'emp-leader',
    requestedByName: 'Demo 組長',
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
    changeSummary: '夜間跨日排班工安證照特許',
    overrideRemark: '經理評估現場有主管陪同施作，核准證照特許',
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

const defaultScheduleEvents: ScheduleEvent[] = [
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
    title: '遠東百貨 - 信義A13',
    start: '2026-08-17T14:00:00+08:00',
    end: '2026-08-17T18:30:00+08:00',
    groupName: '遠東百貨股份有限公司',
    branchName: '信義A13',
    alertStatus: 'OVERRIDDEN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'ONETIME',
      shift: '午班',
      assignees: [
        {
          employeeId: 'emp-001',
          employeeName: '測試使用者',
          licenses: ['PROFESSIONAL'],
          area: '台北',
        },
      ],
      contents: ['S', 'OTHER'],
      violationReason: '連續排班第 7 日',
      overrideReason: '主管已簽核特許覆蓋（信義專案緊急支援）',
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
    start: '2026-08-18T16:00:00+08:00',
    end: '2026-08-18T20:30:00+08:00',
    groupName: '鼎泰美食王國',
    branchName: '新竹巨城店',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'ONETIME',
      shift: '午班',
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
    title: '陽光連鎖餐飲 - 台北信義旗艦店',
    start: '2026-08-18T10:00:00+08:00',
    end: '2026-08-18T13:30:00+08:00',
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
          employeeId: 'emp-staff',
          employeeName: 'Demo 員工',
          licenses: ['PEST_CONTROL'],
          area: '台北',
        },
      ],
      contents: ['P', 'S'],
    },
  },
  {
    id: 'event-024',
    taskId: 'task-001',
    resourceId: 'branch-001',
    title: '星耀科技 - 內湖三期辦公室',
    start: '2026-08-18T08:30:00+08:00',
    end: '2026-08-18T11:30:00+08:00',
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
    id: 'event-025',
    taskId: 'task-003',
    resourceId: 'branch-002-1',
    title: '鼎泰美食王國 - 台北101旗艦店',
    start: '2026-08-18T09:00:00+08:00',
    end: '2026-08-18T14:00:00+08:00',
    groupName: '鼎泰美食王國',
    branchName: '台北101旗艦店',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'ONETIME',
      shift: '早班',
      assignees: [
        {
          employeeId: 'emp-003',
          employeeName: '黃俊傑',
          licenses: ['PEST_CONTROL', 'FIRE_ANT'],
          area: '台北',
        },
      ],
      contents: ['P', 'FIRE_ANT'],
    },
  },
  {
    id: 'event-026',
    taskId: 'task-004',
    resourceId: 'branch-004-1',
    title: '綠地物業 - 板橋大樓管理處',
    start: '2026-08-18T14:30:00+08:00',
    end: '2026-08-18T18:00:00+08:00',
    groupName: '綠地物業管理顧問',
    branchName: '板橋大樓管理處',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '早班',
      assignees: [
        {
          employeeId: 'emp-staff',
          employeeName: 'Demo 員工',
          licenses: ['PEST_CONTROL'],
          area: '台北',
        },
      ],
      contents: ['R'],
    },
  },
  // --- 麥當勞 台北民生店 跨班次交接範例 (大夜 00-06 -> 早班 06-09:30 -> 午班 12-15:30 -> 晚班 16-21) ---
  {
    id: 'event-mcd-00',
    taskId: 'task-mcd-00',
    resourceId: 'branch-011-1',
    title: '麥當勞 - 台北民生店',
    start: '2026-08-18T00:00:00+08:00',
    end: '2026-08-18T06:00:00+08:00',
    groupName: '台灣麥當勞餐廳股份有限公司',
    branchName: '台北民生店',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: true,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '大夜班',
      assignees: [
        {
          employeeId: 'emp-002',
          employeeName: '林沛儒',
          licenses: ['PROFESSIONAL'],
          area: '台北',
        },
      ],
      contents: ['P', 'S'],
    },
  },
  {
    id: 'event-mcd-01',
    taskId: 'task-mcd-01',
    resourceId: 'branch-011-1',
    title: '麥當勞 - 台北民生店',
    start: '2026-08-18T06:00:00+08:00',
    end: '2026-08-18T09:30:00+08:00',
    groupName: '台灣麥當勞餐廳股份有限公司',
    branchName: '台北民生店',
    alertStatus: 'CLEAN',
    isRecurring: true,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '早班',
      assignees: [
        {
          employeeId: 'emp-staff',
          employeeName: 'Demo 員工',
          licenses: ['PEST_CONTROL'],
          area: '台北',
        },
      ],
      contents: ['P', 'R'],
    },
  },
  {
    id: 'event-mcd-02',
    taskId: 'task-mcd-02',
    resourceId: 'branch-011-1',
    title: '麥當勞 - 台北民生店',
    start: '2026-08-18T12:00:00+08:00',
    end: '2026-08-18T15:30:00+08:00',
    groupName: '台灣麥當勞餐廳股份有限公司',
    branchName: '台北民生店',
    alertStatus: 'CLEAN',
    isRecurring: true,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '午班',
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
    id: 'event-mcd-03',
    taskId: 'task-mcd-03',
    resourceId: 'branch-011-1',
    title: '麥當勞 - 台北民生店',
    start: '2026-08-18T16:00:00+08:00',
    end: '2026-08-18T21:00:00+08:00',
    groupName: '台灣麥當勞餐廳股份有限公司',
    branchName: '台北民生店',
    alertStatus: 'CLEAN',
    isRecurring: true,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '午班',
      assignees: [
        {
          employeeId: 'emp-003',
          employeeName: '黃俊傑',
          licenses: ['PEST_CONTROL'],
          area: '台北',
        },
      ],
      contents: ['P', 'BED_BUG'],
    },
  },
  {
    id: 'event-023',
    taskId: 'task-011',
    resourceId: 'branch-006-2',
    title: '晶圓精密工業 - 中科研發大樓',
    start: '2026-08-18T16:00:00+08:00',
    end: '2026-08-18T20:30:00+08:00',
    groupName: '晶圓精密工業',
    branchName: '中科研發大樓',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'ESR',
      shift: '午班',
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
    start: '2026-08-20T16:00:00+08:00',
    end: '2026-08-20T21:00:00+08:00',
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
    end: '2026-08-21T15:30:00+08:00',
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
    start: '2026-08-21T16:00:00+08:00',
    end: '2026-08-21T21:00:00+08:00',
    groupName: '鼎泰美食王國',
    branchName: '新竹巨城店',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'ONETIME',
      shift: '午班',
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
    start: '2026-08-22T08:30:00+08:00',
    end: '2026-08-22T15:30:00+08:00',
    groupName: '陽光連鎖餐飲集團',
    branchName: '台北信義旗艦店',
    alertStatus: 'CLEAN',
    isRecurring: true,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '早班',
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
    start: '2026-08-23T08:30:00+08:00',
    end: '2026-08-23T15:30:00+08:00',
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

let mockScheduleEvents: ScheduleEvent[] = loadStorage(
  STORAGE_KEYS.SCHEDULE_EVENTS,
  defaultScheduleEvents,
);

// 清理 mockScheduleEvents 中的流水號名稱
mockScheduleEvents = mockScheduleEvents.map((e) => {
  const { groupName, branchName } = resolveGroupBranchNames(
    e.groupName,
    e.resourceId || e.branchName,
  );
  const cleanG = e.groupName && !e.groupName.startsWith('group-') ? e.groupName : groupName;
  const cleanB = e.branchName && !e.branchName.startsWith('branch-') ? e.branchName : branchName;
  return {
    ...e,
    groupName: cleanG,
    branchName: cleanB,
    title: `${cleanG} - ${cleanB}`,
  };
});

const getCustomerScheduleResources = (
  targetArea?: string,
  targetGroupId?: string,
  targetBranchId?: string,
): ScheduleResource[] => {
  let groups = mockCustomerGroups;
  if (targetArea) {
    groups = groups
      .map((g) => ({
        ...g,
        branches: g.branches.filter((b) =>
          isAddressInRegion(
            b.address || b.name,
            targetArea,
            (b as unknown as { designatedRegion?: string })?.designatedRegion,
          ),
        ),
      }))
      .filter((g) => g.branches.length > 0);
  }
  if (targetGroupId) {
    groups = groups.filter((g) => g.id === targetGroupId);
  }
  if (targetBranchId) {
    groups = groups
      .map((g) => ({
        ...g,
        branches: g.branches.filter((b) => b.id === targetBranchId),
      }))
      .filter((g) => g.branches.length > 0);
  }
  return groups.map((g) => ({
    id: g.id,
    title: g.name,
    groupColor: getGroupColor(g.name),
    children: g.branches.map((b) => ({
      id: b.id,
      title: b.name,
      groupColor: getGroupColor(g.name),
    })),
  }));
};

export const mockScheduleData: ScheduleData = {
  events: mockScheduleEvents,
  resources: getCustomerScheduleResources(),
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

    // 將尚未排定的待排任務 (mockPendingCustomers) 動態同步併入任務清單
    const pendingAsTasks: Task[] = mockPendingCustomers
      .filter((p) => p.status !== 'CONVERTED')
      .map((p) => ({
        id: `task-${p.id}`,
        groupId: p.groupId,
        groupName: p.groupName,
        branchId: p.branchId,
        branchName: p.branchName,
        taskType: p.taskType || 'CONTRACT',
        date: p.date || '',
        startTime: p.startTime || '',
        endTime: p.endTime || '',
        isOvernight: Boolean(p.isOvernight),
        headcount: p.headcount || 1,
        shift: (p.shift as ShiftType) || '早班',
        route: p.route || '',
        contents: (p.contents as TaskContent[]) || ['P'],
        otherContentNote: p.otherContentNote,
        assignees: (p.assignees || []).map((a) => ({
          employeeId: a.employeeId,
          employeeName: a.employeeName,
          licenses: [],
        })),
        recurrenceRule: p.recurrenceRule,
        remarks: p.remarks || '',
        status: 'UNSCHEDULED',
        isFromPending: true,
        alertStatus: 'CLEAN',
        createdBy: 'emp-001',
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));

    let list = [
      ...mockTasks,
      ...pendingAsTasks.filter(
        (pt) =>
          !mockTasks.some(
            (t) =>
              t.id === pt.id ||
              t.id === `task-${pt.id}` ||
              pt.id === `task-${t.id}` ||
              pt.id === t.id.replace('task-', '') ||
              t.id.replace('task-', '') === pt.id.replace('task-', ''),
          ),
      ),
    ];

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
      list = list.filter((t) => t.date && t.date >= startDate);
    }
    if (endDate) {
      list = list.filter((t) => t.date && t.date <= endDate);
    }
    const area = url.searchParams.get('area');
    if (area) {
      list = list.filter((t) => {
        const branch = mockCustomerGroups
          .flatMap((g) => g.branches)
          .find((b) => b.id === t.branchId);
        const addr = branch?.address || '';
        return isAddressInRegion(
          addr || t.branchName || t.groupName,
          area,
          (t as unknown as { designatedRegion?: string }).designatedRegion,
        );
      });
    }
    const sortBy = url.searchParams.get('sortBy');
    const sortOrder = url.searchParams.get('sortOrder');

    if (sortBy) {
      list.sort((a, b) => {
        const valA = (a as unknown as Record<string, unknown>)[sortBy];
        const valB = (b as unknown as Record<string, unknown>)[sortBy];
        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        const comp = String(valA).localeCompare(String(valB));
        return sortOrder === 'descend' ? -comp : comp;
      });
    } else {
      // 預設排序規則：
      // 1. 未排班且無日期的任務置頂（無日期排最前面）
      // 2. 今天與未來之任務（含待排與已排）依日期由近至遠遞增排序 (today -> future)
      // 3. 過去已經過期的任務（date < today）放置於清單後段，依最近日期排序
      const today = dayjs().format('YYYY-MM-DD');
      list.sort((a, b) => {
        if (!a.date && !b.date) {
          return (a.createdAt || '').localeCompare(b.createdAt || '');
        }
        if (!a.date) return -1;
        if (!b.date) return 1;

        const isPastA = a.date < today;
        const isPastB = b.date < today;

        // 今天與未來優先於已過期
        if (!isPastA && isPastB) return -1;
        if (isPastA && !isPastB) return 1;

        if (!isPastA && !isPastB) {
          if (a.date !== b.date) {
            return a.date.localeCompare(b.date);
          }

          if (a.status === 'UNSCHEDULED' && b.status !== 'UNSCHEDULED') return -1;
          if (a.status !== 'UNSCHEDULED' && b.status === 'UNSCHEDULED') return 1;

          return (a.startTime || '').localeCompare(b.startTime || '');
        }

        // 過去任務：由最近過期的排在較前段 (DESC)
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }

        return (a.startTime || '').localeCompare(b.startTime || '');
      });
    }

    return HttpResponse.json(ok(paginated<Task>(list, page, pageSize)));
  }),
  http.get('*/api/v1/tasks/:id', ({ params }) => {
    let task = mockTasks.find(
      (t) =>
        t.id === params.id ||
        `task-${t.id}` === params.id ||
        t.id === `task-${params.id}` ||
        t.id.replace('task-', '') === (params.id as string).replace('task-', ''),
    );
    if (!task) {
      const pending = mockPendingCustomers.find(
        (p) =>
          p.id === params.id ||
          `task-${p.id}` === params.id ||
          p.id === (params.id as string).replace('task-', ''),
      );
      if (pending) {
        task = {
          id: `task-${pending.id}`,
          groupId: pending.groupId,
          groupName: pending.groupName,
          branchId: pending.branchId,
          branchName: pending.branchName,
          taskType: pending.taskType || 'CONTRACT',
          date: pending.date || '',
          startTime: pending.startTime || '',
          endTime: pending.endTime || '',
          isOvernight: Boolean(pending.isOvernight),
          headcount: pending.headcount || 1,
          shift: (pending.shift as ShiftType) || '早班',
          route: pending.route || '',
          contents: (pending.contents as TaskContent[]) || ['P'],
          otherContentNote: pending.otherContentNote,
          assignees: (pending.assignees || []).map((a) => ({
            employeeId: a.employeeId,
            employeeName: a.employeeName,
            licenses: [],
          })),
          recurrenceRule: pending.recurrenceRule,
          remarks: pending.remarks || '',
          status: 'UNSCHEDULED',
          isFromPending: true,
          alertStatus: 'CLEAN',
          createdBy: 'emp-001',
          createdAt: pending.createdAt,
          updatedAt: pending.updatedAt,
        };
      }
    }
    return HttpResponse.json(ok<Task>(task ?? mockTask));
  }),
  http.post('*/api/v1/tasks', async ({ request }) => {
    const data = (await request.json()) as TaskFormData;
    const created = buildNewTask(data);
    mockTasks = [created, ...mockTasks];
    persistStorage(STORAGE_KEYS.TASKS, mockTasks);
    return HttpResponse.json(ok<Task>(created));
  }),
  http.patch('*/api/v1/tasks/:id', async ({ params, request }) => {
    const data = (await request.json()) as Partial<TaskFormData>;
    let existing = mockTasks.find(
      (t) =>
        t.id === params.id ||
        `task-${t.id}` === params.id ||
        t.id === `task-${params.id}` ||
        t.id.replace('task-', '') === (params.id as string).replace('task-', ''),
    );
    if (!existing) {
      const pending = mockPendingCustomers.find(
        (p) =>
          p.id === params.id ||
          `task-${p.id}` === params.id ||
          p.id === (params.id as string).replace('task-', ''),
      );
      if (pending) {
        existing = {
          id: `task-${pending.id}`,
          groupId: pending.groupId,
          groupName: pending.groupName,
          branchId: pending.branchId,
          branchName: pending.branchName,
          taskType: pending.taskType || 'CONTRACT',
          date: pending.date || '',
          startTime: pending.startTime || '',
          endTime: pending.endTime || '',
          isOvernight: Boolean(pending.isOvernight),
          headcount: pending.headcount || 1,
          shift: (pending.shift as ShiftType) || '早班',
          route: pending.route || '',
          contents: (pending.contents as TaskContent[]) || ['P'],
          otherContentNote: pending.otherContentNote,
          assignees: (pending.assignees || []).map((a) => ({
            employeeId: a.employeeId,
            employeeName: a.employeeName,
            licenses: [],
          })),
          recurrenceRule: pending.recurrenceRule,
          remarks: pending.remarks || '',
          status: 'UNSCHEDULED',
          alertStatus: 'CLEAN',
          createdBy: 'emp-001',
          createdAt: pending.createdAt,
          updatedAt: pending.updatedAt,
        };
        mockTasks = [existing, ...mockTasks];
      }
    }
    if (!existing) {
      return HttpResponse.json(ok<Task>(mockTask));
    }
    const updated = applyTaskUpdate(existing, data);

    if (data.assignees !== undefined) {
      if (Array.isArray(data.assignees)) {
        if (data.assignees.length === 0) {
          updated.assignees = [];
        } else if (typeof data.assignees[0] === 'string') {
          const ids = data.assignees as unknown as string[];
          updated.assignees = ids.map((id) => {
            const emp = mockEmployees.find((e) => e.id === id);
            return {
              employeeId: id,
              employeeName: emp?.name || id,
              licenses: emp?.licenses || [],
              area: emp?.area || '台北',
              groupId: emp?.groupId,
              groupColor: emp?.groupColor || '#7a69c0',
            };
          });
        }
      }
    }

    const isFullyStaffed =
      (updated.assignees?.length || 0) > 0 &&
      (updated.assignees?.length || 0) >= (updated.headcount || 1);
    const hasDate = Boolean(updated.date);
    const hasTime = Boolean(updated.startTime || updated.endTime);

    if (data.status) {
      updated.status = data.status;
    } else if (!isFullyStaffed || !hasDate || !hasTime) {
      updated.status = 'UNSCHEDULED';
      updated.isApproved = false;
    } else if (existing.status === 'UNSCHEDULED') {
      updated.status = 'SCHEDULED';
      updated.isApproved = true;
    } else {
      updated.status = 'MODIFIED';
      updated.isApproved = false;
    }

    updated.updatedAt = new Date().toISOString();
    mockTasks = mockTasks.map((t) =>
      t.id === updated.id ||
      t.id === existing?.id ||
      t.id === params.id ||
      `task-${t.id}` === params.id ||
      t.id.replace('task-', '') === (params.id as string).replace('task-', '')
        ? updated
        : t,
    );
    if (!mockTasks.some((t) => t.id === updated.id)) {
      mockTasks = [updated, ...mockTasks];
    }

    // 同步更新至 mockScheduleEvents 與 mockPendingCustomers
    mockPendingCustomers = mockPendingCustomers.map((p) => {
      if (
        p.id === updated.id ||
        `task-${p.id}` === updated.id ||
        p.id === updated.id.replace('task-', '') ||
        p.id === (params.id as string).replace('task-', '')
      ) {
        const isFullyStaffed =
          (updated.assignees?.length || 0) >= (updated.headcount || 1) &&
          Boolean(updated.date) &&
          Boolean(updated.startTime) &&
          updated.status !== 'UNSCHEDULED';
        return {
          ...p,
          groupId: updated.groupId,
          groupName: updated.groupName,
          branchId: updated.branchId,
          branchName: updated.branchName,
          taskType: updated.taskType,
          date: updated.date,
          startTime: updated.startTime,
          endTime: updated.endTime,
          isOvernight: updated.isOvernight,
          headcount: updated.headcount,
          shift: updated.shift,
          route: updated.route,
          contents: updated.contents,
          otherContentNote: updated.otherContentNote,
          assignees:
            updated.assignees?.map((a) => ({
              employeeId: a.employeeId,
              employeeName: a.employeeName,
            })) || [],
          recurrenceRule: updated.recurrenceRule,
          isRecurring: Boolean(updated.recurrenceRule),
          remarks: updated.remarks,
          status: isFullyStaffed ? 'CONVERTED' : 'PENDING',
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });

    if (!updated.assignees || updated.assignees.length === 0) {
      mockScheduleEvents = mockScheduleEvents.filter(
        (e) =>
          e.taskId !== updated.id &&
          e.taskId !== params.id &&
          e.id !== `event-${updated.id}` &&
          e.id !== `event-${params.id}` &&
          e.taskId !== `task-${params.id}`,
      );
    } else if (updated.date && updated.startTime && updated.endTime) {
      const existingIdx = mockScheduleEvents.findIndex(
        (e) =>
          e.taskId === updated.id || e.taskId === params.id || e.taskId === `task-${params.id}`,
      );
      const scheduleEvt: ScheduleEvent = {
        id:
          existingIdx >= 0 && mockScheduleEvents[existingIdx]
            ? mockScheduleEvents[existingIdx].id
            : `event-${updated.id}`,
        taskId: updated.id,
        resourceId: updated.branchId || 'branch-001',
        title: `${updated.groupName} - ${updated.branchName}`,
        start: `${updated.date}T${updated.startTime}:00+08:00`,
        end: `${updated.date}T${updated.endTime}:00+08:00`,
        groupName: updated.groupName,
        branchName: updated.branchName,
        alertStatus: updated.alertStatus || 'CLEAN',
        isRecurring: Boolean(updated.recurrenceRule),
        isOvernight: updated.isOvernight,
        backgroundColor: updated.assignees?.[0]?.groupColor || '#7a69c0',
        extendedProps: {
          taskType: updated.taskType,
          shift: updated.shift,
          assignees: updated.assignees.map((a) => ({
            employeeId: a.employeeId,
            employeeName: a.employeeName,
            licenses: a.licenses,
            area: a.area || '台北',
            groupId: a.groupId,
            groupColor: a.groupColor,
          })),
          contents: updated.contents,
          isFromPending: true,
          requirePhotos: updated.requirePhotos,
          photoCount: updated.photoCount,
          reportTypes: updated.reportTypes,
          photos: updated.photos,
          reportNotes: updated.reportNotes,
        },
      };
      if (existingIdx >= 0) {
        mockScheduleEvents[existingIdx] = scheduleEvt;
      } else {
        mockScheduleEvents.push(scheduleEvt);
      }
    }

    persistStorage(STORAGE_KEYS.TASKS, mockTasks);
    persistStorage(STORAGE_KEYS.PENDING_CUSTOMERS, mockPendingCustomers);
    persistStorage(STORAGE_KEYS.SCHEDULE_EVENTS, mockScheduleEvents);

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

    // 將 mockTasks 中已排班的任務動態轉為 ScheduleEvent 並與 mockScheduleEvents 合併去重
    const taskEvents: ScheduleEvent[] = mockTasks
      .filter((t) => (t.status === 'SCHEDULED' || t.status === 'MODIFIED') && t.date && t.startTime)
      .map((t) => {
        const { groupName, branchName } = resolveGroupBranchNames(t.groupId, t.branchId);
        const resolvedGroupName =
          t.groupName && !t.groupName.startsWith('group-') ? t.groupName : groupName;
        const resolvedBranchName =
          t.branchName && !t.branchName.startsWith('branch-') ? t.branchName : branchName;
        return {
          id: `event-${t.id}`,
          taskId: t.id,
          resourceId: t.branchId,
          title: `${resolvedGroupName} - ${resolvedBranchName}`,
          start: `${t.date}T${t.startTime}:00+08:00`,
          end: `${t.date}T${t.endTime || '16:00'}:00+08:00`,
          groupName: resolvedGroupName,
          branchName: resolvedBranchName,
          alertStatus: t.alertStatus || 'CLEAN',
          isRecurring: Boolean(t.recurrenceRule),
          isOvernight: t.isOvernight,
          extendedProps: {
            taskType: t.taskType,
            shift: t.shift,
            assignees: t.assignees || [],
            contents: t.contents || [],
          },
        };
      });

    const combinedEvents = [
      ...mockScheduleEvents,
      ...taskEvents.filter((te) => !mockScheduleEvents.some((me) => me.taskId === te.taskId)),
    ];

    let events: ScheduleEvent[] = [];
    if (dim === 'employee') {
      combinedEvents.forEach((e) => {
        if (e.extendedProps.assignees && e.extendedProps.assignees.length > 0) {
          e.extendedProps.assignees.forEach((a) => {
            events.push({
              ...e,
              id: `${e.id}-${a.employeeId}`,
              resourceId: a.employeeId,
            });
          });
        } else {
          events.push(e);
        }
      });
    } else if (dim === 'customer') {
      events = combinedEvents.map((e) => {
        const matchingTask = mockTasks.find((t) => t.id === e.taskId);
        return {
          ...e,
          resourceId: matchingTask?.branchId || e.resourceId,
        };
      });
    } else {
      events = [...combinedEvents];
    }

    if (startDate) {
      events = events.filter((e) => {
        const startD = e.start.split('T')[0] ?? '';
        const endD = e.end.split('T')[0] ?? startD;
        return endD >= startDate;
      });
    }
    if (endDate) {
      events = events.filter((e) => {
        const startD = e.start.split('T')[0] ?? '';
        return startD <= endDate;
      });
    }

    if (groupId && dim === 'customer') {
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
      events = events.filter((e) => {
        const matchingBranch = mockCustomerGroups
          .flatMap((cg) => cg.branches)
          .find((cb) => cb.id === e.resourceId);
        const matchingTask = mockTasks.find((t) => t.id === e.taskId);
        const addr = matchingBranch?.address || '';
        const name = matchingBranch?.name || e.branchName || e.title;
        const designated =
          (matchingBranch as unknown as { designatedRegion?: string })?.designatedRegion ||
          (matchingTask as unknown as { designatedRegion?: string })?.designatedRegion;

        return (
          isAddressInRegion(addr || name, area, designated) ||
          e.extendedProps.assignees.some((a) => normalizeRegion(a.area) === normalizeRegion(area))
        );
      });
    }
    if (shift && dim !== 'employee') {
      events = events.filter((e) => e.extendedProps.shift === shift);
    }

    let resources: ScheduleResource[] = [];
    if (dim === 'customer') {
      resources = getCustomerScheduleResources(
        area || undefined,
        groupId || undefined,
        branchId || undefined,
      );

      // 客戶維度：篩選事件使其與畫面上顯示的分店資源（Resources）精準匹配
      const validResourceIds = new Set<string>();
      resources.forEach((g) => {
        g.children?.forEach((b) => validResourceIds.add(b.id));
      });
      events = events.filter((e) => validResourceIds.has(e.resourceId));
    } else if (dim === 'employee') {
      let emps = mockEmployees.filter(
        (e) =>
          e.position === 'STAFF' ||
          (!e.position && !e.name.includes('組長') && !e.name.includes('經理')),
      );
      if (employeeId) {
        emps = emps.filter((e) => e.id === employeeId);
      }
      if (area) {
        emps = emps.filter(
          (e) =>
            isAddressInRegion(e.area || e.groupName || '', area) ||
            normalizeRegion(e.area) === normalizeRegion(area),
        );
      }
      if (shift) emps = emps.filter((e) => e.shift === shift || e.groupName?.includes(shift));
      resources = emps.map((e) => ({
        id: e.id,
        title: `${e.name} (${e.area || '台北'} ${e.shift || '早班'})`,
        groupColor: e.groupColor || getGroupColor(e.area || '台北'),
      }));

      // 員工維度：篩選事件使其與畫面上顯示的員工名單（Resources）精準匹配
      events = events.filter((e) => resources.some((r) => r.id === e.resourceId));
    }

    return HttpResponse.json(
      ok<ScheduleData>({
        events,
        resources,
      }),
    );
  }),
  http.patch('*/api/v1/schedule', () => HttpResponse.json(ok(null))),
  http.post('*/api/v1/schedule/copy', async ({ request }) => {
    const body = (await request.json()) as CopyScheduleParams;
    const {
      sourceStartDate,
      sourceEndDate,
      targetStartDate,
      employeeIds,
      area,
      taskTypes = ['CONTRACT', 'ONETIME'],
      overwrite = false,
    } = body;

    // 計算來源與目標日期的天數偏移 (Day Offset)
    const sourceStart = dayjs(sourceStartDate);
    const targetStart = dayjs(targetStartDate);
    const dayOffset = targetStart.diff(sourceStart, 'day');

    // 聚合來源區間內的所有排班事件與任務（去重以 taskId 或 id 為準）
    const candidateTasks: Array<{
      id: string;
      date: string;
      startTime: string;
      endTime: string;
      groupId: string;
      groupName: string;
      branchId: string;
      branchName: string;
      taskType: TaskType;
      shift: ShiftType;
      contents: TaskContent[];
      headcount: number;
      remarks?: string;
      route?: string;
      isOvernight: boolean;
      recurrenceRule?: RecurrenceRule;
      assignees: TaskAssignee[];
    }> = [];

    const seenTaskIds = new Set<string>();

    // 1. 從 mockTasks 收集符合來源日期的任務
    mockTasks.forEach((t) => {
      if (!t.date || t.status === 'CANCELLED') return;
      if (t.date < sourceStartDate || t.date > sourceEndDate) return;
      if (taskTypes && taskTypes.length > 0 && !taskTypes.includes(t.taskType)) return;
      if (employeeIds && employeeIds.length > 0) {
        const hasMatchingEmp = t.assignees?.some((a) => employeeIds.includes(a.employeeId));
        if (!hasMatchingEmp) return;
      }
      if (area) {
        const hasMatchingEmp = t.assignees?.some(
          (a) => a.area === area || mockEmployees.find((e) => e.id === a.employeeId)?.area === area,
        );
        const isBranchMatch = isAddressInRegion(t.branchName, area);
        if (!hasMatchingEmp && !isBranchMatch) return;
      }

      seenTaskIds.add(t.id);
      candidateTasks.push({
        id: t.id,
        date: t.date,
        startTime: t.startTime || '09:00',
        endTime: t.endTime || '17:00',
        groupId: t.groupId,
        groupName: t.groupName,
        branchId: t.branchId,
        branchName: t.branchName,
        taskType: t.taskType,
        shift: t.shift,
        contents: t.contents || ['P'],
        headcount: t.headcount || 1,
        remarks: t.remarks,
        route: t.route,
        isOvernight: t.isOvernight,
        recurrenceRule: t.recurrenceRule,
        assignees: t.assignees || [],
      });
    });

    // 2. 從 mockScheduleEvents 收集來源區間的排班事件（若尚未在 mockTasks 中加入）
    mockScheduleEvents.forEach((e) => {
      const eventDate = e.start.split('T')[0] ?? '';
      if (eventDate < sourceStartDate || eventDate > sourceEndDate) return;
      if (seenTaskIds.has(e.taskId)) return;

      const taskType = e.extendedProps?.taskType || 'CONTRACT';
      if (taskTypes && taskTypes.length > 0 && !taskTypes.includes(taskType)) return;

      const assignees = e.extendedProps?.assignees || [];
      if (employeeIds && employeeIds.length > 0) {
        const hasMatchingEmp = assignees.some((a) => employeeIds.includes(a.employeeId));
        if (!hasMatchingEmp) return;
      }
      if (area) {
        const hasMatchingEmp = assignees.some(
          (a) =>
            a.area === area || mockEmployees.find((emp) => emp.id === a.employeeId)?.area === area,
        );
        const isBranchMatch = isAddressInRegion(e.branchName, area);
        if (!hasMatchingEmp && !isBranchMatch) return;
      }

      seenTaskIds.add(e.taskId);
      const startTime = e.start.split('T')[1]?.slice(0, 5) || '09:00';
      const endTime = e.end.split('T')[1]?.slice(0, 5) || '17:00';
      const matchingTask = mockTasks.find((t) => t.id === e.taskId);

      candidateTasks.push({
        id: e.taskId,
        date: eventDate,
        startTime,
        endTime,
        groupId: matchingTask?.groupId || 'group-001',
        groupName: e.groupName || matchingTask?.groupName || '客戶集團',
        branchId: e.resourceId || matchingTask?.branchId || 'branch-001',
        branchName: e.branchName || matchingTask?.branchName || '分店',
        taskType,
        shift: e.extendedProps?.shift || '早班',
        contents: e.extendedProps?.contents || ['P'],
        headcount: e.extendedProps?.headcount || matchingTask?.headcount || 1,
        remarks: matchingTask?.remarks,
        route: matchingTask?.route,
        isOvernight: e.isOvernight,
        recurrenceRule: matchingTask?.recurrenceRule,
        assignees,
      });
    });

    let copiedCount = 0;
    let skippedCount = 0;
    const newTasks: Task[] = [];
    const newScheduleEvents: ScheduleEvent[] = [];

    candidateTasks.forEach((st) => {
      const originalDate = dayjs(st.date);
      const newDateStr = originalDate.add(dayOffset, 'day').format('YYYY-MM-DD');

      // 衝突檢核：若非覆蓋模式，且目標地點在該時段已有任務
      if (!overwrite) {
        const hasDuplicate = mockTasks.some((existing) => {
          if (existing.date !== newDateStr || existing.status === 'CANCELLED') return false;
          return (
            existing.branchId === st.branchId &&
            existing.startTime === st.startTime &&
            existing.endTime === st.endTime
          );
        });

        if (hasDuplicate) {
          skippedCount++;
          return;
        }
      }

      const newTaskId = `task-copy-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const { groupName, branchName } = resolveGroupBranchNames(st.groupId, st.branchId);
      const resolvedGroupName =
        st.groupName && !st.groupName.startsWith('group-') ? st.groupName : groupName;
      const resolvedBranchName =
        st.branchName && !st.branchName.startsWith('branch-') ? st.branchName : branchName;

      const newTask: Task = {
        id: newTaskId,
        groupId: st.groupId,
        groupName: resolvedGroupName,
        branchId: st.branchId,
        branchName: resolvedBranchName,
        taskType: st.taskType,
        date: newDateStr,
        startTime: st.startTime,
        endTime: st.endTime,
        isOvernight: st.isOvernight,
        headcount: st.headcount,
        shift: st.shift,
        route: st.route || '',
        contents: st.contents,
        assignees: [], // 複製過去基本日期、地點和時間訂好，人員先留空
        remarks: st.remarks,
        recurrenceRule: st.recurrenceRule,
        status: 'UNSCHEDULED', // 人員留空後為待排班狀態
        alertStatus: 'CLEAN',
        createdBy: 'emp-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isFromPending: false,
      };

      newTasks.push(newTask);
      newScheduleEvents.push({
        id: `event-${newTaskId}`,
        taskId: newTaskId,
        resourceId: newTask.branchId,
        title: `${resolvedGroupName} - ${resolvedBranchName}`,
        start: `${newDateStr}T${newTask.startTime || '09:00'}:00+08:00`,
        end: `${newDateStr}T${newTask.endTime || '18:00'}:00+08:00`,
        groupName: resolvedGroupName,
        branchName: resolvedBranchName,
        alertStatus: 'CLEAN',
        isRecurring: Boolean(newTask.recurrenceRule),
        isOvernight: newTask.isOvernight,
        extendedProps: {
          taskType: newTask.taskType,
          shift: newTask.shift,
          assignees: [],
          contents: newTask.contents || [],
          headcount: newTask.headcount,
          remarks: newTask.remarks,
          route: newTask.route,
          task: newTask,
        },
      });

      copiedCount++;
    });

    mockTasks = [...newTasks, ...mockTasks];
    mockScheduleEvents = [...newScheduleEvents, ...mockScheduleEvents];
    persistStorage(STORAGE_KEYS.TASKS, mockTasks);
    persistStorage(STORAGE_KEYS.SCHEDULE_EVENTS, mockScheduleEvents);

    return HttpResponse.json(
      ok<CopyScheduleResult>({
        copiedCount,
        skippedCount,
        tasks: newTasks,
      }),
    );
  }),

  // customer.ts
  http.get('*/api/v1/customers', () => HttpResponse.json(ok(paginated<Customer>(mockCustomers)))),
  http.get('*/api/v1/customers/groups', () =>
    HttpResponse.json(ok<CustomerGroup[]>(mockCustomerGroups)),
  ),
  http.post('*/api/v1/customers', async ({ request }) => {
    const data = (await request.json()) as Record<string, unknown>;
    const groupName = ((data.groupName as string) || '未命名集團').trim();
    const branchName = ((data.branchName as string) || '總部').trim();

    // 尋找既有集團或新建集團
    let targetGroup = mockCustomerGroups.find(
      (g) => (data.groupId && g.id === data.groupId) || g.name === groupName,
    );

    const groupId = (data.groupId as string) || targetGroup?.id || `group-${Date.now()}`;
    const branchId = (data.branchId as string) || `branch-${Date.now()}`;

    const newBranch: CustomerBranch = {
      id: branchId,
      groupId,
      name: branchName,
      address: (data.address as string) || '',
      contactName: (data.contactName as string) || '現場負責人',
      contactPhone: (data.contactPhone as string) || '02-12345678',
      requiredLicenses: (data.requiredLicenses as LicenseType[]) || [],
      licenseRestrictionNote: data.licenseRestrictionNote as string,
    };

    if (targetGroup) {
      targetGroup.branches = [...targetGroup.branches, newBranch];
    } else {
      targetGroup = {
        id: groupId,
        name: groupName,
        branches: [newBranch],
      };
      mockCustomerGroups = [targetGroup, ...mockCustomerGroups];
    }

    const newCust: Customer = {
      id: branchId,
      groupId: targetGroup.id,
      groupName: targetGroup.name,
      branchId: newBranch.id,
      branchName: newBranch.name,
      address: newBranch.address,
      contactName: newBranch.contactName,
      contactPhone: newBranch.contactPhone,
      requiredLicenses: newBranch.requiredLicenses,
      licenseRestrictionNote: newBranch.licenseRestrictionNote,
      remarks: (data.remarks as string) || '',
    };
    mockCustomers.unshift(newCust);
    persistStorage(STORAGE_KEYS.CUSTOMER_GROUPS, mockCustomerGroups);
    persistStorage(STORAGE_KEYS.CUSTOMERS, mockCustomers);
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
      persistStorage(STORAGE_KEYS.CUSTOMERS, mockCustomers);
      return HttpResponse.json(ok<Customer>(updated));
    }
    return HttpResponse.json(ok<Customer>(mockCustomers[0]!));
  }),
  http.delete('*/api/v1/customers/:id', ({ params }) => {
    mockCustomers = mockCustomers.filter((c) => c.id !== params.id);
    persistStorage(STORAGE_KEYS.CUSTOMERS, mockCustomers);
    return HttpResponse.json(ok(null));
  }),

  // employee.ts
  http.get('*/api/v1/employees', ({ request }) => {
    const url = new URL(request.url);
    const area = url.searchParams.get('area');
    const shift = url.searchParams.get('shift');
    const keyword = url.searchParams.get('keyword');
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 20);

    let list = mockEmployees;
    if (area) {
      list = list.filter(
        (e) => e.area === area || e.groupName?.includes(area) || e.groupId?.includes(area),
      );
    }
    if (shift) {
      list = list.filter((e) => e.shift === shift || e.groupName?.includes(shift));
    }
    if (keyword) {
      const kw = keyword.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(kw) ||
          e.employeeNo.toLowerCase().includes(kw) ||
          (e.phone && e.phone.includes(kw)),
      );
    }
    return HttpResponse.json(ok(paginated<Employee>(list, page, pageSize)));
  }),
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
  http.get('*/api/v1/notifications', ({ request }) => {
    const url = new URL(request.url);
    const recipientId = url.searchParams.get('recipientId');
    const recipientName = url.searchParams.get('recipientName');
    let list = mockNotifications;
    if (recipientId) {
      list = list.filter((n) => n.recipientId === recipientId);
    }
    if (recipientName) {
      list = list.filter(
        (n) => n.recipientName.includes(recipientName) || n.content.includes(recipientName),
      );
    }
    return HttpResponse.json(ok(paginated<Notification>(list)));
  }),
  http.post('*/api/v1/notifications/send', async ({ request }) => {
    try {
      const body = (await request.json()) as {
        templateId?: string;
        recipientType?: 'CUSTOMER' | 'EMPLOYEE';
        recipientIds?: string[];
        taskId?: string;
        variables?: Record<string, string>;
      };

      const recipientType = body?.recipientType || 'CUSTOMER';
      const isCust = recipientType === 'CUSTOMER';
      const recipientName = isCust
        ? body?.variables?.['{{客戶名稱}}'] || '新通知客戶'
        : '指派服務專員';

      const newNotif: Notification = {
        id: `notif-${Date.now()}`,
        type: isCust ? 'CUSTOMER_NOTIFY' : 'EMPLOYEE_DISPATCH',
        templateId: body?.templateId || 'template-001',
        recipientType,
        recipientId: body?.recipientIds?.[0] || 'rec-new',
        recipientName,
        subject: isCust
          ? `【Ecolab】服務排程確認通知 - ${recipientName}`
          : `【Ecolab】新服務任務指派通知`,
        content: `尊敬的${isCust ? '客戶' : '專員'}您好：\n\n我們已為您更新服務排程資訊。\n客戶名稱：${recipientName}\n服務時間：${body?.variables?.['{{服務時間}}'] || '即時指派時間'}\n服務地址：${body?.variables?.['{{服務地址}}'] || '台北市'}\n\n若有任何問題，請隨時與我們聯絡。`,
        status: 'NOTIFIED',
        taskId: body?.taskId,
        createdAt: new Date().toISOString(),
      };

      mockNotifications.unshift(newNotif);
    } catch {
      // fallback
    }
    return HttpResponse.json(ok(null));
  }),
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
    const requestedBy = url.searchParams.get('requestedBy');
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 20);
    let list = mockApprovals;
    if (requestedBy) {
      list = list.filter(
        (a) =>
          a.requestedBy === requestedBy ||
          a.requestedByName === requestedBy ||
          a.requestedByName.includes(requestedBy),
      );
    }
    if (status) {
      if (status === 'PROCESSED') {
        list = list.filter((a) => a.status !== 'PENDING');
      } else {
        list = list.filter((a) => a.status === status);
      }
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

    // 預設排序：待核准 (PENDING) 案件置頂最上方，已處理案件依建立時間新至舊排在下方
    list = [...list].sort((a, b) => {
      const isPendingA = a.status === 'PENDING' ? 0 : 1;
      const isPendingB = b.status === 'PENDING' ? 0 : 1;
      if (isPendingA !== isPendingB) {
        return isPendingA - isPendingB;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

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
  http.post('*/api/v1/approvals/:id/withdraw', ({ params }) => {
    const approval = mockApprovals.find((a) => a.id === params.id);
    if (approval) {
      approval.status = 'WITHDRAWN';
      approval.approvers = approval.approvers.map((s) => ({
        ...s,
        status: 'WITHDRAWN',
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
    const area = url.searchParams.get('area');
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
    if (area) {
      list = list.filter((p) => {
        const branch = mockCustomerGroups
          .flatMap((cg) => cg.branches)
          .find((b) => b.id === p.branchId);
        const addr = branch?.address || '';
        const name = branch?.name || p.branchName || p.groupName;
        const designated = (branch as unknown as { designatedRegion?: string })?.designatedRegion;
        return isAddressInRegion(addr || name, area, designated);
      });
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
    const id = `pending-${Date.now()}`;
    const newPending: PendingCustomer = {
      id,
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
      recurrenceRule: data.recurrenceRule,
      isRecurring: Boolean(data.recurrenceRule),
      remarks: data.remarks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockPendingCustomers = [newPending, ...mockPendingCustomers];

    // 同步新增至待排任務清單 (UNSCHEDULED)
    const newUnscheduledTask: Task = {
      id: `task-${id}`,
      groupId: data.groupId,
      groupName,
      branchId: data.branchId,
      branchName,
      taskType: (data as unknown as { taskType?: TaskType }).taskType || 'CONTRACT',
      date: data.date || new Date().toISOString().split('T')[0]!,
      startTime: data.startTime || '09:00',
      endTime: data.endTime || '17:00',
      isOvernight: false,
      headcount: data.headcount || 1,
      shift: (data.shift as ShiftType) || '早班',
      route: data.route || '',
      contents: (data.contents as TaskContent[]) || ['P'],
      assignees: resolveAssignees(
        (data.assignees || []).map((a: unknown) =>
          typeof a === 'string' ? a : (a as { employeeId: string }).employeeId,
        ),
      ),
      recurrenceRule: data.recurrenceRule,
      remarks: data.remarks || '',
      status: 'UNSCHEDULED',
      alertStatus: 'CLEAN',
      createdBy: 'emp-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockTasks = [newUnscheduledTask, ...mockTasks];
    persistStorage(STORAGE_KEYS.PENDING_CUSTOMERS, mockPendingCustomers);
    persistStorage(STORAGE_KEYS.TASKS, mockTasks);

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
      recurrenceRule: 'recurrenceRule' in data ? data.recurrenceRule : existing.recurrenceRule,
      isRecurring: 'recurrenceRule' in data ? Boolean(data.recurrenceRule) : existing.isRecurring,
      groupName,
      branchName,
      updatedAt: new Date().toISOString(),
    };
    mockPendingCustomers = mockPendingCustomers.map((p) => (p.id === updated.id ? updated : p));

    // 同步更新 mockTasks
    const matchingTaskId = `task-${params.id}`;
    mockTasks = mockTasks.map((t) => {
      if (t.id === matchingTaskId || t.id === params.id) {
        return {
          ...t,
          groupId: updated.groupId,
          groupName: updated.groupName,
          branchId: updated.branchId,
          branchName: updated.branchName,
          date: updated.date || t.date,
          startTime: updated.startTime || t.startTime,
          endTime: updated.endTime || t.endTime,
          shift: (updated.shift as ShiftType) || t.shift,
          route: updated.route || t.route,
          recurrenceRule: updated.recurrenceRule,
          remarks: updated.remarks ?? t.remarks,
          updatedAt: new Date().toISOString(),
        };
      }
      return t;
    });

    persistStorage(STORAGE_KEYS.PENDING_CUSTOMERS, mockPendingCustomers);
    persistStorage(STORAGE_KEYS.TASKS, mockTasks);

    return HttpResponse.json(ok<PendingCustomer>(updated));
  }),
  http.post('*/api/v1/pending-customers/:id/convert', async ({ params, request }) => {
    const data = (await request.json()) as ConvertToTaskData;
    const pending = mockPendingCustomers.find((p) => p.id === params.id);
    if (pending) {
      pending.status = 'CONVERTED';
      const taskId = `task-${params.id}`;
      const existingTaskIdx = mockTasks.findIndex((t) => t.id === taskId || t.id === params.id);
      const recurrenceRule = data.recurrenceRule ?? pending.recurrenceRule;
      const scheduledTask: Task = {
        id:
          existingTaskIdx >= 0 && mockTasks[existingTaskIdx]
            ? mockTasks[existingTaskIdx].id
            : `task-${Date.now()}`,
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
        assignees: (data.assignees || []).map((a) => {
          const emp = mockEmployees.find((e) => e.id === a.employeeId);
          return {
            employeeId: a.employeeId,
            employeeName: emp?.name || a.employeeName || a.employeeId,
            licenses: emp?.licenses || [],
          };
        }),
        recurrenceRule,
        remarks: data.remarks ?? pending.remarks,
        taskType: 'CONTRACT',
        status:
          (data.assignees?.length || 0) > 0 &&
          (data.assignees?.length || 0) >= (data.headcount || 1) &&
          Boolean(data.date) &&
          Boolean(data.startTime || data.endTime)
            ? 'SCHEDULED'
            : 'UNSCHEDULED',
        alertStatus: 'CLEAN',
        isApproved: true,
        createdBy: 'emp-admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (existingTaskIdx >= 0) {
        mockTasks[existingTaskIdx] = scheduledTask;
      } else {
        mockTasks = [scheduledTask, ...mockTasks];
      }

      // 同步排入行事曆
      const existingEvtIdx = mockScheduleEvents.findIndex((e) => e.taskId === scheduledTask.id);
      const scheduleEvt: ScheduleEvent = {
        id:
          existingEvtIdx >= 0 && mockScheduleEvents[existingEvtIdx]
            ? mockScheduleEvents[existingEvtIdx].id
            : `event-${scheduledTask.id}`,
        taskId: scheduledTask.id,
        resourceId: scheduledTask.branchId || 'branch-001',
        title: `${scheduledTask.groupName} - ${scheduledTask.branchName}`,
        start: `${scheduledTask.date}T${scheduledTask.startTime}:00+08:00`,
        end: `${scheduledTask.date}T${scheduledTask.endTime}:00+08:00`,
        groupName: scheduledTask.groupName,
        branchName: scheduledTask.branchName,
        alertStatus: 'CLEAN',
        isRecurring: Boolean(recurrenceRule),
        isOvernight: scheduledTask.isOvernight,
        backgroundColor: '#7a69c0',
        extendedProps: {
          taskType: scheduledTask.taskType,
          shift: scheduledTask.shift,
          assignees: [],
          contents: scheduledTask.contents,
        },
      };
      if (existingEvtIdx >= 0) {
        mockScheduleEvents[existingEvtIdx] = scheduleEvt;
      } else {
        mockScheduleEvents.push(scheduleEvt);
      }

      persistStorage(STORAGE_KEYS.PENDING_CUSTOMERS, mockPendingCustomers);
      persistStorage(STORAGE_KEYS.TASKS, mockTasks);
      persistStorage(STORAGE_KEYS.SCHEDULE_EVENTS, mockScheduleEvents);
    }
    return HttpResponse.json(ok(null));
  }),
  http.delete('*/api/v1/pending-customers/:id', ({ params }) => {
    mockPendingCustomers = mockPendingCustomers.filter((p) => p.id !== params.id);
    mockTasks = mockTasks.filter((t) => t.id !== params.id && t.id !== `task-${params.id}`);
    persistStorage(STORAGE_KEYS.PENDING_CUSTOMERS, mockPendingCustomers);
    persistStorage(STORAGE_KEYS.TASKS, mockTasks);
    return HttpResponse.json(ok(null));
  }),
  http.delete('/api/pending-customers/:id', ({ params }) => {
    mockPendingCustomers = mockPendingCustomers.filter((p) => p.id !== params.id);
    mockTasks = mockTasks.filter((t) => t.id !== params.id && t.id !== `task-${params.id}`);
    persistStorage(STORAGE_KEYS.PENDING_CUSTOMERS, mockPendingCustomers);
    persistStorage(STORAGE_KEYS.TASKS, mockTasks);
    return HttpResponse.json(ok(null));
  }),
];
