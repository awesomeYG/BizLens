package service

import (
	"ai-bi-server/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type AIConfigService struct {
	db *gorm.DB
}

func NewAIConfigService(db *gorm.DB) *AIConfigService {
	return &AIConfigService{db: db}
}

func (s *AIConfigService) GetOrInitConfig(tenantID string) (*model.AIServiceConfig, error) {
	var cfg model.AIServiceConfig
	err := s.db.Where("tenant_id = ?", tenantID).First(&cfg).Error
	if err == nil {
		return &cfg, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	cfg = model.AIServiceConfig{
		TenantID:  tenantID,
		ModelType: "openai",
		Model:     "gpt-4o-mini",
	}
	// 并发首次访问时可能出现重复初始化，这里用 upsert 语义保证幂等。
	if createErr := s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tenant_id"}},
		DoNothing: true,
	}).Create(&cfg).Error; createErr != nil {
		return nil, createErr
	}

	// 无论是新建成功还是冲突忽略，都回查得到最终记录。
	if queryErr := s.db.Where("tenant_id = ?", tenantID).First(&cfg).Error; queryErr != nil {
		return nil, queryErr
	}
	return &cfg, nil
}

func (s *AIConfigService) UpsertConfig(tenantID, modelType, modelName, baseURL, apiKey string) (*model.AIServiceConfig, error) {
	cfg, err := s.GetOrInitConfig(tenantID)
	if err != nil {
		return nil, err
	}

	cfg.ModelType = modelType
	cfg.Model = modelName
	cfg.BaseURL = baseURL
	if apiKey != "" {
		cfg.APIKey = apiKey
	}

	if err := s.db.Save(cfg).Error; err != nil {
		return nil, err
	}
	return cfg, nil
}
