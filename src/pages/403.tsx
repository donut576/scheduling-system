import type { FC } from 'react';
import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

const ForbiddenPage: FC = () => {
  const navigate = useNavigate();

  return (
    <Result
      status="403"
      title="403"
      subTitle="抱歉，您沒有權限存取此頁面。"
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          返回首頁
        </Button>
      }
    />
  );
};

export default ForbiddenPage;
