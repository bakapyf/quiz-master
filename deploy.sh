#!/bin/bash
cd "$(dirname "$0")"
echo "=== 提交代码 ==="
git add -A
git commit -m "更新"
echo ""
echo "=== 构建 ==="
npm run build
echo ""
echo "=== 启动本地服务 ==="
echo "访问 http://localhost:3000"
npx serve dist
