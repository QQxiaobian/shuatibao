#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="$ROOT/dist-nas"

echo "开始构建 NAS 自托管版本..."
echo "  输出目录: $OUTPUT"

# 清理
rm -rf "$OUTPUT"

# 使用 NAS 配置构建（base: './' + HashRouter + 平台SDK垫片）
npx vite build --config vite.config.nas.ts

# vite 会把 index-nas.html 输出为 index-nas.html，重命名为 index.html
if [ -f "$OUTPUT/index-nas.html" ]; then
  mv "$OUTPUT/index-nas.html" "$OUTPUT/index.html"
fi

# 复制部署说明
cp "$ROOT/NAS_DEPLOY.md" "$OUTPUT/README.md" 2>/dev/null || true

# 打 zip 包（方便下载分发）
ZIP_NAME="quiz-nas-static.zip"
cd "$ROOT"
if command -v zip >/dev/null 2>&1; then
  cd dist-nas && zip -r "../$ZIP_NAME" . >/dev/null && cd ..
  echo ""
  echo "打包完成: $ROOT/$ZIP_NAME"
else
  echo ""
  echo "[提示] 未检测到 zip 命令，跳过打包。可用以下命令手动打包："
  echo "  cd dist-nas && zip -r ../quiz-nas-static.zip ."
fi

echo ""
echo "=========================================="
echo "  NAS 自托管版本构建完成！"
echo "  输出目录: $OUTPUT"
echo "=========================================="
echo ""
echo "部署方式："
echo "  1. 将 $OUTPUT 目录下的所有文件上传到 NAS 的 Web 目录"
echo "  2. 用 nginx / Apache / 任何静态文件服务器指向该目录"
echo "  3. 浏览器访问对应地址即可使用"
echo ""
echo "特性："
echo "  - 纯静态，零后端依赖"
echo "  - Hash 路由，刷新不 404，不需要 nginx try_files"
echo "  - 相对路径，部署到任意子目录都能正常加载"
echo "  - 内置题库已打包，开箱即用"
echo "  - 数据全部存在浏览器 localStorage"
echo ""
echo "注意："
echo "  - PDF/Word 文档解析插件在 NAS 模式下不可用（请使用 Excel 导入）"
echo "  - Excel 导入、多 Sheet 合并、选择标题行、刷题、背题、收藏、错题本全部正常"
echo ""
