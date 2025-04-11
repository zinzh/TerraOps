package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/zinzh/TerraOps/backend/internal/config"
	"github.com/zinzh/TerraOps/backend/internal/database"
	"github.com/zinzh/TerraOps/backend/internal/handlers"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Connect to database
	dbpool, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		// Log fatality is handled within Connect, but we stop execution here
		log.Fatalf("Database connection failed.")
	}
	// Ensure the pool is closed when the application exits
	defer dbpool.Close()

	// Initialize Gin engine
	// gin.SetMode(gin.ReleaseMode) // Set to ReleaseMode for production
	router := gin.Default() // Includes Logger and Recovery middleware

	// Setup Routes
	healthHandler := handlers.NewHealthHandler(dbpool)

	// Group API routes
	api := router.Group("/api")
	{
		api.GET("/health", healthHandler.GetHealth)
		// Add other API routes here later
	}

	// Serve static files from frontend build (if colocating - less common with separate containers)
	// router.Static("/static", "./static")
	// router.LoadHTMLGlob("templates/*")

	// Setup HTTP Server
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
		// Optional: Add Read/Write timeouts
		// ReadTimeout:  5 * time.Second,
		// WriteTimeout: 10 * time.Second,
		// IdleTimeout:  120 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Server starting on port %s\n", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Could not start server: %s\n", err)
		}
	}()

	// Graceful shutdown handling
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// The context is used to inform the server it has 5 seconds to finish
	// the requests it is currently handling
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exiting")
}
