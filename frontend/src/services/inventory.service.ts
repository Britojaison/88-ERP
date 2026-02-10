import api from './api'

export interface InventoryBalance {
  id: string
  sku: string
  location: string
  quantity: number
  reserved_quantity: number
  available_quantity: number
  updated_at: string
}

export interface InventoryMovement {
  id: string
  sku: string
  location: string
  movement_type: string
  quantity: number
  reference_type?: string
  reference_id?: string
  created_at: string
}

export const inventoryService = {
  getBalances: async (params?: any) => {
    const response = await api.get('/inventory/balances/', { params })
    return response.data
  },

  getBalance: async (id: string) => {
    const response = await api.get(`/inventory/balances/${id}/`)
    return response.data
  },

  getMovements: async (params?: any) => {
    const response = await api.get('/inventory/movements/', { params })
    return response.data
  },

  createMovement: async (data: Partial<InventoryMovement>) => {
    const response = await api.post('/inventory/movements/', data)
    return response.data
  },

  getStockAlerts: async () => {
    const response = await api.get('/inventory/alerts/')
    return response.data
  },
}
