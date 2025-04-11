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
  
  // Add other types like ClientInstance later