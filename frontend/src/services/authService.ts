import apiClient from './api';
// Remove CreateUserRequest from import if it's not defined in ../types
// import { User, CreateUserRequest } from '../types';
import { User } from '../types';

// Define CreateUserRequest here if not available globally
interface CreateUserRequest {
  email: string;
  password: string;
  first_name?: string; // Match JSON tags from backend model
  last_name?: string;  // Match JSON tags from backend model
}

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
const isAdmin = (): boolean => {
  const user = getCurrentUser();
  return user?.role === 'admin'; // Use constant from models later if shared
};

const isUser = (): boolean => {
  const user = getCurrentUser();
  // Admins are also considered 'users' in terms of base permissions
  return user?.role === 'user' || user?.role === 'admin';
};

// Add Register function
const register = async (userData: CreateUserRequest): Promise<User> => {
  // The backend endpoint is /api/users (POST)
  const response = await apiClient.post<User>('/users', userData);
  // Registration might not automatically log the user in, so we just return the created user data
  // Or handle potential errors like duplicate email (backend returns 409 Conflict)
  return response.data;
};

const authService = {
  login,
  register, // Add register here
  logout,
  getCurrentUser,
  isAuthenticated,
  isAdmin, 
  isUser,  
};

export default authService;