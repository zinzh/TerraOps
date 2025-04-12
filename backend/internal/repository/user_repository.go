package repository

import (
	"context"
	"errors"
	"log"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zinzh/TerraOps/backend/internal/models" // Adjust import path
)

var ErrDuplicateEmail = errors.New("email address already exists")

type UserRepository struct {
	DB *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{DB: db}
}

func (r *UserRepository) CreateUser(ctx context.Context, user *models.User) (uuid.UUID, error) {
	if user.Role == "" {
		user.Role = models.RoleUser
	}

	query := `
		INSERT INTO users (email, password_hash, first_name, last_name, role) -- Added role
		VALUES ($1, $2, $3, $4, $5) 
		RETURNING id`

	var userID uuid.UUID
	err := r.DB.QueryRow(ctx, query,
		user.Email,
		user.PasswordHash,
		user.FirstName,
		user.LastName,
		user.Role, // Pass role
	).Scan(&userID)

	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			// Check for unique violation error code for email
			if pgErr.Code == "23505" && pgErr.ConstraintName == "users_email_key" {
				return uuid.Nil, ErrDuplicateEmail
			}
		}
		log.Printf("Error creating user: %v\n", err)
		return uuid.Nil, err
	}

	return userID, nil
}

func (r *UserRepository) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `
		SELECT id, email, password_hash, first_name, last_name, role, created_at, updated_at -- Added role
		FROM users
		WHERE email = $1`

	var user models.User
	err := r.DB.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.FirstName,
		&user.LastName,
		&user.Role, // Scan role
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // User not found, not necessarily an error in all contexts
		}
		log.Printf("Error getting user by email: %v\n", err)
		return nil, err
	}

	return &user, nil
}

func (r *UserRepository) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	query := `
		SELECT id, email, password_hash, first_name, last_name, role, created_at, updated_at -- Added role
		FROM users
		WHERE id = $1`

	var user models.User
	err := r.DB.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.FirstName,
		&user.LastName,
		&user.Role, // Scan role
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // User not found
		}
		log.Printf("Error getting user by ID: %v\n", err)
		return nil, err
	}

	return &user, nil
}
