// POC: 响应式引擎原型
// 实现核心 DAG 依赖图和响应式计算

package main

import (
	"fmt"
	"sync"
)

// Cell 代表 Notebook 中的一个单元格
type Cell struct {
	ID     string
	Type   string // sql, python, markdown, ai
	Code   string
	Output interface{}
	Deps   []string // 依赖的单元格 ID
}

// DAG 有向无环图
type DAG struct {
	mu      sync.RWMutex
	nodes   map[string]*Cell
	edges   map[string][]string // node -> children
	reverse map[string][]string // node -> parents
}

// NewDAG 创建新的依赖图
func NewDAG() *DAG {
	return &DAG{
		nodes:   make(map[string]*Cell),
		edges:   make(map[string][]string),
		reverse: make(map[string][]string),
	}
}

// AddCell 添加单元格
func (d *DAG) AddCell(cell *Cell) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	// 检查循环依赖
	if err := d.wouldCreateCycle(cell.ID, cell.Deps); err != nil {
		return err
	}

	d.nodes[cell.ID] = cell

	// 更新边
	for _, dep := range cell.Deps {
		d.edges[dep] = append(d.edges[dep], cell.ID)
		d.reverse[cell.ID] = append(d.reverse[cell.ID], dep)
	}

	return nil
}

// wouldCreateCycle 检查是否会创建循环依赖
func (d *DAG) wouldCreateCycle(cellID string, deps []string) error {
	visited := make(map[string]bool)

	var hasCycle func(id string) bool
	hasCycle = func(id string) bool {
		if id == cellID {
			return true
		}
		if visited[id] {
			return false
		}

		visited[id] = true
		for _, child := range d.edges[id] {
			if hasCycle(child) {
				return true
			}
		}
		return false
	}

	for _, dep := range deps {
		if hasCycle(dep) {
			return fmt.Errorf("cycle detected: cannot depend on %s", dep)
		}
	}

	return nil
}

// GetExecutionOrder 获取执行顺序 (拓扑排序)
func (d *DAG) GetExecutionOrder() ([]string, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	visited := make(map[string]bool)
	order := []string{}

	var visit func(id string) error
	visit = func(id string) error {
		if visited[id] {
			return nil
		}

		// 先访问所有依赖
		for _, parent := range d.reverse[id] {
			if err := visit(parent); err != nil {
				return err
			}
		}

		visited[id] = true
		order = append(order, id)
		return nil
	}

	// 遍历所有节点
	for id := range d.nodes {
		if !visited[id] {
			if err := visit(id); err != nil {
				return nil, err
			}
		}
	}

	return order, nil
}

// GetDependents 获取依赖某个单元格的所有单元格
func (d *DAG) GetDependents(cellID string) []string {
	d.mu.RLock()
	defer d.mu.RUnlock()

	dependents := []string{}
	queue := []string{cellID}
	visited := make(map[string]bool)

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		for _, child := range d.edges[current] {
			if !visited[child] {
				visited[child] = true
				dependents = append(dependents, child)
				queue = append(queue, child)
			}
		}
	}

	return dependents
}

// Executor 单元格执行器
type Executor struct {
	vars map[string]interface{}
}

// NewExecutor 创建执行器
func NewExecutor() *Executor {
	return &Executor{
		vars: make(map[string]interface{}),
	}
}

// Execute 执行单元格
func (e *Executor) Execute(cell *Cell) (interface{}, error) {
	fmt.Printf("Executing cell %s (%s):\n  Code: %s\n", cell.ID, cell.Type, cell.Code)

	// 简化实现：根据单元格类型模拟执行
	var output interface{}
	var err error

	switch cell.Type {
	case "sql":
		output, err = e.executeSQL(cell.Code)
	case "python":
		output, err = e.executePython(cell.Code)
	case "markdown":
		output = cell.Code
	case "ai":
		output, err = e.executeAI(cell.Code)
	default:
		err = fmt.Errorf("unknown cell type: %s", cell.Type)
	}

	if err != nil {
		return nil, err
	}

	cell.Output = output
	return output, nil
}

// executeSQL 模拟 SQL 执行
func (e *Executor) executeSQL(code string) (interface{}, error) {
	// 简化：解析简单的 SELECT 语句
	if len(code) > 50 {
		code = code[:50] + "..."
	}
	return fmt.Sprintf("[SQL Result] Executed: %s", code), nil
}

// executePython 模拟 Python 执行
func (e *Executor) executePython(code string) (interface{}, error) {
	// 简化：支持简单的变量赋值和计算
	if len(code) > 50 {
		code = code[:50] + "..."
	}
	return fmt.Sprintf("[Python Result] Executed: %s", code), nil
}

// executeAI 模拟 AI 分析
func (e *Executor) executeAI(code string) (interface{}, error) {
	if len(code) > 50 {
		code = code[:50] + "..."
	}
	return fmt.Sprintf("[AI Insight] Analyzed: %s", code), nil
}

// Engine Notebook 执行引擎
type Engine struct {
	dag       *DAG
	executor  *Executor
	listeners map[string][]func(string, interface{})
	mu        sync.RWMutex
}

// NewEngine 创建执行引擎
func NewEngine() *Engine {
	return &Engine{
		dag:       NewDAG(),
		executor:  NewExecutor(),
		listeners: make(map[string][]func(string, interface{})),
	}
}

// AddCell 添加单元格
func (e *Engine) AddCell(cell *Cell) error {
	return e.dag.AddCell(cell)
}

// ExecuteCell 执行单元格
func (e *Engine) ExecuteCell(cellID string) error {
	cell, exists := e.dag.nodes[cellID]
	if !exists {
		return fmt.Errorf("cell %s not found", cellID)
	}

	// 检查依赖是否都已执行
	for _, dep := range cell.Deps {
		if e.dag.nodes[dep].Output == nil {
			return fmt.Errorf("dependency %s not executed", dep)
		}
	}

	// 执行单元格
	output, err := e.executor.Execute(cell)
	if err != nil {
		return err
	}

	// 通知监听器
	e.notifyListeners(cellID, output)

	// 触发依赖单元格重新计算
	go e.recomputeDependents(cellID)

	return nil
}

// recomputeDependents 重新计算依赖的单元格
func (e *Engine) recomputeDependents(cellID string) {
	dependents := e.dag.GetDependents(cellID)
	fmt.Printf("Recomputing %d dependents of %s\n", len(dependents), cellID)

	for _, depID := range dependents {
		if err := e.ExecuteCell(depID); err != nil {
			fmt.Printf("Error recomputing %s: %v\n", depID, err)
		}
	}
}

// OnChange 注册单元格变更监听器
func (e *Engine) OnChange(cellID string, callback func(string, interface{})) {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.listeners[cellID] = append(e.listeners[cellID], callback)
}

// notifyListeners 通知监听器
func (e *Engine) notifyListeners(cellID string, output interface{}) {
	e.mu.RLock()
	callbacks := e.listeners[cellID]
	e.mu.RUnlock()

	for _, callback := range callbacks {
		go callback(cellID, output)
	}
}

// RunAll 执行所有单元格
func (e *Engine) RunAll() error {
	order, err := e.dag.GetExecutionOrder()
	if err != nil {
		return err
	}

	fmt.Printf("Execution order: %v\n", order)

	for _, cellID := range order {
		fmt.Printf("\n--- Executing %s ---\n", cellID)
		if err := e.ExecuteCell(cellID); err != nil {
			return fmt.Errorf("failed to execute %s: %v", cellID, err)
		}
	}

	return nil
}

func main() {
	fmt.Println("=== BizLens v3.0 Reactive Engine POC ===")

	// 创建引擎
	engine := NewEngine()

	// 添加单元格
	cell1 := &Cell{
		ID:     "cell1",
		Type:   "sql",
		Code:   "SELECT * FROM orders WHERE created_at >= '2026-01-01'",
		Output: nil,
		Deps:   []string{},
	}

	cell2 := &Cell{
		ID:   "cell2",
		Type: "python",
		Code: "active_users = orders[orders.status == 'active']",
		Deps: []string{"cell1"},
	}

	cell3 := &Cell{
		ID:   "cell3",
		Type: "sql",
		Code: "SELECT SUM(amount) as gmv FROM active_users",
		Deps: []string{"cell2"},
	}

	cell4 := &Cell{
		ID:   "cell4",
		Type: "ai",
		Code: "Analyze why GMV changed this month",
		Deps: []string{"cell3"},
	}

	// 添加单元格到引擎
	fmt.Println("Adding cells to engine...")
	engine.AddCell(cell1)
	engine.AddCell(cell2)
	engine.AddCell(cell3)
	engine.AddCell(cell4)

	// 注册监听器
	engine.OnChange("cell3", func(cellID string, output interface{}) {
		fmt.Printf("\n[Listener] Cell %s updated: %v\n", cellID, output)
	})

	// 执行所有单元格
	fmt.Println("\n=== Running all cells ===")
	if err := engine.RunAll(); err != nil {
		fmt.Printf("Error: %v\n", err)
	}

	// 模拟更新 cell1
	fmt.Println("\n=== Updating cell1 (should trigger recomputation) ===")
	cell1.Code = "SELECT * FROM orders WHERE created_at >= '2026-02-01'"
	cell1.Output = nil
	engine.ExecuteCell("cell1")

	fmt.Println("\n=== POC Complete ===")
}
