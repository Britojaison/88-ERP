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
  product_name?: string
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
  email?: string
  opening_date?: string
  offer_tag: 'none' | 'b1g1' | 'b2g1' | 'b3g1'
  offer_mode: 'all' | 'selected'
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
  product_name?: string
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

export interface Fabric {
  id: string
  company: string
  code: string
  name: string
  color: string
  fabric_type: string
  total_meters: string
  used_meters: string
  remaining_meters: number
  cost_per_meter: string
  photo: string | null
  photo_url: string | null
  approval_status: 'pending' | 'approved' | 'rejected'
  approved_by: string | null
  approved_by_name: string | null
  approval_date: string | null
  rejection_reason: string
  dispatch_unit: string
  vendor: string | null
  vendor_name: string | null
  notes: string
  sku: string | null
  sku_code: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
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

  getNextSkuCode: async (productName: string, size?: string) => {
    const params: any = { product_name: productName }
    if (size) params.size = size
    const response = await api.get('/mdm/products/next-sku-code/', { params })
    return response.data as { sku_code: string }
  },

  createProductVariants: async (productId: string, data: { sizes: string[], selling_price: string, mrp: string, offer_tag?: string }) => {
    const response = await api.post(`/mdm/products/${productId}/create-variants/`, data)
    return response.data as {
      created: number
      skipped: number
      skipped_sizes: string[]
      skus: SKU[]
    }
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
  getSKUBarcodes: async (params?: { sku?: string; page?: number }) => {
    const response = await api.get('/mdm/sku-barcodes/', { params })
    return response.data as PaginatedResponse<SKUBarcode> | SKUBarcode[]
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

  updateLocation: async (id: string, data: Partial<Location>) => {
    const response = await api.patch(`/mdm/locations/${id}/`, data)
    return response.data as Location
  },

  // Fabrics
  getFabrics: async (params?: any) => {
    const response = await api.get('/mdm/fabrics/', { params })
    return extractListData<Fabric>(response.data)
  },

  createFabric: async (data: Partial<Fabric>, photoFile?: File) => {
    const formData = new FormData()
    if (data.name) formData.append('name', data.name)
    if (data.color) formData.append('color', data.color)
    if (data.fabric_type) formData.append('fabric_type', data.fabric_type)
    if (data.total_meters) formData.append('total_meters', data.total_meters)
    if (data.cost_per_meter) formData.append('cost_per_meter', data.cost_per_meter)
    if (data.dispatch_unit) formData.append('dispatch_unit', data.dispatch_unit)
    if (data.notes) formData.append('notes', data.notes)
    if (photoFile) formData.append('photo', photoFile)
    const response = await api.post('/mdm/fabrics/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data as Fabric
  },

  updateFabric: async (id: string, data: Partial<Fabric>) => {
    const response = await api.patch(`/mdm/fabrics/${id}/`, data)
    return response.data as Fabric
  },

  approveFabric: async (id: string) => {
    const response = await api.post(`/mdm/fabrics/${id}/approve/`)
    return response.data as Fabric
  },

  rejectFabric: async (id: string, reason: string) => {
    const response = await api.post(`/mdm/fabrics/${id}/reject/`, { reason })
    return response.data as Fabric
  },
}
