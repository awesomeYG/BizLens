package service

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

// ParseResult 解析结果
type ParseResult struct {
	RowCount    int             `json:"rowCount"`
	ColumnCount int             `json:"columnCount"`
	Schema      *DataSchema     `json:"schema"`
	Data        [][]interface{} `json:"data,omitempty"`
}

// DataSchema 数据模式
type DataSchema struct {
	Fields []FieldSchema `json:"fields"`
}

// FieldSchema 字段模式
type FieldSchema struct {
	Name       string      `json:"name"`
	Type       string      `json:"type"` // string/integer/float/boolean/date/datetime
	Nullable   bool        `json:"nullable"`
	Statistics *FieldStats `json:"statistics,omitempty"`
}

// FieldStats 字段统计
type FieldStats struct {
	NullCount   int         `json:"nullCount"`
	NullRatio   float64     `json:"nullRatio"`
	UniqueCount int         `json:"uniqueCount"`
	MinValue    interface{} `json:"minValue,omitempty"`
	MaxValue    interface{} `json:"maxValue,omitempty"`
	TopValues   []TopValue  `json:"topValues,omitempty"`
}

// TopValue 高频值
type TopValue struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}

// FileParser 文件解析器
type FileParser struct {
}

// NewFileParser 创建解析器
func NewFileParser() *FileParser {
	return &FileParser{}
}

// Parse 解析文件
func (p *FileParser) Parse(filePath, fileFormat string) (*ParseResult, error) {
	switch fileFormat {
	case "xlsx", "xls":
		return p.parseExcel(filePath)
	case "csv":
		return p.parseCSV(filePath)
	case "json":
		return p.parseJSON(filePath)
	default:
		return nil, fmt.Errorf("unsupported format: %s", fileFormat)
	}
}

// Preview 预览数据
func (p *FileParser) Preview(filePath, fileFormat string, limit, offset int) (*ParseResult, error) {
	result, err := p.Parse(filePath, fileFormat)
	if err != nil {
		return nil, err
	}

	// 只返回指定范围的数据
	if offset >= len(result.Data) {
		result.Data = [][]interface{}{}
	} else {
		end := offset + limit
		if end > len(result.Data) {
			end = len(result.Data)
		}
		result.Data = result.Data[offset:end]
	}

	return result, nil
}

// parseExcel 解析 Excel 文件
func (p *FileParser) parseExcel(filePath string) (*ParseResult, error) {
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开 Excel 文件失败：%w", err)
	}
	defer f.Close()

	// 获取第一个工作表
	sheetName := f.GetSheetName(0)
	if sheetName == "" {
		return nil, fmt.Errorf("Excel 文件没有工作表")
	}

	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, fmt.Errorf("读取工作表失败：%w", err)
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf("Excel 文件为空")
	}

	// 解析表头
	headers := rows[0]

	// 解析数据
	data := make([][]interface{}, 0)
	columnValues := make(map[int][]string)

	for i := 1; i < len(rows); i++ {
		row := rows[i]
		rowData := make([]interface{}, len(headers))
		for j := 0; j < len(headers); j++ {
			if j < len(row) {
				rowData[j] = row[j]
				columnValues[j] = append(columnValues[j], row[j])
			} else {
				rowData[j] = ""
				columnValues[j] = append(columnValues[j], "")
			}
		}
		data = append(data, rowData)
	}

	// 推断字段类型
	fields := make([]FieldSchema, len(headers))
	for i, header := range headers {
		fields[i] = p.inferField(header, columnValues[i])
	}

	return &ParseResult{
		RowCount:    len(data),
		ColumnCount: len(headers),
		Schema:      &DataSchema{Fields: fields},
		Data:        data,
	}, nil
}

// parseCSV 解析 CSV 文件
func (p *FileParser) parseCSV(filePath string) (*ParseResult, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开 CSV 文件失败：%w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)

	// 读取表头
	headers, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("读取 CSV 表头失败：%w", err)
	}

	// 读取数据
	data := make([][]interface{}, 0)
	columnValues := make(map[int][]string)

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("读取 CSV 数据失败：%w", err)
		}

		rowData := make([]interface{}, len(headers))
		for i, field := range record {
			rowData[i] = field
			if i < len(headers) {
				columnValues[i] = append(columnValues[i], field)
			}
		}
		data = append(data, rowData)
	}

	// 推断字段类型
	fields := make([]FieldSchema, len(headers))
	for i, header := range headers {
		fields[i] = p.inferField(header, columnValues[i])
	}

	return &ParseResult{
		RowCount:    len(data),
		ColumnCount: len(headers),
		Schema:      &DataSchema{Fields: fields},
		Data:        data,
	}, nil
}

// parseJSON 解析 JSON 文件
func (p *FileParser) parseJSON(filePath string) (*ParseResult, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开 JSON 文件失败：%w", err)
	}
	defer file.Close()

	var jsonData []map[string]interface{}
	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&jsonData); err != nil {
		return nil, fmt.Errorf("解析 JSON 数据失败：%w", err)
	}

	if len(jsonData) == 0 {
		return &ParseResult{
			RowCount:    0,
			ColumnCount: 0,
			Schema:      &DataSchema{Fields: []FieldSchema{}},
			Data:        [][]interface{}{},
		}, nil
	}

	// 获取所有键名作为表头
	headerMap := make(map[string]bool)
	for _, row := range jsonData {
		for key := range row {
			headerMap[key] = true
		}
	}

	headers := make([]string, 0, len(headerMap))
	for key := range headerMap {
		headers = append(headers, key)
	}

	// 构建数据
	data := make([][]interface{}, 0, len(jsonData))
	columnValues := make(map[int][]string)

	for i, row := range jsonData {
		rowData := make([]interface{}, len(headers))
		for j, header := range headers {
			value := row[header]
			rowData[j] = value
			if value != nil {
				columnValues[j] = append(columnValues[j], fmt.Sprintf("%v", value))
			}
		}
		data = append(data, rowData)

		// 预览时使用第一个对象推断类型
		if i == 0 {
			for j, header := range headers {
				value := row[header]
				if value != nil {
					columnValues[j] = append(columnValues[j], fmt.Sprintf("%v", value))
				}
			}
		}
	}

	// 推断字段类型
	fields := make([]FieldSchema, len(headers))
	for i, header := range headers {
		fields[i] = p.inferField(header, columnValues[i])
	}

	return &ParseResult{
		RowCount:    len(jsonData),
		ColumnCount: len(headers),
		Schema:      &DataSchema{Fields: fields},
		Data:        data,
	}, nil
}

// inferField 推断字段类型
func (p *FileParser) inferField(name string, values []string) FieldSchema {
	field := FieldSchema{
		Name:     name,
		Nullable: false,
	}

	// 统计信息
	stats := &FieldStats{
		NullCount:   0,
		UniqueCount: 0,
	}

	nonNullValues := make([]string, 0)
	valueCount := make(map[string]int)

	for _, v := range values {
		if v == "" || strings.ToLower(strings.TrimSpace(v)) == "null" {
			stats.NullCount++
		} else {
			nonNullValues = append(nonNullValues, v)
			valueCount[v]++
		}
	}

	if len(values) > 0 {
		stats.NullRatio = float64(stats.NullCount) / float64(len(values))
	}
	if stats.NullRatio > 0.1 {
		field.Nullable = true
	}

	stats.UniqueCount = len(valueCount)

	// 高频值
	topValues := make([]TopValue, 0)
	for v, count := range valueCount {
		topValues = append(topValues, TopValue{Value: v, Count: count})
	}
	// 排序取前 5
	for i := 0; i < len(topValues) && i < 5; i++ {
		for j := i + 1; j < len(topValues) && j < 5; j++ {
			if topValues[j].Count > topValues[i].Count {
				topValues[i], topValues[j] = topValues[j], topValues[i]
			}
		}
	}
	stats.TopValues = topValues[:min(len(topValues), 5)]

	// 推断类型
	field.Type = p.inferType(nonNullValues)
	field.Statistics = stats

	field.Statistics = stats

	return field
}

// inferType 推断数据类型
func (p *FileParser) inferType(values []string) string {
	if len(values) == 0 {
		return "string"
	}

	// 采样检查
	sampleSize := min(len(values), 100)
	sample := values[:sampleSize]

	// 检查布尔值
	if p.isBoolean(sample) {
		return "boolean"
	}

	// 检查日期
	if p.isDate(sample) {
		if p.hasTime(sample) {
			return "datetime"
		}
		return "date"
	}

	// 检查数值
	if p.isNumber(sample) {
		if p.isFloat(sample) {
			return "float"
		}
		return "integer"
	}

	return "string"
}

func (p *FileParser) isBoolean(values []string) bool {
	booleanValues := map[string]bool{
		"true": true, "false": true, "yes": true, "no": true,
		"是": true, "否": true, "1": true, "0": true,
	}
	for _, v := range values {
		if !booleanValues[strings.ToLower(strings.TrimSpace(v))] {
			return false
		}
	}
	return true
}

func (p *FileParser) isDate(values []string) bool {
	datePatterns := []string{
		"2006-01-02",
		"2006/01/02",
		"01-02-2006",
		"01/02/2006",
		"2006 年 1 月 2 日",
		"2006-1-2",
		"2006/1/2",
	}

	for _, v := range values {
		matched := false
		for _, pattern := range datePatterns {
			if _, err := time.Parse(pattern, v); err == nil {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}
	return true
}

func (p *FileParser) hasTime(values []string) bool {
	for _, v := range values {
		if strings.Contains(v, ":") || strings.Contains(v, "时") {
			return true
		}
	}
	return false
}

func (p *FileParser) isNumber(values []string) bool {
	for _, v := range values {
		// 移除货币符号和千分位
		cleaned := strings.ReplaceAll(v, ",", "")
		cleaned = strings.ReplaceAll(cleaned, "¥", "")
		cleaned = strings.ReplaceAll(cleaned, "$", "")
		cleaned = strings.TrimSpace(cleaned)

		if _, err := strconv.ParseFloat(cleaned, 64); err != nil {
			return false
		}
	}
	return true
}

func (p *FileParser) isFloat(values []string) bool {
	for _, v := range values {
		cleaned := strings.ReplaceAll(v, ",", "")
		cleaned = strings.ReplaceAll(cleaned, "¥", "")
		cleaned = strings.ReplaceAll(cleaned, "$", "")

		if f, err := strconv.ParseFloat(cleaned, 64); err == nil {
			if f != float64(int64(f)) {
				return true
			}
		}
	}
	return false
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
