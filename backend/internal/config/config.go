package config

import (
	"log"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port            string
	DatabaseURL     string
	JWTSecret       string        // Added
	AccessTokenTTL  time.Duration // Added
	RefreshTokenTTL time.Duration // Added (Optional for later)
	GitAuthToken    string        // Added: For HTTPS PAT/Token Auth
	GitSSHKeyPath   string        // Optional: For SSH Key Auth
	GitUserName     string        // Added
	GitUserEmail    string        // Added
}

func Load() (*Config, error) {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, relying on environment variables")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Println("Warning: DATABASE_URL environment variable not set.")
		dbURL = "postgresql://user:password@db:5432/appdb?sslmode=disable"
	}

	// --- JWT Configuration ---
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Println("Warning: JWT_SECRET environment variable not set. Using default (INSECURE!)")
		jwtSecret = "a_very_insecure_default_secret_key_change_me" // !! CHANGE THIS IN PRODUCTION !!
	}

	accessTokenTTLStr := os.Getenv("ACCESS_TOKEN_TTL_MINUTES")
	if accessTokenTTLStr == "" {
		accessTokenTTLStr = "15" // Default to 15 minutes
	}
	accessTokenTTLMinutes, err := strconv.Atoi(accessTokenTTLStr)
	if err != nil {
		log.Printf("Warning: Invalid ACCESS_TOKEN_TTL_MINUTES. Using default 15 minutes. Error: %v\n", err)
		accessTokenTTLMinutes = 15
	}
	accessTokenTTL := time.Duration(accessTokenTTLMinutes) * time.Minute

	// Placeholder for Refresh Token TTL (can be much longer, e.g., hours or days)
	refreshTokenTTLStr := os.Getenv("REFRESH_TOKEN_TTL_HOURS")
	if refreshTokenTTLStr == "" {
		refreshTokenTTLStr = "168" // Default to 7 days (168 hours)
	}
	refreshTokenTTLHours, err := strconv.Atoi(refreshTokenTTLStr)
	if err != nil {
		log.Printf("Warning: Invalid REFRESH_TOKEN_TTL_HOURS. Using default 168 hours. Error: %v\n", err)
		refreshTokenTTLHours = 168
	}
	refreshTokenTTL := time.Duration(refreshTokenTTLHours) * time.Hour

	// --- Git Configuration ---
	gitAuthToken := os.Getenv("GIT_AUTH_TOKEN")
	// No warning needed if empty, SSH key might be used instead

	gitSSHKeyPath := os.Getenv("GIT_SSH_KEY_PATH")
	if gitSSHKeyPath == "" && gitAuthToken == "" {
		// Warn only if BOTH auth methods are missing
		log.Println("Warning: Neither GIT_AUTH_TOKEN nor GIT_SSH_KEY_PATH is set. Git operations on private repositories will likely fail.")
	} else if gitSSHKeyPath != "" && gitAuthToken != "" {
		log.Println("Warning: Both GIT_AUTH_TOKEN and GIT_SSH_KEY_PATH are set. Using GIT_AUTH_TOKEN (HTTPS) by default.")
		gitSSHKeyPath = "" // Prioritize token auth
	}

	gitUserName := os.Getenv("GIT_USER_NAME")
	if gitUserName == "" {
		gitUserName = "TerraOps Bot" // Default commit user name
	}

	gitUserEmail := os.Getenv("GIT_USER_EMAIL")
	if gitUserEmail == "" {
		gitUserEmail = "terraops-bot@example.com" // Default commit user email
	}

	return &Config{
		Port:            port,
		DatabaseURL:     dbURL,
		JWTSecret:       jwtSecret,
		AccessTokenTTL:  accessTokenTTL,
		RefreshTokenTTL: refreshTokenTTL,
		GitAuthToken:    gitAuthToken,  // Added
		GitSSHKeyPath:   gitSSHKeyPath, // Kept, but now optional
		GitUserName:     gitUserName,   // Added
		GitUserEmail:    gitUserEmail,  // Added
	}, nil
}
