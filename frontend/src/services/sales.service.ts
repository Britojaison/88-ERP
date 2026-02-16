import api, { extractListData } from './api'

export interface SalesTransaction {
  id: string
  company: string
  transaction_number: string
  transaction_date: string
  sales_channel: 'store' | 'online' | 'mobile' | 'marketplace'
  store?: string
  store_code?: string
  store_name?: string
  register_number?: string
  customer?: string
  customer_type: 'walk-in' | 'member' | 'vip'
  cashier?: string
  cashier_name?: string
  sales_associate?: string
  subtotal: string
  tax_amount: string
  discount_amount: string
  total_amount: string
  payment_method: 'cash' | 'card' | 'upi' | 'wallet' | 'mixed'
  item_count: number
  processing_time_seconds: number
  campaign_code?: string
  referral_source?: string
  status: string
  lines?: SalesTransactionLine[]
  created_at: string
  updated_at: string
}

export interface SalesTransactionLine {
  id: string
  transaction: string
  line_number: number
  sku: string
  sku_code?: string
  sku_name?: string
  quantity: string
  unit_price: string
  discount_percent: string
  discount_amount: string
  line_total: string
  unit_cost: string
  is_returned: boolean
  return_reason?: string
  created_at: string
}

export interface ReturnTransaction {
  id: string
  company: string
  return_number: string
  return_date: string
  original_transaction?: string
  store: string
  store_code?: string
  return_reason: string
  return_type: 'refund' | 'exchange' | 'store_credit'
  refund_amount: string
  processed_by: string
  processed_by_name?: string
  notes?: string
  status: string
  created_at: string
}

export interface StoreFootTraffic {
  id: string
  company: string
  store: string
  store_code?: string
  date: string
  hour: number
  visitor_count: number
  entry_count: number
  exit_count: number
  transaction_count: number
  conversion_rate: string
  status: string
  created_at: string
}

export interface StaffShift {
  id: string
  company: string
  store: string
  store_code?: string
  employee: string
  employee_name?: string
  shift_date: string
  clock_in: string
  clock_out?: string
  hours_worked: string
  hourly_rate: string
  labor_cost: string
  status: string
  created_at: string
}

export interface SalesSummary {
  total_sales: number
  total_transactions: number
  avg_transaction_value: number
  total_items: number
}

export interface SalesByChannel {
  sales_channel: string
  total_sales: number
  transaction_count: number
  avg_value: number
}

export interface SalesByStore {
  store__code: string
  store__name: string
  total_sales: number
  transaction_count: number
  avg_value: number
}

export const salesService = {
  // Sales Transactions
  getTransactions: async (params?: any) => {
    const response = await api.get('/sales/transactions/', { params })
    return extractListData<SalesTransaction>(response.data)
  },

  getTransaction: async (id: string) => {
    const response = await api.get(`/sales/transactions/${id}/`)
    return response.data as SalesTransaction
  },

  createTransaction: async (data: Partial<SalesTransaction>) => {
    const response = await api.post('/sales/transactions/', data)
    return response.data as SalesTransaction
  },

  getSalesSummary: async (params?: any) => {
    const response = await api.get('/sales/transactions/summary/', { params })
    return response.data as SalesSummary
  },

  getSalesByChannel: async (params?: any) => {
    const response = await api.get('/sales/transactions/by-channel/', { params })
    return response.data as SalesByChannel[]
  },

  getSalesByStore: async (params?: any) => {
    const response = await api.get('/sales/transactions/by-store/', { params })
    return response.data as SalesByStore[]
  },

  getDailySales: async (params?: any) => {
    const response = await api.get('/sales/transactions/daily/', { params })
    return response.data
  },

  // Returns
  getReturns: async (params?: any) => {
    const response = await api.get('/sales/returns/', { params })
    return extractListData<ReturnTransaction>(response.data)
  },

  createReturn: async (data: Partial<ReturnTransaction>) => {
    const response = await api.post('/sales/returns/', data)
    return response.data as ReturnTransaction
  },

  // Foot Traffic
  getFootTraffic: async (params?: any) => {
    const response = await api.get('/sales/foot-traffic/', { params })
    return extractListData<StoreFootTraffic>(response.data)
  },

  // Staff Shifts
  getStaffShifts: async (params?: any) => {
    const response = await api.get('/sales/staff-shifts/', { params })
    return extractListData<StaffShift>(response.data)
  },
}
