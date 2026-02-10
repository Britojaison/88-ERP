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
  last_product_sync?: string
  last_inventory_sync?: string
  last_order_sync?: string
  is_connected: boolean
  last_connection_test?: string
  connection_error?: string
  status: string
  created_at: string
  updated_at: string
}

export interface ShopifyProduct {
  id: string
  shopify_product_id: number
  shopify_variant_id?: number
  shopify_title: string
  shopify_sku: string
  shopify_barcode: string
  shopify_price: number
  shopify_inventory_quantity: number
  erp_product?: string
  erp_product_code?: string
  erp_sku?: string
  erp_sku_code?: string
  sync_status: 'pending' | 'synced' | 'error'
  last_synced_at?: string
  sync_error?: string
  created_at: string
}

export interface ShopifySyncJob {
  id: string
  store: string
  store_name: string
  job_type: 'products' | 'inventory' | 'orders' | 'full_sync'
  status: 'running' | 'completed' | 'failed'
  started_at: string
  completed_at?: string
  duration_seconds?: number
  total_items: number
  processed_items: number
  created_items: number
  updated_items: number
  failed_items: number
  error_log?: string
}

export interface ShopifySyncStatus {
  store: ShopifyStore
  products: {
    total: number
    synced: number
    pending: number
  }
  recent_jobs: ShopifySyncJob[]
}

export const shopifyService = {
  // Stores
  listStores: async (): Promise<ShopifyStore[]> => {
    const response = await api.get('/integrations/shopify/stores/')
    return response.data
  },

  getStore: async (id: string): Promise<ShopifyStore> => {
    const response = await api.get(`/integrations/shopify/stores/${id}/`)
    return response.data
  },

  createStore: async (data: {
    name: string
    shop_domain: string
    access_token: string
    api_key?: string
    api_secret?: string
    api_version?: string
    webhook_secret?: string
    auto_sync_products?: boolean
    auto_sync_inventory?: boolean
    auto_sync_orders?: boolean
    sync_interval_minutes?: number
  }): Promise<ShopifyStore> => {
    const response = await api.post('/integrations/shopify/stores/', data)
    return response.data
  },

  updateStore: async (id: string, data: Partial<ShopifyStore>): Promise<ShopifyStore> => {
    const response = await api.patch(`/integrations/shopify/stores/${id}/`, data)
    return response.data
  },

  deleteStore: async (id: string): Promise<void> => {
    await api.delete(`/integrations/shopify/stores/${id}/`)
  },

  testConnection: async (id: string): Promise<{
    connected: boolean
    message: string
    error?: string
  }> => {
    const response = await api.post(`/integrations/shopify/stores/${id}/test_connection/`)
    return response.data
  },

  syncProducts: async (id: string): Promise<{
    job_id: string
    status: string
    message: string
  }> => {
    const response = await api.post(`/integrations/shopify/stores/${id}/sync_products/`)
    return response.data
  },

  syncInventory: async (id: string): Promise<{
    job_id: string
    status: string
    message: string
  }> => {
    const response = await api.post(`/integrations/shopify/stores/${id}/sync_inventory/`)
    return response.data
  },

  setupWebhooks: async (id: string): Promise<{
    success: boolean
    webhooks_created: number
    message: string
    error?: string
  }> => {
    const response = await api.post(`/integrations/shopify/stores/${id}/setup_webhooks/`)
    return response.data
  },

  getSyncStatus: async (id: string): Promise<ShopifySyncStatus> => {
    const response = await api.get(`/integrations/shopify/stores/${id}/sync_status/`)
    return response.data
  },

  // Products
  listProducts: async (params?: {
    store?: string
    sync_status?: string
  }): Promise<ShopifyProduct[]> => {
    const response = await api.get('/integrations/shopify/products/', { params })
    return response.data
  },

  getProduct: async (id: string): Promise<ShopifyProduct> => {
    const response = await api.get(`/integrations/shopify/products/${id}/`)
    return response.data
  },

  mapProductToSKU: async (productId: string, skuId: string): Promise<{
    success: boolean
    message: string
  }> => {
    const response = await api.post(`/integrations/shopify/products/${productId}/map_to_sku/`, {
      sku_id: skuId
    })
    return response.data
  },

  // Sync Jobs
  listSyncJobs: async (storeId?: string): Promise<ShopifySyncJob[]> => {
    const params = storeId ? { store: storeId } : {}
    const response = await api.get('/integrations/shopify/sync-jobs/', { params })
    return response.data
  },

  getSyncJob: async (id: string): Promise<ShopifySyncJob> => {
    const response = await api.get(`/integrations/shopify/sync-jobs/${id}/`)
    return response.data
  },
}
