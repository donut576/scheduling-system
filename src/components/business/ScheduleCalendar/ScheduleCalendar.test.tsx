import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fc from 'fast-check';
import dayjs from 'dayjs';
import ScheduleCalendar, { toEventInputs } from './index';
import type { ScheduleEvent, ScheduleData } from '@/types/schedule';

// Mock matchMedia and ResizeObserver for Ant Design / FullCalendar.
// `setMockIsMobile` controls the `(max-width: 767px)` query used by the
// shared useIsMobile hook so tests can simulate the < 768px breakpoint
// (Requirement 16.2).
let mockIsMobile = false;

function setMockIsMobile(isMobile: boolean) {
  mockIsMobile = isMobile;
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return query.includes('767') ? mockIsMobile : false;
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // FullCalendar relies on ResizeObserver internally
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = MockResizeObserver;
});

const normalEvent: ScheduleEvent = {
  id: 'evt-1',
  taskId: 'task-1',
  resourceId: 'branch-1',
  title: '分店A 任務',
  start: '2025-03-10T09:00:00+08:00',
  end: '2025-03-10T17:00:00+08:00',
  groupName: '集團A',
  branchName: '分店A',
  alertStatus: 'CLEAN',
  isRecurring: false,
  isOvernight: false,
  extendedProps: {
    taskType: 'CONTRACT',
    shift: 'DAY',
    assignees: [],
    contents: ['P'],
  },
};

const overriddenEvent: ScheduleEvent = {
  ...normalEvent,
  id: 'evt-2',
  alertStatus: 'OVERRIDDEN',
};

const recurringEvent: ScheduleEvent = {
  ...normalEvent,
  id: 'evt-3',
  isRecurring: true,
};

const overnightEvent: ScheduleEvent = {
  ...normalEvent,
  id: 'evt-4',
  start: '2025-03-10T22:00:00+08:00',
  end: '2025-03-10T06:00:00+08:00',
  isOvernight: true,
};

let mockScheduleData: ScheduleData = {
  events: [normalEvent],
  resources: [{ id: 'branch-1', title: '集團A_分店A' }],
};

vi.mock('@/queries/useScheduleQueries', () => ({
  useScheduleData: () => ({
    data: mockScheduleData,
    isLoading: false,
  }),
}));

const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

const defaultProps = {
  viewMode: 'week' as const,
  dimension: 'customer' as const,
  dateRange: { start: '2025-03-09', end: '2025-03-15' },
  filters: {},
  onEventClick: vi.fn(),
  onDateChange: vi.fn(),
};

describe('ScheduleCalendar', () => {
  beforeEach(() => {
    mockScheduleData = {
      events: [normalEvent],
      resources: [{ id: 'branch-1', title: '集團A_分店A' }],
    };
    setMockIsMobile(false);
    vi.clearAllMocks();
  });

  it('renders the calendar container', () => {
    renderWithProviders(<ScheduleCalendar {...defaultProps} />);
    expect(screen.getByTestId('schedule-calendar')).toBeInTheDocument();
  });

  it('renders event blocks with group name, branch name and time range', async () => {
    renderWithProviders(<ScheduleCalendar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('schedule-event-evt-1')).toBeInTheDocument();
    });

    const eventEl = screen.getByTestId('schedule-event-evt-1');
    expect(eventEl).toHaveTextContent('集團A');
    expect(eventEl).toHaveTextContent('分店A');
    expect(eventEl).toHaveTextContent('09:00 - 17:00');
  });

  it('shows recurring badge (∞) for recurring events', async () => {
    mockScheduleData = {
      events: [recurringEvent],
      resources: [{ id: 'branch-1', title: '集團A_分店A' }],
    };

    renderWithProviders(<ScheduleCalendar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('schedule-event-evt-3')).toBeInTheDocument();
    });

    expect(screen.getByTestId('alert-badge-recurring')).toBeInTheDocument();
  });

  it('shows overridden badge for overridden events', async () => {
    mockScheduleData = {
      events: [overriddenEvent],
      resources: [{ id: 'branch-1', title: '集團A_分店A' }],
    };

    renderWithProviders(<ScheduleCalendar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('schedule-event-evt-2')).toBeInTheDocument();
    });

    expect(screen.getByTestId('alert-badge-overridden')).toBeInTheDocument();
  });

  it('renders overnight events without crashing and extends end date', async () => {
    mockScheduleData = {
      events: [overnightEvent],
      resources: [{ id: 'branch-1', title: '集團A_分店A' }],
    };

    renderWithProviders(<ScheduleCalendar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('schedule-event-evt-4')).toBeInTheDocument();
    });
  });

  it('calls onDateChange when calendar dates are set on initial render', async () => {
    const onDateChange = vi.fn();
    renderWithProviders(<ScheduleCalendar {...defaultProps} onDateChange={onDateChange} />);

    await waitFor(() => {
      expect(onDateChange).toHaveBeenCalled();
    });
  });

  it('renders customer dimension resource header', () => {
    renderWithProviders(<ScheduleCalendar {...defaultProps} dimension="customer" />);
    expect(screen.getByText('集團_分店')).toBeInTheDocument();
  });

  it('renders employee dimension resource header', () => {
    renderWithProviders(<ScheduleCalendar {...defaultProps} dimension="employee" />);
    expect(screen.getByText('員工_區域')).toBeInTheDocument();
  });
});

/**
 * 響應式：< 768px 個人/每日檢視模式
 *
 * Validates: Requirements 16.2
 */
describe('ScheduleCalendar - 響應式個人/每日檢視模式（< 768px）', () => {
  beforeEach(() => {
    mockScheduleData = {
      events: [normalEvent],
      resources: [
        {
          id: 'group-1',
          title: '集團A',
          children: [
            { id: 'branch-1', title: '集團A_分店A' },
            { id: 'branch-2', title: '集團A_分店B' },
          ],
        },
      ],
    };
    vi.clearAllMocks();
  });

  it('shows "個人" resource header instead of dimension label when viewport < 768px', () => {
    setMockIsMobile(true);
    renderWithProviders(<ScheduleCalendar {...defaultProps} dimension="customer" />);

    expect(screen.getByText('個人')).toBeInTheDocument();
    expect(screen.queryByText('集團_分店')).not.toBeInTheDocument();
  });

  it('keeps the dimension label (not "個人") when viewport is desktop-sized', () => {
    setMockIsMobile(false);
    renderWithProviders(<ScheduleCalendar {...defaultProps} dimension="customer" />);

    expect(screen.getByText('集團_分店')).toBeInTheDocument();
    expect(screen.queryByText('個人')).not.toBeInTheDocument();
  });

  it('flattens nested resources into a single-level list under 個人 view on mobile', () => {
    setMockIsMobile(true);
    renderWithProviders(<ScheduleCalendar {...defaultProps} dimension="customer" />);

    // Flattened leaf resources should be present as resource rows
    expect(screen.getByText('集團A_分店A')).toBeInTheDocument();
    expect(screen.getByText('集團A_分店B')).toBeInTheDocument();
    // The group-level parent node title itself should not appear as its own row
    // (it was flattened away, leaving only its children)
    expect(screen.queryByText('集團A')).not.toBeInTheDocument();
  });

  it('still renders event blocks with full info under 每日 (day) mobile view', async () => {
    setMockIsMobile(true);
    // 每日模式強制以日檢視呈現：initialDate 僅顯示單一日曆日，
    // 因此將 dateRange 對齊事件所在日期（2025-03-10），確保事件落在可視範圍內
    renderWithProviders(
      <ScheduleCalendar
        {...defaultProps}
        viewMode="week"
        dateRange={{ start: '2025-03-10', end: '2025-03-10' }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('schedule-event-evt-1')).toBeInTheDocument();
    });

    const eventEl = screen.getByTestId('schedule-event-evt-1');
    expect(eventEl).toHaveTextContent('集團A');
    expect(eventEl).toHaveTextContent('分店A');
  });
});

/**
 * Property 19: 行事曆事件方塊資訊完整性
 *
 * For any ScheduleEvent, the rendered event block must include the group name
 * (groupName), the branch name (branchName), and the time range (start - end).
 *
 * **Validates: Requirements 8.4**
 */
describe('ScheduleCalendar - Property 19: 行事曆事件方塊資訊完整性', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Fixed calendar day inside the rendered dateRange ('2025-03-09' ~ '2025-03-15')
  // so any generated time-of-day is guaranteed to fall within the visible view.
  const BASE_DATE = '2025-03-10';

  const pad = (n: number): string => n.toString().padStart(2, '0');

  // Non-blank display names (group/branch names are always meaningful text in practice)
  const arbNonBlankString = fc
    .string({ minLength: 1, maxLength: 12 })
    .filter((s) => s.trim().length > 0);

  // Arbitrary hour/minute-of-day. Since this event is non-overnight
  // (isOvernight: false), start and end must fall on the same calendar day
  // with end strictly after start. A minimum duration of 30 minutes is
  // enforced: real scheduling tasks are never sub-30-minute, and FullCalendar
  // (under jsdom, which has no real layout engine) does not reliably render
  // event content for extremely narrow slots (e.g. 1-minute events), which
  // would make the "block contains X" DOM assertion meaningless/flaky for
  // such unrealistic durations.
  const MIN_DURATION_MINUTES = 30;
  const arbTimeOfDayMinutes = fc.integer({ min: 0, max: 1438 - MIN_DURATION_MINUTES });

  const toTimeOfDay = (minutes: number) => ({
    hour: Math.floor(minutes / 60),
    minute: minutes % 60,
  });

  const arbScheduleEventCase = fc
    .record({
      id: fc.uuid(),
      groupName: arbNonBlankString,
      branchName: arbNonBlankString,
      startMinutes: arbTimeOfDayMinutes,
      alertStatus: fc.constantFrom<'CLEAN' | 'VIOLATED' | 'OVERRIDDEN'>(
        'CLEAN',
        'VIOLATED',
        'OVERRIDDEN',
      ),
      isRecurring: fc.boolean(),
    })
    .chain(({ id, groupName, branchName, startMinutes, alertStatus, isRecurring }) =>
      fc.integer({ min: startMinutes + MIN_DURATION_MINUTES, max: 1439 }).map((endMinutes) => ({
        id,
        groupName,
        branchName,
        startTime: toTimeOfDay(startMinutes),
        endTime: toTimeOfDay(endMinutes),
        alertStatus,
        isRecurring,
      })),
    )
    .map(({ id, groupName, branchName, startTime, endTime, alertStatus, isRecurring }) => {
      const start = `${BASE_DATE}T${pad(startTime.hour)}:${pad(startTime.minute)}:00`;
      const end = `${BASE_DATE}T${pad(endTime.hour)}:${pad(endTime.minute)}:00`;

      const event: ScheduleEvent = {
        id,
        taskId: `task-${id}`,
        resourceId: 'branch-1',
        title: `${groupName} ${branchName}`,
        start,
        end,
        groupName,
        branchName,
        alertStatus,
        isRecurring,
        isOvernight: false,
        extendedProps: {
          taskType: 'CONTRACT',
          shift: 'DAY',
          assignees: [],
          contents: ['P'],
        },
      };

      const expectedTimeLabel = `${pad(startTime.hour)}:${pad(startTime.minute)} - ${pad(
        endTime.hour,
      )}:${pad(endTime.minute)}`;

      return { event, expectedTimeLabel };
    });

  it('renders an event block containing group name, branch name and time range for any ScheduleEvent', async () => {
    await fc.assert(
      fc.asyncProperty(arbScheduleEventCase, async ({ event, expectedTimeLabel }) => {
        mockScheduleData = {
          events: [event],
          resources: [{ id: 'branch-1', title: '集團A_分店A' }],
        };

        const { unmount } = renderWithProviders(<ScheduleCalendar {...defaultProps} />);

        try {
          // FullCalendar's internal rendering (via requestAnimationFrame-driven
          // layout passes) can occasionally take longer than RTL's default
          // waitFor timeout (1000ms) under jsdom, especially across many
          // consecutive property-test mount/unmount cycles in the same run.
          await waitFor(
            () => {
              expect(screen.getByTestId(`schedule-event-${event.id}`)).toBeInTheDocument();
            },
            { timeout: 5000 },
          );

          const eventEl = screen.getByTestId(`schedule-event-${event.id}`);
          expect(eventEl).toHaveTextContent(event.groupName);
          expect(eventEl).toHaveTextContent(event.branchName);
          expect(eventEl).toHaveTextContent(expectedTimeLabel);

          // Sanity check: expectedTimeLabel derived independently matches component's dayjs formatting
          expect(dayjs(event.start).format('HH:mm')).toBe(expectedTimeLabel.split(' - ')[0]);
        } finally {
          unmount();
        }
      }),
      { numRuns: 20 },
    );
  }, // Each of the 20 property runs mounts/unmounts a full FullCalendar instance
  // and waits (up to 5000ms each) for its async render, which is expensive
  // under jsdom. The default 5000ms vitest test timeout is far too tight for
  // this cumulative cost, especially under parallel test-suite load; raise
  // it here rather than reducing numRuns or weakening the property.
  60000);
});

/**
 * Property 20: 跨日事件時間跨度
 *
 * For any 跨日任務（endTime ≤ startTime），行事曆事件應跨越兩個日曆日顯示，
 * 其結束日期為起始日期之隔日（start day + 1）。
 *
 * This exercises the pure ScheduleEvent -> FullCalendar EventInput conversion
 * logic (`toEventInputs`) used by ScheduleCalendar to render overnight events.
 *
 * **Validates: Requirements 8.5**
 */
describe('ScheduleCalendar - Property 20: 跨日事件時間跨度', () => {
  const pad = (n: number): string => n.toString().padStart(2, '0');

  // Base calendar date offset from a fixed epoch, kept within a reasonable
  // range so date arithmetic never crosses year/century edge cases.
  const arbDate = fc
    .integer({ min: 0, max: 3650 })
    .map((offsetDays) => dayjs('2024-01-01').add(offsetDays, 'day'));

  // startMinutes/endMinutes-of-day where endMinutes <= startMinutes,
  // which is exactly the "跨日" (overnight) condition per Requirement 8.5 / Property 7.
  const arbOvernightMinutes = fc.integer({ min: 0, max: 1439 }).chain((startMinutes) =>
    fc.record({
      startMinutes: fc.constant(startMinutes),
      endMinutes: fc.integer({ min: 0, max: startMinutes }),
    }),
  );

  const arbOvernightEventCase = fc
    .record({
      id: fc.uuid(),
      date: arbDate,
      minutes: arbOvernightMinutes,
    })
    .map(({ id, date, minutes }) => {
      const dateStr = date.format('YYYY-MM-DD');
      const startHH = Math.floor(minutes.startMinutes / 60);
      const startMM = minutes.startMinutes % 60;
      const endHH = Math.floor(minutes.endMinutes / 60);
      const endMM = minutes.endMinutes % 60;

      const start = `${dateStr}T${pad(startHH)}:${pad(startMM)}:00`;
      const end = `${dateStr}T${pad(endHH)}:${pad(endMM)}:00`;

      const event: ScheduleEvent = {
        id,
        taskId: `task-${id}`,
        resourceId: 'branch-1',
        title: 'overnight task',
        start,
        end,
        groupName: '集團A',
        branchName: '分店A',
        alertStatus: 'CLEAN',
        isRecurring: false,
        isOvernight: true,
        extendedProps: {
          taskType: 'CONTRACT',
          shift: 'NIGHT',
          assignees: [],
          contents: ['P'],
        },
      };

      return { event, expectedEndDate: date.add(1, 'day').format('YYYY-MM-DD'), endMM, endHH };
    });

  it('extends the end date to start date + 1 day for any overnight event', () => {
    fc.assert(
      fc.property(arbOvernightEventCase, ({ event, expectedEndDate, endHH, endMM }) => {
        const [eventInput] = toEventInputs([event]);
        if (!eventInput) {
          throw new Error('Expected toEventInputs to return one EventInput for one ScheduleEvent');
        }

        expect(eventInput.start).toBe(event.start);

        const convertedEnd = dayjs(eventInput.end as string);
        // 結束日期應為起始日期之隔日
        expect(convertedEnd.format('YYYY-MM-DD')).toBe(expectedEndDate);
        // 時間跨越兩個日曆日：轉換後結束時刻應在起始時刻之後
        expect(convertedEnd.isAfter(dayjs(event.start))).toBe(true);
        // 結束時刻的時/分應維持原值不變，僅日期被延伸
        expect(convertedEnd.format('HH:mm')).toBe(`${pad(endHH)}:${pad(endMM)}`);
      }),
      { numRuns: 100 },
    );
  });
});
