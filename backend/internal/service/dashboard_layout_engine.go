package service

// LayoutEngine 自动布局引擎
type LayoutEngine struct {
	columns int
}

// NewLayoutEngine 创建布局引擎
func NewLayoutEngine(columns int) *LayoutEngine {
	if columns <= 0 {
		columns = 3 // 默认 3 列
	}
	return &LayoutEngine{columns: columns}
}

// LayoutResult 布局结果
type LayoutResult struct {
	Row      int
	Col      int
	Width    int
	Height   int
	Priority int
}

// AutoLayout 自动布局算法
// 输入：区块列表（已按优先级排序）
// 输出：布局结果列表
func (e *LayoutEngine) AutoLayout(sections []SectionInput) []LayoutResult {
	results := make([]LayoutResult, len(sections))
	grid := make([][]bool, 0) // 动态扩展行数

	// 初始化网格（至少 10 行）
	for i := 0; i < 10; i++ {
		grid = append(grid, make([]bool, e.columns))
	}

	for i, section := range sections {
		width := section.Width
		height := section.Height

		// KPI 类型宽度为 3，其他默认为 1
		if width == 0 {
			if section.Type == "kpi" {
				width = e.columns // KPI 占满整行
			} else {
				width = 1
			}
		}
		if height == 0 {
			height = 1
		}

		// 确保宽度不超过列数
		if width > e.columns {
			width = e.columns
		}

		// 寻找可放置的位置
		row, col := e.findPosition(grid, width, height)

		// 更新网格
		e.markOccupied(grid, row, col, width, height)

		results[i] = LayoutResult{
			Row:      row,
			Col:      col,
			Width:    width,
			Height:   height,
			Priority: section.Priority,
		}
	}

	return results
}

// SectionInput 区块输入
type SectionInput struct {
	Type     string
	Priority int
	Width    int
	Height   int
}

// findPosition 寻找可放置的位置（左上角优先）
func (e *LayoutEngine) findPosition(grid [][]bool, width, height int) (int, int) {
	for row := 0; row < len(grid); row++ {
		for col := 0; col <= e.columns-width; col++ {
			if e.canPlace(grid, row, col, width, height) {
				return row, col
			}
		}
		// 如果当前行无法放置，扩展网格
		if row == len(grid)-1 {
			grid = append(grid, make([]bool, e.columns))
		}
	}
	return 0, 0
}

// canPlace 检查是否可以放置
func (e *LayoutEngine) canPlace(grid [][]bool, row, col, width, height int) bool {
	// 确保网格有足够的行数
	for row+height > len(grid) {
		grid = append(grid, make([]bool, e.columns))
	}

	for r := row; r < row+height; r++ {
		for c := col; c < col+width; c++ {
			if c >= e.columns || grid[r][c] {
				return false
			}
		}
	}
	return true
}

// markOccupied 标记位置为已占用
func (e *LayoutEngine) markOccupied(grid [][]bool, row, col, width, height int) {
	for r := row; r < row+height; r++ {
		for c := col; c < col+width; c++ {
			if r < len(grid) && c < e.columns {
				grid[r][c] = true
			}
		}
	}
}

// ColorEngine 智能配色引擎
type ColorEngine struct {
	brandColor string
	industry   string
	colorTone  string
}

// ColorPalette 配色方案
type ColorPalette struct {
	Primary   string      `json:"primary"`
	Secondary string      `json:"secondary"`
	Alert     AlertColors `json:"alert"`
}

// AlertColors 告警配色
type AlertColors struct {
	Up   string `json:"up"`
	Down string `json:"down"`
}

// NewColorEngine 创建配色引擎
func NewColorEngine(brandColor, industry, colorTone string) *ColorEngine {
	return &ColorEngine{
		brandColor: brandColor,
		industry:   industry,
		colorTone:  colorTone,
	}
}

// GeneratePalette 生成配色方案
func (e *ColorEngine) GeneratePalette() ColorPalette {
	// 默认主色（如果没有品牌色）
	primary := e.brandColor
	if primary == "" {
		primary = e.getDefaultPrimary()
	}

	// 生成辅助色
	secondary := e.generateSecondary(primary)

	// 中式告警配色（红涨绿跌）
	alert := AlertColors{
		Up:   "#EF4444", // 中国红
		Down: "#10B981", // 中国绿
	}

	return ColorPalette{
		Primary:   primary,
		Secondary: secondary,
		Alert:     alert,
	}
}

// getDefaultPrimary 根据行业和色调获取默认主色
func (e *ColorEngine) getDefaultPrimary() string {
	// 根据色调选择
	switch e.colorTone {
	case "vibrant":
		return "#06b6d4" // cyan-500，活力
	case "minimal":
		return "#6366f1" // indigo-500，极简
	case "professional":
		fallthrough
	default:
		return "#0ea5e9" // sky-500，专业
	}
}

// generateSecondary 生成辅助色（互补色）
func (e *ColorEngine) generateSecondary(primary string) string {
	// 简单的互补色生成
	// 实际项目中可以使用更复杂的算法
	switch primary {
	case "#06b6d4": // cyan
		return "#3b82f6" // blue
	case "#6366f1": // indigo
		return "#8b5cf6" // violet
	case "#0ea5e9": // sky
		return "#06b6d4" // cyan
	default:
		return "#3b82f6"
	}
}
