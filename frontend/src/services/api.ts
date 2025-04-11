import axios from 'axios';

// Use the environment variable set in docker-compose.yml
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add JWT token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor to handle 401 Unauthorized responses (e.g., token expired)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token is invalid or expired
      console.error("Unauthorized access - 401. Redirecting to login.");
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user'); // Remove user info too
      // Redirect to login page - Use window.location for simplicity here
      // A more robust solution uses routing context
      if (!window.location.pathname.includes('/login')) {
         window.location.href = '/login?sessionExpired=true';
      }
    }
    return Promise.reject(error);
  }
);


export default apiClient;