/**
 * BaseUpload - 通用檔案上傳元件
 *
 * 封裝 antd 的 Upload.Dragger（拖曳上傳區），加入檔案大小上限檢查（透過環境變數
 * 設定）、上傳進度顯示、以及成功/失敗回呼。適用於各業務模組中需要上傳附件、
 * 文件等檔案的場景。
 */
import { useState, useCallback } from 'react';
import { Upload, Progress, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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
 * 取得檔案大小上限（單位：位元組），數值來源於環境變數。
 * VITE_UPLOAD_MAX_SIZE 以位元組儲存（預設 10485760，即 10MB）。
 */
function getMaxFileSize(): number {
  const envValue = import.meta.env.VITE_UPLOAD_MAX_SIZE;
  if (envValue) {
    const parsed = Number(envValue);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  // 預設值：10MB（以位元組表示）
  return 10 * 1024 * 1024;
}

// 將位元組數格式化為人類可讀的檔案大小字串（B / KB / MB）
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
  const { t } = useTranslation();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  // 記錄每個檔案（依 uid）目前的上傳進度百分比，用於顯示 Progress 條
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const maxSize = getMaxFileSize();

  // 在檔案實際開始上傳前進行大小檢查，超過上限則以 LIST_IGNORE 阻止該檔案加入清單
  const beforeUpload = useCallback(
    (file: RcFile): boolean | typeof Upload.LIST_IGNORE => {
      if (file.size > maxSize) {
        message.error(t('upload.fileTooLarge', { name: file.name, max: formatFileSize(maxSize) }));
        return Upload.LIST_IGNORE;
      }
      return true;
    },
    [maxSize, t],
  );

  const handleChange: UploadProps['onChange'] = useCallback(
    (info: { file: UploadFile; fileList: UploadFile[] }) => {
      const { file, fileList: newFileList } = info;

      setFileList(newFileList);
      onChange?.(newFileList);

      // antd/rc-upload 在預設的 XHR 上傳請求觸發 progress 事件時，會將每個檔案的
      // 上傳百分比記錄在 file.percent 上，因此這裡將其鏡射到本地狀態，
      // 用來驅動下方的進度條顯示，而不需要額外的 onProgress prop
      // （UploadProps 本身並沒有提供這個屬性）。
      if (typeof file.percent === 'number') {
        setUploadProgress((prev) => ({
          ...prev,
          [file.uid]: Math.round(file.percent ?? 0),
        }));
      }

      if (file.status === 'done') {
        onSuccess?.(file.response, file);
      } else if (file.status === 'error') {
        onError?.(new Error(file.error?.message || t('upload.failed')), file);
      }
    },
    [onChange, onSuccess, onError, t],
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

  const defaultHint = t('upload.sizeLimitHint', { max: formatFileSize(maxSize) });

  return (
    <div>
      <Dragger {...uploadProps}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{t('upload.dragText')}</p>
        <p className="ant-upload-hint">{hint || defaultHint}</p>
      </Dragger>

      {/* 逐一渲染每個仍在上傳中的檔案進度條；已完成或失敗的檔案交由 antd 自帶的
          上傳清單（showUploadList）顯示狀態，故此處略過不重複顯示 */}
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
