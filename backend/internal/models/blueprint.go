package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Blueprint struct {
	ID                  uuid.UUID       `json:"id"`
	Name                string          `json:"name"`
	Description         *string         `json:"description,omitempty"`
	GitRepoURL          string          `json:"git_repo_url"`
	SourceType          string          `json:"source_type"`
	VariablesDefinition json.RawMessage `json:"variables_definition,omitempty"` // Store as raw JSON bytes
	LastParsedAt        *time.Time      `json:"last_parsed_at,omitempty"`
	ParseError          *string         `json:"parse_error,omitempty"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
}

// --- DTOs (Data Transfer Objects) for API requests ---

type CreateBlueprintRequest struct {
	Name        string  `json:"name" binding:"required,min=3,max=100"`
	Description *string `json:"description,omitempty"`
	GitRepoURL  string  `json:"git_repo_url" binding:"required,url"`
}

type UpdateBlueprintRequest struct {
	Name        *string `json:"name,omitempty" binding:"omitempty,min=3,max=100"`
	Description *string `json:"description,omitempty"`
	GitRepoURL  *string `json:"git_repo_url,omitempty" binding:"omitempty,url"`
}
