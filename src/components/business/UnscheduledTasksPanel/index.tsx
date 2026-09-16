import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Empty, Input, Space, Tag, Tooltip } from 'antd';
import { LeftOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import { Draggable } from '@fullcalendar/interaction';
import { useTranslation } from 'react-i18next';
import { useTaskList } from '@/queries/useTaskQueries';
import { useCustomerGroups } from '@/queries/useCustomerQueries';
import { useUserStore } from '@/stores/useUserStore';
import { isAddressInRegion, normalizeRegion } from '@/utils/regionMapping';
import type { Task, TaskType } from '@/types/task';

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
  dimension?: 'overview' | 'customer' | 'employee';
  viewMode?: 'day' | 'week' | 'month';
}

const TASK_TYPE_COLORS: Record<TaskType, string> = {
  CONTRACT: 'blue',
  ONETIME: 'green',
  ESR: 'volcano',
};

/**
 * 待排任務面板 (UnscheduledTasksPanel)
 *
 * 呈現未排班（status = 'UNSCHEDULED'）之任務清單，
 * 支援依當前行事曆情境（視圖與維度）自動情境過濾（缺日期/缺時段/缺人員）與關鍵字搜尋。
 * 整合 FullCalendar Draggable，使卡片可直接拖曳至日曆上完成排班，
 * 並支援將已排程任務直接拖出至面板移回待排。
 * 同時支援左側邊界拖曳調整寬度與拉動收合。
 */
export const UnscheduledTasksPanel: React.FC<UnscheduledTasksPanelProps> = ({
  collapsed = false,
  onToggleCollapse,
  onEditTask,
  onDragStartTask,
  onDragEndTask,
  isDropActive = false,
  width: controlledWidth,
  onWidthChange,
  className = '',
  style,
  dimension: _dimension = 'overview',
  viewMode: _viewMode = 'month',
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

  const [keyword, setKeyword] = useState<string>('');
  const user = useUserStore((state) => state.user);
  const isLeader = user?.role === 'LEADER';
  const leaderArea = useMemo(() => {
    if (!isLeader) return undefined;
    return normalizeRegion((user as unknown as { area?: string })?.area || user?.groupId);
  }, [isLeader, user]);

  const { data: customerGroupsData } = useCustomerGroups();
  const customerGroups = useMemo(() => customerGroupsData ?? [], [customerGroupsData]);

  // 查詢待排任務（組長模式下僅撈取所屬責任轄區）
  const { data: taskData, isLoading } = useTaskList({
    status: 'UNSCHEDULED',
    pageSize: 100,
    area: isLeader ? leaderArea : undefined,
  });

  const rawTasks = useMemo(() => taskData?.list ?? [], [taskData?.list]);

  // 本地篩選任務清單（組長模式下嚴格限定所屬責任轄區，並支援關鍵字搜尋）
  const filteredTasks = useMemo(() => {
    let result = rawTasks;

    // 若為組長，嚴格過濾僅保留所屬責任轄區（或經理跨區指派至該轄區）之任務
    if (isLeader && leaderArea) {
      result = result.filter((task) => {
        const branch = customerGroups
          .flatMap((g) => g.branches)
          .find((b) => b.id === task.branchId);
        const addr = branch?.address || '';
        const name = branch?.name || task.branchName || task.groupName;
        const designated =
          (branch as unknown as { designatedRegion?: string })?.designatedRegion ||
          (task as unknown as { designatedRegion?: string })?.designatedRegion;

        return isAddressInRegion(addr || name, leaderArea, designated);
      });
    }

    // 關鍵字搜尋
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
  }, [customerGroups, isLeader, keyword, leaderArea, rawTasks]);

  // 面板標頭顯示資訊（標題、代表色彩與總數量）
  const contextLabel = useMemo(() => {
    return {
      title: t('schedule.unscheduledTasks') || '待排任務清單',
      badgeColor: '#1677ff',
      count: filteredTasks.length,
      desc: '拖曳卡片至員工時間軸空檔，即可直接排班',
    };
  }, [filteredTasks.length, t]);

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
            {contextLabel.title}
          </span>
          <Badge
            count={contextLabel.count}
            overflowCount={99}
            style={{
              backgroundColor: contextLabel.badgeColor,
            }}
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

      {/* 搜尋列 */}
      <div
        style={{
          padding: '10px 12px 6px 12px',
          borderBottom: '1px solid #f0f0f0',
          backgroundColor: '#fafafa',
        }}
      >
        <Input
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder={t('schedule.searchUnscheduledPlaceholder') || '搜尋待排任務...'}
          allowClear
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          size="small"
          style={{ width: '100%', borderRadius: 6, marginBottom: 6 }}
        />
        <div style={{ fontSize: 11, color: '#0958d9', paddingLeft: 2 }}>
          💡 拖曳待排卡片至左側班表，即可快速排班
        </div>
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
          <div
            style={{
              padding: '32px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{ color: '#8c8c8c', fontSize: 13 }}>
                  {keyword
                    ? t('schedule.noSearchResults') || '無符合搜尋條件之任務'
                    : `當前視角暫無${contextLabel.title}`}
                </span>
              }
              style={{ margin: '32px 0' }}
            />
          </div>
        ) : (
          filteredTasks.map((task) => {
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
                onClick={() => onEditTask?.(task)}
                style={{
                  cursor: 'pointer',
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
                    marginBottom: 5,
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
                  <Space size={4} style={{ flexShrink: 0 }}>
                    {task.isMakeup && (
                      <Tag
                        color="warning"
                        style={{
                          margin: 0,
                          fontWeight: 600,
                          fontSize: 11,
                          borderRadius: 4,
                        }}
                      >
                        補做{task.originalDate ? ` (原 ${task.originalDate.slice(5)})` : ''}
                      </Tag>
                    )}
                    <Tag
                      color={taskTypeColor}
                      style={{
                        margin: 0,
                        fontWeight: 600,
                        fontSize: 11,
                        borderRadius: 4,
                      }}
                    >
                      {taskTypeLabel}
                    </Tag>
                  </Space>
                </div>

                {/* 第 2 行：缺項 Labels（缺日期 / 缺時段 / 缺人員） */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    flexWrap: 'wrap',
                  }}
                >
                  {!task.date ? (
                    <Tag
                      color="orange"
                      style={{
                        margin: 0,
                        fontSize: 11,
                        lineHeight: '20px',
                        padding: '0 6px',
                        fontWeight: 600,
                        borderRadius: 4,
                      }}
                    >
                      📅 待排日期
                    </Tag>
                  ) : (
                    <span style={{ fontSize: 12, color: '#595959', fontWeight: 500 }}>
                      {task.date}
                    </span>
                  )}

                  {!task.startTime || !task.endTime ? (
                    <Tag
                      color="purple"
                      style={{
                        margin: 0,
                        fontSize: 11,
                        lineHeight: '20px',
                        padding: '0 6px',
                        fontWeight: 600,
                        borderRadius: 4,
                      }}
                    >
                      ⏰ 待定時段
                    </Tag>
                  ) : (
                    <span style={{ fontSize: 12, color: '#595959' }}>
                      · {task.shift || ''} ({task.startTime}~{task.endTime})
                    </span>
                  )}

                  {isMissingAssignees ? (
                    <Tag
                      color="red"
                      style={{
                        margin: 0,
                        fontWeight: 600,
                        fontSize: 11,
                        lineHeight: '20px',
                        padding: '0 6px',
                        borderRadius: 4,
                      }}
                    >
                      ⚠️ 缺 {missingCount} 人 ({currentAssigneeCount}/{requiredHeadcount})
                    </Tag>
                  ) : (
                    <Tag
                      color="green"
                      style={{
                        margin: 0,
                        fontWeight: 600,
                        fontSize: 11,
                        lineHeight: '20px',
                        padding: '0 6px',
                        borderRadius: 4,
                      }}
                    >
                      ✓ 人員已齊 ({currentAssigneeCount}/{requiredHeadcount})
                    </Tag>
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
