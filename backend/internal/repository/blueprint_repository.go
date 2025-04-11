package repository

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"strconv"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zinzh/TerraOps/backend/internal/models"
)

var ErrBlueprintNotFound = errors.New("blueprint not found")
var ErrDuplicateBlueprintName = errors.New("blueprint name already exists")
var ErrDuplicateBlueprintRepoURL = errors.New("blueprint git repo url already exists")

type BlueprintRepository struct {
	DB *pgxpool.Pool
}

func NewBlueprintRepository(db *pgxpool.Pool) *BlueprintRepository {
	return &BlueprintRepository{DB: db}
}

func (r *BlueprintRepository) handleBlueprintPgError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		// Check for unique violation errors
		if pgErr.Code == "23505" {
			if pgErr.ConstraintName == "blueprints_name_key" {
				return ErrDuplicateBlueprintName
			}
			if pgErr.ConstraintName == "blueprints_git_repo_url_key" {
				return ErrDuplicateBlueprintRepoURL
			}
		}
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrBlueprintNotFound
	}
	log.Printf("Error executing blueprint query: %v\n", err)
	return err // Return original or generic error if not specific known type
}

func (r *BlueprintRepository) CreateBlueprint(ctx context.Context, bp *models.Blueprint) (uuid.UUID, error) {
	query := `
		INSERT INTO blueprints (name, description, git_repo_url)
		VALUES ($1, $2, $3)
		RETURNING id`

	var blueprintID uuid.UUID
	err := r.DB.QueryRow(ctx, query,
		bp.Name,
		bp.Description,
		bp.GitRepoURL,
	).Scan(&blueprintID)

	if err != nil {
		return uuid.Nil, r.handleBlueprintPgError(err)
	}

	return blueprintID, nil
}

func (r *BlueprintRepository) GetBlueprintByID(ctx context.Context, id uuid.UUID) (*models.Blueprint, error) {
	query := `
		SELECT id, name, description, git_repo_url, source_type, variables_definition,
		       last_parsed_at, parse_error, created_at, updated_at
		FROM blueprints
		WHERE id = $1`

	var bp models.Blueprint
	err := r.DB.QueryRow(ctx, query, id).Scan(
		&bp.ID,
		&bp.Name,
		&bp.Description,
		&bp.GitRepoURL,
		&bp.SourceType,
		&bp.VariablesDefinition,
		&bp.LastParsedAt,
		&bp.ParseError,
		&bp.CreatedAt,
		&bp.UpdatedAt,
	)

	if err != nil {
		return nil, r.handleBlueprintPgError(err)
	}

	return &bp, nil
}

func (r *BlueprintRepository) ListBlueprints(ctx context.Context) ([]*models.Blueprint, error) {
	query := `
		SELECT id, name, description, git_repo_url, source_type, variables_definition,
		       last_parsed_at, parse_error, created_at, updated_at
		FROM blueprints
		ORDER BY name ASC` // Or created_at, etc.

	rows, err := r.DB.Query(ctx, query)
	if err != nil {
		log.Printf("Error listing blueprints: %v\n", err)
		return nil, err
	}
	defer rows.Close()

	blueprints := []*models.Blueprint{}
	for rows.Next() {
		var bp models.Blueprint
		err := rows.Scan(
			&bp.ID,
			&bp.Name,
			&bp.Description,
			&bp.GitRepoURL,
			&bp.SourceType,
			&bp.VariablesDefinition,
			&bp.LastParsedAt,
			&bp.ParseError,
			&bp.CreatedAt,
			&bp.UpdatedAt,
		)
		if err != nil {
			log.Printf("Error scanning blueprint row: %v\n", err)
			// Decide whether to return partial list or error out
			return nil, err
		}
		blueprints = append(blueprints, &bp)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Error iterating blueprint rows: %v\n", err)
		return nil, err
	}

	return blueprints, nil
}

func (r *BlueprintRepository) UpdateBlueprint(ctx context.Context, id uuid.UUID, req *models.UpdateBlueprintRequest) error {
	// Build the update query dynamically based on provided fields
	query := "UPDATE blueprints SET "
	args := []interface{}{}
	argID := 1

	if req.Name != nil {
		query += "name = $" + strconv.Itoa(argID) + ", "
		args = append(args, *req.Name)
		argID++
	}
	if req.Description != nil {
		query += "description = $" + strconv.Itoa(argID) + ", "
		args = append(args, *req.Description)
		argID++
	}
	if req.GitRepoURL != nil {
		query += "git_repo_url = $" + strconv.Itoa(argID) + ", "
		args = append(args, *req.GitRepoURL)
		argID++
	}

	// Only update if at least one field was provided
	if argID == 1 {
		return errors.New("no update fields provided")
	}

	// Add updated_at and WHERE clause
	query += "updated_at = NOW() WHERE id = $" + strconv.Itoa(argID)
	args = append(args, id)

	// Execute the query
	cmdTag, err := r.DB.Exec(ctx, query, args...)
	if err != nil {
		return r.handleBlueprintPgError(err)
	}

	if cmdTag.RowsAffected() == 0 {
		return ErrBlueprintNotFound // Or handle appropriately if update is idempotent
	}

	return nil
}

func (r *BlueprintRepository) DeleteBlueprint(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM blueprints WHERE id = $1`
	cmdTag, err := r.DB.Exec(ctx, query, id)

	if err != nil {
		// Check for foreign key constraints if client_instances exist
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" { // foreign_key_violation
			return errors.New("cannot delete blueprint: it is being used by client instances")
		}
		log.Printf("Error deleting blueprint: %v\n", err)
		return err
	}

	if cmdTag.RowsAffected() == 0 {
		return ErrBlueprintNotFound
	}

	return nil
}

// UpdateParsedVariables updates the parsing result for a blueprint
func (r *BlueprintRepository) UpdateParsedVariables(ctx context.Context, id uuid.UUID, variables json.RawMessage, parseError *string) error {
	query := `
		UPDATE blueprints
		SET variables_definition = $1, parse_error = $2, last_parsed_at = NOW(), updated_at = NOW()
		WHERE id = $3`

	cmdTag, err := r.DB.Exec(ctx, query, variables, parseError, id)
	if err != nil {
		return r.handleBlueprintPgError(err)
	}

	if cmdTag.RowsAffected() == 0 {
		return ErrBlueprintNotFound
	}
	return nil
}
