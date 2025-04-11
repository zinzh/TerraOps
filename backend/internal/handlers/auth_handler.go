package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/zinzh/TerraOps/backend/internal/auth"       // Adjusted import path
	"github.com/zinzh/TerraOps/backend/internal/repository" // Adjusted import path
)

type AuthHandler struct {
	UserRepo        *repository.UserRepository
	JWTSecret       string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
}

func NewAuthHandler(userRepo *repository.UserRepository, jwtSecret string, accessTTL time.Duration, refreshTTL time.Duration) *AuthHandler {
	return &AuthHandler{
		UserRepo:        userRepo,
		JWTSecret:       jwtSecret,
		AccessTokenTTL:  accessTTL,
		RefreshTokenTTL: refreshTTL,
	}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req auth.LoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Find user by email
	user, err := h.UserRepo.GetUserByEmail(c.Request.Context(), req.Email)
	if err != nil {
		log.Printf("Error fetching user by email during login: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "An error occurred during login"})
		return
	}

	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Check password
	if !user.CheckPassword(req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Generate JWT tokens
	accessToken, refreshToken, err := auth.GenerateTokens(user, h.JWTSecret, h.AccessTokenTTL, h.RefreshTokenTTL)
	if err != nil {
		log.Printf("Error generating tokens for user %s: %v\n", user.Email, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate authentication tokens"})
		return
	}

	// Important: Don't send password hash back to client!
	// The user object from GetUserByEmail contains the hash, but the User struct
	// has `json:"-"` on PasswordHash, so it won't be marshalled.

	resp := auth.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	}

	c.JSON(http.StatusOK, resp)
}

// Placeholder for Refresh Token endpoint (implement later if needed)
func (h *AuthHandler) Refresh(c *gin.Context) {
	// 1. Get refresh token from request (e.g., JSON body)
	// 2. Validate the refresh token using auth.ValidateToken
	// 3. Check if token is expired or invalid -> Unauthorized
	// 4. Fetch user associated with the token (e.g., from claims user_id)
	// 5. Generate new access token (and potentially a new refresh token)
	// 6. Return new tokens
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Refresh token endpoint not implemented yet"})
}

// Example protected route handler
func (h *AuthHandler) GetUserProfile(c *gin.Context) {
	claims, exists := auth.GetCurrentUser(c)
	if !exists {
		// This should technically be caught by the middleware, but good practice to check
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Could not retrieve user claims from context"})
		return
	}

	// You can fetch full user details from DB using claims.UserID if needed
	// For now, just return the claims info
	c.JSON(http.StatusOK, gin.H{
		"message": "This is a protected route",
		"user_id": claims.UserID,
		"email":   claims.Email,
		"expires": claims.ExpiresAt.Format(time.RFC3339),
	})
}
