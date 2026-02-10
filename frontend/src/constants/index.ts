// Application constants

export const APP_NAME = '88 ERP Platform'
export const APP_VERSION = '1.0.0'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/',
  MASTER_DATA: '/master-data',
  DOCUMENTS: '/documents',
  INVENTORY: '/inventory',
  REPORTS: '/reports',
  SETTINGS: '/settings',
} as const

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'success' },
  { value: 'inactive', label: 'Inactive', color: 'default' },
  { value: 'draft', label: 'Draft', color: 'info' },
  { value: 'pending', label: 'Pending', color: 'warning' },
  { value: 'approved', label: 'Approved', color: 'success' },
  { value: 'rejected', label: 'Rejected', color: 'error' },
] as const

export const DATE_FORMAT = 'MM/DD/YYYY'
export const DATETIME_FORMAT = 'MM/DD/YYYY HH:mm:ss'

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const
