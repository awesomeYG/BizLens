package model

// DashboardSectionType 大屏区块类型（统一枚举，报表和大屏共用）
type DashboardSectionType string

const (
	SectionTypeKPI     DashboardSectionType = "kpi"     // KPI 指标卡
	SectionTypeTrend   DashboardSectionType = "trend"   // 趋势图
	SectionTypeRanking DashboardSectionType = "ranking" // 排行榜
	SectionTypeMap     DashboardSectionType = "map"     // 地图
	SectionTypePie     DashboardSectionType = "pie"     // 饼图
	SectionTypeBar     DashboardSectionType = "bar"     // 柱状图
	SectionTypeLine    DashboardSectionType = "line"    // 折线图
	SectionTypeArea    DashboardSectionType = "area"    // 面积图
	SectionTypeFunnel  DashboardSectionType = "funnel"  // 漏斗图
	SectionTypeTable   DashboardSectionType = "table"   // 明细表
	SectionTypeInsight DashboardSectionType = "insight" // AI 洞察
	SectionTypeAlert   DashboardSectionType = "alert"   // 告警
	SectionTypeGauge   DashboardSectionType = "gauge"   // 仪表盘
	SectionTypeRadar   DashboardSectionType = "radar"   // 雷达图
	SectionTypeScatter DashboardSectionType = "scatter" // 散点图
	SectionTypeHeatmap DashboardSectionType = "heatmap" // 热力图
	SectionTypeCustom  DashboardSectionType = "custom"  // 自定义
)

// AllSectionTypes 返回所有支持的区块类型列表（供前端枚举使用）
var AllSectionTypes = []DashboardSectionType{
	SectionTypeKPI,
	SectionTypeTrend,
	SectionTypeRanking,
	SectionTypeMap,
	SectionTypePie,
	SectionTypeBar,
	SectionTypeLine,
	SectionTypeArea,
	SectionTypeFunnel,
	SectionTypeTable,
	SectionTypeInsight,
	SectionTypeAlert,
	SectionTypeGauge,
	SectionTypeRadar,
	SectionTypeScatter,
	SectionTypeHeatmap,
	SectionTypeCustom,
}

// IsValidSectionType 检查给定的类型值是否有效
func IsValidSectionType(t string) bool {
	for _, st := range AllSectionTypes {
		if string(st) == t {
			return true
		}
	}
	return false
}
