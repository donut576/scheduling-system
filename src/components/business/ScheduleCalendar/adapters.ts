import type { EventInput } from '@fullcalendar/core';
import type { ResourceInput } from '@fullcalendar/resource';
import dayjs from 'dayjs';
import type { ScheduleDimension, ScheduleEvent, ScheduleResource } from '@/types/schedule';
import { getGroupColor, AREA_COLOR_MAP } from '@/utils/groupColor';

const ECOLAB_BLUE = '#0067a0';

export interface FlattenedResource {
  id: string;
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
  currentUserId?: string,
  currentUserName?: string,
): ResourceInput[] => {
  let list = flattenResourcesWithParentTitle(resources, dimension);

  if (dimension === 'employee') {
    list = [...list].sort((a, b) => {
      const aSelf =
        (currentUserId && a.id === currentUserId) ||
        (currentUserName && a.mainTitle === currentUserName) ||
        a.id === 'emp-staff' ||
        a.mainTitle.includes('Demo 員工');
      const bSelf =
        (currentUserId && b.id === currentUserId) ||
        (currentUserName && b.mainTitle === currentUserName) ||
        b.id === 'emp-staff' ||
        b.mainTitle.includes('Demo 員工');

      if (aSelf && !bSelf) return -1;
      if (!aSelf && bSelf) return 1;
      return 0;
    });
  }

  return list.map((resource) => {
    const isSelf =
      (currentUserId && resource.id === currentUserId) ||
      (currentUserName && resource.mainTitle === currentUserName) ||
      resource.id === 'emp-staff' ||
      resource.mainTitle.includes('Demo 員工');

    return {
      id: resource.id,
      title: resource.title,
      eventColor: resource.groupColor,
      extendedProps: {
        mainTitle: resource.mainTitle,
        subTitle: resource.subTitle,
        isSelf,
      },
    };
  });
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

    return {
      id: event.id,
      resourceId: event.resourceId,
      title: event.title,
      start: event.start,
      end,
      backgroundColor: eventColor,
      borderColor: eventColor,
      extendedProps: {
        scheduleEvent: {
          ...event,
          backgroundColor: eventColor,
          borderColor: eventColor,
        },
      },
    };
  });
};
