/**
 * 儀表板「個人任務」（員工）／「今日班表」（主任、副理、管理員）卡片。
 * - variant="personal"：日／週／月分頁 + 前後切換，週／月依日期分組
 * - variant="today"：只看今日，不顯示分頁
 * 列表只顯示「已排滿」的任務；點列開啟單筆詳細視窗。
 */
import React, { useMemo, useState } from 'react';
import { Avatar, Card, Empty, Space, Typography } from 'antd';
import {
  CalendarOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  LeftOutlined,
  PhoneOutlined,
  RightOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useScheduleData } from '@/queries/useScheduleQueries';
import { useCustomerList } from '@/queries/useCustomerQueries';
import { useEmployeeList } from '@/queries/useEmployeeQueries';
import { useUserStore } from '@/stores/useUserStore';
import { getGroupColor } from '@/utils/groupColor';
import {
  buildPersonalTasks,
  formatAssigneeNames,
  formatMonthDayWeek,
  getRangeInfo,
  groupByDate,
  toDateStr,
  type PersonalTask,
  type TaskRange,
} from '../personalTasks';
import {
  ContentTag,
  DetailModal,
  DetailSection,
  Field,
  FlexNote,
  InfoTile,
  TimeBlock,
  TypeContentLine,
} from '../shared';
import '../dashboardCards.css';

const { Text } = Typography;

const RANGE_OPTIONS: { value: TaskRange; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '週' },
  { value: 'month', label: '月' },
];

const assigneeColor = (a: PersonalTask['assignees'][number]) =>
  a.groupColor ?? getGroupColor(a.groupId ?? a.area ?? '');

const TaskRow: React.FC<{ task: PersonalTask; selfId?: string; onClick: () => void }> = ({
  task,
  selfId,
  onClick,
}) => {
  // 時間塊底色：沿用第一位施作同仁的轄區＋班別顏色
  const accent = task.assignees[0] ? assigneeColor(task.assignees[0]) : '#d9d9d9';
  return (
    <div
      className="dash-item"
      role="button"
      tabIndex={0}
      data-testid="task-row"
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <TimeBlock time={task.time} flexible={task.flexible} color={accent} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="dash-d1">
          <span>
            {task.groupName} · {task.branchName}
          </span>
          {task.contents.map((c) => (
            <ContentTag key={c}>{c}</ContentTag>
          ))}
        </div>
        <div className="dash-d2">
          <Avatar.Group size={22}>
            {task.assignees.map((a) => (
              <Avatar key={a.employeeId} style={{ background: assigneeColor(a), fontSize: 11 }}>
                {a.employeeName.slice(-1)}
              </Avatar>
            ))}
          </Avatar.Group>
          <span>{formatAssigneeNames(task.assignees, selfId)}</span>
        </div>
      </div>
    </div>
  );
};

const REPORT_LABEL: Record<string, string> = {
  APP: 'APP 填寫',
  EDM: 'EDM 電子郵件',
  PAPER: '紙本回報',
};

/** 單筆任務詳細視窗（上方底色 = 轄區＋班別顏色） */
export const TaskDetailModal: React.FC<{
  task: PersonalTask;
  selfId?: string;
  onClose: () => void;
}> = ({ task, selfId, onClose }) => {
  const { data: customerPage } = useCustomerList({ page: 1, pageSize: 500 });
  const { data: employeePage } = useEmployeeList({ page: 1, pageSize: 500 });

  const customer = useMemo(
    () => customerPage?.list?.find((c) => c.branchId === task.branchId),
    [customerPage, task.branchId],
  );
  const phoneById = useMemo(() => {
    const m = new Map<string, string>();
    employeePage?.list?.forEach((e) => {
      if (e.phone) m.set(e.id, e.phone);
    });
    return m;
  }, [employeePage]);

  const accent = task.assignees[0] ? assigneeColor(task.assignees[0]) : '#8c8c8c';
  const contact = customer
    ? `${customer.contactName}${customer.contactPhone ? `\u3000${customer.contactPhone}` : ''}`
    : undefined;
  const backup =
    customer?.backupName || customer?.backupPhone
      ? `${customer.backupName ?? ''}${customer.backupPhone ? `\u3000${customer.backupPhone}` : ''}`
      : undefined;
  const reportTypes = task.reportTypes;

  return (
    <DetailModal
      accent={accent}
      kicker="任務詳細"
      title={`${task.groupName} · ${task.branchName}`}
      chips={<TypeContentLine taskType={task.taskType} contents={task.contents} accent={accent} />}
      tiles={
        <>
          <InfoTile
            icon={<CalendarOutlined />}
            label="日期"
            value={formatMonthDayWeek(task.date)}
            accent={accent}
          />
          <InfoTile
            icon={<ClockCircleOutlined />}
            label="時間"
            value={task.flexible ? '彈性　當日內完成' : task.time}
            accent={accent}
          />
        </>
      }
      note={
        task.flexible && task.timeRemark ? (
          <FlexNote accent={accent}>{task.timeRemark}</FlexNote>
        ) : null
      }
      onClose={onClose}
    >
      {customer?.address && (
        <DetailSection icon={<EnvironmentOutlined />} label="地址">
          {customer.address}
        </DetailSection>
      )}
      {contact && (
        <DetailSection icon={<PhoneOutlined />} label="聯絡窗口">
          {contact}
        </DetailSection>
      )}
      {backup && (
        <DetailSection icon={<PhoneOutlined />} label="備用窗口">
          {backup}
        </DetailSection>
      )}
      <DetailSection icon={<TeamOutlined />} label={`施作同仁 · 共 ${task.assignees.length} 人`}>
        {task.assignees.map((a) => {
          const isSelf = a.employeeId === selfId;
          const phone = isSelf ? undefined : phoneById.get(a.employeeId);
          return (
            <div
              key={a.employeeId}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}
            >
              <Avatar size={28} style={{ background: assigneeColor(a), fontSize: 12 }}>
                {a.employeeName.slice(-1)}
              </Avatar>
              <span>
                {a.employeeName}
                {isSelf && '（我）'}
              </span>
              {phone && (
                <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 13 }}>
                  {phone}
                </Text>
              )}
            </div>
          );
        })}
      </DetailSection>
      {(reportTypes.length > 0 || task.reportNotes) && (
        <DetailSection icon={<FileDoneOutlined />} label="施作回報">
          {reportTypes.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 18px' }}>
              {reportTypes.map((r) => (
                <span key={r} className="dash-pill" style={{ background: '#f5f5f5' }}>
                  {r === 'PHOTO'
                    ? `拍照存證${task.photoCount ? `（${task.photoCount} 張）` : ''}`
                    : (REPORT_LABEL[r] ?? r)}
                </span>
              ))}
            </div>
          )}
          {task.reportNotes && <Field label="回報說明">{task.reportNotes}</Field>}
        </DetailSection>
      )}
      {task.remarks && (
        <DetailSection icon={<FileTextOutlined />} label="備註">
          {task.remarks}
        </DetailSection>
      )}
    </DetailModal>
  );
};

interface Props {
  variant: 'personal' | 'today';
}

const PersonalTaskCard: React.FC<Props> = ({ variant }) => {
  const user = useUserStore((s) => s.user);
  const [range, setRange] = useState<TaskRange>('day');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<PersonalTask | null>(null);

  const today = toDateStr(new Date());
  const effectiveRange: TaskRange = variant === 'today' ? 'day' : range;
  const effectiveOffset = variant === 'today' ? 0 : offset;
  const info = getRangeInfo(effectiveRange, effectiveOffset, today);

  // 員工只看自己；主任看自己轄區；副理／管理員看全部
  const isStaff = user?.role === 'STAFF';
  const params = useMemo(
    () => ({
      dimension: 'overview' as const,
      startDate: info.start,
      endDate: info.end,
      ...(isStaff && user?.id ? { employeeId: user.id } : {}),
      ...(user?.role === 'LEADER' && user.area ? { area: user.area } : {}),
    }),
    [info.start, info.end, isStaff, user?.id, user?.role, user?.area],
  );
  const { data } = useScheduleData(params);

  const tasks = useMemo(
    () =>
      buildPersonalTasks(data?.events ?? [], {
        start: info.start,
        end: info.end,
        employeeId: isStaff ? user?.id : undefined,
      }),
    [data, info.start, info.end, isStaff, user?.id],
  );

  const title = variant === 'personal' ? '個人任務' : '今日班表';
  const grouped = effectiveRange !== 'day';

  return (
    <Card
      title={
        <Space size={8}>
          {variant === 'personal' ? <CheckSquareOutlined /> : <CalendarOutlined />}
          {title}
        </Space>
      }
      data-testid="today-schedule-card"
      styles={{ body: { paddingTop: 8 } }}
    >
      {variant === 'personal' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {RANGE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className="dash-chip"
                aria-pressed={range === o.value}
                onClick={() => {
                  setRange(o.value);
                  setOffset(0);
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            <button
              type="button"
              className="dash-nav-btn"
              aria-label="上一段"
              onClick={() => setOffset((v) => v - 1)}
            >
              <LeftOutlined />
            </button>
            <Text strong data-testid="range-label">
              {info.label}
            </Text>
            <button
              type="button"
              className="dash-nav-btn"
              aria-label="下一段"
              onClick={() => setOffset((v) => v + 1)}
            >
              <RightOutlined />
            </button>
            <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
              共 {tasks.length} 筆
            </Text>
          </div>
        </>
      )}
      {tasks.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="沒有任務" />
      ) : grouped ? (
        groupByDate(tasks).map((g) => (
          <div key={g.date}>
            <div className="dash-date">
              {formatMonthDayWeek(g.date)}
              {g.date === today && <span className="dash-today-tag">今天</span>}
            </div>
            {g.items.map((t) => (
              <TaskRow key={t.id} task={t} selfId={user?.id} onClick={() => setSelected(t)} />
            ))}
          </div>
        ))
      ) : (
        tasks.map((t) => (
          <TaskRow key={t.id} task={t} selfId={user?.id} onClick={() => setSelected(t)} />
        ))
      )}
      {/* 打開時才掛載，才會去抓客戶／員工資料 */}
      {selected && (
        <TaskDetailModal task={selected} selfId={user?.id} onClose={() => setSelected(null)} />
      )}
    </Card>
  );
};

export default PersonalTaskCard;
