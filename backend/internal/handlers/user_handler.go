package handlers

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/zinzh/TerraOps/backend/internal/models"
	"github.com/zinzh/TerraOps/backend/internal/repository"
)

type UserHandler struct {
	UserRepo *repository.UserRepository
}

func NewUserHandler(userRepo *repository.UserRepository) *UserHandler {
	return &UserHandler{UserRepo: userRepo}
}

func (h *UserHandler) RegisterUser(c *gin.Context) {
	var req models.CreateUserRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("Error binding JSON: %v\n", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	newUser := models.User{
		Email:     req.Email,
		FirstName: req.FirstName,
		LastName:  req.LastName,
	}

	if err := newUser.SetPassword(req.Password); err != nil {
		log.Printf("Error hashing password: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
		return
	}

	userID, err := h.UserRepo.CreateUser(c.Request.Context(), &newUser)
	if err != nil {
		if errors.Is(err, repository.ErrDuplicateEmail) {
			c.JSON(http.StatusConflict, gin.H{"error": "Email address already exists"})
		} else {
			log.Printf("Error creating user in repository: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register user"})
		}
		return
	}

	// Fetch the created user to return its details (excluding password hash)
	createdUser, err := h.UserRepo.GetUserByID(c.Request.Context(), userID)
	if err != nil || createdUser == nil {
		log.Printf("Error fetching created user (ID: %s): %v\n", userID, err)
		// Even if fetching fails, registration succeeded. Return 201 with ID.
		c.JSON(http.StatusCreated, gin.H{"message": "User registered successfully", "user_id": userID})
		return
	}

	c.JSON(http.StatusCreated, createdUser)
}
