'use client';

import { useState, useEffect } from 'react';
import {
  listMetrics,
  createMetric,
  updateMetric,
  deleteMetric,
  autoDiscoverMetrics,
  confirmMetrics,
  getSemanticSummary,
  type Metric,
  type SemanticSummary,
} from '@/lib/api/semantic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Plus, RefreshCw, Check, X, Edit, Trash2, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function MetricsPage() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [summary, setSummary] = useState<SemanticSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState('');
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [discoverDialogOpen, setDiscoverDialogOpen] = useState(false);
  const [discoveredMetrics, setDiscoveredMetrics] = useState<Metric[]>([]);
  const [editingMetric, setEditingMetric] = useState<Metric | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<Metric>>({
    name: '',
    displayName: '',
    description: '',
    dataType: 'number',
    aggregation: 'sum',
    formula: '',
    baseTable: '',
    baseField: '',
    category: '',
    tags: [],
  });

  useEffect(() => {
    loadMetrics();
    loadSummary();
  }, []);

  async function loadMetrics() {
    try {
      const data = await listMetrics();
      setMetrics(data);
    } catch (error) {
      toast({
        title: '加载失败',
        description: '无法加载指标列表',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    try {
      const data = await getSemanticSummary();
      setSummary(data);
    } catch (error) {
      console.error('Failed to load summary:', error);
    }
  }

  async function handleAutoDiscover() {
    if (!selectedDataSource) {
      toast({
        title: '请选择数据源',
        description: '请先选择要分析的数据源',
        variant: 'destructive',
      });
      return;
    }

    setDiscoverLoading(true);
    try {
      const result = await autoDiscoverMetrics(selectedDataSource);
      setDiscoveredMetrics(result.metrics || []);
      setDiscoverDialogOpen(true);
      toast({
        title: '发现成功',
        description: `发现 ${result.count} 个潜在指标`,
      });
    } catch (error) {
      toast({
        title: '发现失败',
        description: '无法自动发现指标',
        variant: 'destructive',
      });
    } finally {
      setDiscoverLoading(false);
    }
  }

  async function handleConfirmMetrics(metricIds: string[]) {
    try {
      await confirmMetrics(metricIds);
      await loadMetrics();
      setDiscoverDialogOpen(false);
      toast({
        title: '确认成功',
        description: `已确认 ${metricIds.length} 个指标`,
      });
    } catch (error) {
      toast({
        title: '确认失败',
        description: '无法确认指标',
        variant: 'destructive',
      });
    }
  }

  async function handleCreateMetric() {
    try {
      await createMetric(formData);
      setCreateDialogOpen(false);
      await loadMetrics();
      toast({
        title: '创建成功',
        description: '指标已创建',
      });
      resetForm();
    } catch (error) {
      toast({
        title: '创建失败',
        description: '无法创建指标',
        variant: 'destructive',
      });
    }
  }

  async function handleUpdateMetric() {
    if (!editingMetric) return;
    try {
      await updateMetric(editingMetric.id, formData);
      setEditingMetric(null);
      await loadMetrics();
      toast({
        title: '更新成功',
        description: '指标已更新',
      });
      resetForm();
    } catch (error) {
      toast({
        title: '更新失败',
        description: '无法更新指标',
        variant: 'destructive',
      });
    }
  }

  async function handleDeleteMetric(metricId: string) {
    if (!confirm('确定要删除这个指标吗？')) return;
    try {
      await deleteMetric(metricId);
      await loadMetrics();
      toast({
        title: '删除成功',
        description: '指标已删除',
      });
    } catch (error) {
      toast({
        title: '删除失败',
        description: '无法删除指标',
        variant: 'destructive',
      });
    }
  }

  function openEditDialog(metric: Metric) {
    setEditingMetric(metric);
    setFormData({
      name: metric.name,
      displayName: metric.displayName,
      description: metric.description,
      dataType: metric.dataType,
      aggregation: metric.aggregation,
      formula: metric.formula,
      baseTable: metric.baseTable,
      baseField: metric.baseField,
      category: metric.category,
    });
  }

  function resetForm() {
    setFormData({
      name: '',
      displayName: '',
      description: '',
      dataType: 'number',
      aggregation: 'sum',
      formula: '',
      baseTable: '',
      baseField: '',
      category: '',
    });
    setEditingMetric(null);
  }

  function getDataTypeIcon(type: string) {
    switch (type) {
      case 'currency': return '💰';
      case 'number': return '🔢';
      case 'percentage': return '📊';
      case 'datetime': return '📅';
      default: return '📝';
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active': return <Badge className="bg-green-500">活跃</Badge>;
      case 'draft': return <Badge variant="secondary">草稿</Badge>;
      default: return <Badge variant="outline">未激活</Badge>;
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">指标管理</h1>
          <p className="text-muted-foreground">管理和定义业务指标</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setDiscoverDialogOpen(true)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            AI 自动发现
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新建指标
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总指标数</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.metrics.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活跃指标</CardTitle>
              <Check className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.metrics.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">草稿指标</CardTitle>
              <Edit className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.metrics.draft}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">维度数量</CardTitle>
              <Sparkles className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.dimensions.total}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>指标列表</CardTitle>
          <CardDescription>查看和管理所有业务指标</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>公式</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>来源</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : metrics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    暂无指标，点击右上角创建或使用 AI 自动发现
                  </TableCell>
                </TableRow>
              ) : (
                metrics.map((metric) => (
                  <TableRow key={metric.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{metric.displayName}</div>
                        <div className="text-xs text-muted-foreground">{metric.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{getDataTypeIcon(metric.dataType)}</span>
                        <span className="capitalize">{metric.dataType}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {metric.formula}
                    </TableCell>
                    <TableCell>
                      {metric.category ? (
                        <Badge variant="outline">{metric.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(metric.status)}</TableCell>
                    <TableCell>
                      {metric.isAutoDetected ? (
                        <Badge variant="secondary">AI 发现</Badge>
                      ) : (
                        <Badge>手动创建</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(metric)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMetric(metric.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={createDialogOpen || !!editingMetric} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingMetric ? '编辑指标' : '创建指标'}
            </DialogTitle>
            <DialogDescription>
              {editingMetric ? '更新指标定义' : '定义新的业务指标'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">指标名称</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：GMV"
                />
              </div>
              <div>
                <Label htmlFor="displayName">显示名称</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="如：成交总额"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">描述</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="指标说明"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dataType">数据类型</Label>
                <Select
                  value={formData.dataType}
                  onValueChange={(value: any) => setFormData({ ...formData, dataType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="currency">金额 (Currency)</SelectItem>
                    <SelectItem value="number">数字 (Number)</SelectItem>
                    <SelectItem value="percentage">百分比 (Percentage)</SelectItem>
                    <SelectItem value="datetime">日期时间 (Datetime)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="aggregation">聚合方式</Label>
                <Select
                  value={formData.aggregation}
                  onValueChange={(value: any) => setFormData({ ...formData, aggregation: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum">SUM (求和)</SelectItem>
                    <SelectItem value="count">COUNT (计数)</SelectItem>
                    <SelectItem value="avg">AVG (平均)</SelectItem>
                    <SelectItem value="min">MIN (最小)</SelectItem>
                    <SelectItem value="max">MAX (最大)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="formula">计算公式</Label>
              <Input
                id="formula"
                value={formData.formula}
                onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
                placeholder="如：SUM(orders.amount)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="baseTable">基础表</Label>
                <Input
                  id="baseTable"
                  value={formData.baseTable}
                  onChange={(e) => setFormData({ ...formData, baseTable: e.target.value })}
                  placeholder="如：orders"
                />
              </div>
              <div>
                <Label htmlFor="baseField">基础字段</Label>
                <Input
                  id="baseField"
                  value={formData.baseField}
                  onChange={(e) => setFormData({ ...formData, baseField: e.target.value })}
                  placeholder="如：amount"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="category">分类</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="如：销售"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setCreateDialogOpen(false);
              }}
            >
              取消
            </Button>
            <Button onClick={editingMetric ? handleUpdateMetric : handleCreateMetric}>
              {editingMetric ? '更新' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto Discover Dialog */}
      <Dialog open={discoverDialogOpen} onOpenChange={setDiscoverDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>AI 自动发现指标</DialogTitle>
            <DialogDescription>
              分析数据源结构，自动识别潜在的业务指标
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!selectedDataSource ? (
              <div className="space-y-2">
                <Label>选择数据源</Label>
                <Select onValueChange={setSelectedDataSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择要分析的数据源" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">默认数据源</SelectItem>
                    {/* TODO: 从 API 加载数据源列表 */}
                  </SelectContent>
                </Select>
                <Button onClick={handleAutoDiscover} className="w-full">
                  <Sparkles className="mr-2 h-4 w-4" />
                  开始分析
                </Button>
              </div>
            ) : discoveredMetrics.length > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">发现的指标 ({discoveredMetrics.length})</h3>
                  <Button
                    size="sm"
                    onClick={() => handleConfirmMetrics(discoveredMetrics.map(m => m.id))}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    全部确认
                  </Button>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {discoveredMetrics.map((metric) => (
                    <Card key={metric.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{metric.displayName}</span>
                              <Badge variant="secondary">
                                置信度 {(metric.confidenceScore * 100).toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {metric.formula}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              来源：{metric.baseTable}.{metric.baseField}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleConfirmMetrics([metric.id])}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDiscoveredMetrics(
                                  discoveredMetrics.filter(m => m.id !== metric.id)
                                );
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <RefreshCw className={`h-8 w-8 mx-auto ${discoverLoading ? 'animate-spin' : ''}`} />
                <p className="mt-2 text-muted-foreground">
                  {discoverLoading ? '正在分析数据源...' : '点击开始分析'}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
