/**
 * BaseModal - 通用彈出視窗元件
 *
 * 封裝 antd 的 Modal，提供一致的確認/取消行為，並自動處理 onOk 為非同步函式時
 * 的載入狀態（confirmLoading），避免每個使用情境都要自行管理 loading state。
 * 適用於各業務模組中需要彈窗確認、表單提交等場景。
 */
import { useState, useCallback, type ReactNode } from 'react';
import { Modal } from 'antd';

export interface BaseModalProps {
  /** 彈窗標題 */
  title: string;
  /** 是否顯示彈窗 */
  open: boolean;
  /** 點擊確認按鈕時的處理函式，可回傳 Promise 以自動觸發載入中狀態 */
  onOk: () => Promise<void> | void;
  /** 點擊取消按鈕或關閉彈窗時的處理函式 */
  onCancel: () => void;
  /** 外部傳入的載入狀態（會與內部的 confirmLoading 取 OR） */
  loading?: boolean;
  /** 彈窗寬度，可為數字（px）或字串（例如百分比） */
  width?: number | string;
  /** 彈窗內容 */
  children: ReactNode;
}

const DEFAULT_WIDTH = 520;

function BaseModal({
  title,
  open,
  onOk,
  onCancel,
  loading = false,
  width = DEFAULT_WIDTH,
  children,
}: BaseModalProps) {
  // 內部管理的載入狀態，用於追蹤 onOk 回傳的 Promise 是否尚未完成
  const [confirmLoading, setConfirmLoading] = useState(false);

  // 只要外部 loading 或內部 confirmLoading 任一為 true，即視為載入中
  const isLoading = loading || confirmLoading;

  const handleOk = useCallback(async () => {
    const result = onOk();

    // 判斷 onOk 是否回傳 Promise，若是則自動顯示載入狀態，
    // 直到 Promise 完成（無論成功或失敗）才恢復
    if (result instanceof Promise) {
      setConfirmLoading(true);
      try {
        await result;
      } catch {
        // 錯誤處理交由呼叫端（onOk 實作者）自行負責，此處僅確保 loading 狀態被清除
      } finally {
        setConfirmLoading(false);
      }
    }
  }, [onOk]);

  return (
    <Modal
      title={title}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={isLoading}
      width={width}
      cancelButtonProps={{ disabled: isLoading }}
      // 載入中時停用遮罩點擊關閉、右上角關閉鈕與 ESC 鍵關閉，避免操作中被意外中斷
      maskClosable={!isLoading}
      closable={!isLoading}
      keyboard={!isLoading}
      destroyOnHidden
    >
      {children}
    </Modal>
  );
}

export default BaseModal;
