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
	"github.com/zinzh/TerraOps/backend/internal/auth"
	"github.com/zinzh/TerraOps/backend/internal/config"
	"github.com/zinzh/TerraOps/backend/internal/database"
	"github.com/zinzh/TerraOps/backend/internal/git"
	"github.com/zinzh/TerraOps/backend/internal/handlers"
	"github.com/zinzh/TerraOps/backend/internal/parser"
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

	// --- Initialize Services ---
	gitSvc, err := git.NewService("")
	if err != nil {
		log.Fatalf("Failed to initialize Git service: %v", err)
	}
	parserSvc := parser.NewHCLParserService()

	// --- Initialize Repositories ---
	userRepo := repository.NewUserRepository(dbpool)
	blueprintRepo := repository.NewBlueprintRepository(dbpool)
	instanceRepo := repository.NewClientInstanceRepository(dbpool) // Added

	// --- Initialize Handlers ---
	healthHandler := handlers.NewHealthHandler(dbpool)
	userHandler := handlers.NewUserHandler(userRepo)
	authHandler := handlers.NewAuthHandler(userRepo, cfg.JWTSecret, cfg.AccessTokenTTL, cfg.RefreshTokenTTL)
	blueprintHandler := handlers.NewBlueprintHandler(blueprintRepo, gitSvc, parserSvc)
	// Added ClientInstanceHandler
	instanceHandler := handlers.NewClientInstanceHandler(instanceRepo, blueprintRepo, gitSvc)

	// --- Setup Routes ---
	// gin.SetMode(gin.ReleaseMode)
	router := gin.Default()
	api := router.Group("/api")
	{
		api.GET("/health", healthHandler.GetHealth)
		authGroup := api.Group("/auth")
		{
			authGroup.POST("/login", authHandler.Login)
			authGroup.POST("/refresh", authHandler.Refresh)
		}
		usersGroup := api.Group("/users")
		{
			usersGroup.POST("", userHandler.RegisterUser)
		}

		// --- Protected Routes ---
		protected := api.Group("")
		protected.Use(auth.AuthMiddleware(cfg.JWTSecret))
		{
			protected.GET("/profile", authHandler.GetUserProfile)

			// --- Blueprint Routes ---
			blueprintRoutes := protected.Group("/blueprints")
			{
				blueprintRoutes.POST("", blueprintHandler.CreateBlueprint)
				blueprintRoutes.GET("", blueprintHandler.ListBlueprints)
				blueprintRoutes.GET("/:id", blueprintHandler.GetBlueprint)
				blueprintRoutes.PUT("/:id", blueprintHandler.UpdateBlueprint)
				blueprintRoutes.DELETE("/:id", blueprintHandler.DeleteBlueprint)
				blueprintRoutes.POST("/:id/parse", blueprintHandler.ParseBlueprintVariables)
			}

			// --- Client Instance Routes --- // Added Section
			instanceRoutes := protected.Group("/client-instances")
			{
				instanceRoutes.POST("", instanceHandler.CreateClientInstance)
				instanceRoutes.GET("", instanceHandler.ListClientInstances)
				instanceRoutes.GET("/:id", instanceHandler.GetClientInstance)
				instanceRoutes.PUT("/:id", instanceHandler.UpdateClientInstance)
				instanceRoutes.DELETE("/:id", instanceHandler.DeleteClientInstance)
				instanceRoutes.POST("/:id/sync", instanceHandler.SyncClientInstance) // Placeholder
			}

		} // End Protected Group
	} // End API Group

	// --- Start Server & Graceful Shutdown ---
	// ... (server start/shutdown logic remains the same) ...
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
