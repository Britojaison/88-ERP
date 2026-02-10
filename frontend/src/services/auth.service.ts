import api from './api'

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResponse {
  access: string
  refresh: string
  user: {
    id: string
    email: string
    name: string
    role: string
  }
}

export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post('/auth/token/', credentials)
    if (response.data.access) {
      localStorage.setItem('token', response.data.access)
      localStorage.setItem('refreshToken', response.data.refresh)
    }
    return response.data
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
  },

  refreshToken: async (): Promise<string> => {
    const refresh = localStorage.getItem('refreshToken')
    const response = await api.post('/auth/token/refresh/', { refresh })
    if (response.data.access) {
      localStorage.setItem('token', response.data.access)
    }
    return response.data.access
  },

  getCurrentUser: async () => {
    const response = await api.get('/mdm/users/me/')
    return response.data
  },
}
