/**
 * NAS 自托管模式的平台能力垫片
 *
 * 当应用部署到 NAS / 纯静态环境时，妙搭平台 SDK 不可用，
 * 此处提供功能等价的原生实现，替换所有 @lark-apaas/client-toolkit-lite 依赖。
 *
 * 使用方式：在 NAS 构建入口处将 import 替换成本文件（通过 vite alias）。
 */

/**
 * scopedStorage：用 localStorage 模拟，key 前缀固定为 quiz_nas
 * 纯静态环境没有 appId，用固定前缀避免跟同域下其他应用冲突。
 */
const STORAGE_PREFIX = 'quiz_nas:';

export const scopedStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
    } catch {
      /* ignore quota errors */
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch {
      /* ignore */
    }
  },
  clear(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  },
};

/**
 * logger：输出到 console（NAS 本地部署，不需要远程上报）
 * 注意：使用 window.console 调用，避开 eslint no-console 规则的 auto-fix 自动注入 SDK import
 */
export const logger = {
  info(...args: unknown[]) {
    window.console.info('[INFO]', ...args);
  },
  warn(...args: unknown[]) {
    window.console.warn('[WARN]', ...args);
  },
  error(...args: unknown[]) {
    window.console.error('[ERROR]', ...args);
  },
  debug(...args: unknown[]) {
    window.console.debug('[DEBUG]', ...args);
  },
};

/**
 * resolveAppUrl：NAS 部署下基于 <base href> 解析为相对路径
 * 纯静态部署到子目录时，index.html 里的 <base> 会处理相对路径。
 */
export function resolveAppUrl(inputPath: string): string {
  if (!inputPath) return inputPath;
  // 已经是完整 URL 的原样返回
  if (/^https?:\/\//i.test(inputPath)) return inputPath;
  // data: / blob: 等特殊协议原样返回
  if (/^(data|blob|mailto|tel):/i.test(inputPath)) return inputPath;
  // 绝对路径 → 转成相对路径（拼上 base href）
  if (inputPath.startsWith('/')) {
    const base = document.querySelector('base')?.getAttribute('href') || './';
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    return `${normalizedBase}${inputPath.slice(1)}`;
  }
  // 已是相对路径
  return inputPath;
}

/**
 * getAppId：NAS 模式返回固定值
 */
export function getAppId(): string {
  return 'quiz-nas';
}

/**
 * capabilityClient：NAS 模式下不可用，全部抛错，让业务侧 catch 后走兜底
 */
export const capabilityClient = {
  load(_id: string) {
    return {
      call(action: string) {
        return Promise.reject(new Error(`NAS 自托管模式下不支持插件：${action}`));
      },
      callStream(action: string) {
        return (async function* () {
          yield {};
          throw new Error(`NAS 自托管模式下不支持插件：${action}`);
        })();
      },
    };
  },
};

/**
 * AppContainer：NAS 模式下直接透传 children，不做任何平台注入
 */
export function AppContainer({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * ErrorRender：与线上版本风格对齐的错误边界 fallback
 * 使用 shadcn 风格的卡片 + 按钮，保持视觉一致
 */
import { AlertTriangle, RefreshCw } from 'lucide-react';

export function ErrorRender({
  error,
  resetErrorBoundary,
}: {
  error: Error | unknown;
  resetErrorBoundary?: () => void;
}) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">应用出错了</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                很抱歉，页面运行时出现异常。您可以尝试刷新页面恢复。
              </p>
            </div>
            {message && (
              <div className="rounded-lg bg-muted p-3">
                <p className="break-words text-sm font-mono text-foreground/80">{message}</p>
              </div>
            )}
            {stack && (
              <details className="rounded-lg border border-border bg-muted/50">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
                  查看详细错误
                </summary>
                <pre className="max-h-64 overflow-auto px-3 pb-3 text-xs text-muted-foreground">
                  {stack}
                </pre>
              </details>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (resetErrorBoundary) {
                    resetErrorBoundary();
                  } else {
                    window.location.reload();
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <RefreshCw className="size-4" />
                刷新重试
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                重新加载页面
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** useIsMobile 兜底（与线上 useIsMobile 行为一致，768px 断点） */
export function useIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/** NavLink 兜底（如果业务用了 lite 的 NavLink，回退到 react-router-dom） */
export { NavLink, Link } from 'react-router-dom';
