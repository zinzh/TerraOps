package database

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(databaseURL string) (*pgxpool.Pool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		log.Printf("Unable to parse DATABASE_URL: %v\n", err)
		return nil, err
	}

	// Optional: Configure pool settings
	// poolConfig.MaxConns = 10
	// poolConfig.MinConns = 2
	// poolConfig.MaxConnLifetime = time.Hour
	// poolConfig.MaxConnIdleTime = 30 * time.Minute

	dbpool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Printf("Unable to create connection pool: %v\n", err)
		return nil, err
	}

	// Ping the database to verify connection
	ctxPing, cancelPing := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelPing()
	err = dbpool.Ping(ctxPing)
	if err != nil {
		dbpool.Close() // Close pool if ping fails
		log.Printf("Unable to ping database: %v\n", err)
		return nil, err
	}

	log.Println("Successfully connected to database.")
	return dbpool, nil
}
