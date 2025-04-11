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
	"github.com/zinzh/TerraOps/backend/internal/auth" // Added auth import
	"github.com/zinzh/TerraOps/backend/internal/config"
	"github.com/zinzh/TerraOps/backend/internal/database"
	"github.com/zinzh/TerraOps/backend/internal/handlers"
	"github.com/zinzh/TerraOps/backend/internal/repository"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	dbpool, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Database connection failed.")
	}
	defer dbpool.Close()

	// gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	// --- Initialize Repositories ---
	userRepo := repository.NewUserRepository(dbpool)

	// --- Initialize Handlers ---
	healthHandler := handlers.NewHealthHandler(dbpool)
	userHandler := handlers.NewUserHandler(userRepo)
	// Create Auth Handler using config values
	authHandler := handlers.NewAuthHandler(userRepo, cfg.JWTSecret, cfg.AccessTokenTTL, cfg.RefreshTokenTTL)

	// --- Setup Routes ---
	api := router.Group("/api")
	{
		api.GET("/health", healthHandler.GetHealth)

		// --- Auth Routes (No middleware needed) ---
		authGroup := api.Group("/auth")
		{
			authGroup.POST("/login", authHandler.Login)
			authGroup.POST("/refresh", authHandler.Refresh) // Placeholder
			// Add /register here if preferred over /users
			// authGroup.POST("/register", userHandler.RegisterUser)
		}

		// --- User Routes ---
		// Moved registration under /users for now
		usersGroup := api.Group("/users")
		{
			// Public route for registration
			usersGroup.POST("", userHandler.RegisterUser)
		}

		// --- Protected Routes (Example) ---
		// Apply AuthMiddleware to all routes within this group
		protected := api.Group("/protected")
		protected.Use(auth.AuthMiddleware(cfg.JWTSecret)) // Apply middleware here
		{
			// Example protected endpoint
			protected.GET("/profile", authHandler.GetUserProfile)

			// Future protected routes (e.g., blueprint management, client config)
			// go here
		}
	}

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	go func() {
		log.Printf("Server starting on port %s\n", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Could not start server: %s\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exiting")
}
