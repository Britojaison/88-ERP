import api from './api'
import { PaginatedResponse } from './mdm.service'

export interface InventoryBalance {
  id: string
  company: string
  sku: string
  sku_code?: string
  sku_name?: string
  product_name?: string
  location: string
  location_code?: string
  quantity_on_hand: string
  quantity_reserved: string
  quantity_available: string
  condition: 'new' | 'used' | 'damaged'
  is_offer_eligible: boolean
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

  getBalanceSummary: async (locationId: string) => {
    const response = await api.get('/inventory/balances/summary/', { params: { location: locationId } })
    return response.data as { total_skus: number; total_units: number; zero_stock: number }
  },

  getBalance: async (id: string) => {
    const response = await api.get(`/inventory/balances/${id}/`)
    return response.data
  },

  updateBalance: async (id: string, data: Partial<InventoryBalance>) => {
    const response = await api.patch(`/inventory/balances/${id}/`, data)
    return response.data as InventoryBalance
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
    return response.data
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
  fabric_photo_url?: string
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

  approveDesign: async (id: string, notes: string, expectedDays: number, attachment?: File, productionQuantity?: number, destinationId?: string, unitCost?: number) => {
    const formData = new FormData()
    formData.append('notes', notes)
    formData.append('expected_days', expectedDays.toString())
    if (attachment) formData.append('attachment', attachment)
    if (productionQuantity && productionQuantity > 0) formData.append('production_quantity', productionQuantity.toString())
    if (destinationId) formData.append('destination_id', destinationId)
    if (unitCost && unitCost > 0) formData.append('unit_cost', unitCost.toString())

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

// ─────────────────────────────────────────────────────────
// Production Orders
// ─────────────────────────────────────────────────────────

export interface ProductionOrderLine {
  id: string
  production_order: string
  sku: string
  sku_code: string
  sku_name: string
  product_name: string
  planned_quantity: number
  received_quantity: number
  rejected_quantity: number
  unit_cost: string
  line_status: string
  notes: string
  shortfall: number
  fulfillment_pct: number
  total_cost: string
  created_at: string
}

export interface ProductionOrder {
  id: string
  order_number: string
  order_type: 'new_production' | 'restock' | 'urgent_restock'
  po_status: 'draft' | 'confirmed' | 'in_production' | 'partially_received' | 'completed' | 'short_closed' | 'cancelled'
  factory: string | null
  factory_name: string | null
  destination: string
  destination_name: string
  order_date: string
  expected_delivery: string | null
  actual_delivery: string | null
  triggered_by: string
  notes: string
  total_planned: number
  total_received: number
  total_rejected: number
  total_shortfall: number
  fulfillment_pct: number
  is_overdue: boolean
  lines: ProductionOrderLine[]
  created_at: string
  updated_at: string
}

export interface ProductionOrderDashboard {
  active_orders: number
  units_in_production: number
  awaiting_receipt: number
  overdue: number
  recent_completed: ProductionOrder[]
}

export interface CreateProductionOrderPayload {
  order_type: string
  factory?: string | null
  destination: string
  order_date: string
  expected_delivery?: string | null
  triggered_by?: string
  notes?: string
  lines: {
    sku: string
    planned_quantity: number
    unit_cost?: number
    notes?: string
  }[]
}

export interface ReceivePayload {
  receipts: {
    sku_id: string
    quantity: number
    rejected?: number
  }[]
}

export const productionOrderService = {
  getOrders: async (params?: any) => {
    const response = await api.get('/inventory/production-orders/', { params })
    return response.data
  },

  getOrder: async (id: string) => {
    const response = await api.get(`/inventory/production-orders/${id}/`)
    return response.data as ProductionOrder
  },

  createOrder: async (data: CreateProductionOrderPayload) => {
    const response = await api.post('/inventory/production-orders/', data)
    return response.data as ProductionOrder
  },

  confirmOrder: async (id: string) => {
    const response = await api.post(`/inventory/production-orders/${id}/confirm/`)
    return response.data as ProductionOrder
  },

  startProduction: async (id: string) => {
    const response = await api.post(`/inventory/production-orders/${id}/start/`)
    return response.data as ProductionOrder
  },

  receiveGoods: async (id: string, data: ReceivePayload) => {
    const response = await api.post(`/inventory/production-orders/${id}/receive/`, data)
    return response.data
  },

  shortClose: async (id: string) => {
    const response = await api.post(`/inventory/production-orders/${id}/short_close/`)
    return response.data as ProductionOrder
  },

  cancelOrder: async (id: string) => {
    const response = await api.post(`/inventory/production-orders/${id}/cancel/`)
    return response.data as ProductionOrder
  },

  getDashboard: async () => {
    const response = await api.get('/inventory/production-orders/dashboard/')
    return response.data as ProductionOrderDashboard
  },

  getRestockSuggestions: async () => {
    const response = await api.get('/inventory/production-orders/restock_suggestions/')
    return response.data as RestockSuggestionsResponse
  },
}

export interface RestockSuggestion {
  sku_id: string
  sku_code: string
  sku_name: string
  product_name: string
  location_id: string | null
  location_name: string
  current_stock: number
  min_stock_level: number
  suggested_quantity: number
  is_best_seller: boolean
  source: 'warehouse' | 'shopify'
  already_in_production: boolean
  urgency: 'critical' | 'standard'
}

export interface RestockSuggestionsResponse {
  suggestions: RestockSuggestion[]
  summary: {
    total: number
    critical: number
    already_in_production: number
  }
}
