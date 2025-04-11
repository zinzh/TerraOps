package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	DatabaseURL string
	// Add other config fields here later (e.g., JWTSecret)
}

func Load() (*Config, error) {
	// Load .env file if it exists (useful for local development)
	// In production, environment variables should be set directly.
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
		// Provide a default for local docker-compose if needed, but better to require it
		dbURL = "postgresql://user:password@db:5432/appdb?sslmode=disable"
	}

	return &Config{
		Port:        port,
		DatabaseURL: dbURL,
	}, nil
}
