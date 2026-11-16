import { useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import { useLocation } from 'react-router-dom';
import { DatePicker, message, Space, Tag, TimePicker, Typography } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import MapView from '@/components/business/MapView';
import MapPopupContent from './MapPopupContent';
import { useCustomerList } from '@/queries/useCustomerQueries';
import { useEmployeeList } from '@/queries/useEmployeeQueries';
import { useTaskList } from '@/queries/useTaskQueries';
import { filterCustomersByLocation, filterTasksByTime } from '@/utils/mapFilter';
import { getGroupColor, AREA_COLOR_MAP } from '@/utils/groupColor';
import type { Customer } from '@/types/customer';
import type { Task } from '@/types/task';
import { getToday } from '@/utils/date';
import { useUserStore } from '@/stores/useUserStore';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const ECOLAB_BLUE = '#0067a0';
const DATE_FORMAT = 'YYYY-MM-DD';
const TIME_FORMAT = 'HH:mm';

interface MapNavigationState {
  groupId?: string;
  branchId?: string;
}

/**
 * 地圖檢視頁面
 *
 * 以「日期」與「時段」篩選任務，地圖上只顯示這段時間內有任務的客戶分店，
 * 點開標記可看到該分店在這段時間的任務（日期、時間、施作同仁），方便排車次。
 *
 * 從任務列表、排班總覽、任務建立頁帶入 groupId/branchId 時，仍會限定在該分店，
 * 以標籤顯示，可按 × 取消。
 *
 * Validates: Requirements 15.3, 15.4
 */
const MapPage: FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navState = (location.state as MapNavigationState | null) ?? null;

  const today = getToday();
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs(today), dayjs(today)]);
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [groupId, setGroupId] = useState<string | undefined>(navState?.groupId);
  const [branchId, setBranchId] = useState<string | undefined>(navState?.branchId);

  const startDate = dateRange[0].format(DATE_FORMAT);
  const endDate = dateRange[1].format(DATE_FORMAT);
  const startTime = timeRange?.[0]?.format(TIME_FORMAT);
  const endTime = timeRange?.[1]?.format(TIME_FORMAT);

  const { data: customerData } = useCustomerList({ page: 1, pageSize: 1000 });
  const user = useUserStore((state) => state.user);
  // 現場專員與約聘員工（登入角色皆為 STAFF）僅能看到自己被指派的任務
  const isStaff = user?.role === 'STAFF';
  const { data: taskData } = useTaskList({ page: 1, pageSize: 1000, startDate, endDate });
  const { data: employeeData } = useEmployeeList({ page: 1, pageSize: 1000 });

  const customers = useMemo(() => customerData?.list ?? [], [customerData]);
  const employees = useMemo(() => employeeData?.list ?? [], [employeeData]);

  // 符合日期、時段（以及現場人員只看自己）的任務，依日期、開始時間排序
  const visibleTasks = useMemo(() => {
    const list = filterTasksByTime(taskData?.list ?? [], {
      startDate,
      endDate,
      startTime,
      endTime,
    });
    return list
      .filter((task) => !isStaff || task.assignees.some((a) => a.employeeId === user?.id))
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  }, [taskData, startDate, endDate, startTime, endTime, isStaff, user?.id]);

  const tasksByBranchId = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of visibleTasks) {
      map.set(task.branchId, [...(map.get(task.branchId) ?? []), task]);
    }
    return map;
  }, [visibleTasks]);

  // 從導覽帶入之 state 初始化篩選條件（例如自排班總覽/任務列表/任務建立點擊地圖按鈕）
  useEffect(() => {
    if (navState?.groupId) setGroupId(navState.groupId);
    if (navState?.branchId) setBranchId(navState.branchId);
    // 僅於導覽 state 變化時重新套用，避免使用者取消限定後又被覆蓋
  }, [navState?.groupId, navState?.branchId]);

  // 有符合任務的客戶才顯示標記（再套用導覽帶入的集團／分店限定）
  const filteredCustomers: Customer[] = useMemo(
    () =>
      filterCustomersByLocation(
        customers.filter((c) => tasksByBranchId.has(c.branchId)),
        { groupId, branchId },
      ),
    [customers, tasksByBranchId, groupId, branchId],
  );

  const markerColorByCustomerId = useMemo(() => {
    const employeeColorById = new Map(
      employees.map((employee) => [
        employee.id,
        (employee.area && AREA_COLOR_MAP[employee.area]) ||
          employee.groupColor ||
          getGroupColor(employee.groupId),
      ]),
    );
    return Object.fromEntries(
      filteredCustomers.map((customer) => {
        const task = (tasksByBranchId.get(customer.branchId) ?? []).find(
          (x) => x.assignees.length > 0,
        );
        const assigneeId = task?.assignees[0]?.employeeId;
        const color =
          (customer.regions?.[0] && AREA_COLOR_MAP[customer.regions[0]]) ||
          (assigneeId && employeeColorById.get(assigneeId)) ||
          getGroupColor(customer.groupId) ||
          ECOLAB_BLUE;
        return [customer.id, color];
      }),
    );
  }, [employees, filteredCustomers, tasksByBranchId]);

  // 若帶有 branchId，定位至該分店；否則使用預設中心（台灣全視角）
  const center = useMemo(() => {
    if (branchId) {
      const target = filteredCustomers.find((c) => c.branchId === branchId);
      if (target && typeof target.latitude === 'number' && typeof target.longitude === 'number') {
        return { lat: target.latitude, lng: target.longitude };
      }
    }
    return undefined;
  }, [branchId, filteredCustomers]);

  const zoom = branchId ? 14 : 8;

  const limitedCustomer = branchId ? customers.find((c) => c.branchId === branchId) : undefined;
  const limitLabel = limitedCustomer
    ? `${limitedCustomer.groupName} ${limitedCustomer.branchName}`
    : groupId
      ? (customers.find((c) => c.groupId === groupId)?.groupName ?? groupId)
      : undefined;

  const taskCount = filteredCustomers.reduce(
    (sum, c) => sum + (tasksByBranchId.get(c.branchId)?.length ?? 0),
    0,
  );

  return (
    <div className="map-page" data-testid="map-page" style={{ height: '100%' }}>
      <Space wrap style={{ marginBottom: 8 }} data-testid="map-filter-panel">
        <Text strong>{t('map.filter')}：</Text>
        <Text>{t('map.dateRange')}</Text>
        <RangePicker
          aria-label={t('map.dateRange')}
          value={dateRange}
          allowClear={false}
          format={DATE_FORMAT}
          onChange={(value) => {
            if (value?.[0] && value?.[1]) setDateRange([value[0], value[1]]);
          }}
        />
        <Text>{t('map.timeRange')}</Text>
        <TimePicker.RangePicker
          aria-label={t('map.timeRange')}
          value={timeRange}
          format={TIME_FORMAT}
          minuteStep={5}
          allowEmpty={[true, true]}
          onChange={(value) => setTimeRange(value)}
        />
        {limitLabel && (
          <Tag
            closable
            data-testid="map-location-limit"
            onClose={() => {
              setGroupId(undefined);
              setBranchId(undefined);
            }}
          >
            {limitLabel}
          </Tag>
        )}
      </Space>
      <div style={{ marginBottom: 8 }} data-testid="map-summary">
        <Text type="secondary">
          {taskCount > 0
            ? t('map.summary', { tasks: taskCount, places: filteredCustomers.length })
            : t('map.empty')}
        </Text>
      </div>

      <div style={{ height: 'calc(100vh - 250px)' }}>
        <MapView
          customers={filteredCustomers}
          center={center}
          zoom={zoom}
          markerColorByCustomerId={markerColorByCustomerId}
          renderPopup={(customer) => (
            <MapPopupContent
              customer={customer}
              tasks={tasksByBranchId.get(customer.branchId) ?? []}
              accent={markerColorByCustomerId[customer.id] ?? ECOLAB_BLUE}
              canEdit={!isStaff}
              onEditTask={() => message.info('編輯功能即將開放')}
            />
          )}
        />
      </div>
    </div>
  );
};

export default MapPage;
