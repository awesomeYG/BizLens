package service

import (
	"fmt"
	"regexp"
	"strings"
)

// SensitiveDataType 敏感数据类型
type SensitiveDataType string

const (
	SensitiveIDCard   SensitiveDataType = "id_card"   // 身份证
	SensitivePhone    SensitiveDataType = "phone"     // 手机号
	SensitiveBankCard SensitiveDataType = "bank_card" // 银行卡
	SensitiveEmail    SensitiveDataType = "email"     // 邮箱
	SensitiveAddress  SensitiveDataType = "address"   // 地址
)

// SensitiveDataMatch 敏感数据匹配结果
type SensitiveDataMatch struct {
	Type       SensitiveDataType `json:"type"`
	Value      string            `json:"value"`
	StartIndex int               `json:"startIndex"`
	EndIndex   int               `json:"endIndex"`
	Masked     string            `json:"masked"`
}

// MaskingStrategy 脱敏策略
type MaskingStrategy string

const (
	MaskFull    MaskingStrategy = "full"    // 完全隐藏
	MaskPartial MaskingStrategy = "partial" // 部分隐藏
	MaskReplace MaskingStrategy = "replace" // 替换为固定值
)

// MaskOptions 脱敏选项
type MaskOptions struct {
	Strategy    MaskingStrategy `json:"strategy"`
	ReplaceWith string          `json:"replaceWith,omitempty"`
}

// SensitiveDataDetector 敏感数据检测器
type SensitiveDataDetector struct {
	patterns map[SensitiveDataType]*regexp.Regexp
}

// NewSensitiveDataDetector 创建检测器
func NewSensitiveDataDetector() *SensitiveDataDetector {
	return &SensitiveDataDetector{
		patterns: map[SensitiveDataType]*regexp.Regexp{
			// 18 位身份证号
			SensitiveIDCard: regexp.MustCompile(
				`\b[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b`,
			),
			// 手机号（中国大陆）
			SensitivePhone: regexp.MustCompile(
				`\b1[3-9]\d{9}\b`,
			),
			// 银行卡号（16-19 位）
			SensitiveBankCard: regexp.MustCompile(
				`\b[1-9]\d{15,18}\b`,
			),
			// 邮箱
			SensitiveEmail: regexp.MustCompile(
				`\b[\w.-]+@[\w.-]+\.\w+\b`,
			),
			// 地址（简单模式，匹配省市区街道等关键词）
			SensitiveAddress: regexp.MustCompile(
				`\b[\u4e00-\u9fa5]+(省|市|区|县|街道|路|号)\b`,
			),
		},
	}
}

// Detect 检测敏感数据
func (d *SensitiveDataDetector) Detect(value string) []SensitiveDataMatch {
	var matches []SensitiveDataMatch

	for dataType, pattern := range d.patterns {
		indices := pattern.FindAllStringIndex(value, -1)
		for _, idx := range indices {
			match := value[idx[0]:idx[1]]
			matches = append(matches, SensitiveDataMatch{
				Type:       dataType,
				Value:      match,
				StartIndex: idx[0],
				EndIndex:   idx[1],
				Masked:     d.Mask(match, dataType, MaskPartial),
			})
		}
	}

	return matches
}

// DetectInDataset 检测数据集中的敏感数据
func (d *SensitiveDataDetector) DetectInDataset(headers []string, data [][]interface{}) map[int][]SensitiveDataMatch {
	// 返回每个字段的敏感数据匹配结果
	result := make(map[int][]SensitiveDataMatch)

	for colIdx, header := range headers {
		// 检查字段名是否包含敏感关键词
		headerLower := strings.ToLower(header)
		var fieldTypes []SensitiveDataType

		if strings.Contains(headerLower, "手机") || strings.Contains(headerLower, "phone") || strings.Contains(headerLower, "tel") {
			fieldTypes = append(fieldTypes, SensitivePhone)
		}
		if strings.Contains(headerLower, "身份证") || strings.Contains(headerLower, "id_card") || strings.Contains(headerLower, "证件号") {
			fieldTypes = append(fieldTypes, SensitiveIDCard)
		}
		if strings.Contains(headerLower, "银行") || strings.Contains(headerLower, "bank") || strings.Contains(headerLower, "卡号") {
			fieldTypes = append(fieldTypes, SensitiveBankCard)
		}
		if strings.Contains(headerLower, "邮件") || strings.Contains(headerLower, "email") {
			fieldTypes = append(fieldTypes, SensitiveEmail)
		}
		if strings.Contains(headerLower, "地址") || strings.Contains(headerLower, "address") {
			fieldTypes = append(fieldTypes, SensitiveAddress)
		}

		// 采样检查数据
		sampleSize := 100
		if len(data) < sampleSize {
			sampleSize = len(data)
		}

		var fieldMatches []SensitiveDataMatch
		for i := 0; i < sampleSize; i++ {
			row := data[i]
			if colIdx < len(row) && row[colIdx] != nil {
				value := strings.TrimSpace(strings.ToLower(fmt.Sprintf("%v", row[colIdx])))
				for _, dataType := range fieldTypes {
					if pattern, ok := d.patterns[dataType]; ok {
						if pattern.MatchString(value) {
							matches := d.Detect(value)
							for _, m := range matches {
								if m.Type == dataType {
									fieldMatches = append(fieldMatches, m)
								}
							}
						}
					}
				}
			}
		}

		if len(fieldMatches) > 0 {
			result[colIdx] = fieldMatches
		}
	}

	return result
}

// Mask 脱敏处理
func (d *SensitiveDataDetector) Mask(value string, dataType SensitiveDataType, strategy MaskingStrategy) string {
	switch strategy {
	case MaskFull:
		return d.maskFull(value, dataType)
	case MaskPartial:
		return d.maskPartial(value, dataType)
	case MaskReplace:
		return "***"
	default:
		return d.maskPartial(value, dataType)
	}
}

func (d *SensitiveDataDetector) maskFull(value string, dataType SensitiveDataType) string {
	switch dataType {
	case SensitivePhone:
		return "***********"
	case SensitiveIDCard:
		return "******************"
	case SensitiveBankCard:
		return "****************"
	case SensitiveEmail:
		return "***@***.***"
	case SensitiveAddress:
		return "***"
	default:
		return "***"
	}
}

func (d *SensitiveDataDetector) maskPartial(value string, dataType SensitiveDataType) string {
	switch dataType {
	case SensitivePhone:
		// 138****1234
		if len(value) >= 11 {
			return value[:3] + "****" + value[len(value)-4:]
		}
		return d.maskFull(value, dataType)

	case SensitiveIDCard:
		// 110***********1234
		if len(value) >= 18 {
			return value[:6] + "**********" + value[len(value)-4:]
		}
		return d.maskFull(value, dataType)

	case SensitiveBankCard:
		// ****1234
		if len(value) >= 8 {
			return "****" + value[len(value)-4:]
		}
		return d.maskFull(value, dataType)

	case SensitiveEmail:
		// t***@example.com
		parts := strings.Split(value, "@")
		if len(parts) == 2 {
			if len(parts[0]) > 1 {
				return parts[0][:1] + "***@" + parts[1]
			}
			return "***@" + parts[1]
		}
		return d.maskFull(value, dataType)

	case SensitiveAddress:
		// 保留前 4 个字符 + ***
		if len(value) > 4 {
			return value[:4] + "***"
		}
		return d.maskFull(value, dataType)

	default:
		return d.maskFull(value, dataType)
	}
}

// MaskDataset 对数据集中的敏感数据进行脱敏
func (d *SensitiveDataDetector) MaskDataset(
	data [][]interface{},
	fieldTypes map[int]SensitiveDataType,
	strategies map[int]MaskingStrategy,
) [][]interface{} {
	result := make([][]interface{}, len(data))

	for rowIdx, row := range data {
		newRow := make([]interface{}, len(row))
		copy(newRow, row)

		for colIdx, dataType := range fieldTypes {
			if colIdx < len(row) && row[colIdx] != nil {
				value := fmt.Sprintf("%v", row[colIdx])
				strategy := strategies[colIdx]
				if strategy == "" {
					strategy = MaskPartial
				}
				newRow[colIdx] = d.Mask(value, dataType, strategy)
			}
		}

		result[rowIdx] = newRow
	}

	return result
}

// MaskResult 脱敏结果
type MaskResult struct {
	Success        bool                         `json:"success"`
	MaskedCount    int                          `json:"maskedCount"`
	AffectedFields map[int][]SensitiveDataMatch `json:"affectedFields"`
}
