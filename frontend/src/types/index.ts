// Matches backend models/user.go User struct (excluding password hash)
export interface User {
    id: string; // UUIDs are strings
    email: string;
    first_name?: string;
    last_name?: string;
    created_at: string; // Timestamps are strings (ISO 8601 format)
    updated_at: string;
  }
  
  // Matches backend models/blueprint.go Blueprint struct
  export interface Blueprint {
      id: string;
      name: string;
      description?: string;
      git_repo_url: string;
      source_type: string;
      variables_definition?: any; // Parsed variables - can refine type later
      last_parsed_at?: string;
      parse_error?: string;
      created_at: string;
      updated_at: string;
  }
  
  export interface ClientInstance {
    id: string;
    name: string;
    description?: string;
    blueprint_id: string;
    variable_values?: any; // Store as raw JSON object for now
    client_repo_url: string;
    client_repo_branch: string;
    last_sync_status?: string;
    last_sync_message?: string;
    last_synced_at?: string; // ISO String
    created_at: string;     // ISO String
    updated_at: string;     // ISO String
    blueprint_name?: string; // Added
  }
  
  // Type for the parsed variable definition within a Blueprint
  // Matches backend models/tfvariable.go
  export interface TfVariable {
      name: string;
      type: any; // Store raw JSON representation of type for now
      description?: string;
      default?: any; // Store raw JSON representation of default
      sensitive: boolean;
      nullable: boolean;
      
  }
  
  // Type for the map stored in Blueprint.variables_definition
  export type VariableDefinitions = Record<string, TfVariable>;