package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type ClientInstance struct {
	ID               uuid.UUID       `json:"id"`
	Name             string          `json:"name"`
	Description      *string         `json:"description,omitempty"`
	BlueprintID      uuid.UUID       `json:"blueprint_id"`
	BlueprintVersion *string         `json:"blueprint_version,omitempty"` // <<-- ADD THIS LINE (pointer allows null)
	VariableValues   json.RawMessage `json:"variable_values,omitempty"`
	ClientRepoURL    string          `json:"client_repo_url"`
	ClientRepoBranch string          `json:"client_repo_branch"`
	LastSyncStatus   *string         `json:"last_sync_status,omitempty"`
	LastSyncMessage  *string         `json:"last_sync_message,omitempty"`
	LastSyncedAt     *time.Time      `json:"last_synced_at,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
	BlueprintName    *string         `json:"blueprint_name,omitempty"` // Keep if using for list view
}

type CreateClientInstanceRequest struct {
	Name             string           `json:"name" binding:"required,min=3,max=100"`
	Description      *string          `json:"description,omitempty"`
	BlueprintID      uuid.UUID        `json:"blueprint_id" binding:"required"`
	BlueprintVersion *string          `json:"blueprint_version,omitempty"` // <<-- ADD THIS LINE
	VariableValues   *json.RawMessage `json:"variable_values,omitempty"`
	ClientRepoURL    string           `json:"client_repo_url" binding:"required"`
	ClientRepoBranch *string          `json:"client_repo_branch,omitempty"`
}

type UpdateClientInstanceRequest struct {
	Name             *string          `json:"name,omitempty" binding:"omitempty,min=3,max=100"`
	Description      *string          `json:"description,omitempty"`
	BlueprintVersion *string          `json:"blueprint_version,omitempty"` // <<-- ADD THIS LINE (allow updating version)
	VariableValues   *json.RawMessage `json:"variable_values,omitempty"`
	ClientRepoURL    *string          `json:"client_repo_url,omitempty" binding:"omitempty"`
	ClientRepoBranch *string          `json:"client_repo_branch,omitempty"`
}

// Represents the request to save/sync variables to the client's Git repo
type SyncClientInstanceRequest struct {
	VariableValues json.RawMessage `json:"variable_values" binding:"required"`
	CommitMessage  *string         `json:"commit_message,omitempty"` // Optional custom commit message
}
