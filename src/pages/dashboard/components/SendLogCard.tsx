/**
 * 「近期通知發送紀錄」卡片（主任／副理／管理員）。
 * 第四種列表：依「寄出日」分組（最新一天展開，其餘收合，標題列顯示各類別封數）；
 * 列內：任務日期塊 + 名稱 + 類別（中性灰）／新增修改取消 + 任務時間；寄出時間在右上。
 * 頂部摘要列顯示今天寄出封數；上方可篩選 全部／客戶／員工。
 * 證照到期通知是系統寄給主任的，不算「發送紀錄」，這裡不顯示。
 * 主任只看自己寄出的信；副理／管理員看全部。
 */
import React, { useMemo, useState } from 'react';
import { Card, Empty, Space } from 'antd';
import {
  ClockCircleOutlined,
  DownOutlined,
  MailOutlined,
  RightOutlined,
  SendOutlined,
  ShopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotificationList } from '@/queries/useNotificationQueries';
import { useUserStore } from '@/stores/useUserStore';
import type { DashboardNotification, SendLogPayload } from '../dashboardTypes';
import {
  CatPill,
  DateBlock,
  DetailModal,
  DetailSection,
  IconBlock,
  InfoTile,
  Pill,
  TimeText,
} from '../shared';
import { ACTION_META, timeText } from '../sharedUtils';

const GRAY = '#595959';

/** 寄出時間 → Asia/Taipei 的 YYYY-MM-DD／HH:mm */
const sentDay = (iso: string) =>
  new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
const sentHm = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
const WD = ['日', '一', '二', '三', '四', '五', '六'];
const dayLabel = (day: string) => {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number);
  const wd = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d} 週${wd}`;
};

type Filter = 'ALL' | 'CUSTOMER' | 'EMPLOYEE';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'CUSTOMER', label: '客戶' },
  { value: 'EMPLOYEE', label: '員工' },
];
const SHORT: Record<string, string> = { CUSTOMER: '客戶', EMPLOYEE: '員工' };

type LogKind = 'CUSTOMER' | 'EMPLOYEE';

const KIND_META: Record<LogKind, { label: string; icon: React.ReactNode }> = {
  CUSTOMER: { label: '任務・客戶', icon: <ShopOutlined /> },
  EMPLOYEE: { label: '任務・員工', icon: <UserOutlined /> },
};

const kindOf = (n: DashboardNotification): LogKind | null => {
  if (n.type === 'CUSTOMER_NOTIFY') return 'CUSTOMER';
  if (n.type === 'EMPLOYEE_DISPATCH') return 'EMPLOYEE';
  return null;
};

/** 收件對象文字：客戶＝集團/公司 - 分店；員工＝姓名 */
export const recipientText = (n: DashboardNotification): string => n.recipientName;

/** 依角色篩出看得到的紀錄（只含郵件紀錄；站內通知有 isRead 欄位，不算） */
export const filterSendLog = (
  list: DashboardNotification[],
  user?: { id: string; role: string } | null,
): DashboardNotification[] =>
  list
    .filter((n) => n.isRead === undefined && kindOf(n) !== null)
    .filter((n) => {
      if (user?.role !== 'LEADER') return true;
      return n.sentBy === user.id;
    })
    .sort((a, b) => (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt));

const SendLogRow: React.FC<{ n: DashboardNotification; onOpen: () => void }> = ({ n, onOpen }) => {
  const k = kindOf(n) as LogKind;
  const p = n.payload?.kind === 'SEND_LOG' ? (n.payload as SendLogPayload) : null;
  const meta = p ? ACTION_META[p.action] : null;
  return (
    <div
      className="dash-item"
      role="button"
      tabIndex={0}
      data-testid="send-log-row"
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      {p && meta ? (
        <DateBlock date={p.taskDate} color={meta.color} />
      ) : (
        <IconBlock icon={KIND_META[k].icon} color={GRAY} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="dash-d1">
          {p && <span className="dash-d1-time">{timeText(p.taskTime, p.flexible)}</span>}
          <span>{recipientText(n)}</span>
        </div>
        <div className="dash-d2">
          <CatPill icon={KIND_META[k].icon} color={GRAY}>
            {KIND_META[k].label}
          </CatPill>
          {meta && (
            <CatPill icon={meta.icon} color={meta.color}>
              {meta.label}
            </CatPill>
          )}
        </div>
      </div>
      <span style={{ alignSelf: 'flex-start' }}>
        <TimeText>{sentHm(n.sentAt ?? n.createdAt)}</TimeText>
      </span>
    </div>
  );
};

const SendLogCard: React.FC = () => {
  const user = useUserStore((s) => s.user);
  const navigate = useNavigate();
  const { data } = useNotificationList({ page: 1, pageSize: 50 });
  const [selected, setSelected] = useState<DashboardNotification | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  // 手動展開／收合；沒操作過的日期：最新一天展開、其餘收合
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const items = useMemo(
    () => filterSendLog((data?.list ?? []) as DashboardNotification[], user).slice(0, 60),
    [data, user],
  );

  const groups = useMemo(() => {
    const visible = items.filter((n) => filter === 'ALL' || kindOf(n) === filter);
    const m = new Map<string, DashboardNotification[]>();
    visible.forEach((n) => {
      const day = sentDay(n.sentAt ?? n.createdAt);
      m.set(day, [...(m.get(day) ?? []), n]);
    });
    return Array.from(m.entries()).map(([day, list]) => ({ day, list }));
  }, [items, filter]);

  const kind = selected ? kindOf(selected) : null;

  // 摘要：今天（Asia/Taipei）寄出幾封、客戶／員工各幾封
  const todayStr = sentDay(new Date().toISOString());
  const todayItems = items.filter((n) => sentDay(n.sentAt ?? n.createdAt) === todayStr);
  const todayCustomer = todayItems.filter((n) => kindOf(n) === 'CUSTOMER').length;
  const todayEmployee = todayItems.filter((n) => kindOf(n) === 'EMPLOYEE').length;

  return (
    <Card
      data-testid="send-log-card"
      title={
        <Space size={8}>
          <SendOutlined />
          近期通知發送紀錄
        </Space>
      }
      extra={
        <a onClick={() => navigate('/notification')} data-testid="notify-settings-link">
          通知設定
        </a>
      }
    >
      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="沒有發送紀錄" />
      ) : (
        <>
          <div className="dash-summary" data-testid="send-log-summary">
            {todayItems.length > 0
              ? `今天已寄 ${todayItems.length} 封 · 客戶 ${todayCustomer} · 員工 ${todayEmployee}`
              : '今天尚未寄出'}
          </div>
          <div style={{ display: 'flex', gap: 6, margin: '10px 0 8px' }}>
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className="dash-chip"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="dash-scroll" data-testid="send-log-list">
            {groups.map((g, i) => {
              const open = toggled[g.day] ?? i === 0;
              const counts = (['CUSTOMER', 'EMPLOYEE'] as LogKind[])
                .map((kd) => [kd, g.list.filter((n) => kindOf(n) === kd).length] as const)
                .filter(([, c]) => c > 0)
                .map(([kd, c]) => `${SHORT[kd]} ${c}`)
                .join(' · ');
              return (
                <div key={g.day} data-testid="send-log-group">
                  <button
                    type="button"
                    className="dash-group"
                    aria-expanded={open}
                    onClick={() => setToggled((t) => ({ ...t, [g.day]: !open }))}
                  >
                    {open ? <DownOutlined /> : <RightOutlined />}
                    {dayLabel(g.day)}
                    {!open && <span className="dash-group-sub">{counts}</span>}
                    <span className="dash-group-count">共 {g.list.length} 封</span>
                  </button>
                  {open &&
                    g.list.map((n) => (
                      <SendLogRow key={n.id} n={n} onOpen={() => setSelected(n)} />
                    ))}
                </div>
              );
            })}
          </div>
        </>
      )}
      {selected && kind && (
        <DetailModal
          accent="#595959"
          kicker="通知發送詳情"
          title={selected.subject}
          chips={
            <>
              <Pill icon={KIND_META[kind].icon}>{KIND_META[kind].label}</Pill>
              {selected.payload?.kind === 'SEND_LOG' && (
                <CatPill
                  icon={ACTION_META[selected.payload.action].icon}
                  color={ACTION_META[selected.payload.action].color}
                >
                  {ACTION_META[selected.payload.action].label}
                </CatPill>
              )}
            </>
          }
          tiles={
            <>
              <InfoTile
                icon={<ClockCircleOutlined />}
                label="發送時間"
                value={new Date(selected.sentAt ?? selected.createdAt).toLocaleString('zh-TW', {
                  hour12: false,
                  timeZone: 'Asia/Taipei',
                })}
                accent="#595959"
              />
              <InfoTile
                icon={<UserOutlined />}
                label="寄件人"
                value={selected.senderName ?? '系統'}
                accent="#595959"
              />
            </>
          }
          onClose={() => setSelected(null)}
        >
          <DetailSection
            icon={kind === 'CUSTOMER' ? <ShopOutlined /> : <UserOutlined />}
            label="收件對象"
          >
            {recipientText(selected)}
          </DetailSection>
          <DetailSection icon={<MailOutlined />} label="郵件內文">
            <div
              style={{
                whiteSpace: 'pre-wrap',
                background: '#fafafa',
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                padding: '10px 12px',
                marginTop: 4,
              }}
            >
              {selected.content}
            </div>
          </DetailSection>
        </DetailModal>
      )}
    </Card>
  );
};

export default SendLogCard;
