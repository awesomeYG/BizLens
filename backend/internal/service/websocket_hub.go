package service

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Client WebSocket 客户端
type Client struct {
	ID            string
	TenantID      string
	Conn          *websocket.Conn
	Send          chan []byte
	Subscriptions map[string]bool // dashboardId -> subscribed
	mu            sync.RWMutex
}

// Hub WebSocket 连接管理中心
type Hub struct {
	clients    map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan *BroadcastMessage
	mu         sync.RWMutex
}

// BroadcastMessage 广播消息
type BroadcastMessage struct {
	DashboardID string
	TenantID    string
	Data        interface{}
}

// NewHub 创建 Hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *BroadcastMessage, 256),
	}
}

// Run 启动 Hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("WebSocket client registered: %s (tenant: %s)", client.ID, client.TenantID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
				log.Printf("WebSocket client unregistered: %s", client.ID)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				// 只推送给订阅了该 dashboard 且属于同一租户的客户端
				if client.TenantID == message.TenantID && client.IsSubscribed(message.DashboardID) {
					select {
					case client.Send <- h.encodeMessage(message):
					default:
						// 发送失败，关闭客户端
						close(client.Send)
						delete(h.clients, client)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Register 注册客户端
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Unregister 注销客户端
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// Broadcast 广播消息
func (h *Hub) Broadcast(msg *BroadcastMessage) {
	h.broadcast <- msg
}

// encodeMessage 编码消息
func (h *Hub) encodeMessage(msg *BroadcastMessage) []byte {
	payload := map[string]interface{}{
		"type":        "data_update",
		"dashboardId": msg.DashboardID,
		"data":        msg.Data,
		"timestamp":   time.Now().Unix(),
	}
	data, _ := json.Marshal(payload)
	return data
}

// IsSubscribed 检查客户端是否订阅了指定 dashboard
func (c *Client) IsSubscribed(dashboardID string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.Subscriptions[dashboardID]
}

// Subscribe 订阅 dashboard
func (c *Client) Subscribe(dashboardID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Subscriptions[dashboardID] = true
	log.Printf("Client %s subscribed to dashboard %s", c.ID, dashboardID)
}

// Unsubscribe 取消订阅 dashboard
func (c *Client) Unsubscribe(dashboardID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.Subscriptions, dashboardID)
	log.Printf("Client %s unsubscribed from dashboard %s", c.ID, dashboardID)
}

// WritePump 写入消息到 WebSocket
func (c *Client) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ReadPump 读取客户端消息
func (c *Client) ReadPump(hub *Hub) {
	defer func() {
		hub.Unregister(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// 解析客户端消息
		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		msgType, _ := msg["type"].(string)
		dashboardID, _ := msg["dashboardId"].(string)

		switch msgType {
		case "subscribe":
			if dashboardID != "" {
				c.Subscribe(dashboardID)
			}
		case "unsubscribe":
			if dashboardID != "" {
				c.Unsubscribe(dashboardID)
			}
		}
	}
}
