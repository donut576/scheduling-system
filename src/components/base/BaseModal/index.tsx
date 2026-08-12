import { useState, useCallback, type ReactNode } from 'react';
import { Modal } from 'antd';

export interface BaseModalProps {
  title: string;
  open: boolean;
  onOk: () => Promise<void> | void;
  onCancel: () => void;
  loading?: boolean;
  width?: number | string;
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
  const [confirmLoading, setConfirmLoading] = useState(false);

  const isLoading = loading || confirmLoading;

  const handleOk = useCallback(async () => {
    const result = onOk();

    if (result instanceof Promise) {
      setConfirmLoading(true);
      try {
        await result;
      } catch {
        // Error handling is the caller's responsibility
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
