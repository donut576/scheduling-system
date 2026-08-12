import { ConfigProvider } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '@/queries/queryClient';
import { router } from '@/routes';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhTW}>
        <RouterProvider router={router} />
      </ConfigProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
