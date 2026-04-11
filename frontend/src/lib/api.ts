import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', // Backend base URL
});

// Add a request interceptor to include the auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pinaka_token');

  // ❗ Skip token for login route
  if (token && !config.url?.includes('/auth/login')) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Add a response interceptor to handle global errors like 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      console.log("Unauthorized - maybe logout user");
      // Optional: automatically redirect to login or clear token here
      // localStorage.removeItem('pinaka_token');
      // window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
