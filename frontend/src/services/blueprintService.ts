import apiClient from './api';
import { Blueprint } from '../types'; // Import Blueprint type

const listBlueprints = async (): Promise<Blueprint[]> => {
  try {
    const response = await apiClient.get<Blueprint[]>('/blueprints');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching blueprints:", error);
    // Re-throw or handle error as needed
    throw error;
  }
};

// Add create, getById, update, delete, parse functions later
const getBlueprintById = async (id: string): Promise<Blueprint> => {
    const response = await apiClient.get<Blueprint>(`/blueprints/${id}`);
    return response.data;
}

const parseBlueprint = async (id: string): Promise<any> => { // Return type might be more specific
    const response = await apiClient.post(`/blueprints/${id}/parse`);
    return response.data;
}

const createBlueprint = async (data: Omit<Blueprint, 'id' | 'created_at' | 'updated_at' | 'source_type'>): Promise<Blueprint> => {
    const response = await apiClient.post<Blueprint>('/blueprints', data);
    return response.data;
}

const deleteBlueprint = async (id: string): Promise<void> => {
    await apiClient.delete(`/blueprints/${id}`);
}


const blueprintService = {
  listBlueprints,
  getBlueprintById,
  parseBlueprint,
  createBlueprint,
  deleteBlueprint,
  // ... other functions
};

export default blueprintService;