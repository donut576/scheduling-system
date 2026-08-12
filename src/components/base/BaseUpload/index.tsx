import { useState, useCallback } from 'react';
import { Upload, Progress, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps, UploadFile, RcFile } from 'antd/es/upload';

export interface BaseUploadProps {
  /** Upload action URL */
  action: string;
  /** Accepted file types (e.g. '.pdf,.doc,.xlsx') */
  accept?: string;
  /** Allow multiple file selection */
  multiple?: boolean;
  /** Maximum number of files */
  maxCount?: number;
  /** Custom headers for upload request */
  headers?: Record<string, string>;
  /** Callback when file list changes */
  onChange?: (fileList: UploadFile[]) => void;
  /** Callback when upload is complete */
  onSuccess?: (response: unknown, file: UploadFile) => void;
  /** Callback when upload fails */
  onError?: (error: Error, file: UploadFile) => void;
  /** Whether to show upload list */
  showUploadList?: boolean;
  /** Custom hint text */
  hint?: string;
  /** Whether the upload is disabled */
  disabled?: boolean;
}

const { Dragger } = Upload;

/**
 * Max file size in bytes, read from environment variable.
 * VITE_UPLOAD_MAX_SIZE is stored in bytes (default 10485760 = 10MB).
 */
function getMaxFileSize(): number {
  const envValue = import.meta.env.VITE_UPLOAD_MAX_SIZE;
  if (envValue) {
    const parsed = Number(envValue);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  // Default: 10MB in bytes
  return 10 * 1024 * 1024;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function BaseUpload({
  action,
  accept,
  multiple = false,
  maxCount = 1,
  headers,
  onChange,
  onSuccess,
  onError,
  showUploadList = true,
  hint,
  disabled = false,
}: BaseUploadProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const maxSize = getMaxFileSize();

  const beforeUpload = useCallback(
    (file: RcFile): boolean | typeof Upload.LIST_IGNORE => {
      if (file.size > maxSize) {
        message.error(`檔案「${file.name}」超過大小限制（最大 ${formatFileSize(maxSize)}）`);
        return Upload.LIST_IGNORE;
      }
      return true;
    },
    [maxSize],
  );

  const handleChange: UploadProps['onChange'] = useCallback(
    (info: { file: UploadFile; fileList: UploadFile[] }) => {
      const { file, fileList: newFileList } = info;

      setFileList(newFileList);
      onChange?.(newFileList);

      // antd/rc-upload tracks per-file upload percentage on `file.percent`
      // as the default XHR request emits progress events, so we mirror it
      // into local state to drive the progress bar below without needing
      // a separate onProgress prop (which does not exist on UploadProps).
      if (typeof file.percent === 'number') {
        setUploadProgress((prev) => ({
          ...prev,
          [file.uid]: Math.round(file.percent ?? 0),
        }));
      }

      if (file.status === 'done') {
        onSuccess?.(file.response, file);
      } else if (file.status === 'error') {
        onError?.(new Error(file.error?.message || '上傳失敗'), file);
      }
    },
    [onChange, onSuccess, onError],
  );

  const uploadProps: UploadProps = {
    action,
    accept,
    multiple,
    maxCount,
    headers,
    fileList,
    showUploadList,
    disabled,
    beforeUpload,
    onChange: handleChange,
  };

  const defaultHint = `支援的檔案大小上限：${formatFileSize(maxSize)}`;

  return (
    <div>
      <Dragger {...uploadProps}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">點擊或拖曳檔案至此區域上傳</p>
        <p className="ant-upload-hint">{hint || defaultHint}</p>
      </Dragger>

      {Object.entries(uploadProgress).map(([uid, percent]) => {
        const file = fileList.find((f) => f.uid === uid);
        if (!file || file.status === 'done' || file.status === 'error') {
          return null;
        }
        return (
          <div key={uid} style={{ marginTop: 8 }}>
            <span style={{ fontSize: 12, color: '#666' }}>{file.name}</span>
            <Progress percent={percent} size="small" />
          </div>
        );
      })}
    </div>
  );
}

export default BaseUpload;
