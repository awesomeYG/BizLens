package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"gorm.io/gorm"

	"ai-bi-server/internal/service"
)

type ChatHandler struct {
	chatService *service.ChatService
}

type renameConversationRequest struct {
	Title string `json:"title"`
}

func NewChatHandler(chatService *service.ChatService) *ChatHandler {
	return &ChatHandler{chatService: chatService}
}

func (h *ChatHandler) HandleConversations(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	userID, _ := r.Context().Value("userID").(string)
	if tenantID == "" || userID == "" {
		writeError(w, http.StatusBadRequest, "缺少认证信息")
		return
	}

	idx := strings.Index(r.URL.Path, "/chat-conversations")
	if idx == -1 {
		http.NotFound(w, r)
		return
	}

	sub := strings.Trim(strings.TrimPrefix(r.URL.Path[idx:], "/chat-conversations"), "/")
	if sub == "" {
		switch r.Method {
		case http.MethodGet:
			h.listConversations(w, r, tenantID, userID)
		case http.MethodPost:
			h.createConversation(w, r, tenantID, userID)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	parts := strings.Split(sub, "/")
	conversationID := parts[0]
	if conversationID == "" || len(parts) > 1 {
		http.NotFound(w, r)
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getConversation(w, r, tenantID, userID, conversationID)
	case http.MethodPatch:
		h.renameConversation(w, r, tenantID, userID, conversationID)
	case http.MethodPut, http.MethodPost:
		// POST 也接受保存（用于 navigator.sendBeacon 在页面卸载时发送）
		h.saveConversation(w, r, tenantID, userID, conversationID)
	case http.MethodDelete:
		h.deleteConversation(w, r, tenantID, userID, conversationID)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *ChatHandler) listConversations(w http.ResponseWriter, _ *http.Request, tenantID, userID string) {
	items, err := h.chatService.ListConversations(tenantID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if items == nil {
		items = []service.ChatConversationSummaryDTO{}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *ChatHandler) createConversation(w http.ResponseWriter, _ *http.Request, tenantID, userID string) {
	conversation, err := h.chatService.CreateConversation(tenantID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, conversation)
}

func (h *ChatHandler) getConversation(w http.ResponseWriter, _ *http.Request, tenantID, userID, conversationID string) {
	conversation, err := h.chatService.GetConversation(tenantID, userID, conversationID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "会话不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, conversation)
}

func (h *ChatHandler) saveConversation(w http.ResponseWriter, r *http.Request, tenantID, userID, conversationID string) {
	var req service.SaveChatConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	conversation, err := h.chatService.SaveConversation(tenantID, userID, conversationID, req)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "会话不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, conversation)
}

func (h *ChatHandler) renameConversation(w http.ResponseWriter, r *http.Request, tenantID, userID, conversationID string) {
	var req renameConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	conversation, err := h.chatService.RenameConversation(tenantID, userID, conversationID, req.Title)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "会话不存在")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, conversation)
}

func (h *ChatHandler) deleteConversation(w http.ResponseWriter, _ *http.Request, tenantID, userID, conversationID string) {
	if err := h.chatService.DeleteConversation(tenantID, userID, conversationID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "会话不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "会话已删除"})
}
