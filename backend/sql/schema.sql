CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional: Index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Optional: Trigger to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_users') THEN
        CREATE TRIGGER set_timestamp_users
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
END
$$;

-- Add after the users table definition

CREATE TABLE IF NOT EXISTS blueprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    git_repo_url VARCHAR(512) UNIQUE NOT NULL,
    source_type VARCHAR(50) NOT NULL DEFAULT 'git', -- For future expansion (e.g., 'local', 'registry')
    variables_definition JSONB, -- Stores parsed variables structure
    last_parsed_at TIMESTAMPTZ,
    parse_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional: Indexes
CREATE INDEX IF NOT EXISTS idx_blueprints_name ON blueprints(name);
CREATE INDEX IF NOT EXISTS idx_blueprints_git_repo_url ON blueprints(git_repo_url);


-- Optional: Trigger to update updated_at timestamp automatically
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_blueprints') THEN
        CREATE TRIGGER set_timestamp_blueprints
        BEFORE UPDATE ON blueprints
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
END
$$;



-- Add after the blueprints table definition

CREATE TABLE IF NOT EXISTS client_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE RESTRICT, -- Prevent deleting blueprint if instances exist
    -- Store client-specific variable values as JSONB
    -- This allows storing the filled-in form data before generating tfvars,
    -- or storing the actual tfvars content if preferred. JSONB is flexible.
    variable_values JSONB,
    -- Target Git repository details for this client instance
    client_repo_url VARCHAR(512) UNIQUE NOT NULL,
    client_repo_branch VARCHAR(100) NOT NULL DEFAULT 'main',
    -- Potentially add fields for Git credentials ID (linking to a secure store later)
    -- git_credentials_id UUID,
    last_sync_status VARCHAR(50), -- e.g., 'pending', 'success', 'failed'
    last_sync_message TEXT,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional: Indexes
CREATE INDEX IF NOT EXISTS idx_client_instances_name ON client_instances(name);
CREATE INDEX IF NOT EXISTS idx_client_instances_blueprint_id ON client_instances(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_client_instances_client_repo_url ON client_instances(client_repo_url);


-- Optional: Trigger to update updated_at timestamp automatically
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_client_instances') THEN
        CREATE TRIGGER set_timestamp_client_instances
        BEFORE UPDATE ON client_instances
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
END
$$;