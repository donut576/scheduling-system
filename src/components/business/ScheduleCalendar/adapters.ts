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
): ResourceInput[] => {
  return flattenResourcesWithParentTitle(resources, dimension).map((resource) => ({
    id: resource.id,
    title: resource.title,
    eventColor: resource.groupColor,
    extendedProps: {
      mainTitle: resource.mainTitle,
      subTitle: resource.subTitle,
    },
  }));
};

export const toEventInputs = (events: ScheduleEvent[]): EventInput[] => {
  return events.map((event) => {
    let end = event.end;

    if (event.isOvernight) {
      const startDay = dayjs(event.start);
      const endDay = dayjs(event.end);
      if (!endDay.isAfter(startDay, 'day')) {
        end = dayjs(event.end).add(1, 'day').toISOString();
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
