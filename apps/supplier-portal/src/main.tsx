import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { foundationTheme } from '@fulishe/ui';

import { SupplierPortalShell } from './app.js';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('SUPPLIER_PORTAL_ROOT_MISSING');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={{ token: foundationTheme }}>
        <SupplierPortalShell />
      </ConfigProvider>
    </QueryClientProvider>
  </StrictMode>,
);
