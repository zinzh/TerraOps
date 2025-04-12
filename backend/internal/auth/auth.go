package auth

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/zinzh/TerraOps/backend/internal/models" // Adjusted import path
)

// Context Key for storing user info
const UserContextKey = "user"

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"` // Added for future use
	User         *models.User `json:"user"`
}

type Claims struct {
	UserID uuid.UUID `json:"user_id"`
	Email  string    `json:"email"`
	Role   string    `json:"role"`
	jwt.RegisteredClaims
}

// GenerateTokens creates both access and refresh JWT tokens
func GenerateTokens(user *models.User, secret string, accessTTL time.Duration, refreshTTL time.Duration) (string, string, error) {
	// Generate Access Token
	accessToken, err := generateToken(user, secret, accessTTL)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate access token: %w", err)
	}

	// Generate Refresh Token (uses same claims structure but longer expiry)
	refreshToken, err := generateToken(user, secret, refreshTTL)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate refresh token: %w", err)
	}

	return accessToken, refreshToken, nil
}

// generateToken is a helper to create a single token
func generateToken(user *models.User, secret string, ttl time.Duration) (string, error) {
	claims := &Claims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "my-tfvars-manager",
			Subject:   user.ID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", err
	}
	return signedToken, nil
}

// ValidateToken verifies a JWT token string
func ValidateToken(tokenString string, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// Check the signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, errors.New("token has expired")
		}
		if errors.Is(err, jwt.ErrTokenNotValidYet) {
			return nil, errors.New("token not active yet")
		}
		return nil, fmt.Errorf("token validation failed: %w", err)
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

// AuthMiddleware creates a Gin middleware for JWT authentication
func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header format must be Bearer {token}"})
			return
		}

		tokenString := parts[1]
		claims, err := ValidateToken(tokenString, jwtSecret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token", "details": err.Error()})
			return
		}

		// Store user information in context for downstream handlers
		c.Set(UserContextKey, claims) // Store the claims

		c.Next()
	}
}

// GetCurrentUser retrieves the authenticated user claims from the Gin context
func GetCurrentUser(c *gin.Context) (*Claims, bool) {
	claims, exists := c.Get(UserContextKey)
	if !exists {
		return nil, false
	}

	userClaims, ok := claims.(*Claims)
	if !ok {
		// This should ideally not happen if middleware is working correctly
		return nil, false
	}

	return userClaims, true
}
func RoleMiddleware(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, exists := GetCurrentUser(c) // Get claims stored by AuthMiddleware
		if !exists {
			// This should have been caught by AuthMiddleware already
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User claims not found"})
			return
		}

		// Check if user has the required role (or if admin, allow all)
		// NOTE: This logic assumes 'admin' can do everything 'user' can.
		// Adjust if you need more granular checks (e.g., user cannot do admin tasks).
		hasPermission := false
		if claims.Role == models.RoleAdmin { // Admin has all permissions
			hasPermission = true
		} else if claims.Role == requiredRole { // User has the specific required role
			hasPermission = true
		}

		if !hasPermission {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("Forbidden: Requires '%s' role or higher", requiredRole)})
			return
		}

		c.Next()
	}
}
