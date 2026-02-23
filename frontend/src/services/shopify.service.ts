import api from './api'

export interface ShopifyStore {
  id: string
  name: string
  shop_domain: string
  api_version: string
  auto_sync_products: boolean
  auto_sync_inventory: boolean
  auto_sync_orders: boolean
  sync_interval_minutes: number
  last_product_sync: string | null
  last_inventory_sync: string | null
  last_order_sync: string | null
  is_connected: boolean
  last_connection_test: string | null
  connection_error: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface ShopifyProduct {
  id: string
  shopify_product_id: string
  shopify_variant_id: string
  shopify_title: string
  shopify_sku: string
  shopify_barcode: string
  shopify_price: string
  shopify_inventory_quantity: number
  shopify_product_type: string
  shopify_vendor: string
  shopify_tags: string
  shopify_image_url: string
  erp_product: string | null
  erp_product_code: string | null
  erp_sku: string | null
  erp_sku_code: string | null
  sync_status: string
  last_synced_at: string | null
  sync_error: string
  created_at: string
}

export interface ShopifySyncJob {
  id: string
  store: string
  store_name: string
  job_type: string
  status: string
  started_at: string
  completed_at: string | null
  duration_seconds: number | null
  total_items: number
  processed_items: number
  created_items: number
  updated_items: number
  failed_items: number
  error_log: string
}

export interface ShopifyDraftOrder {
  id: string
  shopify_draft_order_id: string
  store: string
  erp_document_number: string | null
  status: string
  total_price: string
  line_items: any[]
  customer_name: string
}

export interface ShopifyDiscount {
  id: string
  store: string
  shopify_id: string
  code: string
  type: string
  value: string
  value_type: string
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
}

export interface ProductDemandResponse {
  total_products: number
  total_units_sold: number
  total_revenue: number
  total_orders: number
  period: string
  items: Array<{
    title: string
    variant_title: string
    sku: string
    total_quantity_sold: number
    total_revenue: number
    order_count: number
    current_stock: number | null
  }>
}

export interface ShopifySalesSummary {
  summary: {
    total_sales: number
    total_transactions: number
    avg_transaction_value: number
    total_items: number
  }
  by_channel: Array<{
    sales_channel: string
    total_sales: number
    transaction_count: number
    avg_value: number
  }>
  by_store: Array<{
    store__name: string
    store__code: string
    total_sales: number
    transaction_count: number
    avg_value: number
  }>
  daily_sales: Array<{
    date: string
    total_sales: number
    transaction_count: number
  }>
}

export const shopifyService = {
  getSalesSummary: async (): Promise<ShopifySalesSummary> => {
    const response = await api.get('/integrations/shopify/orders/sales_summary/')
    return response.data
  },

  getOrders: async (params?: any) => {
    const response = await api.get('/integrations/shopify/orders/', { params })
    return response.data
  },

  getStores: async () => {
    const response = await api.get('/integrations/shopify/stores/')
    return response.data
  },

  listStores: async () => {
    const response = await api.get('/integrations/shopify/stores/')
    // Handle both paginated and non-paginated responses
    if (Array.isArray(response.data)) {
      return response.data
    }
    if (response.data.results) {
      return response.data.results
    }
    return []
  },

  createStore: async (storeData: any) => {
    const response = await api.post('/integrations/shopify/stores/', storeData)
    return response.data
  },

  deleteStore: async (storeId: string) => {
    const response = await api.delete(`/integrations/shopify/stores/${storeId}/`)
    return response.data
  },

  testConnection: async (storeId: string) => {
    const response = await api.post(`/integrations/shopify/stores/${storeId}/test_connection/`)
    return response.data
  },

  quickConnect: async () => {
    const response = await api.post('/integrations/shopify/stores/quick_connect/')
    return response.data
  },

  syncProducts: async (storeId: string) => {
    const response = await api.post(`/integrations/shopify/stores/${storeId}/sync_products/`)
    return response.data
  },

  syncInventory: async (storeId: string) => {
    const response = await api.post(`/integrations/shopify/stores/${storeId}/sync_inventory/`)
    return response.data
  },

  syncOrders: async (storeId: string) => {
    const response = await api.post(`/integrations/shopify/stores/${storeId}/sync_orders/`)
    return response.data
  },

  syncDraftOrders: async (storeId: string) => {
    const response = await api.post(`/integrations/shopify/stores/${storeId}/sync_draft_orders/`)
    return response.data
  },

  syncDiscounts: async (storeId: string) => {
    const response = await api.post(`/integrations/shopify/stores/${storeId}/sync_discounts/`)
    return response.data
  },

  getProducts: async (params?: any) => {
    const response = await api.get('/integrations/shopify/products/', { params })
    return response.data
  },

  listSyncJobs: async (params?: any) => {
    const response = await api.get('/integrations/shopify/sync-jobs/', { params })
    return response.data
  },

  getProductDemand: async (storeId: string, params?: { days?: number; date_from?: string; date_to?: string }) => {
    const response = await api.get(`/integrations/shopify/stores/${storeId}/product_demand/`, { params })
    return response.data
  },

  listDraftOrders: async (params?: any) => {
    const response = await api.get('/integrations/shopify/draft-orders/', { params })
    return response.data
  },

  listDiscounts: async (params?: any) => {
    const response = await api.get('/integrations/shopify/discounts/', { params })
    return response.data
  },

  getSyncStatus: async (storeId: string) => {
    const response = await api.get(`/integrations/shopify/stores/${storeId}/sync_status/`)
    return response.data
  },

  listProducts: async (params?: any) => {
    const response = await api.get('/integrations/shopify/products/', { params })
    return response.data
  },

  setupWebhooks: async (storeId: string) => {
    const response = await api.post(`/integrations/shopify/stores/${storeId}/setup_webhooks/`)
    return response.data
  },

  updateStore: async (storeId: string, data: any) => {
    const response = await api.patch(`/integrations/shopify/stores/${storeId}/`, data)
    return response.data
  },

  getProductPerformance: async () => {
    const response = await api.get('/integrations/shopify/analytics/product-performance/')
    return response.data
  },

  getCustomerAnalysis: async () => {
    const response = await api.get('/integrations/shopify/analytics/customer-analysis/')
    return response.data
  },

  getTrafficSource: async () => {
    const response = await api.get('/integrations/shopify/analytics/traffic-source/')
    return response.data
  },

  getInventorySummary: async () => {
    const response = await api.get('/integrations/shopify/analytics/inventory-summary/')
    return response.data
  },

  getReturnsAnalysis: async () => {
    const response = await api.get('/integrations/shopify/analytics/returns-analysis/')
    return response.data
  },

  getTopProducts: async (limit: number = 10) => {
    const response = await api.get('/integrations/shopify/orders/top_products/', { params: { limit } })
    return response.data
  },

  getGeographicSales: async () => {
    const response = await api.get('/integrations/shopify/orders/geographic_sales/')
    return response.data
  },
}
