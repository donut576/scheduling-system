import { useState, useCallback, useMemo } from 'react';
import type { FC } from 'react';
import {
  Segmented,
  DatePicker,
  Button,
  Space,
  Select,
  Modal,
  Tabs,
  Tag,
  Badge,
  message,
} from 'antd';
import type { TabsProps } from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  AppstoreOutlined,
  TeamOutlined,
  ShopOutlined,
  ScheduleOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import ScheduleCalendar from '@/components/business/ScheduleCalendar';
import type { ExternalDropArg } from '@/components/business/ScheduleCalendar';
import UnscheduledTasksPanel from '@/components/business/UnscheduledTasksPanel';
import TaskForm from '@/components/business/TaskForm';
import CopyScheduleModal from '@/components/business/CopyScheduleModal';
import { useScheduleStore } from '@/stores/useScheduleStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { useUserStore } from '@/stores/useUserStore';
import { useCustomerGroups } from '@/queries/useCustomerQueries';
import { useEmployeeList } from '@/queries/useEmployeeQueries';
import { useTaskDetail, useUpdateTask, useTaskList } from '@/queries/useTaskQueries';
import { AREA_OPTIONS, EMPLOYEE_SHIFT_OPTIONS } from '@/constants/groups';
import { isAddressInRegion, normalizeRegion } from '@/utils/regionMapping';
import { formatTaskContents } from '@/constants/taskStatus';
import type {
  ScheduleDimension,
  ScheduleEvent,
  ScheduleFilters,
  ScheduleViewMode,
} from '@/types/schedule';
import type { Task, TaskFormData } from '@/types/task';

const { RangePicker } = DatePicker;

/**
 * 排班總覽頁面 (SchedulePage)
 *
 * 具備三大維度 Tabs（總覽、集團、員工）、日/週/月檢視切換、
 * 日期導覽、模糊搜尋與下拉篩選（全部支援 allowClear 小叉叉清除）、
 * 雙行 Resource 標頭、手勢/滾輪時間縮放以及小卡點擊開啟任務詳情/編輯功能。
 */
const SchedulePage: FC = () => {
  const { t } = useTranslation();

  // Zustand Store 狀態
  const currentView = useScheduleStore((state) => state.currentView);
  const dimension = useScheduleStore((state) => state.dimension);
  const dateRange = useScheduleStore((state) => state.dateRange);
  const setView = useScheduleStore((state) => state.setView);
  const setDimension = useScheduleStore((state) => state.setDimension);
  const setDateRange = useScheduleStore((state) => state.setDateRange);
  const hasScheduleEdit = usePermissionStore((state) => state.hasPermission('schedule:edit'));
  const user = useUserStore((state) => state.user);
  const isStaff = user?.role === 'STAFF';
  const isLeader = user?.role === 'LEADER';

  // 組長模式：鎖定所屬責任轄區（例如：台北組）
  const leaderArea = useMemo(() => {
    if (!isLeader) return undefined;
    return normalizeRegion((user as unknown as { area?: string })?.area || user?.groupId);
  }, [isLeader, user]);

  // 篩選器狀態（全部支援清除）
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [employeeId, setEmployeeId] = useState<string | undefined>(undefined);
  const [selectedArea, setSelectedArea] = useState<string | undefined>(undefined);
  const [selectedShift, setSelectedShift] = useState<string | undefined>(undefined);

  // 員工模式下鎖定為 'employee' 維度；組長與員工模式下依所屬組別（例如：台北）呈現同組班表
  const effectiveDimension: ScheduleDimension = isStaff ? 'employee' : dimension;
  const effectiveArea = isStaff || isLeader ? selectedArea || leaderArea || '台北' : selectedArea;

  // 彈出詳情小框與編輯狀態
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [scrollTime, setScrollTime] = useState<string | undefined>(undefined);
  const [unscheduledCollapsed, setUnscheduledCollapsed] = useState(false);
  const [isDraggingEvent, setIsDraggingEvent] = useState(false);
  const [draggingUnscheduledTask, setDraggingUnscheduledTask] = useState<Task | null>(null);
  const [copyModalOpen, setCopyModalOpen] = useState(false);

  // 查詢客戶集團與員工清單
  const { data: customerGroups } = useCustomerGroups();
  const { data: employeesData } = useEmployeeList({ page: 1, pageSize: 500 });
  const employees = useMemo(() => employeesData?.list ?? [], [employeesData?.list]);

  // 查詢當前選取任務之詳細資料
  const { data: taskDetail } = useTaskDetail(selectedEvent?.taskId ?? '');
  const updateTaskMutation = useUpdateTask();

  // 查詢未排班任務數量（用於頂部工具列徽章提示，組長模式下僅算所屬轄區）
  const { data: unscheduledData } = useTaskList({
    status: 'UNSCHEDULED',
    pageSize: 100,
    area: isLeader ? leaderArea : undefined,
  });
  const unscheduledCount = unscheduledData?.total ?? unscheduledData?.list?.length ?? 0;

  // 判斷分店是否屬於該組長所屬責任轄區（支援全台22縣市自動歸屬，台北組管轄北基宜花）
  const isBranchInLeaderArea = useCallback(
    (b: { address?: string; name?: string; designatedRegion?: string }) => {
      if (!isLeader || !leaderArea) return true;
      return isAddressInRegion(b.address || b.name, leaderArea, b.designatedRegion);
    },
    [isLeader, leaderArea],
  );

  // 集團下拉選單選項（組長模式下僅列出所屬地區含有分店之集團）
  const groupOptions = useMemo(() => {
    if (!customerGroups) return [];
    let list = customerGroups;
    if (isLeader) {
      list = list.filter((g) => g.branches.some(isBranchInLeaderArea));
    }
    return list.map((g) => ({
      label: g.name,
      value: g.id,
    }));
  }, [customerGroups, isBranchInLeaderArea, isLeader]);

  // 分店下拉選單選項（預設全選，組長模式下僅列出所屬地區之分店）
  const branchOptions = useMemo(() => {
    if (!customerGroups) return [];
    if (groupId) {
      const group = customerGroups.find((g) => g.id === groupId);
      if (!group) return [];
      return group.branches.filter(isBranchInLeaderArea).map((b) => ({
        label: b.name,
        value: b.id,
      }));
    }
    return customerGroups.flatMap((g) =>
      g.branches.filter(isBranchInLeaderArea).map((b) => ({
        label: `${g.name} - ${b.name}`,
        value: b.id,
      })),
    );
  }, [customerGroups, groupId, isBranchInLeaderArea]);

  // 員工模糊搜尋下拉選項（支援姓名與員工編號搜尋，組長僅限所屬組別，依所選地區與班別即時篩選）
  const employeeOptions = useMemo(() => {
    let list = employees.filter(
      (e) =>
        e.position === 'STAFF' ||
        (!e.position && !e.name.includes('組長') && !e.name.includes('經理')),
    );
    const activeArea = isLeader ? leaderArea : selectedArea;
    if (activeArea) {
      list = list.filter((e) => e.area === activeArea || e.groupName?.includes(activeArea));
    }
    if (selectedShift) {
      list = list.filter((e) => e.shift === selectedShift || e.groupName?.includes(selectedShift));
    }
    return list.map((e) => ({
      label: `${e.name} (${e.employeeNo})`,
      value: e.id,
      searchValue: `${e.name} ${e.employeeNo}`,
    }));
  }, [employees, isLeader, leaderArea, selectedArea, selectedShift]);

  // 當集團切換時，自動檢查分店是否有效
  const handleGroupChange = useCallback(
    (value: string | undefined) => {
      setGroupId(value);
      if (!value) {
        setBranchId(undefined);
      } else {
        const group = customerGroups?.find((g) => g.id === value);
        if (group && branchId) {
          const exists = group.branches.some((b) => b.id === branchId);
          if (!exists) {
            setBranchId(undefined);
          }
        }
      }
    },
    [branchId, customerGroups],
  );

  // 維度/Tab 切換
  const handleDimensionChange = useCallback(
    (value: ScheduleDimension) => {
      setDimension(value);
      if (value === 'overview') {
        const now = dayjs();
        if (currentView === 'day') {
          const todayStr = now.format('YYYY-MM-DD');
          setDateRange({ start: todayStr, end: todayStr });
        } else if (currentView === 'week') {
          setDateRange({
            start: now.startOf('week').format('YYYY-MM-DD'),
            end: now.endOf('week').format('YYYY-MM-DD'),
          });
        } else if (currentView === 'month') {
          setDateRange({
            start: now.startOf('month').format('YYYY-MM-DD'),
            end: now.endOf('month').format('YYYY-MM-DD'),
          });
        }
      }
    },
    [currentView, setDateRange, setDimension],
  );

  // 檢視模式切換（日/週/月，預設當前時間：選日為今天、選週為當週、選月為當月）
  const handleViewModeChange = useCallback(
    (value: ScheduleViewMode) => {
      setView(value);
      const now = dayjs();
      if (value === 'day') {
        const todayStr = now.format('YYYY-MM-DD');
        setDateRange({
          start: todayStr,
          end: todayStr,
        });
      } else if (value === 'week') {
        setDateRange({
          start: now.startOf('week').format('YYYY-MM-DD'),
          end: now.endOf('week').format('YYYY-MM-DD'),
        });
      } else if (value === 'month') {
        setDateRange({
          start: now.startOf('month').format('YYYY-MM-DD'),
          end: now.endOf('month').format('YYYY-MM-DD'),
        });
      }
    },
    [setDateRange, setView],
  );

  // 前後導覽按鈕
  const handlePrevDate = useCallback(() => {
    const current = dayjs(dateRange.start);
    if (currentView === 'day') {
      const prev = current.subtract(1, 'day').format('YYYY-MM-DD');
      setDateRange({ start: prev, end: prev });
    } else if (currentView === 'week') {
      const prevStart = current.subtract(1, 'week').startOf('week').format('YYYY-MM-DD');
      const prevEnd = current.subtract(1, 'week').endOf('week').format('YYYY-MM-DD');
      setDateRange({ start: prevStart, end: prevEnd });
    } else if (currentView === 'month') {
      const prevStart = current.subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
      const prevEnd = current.subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
      setDateRange({ start: prevStart, end: prevEnd });
    }
  }, [currentView, dateRange.start, setDateRange]);

  const handleNextDate = useCallback(() => {
    const current = dayjs(dateRange.start);
    if (currentView === 'day') {
      const next = current.add(1, 'day').format('YYYY-MM-DD');
      setDateRange({ start: next, end: next });
    } else if (currentView === 'week') {
      const nextStart = current.add(1, 'week').startOf('week').format('YYYY-MM-DD');
      const nextEnd = current.add(1, 'week').endOf('week').format('YYYY-MM-DD');
      setDateRange({ start: nextStart, end: nextEnd });
    } else if (currentView === 'month') {
      const nextStart = current.add(1, 'month').startOf('month').format('YYYY-MM-DD');
      const nextEnd = current.add(1, 'month').endOf('month').format('YYYY-MM-DD');
      setDateRange({ start: nextStart, end: nextEnd });
    }
  }, [currentView, dateRange.start, setDateRange]);

  // 日期區間選擇變更
  const handlePeriodChange = useCallback(
    (dates: [Dayjs | null, Dayjs | null] | null) => {
      if (dates && dates[0]) {
        const start = dates[0].format('YYYY-MM-DD');
        const end = dates[1] ? dates[1].format('YYYY-MM-DD') : start;
        setDateRange({ start, end });
      }
    },
    [setDateRange],
  );

  // FullCalendar 日期變更回呼
  const handleDateChange = useCallback(
    (range: { start: string; end: string }) => {
      setDateRange(range);
    },
    [setDateRange],
  );

  // 拖曳放大至日檢視
  const handleZoomToDay = useCallback(
    (dateTime: string) => {
      const targetDate = dayjs(dateTime).format('YYYY-MM-DD');
      const targetTime = dayjs(dateTime).format('HH:mm');
      setView('day');
      setDateRange({ start: targetDate, end: targetDate });
      setScrollTime(targetTime);
    },
    [setDateRange, setView],
  );

  // 縮放手勢變更視圖模式
  const handleZoomViewChange = useCallback(
    (newView: ScheduleViewMode) => {
      handleViewModeChange(newView);
    },
    [handleViewModeChange],
  );

  // 組合傳入 ScheduleCalendar 之篩選條件（各維度/Tab 獨立篩選，總覽 Tab 永遠不受集團與員工 Tab 篩選影響）
  const filters: ScheduleFilters = useMemo(() => {
    if (isStaff) {
      return {
        area: effectiveArea || '台北',
      };
    }

    if (isLeader) {
      // 組長模式：鎖定僅看所屬組別（例如：台北組）的相關排班任務
      if (dimension === 'overview') {
        return {
          area: leaderArea || '台北',
        };
      }
      if (dimension === 'customer') {
        return {
          groupId: groupId || undefined,
          branchId: branchId || undefined,
          area: leaderArea || '台北',
        };
      }
      // employee dimension
      return {
        employeeId: employeeId || undefined,
        area: leaderArea || '台北',
        shift: selectedShift || undefined,
      };
    }

    if (dimension === 'overview') {
      return {};
    }

    if (dimension === 'customer') {
      return {
        groupId: groupId || undefined,
        branchId: branchId || undefined,
      };
    }

    // employee dimension
    const matchedEmployee = employees.find(
      (e) =>
        (selectedArea && e.area === selectedArea && selectedShift && e.shift === selectedShift) ||
        (selectedArea && e.area === selectedArea && !selectedShift),
    );
    const areaId = matchedEmployee?.groupId || selectedArea || undefined;

    return {
      employeeId: employeeId || undefined,
      groupId: areaId,
      areaId,
      area: selectedArea || undefined,
      shift: selectedShift || undefined,
    };
  }, [
    branchId,
    dimension,
    effectiveArea,
    employeeId,
    employees,
    groupId,
    isLeader,
    isStaff,
    leaderArea,
    selectedArea,
    selectedShift,
  ]);

  // 事件點擊處理
  const handleEventClick = useCallback((event: ScheduleEvent) => {
    setSelectedEvent(event);
    setDetailOpen(true);
  }, []);

  const handleDetailClose = useCallback(() => {
    setDetailOpen(false);
    setSelectedEvent(null);
  }, []);

  const handleCancelTask = useCallback(() => {
    if (!selectedEvent) return;
    Modal.confirm({
      title: '刪除任務',
      content: `確定要刪除「${selectedEvent?.title ?? ''}」這筆任務嗎？`,
      okText: t('common.delete'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: () => {
        setDetailOpen(false);
        setSelectedEvent(null);
      },
    });
  }, [selectedEvent, t]);

  const handleEditClick = useCallback(() => {
    setDetailOpen(false);
    setEditOpen(true);
  }, []);

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
  }, []);

  const handleEditSubmit = useCallback(
    async (formData: TaskFormData) => {
      if (!selectedEvent) return;
      await updateTaskMutation.mutateAsync({
        id: selectedEvent.taskId,
        data: formData,
      });
      setEditOpen(false);
    },
    [selectedEvent, updateTaskMutation],
  );

  // 待排任務外部拖曳放置至行事曆
  const handleExternalDrop = useCallback(
    async (dropInfo: ExternalDropArg) => {
      const taskId =
        dropInfo.draggedEl?.getAttribute('data-task-id') ||
        dropInfo.draggedEl?.closest?.('[data-task-id]')?.getAttribute('data-task-id') ||
        draggingUnscheduledTask?.id ||
        '';
      const taskRaw =
        dropInfo.draggedEl?.getAttribute('data-task-raw') ||
        dropInfo.draggedEl?.closest?.('[data-task-raw]')?.getAttribute('data-task-raw');

      let task: Task | null = null;
      if (taskRaw) {
        try {
          task = JSON.parse(taskRaw) as Task;
        } catch {
          task = null;
        }
      }
      if (!task && draggingUnscheduledTask) {
        task = draggingUnscheduledTask;
      }
      setDraggingUnscheduledTask(null);

      if (!taskId || !task) return;

      const targetDate = dayjs(dropInfo.date).format('YYYY-MM-DD');

      let targetStartTime = task.startTime || '';
      let targetEndTime = task.endTime || '';

      if (!dropInfo.allDay && currentView !== 'month') {
        targetStartTime = dayjs(dropInfo.date).format('HH:mm');
        const [origSh = 8, origSm = 0] = (task.startTime || '08:00').split(':').map(Number);
        const [origEh = 16, origEm = 0] = (task.endTime || '16:00').split(':').map(Number);
        let durationMinutes = origEh * 60 + origEm - (origSh * 60 + origSm);
        if (durationMinutes <= 0) durationMinutes = 120;
        targetEndTime = dayjs(dropInfo.date).add(durationMinutes, 'minute').format('HH:mm');
      }

      // 檢查指派員工：若在員工維度拖曳到某員工欄位，則累加該員工（不重複）
      const existingAssigneeIds = task.assignees?.map((a) => a.employeeId) || [];
      const newAssigneeIds = [...existingAssigneeIds];
      if (effectiveDimension === 'employee' && dropInfo.resourceId) {
        if (!newAssigneeIds.includes(dropInfo.resourceId)) {
          newAssigneeIds.push(dropInfo.resourceId);
        }
      }

      // 檢查分店：若在集團維度拖曳到特定分店欄位，則更新分店 ID
      let targetBranchId = task.branchId;
      if (effectiveDimension === 'customer' && dropInfo.resourceId) {
        targetBranchId = dropInfo.resourceId;
      }

      // 判斷人數與時段需求：必須有具體時段且達到 headcount，才正式轉為 SCHEDULED，否則保持 UNSCHEDULED
      const requiredHeadcount = task.headcount || 1;
      const isFullyStaffed = newAssigneeIds.length >= requiredHeadcount;
      const hasTime = Boolean(targetStartTime || targetEndTime);
      const newStatus = isFullyStaffed && hasTime ? 'SCHEDULED' : 'UNSCHEDULED';

      // 根據開始時間自動判定標準班次：
      // - 早班：06:00 – 18:00
      // - 午班：12:00 – 24:00 (00:00)
      // - 大夜班：18:00 – 06:00 (隔夜)
      let computedShift = task.shift || '早班';
      if (targetStartTime) {
        const targetStartHour = Number(targetStartTime.split(':')[0]) || 8;
        computedShift =
          targetStartHour >= 6 && targetStartHour < 12
            ? '早班'
            : targetStartHour >= 12 && targetStartHour < 18
              ? '午班'
              : '大夜班';
      }

      const isPastDate = Boolean(task.date && dayjs(task.date).isBefore(dayjs(), 'day'));
      const isReschedulingToFuture = isPastDate && targetDate !== task.date;
      const isMakeup = Boolean(task.isMakeup || isReschedulingToFuture);
      const originalDate = isReschedulingToFuture
        ? task.originalDate || task.date
        : task.originalDate;
      const makeupReason = isReschedulingToFuture ? '逾期改期補做' : task.makeupReason;

      try {
        await updateTaskMutation.mutateAsync({
          id: taskId,
          data: {
            groupId: task.groupId,
            branchId: targetBranchId,
            taskType: task.taskType,
            date: targetDate,
            startTime: targetStartTime,
            endTime: targetEndTime,
            headcount: requiredHeadcount,
            shift: computedShift,
            route: task.route || '',
            contents: task.contents || ['P'],
            otherContentNote: task.otherContentNote,
            assignees: newAssigneeIds,
            remarks: task.remarks,
            isMakeup,
            originalDate,
            makeupReason,
            isFromPending: true,
            status: newStatus,
          },
        });
        if (newStatus === 'SCHEDULED') {
          message.success(
            `已成功將「${task.groupName} - ${task.branchName}」全員指派完成 (${newAssigneeIds.length}/${requiredHeadcount}人)，正式排入班表！`,
          );
        } else if (currentView === 'month') {
          message.info(
            `已排定「${task.groupName} - ${task.branchName}」施作日期為 ${targetDate}，可切換至日視圖進一步排定時段與指派人員！`,
          );
        } else if (effectiveDimension === 'customer') {
          message.info(
            `已鎖定「${task.groupName} - ${task.branchName}」施作時段 (${targetStartTime} - ${targetEndTime})，請切換至員工視圖指派人員！`,
          );
        } else {
          message.info(
            `已指派員工 (${newAssigneeIds.length}/${requiredHeadcount}人)，尚缺 ${requiredHeadcount - newAssigneeIds.length} 人，任務保留於待排清單中，請繼續拖曳指派！`,
          );
        }
      } catch {
        message.error('排班失敗，請稍後再試');
      }
    },
    [currentView, draggingUnscheduledTask, effectiveDimension, updateTaskMutation],
  );

  const handleDragStartTask = useCallback((task: Task) => {
    setDraggingUnscheduledTask(task);
  }, []);

  const handleDragEndTask = useCallback(() => {
    setDraggingUnscheduledTask(null);
  }, []);

  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  // 開啟完整任務編輯表單 Modal
  const handleOpenEditModalForTask = useCallback((task: Task) => {
    setSelectedEvent({
      id: `event-${task.id}`,
      taskId: task.id,
      resourceId: task.branchId,
      title: `${task.groupName} - ${task.branchName}`,
      start: task.date && task.startTime ? `${task.date}T${task.startTime}:00` : '',
      end: task.date && task.endTime ? `${task.date}T${task.endTime}:00` : '',
      groupName: task.groupName,
      branchName: task.branchName,
      alertStatus: task.alertStatus || 'CLEAN',
      isRecurring: Boolean(task.recurrenceRule),
      isOvernight: task.isOvernight || false,
      extendedProps: {
        taskType: task.taskType,
        shift: task.shift,
        assignees: task.assignees || [],
        contents: task.contents || [],
        isFromPending: true,
        headcount: task.headcount,
        remarks: task.remarks,
        route: task.route,
        task,
      },
    });
    setViewingTask(null);
    setEditOpen(true);
  }, []);

  // 待排任務卡片點擊：開啟任務資訊小卡
  const handleViewUnscheduledTaskDetail = useCallback((task: Task) => {
    setViewingTask(task);
  }, []);

  // 執行將已排班任務或特定員工移回待排任務清單
  const executeRemoveFromSchedule = useCallback(
    async (
      taskId: string,
      taskTitle?: string,
      employeeIdToRemove?: string,
      scheduleEvt?: ScheduleEvent,
    ) => {
      try {
        setDetailOpen(false);
        setSelectedEvent(null);

        // 若是在員工維度拖曳單一員工區塊，且該任務已指派多位員工
        if (employeeIdToRemove && scheduleEvt?.extendedProps?.assignees) {
          const currentAssignees = scheduleEvt.extendedProps.assignees;
          const remainingAssigneeIds = currentAssignees
            .filter((a) => a.employeeId !== employeeIdToRemove)
            .map((a) => a.employeeId);

          const headcount =
            ((scheduleEvt.extendedProps as Record<string, unknown>)?.headcount as number) ||
            currentAssignees.length;
          const isFullyStaffed =
            remainingAssigneeIds.length >= headcount && remainingAssigneeIds.length > 0;

          await updateTaskMutation.mutateAsync({
            id: taskId,
            data: {
              assignees: remainingAssigneeIds,
              status: isFullyStaffed ? 'SCHEDULED' : 'UNSCHEDULED',
              isFromPending: true,
            },
          });

          if (remainingAssigneeIds.length > 0) {
            message.success(
              `已從「${taskTitle || '任務'}」移除該名員工，目前指派 (${remainingAssigneeIds.length}/${headcount}人)`,
            );
          } else {
            message.success(
              t('schedule.moveToUnscheduledSuccess', { name: taskTitle || '任務' }) ||
                `已將「${taskTitle || '任務'}」移回待排任務清單`,
            );
          }
          return;
        }

        // 全任務移回待排清單
        await updateTaskMutation.mutateAsync({
          id: taskId,
          data: {
            status: 'UNSCHEDULED',
            assignees: [],
            isFromPending: true,
          },
        });
        message.success(
          t('schedule.moveToUnscheduledSuccess', { name: taskTitle || '任務' }) ||
            `已將「${taskTitle || '任務'}」移回待排任務清單`,
        );
      } catch {
        message.error('操作失敗，請稍後再試');
      }
    },
    [t, updateTaskMutation],
  );

  // 移回待排任務（支援二次確認警示視窗防呆）
  const handleRemoveFromSchedule = useCallback(
    (
      taskId: string,
      taskTitle?: string,
      employeeIdToRemove?: string,
      scheduleEvt?: ScheduleEvent,
      requireConfirm = false,
    ) => {
      if (requireConfirm) {
        Modal.confirm({
          title: '確認將任務移回待排清單？',
          icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
          content: (
            <div style={{ marginTop: 8, fontSize: 13, color: '#595959', lineHeight: 1.6 }}>
              <div>
                您正將「<strong>{taskTitle || '此任務'}</strong>」移出日曆至右側待排清單。
              </div>
              <div style={{ marginTop: 6, color: '#ff4d4f', fontWeight: 500 }}>
                ⚠️ 此操作將清除目前排定之時段與人員，並將任務變更為「
                <strong>未排班 (UNSCHEDULED)</strong>」狀態。
              </div>
            </div>
          ),
          okText: '確認移回待排',
          cancelText: '取消',
          okButtonProps: { danger: true },
          onOk: () => {
            return executeRemoveFromSchedule(taskId, taskTitle, employeeIdToRemove, scheduleEvt);
          },
        });
        return;
      }

      return executeRemoveFromSchedule(taskId, taskTitle, employeeIdToRemove, scheduleEvt);
    },
    [executeRemoveFromSchedule],
  );

  const handleUnscheduleTask = useCallback(
    (taskId: string, taskTitle?: string) => {
      return handleRemoveFromSchedule(taskId, taskTitle, undefined, undefined, false);
    },
    [handleRemoveFromSchedule],
  );

  // 日曆事件拖曳開始：啟動待排面板放置高亮提示
  const handleEventDragStart = useCallback(() => {
    setIsDraggingEvent(true);
  }, []);

  // 日曆事件拖曳結束：判斷是否放置在待排面板區域
  const handleEventDragStop = useCallback(
    (info: {
      event: { id: string; title: string; extendedProps?: Record<string, unknown> };
      jsEvent: MouseEvent;
    }) => {
      setIsDraggingEvent(false);
      const { clientX, clientY } = info.jsEvent;
      const panelEl =
        document.querySelector('[data-testid="unscheduled-tasks-panel"]') ||
        document.querySelector('.unscheduled-tasks-panel') ||
        document.querySelector('[data-testid="unscheduled-tasks-panel-collapsed"]');

      if (panelEl) {
        const rect = panelEl.getBoundingClientRect();
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          const scheduleEvt =
            (info.event.extendedProps?.scheduleEvent as ScheduleEvent | undefined) ||
            (info.event.extendedProps as unknown as ScheduleEvent | undefined);
          const taskId =
            scheduleEvt?.taskId ||
            (info.event.extendedProps?.taskId as string) ||
            info.event.id.replace(/^event-/, '').replace(/-emp-[^-]+$/, '');
          const draggedEmpId =
            effectiveDimension === 'employee' ? scheduleEvt?.resourceId : undefined;

          // 拖曳至待排面板時觸發確認警示
          handleRemoveFromSchedule(taskId, info.event.title, draggedEmpId, scheduleEvt, true);
        }
      }
    },
    [effectiveDimension, handleRemoveFromSchedule],
  );

  // 任務詳情格式化
  const detailRows = useMemo(() => {
    if (!selectedEvent) return null;
    const isOvernight = selectedEvent.isOvernight;
    const startTimeStr = dayjs(selectedEvent.start).format('HH:mm');
    const endTimeStr = `${dayjs(selectedEvent.end).format('HH:mm')}${
      isOvernight ? ` (${t('task.overnight')})` : ''
    }`;

    const assigneesStr =
      selectedEvent.extendedProps.assignees?.map((a) => a.employeeName).join('、') ||
      t('schedule.unassigned');

    const contentsStr = selectedEvent.extendedProps.contents
      ? formatTaskContents(selectedEvent.extendedProps.contents, ', ', t)
      : '-';

    const cleanName = (name?: string) => {
      if (
        !name ||
        name.startsWith('group-') ||
        name.startsWith('branch-') ||
        name.startsWith('cust-')
      )
        return '';
      return name;
    };

    const matchedGroup = customerGroups?.find(
      (g) =>
        g.id === selectedEvent.groupName ||
        g.id === selectedEvent.resourceId ||
        g.id === taskDetail?.groupId ||
        g.name === selectedEvent.groupName ||
        g.branches.some(
          (b) =>
            b.id === selectedEvent.branchName ||
            b.id === selectedEvent.resourceId ||
            b.id === taskDetail?.branchId,
        ),
    );
    const matchedBranch =
      matchedGroup?.branches.find(
        (b) =>
          b.id === selectedEvent.branchName ||
          b.id === selectedEvent.resourceId ||
          b.id === taskDetail?.branchId ||
          b.name === selectedEvent.branchName,
      ) ||
      customerGroups
        ?.flatMap((g) => g.branches)
        .find(
          (b) =>
            b.id === selectedEvent.branchName ||
            b.id === selectedEvent.resourceId ||
            b.id === taskDetail?.branchId,
        );

    const titleParts = selectedEvent.title?.includes(' - ') ? selectedEvent.title.split(' - ') : [];

    const displayGroupName =
      cleanName(matchedGroup?.name) ||
      cleanName(taskDetail?.groupName) ||
      cleanName(selectedEvent.groupName) ||
      cleanName(titleParts[0]) ||
      '花蓮集團';

    const displayBranchName =
      cleanName(matchedBranch?.name) ||
      cleanName(taskDetail?.branchName) ||
      cleanName(selectedEvent.branchName) ||
      cleanName(titleParts[1]) ||
      '花蓮分店';

    return {
      groupName: displayGroupName,
      branchName: displayBranchName,
      taskType: selectedEvent.extendedProps.taskType,
      date: dayjs(selectedEvent.start).format('YYYY-MM-DD'),
      startTime: startTimeStr,
      endTime: endTimeStr,
      headcount: selectedEvent.extendedProps.assignees?.length ?? 1,
      shift: selectedEvent.extendedProps.shift,
      route: '-',
      assignees: assigneesStr,
      contents: contentsStr,
      isRecurring: selectedEvent.isRecurring,
    };
  }, [
    customerGroups,
    selectedEvent,
    t,
    taskDetail?.branchId,
    taskDetail?.branchName,
    taskDetail?.groupId,
    taskDetail?.groupName,
  ]);

  const renderEventDetail = useCallback(
    (event: ScheduleEvent) => {
      if (!detailRows || event.id !== selectedEvent?.id) return null;
      const eventColor = event.backgroundColor || '#7a69c0';
      const assigneeArea = event.extendedProps?.assignees?.[0]?.area;
      const shiftLabel =
        detailRows.shift === '早班'
          ? t('task.shifts.morning')
          : detailRows.shift === '午班'
            ? t('task.shifts.afternoon')
            : detailRows.shift === '晚班'
              ? t('task.shifts.evening')
              : detailRows.shift === '大夜班'
                ? t('task.shifts.night')
                : detailRows.shift;

      return (
        <div
          data-testid="schedule-event-detail-popover"
          className="schedule-event-detail-popover"
          style={{
            width: 290,
            padding: '12px 14px',
            backgroundColor: eventColor,
            color: '#ffffff',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              paddingBottom: 6,
              borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <span
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              {assigneeArea ? `${assigneeArea} · ${shiftLabel}` : shiftLabel}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {event.alertStatus === 'OVERRIDDEN' && (
                <Tag color="warning" style={{ margin: 0, fontWeight: 600 }}>
                  {t('alert.overriddenTooltip')}
                </Tag>
              )}
              {event.alertStatus === 'VIOLATED' && (
                <Tag color="error" style={{ margin: 0, fontWeight: 600 }}>
                  {t('alert.warning')}
                </Tag>
              )}
            </div>
          </div>
          {detailRows.isRecurring && (
            <div
              className="schedule-event-detail-alert"
              style={{
                marginBottom: 8,
                padding: '4px 8px',
                fontSize: 12,
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: 4,
                color: '#ffffff',
              }}
            >
              {t('schedule.recurringHint')}
            </div>
          )}
          <div
            className="schedule-event-detail-lines"
            style={{
              display: 'grid',
              gap: 5,
              fontSize: 13,
              lineHeight: 1.3,
              color: '#ffffff',
            }}
          >
            <div>{`${t('task.group')}: ${detailRows.groupName}`}</div>
            <div>{`${t('task.branch')}: ${detailRows.branchName}`}</div>
            <div>{`${t('task.taskType')}: ${detailRows.taskType}`}</div>
            <div>{`${t('task.date')}: ${detailRows.date}`}</div>
            <div>{`${t('task.startTime')}: ${detailRows.startTime}`}</div>
            <div>{`${t('task.endTime')}: ${detailRows.endTime}`}</div>
            <div>{`${t('task.headcount')}: ${detailRows.headcount}`}</div>
            <div>{`${t('task.shift')}: ${detailRows.shift}`}</div>
            <div>{`${t('task.assignees')}: ${detailRows.assignees}`}</div>
            <div>{`${t('schedule.detailContent')}: ${detailRows.contents}`}</div>
            {event.extendedProps?.isMakeup && (
              <div style={{ color: '#ffe58f', fontWeight: 600 }}>
                改期補做（原預定日期：{event.extendedProps.originalDate || '未指定'}）
                {event.extendedProps.makeupReason ? ` - ${event.extendedProps.makeupReason}` : ''}
              </div>
            )}
            {event.extendedProps?.reportTypes && event.extendedProps.reportTypes.length > 0 && (
              <div>
                <span>{t('task.reportTypes')}: </span>
                {event.extendedProps.reportTypes.map((type) => {
                  const label =
                    type === 'APP'
                      ? t('task.reportTypeApp')
                      : type === 'EDM'
                        ? t('task.reportTypeEdm')
                        : type === 'PAPER'
                          ? t('task.reportTypePaper')
                          : t('task.reportTypePhoto');
                  return (
                    <Tag
                      key={type}
                      style={{
                        marginRight: 4,
                        fontSize: 11,
                        background: 'rgba(255, 255, 255, 0.25)',
                        color: '#ffffff',
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                      }}
                    >
                      {label}
                    </Tag>
                  );
                })}
              </div>
            )}
            {event.extendedProps?.requirePhotos && (
              <div>
                <span>{t('task.requirePhotos')}: </span>
                <Tag
                  color="cyan"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  需照片存證
                </Tag>
              </div>
            )}
            {event.extendedProps?.photos && event.extendedProps.photos.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ marginBottom: 4, opacity: 0.9 }}>
                  {t('task.photos')} ({event.extendedProps.photos.length}):
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {event.extendedProps.photos.map((photoUrl, idx) => (
                    <img
                      key={idx}
                      src={photoUrl}
                      alt={`report-photo-${idx + 1}`}
                      style={{
                        width: 44,
                        height: 44,
                        objectFit: 'cover',
                        borderRadius: 4,
                        border: '1px solid rgba(255, 255, 255, 0.5)',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            {event.extendedProps?.reportNotes && (
              <div style={{ opacity: 0.9, fontSize: 12 }}>
                <span>{t('task.reportNotes')}: </span>
                <span>{event.extendedProps.reportNotes}</span>
              </div>
            )}
          </div>

          {event.alertStatus === 'OVERRIDDEN' && (
            <div
              style={{
                marginTop: 8,
                padding: '6px 8px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: 4,
                fontSize: 12,
                display: 'grid',
                gap: 2,
              }}
            >
              <div>
                <span style={{ opacity: 0.85 }}>{t('alert.violationReason') || '違規項目'}: </span>
                <strong>{event.extendedProps.violationReason || '排班規則特殊放行'}</strong>
              </div>
              {event.extendedProps.overrideReason && (
                <div>
                  <span style={{ opacity: 0.85 }}>{t('alert.overrideReason') || '核准備註'}: </span>
                  <span>{event.extendedProps.overrideReason}</span>
                </div>
              )}
            </div>
          )}
          {hasScheduleEdit && (
            <Space
              className="schedule-event-detail-actions"
              style={{ marginTop: 12, width: '100%', justifyContent: 'flex-end', flexWrap: 'wrap' }}
            >
              {effectiveDimension === 'employee' &&
                (event.extendedProps.assignees?.length || 0) > 1 && (
                  <Button
                    size="small"
                    onClick={() => {
                      setDetailOpen(false);
                      handleRemoveFromSchedule(event.taskId, event.title, event.resourceId, event);
                    }}
                    aria-label="移除此人員"
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                      fontWeight: 600,
                    }}
                  >
                    移除此人員
                  </Button>
                )}
              {(Boolean(event.extendedProps.isFromPending) ||
                event.id.includes('pending') ||
                event.taskId?.includes('pending')) && (
                <Button
                  size="small"
                  onClick={() => {
                    setDetailOpen(false);
                    handleUnscheduleTask(event.taskId, event.title);
                  }}
                  aria-label={t('schedule.moveToUnscheduled')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                    fontWeight: 600,
                  }}
                >
                  {t('schedule.moveToUnscheduled') || '移回待排'}
                </Button>
              )}
              <Button
                size="small"
                onClick={handleEditClick}
                aria-label={t('schedule.editTask')}
                style={{
                  background: '#ffffff',
                  color: '#262626',
                  border: 'none',
                  fontWeight: 600,
                }}
              >
                {t('common.edit')}
              </Button>
              <Button
                size="small"
                danger
                onClick={handleCancelTask}
                aria-label={t('schedule.cancelTask')}
                style={{
                  background: '#ffffff',
                  borderColor: '#ff4d4f',
                  fontWeight: 600,
                }}
              >
                {t('common.delete')}
              </Button>
            </Space>
          )}
        </div>
      );
    },
    [
      detailRows,
      effectiveDimension,
      handleCancelTask,
      handleEditClick,
      handleRemoveFromSchedule,
      handleUnscheduleTask,
      hasScheduleEdit,
      selectedEvent?.id,
      t,
    ],
  );

  // 三大 Tab 定義（「總覽」、「集團」、「員工」）
  const tabItems: TabsProps['items'] = useMemo(
    () => [
      {
        key: 'overview',
        label: (
          <span>
            <AppstoreOutlined style={{ marginRight: 6 }} />
            {t('schedule.overviewTab')}
          </span>
        ),
      },
      {
        key: 'customer',
        label: (
          <span>
            <ShopOutlined style={{ marginRight: 6 }} />
            {t('schedule.groupTab')}
          </span>
        ),
      },
      {
        key: 'employee',
        label: (
          <span>
            <TeamOutlined style={{ marginRight: 6 }} />
            {t('schedule.employeeTab')}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="schedule-page" data-testid="schedule-page">
      {/* 頂部維度切換 Tabs 與左側待排快捷按鈕 */}
      {!isStaff && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <Tabs
            aria-label={t('schedule.dimension')}
            activeKey={dimension}
            onChange={(key) => handleDimensionChange(key as ScheduleDimension)}
            items={tabItems}
            type="card"
            className="schedule-dimension-tabs"
            tabBarStyle={{ marginBottom: 0 }}
          />

          {/* 待排任務按鈕：僅具備排班編輯權限者（如組長、管理員）顯示 */}
          {hasScheduleEdit &&
            (effectiveDimension === 'employee' && currentView === 'day' ? (
              <Button
                type={!unscheduledCollapsed ? 'primary' : 'default'}
                icon={<ScheduleOutlined />}
                onClick={() => setUnscheduledCollapsed((prev) => !prev)}
                aria-label="toggle-unscheduled-tasks"
                style={{
                  borderRadius: 6,
                  height: 38,
                  fontWeight: 600,
                  borderColor: '#1677ff',
                  color: !unscheduledCollapsed ? '#ffffff' : '#1677ff',
                  backgroundColor: !unscheduledCollapsed ? '#1677ff' : '#e6f4ff',
                  boxShadow: !unscheduledCollapsed ? '0 2px 6px rgba(22, 119, 255, 0.25)' : 'none',
                }}
              >
                <span>待排任務</span>
                <Badge
                  count={unscheduledCount}
                  overflowCount={99}
                  style={{
                    marginLeft: 8,
                    backgroundColor: !unscheduledCollapsed ? '#ffffff' : '#1677ff',
                    color: !unscheduledCollapsed ? '#1677ff' : '#ffffff',
                    fontWeight: 700,
                  }}
                />
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<ScheduleOutlined />}
                onClick={() => {
                  setDimension('employee');
                  setView('day');
                  setUnscheduledCollapsed(false);
                }}
                aria-label="go-to-employee-dispatch"
                style={{
                  borderRadius: 6,
                  height: 38,
                  fontWeight: 600,
                  backgroundColor: '#1677ff',
                  borderColor: '#1677ff',
                  boxShadow: '0 2px 6px rgba(22, 119, 255, 0.3)',
                }}
              >
                <span>待排任務</span>
                <Badge
                  count={unscheduledCount}
                  overflowCount={99}
                  style={{
                    marginLeft: 6,
                    backgroundColor: '#ff4d4f',
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                />
                <span style={{ fontSize: 13, color: '#ffffff', marginLeft: 6, fontWeight: 500 }}>
                  ➔ 前往員工日排班
                </span>
              </Button>
            ))}
        </div>
      )}

      {/* 排班主工作區：左右雙欄結構（右側待排任務面板頂端與左側工具列平齊，拉高可視空間） */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          height: 'calc(100vh - 190px)',
          minHeight: 560,
        }}
      >
        {/* 左側：工具列與日曆主視圖 */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          {/* 工具列：支援橫向平滑滑動，當寬度小於內容時左右滑動不溢位 */}
          <div
            className="schedule-toolbar"
            style={{
              background: '#fff',
              padding: '12px 16px',
              borderRadius: 8,
              marginBottom: 12,
              border: '1px solid #f0f0f0',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* 第一行：班表視圖（日/週/月）、日期導覽按鈕 */}
            <div
              className="schedule-toolbar-row schedule-toolbar-row1"
              style={{
                display: 'flex',
                flexWrap: 'nowrap',
                gap: 16,
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: dimension !== 'overview' ? 12 : 0,
                minWidth: 'max-content',
              }}
            >
              <Space wrap={false} size="middle" align="center" style={{ flexShrink: 0 }}>
                <div className="schedule-toolbar-item">
                  <span
                    className="schedule-toolbar-label"
                    style={{ marginRight: 8, fontWeight: 500 }}
                  >
                    {t('schedule.viewTitle')}
                  </span>
                  <Segmented
                    aria-label={t('schedule.viewMode')}
                    value={currentView}
                    onChange={handleViewModeChange}
                    options={[
                      { label: t('schedule.dayView'), value: 'day' },
                      { label: t('schedule.weekView'), value: 'week' },
                      { label: t('schedule.monthView'), value: 'month' },
                    ]}
                  />
                </div>

                <div className="schedule-toolbar-item schedule-date-nav-item">
                  <Space.Compact>
                    <Button
                      icon={<LeftOutlined />}
                      onClick={handlePrevDate}
                      aria-label={t('schedule.prevDay')}
                    />
                    {currentView === 'day' ? (
                      <DatePicker
                        aria-label={t('schedule.period')}
                        value={dateRange.start ? dayjs(dateRange.start) : dayjs()}
                        onChange={(d) => {
                          if (d) {
                            const dateStr = d.format('YYYY-MM-DD');
                            setDateRange({ start: dateStr, end: dateStr });
                          }
                        }}
                        allowClear={false}
                        style={{ width: 140 }}
                      />
                    ) : (
                      <RangePicker
                        aria-label={t('schedule.period')}
                        value={[dayjs(dateRange.start), dayjs(dateRange.end)]}
                        onChange={handlePeriodChange}
                        allowClear={false}
                        style={{ width: 230 }}
                      />
                    )}
                    <Button
                      icon={<RightOutlined />}
                      onClick={handleNextDate}
                      aria-label={t('schedule.nextDay')}
                    />
                  </Space.Compact>
                </div>
              </Space>

              {/* 複製班表按鈕：僅具備排班編輯權限者（組長/管理員）可操作 */}
              {hasScheduleEdit && (
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => setCopyModalOpen(true)}
                  aria-label="copy-schedule-btn"
                  style={{
                    borderRadius: 6,
                    fontWeight: 600,
                    flexShrink: 0,
                    marginLeft: 16,
                    borderColor: '#13c2c2',
                    color: '#08979c',
                    backgroundColor: '#e6fffb',
                  }}
                >
                  {t('schedule.copySchedule') || '一鍵複製班表'}
                </Button>
              )}
            </div>

            {/* 第二行：依 Tab 維度切換之篩選列（全部具備 allowClear 小叉叉；總覽 Tab 不需 search bar） */}
            {dimension !== 'overview' && !isStaff && (
              <div
                className="schedule-toolbar-row schedule-toolbar-row2"
                style={{
                  display: 'flex',
                  flexWrap: 'nowrap',
                  gap: 16,
                  alignItems: 'center',
                  minWidth: 'max-content',
                }}
              >
                {dimension === 'customer' && (
                  <Space
                    wrap={false}
                    size="middle"
                    align="center"
                    className="schedule-filter-group"
                    style={{ flexShrink: 0 }}
                  >
                    <div className="schedule-filter-item">
                      <span className="schedule-filter-label" style={{ marginRight: 6 }}>
                        {t('schedule.groupNameLabel')}
                      </span>
                      <Select
                        aria-label={t('schedule.groupFilter')}
                        placeholder={t('schedule.selectGroupPlaceholder')}
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        style={{ width: 220 }}
                        options={groupOptions}
                        value={groupId}
                        onChange={handleGroupChange}
                      />
                    </div>
                    <div className="schedule-filter-item">
                      <span className="schedule-filter-label" style={{ marginRight: 6 }}>
                        {t('schedule.branchLabel')}
                      </span>
                      <Select
                        aria-label={t('schedule.branchFilter')}
                        placeholder={t('schedule.selectBranchPlaceholder')}
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        style={{ width: 220 }}
                        options={branchOptions}
                        value={branchId}
                        onChange={setBranchId}
                      />
                    </div>
                  </Space>
                )}

                {dimension === 'employee' && (
                  <Space
                    wrap={false}
                    size="middle"
                    align="center"
                    className="schedule-filter-group"
                    style={{ flexShrink: 0 }}
                  >
                    <div className="schedule-filter-item">
                      <span className="schedule-filter-label" style={{ marginRight: 6 }}>
                        {t('schedule.employeeLabel')}
                      </span>
                      <Select
                        aria-label={t('schedule.employeeFilter')}
                        placeholder={t('schedule.selectEmployeePlaceholder')}
                        allowClear
                        showSearch
                        filterOption={(input, option) => {
                          const label = String(option?.label ?? '').toLowerCase();
                          const search = String(
                            (option as { searchValue?: string })?.searchValue ?? '',
                          ).toLowerCase();
                          const query = input.toLowerCase();
                          return label.includes(query) || search.includes(query);
                        }}
                        style={{ width: 240 }}
                        options={employeeOptions}
                        value={employeeId}
                        onChange={setEmployeeId}
                      />
                    </div>
                    {!isLeader && (
                      <div className="schedule-filter-item">
                        <span className="schedule-filter-label" style={{ marginRight: 6 }}>
                          {t('schedule.areaLabel')}
                        </span>
                        <Select
                          aria-label="地區篩選"
                          placeholder={t('schedule.selectAreaPlaceholder')}
                          allowClear
                          style={{ width: 140 }}
                          options={AREA_OPTIONS}
                          value={selectedArea}
                          onChange={setSelectedArea}
                        />
                      </div>
                    )}
                    <div className="schedule-filter-item">
                      <span className="schedule-filter-label" style={{ marginRight: 6 }}>
                        {t('schedule.shiftLabel')}
                      </span>
                      <Select
                        aria-label={t('schedule.shiftFilter')}
                        placeholder={t('schedule.selectShiftPlaceholder')}
                        allowClear
                        style={{ width: 140 }}
                        options={EMPLOYEE_SHIFT_OPTIONS}
                        value={selectedShift}
                        onChange={setSelectedShift}
                      />
                    </div>
                  </Space>
                )}
              </div>
            )}
          </div>

          {/* 日曆主元件 */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <ScheduleCalendar
              viewMode={currentView}
              dimension={effectiveDimension}
              dateRange={dateRange}
              filters={filters}
              onEventClick={handleEventClick}
              onDateChange={handleDateChange}
              scrollTime={scrollTime}
              openEventId={detailOpen ? selectedEvent?.id : undefined}
              renderEventDetail={renderEventDetail}
              onEventDetailClose={handleDetailClose}
              onZoomToDay={handleZoomToDay}
              onZoomViewChange={handleZoomViewChange}
              droppable={
                hasScheduleEdit && effectiveDimension === 'employee' && currentView === 'day'
              }
              onExternalDrop={handleExternalDrop}
              editable={hasScheduleEdit}
              onEventDragStart={handleEventDragStart}
              onEventDragStop={handleEventDragStop}
              draggingTask={draggingUnscheduledTask}
            />
          </div>
        </div>

        {/* 右側待排任務面板（具排班編輯權限且處於員工日視圖時顯示，高度與左側同高） */}
        {hasScheduleEdit && effectiveDimension === 'employee' && currentView === 'day' && (
          <UnscheduledTasksPanel
            collapsed={unscheduledCollapsed}
            onToggleCollapse={() => setUnscheduledCollapsed((prev) => !prev)}
            onEditTask={handleViewUnscheduledTaskDetail}
            onDragStartTask={handleDragStartTask}
            onDragEndTask={handleDragEndTask}
            isDropActive={isDraggingEvent}
            dimension={effectiveDimension}
            viewMode={currentView}
          />
        )}
      </div>

      {/* 待排任務詳情小卡 Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>📋 任務詳情小卡</span>
            {viewingTask && (
              <Tag
                color={
                  viewingTask.taskType === 'CONTRACT'
                    ? 'blue'
                    : viewingTask.taskType === 'ONETIME'
                      ? 'green'
                      : 'purple'
                }
                style={{ margin: 0, fontWeight: 600 }}
              >
                {viewingTask.taskType === 'CONTRACT'
                  ? '合約'
                  : viewingTask.taskType === 'ONETIME'
                    ? '單次'
                    : 'ESR'}
              </Tag>
            )}
          </div>
        }
        open={Boolean(viewingTask)}
        onCancel={() => setViewingTask(null)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setViewingTask(null)}>關閉</Button>
            {hasScheduleEdit && viewingTask && (
              <Button
                type="primary"
                onClick={() => {
                  const taskToEdit = viewingTask;
                  handleOpenEditModalForTask(taskToEdit);
                }}
              >
                {t('common.edit') || '編輯任務'}
              </Button>
            )}
          </div>
        }
        width={500}
        destroyOnClose
      >
        {viewingTask && (
          <div
            style={{ display: 'grid', gap: 12, fontSize: 14, lineHeight: 1.6, padding: '12px 0' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: 6,
              }}
            >
              <span style={{ color: '#8c8c8c' }}>客戶集團：</span>
              <span style={{ fontWeight: 600, color: '#1f1f1f' }}>{viewingTask.groupName}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: 6,
              }}
            >
              <span style={{ color: '#8c8c8c' }}>分店名稱：</span>
              <span style={{ fontWeight: 600, color: '#1f1f1f' }}>{viewingTask.branchName}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: 6,
              }}
            >
              <span style={{ color: '#8c8c8c' }}>施作日期：</span>
              <span>
                {viewingTask.date ? (
                  <span style={{ fontWeight: 500, color: '#1f1f1f' }}>{viewingTask.date}</span>
                ) : (
                  <Tag color="orange" style={{ margin: 0, fontWeight: 600 }}>
                    📅 待排定日期
                  </Tag>
                )}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: 6,
              }}
            >
              <span style={{ color: '#8c8c8c' }}>施作時段：</span>
              <span>
                {viewingTask.startTime && viewingTask.endTime ? (
                  <span style={{ color: '#1f1f1f' }}>
                    {viewingTask.shift || ''} ({viewingTask.startTime} ~ {viewingTask.endTime})
                  </span>
                ) : (
                  <Tag color="purple" style={{ margin: 0, fontWeight: 600 }}>
                    ⏰ 待定時段
                  </Tag>
                )}
              </span>
            </div>
            {viewingTask.route && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #f0f0f0',
                  paddingBottom: 6,
                }}
              >
                <span style={{ color: '#8c8c8c' }}>指定路線：</span>
                <span style={{ color: '#1f1f1f' }}>{viewingTask.route}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: 6,
              }}
            >
              <span style={{ color: '#8c8c8c' }}>需求人數：</span>
              <span>
                {viewingTask.assignees &&
                viewingTask.assignees.length < (viewingTask.headcount || 1) ? (
                  <Tag color="red" style={{ margin: 0, fontWeight: 600 }}>
                    ⚠️ 缺 {(viewingTask.headcount || 1) - (viewingTask.assignees?.length || 0)} 人 (
                    {viewingTask.assignees?.length || 0}/{viewingTask.headcount || 1})
                  </Tag>
                ) : (
                  <span>{viewingTask.headcount || 1} 人</span>
                )}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: 6,
              }}
            >
              <span style={{ color: '#8c8c8c' }}>指派人員：</span>
              <span style={{ color: '#1f1f1f' }}>
                {viewingTask.assignees && viewingTask.assignees.length > 0
                  ? viewingTask.assignees.map((a) => a.employeeName).join('、')
                  : '尚未指派'}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: 6,
              }}
            >
              <span style={{ color: '#8c8c8c' }}>施作項目：</span>
              <span style={{ fontWeight: 500, color: '#1f1f1f' }}>
                {viewingTask.contents ? formatTaskContents(viewingTask.contents, ', ', t) : '-'}
              </span>
            </div>
            {viewingTask.remarks && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8c8c8c' }}>備註說明：</span>
                <span style={{ color: '#595959', maxWidth: '70%', textAlign: 'right' }}>
                  {viewingTask.remarks}
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 編輯任務 Modal */}
      <Modal
        title={t('task.edit')}
        open={editOpen}
        onCancel={handleEditClose}
        footer={null}
        width={800}
        destroyOnClose
      >
        {(taskDetail || (selectedEvent?.extendedProps as unknown as { task?: Task })?.task) && (
          <TaskForm
            mode="edit"
            initialData={
              taskDetail || (selectedEvent?.extendedProps as unknown as { task: Task }).task
            }
            onSubmit={handleEditSubmit}
            onCancel={handleEditClose}
          />
        )}
      </Modal>

      {/* 快速複製排班 Modal */}
      <CopyScheduleModal
        open={copyModalOpen}
        onCancel={() => setCopyModalOpen(false)}
        defaultSourceRange={dateRange}
        onSuccess={(result) => {
          if (result.copiedCount > 0 && result.tasks[0]?.date) {
            const firstDate = result.tasks[0].date;
            const lastDate = result.tasks[result.tasks.length - 1]?.date || firstDate;
            if (currentView === 'day') {
              setDateRange({ start: firstDate, end: firstDate });
            } else {
              setDateRange({ start: firstDate, end: lastDate });
            }
            setUnscheduledCollapsed(false);
          }
        }}
      />
    </div>
  );
};

export default SchedulePage;
