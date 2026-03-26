# ROADMAP - 报表与大屏融合改进

## 远期目标
- 统一可视化区块体系（单表 Section，OwnerType 标识 report/template/instance），减少冗余模型
- 增强交互能力：钻取、联动、筛选、导出（Excel/PDF）
- 图表高级能力：地图、热点、流式数据、动态过滤器组件
- RAG 洞察：洞察结果向量化存储与检索，跨报表/大屏复用
- 大屏/报表统一 API 聚合层，前端只需一次调用即可获取编排后的数据
- 订阅与推送：报表定时推送 + 大屏实时推送统一由 RefreshService 管理

## 现状与差距
- 区块类型已统一，渲染器已支持 16 种类型，但数据查询仍偏静态
- 报表与大屏的布局模型仍有差异（grid vs. absolute），后续需抽象为 LayoutSchema
- AutoQuery 仅做浅层探索查询，缺少缓存淘汰策略与数据源变更监听

## 规划分阶段
- Phase 1（已完成）
  - 统一区块类型枚举 & DTO
  - 前端创建页去除重复枚举
  - 渲染器补全 16 种区块类型
- Phase 2（待定）
  - 报表/大屏共享 Section 表 + OwnerType 字段
  - 布局抽象：GridLayoutSchema + FreeLayoutSchema，减少字段分叉
  - 查询缓存支持主动失效（数据源变更钩子）
- Phase 3（远期）
  - 交互增强：钻取/联动/筛选/导出
  - RAG 洞察与洞察跨场景复用
  - 统一 API 聚合层 + WebSocket 多通道推送（dashboard/report/topic）
