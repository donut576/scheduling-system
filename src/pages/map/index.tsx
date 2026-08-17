import { useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import { useLocation } from 'react-router-dom';
import { Select, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import MapView from '@/components/business/MapView';
import { useCustomerList, useCustomerGroups } from '@/queries/useCustomerQueries';
import { useEmployeeList } from '@/queries/useEmployeeQueries';
import { useTaskList } from '@/queries/useTaskQueries';
import { filterCustomersByLocation } from '@/utils/mapFilter';
import { getGroupColor, AREA_COLOR_MAP } from '@/utils/groupColor';
import type { Customer } from '@/types/customer';

const { Text } = Typography;
const ECOLAB_BLUE = '#0067a0';

interface MapNavigationState {
  groupId?: string;
  branchId?: string;
}

/**
 * 地圖檢視頁面
 *
 * 整合 MapView 與篩選面板（依集團、分店篩選），並支援從任務列表、排班總覽、
 * 任務建立頁面點擊地圖按鈕後帶入 groupId/branchId 定位至相關位置。
 *
 * 篩選之解讀（Requirement 15.3）：
 * 需求列出「集團、分店、群組」三種篩選維度。就客戶分店資料而言，並無獨立於
 * 「集團」之「群組」概念（「群組」為員工指派之組織概念，見需求 11），因此本頁
 * 面以「集團」篩選作為「群組」篩選之實務對應：選擇集團即等同篩選該集團（群組）
 * 之所有分店標記，並額外提供「分店」篩選作進一步縮小範圍。
 *
 * Validates: Requirements 15.3, 15.4
 */
/**
 * 地圖檢視頁面主元件
 * 負責集團/分店篩選狀態、導覽帶入定位與標記顏色計算
 */
const MapPage: FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navState = (location.state as MapNavigationState | null) ?? null;

  const [groupId, setGroupId] = useState<string | undefined>(navState?.groupId);
  const [branchId, setBranchId] = useState<string | undefined>(navState?.branchId);

  const { data: customerGroups = [] } = useCustomerGroups();
  const { data: customerData } = useCustomerList({ page: 1, pageSize: 1000 });
  const { data: taskData } = useTaskList({ page: 1, pageSize: 1000 });
  const { data: employeeData } = useEmployeeList({ page: 1, pageSize: 1000 });
  const customers = useMemo(() => customerData?.list ?? [], [customerData]);
  const tasks = useMemo(() => taskData?.list ?? [], [taskData]);
  const employees = useMemo(() => employeeData?.list ?? [], [employeeData]);

  // 從導覽帶入之 state 初始化篩選條件（例如自排班總覽/任務列表/任務建立點擊地圖按鈕）
  useEffect(() => {
    if (navState?.groupId) {
      setGroupId(navState.groupId);
    }
    if (navState?.branchId) {
      setBranchId(navState.branchId);
    }
    // 僅於導覽 state 變化時重新套用，避免使用者手動篩選後被覆蓋
  }, [navState?.groupId, navState?.branchId]);

  const groupOptions = useMemo(
    () => customerGroups.map((g) => ({ label: g.name, value: g.id })),
    [customerGroups],
  );

  const branchOptions = useMemo(() => {
    if (!groupId) return [];
    const group = customerGroups.find((g) => g.id === groupId);
    return (group?.branches ?? []).map((b) => ({ label: b.name, value: b.id }));
  }, [groupId, customerGroups]);

  // 切換集團篩選時，重置分店篩選（避免殘留不屬於新集團的分店選項）
  const handleGroupChange = (value: string | undefined) => {
    setGroupId(value);
    setBranchId(undefined);
  };

  // Property 27: 地圖篩選正確性 - 顯示之標記僅包含符合所有篩選條件之客戶分店
  const filteredCustomers: Customer[] = useMemo(
    () => filterCustomersByLocation(customers, { groupId, branchId }),
    [customers, groupId, branchId],
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
        const task = tasks.find(
          (item) => item.branchId === customer.branchId && item.assignees.length > 0,
        );
        const assigneeId = task?.assignees[0]?.employeeId;
        const color =
          (assigneeId && employeeColorById.get(assigneeId)) ||
          getGroupColor(customer.groupId) ||
          ECOLAB_BLUE;
        return [customer.id, color];
      }),
    );
  }, [employees, filteredCustomers, tasks]);

  // 若帶有 branchId，定位至該分店；否則使用預設中心
  const center = useMemo(() => {
    const target = branchId
      ? filteredCustomers.find((c) => c.branchId === branchId)
      : filteredCustomers[0];
    if (target && typeof target.latitude === 'number' && typeof target.longitude === 'number') {
      return { lat: target.latitude, lng: target.longitude };
    }
    return undefined;
  }, [branchId, filteredCustomers]);

  return (
    <div className="map-page" data-testid="map-page" style={{ height: '100%' }}>
      <Space wrap style={{ marginBottom: 16 }} data-testid="map-filter-panel">
        <Text strong>{t('map.filter')}：</Text>
        <Select
          aria-label={t('schedule.groupFilter')}
          placeholder={t('task.group')}
          allowClear
          style={{ minWidth: 160 }}
          options={groupOptions}
          value={groupId}
          onChange={handleGroupChange}
        />
        <Select
          aria-label={t('schedule.branchFilter')}
          placeholder={t('task.branch')}
          allowClear
          style={{ minWidth: 160 }}
          options={branchOptions}
          value={branchId}
          disabled={!groupId}
          onChange={setBranchId}
        />
      </Space>

      <div style={{ height: 'calc(100vh - 220px)' }}>
        <MapView
          customers={filteredCustomers}
          center={center}
          markerColorByCustomerId={markerColorByCustomerId}
        />
      </div>
    </div>
  );
};

export default MapPage;
