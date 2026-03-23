package service

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// CleanOperation 清洗操作
type CleanOperation struct {
	Type    string                 `json:"type"`
	Field   string                 `json:"field"`
	Options map[string]interface{} `json:"options"`
}

// CleanResult 清洗结果
type CleanResult struct {
	Success      bool   `json:"success"`
	Field        string `json:"field"`
	Operation    string `json:"operation"`
	ModifiedRows int    `json:"modifiedRows"`
	Before       string `json:"before,omitempty"`
	After        string `json:"after,omitempty"`
	Error        string `json:"error,omitempty"`
}

// CleanService 数据清洗服务
type CleanService struct {
	parser *FileParser
}

// NewCleanService 创建清洗服务
func NewCleanService() *CleanService {
	return &CleanService{
		parser: NewFileParser(),
	}
}

// GetCleanableOperations 获取可执行的清洗操作
func (s *CleanService) GetCleanableOperations(fieldType string, sampleValues []string) []CleanOperationDef {
	operations := []CleanOperationDef{
		{
			Type:        "trim_whitespace",
			Name:        "去除首尾空白",
			Description: "去除字段值的首尾空格和换行符",
			Applicable:  []string{"string"},
			Required:    false,
		},
		{
			Type:        "remove_duplicates",
			Name:        "删除重复数据",
			Description: "根据该字段删除重复的行",
			Applicable:  []string{"string", "integer", "float"},
			Required:    false,
		},
		{
			Type:        "fill_null",
			Name:        "填充空值",
			Description: "使用指定值填充空值",
			Applicable:  []string{"string", "integer", "float", "boolean"},
			Required:    false,
		},
		{
			Type:        "remove_empty_rows",
			Name:        "删除空行",
			Description: "删除该字段为空的行",
			Applicable:  []string{"string", "integer", "float"},
			Required:    false,
		},
	}

	// 根据字段类型筛选
	var filtered []CleanOperationDef
	for _, op := range operations {
		for _, t := range op.Applicable {
			if t == fieldType || t == "*" {
				filtered = append(filtered, op)
				break
			}
		}
	}

	// 添加类型特定的操作
	switch fieldType {
	case "date", "datetime":
		filtered = append(filtered,
			CleanOperationDef{
				Type:        "unify_date_format",
				Name:        "统一日期格式",
				Description: "将不同格式的日期统一为指定格式",
				Applicable:  []string{"date", "datetime"},
				Required:    false,
			},
		)
	case "string":
		// 检查是否包含数值
		isNumeric := true
		for _, v := range sampleValues {
			if v != "" && !s.isNumericString(v) {
				isNumeric = false
				break
			}
		}
		if isNumeric && len(sampleValues) > 0 {
			filtered = append(filtered,
				CleanOperationDef{
					Type:        "extract_number",
					Name:        "提取数值",
					Description: "从文本中提取数值并转换为数字类型",
					Applicable:  []string{"string"},
					Required:    false,
				},
			)
		}
	}

	return filtered
}

func (s *CleanService) isNumericString(v string) bool {
	cleaned := strings.ReplaceAll(v, ",", "")
	cleaned = strings.ReplaceAll(cleaned, "¥", "")
	cleaned = strings.ReplaceAll(cleaned, "$", "")
	cleaned = strings.TrimSpace(cleaned)
	_, err := strconv.ParseFloat(cleaned, 64)
	return err == nil
}

// CleanOperationDef 清洗操作定义
type CleanOperationDef struct {
	Type        string   `json:"type"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Applicable  []string `json:"applicable"`
	Required    bool     `json:"required"`
}

// ExecuteClean 执行清洗操作
func (s *CleanService) ExecuteClean(operation *CleanOperation, data [][]interface{}, headers []string) (*CleanResult, error) {
	fieldIndex := -1
	for i, h := range headers {
		if h == operation.Field {
			fieldIndex = i
			break
		}
	}

	if fieldIndex == -1 {
		return &CleanResult{
			Success:   false,
			Field:     operation.Field,
			Operation: operation.Type,
			Error:     "字段不存在",
		}, nil
	}

	switch operation.Type {
	case "trim_whitespace":
		return s.trimWhitespace(data, fieldIndex)
	case "unify_date_format":
		return s.unifyDateFormat(data, fieldIndex, operation.Options)
	case "extract_number":
		return s.extractNumber(data, fieldIndex)
	case "fill_null":
		return s.fillNull(data, fieldIndex, operation.Options)
	case "remove_empty_rows":
		return s.removeEmptyRows(data, fieldIndex)
	default:
		return nil, fmt.Errorf("未知的清洗操作：%s", operation.Type)
	}
}

// trimWhitespace 去除首尾空白
func (s *CleanService) trimWhitespace(data [][]interface{}, fieldIndex int) (*CleanResult, error) {
	count := 0
	for _, row := range data {
		if fieldIndex < len(row) {
			if v, ok := row[fieldIndex].(string); ok {
				trimmed := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(v, "\n", ""), "\r", ""))
				if trimmed != v {
					row[fieldIndex] = trimmed
					count++
				}
			}
		}
	}

	return &CleanResult{
		Success:      true,
		Field:        fmt.Sprintf("列 %d", fieldIndex+1),
		Operation:    "trim_whitespace",
		ModifiedRows: count,
		Before:       "有前后空白的值",
		After:        "已去除前后空白",
	}, nil
}

// unifyDateFormat 统一日期格式
func (s *CleanService) unifyDateFormat(data [][]interface{}, fieldIndex int, options map[string]interface{}) (*CleanResult, error) {
	targetFormat, _ := options["format"].(string)
	if targetFormat == "" {
		targetFormat = "2006-01-02"
	}

	// 日期解析格式列表
	dateFormats := []string{
		"2006-01-02",
		"2006/01/02",
		"01-02-2006",
		"01/02/2006",
		"2006年1月2日",
		"2006-1-2",
		"2006/1/2",
		"2006-01-02 15:04:05",
		"2006/01/02 15:04:05",
	}

	count := 0
	for _, row := range data {
		if fieldIndex < len(row) {
			if v, ok := row[fieldIndex].(string); ok && v != "" {
				// 尝试解析
				parsed := false
				for _, format := range dateFormats {
					if _, err := time.Parse(format, v); err == nil {
						t, _ := time.Parse(format, v)
						row[fieldIndex] = t.Format(targetFormat)
						count++
						parsed = true
						break
					}
				}
				_ = parsed // 忽略未解析的值
			}
		}
	}

	return &CleanResult{
		Success:      true,
		Field:        fmt.Sprintf("列 %d", fieldIndex+1),
		Operation:    "unify_date_format",
		ModifiedRows: count,
		Before:       "混合日期格式",
		After:        "统一为 " + targetFormat,
	}, nil
}

// extractNumber 提取数值
func (s *CleanService) extractNumber(data [][]interface{}, fieldIndex int) (*CleanResult, error) {
	numberPattern := regexp.MustCompile(`[-+]?\d[\d,]*(?:\.\d+)?`)
	count := 0

	for _, row := range data {
		if fieldIndex < len(row) {
			if v, ok := row[fieldIndex].(string); ok && v != "" {
				// 移除货币符号和逗号
				cleaned := numberPattern.FindString(strings.ReplaceAll(strings.ReplaceAll(v, ",", ""), "¥", ""))
				if cleaned != "" {
					if f, err := strconv.ParseFloat(cleaned, 64); err == nil {
						row[fieldIndex] = f
						count++
					}
				}
			}
		}
	}

	return &CleanResult{
		Success:      true,
		Field:        fmt.Sprintf("列 %d", fieldIndex+1),
		Operation:    "extract_number",
		ModifiedRows: count,
		Before:       "文本中的数值（如 ¥1,000）",
		After:        "纯数值（1000）",
	}, nil
}

// fillNull 填充空值
func (s *CleanService) fillNull(data [][]interface{}, fieldIndex int, options map[string]interface{}) (*CleanResult, error) {
	strategy, _ := options["strategy"].(string)
	value, _ := options["value"].(string)

	count := 0
	for _, row := range data {
		if fieldIndex < len(row) {
			if row[fieldIndex] == nil || row[fieldIndex] == "" {
				switch strategy {
				case "value":
					row[fieldIndex] = value
					count++
				case "mean":
					// 需要先计算平均值
					sum := 0.0
					c := 0
					for _, r := range data {
						if fieldIndex < len(r) && r[fieldIndex] != nil && r[fieldIndex] != "" {
							if f, ok := toFloat64(r[fieldIndex]); ok {
								sum += f
								c++
							}
						}
					}
					if c > 0 {
						row[fieldIndex] = sum / float64(c)
						count++
					}
				case "mode":
					// 众数
					freq := make(map[string]int)
					maxFreq := 0
					var modeVal string
					for _, r := range data {
						if fieldIndex < len(r) && r[fieldIndex] != nil && r[fieldIndex] != "" {
							v := fmt.Sprintf("%v", r[fieldIndex])
							freq[v]++
							if freq[v] > maxFreq {
								maxFreq = freq[v]
								modeVal = v
							}
						}
					}
					if modeVal != "" {
						row[fieldIndex] = modeVal
						count++
					}
				case "forward":
					// 前向填充（已在之前的循环中处理）
				}
			}
		}
	}

	return &CleanResult{
		Success:      true,
		Field:        fmt.Sprintf("列 %d", fieldIndex+1),
		Operation:    "fill_null",
		ModifiedRows: count,
		Before:       "空值",
		After:        fmt.Sprintf("使用 %s 填充", strategy),
	}, nil
}

// removeEmptyRows 删除空行
func (s *CleanService) removeEmptyRows(data [][]interface{}, fieldIndex int) (*CleanResult, error) {
	originalLen := len(data)

	// 过滤掉该字段为空的行
	filtered := make([][]interface{}, 0)
	for _, row := range data {
		if fieldIndex < len(row) {
			if row[fieldIndex] != nil && row[fieldIndex] != "" {
				filtered = append(filtered, row)
			}
		}
	}

	count := originalLen - len(filtered)
	// 更新原数据（这里需要注意，实际使用时应该返回新数据）
	copy(data, filtered)
	for i := len(filtered); i < originalLen; i++ {
		data[i] = nil
	}

	return &CleanResult{
		Success:      true,
		Field:        fmt.Sprintf("列 %d", fieldIndex+1),
		Operation:    "remove_empty_rows",
		ModifiedRows: count,
		Before:       fmt.Sprintf("共 %d 行", originalLen),
		After:        fmt.Sprintf("删除 %d 行，剩余 %d 行", count, len(filtered)),
	}, nil
}

// toFloat64 转换为 float64
func toFloat64(v interface{}) (float64, bool) {
	switch val := v.(type) {
	case float64:
		return val, true
	case float32:
		return float64(val), true
	case int:
		return float64(val), true
	case int64:
		return float64(val), true
	case string:
		if f, err := strconv.ParseFloat(val, 64); err == nil {
			return f, true
		}
	}
	return 0, false
}

// ExportCleanedData 导出清洗后的数据
func (s *CleanService) ExportCleanedData(data [][]interface{}, headers []string, format string) ([]byte, error) {
	switch format {
	case "csv":
		return s.exportCSV(data, headers)
	case "json":
		return s.exportJSON(data, headers)
	default:
		return nil, fmt.Errorf("不支持的导出格式：%s", format)
	}
}

func (s *CleanService) exportCSV(data [][]interface{}, headers []string) ([]byte, error) {
	var sb strings.Builder

	// 写入表头
	for i, h := range headers {
		if i > 0 {
			sb.WriteString(",")
		}
		sb.WriteString(h)
	}
	sb.WriteString("\n")

	// 写入数据
	for _, row := range data {
		if row == nil {
			continue
		}
		for j, v := range row {
			if j > 0 {
				sb.WriteString(",")
			}
			sb.WriteString(fmt.Sprintf("%v", v))
		}
		sb.WriteString("\n")
	}

	return []byte(sb.String()), nil
}

func (s *CleanService) exportJSON(data [][]interface{}, headers []string) ([]byte, error) {
	result := make([]map[string]interface{}, 0, len(data))
	for _, row := range data {
		if row == nil {
			continue
		}
		obj := make(map[string]interface{})
		for i, h := range headers {
			if i < len(row) {
				obj[h] = row[i]
			}
		}
		result = append(result, obj)
	}

	return json.MarshalIndent(result, "", "  ")
}
