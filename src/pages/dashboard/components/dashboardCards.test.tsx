import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SendLogCard, { filterSendLog, recipientText } from './SendLogCard';
import SystemNotificationCard from './SystemNotificationCard';
import TaskChangeCard from './TaskChangeCard';
import { useNotificationList } from '@/queries/useNotificationQueries';
import { useUserStore } from '@/stores/useUserStore';
import type { DashboardNotification } from '../dashboardTypes';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/queries/useNotificationQueries', () => ({
  useNotificationList: vi.fn(),
  useMarkNotificationRead: () => ({ mutate: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn() }),
}));

const NOW = new Date().toISOString();
const base = {
  recipientType: 'EMPLOYEE' as const,
  status: 'NOTIFIED' as const,
  createdAt: NOW,
};

const setList = (list: DashboardNotification[]) =>
  vi.mocked(useNotificationList).mockReturnValue({
    data: { list, total: list.length, page: 1, pageSize: 50 },
  } as never);

const setUser = (role: 'STAFF' | 'LEADER' | 'MANAGER', id = 'u1') =>
  useUserStore.setState({
    user: { id, name: 'T', employeeNo: 'E1', role, permissions: [] },
  } as never);

beforeEach(() => vi.clearAllMocks());

describe('filterSendLog / recipientText', () => {
  const list: DashboardNotification[] = [
    {
      ...base,
      id: '1',
      type: 'CUSTOMER_NOTIFY',
      recipientId: 'c1',
      recipientName: '樂雅樂 - 觀音',
      subject: 's',
      content: 'c',
      sentBy: 'u1',
    },
    {
      ...base,
      id: '2',
      type: 'CUSTOMER_NOTIFY',
      recipientId: 'c2',
      recipientName: 'X - Y',
      subject: 's',
      content: 'c',
      sentBy: 'u9',
    },
    {
      ...base,
      id: '3',
      type: 'LICENSE_EXPIRY',
      recipientId: 'u1',
      recipientName: '王主任',
      subject: 's',
      content: 'c',
      recipientArea: '北早',
    },
    {
      ...base,
      id: '4',
      type: 'LICENSE_EXPIRY',
      recipientId: 'u1',
      recipientName: '站內',
      subject: 's',
      content: 'c',
      isRead: false,
    },
  ];
  it('主任只看自己寄的信；證照通知與站內通知都不算發送紀錄', () => {
    expect(filterSendLog(list, { id: 'u1', role: 'LEADER' }).map((n) => n.id)).toEqual(['1']);
  });
  it('副理看全部任務郵件，但不含證照信', () => {
    expect(
      filterSendLog(list, { id: 'm1', role: 'MANAGER' })
        .map((n) => n.id)
        .sort(),
    ).toEqual(['1', '2']);
  });
  it('收件對象＝名稱', () => {
    expect(recipientText(list[0]!)).toBe('樂雅樂 - 觀音');
  });
});

describe('SendLogCard', () => {
  it('列表顯示標籤與收件對象，點擊開啟通知發送詳情', async () => {
    setUser('MANAGER', 'm1');
    setList([
      {
        ...base,
        id: '1',
        type: 'CUSTOMER_NOTIFY',
        recipientId: 'c1',
        recipientName: '樂雅樂 - 觀音',
        subject: '主旨A',
        content: '內文A',
        senderName: '王主任',
      },
    ]);
    render(<SendLogCard />);
    const row = screen.getByTestId('send-log-row');
    expect(within(row).getByText('任務・客戶')).toBeInTheDocument();
    expect(within(row).getByText('樂雅樂 - 觀音')).toBeInTheDocument();
    await userEvent.click(row);
    expect(await screen.findByText('通知發送詳情')).toBeInTheDocument();
    expect(screen.getByText('主旨A')).toBeInTheDocument();
  });
});

describe('SystemNotificationCard', () => {
  it('只顯示證照即將到期（審核結果不顯示）；紅圈未讀數、藍點、摘要列、剩 N 天', () => {
    setUser('LEADER');
    const lic = (id: string, isRead: boolean, daysLeft: number, expiryDate: string) =>
      ({
        ...base,
        id,
        type: 'LICENSE_EXPIRY',
        recipientId: 'u1',
        recipientName: 'x',
        subject: 's',
        content: 'c',
        isRead,
        payload: {
          kind: 'LICENSE_EXPIRY',
          employeeName: '李四',
          license: '乙級',
          expiryDate,
          daysLeft,
        },
      }) as DashboardNotification;
    setList([
      lic('b', false, 18, '2026-12-01'),
      lic('c', true, 6, '2026-11-26'),
      {
        ...base,
        id: 'a',
        type: 'APPROVAL_RESULT',
        recipientId: 'u1',
        recipientName: 'x',
        subject: '審核',
        content: 'c',
        isRead: false,
        payload: {
          kind: 'APPROVAL_RESULT',
          result: 'APPROVED',
          applyContent: '修改時間',
          target: '樂雅樂 - 觀音',
          taskText: '11/14 1430',
          reviewer: '林副理',
        },
      } as DashboardNotification,
    ]);
    render(<SystemNotificationCard />);
    expect(screen.getAllByTestId('system-notification-row')).toHaveLength(2);
    expect(screen.getByTestId('unread-count')).toHaveTextContent('1');
    expect(screen.getAllByTestId('unread-dot')).toHaveLength(1);
    expect(screen.getByTestId('system-notification-summary')).toHaveTextContent(
      '證照即將到期 2 位',
    );
    expect(screen.getByTestId('system-notification-summary')).toHaveTextContent('7 天內 1 位');
    expect(screen.getByText('剩 18 天')).toBeInTheDocument();
    expect(screen.queryByText('證照即將到期')).not.toBeInTheDocument();
    expect(screen.queryByText('審核通過')).not.toBeInTheDocument();
  });
});

describe('TaskChangeCard', () => {
  const mk = (type: string, extra: object = {}) =>
    ({
      ...base,
      id: 't',
      type,
      recipientId: 'u1',
      recipientName: 'x',
      subject: 's',
      content: 'c',
      isRead: false,
      payload: {
        kind: 'TASK_CHANGE',
        groupName: '鼎泰豐',
        branchName: '101店',
        taskType: 'CONTRACT',
        date: '2026-11-14',
        time: '1500',
        contents: ['P'],
        ...extra,
      },
    }) as DashboardNotification;

  it('列表：日期塊、集團分店、列表不顯示任務內容、時間(HHmm)在公司名前、類別、藍點；列表不寫已更動欄位', () => {
    setUser('STAFF');
    setList([mk('TASK_UPDATED', { changedFields: ['time'], previous: { time: '1000' } })]);
    render(<TaskChangeCard />);
    const row = screen.getByTestId('task-change-row');
    expect(within(row).getByTestId('date-block')).toHaveTextContent('11月14週六');
    expect(within(row).getByText('鼎泰豐 · 101店')).toBeInTheDocument();
    expect(within(row).queryByText('P')).not.toBeInTheDocument(); // 列表不顯示任務內容
    expect(within(row).getByText('修改')).toBeInTheDocument();
    expect(within(row).getByText('1500')).toBeInTheDocument();
    expect(within(row).queryByText(/已更動/)).not.toBeInTheDocument();
    expect(within(row).getByTestId('unread-dot')).toBeInTheDocument();
  });

  it('取消任務：標「取消」，不加刪除線', () => {
    setUser('STAFF');
    setList([mk('TASK_CANCELED')]);
    render(<TaskChangeCard />);
    const row = screen.getByTestId('task-change-row');
    expect(within(row).getByText('取消')).toBeInTheDocument();
    expect(within(row).getByText('鼎泰豐 · 101店').style.textDecoration).toBe('');
  });

  it('修改任務詳細：只在被改欄位標「已修改」並顯示原本內容', async () => {
    setUser('STAFF');
    setList([mk('TASK_UPDATED', { changedFields: ['time'], previous: { time: '1000' } })]);
    render(<TaskChangeCard />);
    await userEvent.click(screen.getByTestId('task-change-row'));
    expect(await screen.findAllByText('已修改')).toHaveLength(1);
    expect(screen.getByTestId('old-value')).toHaveTextContent('原：1000');
  });
});

describe('SendLogCard 任務資訊與分組', () => {
  it('顯示任務日期塊、新增修改取消、任務時間；可篩選類別；較早的日期預設收合', async () => {
    setUser('MANAGER', 'm1');
    const today = new Date().toISOString();
    const old = new Date(Date.now() - 3 * 86400000).toISOString();
    setList([
      {
        ...base,
        id: '1',
        type: 'CUSTOMER_NOTIFY',
        recipientId: 'c1',
        recipientName: '樂雅樂 - 觀音',
        subject: 's',
        content: 'c',
        sentAt: today,
        payload: { kind: 'SEND_LOG', action: 'CANCELED', taskDate: '2026-11-16', taskTime: '1430' },
      },
      {
        ...base,
        id: '2',
        type: 'EMPLOYEE_DISPATCH',
        recipientId: 'e1',
        recipientName: '王小明',
        subject: 's',
        content: 'c',
        sentAt: today,
      },
      {
        ...base,
        id: '3',
        type: 'EMPLOYEE_DISPATCH',
        recipientId: 'e2',
        recipientName: '舊的人',
        subject: 's',
        content: 'c',
        sentAt: old,
      },
    ] as DashboardNotification[]);
    render(<SendLogCard />);
    const rows = screen.getAllByTestId('send-log-row');
    expect(rows).toHaveLength(2); // 舊的一天收合
    // 兩封同時寄出，順序不固定，所以用收件對象找那一列
    const row = rows.find((r) => within(r).queryByText('樂雅樂 - 觀音'))!;
    expect(within(row).getByText('取消')).toBeInTheDocument();
    expect(within(row).getByText('1430')).toBeInTheDocument();
    expect(within(row).getByTestId('date-block')).toHaveTextContent('11月16');
    await userEvent.click(screen.getByRole('button', { name: '員工' }));
    expect(screen.getAllByTestId('send-log-row')).toHaveLength(1);
    expect(screen.getAllByTestId('send-log-group')).toHaveLength(2);
  });
});
