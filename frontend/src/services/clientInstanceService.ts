import apiClient from './api';
import { ClientInstance } from '../types'; // Define ClientInstance type if not already done
import { Blueprint } from '../types';    // Needed for potentially embedding blueprint info

// Define ClientInstance type (add to src/types/index.ts if not present)
// export interface ClientInstance {
//   id: string;
//   name: string;
//   description?: string;
//   blueprint_id: string;
//   variable_values?: any; // Raw JSON for now
//   client_repo_url: string;
//   client_repo_branch: string;
//   last_sync_status?: string;
//   last_sync_message?: string;
//   last_synced_at?: string;
//   created_at: string;
//   updated_at: string;
//   // Optional embedded blueprint for convenience in listing?
//   // blueprint?: Pick<Blueprint, 'id' | 'name'>;
// }


// Matches backend models/client_instance.go CreateClientInstanceRequest
interface CreateClientInstanceData {
    name: string;
    description?: string;
    blueprint_id: string; // UUID string
    variable_values?: any; // JSON object/RawMessage
    client_repo_url: string;
    client_repo_branch?: string;
}

const getClientInstanceById = async (id: string): Promise<ClientInstance> => {
    try {
        const response = await apiClient.get<ClientInstance>(`/client-instances/${id}`);
        return response.data;
    } catch (error: any) {
        console.error(`Error fetching client instance ${id}:`, error);
        throw error;
    }
};
interface SyncClientInstanceData {
    variable_values: any; // JSON object/RawMessage
    commit_message?: string;
}

const syncClientInstance = async (id: string, data: SyncClientInstanceData): Promise<any> => {
    try {
        // Backend returns 202 Accepted on successful request trigger
        const response = await apiClient.post(`/client-instances/${id}/sync`, data);
        return response.data; // Contains { message: "...", instance_id: "..." }
    } catch (error: any) {
        console.error(`Error syncing client instance ${id}:`, error);
        throw error;
    }
};

const createClientInstance = async (data: CreateClientInstanceData): Promise<ClientInstance> => {
    try {
        const response = await apiClient.post<ClientInstance>('/client-instances', data);
        return response.data;
    } catch (error: any) {
         console.error("Error creating client instance:", error);
         throw error; // Re-throw
    }
};

// Add list, get, update, sync functions later if needed for other pages

const listClientInstances = async (): Promise<ClientInstance[]> => {
    const response = await apiClient.get<ClientInstance[]>('/client-instances');
    return response.data;
}


const clientInstanceService = {
    createClientInstance,
    listClientInstances, // Add list function
    getClientInstanceById, // Added
    syncClientInstance,
    // ... other functions
};

export default clientInstanceService;