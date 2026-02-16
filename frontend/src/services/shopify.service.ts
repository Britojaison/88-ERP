import api, { extractListData } from './api'

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ProductDemandItem {
  title: string
  variant_title: string
  sku: string
  total_quantity_sold: number
  total_revenue: number
  order_count: number
  current_stock: number | null
}

export interface ProductDemandResponse {
  total_products: number
  total_units_sold: number
  total_revenue: number
  total_orders: number
  items: ProductDemandItem[]
}

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
  shopify_product_type?: string
  shopify_vendor?: string
  shopify_tags?: string
  shopify_image_url?: string
  erp_product?: string
  erp_product_code?: string
  erp_sku?: string
  erp_sku_code?: string
  sync_status: 'pending' | 'synced' | 'error'
  last_synced_at?: string
  sync_error?: string
  created_at: string
}

export interface OrderLineItem {
  id?: number
  title: string
  variant_title: string
  sku: string
  quantity: number
  price: string
  total_discount: string
  fulfillment_status?: string
  product_id?: number
  variant_id?: number
  requires_shipping: boolean
  taxable: boolean
}

export interface ShopifyOrder {
  id: string
  shopify_order_id: number
  order_number: string
  erp_document_number?: string
  order_status: string
  financial_status: string
  fulfillment_status?: string
  total_price: number
  currency: string
  customer_name: string
  customer_email: string
  processed_at?: string
  line_items: OrderLineItem[]
  items_count: number
  shipping_address?: {
    city: string
    province: string
    country: string
    zip: string
  }
}

export interface ShopifyDraftOrder {
  id: string
  shopify_draft_order_id: number
  erp_document_number?: string
  status: string
  total_price: number
  customer_name?: string
  line_items: {
    title: string
    variant_title: string
    sku: string
    quantity: number
    price: string
  }[]
}

export interface ShopifyDiscount {
  id: string
  shopify_id: number
  code: string
  type: string
  value: number
  value_type: string
  starts_at?: string
  ends_at?: string
  is_active: boolean
}

export interface ShopifySyncJob {
  id: string
  store: string
  store_name: string
  job_type: 'products' | 'inventory' | 'orders' | 'draft_orders' | 'discounts' | 'gift_cards' | 'full_sync'
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
    return extractListData<ShopifyStore>(response.data)
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

  // Quick-connect using .env credentials
  quickConnect: async (): Promise<{
    store: ShopifyStore
    message: string
    connected: boolean
  }> => {
    const response = await api.post('/integrations/shopify/stores/quick_connect/')
    return response.data
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

  syncOrders: async (id: string): Promise<{
    job_id: string
    status: string
    message: string
  }> => {
    const response = await api.post(`/integrations/shopify/stores/${id}/sync_orders/`)
    return response.data
  },

  syncDraftOrders: async (id: string): Promise<{
    job_id: string
    status: string
    message: string
  }> => {
    const response = await api.post(`/integrations/shopify/stores/${id}/sync_draft_orders/`)
    return response.data
  },

  syncDiscounts: async (id: string): Promise<{
    job_id: string
    status: string
    message: string
  }> => {
    const response = await api.post(`/integrations/shopify/stores/${id}/sync_discounts/`)
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

  getShopInfo: async (id: string): Promise<any> => {
    const response = await api.get(`/integrations/shopify/stores/${id}/shop_info/`)
    return response.data
  },

  getLocations: async (id: string): Promise<{ locations: any[] }> => {
    const response = await api.get(`/integrations/shopify/stores/${id}/locations/`)
    return response.data
  },

  pushProduct: async (storeId: string, skuId: string): Promise<{
    action: string
    shopify_product_id: number
    message: string
  }> => {
    const response = await api.post(`/integrations/shopify/stores/${storeId}/push_product/`, {
      sku_id: skuId,
    })
    return response.data
  },

  pushInventory: async (storeId: string, skuId: string, quantity: number, locationId?: number): Promise<{
    success: boolean
    message: string
  }> => {
    const response = await api.post(`/integrations/shopify/stores/${storeId}/push_inventory/`, {
      sku_id: skuId,
      quantity,
      location_id: locationId,
    })
    return response.data
  },

  // Products
  listProducts: async (params?: {
    store?: string
    sync_status?: string
    page?: number
    page_size?: number
    search?: string
  }): Promise<PaginatedResponse<ShopifyProduct>> => {
    const response = await api.get('/integrations/shopify/products/', { params })
    // Handle both paginated and non-paginated responses
    if (response.data && response.data.results) {
      return response.data
    }
    // Fallback for non-paginated
    const list = extractListData<ShopifyProduct>(response.data)
    return { count: list.length, next: null, previous: null, results: list }
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

  listOrders: async (storeId?: string, page?: number): Promise<PaginatedResponse<ShopifyOrder>> => {
    const params: any = {}
    if (storeId) params.store = storeId
    if (page) params.page = page
    const response = await api.get('/integrations/shopify/orders/', { params })
    if (response.data && response.data.results) {
      return response.data
    }
    const list = extractListData<ShopifyOrder>(response.data)
    return { count: list.length, next: null, previous: null, results: list }
  },

  // Product Demand (aggregated from orders)
  getProductDemand: async (storeId: string): Promise<ProductDemandResponse> => {
    const response = await api.get(`/integrations/shopify/stores/${storeId}/product_demand/`)
    return response.data
  },

  // Draft Orders
  listDraftOrders: async (storeId?: string): Promise<ShopifyDraftOrder[]> => {
    const params = storeId ? { store: storeId } : {}
    const response = await api.get('/integrations/shopify/draft-orders/', { params })
    return extractListData<ShopifyDraftOrder>(response.data)
  },

  // Discounts
  listDiscounts: async (storeId?: string): Promise<ShopifyDiscount[]> => {
    const params = storeId ? { store: storeId } : {}
    const response = await api.get('/integrations/shopify/discounts/', { params })
    return extractListData<ShopifyDiscount>(response.data)
  },

  // Sync Jobs
  listSyncJobs: async (storeId?: string): Promise<ShopifySyncJob[]> => {
    const params = storeId ? { store: storeId } : {}
    const response = await api.get('/integrations/shopify/sync-jobs/', { params })
    return extractListData<ShopifySyncJob>(response.data)
  },

  getSyncJob: async (id: string): Promise<ShopifySyncJob> => {
    const response = await api.get(`/integrations/shopify/sync-jobs/${id}/`)
    return response.data
  },
}
