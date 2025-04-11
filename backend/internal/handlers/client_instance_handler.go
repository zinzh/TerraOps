package handlers

import (
	"encoding/json" // Added
	"errors"        // Added
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/zinzh/TerraOps/backend/internal/git" // Added
	"github.com/zinzh/TerraOps/backend/internal/models"
	"github.com/zinzh/TerraOps/backend/internal/repository"
)

type ClientInstanceHandler struct {
	InstanceRepo *repository.ClientInstanceRepository
	// We also need the BlueprintRepo to validate blueprint ID on creation
	BlueprintRepo *repository.BlueprintRepository
	// We need GitService for the actual sync later
	GitSvc *git.Service
	// Add TfvarsGenerator service later
}

func NewClientInstanceHandler(
	instanceRepo *repository.ClientInstanceRepository,
	blueprintRepo *repository.BlueprintRepository, // Added
	gitSvc *git.Service, // Added
) *ClientInstanceHandler {
	return &ClientInstanceHandler{
		InstanceRepo:  instanceRepo,
		BlueprintRepo: blueprintRepo, // Added
		GitSvc:        gitSvc,        // Added
	}
}

// CreateClientInstance handles POST /api/client-instances
func (h *ClientInstanceHandler) CreateClientInstance(c *gin.Context) {
	var req models.CreateClientInstanceRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// --- Validation: Check if Blueprint exists ---
	_, err := h.BlueprintRepo.GetBlueprintByID(c.Request.Context(), req.BlueprintID)
	if err != nil {
		if errors.Is(err, repository.ErrBlueprintNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid blueprint_id: blueprint not found"})
		} else {
			log.Printf("Error checking blueprint existence for ID %s: %v\n", req.BlueprintID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate blueprint ID"})
		}
		return
	}
	// --- End Validation ---

	branch := "main" // Default branch
	if req.ClientRepoBranch != nil && *req.ClientRepoBranch != "" {
		branch = *req.ClientRepoBranch
	}

	newInstance := models.ClientInstance{
		Name:             req.Name,
		Description:      req.Description,
		BlueprintID:      req.BlueprintID,
		ClientRepoURL:    req.ClientRepoURL,
		ClientRepoBranch: branch,
	}
	// Handle optional initial variable values
	if req.VariableValues != nil {
		newInstance.VariableValues = *req.VariableValues
	} else {
		// Default to empty JSON object if not provided
		newInstance.VariableValues = json.RawMessage("{}")
	}

	instanceID, err := h.InstanceRepo.CreateClientInstance(c.Request.Context(), &newInstance)
	if err != nil {
		// Use specific error types from repository
		if errors.Is(err, repository.ErrDuplicateClientInstanceName) || errors.Is(err, repository.ErrDuplicateClientInstanceRepoURL) || errors.Is(err, repository.ErrBlueprintNotFound) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		} else if strings.Contains(err.Error(), "database constraint violation") { // Catch FK violation etc.
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		} else {
			log.Printf("Error creating client instance: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create client instance"})
		}
		return
	}

	createdInstance, err := h.InstanceRepo.GetClientInstanceByID(c.Request.Context(), instanceID)
	if err != nil || createdInstance == nil {
		log.Printf("Error fetching created client instance (ID: %s): %v\n", instanceID, err)
		c.JSON(http.StatusCreated, gin.H{"message": "Client instance created successfully", "instance_id": instanceID})
		return
	}

	c.JSON(http.StatusCreated, createdInstance)
}

// ListClientInstances handles GET /api/client-instances
func (h *ClientInstanceHandler) ListClientInstances(c *gin.Context) {
	instances, err := h.InstanceRepo.ListClientInstances(c.Request.Context())
	if err != nil {
		log.Printf("Error listing client instances: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve client instances"})
		return
	}

	if instances == nil {
		instances = []*models.ClientInstance{}
	}

	c.JSON(http.StatusOK, instances)
}

// GetClientInstance handles GET /api/client-instances/:id
func (h *ClientInstanceHandler) GetClientInstance(c *gin.Context) {
	idStr := c.Param("id")
	instanceID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid client instance ID format"})
		return
	}

	instance, err := h.InstanceRepo.GetClientInstanceByID(c.Request.Context(), instanceID)
	if err != nil {
		if errors.Is(err, repository.ErrClientInstanceNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			log.Printf("Error getting client instance by ID %s: %v\n", idStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve client instance"})
		}
		return
	}

	c.JSON(http.StatusOK, instance)
}

// UpdateClientInstance handles PUT /api/client-instances/:id
func (h *ClientInstanceHandler) UpdateClientInstance(c *gin.Context) {
	idStr := c.Param("id")
	instanceID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid client instance ID format"})
		return
	}

	var req models.UpdateClientInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	if req.Name == nil && req.Description == nil && req.VariableValues == nil && req.ClientRepoURL == nil && req.ClientRepoBranch == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No update fields provided"})
		return
	}

	err = h.InstanceRepo.UpdateClientInstance(c.Request.Context(), instanceID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrClientInstanceNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else if errors.Is(err, repository.ErrDuplicateClientInstanceName) || errors.Is(err, repository.ErrDuplicateClientInstanceRepoURL) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		} else {
			log.Printf("Error updating client instance ID %s: %v\n", idStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update client instance"})
		}
		return
	}

	updatedInstance, err := h.InstanceRepo.GetClientInstanceByID(c.Request.Context(), instanceID)
	if err != nil {
		log.Printf("Error fetching updated client instance (ID: %s) after update: %v\n", instanceID, err)
		c.JSON(http.StatusOK, gin.H{"message": "Client instance updated successfully"})
		return
	}

	c.JSON(http.StatusOK, updatedInstance)
}

// DeleteClientInstance handles DELETE /api/client-instances/:id
func (h *ClientInstanceHandler) DeleteClientInstance(c *gin.Context) {
	idStr := c.Param("id")
	instanceID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid client instance ID format"})
		return
	}

	err = h.InstanceRepo.DeleteClientInstance(c.Request.Context(), instanceID)
	if err != nil {
		if errors.Is(err, repository.ErrClientInstanceNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			log.Printf("Error deleting client instance ID %s: %v\n", idStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete client instance"})
		}
		return
	}

	c.Status(http.StatusNoContent)
}

// SyncClientInstance handles POST /api/client-instances/:id/sync
// This is the placeholder for the next step: generating tfvars and pushing to Git.
func (h *ClientInstanceHandler) SyncClientInstance(c *gin.Context) {
	idStr := c.Param("id")
	instanceID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid client instance ID format"})
		return
	}

	var req models.SyncClientInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// --- TODO: Implement Git Sync Logic ---
	// 1. Get ClientInstance details (repo URL, branch) and Blueprint details (for module source).
	// 2. Generate `main.tf` content (calling the blueprint module).
	// 3. Generate `terraform.tfvars` content from req.VariableValues.
	// 4. Use h.GitSvc to clone the client repo (need credentials management).
	// 5. Write/update main.tf and terraform.tfvars in the cloned repo.
	// 6. Commit the changes (use req.CommitMessage or generate one).
	// 7. Push the changes to the client repo (need credentials management).
	// 8. Handle errors during Git operations.
	// 9. Update the sync status in the DB using h.InstanceRepo.UpdateSyncStatus.
	// ---

	log.Printf("Placeholder: Received request to sync variables for client instance ID %s\n", idStr)
	// Simulate sync attempt and update status (replace with real logic)
	syncErr := h.InstanceRepo.UpdateSyncStatus(c.Request.Context(), instanceID, req.VariableValues, "pending", nil) // Mark as pending
	if syncErr != nil {
		log.Printf("Failed to update sync status for instance %s: %v", idStr, syncErr)
	}

	// Return Accepted (202) as sync is likely asynchronous or takes time
	c.JSON(http.StatusAccepted, gin.H{"message": "Sync request received, processing.", "instance_id": instanceID})
}
