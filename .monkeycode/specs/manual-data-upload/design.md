# 手动上传数据源功能 - 技术设计文档

**版本**: 1.0  
**日期**: 2026-01-03  
**状态**: 草稿

---

## 1. 系统架构

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Frontend)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 上传页面 │  │ 预览页面 │  │ 清洗向导 │  │ 数据集管理│   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│       └─────────────┴──────┬──────┴─────────────┘          │
│                            │                                 │
│                    ┌───────▼────────┐                       │
│                    │   API Client   │                       │
│                    └───────┬────────┘                       │
└────────────────────────────┼────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────┼────────────────────────────────┐
│                        API 网关                              │
│                    ┌───────▼────────┐                       │
│                    │   Auth Check   │                       │
│                    └───────┬────────┘                       │
└────────────────────────────┼────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────┐
│                      后端服务 (Backend)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 上传服务     │  │ 解析服务     │  │ 质检服务     │      │
│  │ Upload API   │  │ Parser API   │  │ Quality API  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐      │
│  │ 清洗服务     │  │ 数据集服务   │  │ OCR 服务      │      │
│  │ Clean API    │  │ Dataset API  │  │ OCR API      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└───────────┼────────────────┼─────────────────┼──────────────┘
            │                │                 │
            ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                        消息队列                               │
│                    (RabbitMQ / Kafka)                       │
│                   异步处理长时间任务                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                       Worker 集群                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 文件解析     │  │ 数据质检     │  │ OCR 识别     │      │
│  │ Worker       │  │ Worker       │  │ Worker       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                        存储层                                 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 对象存储     │  │ 关系数据库   │  │ 缓存         │      │
│  │ (S3/OSS)     │  │ (PostgreSQL) │  │ (Redis)      │      │
│  │ 原始文件     │  │ 元数据       │  │ 会话/临时数据 │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈选型

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 前端 | React + TypeScript | 组件化开发，类型安全 |
| UI 框架 | Ant Design / Material UI | 快速构建企业级 UI |
| 文件上传 | react-dropzone | 支持拖拽上传 |
| 表格展示 | AG Grid / Ant Table | 大数据量表格性能 |
| 后端 | Node.js (NestJS) / Python (FastAPI) | 高并发，易扩展 |
| 文件解析 | Python (pandas, openpyxl) | 强大的数据处理能力 |
| OCR | Tesseract / 百度 OCR | 开源/商业可选 |
| 数据库 | PostgreSQL | JSON 支持好，扩展性强 |
| 对象存储 | AWS S3 / 阿里云 OSS | 海量文件存储 |
| 消息队列 | RabbitMQ / Kafka | 异步任务处理 |
| 缓存 | Redis | 热点数据缓存 |

---

## 2. 核心模块设计

### 2.1 文件上传模块

#### 2.1.1 接口设计

```typescript
// 上传请求
interface UploadRequest {
  fileId: string;           // 前端生成的唯一 ID
  fileName: string;         // 原始文件名
  fileSize: number;         // 文件大小（字节）
  fileType: string;         // MIME 类型
  uploadMode: 'single' | 'batch';  // 上传模式
  mergeStrategy?: 'merge' | 'independent';  // 批量上传时的合并策略
}

// 上传响应
interface UploadResponse {
  fileId: string;
  uploadUrl: string;        // 预签名上传 URL（直传对象存储）
  expiresAt: number;        // URL 过期时间
}

// 上传完成回调
interface UploadCompleteRequest {
  fileId: string;
  objectKey: string;        // 对象存储中的 key
  etag: string;             // 文件 MD5
}
```

#### 2.1.2 上传流程

```
前端                          后端                          对象存储
 │                             │                              │
 ├─(1) 请求上传 URL───────────►│                              │
 │                             │                              │
 │                             ├─(2) 生成预签名 URL──────────►│
 │                             │                              │
 │◄─(3) 返回 uploadUrl─────────│                              │
 │                             │                              │
 ├─(4) 直传文件──────────────────────────────────────────────►│
 │                             │                              │
 │                             │                              │
 │                             │◄─────(5) 上传成功回调────────┤
 │                             │                              │
 ├─(6) 通知上传完成───────────►│                              │
 │                             │                              │
 │                             ├─(7) 创建数据集记录           │
 │                             │     状态：uploading          │
 │                             │                              │
 │                             ├─(8) 触发解析任务─────────────►│
 │                             │     (消息队列)               │
 │                             │                              │
 │◄─(9) 返回解析任务 ID────────│                              │
 │                             │                              │
 │                             │                              │
 ◄─────(10) 轮询/推送解析进度──│                              │
```

#### 2.1.3 代码示例

```typescript
// frontend/src/services/upload.service.ts
export class UploadService {
  async getUploadUrl(file: File, options: UploadOptions): Promise<UploadUrl> {
    const response = await api.post('/upload/init', {
      fileId: generateUUID(),
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadMode: options.batch ? 'batch' : 'single',
      mergeStrategy: options.mergeStrategy,
    });
    return response.data;
  }

  async uploadFile(url: string, file: File, onProgress: (progress: number) => void): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.put(url, file, {
      headers: { 'Content-Type': file.type },
      onUploadProgress: (event) => {
        const progress = Math.round((event.loaded * 100) / event.total);
        onProgress(progress);
      },
    });
    
    return response.headers['etag'];
  }

  async completeUpload(fileId: string, objectKey: string, etag: string): Promise<ParseTask> {
    const response = await api.post('/upload/complete', {
      fileId,
      objectKey,
      etag,
    });
    return response.data;
  }
}
```

---

### 2.2 文件解析模块

#### 2.2.1 解析器架构

```
┌─────────────────────────────────────────────────────────┐
│                    解析器工厂 (Factory)                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ ExcelParser │  │ CSVParser   │  │ JSONParser  │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│         └────────────────┴────────────────┘             │
│                          │                              │
│              ┌───────────▼───────────┐                 │
│              │    统一数据模型        │                 │
│              │   (UnifiedDataSet)   │                 │
│              └───────────────────────┘                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 2.2.2 统一数据模型

```typescript
// 数据集
interface DataSet {
  id: string;
  name: string;
  sourceFile: string;         // 原始文件对象存储 key
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;            // 用户 ID
  status: 'parsing' | 'ready' | 'error';
  metadata: DataSetMetadata;
  schema: DataSchema;
}

// 元数据
interface DataSetMetadata {
  rowCount: number;
  columnCount: number;
  fileSize: number;
  fileFormat: string;
  encoding?: string;
  parseDuration: number;      // 解析耗时（毫秒）
}

// 数据模式
interface DataSchema {
  fields: FieldSchema[];
  primaryKey?: string[];
  indexes?: string[];
}

// 字段模式
interface FieldSchema {
  name: string;
  originalName: string;       // 原始列名
  type: FieldType;
  nullable: boolean;
  unique: boolean;
  statistics?: FieldStatistics;
}

// 字段类型
enum FieldType {
  STRING = 'string',
  INTEGER = 'integer',
  FLOAT = 'float',
  BOOLEAN = 'boolean',
  DATE = 'date',
  DATETIME = 'datetime',
  UNKNOWN = 'unknown',
}

// 字段统计
interface FieldStatistics {
  nullCount: number;
  nullRatio: number;
  uniqueCount: number;
  uniqueRatio: number;
  minValue?: number | Date;
  maxValue?: number | Date;
  mean?: number;
  median?: number;
  topValues?: { value: string; count: number }[];
}
```

#### 2.2.3 类型推断算法

```python
# backend/src/parsers/type_inference.py

import re
from datetime import datetime
from typing import List, Optional

class TypeInference:
    # 日期格式模式
    DATE_PATTERNS = [
        r'^\d{4}-\d{2}-\d{2}$',      # 2024-01-15
        r'^\d{4}/\d{2}/\d{2}$',      # 2024/01/15
        r'^\d{2}-\d{2}-\d{4}$',      # 01-15-2024
        r'^\d{2}/\d{2}/\d{4}$',      # 01/15/2024
        r'^\d{4}年\d{1,2}月\d{1,2}日$', # 2024 年 1 月 15 日
    ]
    
    # 数字格式模式
    NUMBER_PATTERN = r'^-?\d+(,\d{3})*(\.\d+)?$'
    CURRENCY_PATTERN = r'^[¥$€£]?\s*-?\d+(,\d{3})*(\.\d{2})?$'
    
    # 布尔值
    BOOLEAN_VALUES = {'true', 'false', 'yes', 'no', '是', '否', '1', '0'}
    
    @classmethod
    def infer_type(cls, values: List[Optional[str]]) -> FieldType:
        """推断字段类型"""
        non_null_values = [v for v in values if v is not None and str(v).strip()]
        
        if not non_null_values:
            return FieldType.UNKNOWN
        
        # 采样检查（最多检查 100 个值）
        sample = non_null_values[:100]
        
        # 检查布尔值
        if all(str(v).lower() in cls.BOOLEAN_VALUES for v in sample):
            return FieldType.BOOLEAN
        
        # 检查日期
        if all(cls._is_date(str(v)) for v in sample):
            if cls._has_time(sample):
                return FieldType.DATETIME
            return FieldType.DATE
        
        # 检查数值
        if all(cls._is_number(str(v)) for v in sample):
            if any(cls._is_float(str(v)) for v in sample):
                return FieldType.FLOAT
            return FieldType.INTEGER
        
        return FieldType.STRING
    
    @classmethod
    def _is_date(cls, value: str) -> bool:
        """检查是否为日期格式"""
        for pattern in cls.DATE_PATTERNS:
            if re.match(pattern, value):
                return True
        
        # 尝试解析常见日期格式
        date_formats = [
            '%Y-%m-%d', '%Y/%m/%d', '%m-%d-%Y', '%m/%d/%Y',
            '%Y年%m月%d日', '%Y-%m-%d %H:%M:%S',
        ]
        for fmt in date_formats:
            try:
                datetime.strptime(value, fmt)
                return True
            except ValueError:
                continue
        
        return False
    
    @classmethod
    def _is_number(cls, value: str) -> bool:
        """检查是否为数字（包含货币符号和千分位）"""
        # 移除货币符号和空格
        cleaned = re.sub(r'[¥$€£\s]', '', value)
        # 移除千分位逗号
        cleaned = cleaned.replace(',', '')
        
        try:
            float(cleaned)
            return True
        except ValueError:
            return False
    
    @classmethod
    def _is_float(cls, value: str) -> bool:
        """检查是否为浮点数"""
        cleaned = re.sub(r'[¥$€£\s,]', '', value)
        try:
            return '.' in cleaned and float(cleaned) % 1 != 0
        except ValueError:
            return False
    
    @classmethod
    def _has_time(cls, values: List[str]) -> bool:
        """检查是否包含时间部分"""
        time_patterns = [
            r'\d{2}:\d{2}',
            r'\d{2}:\d{2}:\d{2}',
            r'\d{2}时\d{2}分',
        ]
        for value in values:
            for pattern in time_patterns:
                if re.search(pattern, value):
                    return True
        return False
```

---

### 2.3 数据质检模块

#### 2.3.1 质检规则引擎

```typescript
// 质检规则
interface QualityRule {
  id: string;
  name: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  check: (data: DataSet, field: FieldSchema) => QualityIssue[];
  fix?: (data: DataSet, field: FieldSchema, issue: QualityIssue) => Promise<DataSet>;
}

// 质检问题
interface QualityIssue {
  ruleId: string;
  field: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  affectedRows?: number[];
  affectedRatio?: number;
  suggestion?: string;
  fixPreview?: FixPreview;
}

// 修复预览
interface FixPreview {
  before: string;
  after: string;
  changedRows: number;
}
```

#### 2.3.2 内置质检规则

```python
# backend/src/quality/rules.py

from abc import ABC, abstractmethod
from typing import List, Optional
from dataclasses import dataclass

@dataclass
class QualityIssue:
    rule_id: str
    field: str
    severity: str
    message: str
    affected_rows: Optional[List[int]] = None
    affected_ratio: Optional[float] = None
    suggestion: Optional[str] = None

class QualityRule(ABC):
    @abstractmethod
    def check(self, data: 'DataSet', field: 'FieldSchema') -> List[QualityIssue]:
        pass

class NullValueRule(QualityRule):
    """空值检测规则"""
    
    id = 'null_value'
    name = '空值检测'
    severity = 'medium'
    
    def check(self, data: 'DataSet', field: 'FieldSchema') -> List[QualityIssue]:
        null_count = field.statistics.null_count
        null_ratio = field.statistics.null_ratio
        
        issues = []
        
        if null_ratio > 0.5:
            issues.append(QualityIssue(
                rule_id=self.id,
                field=field.name,
                severity='high',
                message=f'字段"{field.name}"空值比例过高 ({null_ratio:.1%})',
                affected_ratio=null_ratio,
                suggestion='考虑删除该字段或使用默认值填充',
            ))
        elif null_ratio > 0.1:
            issues.append(QualityIssue(
                rule_id=self.id,
                field=field.name,
                severity='medium',
                message=f'字段"{field.name}"存在空值 ({null_ratio:.1%})',
                affected_ratio=null_ratio,
                suggestion='考虑填充空值',
            ))
        
        return issues

class FormatInconsistencyRule(QualityRule):
    """格式不一致检测规则"""
    
    id = 'format_inconsistency'
    name = '格式一致性检测'
    severity = 'medium'
    
    def check(self, data: 'DataSet', field: 'FieldSchema') -> List[QualityIssue]:
        if field.type != 'date' and field.type != 'datetime':
            return []
        
        # 检测多种日期格式混用
        formats_detected = self._detect_date_formats(
            data.get_column_values(field.name)
        )
        
        if len(formats_detected) > 1:
            return [QualityIssue(
                rule_id=self.id,
                field=field.name,
                severity='medium',
                message=f'字段"{field.name}"存在多种日期格式：{", ".join(formats_detected)}',
                suggestion='统一日期格式',
            )]
        
        return []
    
    def _detect_date_formats(self, values: List[str]) -> List[str]:
        formats = set()
        for value in values[:100]:
            if not value:
                continue
            
            # 尝试匹配常见格式
            if re.match(r'^\d{4}-\d{2}-\d{2}$', value):
                formats.add('YYYY-MM-DD')
            elif re.match(r'^\d{4}/\d{2}/\d{2}$', value):
                formats.add('YYYY/MM/DD')
            elif re.match(r'^\d{2}-\d{2}-\d{4}$', value):
                formats.add('MM-DD-YYYY')
            elif re.match(r'^\d{4}年\d{1,2}月\d{1,2}日$', value):
                formats.add('YYYY 年 M 月 D 日')
        
        return list(formats)

class DuplicateDataRule(QualityRule):
    """重复数据检测规则"""
    
    id = 'duplicate_data'
    name = '重复数据检测'
    severity = 'low'
    
    def check(self, data: 'DataSet', field: 'FieldSchema') -> List[QualityIssue]:
        if not field.unique and field.unique_ratio < 0.1:
            return []
        
        # 检测完全重复的行
        duplicate_rows = data.find_duplicate_rows()
        
        if len(duplicate_rows) > 0:
            return [QualityIssue(
                rule_id=self.id,
                field='__row__',
                severity='low',
                message=f'发现 {len(duplicate_rows)} 行重复数据',
                affected_rows=duplicate_rows,
                suggestion='删除重复数据',
            )]
        
        return []

class OutlierRule(QualityRule):
    """异常值检测规则"""
    
    id = 'outlier'
    name = '异常值检测'
    severity = 'medium'
    
    def check(self, data: 'DataSet', field: 'FieldSchema') -> List[QualityIssue]:
        if field.type not in ['integer', 'float']:
            return []
        
        stats = field.statistics
        if stats.mean is None or stats.median is None:
            return []
        
        # 使用 IQR 方法检测异常值
        values = data.get_column_values(field.name)
        outliers = self._find_outliers_iqr(values)
        
        if len(outliers) > 0:
            return [QualityIssue(
                rule_id=self.id,
                field=field.name,
                severity='medium',
                message=f'字段"{field.name}"发现 {len(outliers)} 个异常值',
                affected_rows=outliers,
                suggestion='检查异常值是否为录入错误',
            )]
        
        return []
    
    def _find_outliers_iqr(self, values: List[float]) -> List[int]:
        import numpy as np
        
        arr = np.array([v for v in values if v is not None])
        q1 = np.percentile(arr, 25)
        q3 = np.percentile(arr, 75)
        iqr = q3 - q1
        
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        outlier_indices = []
        for i, v in enumerate(values):
            if v is not None and (v < lower_bound or v > upper_bound):
                outlier_indices.append(i)
        
        return outlier_indices
```

---

### 2.4 数据清洗模块

#### 2.4.1 清洗操作接口

```typescript
// 清洗操作
interface CleanOperation {
  type: CleanOperationType;
  target: {
    fields?: string[];
    rows?: number[];
  };
  options: {
    [key: string]: any;
  };
}

// 清洗操作类型
enum CleanOperationType {
  UNIFY_DATE_FORMAT = 'unify_date_format',
  EXTRACT_NUMBER = 'extract_number',
  REMOVE_DUPLICATES = 'remove_duplicates',
  FILL_NULL = 'fill_null',
  REMOVE_EMPTY_ROWS = 'remove_empty_rows',
  TRIM_WHITESPACE = 'trim_whitespace',
  REPLACE_VALUE = 'replace_value',
}

// 清洗结果
interface CleanResult {
  success: boolean;
  changes: {
    modifiedRows: number;
    modifiedFields: string[];
    before: any;
    after: any;
  };
  error?: string;
}
```

#### 2.4.2 清洗操作实现

```python
# backend/src/clean/operations.py

import pandas as pd
import re
from typing import Dict, Any, List

class CleanOperation:
    def apply(self, df: pd.DataFrame, options: Dict[str, Any]) -> pd.DataFrame:
        raise NotImplementedError

class UnifyDateFormatOperation(CleanOperation):
    """统一日期格式"""
    
    def apply(self, df: pd.DataFrame, options: Dict[str, Any]) -> pd.DataFrame:
        field = options['field']
        target_format = options.get('format', '%Y-%m-%d')
        
        def parse_and_format(value):
            if pd.isna(value):
                return value
            
            # 尝试解析各种日期格式
            date_formats = [
                '%Y-%m-%d', '%Y/%m/%d', '%m-%d-%Y', '%m/%d/%Y',
                '%Y年%m月%d日', '%d-%m-%Y', '%d/%m/%Y',
            ]
            
            for fmt in date_formats:
                try:
                    dt = pd.to_datetime(str(value), format=fmt)
                    return dt.strftime(target_format)
                except:
                    continue
            
            # 尝试 pandas 自动解析
            try:
                dt = pd.to_datetime(str(value))
                return dt.strftime(target_format)
            except:
                return value
        
        df[field] = df[field].apply(parse_and_format)
        return df

class ExtractNumberOperation(CleanOperation):
    """提取数值（从包含货币符号的字符串）"""
    
    def apply(self, df: pd.DataFrame, options: Dict[str, Any]) -> pd.DataFrame:
        field = options['field']
        
        def extract_number(value):
            if pd.isna(value):
                return value
            
            # 移除货币符号和空格
            cleaned = re.sub(r'[¥$€£\s]', '', str(value))
            # 移除千分位逗号
            cleaned = cleaned.replace(',', '')
            
            try:
                return float(cleaned)
            except ValueError:
                return value
        
        df[field] = df[field].apply(extract_number)
        return df

class RemoveDuplicatesOperation(CleanOperation):
    """删除重复数据"""
    
    def apply(self, df: pd.DataFrame, options: Dict[str, Any]) -> pd.DataFrame:
        subset = options.get('fields', None)
        keep = options.get('keep', 'first')
        
        return df.drop_duplicates(subset=subset, keep=keep)

class FillNullOperation(CleanOperation):
    """填充空值"""
    
    def apply(self, df: pd.DataFrame, options: Dict[str, Any]) -> pd.DataFrame:
        field = options['field']
        strategy = options.get('strategy', 'value')
        
        if strategy == 'value':
            fill_value = options.get('value')
            df[field] = df[field].fillna(fill_value)
        
        elif strategy == 'mean':
            df[field] = df[field].fillna(df[field].mean())
        
        elif strategy == 'median':
            df[field] = df[field].fillna(df[field].median())
        
        elif strategy == 'mode':
            df[field] = df[field].fillna(df[field].mode()[0])
        
        elif strategy == 'forward':
            df[field] = df[field].fillna(method='ffill')
        
        elif strategy == 'backward':
            df[field] = df[field].fillna(method='bfill')
        
        return df
```

---

### 2.5 数据集管理模块

#### 2.5.1 数据模型设计

```sql
-- PostgreSQL 数据库表设计

-- 数据集表
CREATE TABLE datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_file_key VARCHAR(512) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_format VARCHAR(50) NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    column_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'parsing',
    schema JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    INDEX idx_datasets_owner_id (owner_id),
    INDEX idx_datasets_status (status),
    INDEX idx_datasets_created_at (created_at)
);

-- 数据集版本表
CREATE TABLE dataset_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id),
    version INTEGER NOT NULL,
    source_file_key VARCHAR(512) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    row_count INTEGER NOT NULL,
    column_count INTEGER NOT NULL,
    change_summary TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE (dataset_id, version),
    INDEX idx_dataset_versions_dataset_id (dataset_id)
);

-- 数据质量问题表
CREATE TABLE data_quality_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id),
    rule_id VARCHAR(100) NOT NULL,
    field_name VARCHAR(255),
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    affected_rows INTEGER[],
    affected_ratio DECIMAL(5,4),
    suggestion TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_quality_issues_dataset_id (dataset_id),
    INDEX idx_quality_issues_status (status)
);

-- 数据访问日志表
CREATE TABLE dataset_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id),
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_access_logs_dataset_id (dataset_id),
    INDEX idx_access_logs_user_id (user_id),
    INDEX idx_access_logs_created_at (created_at)
);
```

#### 2.5.2 API 接口设计

```typescript
// 数据集 CRUD 接口

// 列出数据集
GET /api/datasets
Query: {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  order?: 'asc' | 'desc';
}

Response: {
  data: DataSet[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// 获取数据集详情
GET /api/datasets/:id

Response: DataSet & {
  qualityIssues: QualityIssue[];
  versions: DataSetVersion[];
  usageCount: number;
}

// 更新数据集（上传新文件）
PUT /api/datasets/:id

Request: {
  file: File;
  changeSummary?: string;
}

// 删除数据集
DELETE /api/datasets/:id

Request: {
  force?: boolean;  // 是否强制删除（即使被使用）
}

// 获取数据预览
GET /api/datasets/:id/preview
Query: {
  limit?: number;    // 默认 100
  offset?: number;
}

Response: {
  data: any[][];
  schema: DataSchema;
  totalRows: number;
}

// 获取数据集统计信息
GET /api/datasets/:id/statistics

Response: {
  rowCount: number;
  columnCount: number;
  fieldStatistics: {
    [fieldName: string]: FieldStatistics;
  };
}

// 获取版本历史
GET /api/datasets/:id/versions

Response: DataSetVersion[]

// 回退到指定版本
POST /api/datasets/:id/versions/:versionId/rollback

// 执行清洗操作
POST /api/datasets/:id/clean

Request: {
  operations: CleanOperation[];
}

Response: {
  success: boolean;
  result: CleanResult[];
}
```

---

### 2.6 OCR 模块（可选）

#### 2.6.1 OCR 服务架构

```
┌─────────────────────────────────────────────────────────┐
│                     OCR 服务                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │ 图像预处理  │───►│ 版面分析    │───►│ 文字识别    │ │
│  │ Preprocess  │    │ Layout      │    │ OCR Engine  │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│                                          │              │
│                                   ┌──────▼──────┐      │
│                                   │ 表格结构还原 │      │
│                                   │ Table Recon │      │
│                                   └─────────────┘      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 2.6.2 OCR 处理流程

```python
# backend/src/ocr/service.py

import cv2
import numpy as np
from PIL import Image
import pytesseract
from typing import List, Dict, Any

class OCRService:
    def __init__(self, tesseract_cmd: str = '/usr/bin/tesseract'):
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
    
    def process_image(self, image_path: str) -> OCRResult:
        """处理图片并提取表格数据"""
        
        # 1. 读取图片
        image = cv2.imread(image_path)
        
        # 2. 预处理
        preprocessed = self._preprocess(image)
        
        # 3. 版面分析（检测表格区域）
        table_regions = self._detect_tables(preprocessed)
        
        # 4. OCR 识别
        ocr_results = []
        for region in table_regions:
            roi = preprocessed[region['y']:region['y']+region['h'], 
                              region['x']:region['x']+region['w']]
            
            # 使用 Tesseract 识别
            ocr_data = pytesseract.image_to_data(
                roi, 
                output_type=pytesseract.Output.DICT,
                lang='chi_sim+eng'  # 中英文混合
            )
            
            # 5. 表格结构还原
            table_data = self._reconstruct_table(ocr_data, region)
            ocr_results.append(table_data)
        
        return OCRResult(
            tables=ocr_results,
            confidence=self._calculate_confidence(ocr_data),
        )
    
    def _preprocess(self, image: np.ndarray) -> np.ndarray:
        """图像预处理"""
        # 转灰度
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 去噪
        denoised = cv2.fastNlMeansDenoising(gray)
        
        # 二值化（自适应阈值）
        binary = cv2.adaptiveThreshold(
            denoised, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 11, 2
        )
        
        return binary
    
    def _detect_tables(self, image: np.ndarray) -> List[Dict[str, int]]:
        """检测表格区域"""
        # 使用形态学操作检测表格线
        horizontal_kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT, (40, 1)
        )
        vertical_kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT, (1, 40)
        )
        
        # 检测水平线
        horizontal_lines = cv2.morphologyEx(
            image, cv2.MORPH_OPEN, horizontal_kernel, iterations=2
        )
        
        # 检测垂直线
        vertical_lines = cv2.morphologyEx(
            image, cv2.MORPH_OPEN, vertical_kernel, iterations=2
        )
        
        # 合并线条
        table_mask = cv2.addWeighted(
            horizontal_lines, 0.5, vertical_lines, 0.5, 0
        )
        _, table_mask = cv2.threshold(table_mask, 0, 255, cv2.THRESH_BINARY)
        
        # 查找轮廓
        contours, _ = cv2.findContours(
            table_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        
        # 提取表格区域
        table_regions = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if w > 100 and h > 50:  # 最小表格尺寸
                table_regions.append({'x': x, 'y': y, 'w': w, 'h': h})
        
        return table_regions
    
    def _reconstruct_table(
        self, 
        ocr_data: Dict[str, List], 
        region: Dict[str, int]
    ) -> List[List[str]]:
        """根据 OCR 结果还原表格结构"""
        # 实现表格结构还原逻辑
        # 根据文字的 x,y 坐标推断行列关系
        pass
```

---

## 3. 安全设计

### 3.1 认证与授权

```typescript
// JWT Token 结构
interface JWTPayload {
  sub: string;        // 用户 ID
  email: string;
  roles: string[];
  iat: number;        // 签发时间
  exp: number;        // 过期时间
}

// 权限控制中间件
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: '未授权' });
  }
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    
    // 检查数据集所有权
    const datasetId = req.params.id;
    if (datasetId) {
      const dataset = await getDataset(datasetId);
      if (dataset.ownerId !== payload.sub) {
        return res.status(403).json({ error: '无权访问' });
      }
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token 无效' });
  }
}
```

### 3.2 数据加密

```python
# backend/src/security/encryption.py

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os

class DataEncryption:
    def __init__(self, master_key: bytes):
        self.master_key = master_key
    
    def _derive_key(self, salt: bytes) -> bytes:
        """从主密钥派生加密密钥"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        return base64.urlsafe_b64encode(kdf.derive(self.master_key))
    
    def encrypt(self, plaintext: str) -> str:
        """加密数据"""
        salt = os.urandom(16)
        key = self._derive_key(salt)
        f = Fernet(key)
        
        encrypted = f.encrypt(plaintext.encode())
        return base64.b64encode(salt + encrypted).decode()
    
    def decrypt(self, ciphertext: str) -> str:
        """解密数据"""
        data = base64.b64decode(ciphertext)
        salt = data[:16]
        encrypted = data[16:]
        
        key = self._derive_key(salt)
        f = Fernet(key)
        
        return f.decrypt(encrypted).decode()
```

### 3.3 敏感数据识别

```python
# backend/src/security/sensitive_data.py

import re
from typing import List, Tuple

class SensitiveDataDetector:
    """敏感数据检测器"""
    
    # 身份证号正则（18 位）
    ID_CARD_PATTERN = re.compile(
        r'^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$'
    )
    
    # 手机号正则
    PHONE_PATTERN = re.compile(r'^1[3-9]\d{9}$')
    
    # 银行卡号正则
    BANK_CARD_PATTERN = re.compile(r'^[1-9]\d{15,18}$')
    
    # 邮箱正则
    EMAIL_PATTERN = re.compile(r'^[\w\.-]+@[\w\.-]+\.\w+$')
    
    @classmethod
    def detect(cls, value: str) -> List[str]:
        """检测字符串中的敏感数据类型"""
        if not value or len(value) > 50:
            return []
        
        types = []
        
        if cls.ID_CARD_PATTERN.match(value):
            types.append('id_card')
        
        if cls.PHONE_PATTERN.match(value):
            types.append('phone')
        
        if cls.BANK_CARD_PATTERN.match(value):
            types.append('bank_card')
        
        if cls.EMAIL_PATTERN.match(value):
            types.append('email')
        
        return types
    
    @classmethod
    def mask(cls, value: str, data_type: str) -> str:
        """脱敏处理"""
        if not value:
            return value
        
        if data_type == 'id_card':
            return value[:6] + '****' + value[-4:]
        
        elif data_type == 'phone':
            return value[:3] + '****' + value[-4:]
        
        elif data_type == 'bank_card':
            return '****' + value[-4:]
        
        elif data_type == 'email':
            parts = value.split('@')
            return parts[0][0] + '****@' + parts[1]
        
        return value
```

---

## 4. 性能优化

### 4.1 大文件分片上传

```typescript
// 分片上传策略
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

async function uploadInChunks(file: File, uploadUrl: string): Promise<string> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const etags: string[] = [];
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    const response = await axios.put(`${uploadUrl}?partNumber=${i + 1}`, chunk, {
      headers: {
        'Content-Type': file.type,
        'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
      },
    });
    
    etags.push(response.headers['etag']);
  }
  
  // 完成分片上传
  const completeResponse = await axios.post(`${uploadUrl}/complete`, {
    etags,
  });
  
  return completeResponse.data.objectKey;
}
```

### 4.2 数据分页加载

```typescript
// 后端分页查询
GET /api/datasets/:id/data?page=1&limit=100

// SQL 优化
SELECT * FROM dataset_data
WHERE dataset_id = $1
ORDER BY row_index
OFFSET $2 LIMIT $3;

// 使用游标分页（大数据量场景）
SELECT * FROM dataset_data
WHERE dataset_id = $1 AND row_index > $2
ORDER BY row_index
LIMIT $3;
```

### 4.3 缓存策略

```python
# Redis 缓存配置
from redis import Redis
import json

class DataCache:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
        self.ttl = 3600  # 1 小时
    
    def get_preview(self, dataset_id: str, page: int, limit: int) -> Optional[dict]:
        """获取数据预览缓存"""
        key = f"dataset:preview:{dataset_id}:{page}:{limit}"
        data = self.redis.get(key)
        return json.loads(data) if data else None
    
    def set_preview(self, dataset_id: str, page: int, limit: int, data: dict):
        """设置数据预览缓存"""
        key = f"dataset:preview:{dataset_id}:{page}:{limit}"
        self.redis.setex(key, self.ttl, json.dumps(data))
    
    def invalidate(self, dataset_id: str):
        """数据集更新时失效缓存"""
        pattern = f"dataset:preview:{dataset_id}:*"
        keys = self.redis.keys(pattern)
        if keys:
            self.redis.delete(*keys)
```

---

## 5. 错误处理

### 5.1 错误码定义

```typescript
enum ErrorCode {
  // 上传错误 (1000-1999)
  UPLOAD_FAILED = 1001,
  FILE_TOO_LARGE = 1002,
  UNSUPPORTED_FORMAT = 1003,
  UPLOAD_TIMEOUT = 1004,
  
  // 解析错误 (2000-2999)
  PARSE_FAILED = 2001,
  ENCODING_ERROR = 2002,
  INVALID_FORMAT = 2003,
  DATA_TOO_LARGE = 2004,
  
  // 质检错误 (3000-3999)
  QUALITY_CHECK_FAILED = 3001,
  
  // 清洗错误 (4000-4999)
  CLEAN_FAILED = 4001,
  INVALID_OPERATION = 4002,
  
  // 数据集错误 (5000-5999)
  DATASET_NOT_FOUND = 5001,
  DATASET_IN_USE = 5002,
  DATASET_DELETED = 5003,
  
  // OCR 错误 (6000-6999)
  OCR_FAILED = 6001,
  IMAGE_TOO_LARGE = 6002,
  LOW_CONFIDENCE = 6003,
}
```

### 5.2 错误响应格式

```typescript
interface ErrorResponse {
  code: ErrorCode;
  message: string;
  details?: {
    field?: string;
    reason?: string;
    suggestion?: string;
  };
  requestId: string;
  timestamp: number;
}

// 示例
{
  "code": 2003,
  "message": "文件格式无效",
  "details": {
    "field": "file",
    "reason": "Excel 文件损坏或格式不正确",
    "suggestion": "请尝试重新导出 Excel 文件或使用 CSV 格式"
  },
  "requestId": "req_abc123",
  "timestamp": 1704326400000
}
```

---

## 6. 部署架构

### 6.1 环境要求

| 组件 | 最低配置 | 推荐配置 |
|------|---------|---------|
| API 服务器 | 2 核 4GB | 4 核 8GB |
| Worker 节点 | 4 核 8GB | 8 核 16GB |
| PostgreSQL | 4 核 8GB | 8 核 16GB |
| Redis | 1 核 2GB | 2 核 4GB |
| 对象存储 | - | AWS S3 / 阿里云 OSS |

### 6.2 Docker 部署

```yaml
# docker-compose.yml

version: '3.8'

services:
  api:
    image: data-platform/api:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/dataplatform
      - REDIS_URL=redis://redis:6379
      - S3_BUCKET=uploads
      - S3_REGION=us-east-1
    depends_on:
      - db
      - redis

  worker:
    image: data-platform/worker:latest
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/dataplatform
      - REDIS_URL=redis://redis:6379
      - S3_BUCKET=uploads
      - TESSERACT_PATH=/usr/bin/tesseract
    depends_on:
      - db
      - redis
      - rabbitmq

  db:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=dataplatform

  redis:
    image: redis:7-alpine

  rabbitmq:
    image: rabbitmq:3-management

volumes:
  postgres_data:
```

---

## 7. 测试策略

### 7.1 单元测试

```typescript
// 解析器测试
describe('ExcelParser', () => {
  it('should parse valid Excel file', async () => {
    const parser = new ExcelParser();
    const result = await parser.parse('test-data/sample.xlsx');
    
    expect(result.rowCount).toBe(100);
    expect(result.columnCount).toBe(10);
    expect(result.schema.fields).toHaveLength(10);
  });
  
  it('should handle encoding issues', async () => {
    const parser = new ExcelParser();
    await expect(parser.parse('test-data/invalid.xlsx'))
      .rejects.toThrow(ParseError);
  });
});
```

### 7.2 集成测试

```python
# 端到端测试
def test_upload_and_parse_workflow():
    # 1. 上传文件
    with open('test-data/sales.xlsx', 'rb') as f:
        response = client.post('/api/upload', files={'file': f})
    
    assert response.status_code == 200
    file_id = response.json()['fileId']
    
    # 2. 等待解析完成
    wait_for_parse_complete(file_id)
    
    # 3. 获取数据集详情
    response = client.get(f'/api/datasets/{file_id}')
    assert response.status_code == 200
    
    dataset = response.json()
    assert dataset['status'] == 'ready'
    assert dataset['rowCount'] > 0
    
    # 4. 获取质检结果
    response = client.get(f'/api/datasets/{file_id}/quality')
    assert response.status_code == 200
    
    issues = response.json()
    assert isinstance(issues, list)
```

---

## 8. 监控与告警

### 8.1 关键指标

| 指标 | 阈值 | 告警级别 |
|------|------|---------|
| 上传失败率 | > 5% | Warning |
| 解析失败率 | > 3% | Warning |
| 平均解析时间 | > 30s | Warning |
| Worker 队列积压 | > 100 | Warning |
| API 错误率 | > 1% | Critical |
| API P99 延迟 | > 2s | Warning |

### 8.2 日志记录

```python
# 结构化日志
import structlog

logger = structlog.get_logger()

def parse_file(file_id: str, file_path: str):
    logger.info("parse_started", file_id=file_id, file_path=file_path)
    
    try:
        result = parser.parse(file_path)
        logger.info(
            "parse_completed", 
            file_id=file_id,
            row_count=result.row_count,
            duration=result.parse_duration,
        )
    except Exception as e:
        logger.error(
            "parse_failed",
            file_id=file_id,
            error=str(e),
            exc_info=True,
        )
        raise
```

---

## 9. 变更历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2026-01-03 | AI Assistant | 初始版本 |

---

## 10. 附录

### 10.1 支持的文件格式详解

| 格式 | 扩展名 | 解析库 | 备注 |
|------|-------|--------|------|
| Excel | .xlsx | openpyxl | 支持多工作表 |
| Excel | .xls | xlrd | 仅 Excel 2003 |
| CSV | .csv | pandas | 自动检测编码 |
| JSON | .json | json | 支持嵌套结构 |
| XML | .xml | lxml | 支持 XPath |
| PDF | .pdf | tabula-py | 仅表格内容 |
| Word | .docx | python-docx | 仅表格内容 |

### 10.2 参考资料

- [Apache Arrow](https://arrow.apache.org/) - 列式内存格式
- [Pandas 最佳实践](https://pandas.pydata.org/docs/user_guide/best_practices.html)
- [Tesseract OCR 文档](https://tesseract-ocr.github.io/)
