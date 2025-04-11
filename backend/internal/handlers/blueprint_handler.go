package handlers

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/zinzh/TerraOps/backend/internal/models"
	"github.com/zinzh/TerraOps/backend/internal/repository"
)

type BlueprintHandler struct {
	BlueprintRepo *repository.BlueprintRepository
	// Add GitService/ParserService here later
}

func NewBlueprintHandler(blueprintRepo *repository.BlueprintRepository) *BlueprintHandler {
	return &BlueprintHandler{BlueprintRepo: blueprintRepo}
}

// CreateBlueprint handles POST /api/blueprints
func (h *BlueprintHandler) CreateBlueprint(c *gin.Context) {
	var req models.CreateBlueprintRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	newBlueprint := models.Blueprint{
		Name:        req.Name,
		Description: req.Description,
		GitRepoURL:  req.GitRepoURL,
		// SourceType defaults to 'git' in DB schema
	}

	blueprintID, err := h.BlueprintRepo.CreateBlueprint(c.Request.Context(), &newBlueprint)
	if err != nil {
		if errors.Is(err, repository.ErrDuplicateBlueprintName) || errors.Is(err, repository.ErrDuplicateBlueprintRepoURL) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		} else {
			log.Printf("Error creating blueprint: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create blueprint"})
		}
		return
	}

	// Fetch the created blueprint to return full details
	createdBlueprint, err := h.BlueprintRepo.GetBlueprintByID(c.Request.Context(), blueprintID)
	if err != nil || createdBlueprint == nil {
		log.Printf("Error fetching created blueprint (ID: %s): %v\n", blueprintID, err)
		// Return 201 with ID even if fetch fails
		c.JSON(http.StatusCreated, gin.H{"message": "Blueprint created successfully", "blueprint_id": blueprintID})
		return
	}

	c.JSON(http.StatusCreated, createdBlueprint)
}

// ListBlueprints handles GET /api/blueprints
func (h *BlueprintHandler) ListBlueprints(c *gin.Context) {
	blueprints, err := h.BlueprintRepo.ListBlueprints(c.Request.Context())
	if err != nil {
		log.Printf("Error listing blueprints: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve blueprints"})
		return
	}

	if blueprints == nil {
		blueprints = []*models.Blueprint{} // Return empty array instead of null
	}

	c.JSON(http.StatusOK, blueprints)
}

// GetBlueprint handles GET /api/blueprints/:id
func (h *BlueprintHandler) GetBlueprint(c *gin.Context) {
	idStr := c.Param("id")
	blueprintID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid blueprint ID format"})
		return
	}

	blueprint, err := h.BlueprintRepo.GetBlueprintByID(c.Request.Context(), blueprintID)
	if err != nil {
		if errors.Is(err, repository.ErrBlueprintNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			log.Printf("Error getting blueprint by ID %s: %v\n", idStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve blueprint"})
		}
		return
	}

	c.JSON(http.StatusOK, blueprint)
}

// UpdateBlueprint handles PUT /api/blueprints/:id
func (h *BlueprintHandler) UpdateBlueprint(c *gin.Context) {
	idStr := c.Param("id")
	blueprintID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid blueprint ID format"})
		return
	}

	var req models.UpdateBlueprintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Check if there's anything to update
	if req.Name == nil && req.Description == nil && req.GitRepoURL == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No update fields provided"})
		return
	}

	err = h.BlueprintRepo.UpdateBlueprint(c.Request.Context(), blueprintID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrBlueprintNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else if errors.Is(err, repository.ErrDuplicateBlueprintName) || errors.Is(err, repository.ErrDuplicateBlueprintRepoURL) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		} else {
			log.Printf("Error updating blueprint ID %s: %v\n", idStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update blueprint"})
		}
		return
	}

	// Fetch the updated blueprint to return it
	updatedBlueprint, err := h.BlueprintRepo.GetBlueprintByID(c.Request.Context(), blueprintID)
	if err != nil {
		log.Printf("Error fetching updated blueprint (ID: %s) after update: %v\n", blueprintID, err)
		c.JSON(http.StatusOK, gin.H{"message": "Blueprint updated successfully"})
		return
	}

	c.JSON(http.StatusOK, updatedBlueprint)
}

// DeleteBlueprint handles DELETE /api/blueprints/:id
func (h *BlueprintHandler) DeleteBlueprint(c *gin.Context) {
	idStr := c.Param("id")
	blueprintID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid blueprint ID format"})
		return
	}

	err = h.BlueprintRepo.DeleteBlueprint(c.Request.Context(), blueprintID)
	if err != nil {
		if errors.Is(err, repository.ErrBlueprintNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else if err.Error() == "cannot delete blueprint: it is being used by client instances" {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		} else {
			log.Printf("Error deleting blueprint ID %s: %v\n", idStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete blueprint"})
		}
		return
	}

	c.Status(http.StatusNoContent) // 204 No Content is standard for successful DELETE
}

// ParseBlueprintVariables handles POST /api/blueprints/:id/parse
func (h *BlueprintHandler) ParseBlueprintVariables(c *gin.Context) {
	// --- To be implemented in the next step ---
	// 1. Get blueprint ID from path param
	// 2. Fetch blueprint details (repo URL) using BlueprintRepo
	// 3. Call a new service (e.g., ParserService) to:
	//    a. Clone the repo using GitService
	//    b. Find and read variables.tf
	//    c. Parse HCL
	//    d. Extract variable definitions
	// 4. Marshal definitions to JSON
	// 5. Update blueprint record using BlueprintRepo.UpdateParsedVariables
	// 6. Handle errors at each step, updating ParseError field if needed
	// 7. Return success or error response

	idStr := c.Param("id")
	_, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid blueprint ID format"})
		return
	}

	log.Printf("Placeholder: Received request to parse variables for blueprint ID %s\n", idStr)
	// Simulate work / placeholder response
	c.JSON(http.StatusAccepted, gin.H{"message": "Parsing request received, implementation pending.", "blueprint_id": idStr})
}
