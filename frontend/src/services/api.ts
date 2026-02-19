import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: any) => void
  reject: (reason: any) => void
}> = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

export const extractListData = <T>(data: unknown): T[] => {
  if (Array.isArray(data)) {
    return data as T[]
  }

  if (data && typeof data === 'object' && 'results' in data) {
    const paged = data as { results?: unknown }
    if (Array.isArray(paged.results)) {
      return paged.results as T[]
    }
  }

  return []
}

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Skip refresh for refresh token endpoint itself
    if (originalRequest.url?.includes('/auth/token/refresh/')) {
      return Promise.reject(error)
    }

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => {
            // Remove old auth header so request interceptor adds the new one
            delete originalRequest.headers['Authorization']
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refreshToken')
      
      if (!refreshToken) {
        // No refresh token, redirect to login
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        processQueue(error, null)
        isRefreshing = false
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        // Try to refresh the token using a fresh axios instance to avoid interceptor loops
        const response = await axios.post(`${API_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        })

        const newToken = response.data.access
        const newRefreshToken = response.data.refresh
        
        // Store new tokens - this will be picked up by the request interceptor
        localStorage.setItem('token', newToken)
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken)
        }
        
        // Process queued requests with the new token
        processQueue(null, newToken)
        isRefreshing = false
        
        // Retry the original request - the request interceptor will add the new token from localStorage
        delete originalRequest.headers['Authorization']
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        processQueue(refreshError, null)
        isRefreshing = false
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
