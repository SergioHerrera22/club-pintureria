import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Falla rápido si el backend/DB no responden: sin timeout un request
  // puede quedar esperando para siempre y "colgar" la pantalla.
  timeout: 20000,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number };
    
    // Reintento automático para errores transitorios del servidor (5xx) o de red.
    // Evita que una falla momentánea (pool de DB saturado, restart del server)
    // rompa la pantalla del dashboard.
    const status = error.response?.status;
    const isServerError = !!status && status >= 500;
    const isNetworkError = !error.response; // timeout, DNS, conexión rechazada...
    const isIdempotent = !originalRequest.method || ['get', 'head', 'options'].includes(originalRequest.method.toLowerCase());
    
    if ((isServerError || isNetworkError) && isIdempotent) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      if (originalRequest._retryCount <= 2) {
        const delay = 500 * originalRequest._retryCount; // 500ms, 1000ms
        await new Promise((resolve) => setTimeout(resolve, delay));
        return api(originalRequest);
      }
    }
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        }).catch((err) => Promise.reject(err));
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        
        processQueue(null, accessToken);
        
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        
        return api(originalRequest);
      } catch (err) {
        processQueue(err as Error, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        // Redirigir según el rol guardado: clientes al portal, personal al login
        let redirectTarget = '/login';
        try {
          const persisted = JSON.parse(localStorage.getItem('auth-storage') || 'null');
          if (persisted?.state?.user?.role === 'CLIENTE') {
            redirectTarget = '/users';
          }
        } catch { /* usar /login */ }
        window.location.href = redirectTarget;
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;