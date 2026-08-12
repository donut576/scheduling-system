import type { FC } from 'react';
import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * 403 無權限頁面
 * 當使用者存取未授權之路由時顯示，提供返回首頁按鈕。
 */
const ForbiddenPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Result
      status="403"
      title="403"
      subTitle={t('error.forbiddenSubtitle')}
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          {t('error.backHome')}
        </Button>
      }
    />
  );
};

export default ForbiddenPage;
