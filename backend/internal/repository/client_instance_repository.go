package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv" // Added

	// Added
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zinzh/TerraOps/backend/internal/models"
)

var ErrClientInstanceNotFound = errors.New("client instance not found")
var ErrDuplicateClientInstanceName = errors.New("client instance name already exists")
var ErrDuplicateClientInstanceRepoURL = errors.New("client instance git repo url already exists")

type ClientInstanceRepository struct {
	DB *pgxpool.Pool
}

func NewClientInstanceRepository(db *pgxpool.Pool) *ClientInstanceRepository {
	return &ClientInstanceRepository{DB: db}
}

func (r *ClientInstanceRepository) handleClientInstancePgError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		// Unique violations
		if pgErr.Code == "23505" {
			if pgErr.ConstraintName == "client_instances_name_key" {
				return ErrDuplicateClientInstanceName
			}
			if pgErr.ConstraintName == "client_instances_client_repo_url_key" {
				return ErrDuplicateClientInstanceRepoURL
			}
		}
		// Foreign key violation (e.g., blueprint_id doesn't exist)
		if pgErr.Code == "23503" {
			return fmt.Errorf("database constraint violation: %s", pgErr.Detail) // Provide more detail
		}
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrClientInstanceNotFound
	}
	log.Printf("Error executing client instance query: %v\n", err)
	return err
}

func (r *ClientInstanceRepository) CreateClientInstance(ctx context.Context, ci *models.ClientInstance) (uuid.UUID, error) {
	query := `
		INSERT INTO client_instances (
			name, description, blueprint_id, variable_values,
			client_repo_url, client_repo_branch
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id`

	var instanceID uuid.UUID
	err := r.DB.QueryRow(ctx, query,
		ci.Name,
		ci.Description,
		ci.BlueprintID,
		ci.VariableValues, // Can be nil initially
		ci.ClientRepoURL,
		ci.ClientRepoBranch,
	).Scan(&instanceID)

	if err != nil {
		return uuid.Nil, r.handleClientInstancePgError(err)
	}

	return instanceID, nil
}

func (r *ClientInstanceRepository) GetClientInstanceByID(ctx context.Context, id uuid.UUID) (*models.ClientInstance, error) {
	query := `
		SELECT
			id, name, description, blueprint_id, variable_values,
			client_repo_url, client_repo_branch,
			last_sync_status, last_sync_message, last_synced_at,
			created_at, updated_at
		FROM client_instances
		WHERE id = $1`

	var ci models.ClientInstance
	err := r.DB.QueryRow(ctx, query, id).Scan(
		&ci.ID,
		&ci.Name,
		&ci.Description,
		&ci.BlueprintID,
		&ci.VariableValues,
		&ci.ClientRepoURL,
		&ci.ClientRepoBranch,
		&ci.LastSyncStatus,
		&ci.LastSyncMessage,
		&ci.LastSyncedAt,
		&ci.CreatedAt,
		&ci.UpdatedAt,
	)

	if err != nil {
		return nil, r.handleClientInstancePgError(err)
	}

	return &ci, nil
}

func (r *ClientInstanceRepository) ListClientInstances(ctx context.Context) ([]*models.ClientInstance, error) {
	query := `
		SELECT
			id, name, description, blueprint_id, variable_values,
			client_repo_url, client_repo_branch,
			last_sync_status, last_sync_message, last_synced_at,
			created_at, updated_at
		FROM client_instances
		ORDER BY name ASC`

	rows, err := r.DB.Query(ctx, query)
	if err != nil {
		log.Printf("Error listing client instances: %v\n", err)
		return nil, err
	}
	defer rows.Close()

	instances := []*models.ClientInstance{}
	for rows.Next() {
		var ci models.ClientInstance
		err := rows.Scan(
			&ci.ID,
			&ci.Name,
			&ci.Description,
			&ci.BlueprintID,
			&ci.VariableValues,
			&ci.ClientRepoURL,
			&ci.ClientRepoBranch,
			&ci.LastSyncStatus,
			&ci.LastSyncMessage,
			&ci.LastSyncedAt,
			&ci.CreatedAt,
			&ci.UpdatedAt,
		)
		if err != nil {
			log.Printf("Error scanning client instance row: %v\n", err)
			return nil, err
		}
		instances = append(instances, &ci)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Error iterating client instance rows: %v\n", err)
		return nil, err
	}

	return instances, nil
}

func (r *ClientInstanceRepository) UpdateClientInstance(ctx context.Context, id uuid.UUID, req *models.UpdateClientInstanceRequest) error {
	query := "UPDATE client_instances SET "
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
	if req.VariableValues != nil {
		query += "variable_values = $" + strconv.Itoa(argID) + ", "
		args = append(args, *req.VariableValues)
		argID++
	}
	if req.ClientRepoURL != nil {
		query += "client_repo_url = $" + strconv.Itoa(argID) + ", "
		args = append(args, *req.ClientRepoURL)
		argID++
	}
	if req.ClientRepoBranch != nil {
		query += "client_repo_branch = $" + strconv.Itoa(argID) + ", "
		args = append(args, *req.ClientRepoBranch)
		argID++
	}

	if argID == 1 {
		return errors.New("no update fields provided")
	}

	query += "updated_at = NOW() WHERE id = $" + strconv.Itoa(argID)
	args = append(args, id)

	cmdTag, err := r.DB.Exec(ctx, query, args...)
	if err != nil {
		return r.handleClientInstancePgError(err)
	}
	if cmdTag.RowsAffected() == 0 {
		return ErrClientInstanceNotFound
	}
	return nil
}

func (r *ClientInstanceRepository) DeleteClientInstance(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM client_instances WHERE id = $1`
	cmdTag, err := r.DB.Exec(ctx, query, id)

	if err != nil {
		return r.handleClientInstancePgError(err) // Handles not found already
	}
	if cmdTag.RowsAffected() == 0 {
		return ErrClientInstanceNotFound
	}
	return nil
}

// UpdateSyncStatus updates the status after attempting to sync with Git repo
func (r *ClientInstanceRepository) UpdateSyncStatus(ctx context.Context, id uuid.UUID, values json.RawMessage, status string, message *string) error {
	query := `
        UPDATE client_instances
        SET variable_values = $1, last_sync_status = $2, last_sync_message = $3, last_synced_at = NOW(), updated_at = NOW()
        WHERE id = $4`

	cmdTag, err := r.DB.Exec(ctx, query, values, status, message, id)
	if err != nil {
		return r.handleClientInstancePgError(err)
	}
	if cmdTag.RowsAffected() == 0 {
		return ErrClientInstanceNotFound
	}
	return nil
}
