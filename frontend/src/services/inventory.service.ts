import api, { extractListData } from './api'
import { PaginatedResponse } from './mdm.service'

export interface InventoryBalance {
  id: string
  company: string
  sku: string
  sku_code?: string
  location: string
  location_code?: string
  quantity_on_hand: string
  quantity_reserved: string
  quantity_available: string
  condition: 'new' | 'used' | 'damaged'
  average_cost: string
  status: string
  updated_at: string
}

export interface InventoryMovement {
  id: string
  movement_type: 'receipt' | 'issue' | 'transfer' | 'adjustment' | 'return'
  movement_date: string
  sku: string
  sku_code?: string
  from_location?: string
  from_location_code?: string
  to_location?: string
  to_location_code?: string
  quantity: string
  unit_cost: string
  total_cost: string
  document?: string
  reference_number?: string
  notes?: string
  created_at: string
}

export interface GoodsReceiptScanLog {
  id: string
  barcode_value: string
  sku?: string
  sku_code?: string
  barcode?: string
  location: string
  location_code?: string
  document?: string
  quantity: string
  batch_number?: string
  serial_number?: string
  result: 'matched' | 'mismatch' | 'over_receipt' | 'unknown'
  message: string
  scanned_at: string
}

export const inventoryService = {
  getBalances: async (params?: any) => {
    const response = await api.get('/inventory/balances/', { params })
    return response.data as PaginatedResponse<InventoryBalance> | InventoryBalance[]
  },

  getBalance: async (id: string) => {
    const response = await api.get(`/inventory/balances/${id}/`)
    return response.data
  },

  getMovements: async (params?: any) => {
    const response = await api.get('/inventory/movements/', { params })
    return response.data as PaginatedResponse<InventoryMovement> | InventoryMovement[]
  },

  createMovement: async (data: Partial<InventoryMovement>) => {
    const response = await api.post('/inventory/movements/', data)
    return response.data
  },

  getStockVelocity: async () => {
    const response = await api.get('/inventory/balances/velocity/')
    return response.data
  },

  getStockAlerts: async () => {
    const response = await api.get('/inventory/movements/alerts/')
    return extractListData(response.data)
  },

  getGoodsReceiptScans: async (params?: any) => {
    const response = await api.get('/inventory/goods-receipt-scans/', { params })
    return response.data as PaginatedResponse<GoodsReceiptScanLog> | GoodsReceiptScanLog[]
  },

  scanGoodsReceipt: async (data: {
    barcode_value: string
    location_id: string
    document_id?: string
    quantity?: number
    strict?: boolean
  }) => {
    const response = await api.post('/inventory/goods-receipt-scans/scan/', data)
    return response.data as GoodsReceiptScanLog
  },
}

export interface DesignApprovalItem {
  id: string
  code: string
  name: string
  product_name: string
  lifecycle_status: string
  created_at?: string
}

export interface DesignApprovalResponse {
  results: DesignApprovalItem[]
  count: number
  page: number
  limit: number
}

export const designApprovalService = {
  getPendingApprovals: async (page = 1, limit = 50) => {
    const response = await api.get('/inventory/design-approvals/pending_approvals/', {
      params: { page, limit }
    })
    return response.data as DesignApprovalResponse
  },

  approveDesign: async (id: string, notes: string, expectedDays: number, attachment?: File) => {
    const formData = new FormData()
    formData.append('notes', notes)
    formData.append('expected_days', expectedDays.toString())
    if (attachment) formData.append('attachment', attachment)

    const response = await api.post(`/inventory/design-approvals/${id}/approve/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  rejectDesign: async (id: string, notes: string) => {
    const response = await api.post(`/inventory/design-approvals/${id}/reject/`, {
      notes,
    })
    return response.data
  },
}

export interface ProductionKanbanItem {
  id: string
  code: string
  name: string
  latest_stage: string
  measurement_value?: string
  measurement_unit?: string
  attachment_url?: string
}

export const productionKanbanService = {
  getBoard: async () => {
    const response = await api.get('/inventory/production-kanban/board/')
    return response.data as Record<string, ProductionKanbanItem[]>
  },

  getLocations: async () => {
    const response = await api.get('/inventory/production-kanban/locations/')
    return response.data as { id: string, code: string, name: string, location_type: string }[]
  },

  moveItem: async (id: string, stage: string, notes?: string, measurementValue?: string, attachment?: File, locationId?: string) => {
    const formData = new FormData()
    formData.append('stage', stage)
    if (notes) formData.append('notes', notes)
    if (measurementValue) formData.append('measurement_value', measurementValue)
    if (attachment) formData.append('attachment', attachment)
    if (locationId) formData.append('location_id', locationId)

    const response = await api.post(`/inventory/production-kanban/${id}/move/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  }
}

export interface JourneySearchResult {
  sku: string
  sku_code: string
  product_name: string
  sku_name: string
  barcode: string
  lifecycle_status: string
  current_stage: string
  current_status: string
  current_location: string
  checkpoints: any[]
}

export const productJourneyService = {
  searchJourney: async (query: string) => {
    const response = await api.get('/inventory/product-journey/search/', { params: { q: query } })
    return response.data as JourneySearchResult
  },

  addCheckpoint: async (skuId: string, payload: { stage: string, status?: string, notes?: string, location_id?: string, attachment?: File }) => {
    const formData = new FormData()
    formData.append('stage', payload.stage)
    if (payload.status) formData.append('status', payload.status)
    if (payload.notes) formData.append('notes', payload.notes)
    if (payload.location_id) formData.append('location_id', payload.location_id)
    if (payload.attachment) formData.append('attachment', payload.attachment)

    const response = await api.post(`/inventory/product-journey/${skuId}/add_checkpoint/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  getPhotos: async (skuId: string) => {
    const response = await api.get(`/inventory/product-journey/${skuId}/photos/`)
    return response.data as {
      sku_code: string,
      sku_name: string,
      total_photos: number,
      photos: {
        id: string,
        stage: string,
        user_name: string,
        timestamp: string,
        notes: string,
        location_name: string,
        attachment_url: string,
        measurement_value: string,
        measurement_unit: string,
      }[]
    }
  }
}
