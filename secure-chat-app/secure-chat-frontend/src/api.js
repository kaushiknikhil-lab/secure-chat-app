import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage or from the config headers
    const token = localStorage.getItem('token') || config.headers?.Authorization?.split(' ')[1];
    
    // Only add Authorization header if we have a valid token
    if (token && token !== 'anonymous-token') {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`
      };
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Response error:', error);
    if (error.response) {
      console.error('Error data:', error.response.data);
      console.error('Error status:', error.response.status);
    }
    return Promise.reject(error);
  }
);

export default api;