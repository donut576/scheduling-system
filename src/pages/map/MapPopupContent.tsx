import type { FC } from 'react';
import { Button } from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { Customer } from '@/types/customer';
import type { Task } from '@/types/task';
import { hexToTint } from '../dashboard/sharedUtils';
import { formatMonthDayWeek } from '../dashboard/personalTasks';
import { TypeContentLine } from '../dashboard/shared';
import '../dashboard/dashboardCards.css';
import './mapPopup.css';

export interface MapPopupContentProps {
  customer: Customer;
  tasks: Task[];
  /** 標記顏色（和圓點同色，用在頂部色條與淡色底） */
  accent: string;
  /** 是否顯示「編輯」按鈕 */
  canEdit?: boolean;
  onEditTask?: (task: Task) => void;
}

const timeText = (task: Task): string => {
  if (task.timeMode === 'FLEXIBLE') return '彈性';
  if (!task.startTime) return task.timeRemark || '—';
  return task.endTime ? `${task.startTime}–${task.endTime}` : task.startTime;
};

/** 地圖標記點開後的視窗：樣式比照 dashboard「任務詳細」（色條＋淡底、日期時間區塊、同仁頭貼） */
const MapPopupContent: FC<MapPopupContentProps> = ({
  customer,
  tasks,
  accent,
  canEdit,
  onEditTask,
}) => {
  const contact = customer.contactName
    ? `${customer.contactName}${customer.contactPhone ? `\u3000${customer.contactPhone}` : ''}`
    : undefined;

  return (
    <div
      className="map-popup"
      data-testid={`map-popup-${customer.id}`}
      style={{ borderTopColor: accent }}
    >
      <div className="map-popup-head" style={{ background: hexToTint(accent, 0.14) }}>
        <div className="map-popup-title">
          {customer.groupName} · {customer.branchName}
        </div>
        <div className="map-popup-addr">
          <EnvironmentOutlined /> {customer.address}
        </div>
        <span className="map-popup-count">此時段 {tasks.length} 項任務</span>
      </div>

      <div className="map-popup-body" data-testid={`map-popup-tasks-${customer.id}`}>
        {tasks.map((task) => (
          <div key={task.id} className="map-popup-task" data-testid={`map-popup-task-${task.id}`}>
            <div className="map-popup-line">
              <span className="map-popup-tile" style={{ background: hexToTint(accent, 0.1) }}>
                <CalendarOutlined style={{ color: accent }} /> {formatMonthDayWeek(task.date)}
              </span>
              <span className="map-popup-tile" style={{ background: hexToTint(accent, 0.1) }}>
                <ClockCircleOutlined style={{ color: accent }} /> {timeText(task)}
              </span>
              {canEdit && (
                <Button
                  size="small"
                  type="link"
                  icon={<EditOutlined />}
                  className="map-popup-edit"
                  data-testid={`map-popup-edit-${task.id}`}
                  onClick={() => onEditTask?.(task)}
                >
                  編輯
                </Button>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              <TypeContentLine taskType={task.taskType} contents={task.contents} accent={accent} />
            </div>
            {task.assignees.length > 0 && (
              <div className="dash-tc" style={{ marginTop: 8 }}>
                <span className="dash-tc-item" data-testid={`map-popup-assignees-${task.id}`}>
                  <span className="dash-tc-ic" style={{ color: accent }}>
                    <TeamOutlined />
                  </span>
                  {task.assignees.map((a) => a.employeeName).join('、')}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {contact && (
        <div className="map-popup-foot" data-testid={`map-popup-contact-${customer.id}`}>
          <PhoneOutlined /> 聯絡窗口{'\u3000'}
          {contact}
        </div>
      )}
    </div>
  );
};

export default MapPopupContent;
