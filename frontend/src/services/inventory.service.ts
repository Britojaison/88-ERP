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

  approveDesign: async (id: string, notes: string, expectedDays: number) => {
    const response = await api.post(`/inventory/design-approvals/${id}/approve/`, {
      notes,
      expected_days: expectedDays,
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
