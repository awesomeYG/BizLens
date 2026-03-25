package handler

import (
	"ai-bi-server/internal/service"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // 生产环境需要验证 origin
	},
}

// WebSocketHandler WebSocket 处理器
type WebSocketHandler struct {
	hub *service.Hub
}

// NewWebSocketHandler 创建 WebSocketHandler
func NewWebSocketHandler(hub *service.Hub) *WebSocketHandler {
	return &WebSocketHandler{hub: hub}
}

// HandleWebSocket 处理 WebSocket 连接
func (h *WebSocketHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		http.Error(w, "Missing tenant ID", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	client := &service.Client{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		Conn:          conn,
		Send:          make(chan []byte, 256),
		Subscriptions: make(map[string]bool),
	}

	h.hub.Register(client)

	go client.WritePump()
	go client.ReadPump(h.hub)
}
