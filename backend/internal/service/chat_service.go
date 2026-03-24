package service

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"ai-bi-server/internal/model"
)

type ChatConversationFile struct {
	Name    string `json:"name"`
	Summary string `json:"summary,omitempty"`
}

type ChatConversationMessageDTO struct {
	ID        string                 `json:"id"`
	Role      string                 `json:"role"`
	Content   string                 `json:"content"`
	Files     []ChatConversationFile `json:"files,omitempty"`
	Timestamp int64                  `json:"timestamp"`
}

type ChatConversationSummaryDTO struct {
	ID            string  `json:"id"`
	Title         string  `json:"title"`
	Preview       string  `json:"preview"`
	MessageCount  int     `json:"messageCount"`
	CreatedAt     string  `json:"createdAt"`
	UpdatedAt     string  `json:"updatedAt"`
	LastMessageAt *string `json:"lastMessageAt,omitempty"`
}

type ChatConversationDetailDTO struct {
	ID            string                       `json:"id"`
	Title         string                       `json:"title"`
	CreatedAt     string                       `json:"createdAt"`
	UpdatedAt     string                       `json:"updatedAt"`
	LastMessageAt *string                      `json:"lastMessageAt,omitempty"`
	Messages      []ChatConversationMessageDTO `json:"messages"`
}

type SaveChatConversationRequest struct {
	Title    string                       `json:"title"`
	Messages []ChatConversationMessageDTO `json:"messages"`
}

type ChatService struct {
	db *gorm.DB
}

func NewChatService(db *gorm.DB) *ChatService {
	return &ChatService{db: db}
}

func (s *ChatService) ListConversations(tenantID, userID string) ([]ChatConversationSummaryDTO, error) {
	var conversations []model.ChatConversation
	err := s.db.
		Where("tenant_id = ? AND user_id = ?", tenantID, userID).
		Order("COALESCE(last_message_at, created_at) DESC").
		Find(&conversations).Error
	if err != nil {
		return nil, err
	}

	result := make([]ChatConversationSummaryDTO, 0, len(conversations))
	for _, conversation := range conversations {
		var count int64
		if err := s.db.Model(&model.ChatConversationMessage{}).Where("conversation_id = ?", conversation.ID).Count(&count).Error; err != nil {
			return nil, err
		}

		var latest model.ChatConversationMessage
		preview := ""
		err := s.db.
			Where("conversation_id = ?", conversation.ID).
			Order("sort_order DESC, occurred_at DESC").
			Limit(1).
			First(&latest).Error
		if err == nil {
			preview = buildPreview(latest.Content)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}

		result = append(result, ChatConversationSummaryDTO{
			ID:            conversation.ID,
			Title:         conversation.Title,
			Preview:       preview,
			MessageCount:  int(count),
			CreatedAt:     conversation.CreatedAt.Format(time.RFC3339),
			UpdatedAt:     conversation.UpdatedAt.Format(time.RFC3339),
			LastMessageAt: formatTimePtr(conversation.LastMessageAt),
		})
	}

	return result, nil
}

func (s *ChatService) CreateConversation(tenantID, userID string) (*ChatConversationDetailDTO, error) {
	conversation := &model.ChatConversation{
		ID:       uuid.NewString(),
		TenantID: tenantID,
		UserID:   userID,
		Title:    "新对话",
	}

	if err := s.db.Create(conversation).Error; err != nil {
		return nil, err
	}

	return &ChatConversationDetailDTO{
		ID:            conversation.ID,
		Title:         conversation.Title,
		CreatedAt:     conversation.CreatedAt.Format(time.RFC3339),
		UpdatedAt:     conversation.UpdatedAt.Format(time.RFC3339),
		Messages:      []ChatConversationMessageDTO{},
		LastMessageAt: nil,
	}, nil
}

func (s *ChatService) GetConversation(tenantID, userID, conversationID string) (*ChatConversationDetailDTO, error) {
	var conversation model.ChatConversation
	if err := s.db.Where("tenant_id = ? AND user_id = ? AND id = ?", tenantID, userID, conversationID).First(&conversation).Error; err != nil {
		return nil, err
	}

	var messages []model.ChatConversationMessage
	if err := s.db.Where("conversation_id = ?", conversation.ID).Order("sort_order ASC, occurred_at ASC").Find(&messages).Error; err != nil {
		return nil, err
	}

	return buildConversationDetail(conversation, messages)
}

func (s *ChatService) SaveConversation(tenantID, userID, conversationID string, req SaveChatConversationRequest) (*ChatConversationDetailDTO, error) {
	var conversation model.ChatConversation
	if err := s.db.Where("tenant_id = ? AND user_id = ? AND id = ?", tenantID, userID, conversationID).First(&conversation).Error; err != nil {
		return nil, err
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = deriveTitle(req.Messages)
	}
	if title == "" {
		title = "新对话"
	}

	messages := make([]model.ChatConversationMessage, 0, len(req.Messages))
	var lastMessageAt *time.Time
	for idx, item := range req.Messages {
		occurredAt := time.UnixMilli(item.Timestamp)
		if item.Timestamp <= 0 {
			occurredAt = time.Now()
		}
		if lastMessageAt == nil || occurredAt.After(*lastMessageAt) {
			t := occurredAt
			lastMessageAt = &t
		}

		filesJSON := ""
		if len(item.Files) > 0 {
			raw, err := json.Marshal(item.Files)
			if err != nil {
				return nil, err
			}
			filesJSON = string(raw)
		}

		msgID := item.ID
		if strings.TrimSpace(msgID) == "" {
			msgID = uuid.NewString()
		}

		messages = append(messages, model.ChatConversationMessage{
			ID:             msgID,
			ConversationID: conversation.ID,
			TenantID:       tenantID,
			Role:           item.Role,
			Content:        item.Content,
			Files:          filesJSON,
			OccurredAt:     occurredAt,
			SortOrder:      idx,
		})
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&conversation).Updates(map[string]interface{}{
			"title":           title,
			"last_message_at": lastMessageAt,
		}).Error; err != nil {
			return err
		}

		if err := tx.Where("conversation_id = ?", conversation.ID).Delete(&model.ChatConversationMessage{}).Error; err != nil {
			return err
		}

		if len(messages) > 0 {
			if err := tx.Create(&messages).Error; err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	conversation.Title = title
	conversation.LastMessageAt = lastMessageAt
	if err := s.db.Where("id = ?", conversation.ID).First(&conversation).Error; err != nil {
		return nil, err
	}

	return buildConversationDetail(conversation, messages)
}

func (s *ChatService) RenameConversation(tenantID, userID, conversationID, title string) (*ChatConversationSummaryDTO, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return nil, errors.New("会话标题不能为空")
	}

	var conversation model.ChatConversation
	if err := s.db.Where("tenant_id = ? AND user_id = ? AND id = ?", tenantID, userID, conversationID).First(&conversation).Error; err != nil {
		return nil, err
	}

	if err := s.db.Model(&conversation).Update("title", title).Error; err != nil {
		return nil, err
	}
	conversation.Title = title
	if err := s.db.Where("id = ?", conversation.ID).First(&conversation).Error; err != nil {
		return nil, err
	}

	var count int64
	if err := s.db.Model(&model.ChatConversationMessage{}).Where("conversation_id = ?", conversation.ID).Count(&count).Error; err != nil {
		return nil, err
	}

	var latest model.ChatConversationMessage
	preview := ""
	err := s.db.Where("conversation_id = ?", conversation.ID).Order("sort_order DESC, occurred_at DESC").Limit(1).First(&latest).Error
	if err == nil {
		preview = buildPreview(latest.Content)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	return &ChatConversationSummaryDTO{
		ID:            conversation.ID,
		Title:         conversation.Title,
		Preview:       preview,
		MessageCount:  int(count),
		CreatedAt:     conversation.CreatedAt.Format(time.RFC3339),
		UpdatedAt:     conversation.UpdatedAt.Format(time.RFC3339),
		LastMessageAt: formatTimePtr(conversation.LastMessageAt),
	}, nil
}

func (s *ChatService) DeleteConversation(tenantID, userID, conversationID string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("conversation_id = ?", conversationID).Delete(&model.ChatConversationMessage{}).Error; err != nil {
			return err
		}
		result := tx.Where("tenant_id = ? AND user_id = ? AND id = ?", tenantID, userID, conversationID).Delete(&model.ChatConversation{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

func buildConversationDetail(conversation model.ChatConversation, messages []model.ChatConversationMessage) (*ChatConversationDetailDTO, error) {
	items := make([]ChatConversationMessageDTO, 0, len(messages))
	for _, message := range messages {
		var files []ChatConversationFile
		if message.Files != "" {
			if err := json.Unmarshal([]byte(message.Files), &files); err != nil {
				return nil, err
			}
		}
		items = append(items, ChatConversationMessageDTO{
			ID:        message.ID,
			Role:      message.Role,
			Content:   message.Content,
			Files:     files,
			Timestamp: message.OccurredAt.UnixMilli(),
		})
	}

	return &ChatConversationDetailDTO{
		ID:            conversation.ID,
		Title:         conversation.Title,
		CreatedAt:     conversation.CreatedAt.Format(time.RFC3339),
		UpdatedAt:     conversation.UpdatedAt.Format(time.RFC3339),
		LastMessageAt: formatTimePtr(conversation.LastMessageAt),
		Messages:      items,
	}, nil
}

func deriveTitle(messages []ChatConversationMessageDTO) string {
	for _, item := range messages {
		if item.Role != "user" {
			continue
		}
		title := strings.TrimSpace(item.Content)
		if title == "" {
			continue
		}
		runes := []rune(title)
		if len(runes) > 24 {
			return string(runes[:24]) + "..."
		}
		return title
	}
	return ""
}

func buildPreview(content string) string {
	text := strings.TrimSpace(strings.ReplaceAll(content, "\n", " "))
	runes := []rune(text)
	if len(runes) > 40 {
		return string(runes[:40]) + "..."
	}
	return text
}

func formatTimePtr(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := value.Format(time.RFC3339)
	return &formatted
}
