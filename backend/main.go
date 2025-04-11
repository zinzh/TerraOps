package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	// Import cors middleware
	"github.com/gin-contrib/cors" // Added
	"github.com/gin-gonic/gin"
	"github.com/zinzh/TerraOps/backend/internal/auth"
	"github.com/zinzh/TerraOps/backend/internal/config"
	"github.com/zinzh/TerraOps/backend/internal/database"
	"github.com/zinzh/TerraOps/backend/internal/git"
	"github.com/zinzh/TerraOps/backend/internal/handlers"
	"github.com/zinzh/TerraOps/backend/internal/maintf"
	"github.com/zinzh/TerraOps/backend/internal/parser"
	"github.com/zinzh/TerraOps/backend/internal/repository"
	"github.com/zinzh/TerraOps/backend/internal/tfvars"
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
	gitSvc, err := git.NewService(
		"", // Default base path
		cfg.GitSSHKeyPath,
		cfg.GitUserName,
		cfg.GitUserEmail,
	)
	if err != nil {
		log.Fatalf("Failed to initialize Git service: %v", err)
	}
	parserSvc := parser.NewHCLParserService()
	tfvarsGen := tfvars.NewGenerator() // Added Tfvars Generator
	mainTfGen := maintf.NewGenerator() // Added MainTf Generator

	// --- Initialize Repositories ---
	userRepo := repository.NewUserRepository(dbpool)
	blueprintRepo := repository.NewBlueprintRepository(dbpool)
	instanceRepo := repository.NewClientInstanceRepository(dbpool)

	// --- Initialize Handlers ---
	healthHandler := handlers.NewHealthHandler(dbpool)
	userHandler := handlers.NewUserHandler(userRepo)
	authHandler := handlers.NewAuthHandler(userRepo, cfg.JWTSecret, cfg.AccessTokenTTL, cfg.RefreshTokenTTL)
	blueprintHandler := handlers.NewBlueprintHandler(blueprintRepo, gitSvc, parserSvc)
	instanceHandler := handlers.NewClientInstanceHandler(
		instanceRepo,
		blueprintRepo,
		gitSvc,
		tfvarsGen, // Added
		mainTfGen, // Added
	)

	// --- Setup Routes ---
	// gin.SetMode(gin.ReleaseMode)
	router := gin.Default() // Includes Logger and Recovery

	// --- Configure CORS Middleware --- // Added Section
	// Adjust configuration based on your needs.
	// For development, allowing localhost:3000 is common.
	// For production, list specific allowed origins.
	corsConfig := cors.Config{
		// Allow specific origins - replace with your frontend URL in production
		AllowOrigins: []string{"http://localhost:3000"},
		// Allow specific methods
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		// Allow specific headers
		AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization"},
		// Expose headers (optional, needed if frontend needs to read specific headers)
		// ExposeHeaders: []string{"Content-Length"},
		// Allow credentials (cookies, authorization headers)
		AllowCredentials: true,
		// MaxAge indicates how long the results of a preflight request can be cached
		MaxAge: 12 * time.Hour,
	}
	router.Use(cors.New(corsConfig))
	// --- End CORS Configuration ---

	// --- API Route Grouping ---
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

		// Protected Routes (Middleware applied below)
		protected := api.Group("") // Grouping for middleware application
		protected.Use(auth.AuthMiddleware(cfg.JWTSecret))
		{
			protected.GET("/profile", authHandler.GetUserProfile)

			blueprintRoutes := protected.Group("/blueprints")
			{
				blueprintRoutes.POST("", blueprintHandler.CreateBlueprint)
				blueprintRoutes.GET("", blueprintHandler.ListBlueprints)
				blueprintRoutes.GET("/:id", blueprintHandler.GetBlueprint)
				blueprintRoutes.PUT("/:id", blueprintHandler.UpdateBlueprint)
				blueprintRoutes.DELETE("/:id", blueprintHandler.DeleteBlueprint)
				blueprintRoutes.POST("/:id/parse", blueprintHandler.ParseBlueprintVariables)
			}

			instanceRoutes := protected.Group("/client-instances")
			{
				instanceRoutes.POST("", instanceHandler.CreateClientInstance)
				instanceRoutes.GET("", instanceHandler.ListClientInstances)
				instanceRoutes.GET("/:id", instanceHandler.GetClientInstance)
				instanceRoutes.PUT("/:id", instanceHandler.UpdateClientInstance)
				instanceRoutes.DELETE("/:id", instanceHandler.DeleteClientInstance)
				instanceRoutes.POST("/:id/sync", instanceHandler.SyncClientInstance)
			}
		} // End Protected Group
	} // End API Group

	// --- Start Server & Graceful Shutdown ---
	// ... (server start/shutdown logic remains the same) ...
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}
	// ... (rest of main) ...
	go func() { // Added go routine from previous steps
		log.Printf("Server starting on port %s\n", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Could not start server: %s\n", err)
		}
	}()
	quit := make(chan os.Signal, 1) // Added quit channel from previous steps
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
