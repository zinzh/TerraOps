package handlers

import (
	"encoding/json" // Added
	"errors"
	"fmt" // Added
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/zinzh/TerraOps/backend/internal/git" // Added
	"github.com/zinzh/TerraOps/backend/internal/models"
	"github.com/zinzh/TerraOps/backend/internal/parser" // Added
	"github.com/zinzh/TerraOps/backend/internal/repository"
)

type BlueprintHandler struct {
	BlueprintRepo *repository.BlueprintRepository
	GitSvc        *git.Service             // Added
	ParserSvc     *parser.HCLParserService // Added
}

// Updated constructor
func NewBlueprintHandler(
	blueprintRepo *repository.BlueprintRepository,
	gitSvc *git.Service,
	parserSvc *parser.HCLParserService,
) *BlueprintHandler {
	return &BlueprintHandler{
		BlueprintRepo: blueprintRepo,
		GitSvc:        gitSvc,
		ParserSvc:     parserSvc,
	}
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

// ParseBlueprintVariables handles POST /api/blueprints/:id/parse (Real Implementation)
func (h *BlueprintHandler) ParseBlueprintVariables(c *gin.Context) {
	idStr := c.Param("id")
	blueprintID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid blueprint ID format"})
		return
	}

	log.Printf("Starting variable parsing process for blueprint ID %s\n", idStr)

	// 1. Fetch blueprint details
	blueprint, err := h.BlueprintRepo.GetBlueprintByID(c.Request.Context(), blueprintID)
	if err != nil {
		if errors.Is(err, repository.ErrBlueprintNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			log.Printf("Error getting blueprint by ID %s for parsing: %v\n", idStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve blueprint details"})
		}
		return
	}

	// Use blueprint ID as a reasonably unique directory name for cloning
	cloneDirName := blueprintID.String()
	var repoPath string
	var parseErr error
	var variables models.VariableDefinitions

	// Ensure cleanup happens even if errors occur
	defer func() {
		if repoPath != "" {
			cleanupErr := h.GitSvc.CleanupRepository(cloneDirName)
			if cleanupErr != nil {
				log.Printf("Error cleaning up repo %s: %v\n", repoPath, cleanupErr)
			}
		}
	}()

	// 2. Clone the repository
	repoPath, err = h.GitSvc.CloneRepository(blueprint.GitRepoURL, cloneDirName)
	if err != nil {
		log.Printf("Failed to clone repo %s for blueprint %s: %v\n", blueprint.GitRepoURL, idStr, err)
		parseErr = fmt.Errorf("failed to clone repository: %w", err)
		// Proceed to update DB with error, repoPath will be empty so cleanup won't run
	} else {
		// 3. Parse variables if cloning succeeded
		variables, err = h.ParserSvc.ParseVariablesFromPath(repoPath)
		if err != nil {
			log.Printf("Failed to parse variables for blueprint %s from %s: %v\n", idStr, repoPath, err)
			parseErr = fmt.Errorf("failed to parse variables: %w", err)
			// Proceed to update DB with error
		}
	}

	// 4. Marshal variables to JSON (even if empty or nil)
	var variablesJSON json.RawMessage
	var dbParseError *string
	if parseErr != nil {
		errMsg := parseErr.Error()
		dbParseError = &errMsg
		variablesJSON = json.RawMessage("null") // Store null if parsing failed
	} else if variables != nil {
		variablesBytes, err := json.Marshal(variables)
		if err != nil {
			log.Printf("Failed to marshal parsed variables to JSON for blueprint %s: %v\n", idStr, err)
			errMsg := fmt.Sprintf("failed to serialize parsed variables: %v", err)
			dbParseError = &errMsg
			variablesJSON = json.RawMessage("null")
		} else {
			variablesJSON = json.RawMessage(variablesBytes)
		}
	} else {
		// No variables found, but no error
		variablesJSON = json.RawMessage("{}") // Store empty JSON object
	}

	// 5. Update blueprint record in database
	err = h.BlueprintRepo.UpdateParsedVariables(c.Request.Context(), blueprintID, variablesJSON, dbParseError)
	if err != nil {
		log.Printf("Failed to update parsed variables in DB for blueprint %s: %v\n", idStr, err)
		// Don't overwrite the original parsing error if DB update fails
		if parseErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse variables and update database", "details": parseErr.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Parsed variables but failed to update database", "details": err.Error()})
		}
		return
	}

	// 6. Return final status
	if parseErr != nil {
		// Return error status, but the error is now stored in the DB
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Failed to parse blueprint variables", "details": parseErr.Error()})
	} else {
		log.Printf("Successfully parsed and updated variables for blueprint %s\n", idStr)
		c.JSON(http.StatusOK, gin.H{
			"message":              "Blueprint variables parsed and updated successfully.",
			"blueprint_id":         blueprintID,
			"variables_definition": variables, // Return the parsed structure
		})
	}
}
