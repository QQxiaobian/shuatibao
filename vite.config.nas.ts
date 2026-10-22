import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/**
 * NAS 自托管版本的 Vite 配置
 * - 使用相对路径（base: './'），部署到任何 nginx 子目录都能正常加载
 * - 通过 alias 将 @lark-apaas/client-toolkit-lite JS 模块替换为 nas-shim
 * - CSS 中的 styles.css 通过 resolve.alias 精确替换为空文件
 * - 入口改为 index.nas.tsx（HashRouter）
 */

// 空的 CSS 文件，用于替换 SDK 的 styles.css（NAS 模式不需要平台样式）
const NAS_EMPTY_CSS = path.resolve(__dirname, 'src/lib/nas-empty.css');
if (!fs.existsSync(NAS_EMPTY_CSS)) {
  fs.writeFileSync(NAS_EMPTY_CSS, '/* NAS 自托管模式：不需要平台 SDK 样式 */\n', 'utf8');
}

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
      // CSS 的 styles.css 精确替换（必须放在主 alias 前面，因为 alias 按顺序匹配）
      '@lark-apaas/client-toolkit-lite/styles.css': NAS_EMPTY_CSS,
      // JS/TS 模块替换为 NAS 垫片
      '@lark-apaas/client-toolkit-lite': path.resolve(__dirname, 'src/lib/nas-shim.tsx'),
    },
  },
  build: {
    outDir: 'dist-nas',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index-nas.html'),
      },
    },
  },
});
