import api from './api'

export interface Product {
  id: string
  code: string
  name: string
  description?: string
  category?: string
  status: string
  created_at: string
  updated_at: string
}

export interface SKU {
  id: string
  code: string
  product: string
  attributes: Record<string, any>
  status: string
  created_at: string
}

export interface Company {
  id: string
  name: string
  type: string
  status: string
  created_at: string
}

export interface Location {
  id: string
  code: string
  name: string
  type: string
  status: string
}

export const mdmService = {
  // Products
  getProducts: async (params?: any) => {
    const response = await api.get('/mdm/products/', { params })
    return response.data
  },

  getProduct: async (id: string) => {
    const response = await api.get(`/mdm/products/${id}/`)
    return response.data
  },

  createProduct: async (data: Partial<Product>) => {
    const response = await api.post('/mdm/products/', data)
    return response.data
  },

  updateProduct: async (id: string, data: Partial<Product>) => {
    const response = await api.put(`/mdm/products/${id}/`, data)
    return response.data
  },

  deleteProduct: async (id: string) => {
    await api.delete(`/mdm/products/${id}/`)
  },

  // SKUs
  getSKUs: async (params?: any) => {
    const response = await api.get('/mdm/skus/', { params })
    return response.data
  },

  getSKU: async (id: string) => {
    const response = await api.get(`/mdm/skus/${id}/`)
    return response.data
  },

  createSKU: async (data: Partial<SKU>) => {
    const response = await api.post('/mdm/skus/', data)
    return response.data
  },

  // Companies
  getCompanies: async (params?: any) => {
    const response = await api.get('/mdm/companies/', { params })
    return response.data
  },

  // Locations
  getLocations: async (params?: any) => {
    const response = await api.get('/mdm/locations/', { params })
    return response.data
  },
}
