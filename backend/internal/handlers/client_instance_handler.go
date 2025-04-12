package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"            // Added
	"path/filepath" // Added
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/zinzh/TerraOps/backend/internal/git"
	"github.com/zinzh/TerraOps/backend/internal/maintf" // Added
	"github.com/zinzh/TerraOps/backend/internal/models"
	"github.com/zinzh/TerraOps/backend/internal/repository"
	"github.com/zinzh/TerraOps/backend/internal/tfvars" // Added
)

type ClientInstanceHandler struct {
	InstanceRepo  *repository.ClientInstanceRepository
	BlueprintRepo *repository.BlueprintRepository
	GitSvc        *git.Service
	TfvarsGen     *tfvars.Generator // Added
	MainTfGen     *maintf.Generator // Added
}

// Updated constructor
func NewClientInstanceHandler(
	instanceRepo *repository.ClientInstanceRepository,
	blueprintRepo *repository.BlueprintRepository,
	gitSvc *git.Service,
	tfvarsGen *tfvars.Generator, // Added
	mainTfGen *maintf.Generator, // Added
) *ClientInstanceHandler {
	return &ClientInstanceHandler{
		InstanceRepo:  instanceRepo,
		BlueprintRepo: blueprintRepo,
		GitSvc:        gitSvc,
		TfvarsGen:     tfvarsGen, // Added
		MainTfGen:     mainTfGen, // Added
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
		BlueprintVersion: req.BlueprintVersion, // Assign from request
		ClientRepoURL:    req.ClientRepoURL,
		ClientRepoBranch: branch,
		VariableValues:   json.RawMessage("{}"), // Default if not provided
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
	// Call the updated repository function which returns []*ClientInstanceListItem
	instances, err := h.InstanceRepo.ListClientInstances(c.Request.Context())
	if err != nil {
		log.Printf("Error listing client instances: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve client instances"})
		return
	}

	if instances == nil {
		// Return empty array instead of null
		c.JSON(http.StatusOK, []*repository.ClientInstanceListItem{})
	} else {
		// Return the list including the blueprint name
		c.JSON(http.StatusOK, instances)
	}
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

	if req.Name == nil && req.Description == nil && req.VariableValues == nil && req.ClientRepoURL == nil && req.ClientRepoBranch == nil && req.BlueprintVersion == nil {
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
			// Handle other potential errors, like FK constraints if they were different
			log.Printf("Error deleting client instance ID %s: %v\n", idStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete client instance"})
		}
		return
	}

	c.Status(http.StatusNoContent) // 204 No Content is standard
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
	var valuesToSync json.RawMessage
	var commitMsg string

	// Check content type and attempt bind only if JSON is present
	if c.Request.ContentLength > 0 && strings.Contains(c.ContentType(), "application/json") {
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
			return
		}
		// Use values from request if provided
		valuesToSync = req.VariableValues
		if req.CommitMessage != nil {
			commitMsg = *req.CommitMessage
		}
		// Basic check if values were actually provided in the JSON body
		if len(valuesToSync) == 0 || string(valuesToSync) == "null" {
			valuesToSync = nil // Treat empty/null JSON value as signal to use stored values
		}

	} else {
		// If no request body or not JSON, assume sync with stored values
		valuesToSync = nil
		log.Printf("No variable_values in request body for instance %s sync, using stored values.", idStr)
	}

	log.Printf("Starting sync process for client instance ID %s\n", idStr)

	// --- Orchestration Logic ---
	var syncErrMsg *string
	syncStatus := "success"
	var repoPath string

	err = func() error {
		// 1. Get Client Instance details (includes stored variable_values)
		instance, err := h.InstanceRepo.GetClientInstanceByID(c.Request.Context(), instanceID)
		if err != nil {
			return fmt.Errorf("failed to get client instance details: %w", err)
		}

		// ---- Use stored values if request didn't provide them ----
		if valuesToSync == nil {
			log.Println("Using variable values stored in database for sync.")
			valuesToSync = instance.VariableValues // Use DB values
			// Optional: Clear commit message if using DB values? Or allow default?
			// commitMsg = "" // Let CommitAndPush use its default
		}
		// Ensure valuesToSync isn't nil before passing to generator (use empty object maybe?)
		if valuesToSync == nil {
			valuesToSync = json.RawMessage("{}")
		}

		// 2. Get Blueprint details
		blueprint, err := h.BlueprintRepo.GetBlueprintByID(c.Request.Context(), instance.BlueprintID)
		if err != nil {
			return fmt.Errorf("failed to get blueprint details: %w", err)
		}

		// Define repo dir name based on instance ID
		cloneDirName := instanceID.String()
		defer func() { // Ensure cleanup even on intermediate errors
			if repoPath != "" {
				cleanupErr := h.GitSvc.CleanupRepository(cloneDirName)
				if cleanupErr != nil {
					log.Printf("Error cleaning up repo %s during sync: %v\n", repoPath, cleanupErr)
				}
			}
		}()

		// 3. Clone or Open Client Repo
		repo, path, err := h.GitSvc.CloneOrOpenRepository(instance.ClientRepoURL, instance.ClientRepoBranch, cloneDirName)
		if err != nil {
			return fmt.Errorf("failed to clone/open client repository: %w", err)
		}
		repoPath = path // Assign repoPath for cleanup defer

		// 4. Generate main.tf content
		// Use blueprint name for module block name (sanitize if needed)
		moduleName := blueprint.Name
		mainTfContent, err := h.MainTfGen.Generate(moduleName, blueprint.GitRepoURL, instance.BlueprintVersion) // Pass version
		if err != nil {
			return fmt.Errorf("failed to generate main.tf content: %w", err)
		}

		// 5. Generate terraform.tfvars content
		tfvarsContent, err := h.TfvarsGen.Generate(req.VariableValues)
		if err != nil {
			return fmt.Errorf("failed to generate terraform.tfvars content: %w", err)
		}

		// 6. Write files to the cloned repo path
		mainTfPath := filepath.Join(repoPath, "main.tf")
		tfvarsPath := filepath.Join(repoPath, "terraform.tfvars")

		log.Printf("Writing main.tf to %s", mainTfPath)
		err = os.WriteFile(mainTfPath, []byte(mainTfContent), 0644)
		if err != nil {
			return fmt.Errorf("failed to write main.tf: %w", err)
		}

		log.Printf("Writing terraform.tfvars to %s", tfvarsPath)
		err = os.WriteFile(tfvarsPath, []byte(tfvarsContent), 0644)
		if err != nil {
			return fmt.Errorf("failed to write terraform.tfvars: %w", err)
		}

		// 7. Commit and Push
		commitMsg = fmt.Sprintf("Update configuration for %s", instance.Name)
		if req.CommitMessage != nil && *req.CommitMessage != "" {
			commitMsg = *req.CommitMessage
		}
		if commitMsg == "" {
			commitMsg = fmt.Sprintf("Sync configuration for %s via TerraOps", instance.Name) // Generate default if needed
		}

		err = h.GitSvc.CommitAndPush(repo, repoPath, instance.ClientRepoBranch, commitMsg)
		if err != nil {
			return fmt.Errorf("failed to commit and push changes: %w", err)
		}

		log.Printf("Successfully synced files to Git for instance %s", idStr)
		return nil // Indicate success from the closure
	}() // Execute the closure

	// --- Update Status in DB ---
	if err != nil {
		log.Printf("Sync failed for instance %s: %v\n", idStr, err)
		syncStatus = "failed"
		errMsg := err.Error()
		syncErrMsg = &errMsg
	}

	// Update DB regardless of success/failure
	dbUpdateErr := h.InstanceRepo.UpdateSyncStatus(c.Request.Context(), instanceID, req.VariableValues, syncStatus, syncErrMsg)
	if dbUpdateErr != nil {
		log.Printf("CRITICAL: Failed to update sync status in DB for instance %s after sync attempt: %v\n", idStr, dbUpdateErr)
		// Decide how to report this compound error
		if err != nil { // If sync also failed
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Sync failed and failed to update status in DB", "sync_error": err.Error(), "db_error": dbUpdateErr.Error()})
		} else { // Sync succeeded, but DB update failed
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Sync succeeded but failed to update status in DB", "db_error": dbUpdateErr.Error()})
		}
		return
	}

	// --- Final Response ---
	if err != nil {
		// Sync failed, error already logged and stored in DB
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sync process failed", "details": err.Error()})
	} else {
		// Sync succeeded
		c.JSON(http.StatusOK, gin.H{"message": "Client instance configuration synced successfully.", "instance_id": instanceID})
	}
}
