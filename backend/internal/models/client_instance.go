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
	VariableValues   json.RawMessage `json:"variable_values,omitempty"` // Stores the user-provided values
	ClientRepoURL    string          `json:"client_repo_url"`
	ClientRepoBranch string          `json:"client_repo_branch"`
	LastSyncStatus   *string         `json:"last_sync_status,omitempty"`
	LastSyncMessage  *string         `json:"last_sync_message,omitempty"`
	LastSyncedAt     *time.Time      `json:"last_synced_at,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`

	// Optional: Embed or include Blueprint info when fetching?
	// Blueprint *Blueprint `json:"blueprint,omitempty"`
}

// --- DTOs (Data Transfer Objects) for API requests ---

type CreateClientInstanceRequest struct {
	Name             string           `json:"name" binding:"required,min=3,max=100"`
	Description      *string          `json:"description,omitempty"`
	BlueprintID      uuid.UUID        `json:"blueprint_id" binding:"required"`
	VariableValues   *json.RawMessage `json:"variable_values,omitempty"` // Allow initial values on creation
	ClientRepoURL    string           `json:"client_repo_url" binding:"required,url"`
	ClientRepoBranch *string          `json:"client_repo_branch,omitempty"` // Optional, defaults later
}

type UpdateClientInstanceRequest struct {
	Name        *string `json:"name,omitempty" binding:"omitempty,min=3,max=100"`
	Description *string `json:"description,omitempty"`
	// BlueprintID cannot typically be changed after creation
	VariableValues   *json.RawMessage `json:"variable_values,omitempty"` // Allow updating values
	ClientRepoURL    *string          `json:"client_repo_url,omitempty" binding:"omitempty,url"`
	ClientRepoBranch *string          `json:"client_repo_branch,omitempty"`
}

// Represents the request to save/sync variables to the client's Git repo
type SyncClientInstanceRequest struct {
	VariableValues json.RawMessage `json:"variable_values" binding:"required"`
	CommitMessage  *string         `json:"commit_message,omitempty"` // Optional custom commit message
}
