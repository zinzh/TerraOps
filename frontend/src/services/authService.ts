import apiClient from './api';
import { User } from '../types'; // Import User type

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
  if (response.data.access_token) {
    localStorage.setItem('accessToken', response.data.access_token);
    localStorage.setItem('user', JSON.stringify(response.data.user)); // Store user info
  }
  return response.data;
};

const logout = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
  // Optionally call a backend logout endpoint if it exists
};

const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
      localStorage.removeItem('user'); // Clear corrupted data
      return null;
    }
  }
  return null;
};

const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('accessToken');
};


const authService = {
  login,
  logout,
  getCurrentUser,
  isAuthenticated,
};

export default authService;