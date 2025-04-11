package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HealthHandler struct {
	DB *pgxpool.Pool
}

func NewHealthHandler(db *pgxpool.Pool) *HealthHandler {
	return &HealthHandler{DB: db}
}

func (h *HealthHandler) GetHealth(c *gin.Context) {
	dbStatus := "ok"
	dbMessage := "Database connection healthy"

	// Check database connection if DB pool is provided
	if h.DB != nil {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
		defer cancel()
		if err := h.DB.Ping(ctx); err != nil {
			dbStatus = "error"
			dbMessage = "Database connection error: " + err.Error()
			// Log the error server-side
			c.Error(err) // Gin will handle logging this if middleware is set up
		}
	} else {
		dbStatus = "not configured"
		dbMessage = "Database pool not initialized for health check"
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"database": gin.H{
			"status":  dbStatus,
			"message": dbMessage,
		},
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}
