import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Empty, Input, Segmented, Select, Space, Tag, Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  LeftOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Draggable } from '@fullcalendar/interaction';
import { useTranslation } from 'react-i18next';
import { useTaskList } from '@/queries/useTaskQueries';
import type { Task, TaskType } from '@/types/task';
import { formatTaskContents } from '@/constants/taskStatus';

export interface UnscheduledTasksPanelProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onEditTask?: (task: Task) => void;
  onDragStartTask?: (task: Task) => void;
  onDragEndTask?: () => void;
  isDropActive?: boolean;
  width?: number;
  onWidthChange?: (width: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

const TASK_TYPE_COLORS: Record<TaskType, string> = {
  CONTRACT: 'blue',
  ONETIME: 'green',
  ESR: 'volcano',
};

/**
 * 待排任務面板 (UnscheduledTasksPanel)
 *
 * 呈現所有未排班（status = 'UNSCHEDULED'）之任務清單，
 * 支援關鍵字搜尋、任務類型過濾與折疊切換。
 * 整合 FullCalendar Draggable，使卡片可直接拖曳至日曆上完成排班，
 * 並支援將已排程任務直接拖出至面板移回待排。
 * 同時支援左側邊界拖曳調整寬度與拉動收合。
 */
export const UnscheduledTasksPanel: React.FC<UnscheduledTasksPanelProps> = ({
  collapsed = false,
  onToggleCollapse,
  onEditTask: _onEditTask,
  onDragStartTask,
  onDragEndTask,
  isDropActive = false,
  width: controlledWidth,
  onWidthChange,
  className = '',
  style,
}) => {
  const { t } = useTranslation();
  const listContainerRef = useRef<HTMLDivElement>(null);
  const draggableInstanceRef = useRef<Draggable | null>(null);

  // 面板寬度與拉動調整狀態
  const [internalWidth, setInternalWidth] = useState<number>(360);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const panelWidth = controlledWidth ?? internalWidth;
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(360);

  const handleResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startXRef.current - moveEvent.clientX; // 往左拉變寬
      const newWidth = startWidthRef.current + deltaX;

      if (newWidth < 170) {
        // 往右拉到底：直接觸發收合
        if (!collapsed) {
          onToggleCollapse?.();
        }
        cleanup();
      } else {
        const clampedWidth = Math.min(Math.max(newWidth, 260), 760);
        if (controlledWidth === undefined) {
          setInternalWidth(clampedWidth);
        }
        onWidthChange?.(clampedWidth);
      }
    };

    const cleanup = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', cleanup);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', cleanup);
  };

  // 待排原因分類篩選與搜尋狀態
  const [reasonFilter, setReasonFilter] = useState<
    'ALL' | 'MISSING_DATE' | 'MISSING_ASSIGNEES' | 'MISSING_TIME'
  >('ALL');
  const [keyword, setKeyword] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // 查詢所有待排任務
  const { data: taskData, isLoading } = useTaskList({
    status: 'UNSCHEDULED',
    pageSize: 100,
  });

  const rawTasks = useMemo(() => taskData?.list ?? [], [taskData?.list]);

  // 動態統計各待排原因數量
  const reasonCounts = useMemo(() => {
    let missingDate = 0;
    let missingAssignees = 0;
    let missingTime = 0;

    rawTasks.forEach((task) => {
      if (!task.date || task.date === '') missingDate++;
      if (
        !task.assignees ||
        task.assignees.length === 0 ||
        task.assignees.length < (task.headcount || 1)
      ) {
        missingAssignees++;
      }
      if (!task.startTime || !task.endTime || task.startTime === '') missingTime++;
    });

    return {
      all: rawTasks.length,
      missingDate,
      missingAssignees,
      missingTime,
    };
  }, [rawTasks]);

  // 本地篩選任務清單（依待排原因、任務類型與關鍵字）
  const filteredTasks = useMemo(() => {
    let result = rawTasks;

    // 1. 待排原因分類篩選
    if (reasonFilter === 'MISSING_DATE') {
      result = result.filter((task) => !task.date || task.date === '');
    } else if (reasonFilter === 'MISSING_ASSIGNEES') {
      result = result.filter(
        (task) =>
          !task.assignees ||
          task.assignees.length === 0 ||
          task.assignees.length < (task.headcount || 1),
      );
    } else if (reasonFilter === 'MISSING_TIME') {
      result = result.filter((task) => !task.startTime || !task.endTime || task.startTime === '');
    }

    // 2. 任務類型篩選
    if (selectedType !== 'ALL') {
      result = result.filter((task) => task.taskType === selectedType);
    }

    // 3. 關鍵字搜尋
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase();
      result = result.filter(
        (task) =>
          task.groupName.toLowerCase().includes(q) ||
          task.branchName.toLowerCase().includes(q) ||
          task.remarks?.toLowerCase().includes(q) ||
          task.route?.toLowerCase().includes(q) ||
          task.assignees.some((a) => a.employeeName.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [keyword, rawTasks, reasonFilter, selectedType]);

  const onDragStartTaskRef = useRef(onDragStartTask);
  const onDragEndTaskRef = useRef(onDragEndTask);
  onDragStartTaskRef.current = onDragStartTask;
  onDragEndTaskRef.current = onDragEndTask;

  // 初始化 FullCalendar 外部拖曳實例（只在收合狀態切換時重新綁定，不在渲染時銷毀）
  useEffect(() => {
    if (collapsed || !listContainerRef.current) {
      if (draggableInstanceRef.current) {
        draggableInstanceRef.current.destroy();
        draggableInstanceRef.current = null;
      }
      return;
    }

    if (draggableInstanceRef.current) {
      draggableInstanceRef.current.destroy();
      draggableInstanceRef.current = null;
    }

    draggableInstanceRef.current = new Draggable(listContainerRef.current, {
      itemSelector: '.unscheduled-task-draggable-card',
      eventData: (eventEl: HTMLElement) => {
        const taskId =
          eventEl.getAttribute('data-task-id') ||
          eventEl.closest('[data-task-id]')?.getAttribute('data-task-id') ||
          '';
        const taskRaw =
          eventEl.getAttribute('data-task-raw') ||
          eventEl.closest('[data-task-raw]')?.getAttribute('data-task-raw');
        let task: Task | null = null;
        if (taskRaw) {
          try {
            task = JSON.parse(taskRaw) as Task;
          } catch {
            task = null;
          }
        }
        if (task) {
          onDragStartTaskRef.current?.(task);
        }
        const duration =
          task?.startTime && task?.endTime
            ? calculateDuration(task.startTime, task.endTime)
            : '02:00';

        return {
          id: taskId,
          title: task ? `${task.groupName} - ${task.branchName}` : '待排任務',
          duration,
          create: false,
          extendedProps: {
            taskId,
            task,
          },
        };
      },
    });

    const handleGlobalDragEnd = () => {
      onDragEndTaskRef.current?.();
    };

    window.addEventListener('pointerup', handleGlobalDragEnd);
    window.addEventListener('mouseup', handleGlobalDragEnd);
    window.addEventListener('touchend', handleGlobalDragEnd);
    window.addEventListener('dragend', handleGlobalDragEnd);
    window.addEventListener('drop', handleGlobalDragEnd);

    return () => {
      if (draggableInstanceRef.current) {
        draggableInstanceRef.current.destroy();
        draggableInstanceRef.current = null;
      }
      window.removeEventListener('pointerup', handleGlobalDragEnd);
      window.removeEventListener('mouseup', handleGlobalDragEnd);
      window.removeEventListener('touchend', handleGlobalDragEnd);
      window.removeEventListener('dragend', handleGlobalDragEnd);
      window.removeEventListener('drop', handleGlobalDragEnd);
    };
  }, [collapsed]);

  /** 計算時間長度字串（格式 HH:mm） */
  function calculateDuration(startTime: string, endTime: string): string {
    const [sh = 0, sm = 0] = startTime.split(':').map(Number);
    const [eh = 0, em = 0] = endTime.split(':').map(Number);
    let diffMinutes = eh * 60 + em - (sh * 60 + sm);
    if (diffMinutes <= 0) diffMinutes += 24 * 60; // 跨日
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  // 折疊狀態側邊長條
  if (collapsed) {
    return (
      <div
        data-testid="unscheduled-tasks-panel-collapsed"
        className={`unscheduled-tasks-panel-collapsed ${className}`}
        style={{
          width: 44,
          height: '100%',
          backgroundColor: '#ffffff',
          borderRadius: 8,
          border: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 4px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          userSelect: 'none',
          ...style,
        }}
        onClick={onToggleCollapse}
        title="點擊或往左拉開待排任務清單"
      >
        <Tooltip title={t('schedule.toggleUnscheduledPanel') || '展開待排任務'} placement="left">
          <Button
            type="text"
            icon={<LeftOutlined />}
            size="small"
            style={{ marginBottom: 12 }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse?.();
            }}
          />
        </Tooltip>
        <Badge
          count={rawTasks.length}
          overflowCount={99}
          style={{ backgroundColor: '#1677ff', marginBottom: 8 }}
        />
        <div
          style={{
            writingMode: 'vertical-rl',
            letterSpacing: 2,
            fontWeight: 600,
            color: '#595959',
            marginTop: 12,
            fontSize: 13,
            userSelect: 'none',
          }}
        >
          {t('schedule.unscheduledTasks') || '待排任務'}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="unscheduled-tasks-panel"
      className={`unscheduled-tasks-panel ${className}`}
      style={{
        width: panelWidth,
        minWidth: 260,
        maxWidth: 780,
        height: '100%',
        backgroundColor: isDropActive ? '#f0f5ff' : '#ffffff',
        borderRadius: 8,
        border: isDropActive ? '2px dashed #1677ff' : '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isDropActive
          ? '0 4px 16px rgba(22, 119, 255, 0.15)'
          : isResizing
            ? '0 4px 16px rgba(0, 0, 0, 0.12)'
            : '0 2px 8px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden',
        position: 'relative',
        transition: isResizing ? 'none' : 'box-shadow 0.2s ease',
        ...style,
      }}
    >
      {/* 左右拖曳調整寬度／往右拉到底收合的分隔條 */}
      <div
        data-testid="unscheduled-panel-resizer"
        className="unscheduled-panel-resizer"
        onMouseDown={handleResizerMouseDown}
        title="按住左右拖曳可調整面板寬度；往右拉到底可收合"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          cursor: 'col-resize',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            width: 3,
            height: 36,
            borderRadius: 2,
            backgroundColor: isResizing ? '#1677ff' : '#d9d9d9',
            transition: 'background-color 0.2s',
          }}
        />
      </div>

      {/* 面板頂部標頭 */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: isDropActive ? '#e6f4ff' : '#fafafa',
        }}
      >
        <Space size={8} align="center">
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1f1f1f' }}>
            {t('schedule.unscheduledTasksTitle') || '待排任務清單'}
          </span>
          <Badge
            count={rawTasks.length}
            overflowCount={99}
            style={{ backgroundColor: '#1677ff' }}
          />
        </Space>
        {onToggleCollapse && (
          <Tooltip title={t('schedule.toggleUnscheduledPanel') || '折疊面板'} placement="left">
            <Button
              type="text"
              icon={<RightOutlined />}
              size="small"
              onClick={onToggleCollapse}
              aria-label="collapse-panel"
            />
          </Tooltip>
        )}
      </div>

      {/* 拖曳移回待排指示條 */}
      {isDropActive && (
        <div
          data-testid="unscheduled-drop-zone-indicator"
          style={{
            padding: '8px 12px',
            backgroundColor: '#bae0ff',
            color: '#003eb3',
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 600,
            borderBottom: '1px solid #91caff',
          }}
        >
          📥 {t('schedule.dropToUnschedule') || '釋放以移回待排任務'}
        </div>
      )}

      {/* 搜尋與篩選列 */}
      <div
        style={{
          padding: '10px 12px 10px 12px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          backgroundColor: '#fafafa',
        }}
      >
        {/* 關鍵字搜尋 + 任務類型選單 */}
        <div style={{ display: 'flex', gap: 6 }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder={t('schedule.searchUnscheduledPlaceholder') || '搜尋客戶或備註...'}
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            size="small"
            style={{ flex: 1, borderRadius: 6 }}
          />
          <Select
            size="small"
            value={selectedType}
            onChange={(val) => setSelectedType(val)}
            style={{ width: 100 }}
            options={[
              { label: t('schedule.allTaskTypes') || '全部類型', value: 'ALL' },
              {
                label: t('task.contract') || t('schedule.taskTypes.contract') || '合約',
                value: 'CONTRACT',
              },
              {
                label: t('task.onetime') || t('schedule.taskTypes.onetime') || '單次',
                value: 'ONETIME',
              },
              { label: t('task.esr') || t('schedule.taskTypes.esr') || 'ESR', value: 'ESR' },
            ]}
          />
        </div>

        {/* 待排原因分類 Tabs (全部 / 缺日期 / 缺人員 / 缺時間) */}
        <Segmented
          size="small"
          block
          value={reasonFilter}
          onChange={(val) =>
            setReasonFilter(val as 'ALL' | 'MISSING_DATE' | 'MISSING_ASSIGNEES' | 'MISSING_TIME')
          }
          options={[
            {
              label: (
                <span style={{ fontSize: 12, fontWeight: 500 }}>
                  {t('schedule.filterAll') || '全部'}
                  <span style={{ marginLeft: 3, opacity: 0.7, fontSize: 11 }}>
                    ({reasonCounts.all})
                  </span>
                </span>
              ),
              value: 'ALL',
            },
            {
              label: (
                <span style={{ fontSize: 12, fontWeight: 500 }}>
                  {t('schedule.filterMissingDate') || '缺日期'}
                  <span style={{ marginLeft: 3, opacity: 0.7, fontSize: 11 }}>
                    ({reasonCounts.missingDate})
                  </span>
                </span>
              ),
              value: 'MISSING_DATE',
            },
            {
              label: (
                <span style={{ fontSize: 12, fontWeight: 500 }}>
                  {t('schedule.filterMissingAssignees') || '缺人員'}
                  <span style={{ marginLeft: 3, opacity: 0.7, fontSize: 11 }}>
                    ({reasonCounts.missingAssignees})
                  </span>
                </span>
              ),
              value: 'MISSING_ASSIGNEES',
            },
            {
              label: (
                <span style={{ fontSize: 12, fontWeight: 500 }}>
                  {t('schedule.filterMissingTime') || '缺時間'}
                  <span style={{ marginLeft: 3, opacity: 0.7, fontSize: 11 }}>
                    ({reasonCounts.missingTime})
                  </span>
                </span>
              ),
              value: 'MISSING_TIME',
            },
          ]}
        />
      </div>

      {/* 待排任務清單容器 */}
      <div
        ref={listContainerRef}
        data-testid="unscheduled-tasks-list"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#8c8c8c' }}>
            {t('common.loading') || '載入中...'}
          </div>
        ) : filteredTasks.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              reasonFilter === 'MISSING_DATE'
                ? '目前沒有缺日期的待排任務'
                : reasonFilter === 'MISSING_ASSIGNEES'
                  ? '目前沒有缺人員的待排任務'
                  : reasonFilter === 'MISSING_TIME'
                    ? '目前沒有缺時間的待排任務'
                    : t('schedule.unscheduledTasksEmpty') || '目前沒有待排任務'
            }
            style={{ margin: '40px 0' }}
          />
        ) : (
          filteredTasks.map((task) => {
            const contentsLabel = task.contents ? formatTaskContents(task.contents, ', ', t) : '-';
            const hasAssignees = Array.isArray(task.assignees) && task.assignees.length > 0;
            const requiredHeadcount = task.headcount || 1;
            const currentAssigneeCount = hasAssignees ? task.assignees.length : 0;
            const isMissingAssignees = currentAssigneeCount < requiredHeadcount;
            const missingCount = Math.max(0, requiredHeadcount - currentAssigneeCount);

            const taskTypeColor = TASK_TYPE_COLORS[task.taskType] || 'default';
            const taskTypeLabel =
              task.taskType === 'CONTRACT'
                ? t('task.contract') || t('schedule.taskTypes.contract') || '合約'
                : task.taskType === 'ONETIME'
                  ? t('task.onetime') || t('schedule.taskTypes.onetime') || '單次'
                  : t('task.esr') || t('schedule.taskTypes.esr') || 'ESR';

            return (
              <Card
                key={task.id}
                data-testid={`unscheduled-task-card-${task.id}`}
                data-task-id={task.id}
                data-task-raw={JSON.stringify(task)}
                size="small"
                className="unscheduled-task-draggable-card"
                style={{
                  cursor: 'grab',
                  borderRadius: 8,
                  border: '1px solid #e8e8e8',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease',
                  backgroundColor: '#ffffff',
                }}
                hoverable
                styles={{
                  body: { padding: '8px 10px' },
                }}
              >
                {/* 第 1 行：集團 · 分店 (粗體) + 類型標籤 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                    marginBottom: 3,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: '#1f1f1f',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1,
                    }}
                    title={`${task.groupName} - ${task.branchName}`}
                  >
                    {task.groupName} · {task.branchName}
                  </div>
                  <Tag
                    color={taskTypeColor}
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      fontSize: 11,
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  >
                    {taskTypeLabel}
                  </Tag>
                </div>

                {/* 第 2 行：日期 + 班次時段 (路線) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12,
                    color: '#595959',
                    marginBottom: 3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <ClockCircleOutlined style={{ color: '#8c8c8c', fontSize: 11, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {task.date ? task.date : '日期未定'} · {task.shift || '未定班次'}{' '}
                    {task.startTime && task.endTime ? `(${task.startTime}~${task.endTime})` : ''}
                    {task.route ? ` · ${task.route}` : ''}
                  </span>
                </div>

                {/* 第 3 行：核心缺額進度 + 施作項目 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                    fontSize: 11,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {isMissingAssignees ? (
                      <span
                        style={{
                          color: '#d4380d',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        ⚠️ 缺 {missingCount} 人 ({currentAssigneeCount}/{requiredHeadcount})
                      </span>
                    ) : (
                      <span
                        style={{
                          color: '#389e0d',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        ✓ 已派齊 ({currentAssigneeCount}/{requiredHeadcount}人)
                      </span>
                    )}
                  </div>
                  {contentsLabel && contentsLabel !== '-' && (
                    <span
                      style={{
                        color: '#8c8c8c',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '55%',
                      }}
                      title={`施作項目: ${contentsLabel}`}
                    >
                      項目: {contentsLabel}
                    </span>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default UnscheduledTasksPanel;
