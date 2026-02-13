import api, { extractListData } from './api'

export interface Product {
  id: string
  code: string
  name: string
  description?: string
  company: string
  status: string
  created_at: string
  updated_at: string
}

export interface SKU {
  id: string
  code: string
  name: string
  company: string
  product: string
  product_code?: string
  style?: string | null
  style_code?: string | null
  base_price: string
  cost_price: string
  weight?: string | null
  size?: string | null
  is_serialized: boolean
  is_batch_tracked: boolean
  status: string
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  code: string
  name: string
  legal_name?: string
  tax_id?: string
  currency: string
  status: string
  created_at: string
  updated_at: string
}

export interface Location {
  id: string
  company: string
  code: string
  name: string
  location_type: 'warehouse' | 'store' | 'office' | 'virtual'
  business_unit: string
  business_unit_code?: string
  is_inventory_location: boolean
  status: string
  created_at: string
  updated_at: string
}

export interface BusinessUnit {
  id: string
  company: string
  code: string
  name: string
  status: string
  created_at: string
  updated_at: string
}

export interface SKUBarcode {
  id: string
  company: string
  sku: string
  sku_code?: string
  barcode_type: 'code128' | 'gs1_128' | 'ean13'
  barcode_value: string
  is_primary: boolean
  display_code: string
  label_title: string
  size_label: string
  selling_price?: string
  mrp?: string
  barcode_svg: string
  status: string
  created_at: string
  updated_at: string
}

export const mdmService = {
  // Products
  getProducts: async (params?: any) => {
    const response = await api.get('/mdm/products/', { params })
    return extractListData<Product>(response.data)
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
    return extractListData<SKU>(response.data)
  },

  getSKU: async (id: string) => {
    const response = await api.get(`/mdm/skus/${id}/`)
    return response.data
  },

  createSKU: async (data: Partial<SKU>) => {
    const response = await api.post('/mdm/skus/', data)
    return response.data
  },

  // SKU barcodes
  getSKUBarcodes: async (params?: { sku?: string }) => {
    const response = await api.get('/mdm/sku-barcodes/', { params })
    return extractListData<SKUBarcode>(response.data)
  },

  createSKUBarcode: async (data: Partial<SKUBarcode> & { sku: string }) => {
    const response = await api.post('/mdm/sku-barcodes/', data)
    return response.data as SKUBarcode
  },

  getSKUBarcodeLabel: async (id: string) => {
    const response = await api.get(`/mdm/sku-barcodes/${id}/label/`)
    return response.data as {
      barcode_id: string
      barcode_value: string
      barcode_type: string
      label_svg: string
    }
  },

  // Companies
  getCompanies: async (params?: any) => {
    const response = await api.get('/mdm/companies/', { params })
    return extractListData<Company>(response.data)
  },

  createCompany: async (data: Partial<Company> & { code: string; name: string }) => {
    const response = await api.post('/mdm/companies/', data)
    return response.data as Company
  },

  // Business Units
  getBusinessUnits: async (params?: any) => {
    const response = await api.get('/mdm/business-units/', { params })
    return extractListData<BusinessUnit>(response.data)
  },

  createBusinessUnit: async (data: Partial<BusinessUnit> & { code: string; name: string }) => {
    const response = await api.post('/mdm/business-units/', data)
    return response.data as BusinessUnit
  },

  // Locations
  getLocations: async (params?: any) => {
    const response = await api.get('/mdm/locations/', { params })
    return extractListData<Location>(response.data)
  },

  createLocation: async (data: Partial<Location> & { code: string; name: string; location_type: Location['location_type']; business_unit: string }) => {
    const response = await api.post('/mdm/locations/', data)
    return response.data as Location
  },
}
