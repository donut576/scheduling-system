/**
 * 員工「近期任務異動」卡片：主任指派／修改／取消任務時即時顯示的站內通知。
 * 第四種列表：日期塊 + 兩行內容；未讀＝左側藍點；時間在右上。
 * 新增／修改＝主題藍、取消＝#B4483F（不加刪除線）。點開單筆詳細視窗並標為已讀。
 */
import React, { useMemo, useState } from 'react';
import { Avatar, Button, Card, Empty, Space } from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  SwapOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  useNotificationList,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '@/queries/useNotificationQueries';
import { useUserStore } from '@/stores/useUserStore';
import { isNotificationUnread } from '@/constants/notificationTypes';
import { formatNotifyTime } from '@/utils/notificationTime';
import type { DashboardNotification, TaskChangeField, TaskChangePayload } from '../dashboardTypes';
import {
  CatPill,
  ChangedTag,
  ContentTag,
  DateBlock,
  DetailModal,
  DetailSection,
  FlexNote,
  InfoTile,
  OldValue,
  TypeContentLine,
  TimeText,
  UnreadCount,
  UnreadSlot,
} from '../shared';
import { ACTION_META, contentLabel, timeText, type TaskAction } from '../sharedUtils';
import { formatMonthDayWeek } from '../personalTasks';

const TYPE_TO_ACTION: Record<string, TaskAction> = {
  TASK_CREATED: 'CREATED',
  TASK_UPDATED: 'UPDATED',
  TASK_CANCELED: 'CANCELED',
};

const TaskChangeModal: React.FC<{ item: DashboardNotification; onClose: () => void }> = ({
  item,
  onClose,
}) => {
  const selfId = useUserStore((s) => s.user?.id);
  const p = item.payload?.kind === 'TASK_CHANGE' ? (item.payload as TaskChangePayload) : null;
  if (!p) return null;
  const action = TYPE_TO_ACTION[item.type];
  const meta = action ? ACTION_META[action] : undefined;
  const accent = meta?.color ?? '#8c8c8c';
  const isUpdate = action === 'UPDATED';
  const prev = p.previous ?? {};
  // 只有「修改任務」才標示哪些欄位被改
  const changed = (f: TaskChangeField) => isUpdate && Boolean(p.changedFields?.includes(f));
  const prevTime = prev.flexible ? '彈性' : prev.time;
  return (
    <DetailModal
      accent={accent}
      kicker={
        meta ? (
          <CatPill icon={meta.icon} color={accent}>
            {meta.label}
          </CatPill>
        ) : (
          '任務異動'
        )
      }
      title={
        <>
          {p.groupName} · {p.branchName}
        </>
      }
      chips={
        <>
          <TypeContentLine taskType={p.taskType} contents={p.contents} accent={accent} />
          {changed('contents') && <ChangedTag />}
        </>
      }
      tiles={
        <>
          <InfoTile
            icon={<CalendarOutlined />}
            label="日期"
            value={formatMonthDayWeek(p.date)}
            accent={accent}
            changed={changed('date')}
            oldValue={prev.date ? formatMonthDayWeek(prev.date) : undefined}
          />
          <InfoTile
            icon={<ClockCircleOutlined />}
            label="時間"
            value={p.flexible ? '彈性　當日內完成' : p.time}
            accent={accent}
            changed={changed('time')}
            oldValue={prevTime}
          />
        </>
      }
      note={
        p.flexible && p.timeRemark ? (
          <FlexNote accent={accent} changed={changed('timeRemark')}>
            {p.timeRemark}
          </FlexNote>
        ) : null
      }
      onClose={onClose}
    >
      {p.address && (
        <DetailSection icon={<EnvironmentOutlined />} label="地址">
          {p.address}
          {changed('location') && <ChangedTag />}
          {changed('location') && prev.address && <OldValue>{prev.address}</OldValue>}
        </DetailSection>
      )}
      {p.assignees && p.assignees.length > 0 && (
        <DetailSection icon={<TeamOutlined />} label={`施作同仁 · 共 ${p.assignees.length} 人`}>
          {p.assignees.map((a) => (
            <div
              key={a.employeeId}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}
            >
              <Avatar size={28} style={{ background: accent, fontSize: 12 }}>
                {a.employeeName.slice(-1)}
              </Avatar>
              <span>
                {a.employeeName}
                {a.employeeId === selfId && '（我）'}
              </span>
            </div>
          ))}
        </DetailSection>
      )}
      {p.contents.length > 0 && changed('contents') && prev.contents && (
        <DetailSection icon={<FileTextOutlined />} label="任務內容">
          <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
            {p.contents.map((c) => (
              <ContentTag key={c}>{c}</ContentTag>
            ))}
          </span>
          <OldValue>{prev.contents.map(contentLabel).join('、')}</OldValue>
        </DetailSection>
      )}
      {p.remarks && (
        <DetailSection icon={<FileTextOutlined />} label="備註">
          {p.remarks}
          {changed('remarks') && <ChangedTag />}
          {changed('remarks') && prev.remarks && <OldValue>{prev.remarks}</OldValue>}
        </DetailSection>
      )}
    </DetailModal>
  );
};

const TaskChangeCard: React.FC = () => {
  const user = useUserStore((s) => s.user);
  const { data } = useNotificationList({
    page: 1,
    pageSize: 50,
    channel: 'IN_APP',
    recipientId: user?.id,
  });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [selected, setSelected] = useState<DashboardNotification | null>(null);

  const items = useMemo(
    () =>
      ((data?.list ?? []) as DashboardNotification[])
        .filter((n) => n.type in TYPE_TO_ACTION)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data],
  );
  const unread = items.filter(isNotificationUnread).length;

  const open = (n: DashboardNotification) => {
    setSelected(n);
    if (isNotificationUnread(n)) markRead.mutate(n.id);
  };

  return (
    <Card
      data-testid="recent-notifications-card"
      title={
        <Space size={8}>
          <SwapOutlined />
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            近期任務異動
            <UnreadCount count={unread} />
          </span>
        </Space>
      }
      extra={
        unread > 0 && (
          <Button type="link" size="small" onClick={() => markAll.mutate()}>
            全部標為已讀
          </Button>
        )
      }
    >
      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="沒有任務異動" />
      ) : (
        items.map((n) => {
          const p = n.payload?.kind === 'TASK_CHANGE' ? (n.payload as TaskChangePayload) : null;
          const action = TYPE_TO_ACTION[n.type];
          if (!action) return null;
          const meta = ACTION_META[action];
          return (
            <div
              key={n.id}
              className="dash-item"
              role="button"
              tabIndex={0}
              data-testid="task-change-row"
              onClick={() => open(n)}
              onKeyDown={(e) => e.key === 'Enter' && open(n)}
            >
              <UnreadSlot unread={isNotificationUnread(n)} />
              {p && <DateBlock date={p.date} color={meta.color} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                {p ? (
                  <>
                    <div className="dash-d1">
                      <span className="dash-d1-time">{timeText(p.time, p.flexible)}</span>
                      <span>
                        {p.groupName} · {p.branchName}
                      </span>
                    </div>
                    <div className="dash-d2">
                      <CatPill icon={meta.icon} color={meta.color}>
                        {meta.label}
                      </CatPill>
                    </div>
                  </>
                ) : (
                  <div className="dash-d1">{n.subject}</div>
                )}
              </div>
              <span style={{ alignSelf: 'flex-start' }}>
                <TimeText>{formatNotifyTime(n.createdAt)}</TimeText>
              </span>
            </div>
          );
        })
      )}
      {selected && <TaskChangeModal item={selected} onClose={() => setSelected(null)} />}
    </Card>
  );
};

export default TaskChangeCard;
