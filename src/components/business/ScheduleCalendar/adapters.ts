import type { EventInput } from '@fullcalendar/core';
import type { ResourceInput } from '@fullcalendar/resource';
import dayjs from 'dayjs';
import type { ScheduleDimension, ScheduleEvent, ScheduleResource } from '@/types/schedule';
import { getGroupColor, AREA_COLOR_MAP } from '@/utils/groupColor';

const ECOLAB_BLUE = '#0067a0';

// 傳給 FullCalendar 的資源 id 加上前綴。FullCalendar 內部用物件存資源，id 若是純數字，
// JavaScript 會把它們依數字大小重新排序，我們排好的順序（例如「自己排第一個」）就會被打亂。
const RESOURCE_ID_PREFIX = 'r-';
export const toCalendarResourceId = (id: string): string => `${RESOURCE_ID_PREFIX}${id}`;
export const fromCalendarResourceId = (id?: string): string | undefined =>
  id?.startsWith(RESOURCE_ID_PREFIX) ? id.slice(RESOURCE_ID_PREFIX.length) : id;

export interface FlattenedResource {
  id: string;
  employeeNo?: string;
  title: string;
  mainTitle: string;
  subTitle?: string;
  groupColor?: string;
}

export const flattenResourcesWithParentTitle = (
  resources: ScheduleResource[],
  dimension: ScheduleDimension,
): FlattenedResource[] => {
  const result: FlattenedResource[] = [];

  const visit = (nodes: ScheduleResource[], parentTitle?: string) => {
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        visit(node.children, node.title);
        return;
      }

      let mainTitle = node.title;
      let subTitle: string | undefined = undefined;

      if (dimension === 'customer') {
        if (parentTitle) {
          mainTitle = parentTitle;
          subTitle = node.title;
        } else if (node.title.includes(' - ') || node.title.includes(' ')) {
          const parts = node.title.split(/[\s-]+/);
          if (parts.length >= 2 && parts[0]) {
            mainTitle = parts[0];
            subTitle = parts.slice(1).join(' ');
          }
        }
      } else if (dimension === 'employee') {
        const parenMatch = node.title.match(/^(.+?)\s*[(（](.+?)[)）]$/);
        if (parenMatch && parenMatch[1] && parenMatch[2]) {
          mainTitle = parenMatch[1].trim();
          subTitle = parenMatch[2].trim();
        } else if (parentTitle) {
          mainTitle = node.title;
          subTitle = parentTitle;
        } else {
          const parts = node.title.split(/[\s_]+/);
          if (parts.length >= 2 && parts[0]) {
            mainTitle = parts[0];
            subTitle = parts.slice(1).join(' ');
          }
        }
      }

      result.push({
        id: node.id,
        employeeNo: node.employeeNo,
        title: parentTitle ? `${parentTitle} ${node.title}` : node.title,
        mainTitle,
        subTitle,
        groupColor: node.groupColor,
      });
    });
  };

  visit(resources);
  return result;
};

export const toResourceInputs = (
  resources: ScheduleResource[],
  dimension: ScheduleDimension,
  currentEmployeeNo?: string,
): ResourceInput[] => {
  let list = flattenResourcesWithParentTitle(resources, dimension);

  // 只有員工維度才有「自己」；用工號比對（客戶維度的 id 可能剛好和登入者 id 相同，不能拿來比）
  const isSelfOf = (r: FlattenedResource) =>
    dimension === 'employee' && Boolean(currentEmployeeNo && r.employeeNo === currentEmployeeNo);

  if (dimension === 'employee') {
    // 自己排第一個；其他人維持原順序（Array.sort 為穩定排序）
    list = [...list].sort((a, b) => Number(isSelfOf(b)) - Number(isSelfOf(a)));
  }

  return list.map((resource) => ({
    id: toCalendarResourceId(resource.id),
    title: resource.title,
    eventColor: resource.groupColor,
    extendedProps: {
      mainTitle: resource.mainTitle,
      subTitle: resource.subTitle,
      groupColor: resource.groupColor,
      isSelf: isSelfOf(resource),
    },
  }));
};

export const toEventInputs = (
  events: ScheduleEvent[],
  viewMode?: 'day' | 'week' | 'month',
): EventInput[] => {
  return events.map((event) => {
    let end = event.end;

    if (event.isOvernight) {
      const startDay = dayjs(event.start);
      const endDay = dayjs(event.end);
      if (viewMode === 'week' || viewMode === 'month') {
        // 在以天為格位的週視圖與月視圖中，大夜跨日班次（如 8/17 22:00-05:00+1）屬於 8/17 當日排班，
        // 限制在 8/17 當日內結束，避免在天級網格中不當橫跨整整兩天佔據 8/18。
        if (endDay.diff(startDay, 'hour') <= 24) {
          end = startDay.endOf('day').toISOString();
        }
      } else {
        // 日視圖（24 小時連續時間軸）：確保 end 正確標註為隔日凌晨
        if (!endDay.isAfter(startDay, 'day')) {
          end = dayjs(event.end).add(1, 'day').toISOString();
        }
      }
    }

    const assignee = event.extendedProps?.assignees?.[0];
    const area = assignee?.area || (assignee?.groupId ? assignee.groupId.split('-')[0] : undefined);
    const eventColor =
      (area && AREA_COLOR_MAP[area]) ||
      assignee?.groupColor ||
      (area ? getGroupColor(area) : undefined) ||
      (assignee?.groupId ? getGroupColor(assignee.groupId) : undefined) ||
      (event.groupName ? getGroupColor(event.groupName) : ECOLAB_BLUE);

    let title = event.title;
    let groupName = event.groupName;
    let branchName = event.branchName;

    if (groupName && (groupName.startsWith('group-') || groupName.startsWith('cust-'))) {
      groupName = '花蓮集團';
    }
    if (branchName && (branchName.startsWith('branch-') || branchName.startsWith('cust-'))) {
      branchName = '花蓮分店';
    }
    if (
      title &&
      (title.includes('group-') || title.includes('branch-') || title.includes('cust-'))
    ) {
      title = `${groupName || '花蓮集團'} - ${branchName || '花蓮分店'}`;
    }

    return {
      id: event.id,
      resourceId: toCalendarResourceId(event.resourceId),
      title,
      start: event.start,
      end,
      backgroundColor: eventColor,
      borderColor: eventColor,
      classNames: event.extendedProps?.timeMode === 'FLEXIBLE' ? ['flexible-event'] : undefined,
      extendedProps: {
        scheduleEvent: {
          ...event,
          groupName: groupName || event.groupName,
          branchName: branchName || event.branchName,
          title,
          backgroundColor: eventColor,
          borderColor: eventColor,
        },
      },
    };
  });
};
