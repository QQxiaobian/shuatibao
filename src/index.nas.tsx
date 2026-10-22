import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { AppContainer, ErrorRender } from '@/lib/nas-shim';
import App from './app';
import './index.css';

/**
 * NAS 自托管版本入口
 * - 使用 HashRouter，刷新不会 404，不需要 nginx try_files
 * - 通过 vite alias 将 @lark-apaas/client-toolkit-lite 替换为 nas-shim
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AppContainer>
        <ErrorBoundary
          fallbackRender={({ error, resetErrorBoundary }) => (
            <ErrorRender error={error} resetErrorBoundary={resetErrorBoundary} />
          )}
        >
          <App />
        </ErrorBoundary>
      </AppContainer>
    </HashRouter>
  </StrictMode>,
);
