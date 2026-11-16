/** 儀表板卡片共用的小元件與常數 */
import React from 'react';
import { Modal, Typography } from 'antd';
import {
  ClockCircleOutlined,
  CloseOutlined,
  FileProtectOutlined,
  InfoCircleOutlined,
  TagOutlined,
} from '@ant-design/icons';
import { contentLabel, formatMD, hasValue, hexToTint, TASK_TYPE_LABEL } from './sharedUtils';
import { designTokens } from '@/styles/tokens';

const { Text } = Typography;

/** 卡片標題旁的紅圈未讀數（超過 99 顯示 99+）；0 不顯示 */
export const UnreadCount: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <span
      data-testid="unread-count"
      aria-label={`${count} 則未讀`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        marginLeft: 8,
        borderRadius: 9,
        background: '#ff4d4f',
        color: '#fff',
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
};

/** 未讀藍點 */
export const UnreadDot: React.FC = () => (
  <span
    data-testid="unread-dot"
    style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: designTokens.colors.primary,
      flex: 'none',
    }}
  />
);

/** 列左上角的未讀位置：固定占 8px，已讀時留白，讓已讀／未讀的內容左緣對齊 */
export const UnreadSlot: React.FC<{ unread: boolean }> = ({ unread }) => (
  <span style={{ display: 'inline-flex', width: 8, flex: 'none' }}>{unread && <UnreadDot />}</span>
);

/** 右側小灰時間 */
export const TimeText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
    {children}
  </Text>
);

/** 詳細視窗的「標籤：值」列；值為空就不顯示（非必填欄位沒填就隱藏） */
export interface KvRow {
  label: string;
  value?: React.ReactNode;
  /** 修改任務時標示此欄位已修改 */
  changed?: boolean;
}

export const KvList: React.FC<{ rows: KvRow[] }> = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr', rowGap: 10, columnGap: 8 }}>
    {rows
      .filter((r) => hasValue(r.value))
      .map((r) => (
        <React.Fragment key={r.label}>
          <Text type="secondary">{r.label}</Text>
          <div>
            {r.value}
            {r.changed && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  color: '#d46b08',
                  background: '#fff7e6',
                  border: '1px solid #ffd591',
                  borderRadius: 4,
                  padding: '0 4px',
                }}
              >
                已修改
              </span>
            )}
          </div>
        </React.Fragment>
      ))}
  </div>
);

/** 列表第二行：日期 時間 集團 · 分店（彈性任務時間位置顯示「彈性」），後面可接內容標籤 */
export const TaskLine: React.FC<{
  date: string;
  time?: string;
  flexible?: boolean;
  groupName: string;
  branchName: string;
  children?: React.ReactNode;
}> = ({ date, time, flexible, groupName, branchName, children }) => (
  <div className="dash-task-line">
    <span className="dash-tl-date">{formatMD(date)}</span>
    <span className="dash-tl-time">{flexible ? '彈性' : time}</span>
    <Text strong>
      {groupName} · {branchName}
    </Text>
    {children}
  </div>
);

/** 修改任務：原本內容（淺灰＋刪除線；想只留淺灰就刪掉 .dash-old 的 text-decoration） */
export const OldValue: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="dash-old" data-testid="old-value">
    原：{children}
  </div>
);

/** 「內容」標籤（P、白蟻…）：白底、細灰邊的小方標籤，與「類別」膠囊區分；傳入代碼即可，內部轉成顯示文字 */
export const ContentTag: React.FC<{ children: string }> = ({ children }) => (
  <span className="dash-ctag">{contentLabel(children)}</span>
);

/** 詳細視窗上方：任務類型｜任務內容（圖示放白色圓底，字不放大；多個內容用頓號連在一起） */
export const TypeContentLine: React.FC<{
  taskType?: string;
  contents: string[];
  accent: string;
}> = ({ taskType, contents, accent }) => {
  if (!taskType && contents.length === 0) return null;
  const item = (icon: React.ReactNode, text: string, testId: string) => (
    <span className="dash-tc-item" data-testid={testId}>
      <span className="dash-tc-ic" style={{ color: accent }}>
        {icon}
      </span>
      {text}
    </span>
  );
  return (
    <div className="dash-tc">
      {taskType &&
        item(<FileProtectOutlined />, TASK_TYPE_LABEL[taskType] ?? taskType, 'task-type')}
      {taskType && contents.length > 0 && <span className="dash-tc-sep" />}
      {contents.length > 0 &&
        item(<TagOutlined />, contents.map(contentLabel).join('、'), 'task-contents')}
    </div>
  );
};

/** 「類別」膠囊（新增／修改／取消、任務・客戶…）：淡色底＋icon 的全圓膠囊 */
export const CatPill: React.FC<{
  icon?: React.ReactNode;
  color: string;
  children: React.ReactNode;
}> = ({ icon, color, children }) => (
  <span className="dash-cat" style={{ color, background: hexToTint(color, 0.1) }}>
    {icon}
    {children}
  </span>
);

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

/** 日期塊：月／日／週（caption 有值時，週改顯示 caption，例如「到期」）；固定 56×56，與時間塊同高 */
export const DateBlock: React.FC<{ date: string; color: string; caption?: string }> = ({
  date,
  color,
  caption,
}) => {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  const wd = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return (
    <div
      className="dash-block"
      style={{ background: hexToTint(color, 0.12), color }}
      data-testid="date-block"
    >
      <span className="dash-block-s">{m}月</span>
      <span className="dash-block-n">{String(d).padStart(2, '0')}</span>
      <span className="dash-block-s">{caption ?? `週${wd}`}</span>
    </div>
  );
};

/** 時間塊：固定時間寫 HHmm（不加冒號）；彈性任務＝虛線框＋時鐘＋「彈性」；底色用 color 的淡色。固定 56×56 */
export const TimeBlock: React.FC<{ time?: string | null; flexible?: boolean; color: string }> = ({
  time,
  flexible,
  color,
}) => (
  <div
    className={flexible ? 'dash-block dash-block-flex' : 'dash-block'}
    style={{ background: hexToTint(color, 0.16) }}
    data-testid="time-block"
  >
    {flexible ? (
      <>
        <ClockCircleOutlined style={{ fontSize: 17 }} />
        <span className="dash-block-s">彈性</span>
      </>
    ) : (
      <span className="dash-block-n">{time ?? '—'}</span>
    )}
  </div>
);

/** 沒有日期可放時的圖示塊（例如寄給主任的證照信），尺寸與日期塊相同 */
export const IconBlock: React.FC<{ icon: React.ReactNode; color: string }> = ({ icon, color }) => (
  <div className="dash-block" style={{ background: hexToTint(color, 0.12), color, fontSize: 20 }}>
    {icon}
  </div>
);

/** 「已修改」小標籤（修改任務詳細用） */
export const ChangedTag: React.FC = () => (
  <span
    style={{
      marginLeft: 8,
      fontSize: 11,
      fontWeight: 400,
      color: '#d46b08',
      background: '#fff7e6',
      border: '1px solid #ffd591',
      borderRadius: 4,
      padding: '0 4px',
      whiteSpace: 'nowrap',
    }}
  >
    已修改
  </span>
);

/** 摘要區的膠囊標籤 */
export const Pill: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({
  icon,
  children,
}) => (
  <span className="dash-pill">
    {icon}
    {children}
  </span>
);

/** 摘要區的資訊卡（日期、開始時間…） */
export const InfoTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent: string;
  changed?: boolean;
  /** 修改任務時的原本內容（淺灰＋刪除線，放在新值下方） */
  oldValue?: React.ReactNode;
}> = ({ icon, label, value, accent, changed, oldValue }) => (
  <div className="dash-tile">
    <span style={{ fontSize: 20, color: accent, display: 'inline-flex' }}>{icon}</span>
    <div style={{ minWidth: 0 }}>
      <div className="dash-lb">{label}</div>
      <div className="dash-vl" style={{ fontWeight: 600 }}>
        {value}
        {changed && <ChangedTag />}
      </div>
      {changed && hasValue(oldValue) && <OldValue>{oldValue}</OldValue>}
    </div>
  </div>
);

/** 彈性任務說明條：放在摘要區資訊卡下方（通常是彈性的原因，自由填寫，可能很長） */
export const FlexNote: React.FC<{
  accent: string;
  changed?: boolean;
  children: React.ReactNode;
}> = ({ accent, changed, children }) => (
  <div className="dash-flex-note" style={{ borderColor: accent }} data-testid="flex-note">
    <InfoCircleOutlined style={{ fontSize: 17, color: accent, marginTop: 1 }} />
    <div style={{ minWidth: 0 }}>
      <div className="dash-lb" style={{ marginBottom: 0 }}>
        彈性說明
        {changed && <ChangedTag />}
      </div>
      <div className="dash-vl" style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
        {children}
      </div>
    </div>
  </div>
);

/** 欄位（標籤在上、值在下） */
export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div style={{ minWidth: 0 }}>
    <div className="dash-lb">{label}</div>
    <div className="dash-vl">{children}</div>
  </div>
);

/** 詳細視窗的分區：區塊標籤前放小 icon（13px 灰），內容在下方；內容為空就不要渲染這一區 */
export const DetailSection: React.FC<{
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}> = ({ icon, label, children }) => (
  <div className="dash-sec">
    <div className="dash-lb dash-lb-ic">
      <span className="dash-lbi">{icon}</span>
      {label}
    </div>
    <div className="dash-vl">{children}</div>
  </div>
);

/**
 * 各角色共用的詳細視窗外框：
 * 上方摘要區（底色 = accent 的淡色 + 頂部色條）放標題、標籤、資訊卡；下方放分區列表。
 * 父層「要開才掛載」即可，這裡固定 open。
 */
export const DetailModal: React.FC<{
  accent: string;
  kicker: React.ReactNode;
  title: React.ReactNode;
  chips?: React.ReactNode;
  tiles?: React.ReactNode;
  note?: React.ReactNode;
  onClose: () => void;
  children?: React.ReactNode;
}> = ({ accent, kicker, title, chips, tiles, note, onClose, children }) => (
  <Modal
    open
    onCancel={onClose}
    footer={null}
    closable={false}
    width={520}
    styles={{ content: { padding: 0, overflow: 'hidden' }, body: { padding: 0 } }}
  >
    <div
      style={{
        background: hexToTint(accent, 0.14),
        borderTop: `4px solid ${accent}`,
        padding: '18px 20px 24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <Text style={{ fontSize: 12, color: '#595959' }}>{kicker}</Text>
        <button type="button" className="dash-nav-btn" aria-label="關閉" onClick={onClose}>
          <CloseOutlined />
        </button>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5, color: '#262626' }}>
        {title}
      </div>
      {chips && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>{chips}</div>
      )}
      {tiles && <div className="dash-tiles">{tiles}</div>}
      {note}
    </div>
    <div style={{ padding: '8px 20px 20px' }}>{children}</div>
  </Modal>
);
