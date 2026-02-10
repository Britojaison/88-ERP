// Common types used across the application

export interface BaseEntity {
  id: string
  status: string
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
}

export type Status = 'active' | 'inactive' | 'draft' | 'deleted' | 'pending' | 'approved' | 'rejected'

export interface User {
  id: string
  email: string
  name: string
  role: string
  company?: string
}

export interface SelectOption {
  value: string
  label: string
}
