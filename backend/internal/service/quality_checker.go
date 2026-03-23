package service

import (
	"fmt"
	"strings"
)

// QualityIssue 质检问题
type QualityIssue struct {
	RuleID        string  `json:"ruleId"`
	RuleName      string  `json:"ruleName"`
	FieldName     string  `json:"fieldName"`
	Severity      string  `json:"severity"` // high/medium/low
	Message       string  `json:"message"`
	AffectedRows  []int   `json:"affectedRows,omitempty"`
	AffectedRatio float64 `json:"affectedRatio"`
	Suggestion    string  `json:"suggestion"`
}

// QualityChecker 质检检查器
type QualityChecker struct {
	rules []QualityRule
}

// QualityRule 质检规则
type QualityRule struct {
	ID       string
	Name     string
	Severity string
	Check    func(result *ParseResult, field FieldSchema) []QualityIssue
}

// NewQualityChecker 创建质检器
func NewQualityChecker() *QualityChecker {
	checker := &QualityChecker{
		rules: []QualityRule{
			{
				ID:       "null_value",
				Name:     "空值检测",
				Severity: "medium",
				Check:    checkNullValues,
			},
			{
				ID:       "duplicate_data",
				Name:     "重复数据检测",
				Severity: "low",
				Check:    checkDuplicateData,
			},
			{
				ID:       "format_inconsistency",
				Name:     "格式一致性检测",
				Severity: "medium",
				Check:    checkFormatInconsistency,
			},
		},
	}
	return checker
}

// Check 执行质检
func (c *QualityChecker) Check(result *ParseResult) []QualityIssue {
	var allIssues []QualityIssue

	if result.Schema == nil {
		return allIssues
	}

	// 对每个字段应用所有规则
	for _, field := range result.Schema.Fields {
		for _, rule := range c.rules {
			issues := rule.Check(result, field)
			for i := range issues {
				issues[i].RuleID = rule.ID
				issues[i].RuleName = rule.Name
				if issues[i].Severity == "" {
					issues[i].Severity = rule.Severity
				}
			}
			allIssues = append(allIssues, issues...)
		}
	}

	return allIssues
}

// checkNullValues 空值检测
func checkNullValues(result *ParseResult, field FieldSchema) []QualityIssue {
	var issues []QualityIssue

	if field.Statistics == nil {
		return issues
	}

	nullRatio := field.Statistics.NullRatio

	if nullRatio > 0.5 {
		issues = append(issues, QualityIssue{
			FieldName:     field.Name,
			Severity:      "high",
			Message:       "字段 \"" + field.Name + "\" 空值比例过高 (" + formatPercent(nullRatio) + ")",
			AffectedRatio: nullRatio,
			Suggestion:    "考虑删除该字段或使用默认值填充",
		})
	} else if nullRatio > 0.1 {
		issues = append(issues, QualityIssue{
			FieldName:     field.Name,
			Severity:      "medium",
			Message:       "字段 \"" + field.Name + "\" 存在空值 (" + formatPercent(nullRatio) + ")",
			AffectedRatio: nullRatio,
			Suggestion:    "考虑填充空值",
		})
	}

	return issues
}

// checkDuplicateData 重复数据检测
func checkDuplicateData(result *ParseResult, field FieldSchema) []QualityIssue {
	var issues []QualityIssue

	if field.Statistics == nil || field.Statistics.UniqueCount == 0 {
		return issues
	}

	totalCount := result.RowCount
	uniqueRatio := float64(field.Statistics.UniqueCount) / float64(totalCount)

	// 如果应该是唯一字段但重复率高
	if uniqueRatio < 0.9 && totalCount > 10 {
		issues = append(issues, QualityIssue{
			FieldName:     field.Name,
			Severity:      "low",
			Message:       "字段 \"" + field.Name + "\" 存在较多重复值 (唯一值占比 " + formatPercent(uniqueRatio) + ")",
			AffectedRatio: 1 - uniqueRatio,
			Suggestion:    "检查是否存在重复数据",
		})
	}

	return issues
}

// checkFormatInconsistency 格式一致性检测
func checkFormatInconsistency(result *ParseResult, field FieldSchema) []QualityIssue {
	var issues []QualityIssue

	// 日期字段检查多种格式混用
	if field.Type == "date" || field.Type == "datetime" {
		if field.Statistics != nil && len(field.Statistics.TopValues) > 1 {
			// 检查是否有不同的日期格式
			dateFormats := make(map[string]bool)
			for _, tv := range field.Statistics.TopValues {
				format := detectDateFormat(tv.Value)
				if format != "" {
					dateFormats[format] = true
				}
			}

			if len(dateFormats) > 1 {
				formats := make([]string, 0, len(dateFormats))
				for f := range dateFormats {
					formats = append(formats, f)
				}

				issues = append(issues, QualityIssue{
					FieldName:  field.Name,
					Severity:   "medium",
					Message:    "字段 \"" + field.Name + "\" 存在多种日期格式：" + strings.Join(formats, ", "),
					Suggestion: "统一日期格式",
				})
			}
		}
	}

	return issues
}

// detectDateFormat 检测日期格式
func detectDateFormat(value string) string {
	if value == "" {
		return ""
	}

	if strings.Contains(value, "-") && len(value) == 10 {
		return "YYYY-MM-DD"
	}
	if strings.Contains(value, "/") && len(value) == 10 {
		return "YYYY/MM/DD"
	}
	if strings.Contains(value, "年") {
		return "YYYY 年 M 月 D 日"
	}

	return ""
}

func formatPercent(ratio float64) string {
	return fmt.Sprintf("%.1f%%", ratio*100)
}
