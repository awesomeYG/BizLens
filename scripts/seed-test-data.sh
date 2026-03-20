#!/bin/bash

# BizLens 测试数据脚本
# 用于在开发环境中快速创建测试数据

echo "🚀 BizLens 测试数据脚本"
echo "======================"
echo ""

# 检查是否配置了环境变量
if [ ! -f .env.local ]; then
    echo "⚠️  未找到 .env.local 文件，使用默认配置"
    export USE_SQLITE=true
else
    source .env.local
fi

# 测试数据说明
cat << 'EOF'

📦 测试数据说明:

1. 快速测试模式（推荐）
   - 访问首页 http://localhost:3000
   - 点击 "🚀 快速测试（使用 Mock 数据）" 按钮
   - 自动登录并填充电商公司数据

2. 调试工具页面
   - 访问 /debug 页面
   - 可以管理测试数据、重置状态

3. Mock 数据内容:
   - 公司：杭州智选电商有限公司
   - 行业：电商零售
   - 数据源：MySQL 生产库 + CSV 营销数据
   - 预设指标：GMV、毛利率、复购率等

EOF

echo ""
echo "📝 可用的测试账号:"
echo "----------------"
echo "1. 快速测试账号 (Mock):"
echo "   - 姓名：测试用户"
echo "   - 邮箱：test@bizlens.demo"
echo "   - 特点：自动填充完整数据"
echo ""
echo "2. 手动创建账号:"
echo "   - 在首页输入任意姓名和邮箱"
echo "   - 完成 onboarding 流程"
echo ""

echo "🔗 快速链接:"
echo "-----------"
echo "- 首页：http://localhost:3000"
echo "- AI 对话：http://localhost:3000/chat"
echo "- 数据源管理：http://localhost:3000/data-sources"
echo "- 数据大屏：http://localhost:3000/dashboards"
echo "- 智能告警：http://localhost:3000/alerts"
echo "- IM 设置：http://localhost:3000/im/settings"
echo "- AI 设置：http://localhost:3000/settings/ai"
echo "- 调试工具：http://localhost:3000/debug"
echo ""

echo "💡 使用建议:"
echo "-----------"
echo "1. 开发测试：使用快速测试按钮，5 秒进入主界面"
echo "2. 完整流程：手动创建账号，体验完整 onboarding"
echo "3. 数据重置：访问 /debug 页面清除数据"
echo ""

echo "✅ 脚本执行完成！"
echo ""
