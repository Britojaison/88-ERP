import { shopifyService } from '../../services/shopify.service'
import { AttachMoney, ShoppingCart, TrendingUp, Inventory as InventoryIcon, People, LocalShipping } from '@mui/icons-material'

// Helper function to get currency symbol from orders
const getCurrencySymbol = async (): Promise<string> => {
  try {
    const ordersResponse = await shopifyService.getOrders({ limit: 1 })
    const orders = Array.isArray(ordersResponse) ? ordersResponse : ordersResponse.results || []
    if (orders.length > 0 && orders[0].currency) {
      const currencySymbols: { [key: string]: string } = {
        'INR': '₹',
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'JPY': '¥',
        'AUD': 'A$',
        'CAD': 'C$',
        'CNY': '¥',
        'AED': 'د.إ',
      }
      return currencySymbols[orders[0].currency] || orders[0].currency + ' '
    }
  } catch (e) {
    console.log('Could not fetch currency, using default')
  }
  return '₹'
}

export const loadShopifySalesByChannel = async () => {
  // REMOVED: This report is redundant when there's only one channel (online)
  // Use loadShopifySalesTrend or loadShopifyOrderStatus instead
  return null
}

export const loadShopifySalesByStore = async () => {
  try {
    const data = await shopifyService.getSalesSummary()
    
    if (!data || !data.by_store || data.by_store.length === 0) {
      return null
    }

    const currency = await getCurrencySymbol()
    const totalRevenue = data.by_store.reduce((sum: number, s: any) => sum + s.total_sales, 0)

    return {
      type: 'summary',
      metrics: [
        { label: 'Total Stores', value: data.by_store.length, icon: <InventoryIcon /> },
        { label: 'Total Revenue', value: `${currency}${totalRevenue.toFixed(2)}`, icon: <AttachMoney /> },
        { label: 'Total Orders', value: data.summary.total_transactions, icon: <ShoppingCart /> },
        { label: 'Avg per Store', value: `${currency}${(totalRevenue / data.by_store.length).toFixed(2)}`, icon: <TrendingUp /> },
      ],
      tables: [
        {
          title: 'Store Performance',
          columns: ['Store', 'Domain', 'Orders', 'Revenue', 'Avg Order Value'],
          rows: data.by_store.map((store: any) => [
            store.store__name,
            store.store__shop_domain,
            store.transaction_count,
            `${currency}${store.total_sales.toFixed(2)}`,
            `${currency}${store.avg_value.toFixed(2)}`,
          ]),
        },
      ],
    }
  } catch (error) {
    console.error('Error loading Shopify sales by store:', error)
    return null
  }
}

export const loadShopifySalesTrend = async () => {
  try {
    const data = await shopifyService.getSalesSummary()
    
    if (!data || !data.daily_sales || data.daily_sales.length === 0) {
      return null
    }

    const currency = await getCurrencySymbol()
    const dailySales = data.daily_sales.reverse() // Show oldest to newest

    return {
      type: 'summary',
      metrics: [
        { label: 'Total Revenue', value: `${currency}${data.summary.total_sales.toFixed(2)}`, icon: <AttachMoney /> },
        { label: 'Total Orders', value: data.summary.total_transactions, icon: <ShoppingCart /> },
        { label: 'Days Tracked', value: dailySales.length, icon: <TrendingUp /> },
        { label: 'Avg Daily Revenue', value: `${currency}${(data.summary.total_sales / dailySales.length).toFixed(2)}`, icon: <InventoryIcon /> },
      ],
      tables: [
        {
          title: 'Daily Sales (Last 30 Days)',
          columns: ['Date', 'Orders', 'Revenue', 'Avg Order Value'],
          rows: dailySales.map((day: any) => {
            const avgValue = day.transaction_count > 0 ? (day.total_sales / day.transaction_count).toFixed(2) : '0.00'
            return [
              new Date(day.date).toLocaleDateString(),
              day.transaction_count,
              `${currency}${day.total_sales.toFixed(2)}`,
              `${currency}${avgValue}`,
            ]
          }),
        },
      ],
    }
  } catch (error) {
    console.error('Error loading Shopify sales trend:', error)
    return null
  }
}

export const loadShopifyTopProducts = async () => {
  try {
    const data = await shopifyService.getTopProducts(20)
    
    if (!data || data.products.length === 0) {
      return null
    }

    const currency = await getCurrencySymbol()
    const totalRevenue = data.products.reduce((sum: number, p: any) => sum + p.revenue, 0)
    const totalQuantity = data.products.reduce((sum: number, p: any) => sum + p.quantity_sold, 0)

    return {
      type: 'summary',
      metrics: [
        { label: 'Top Products', value: data.products.length, icon: <ShoppingCart /> },
        { label: 'Total Revenue', value: `${currency}${totalRevenue.toFixed(2)}`, icon: <AttachMoney /> },
        { label: 'Units Sold', value: totalQuantity, icon: <InventoryIcon /> },
        { label: 'Avg Revenue/Product', value: `${currency}${(totalRevenue / data.products.length).toFixed(2)}`, icon: <TrendingUp /> },
      ],
      tables: [
        {
          title: 'Top 20 Products by Revenue',
          columns: ['Product', 'SKU', 'Quantity Sold', 'Revenue', 'Orders', 'Avg Price'],
          rows: data.products.map((product: any) => {
            const avgPrice = product.quantity_sold > 0 ? (product.revenue / product.quantity_sold).toFixed(2) : '0.00'
            return [
              product.title,
              product.sku || '-',
              product.quantity_sold,
              `${currency}${product.revenue.toFixed(2)}`,
              product.order_count,
              `${currency}${avgPrice}`,
            ]
          }),
        },
      ],
    }
  } catch (error) {
    console.error('Error loading Shopify top products:', error)
    return null
  }
}

export const loadShopifyOrderStatus = async () => {
  try {
    const data = await shopifyService.getSalesSummary()
    
    if (!data || !data.status_breakdown) {
      return null
    }

    const statusBreakdown = data.status_breakdown
    const fulfillmentBreakdown = data.fulfillment_breakdown
    const totalOrders = data.summary.total_transactions
    const currency = await getCurrencySymbol()

    return {
      type: 'summary',
      metrics: [
        { label: 'Total Orders', value: totalOrders, icon: <ShoppingCart /> },
        { label: 'Paid Orders', value: statusBreakdown.paid, icon: <AttachMoney />, trend: 'up' },
        { label: 'Fulfilled', value: fulfillmentBreakdown.fulfilled, icon: <LocalShipping />, trend: 'up' },
        { label: 'Pending', value: statusBreakdown.pending, icon: <TrendingUp />, trend: 'down' },
      ],
      tables: [
        {
          title: 'Payment Status',
          columns: ['Status', 'Count', 'Percentage'],
          rows: [
            ['Paid', statusBreakdown.paid, `${((statusBreakdown.paid / totalOrders) * 100).toFixed(1)}%`],
            ['Pending', statusBreakdown.pending, `${((statusBreakdown.pending / totalOrders) * 100).toFixed(1)}%`],
            ['Refunded', statusBreakdown.refunded, `${((statusBreakdown.refunded / totalOrders) * 100).toFixed(1)}%`],
            ['Partially Refunded', statusBreakdown.partially_refunded, `${((statusBreakdown.partially_refunded / totalOrders) * 100).toFixed(1)}%`],
          ],
        },
        {
          title: 'Fulfillment Status',
          columns: ['Status', 'Count', 'Percentage'],
          rows: [
            ['Fulfilled', fulfillmentBreakdown.fulfilled, `${((fulfillmentBreakdown.fulfilled / totalOrders) * 100).toFixed(1)}%`],
            ['Unfulfilled', fulfillmentBreakdown.unfulfilled, `${((fulfillmentBreakdown.unfulfilled / totalOrders) * 100).toFixed(1)}%`],
            ['Partial', fulfillmentBreakdown.partial, `${((fulfillmentBreakdown.partial / totalOrders) * 100).toFixed(1)}%`],
          ],
        },
      ],
    }
  } catch (error) {
    console.error('Error loading Shopify order status:', error)
    return null
  }
}

export const loadShopifyGeographicSales = async () => {
  try {
    const data = await shopifyService.getGeographicSales()
    
    if (!data || data.locations.length === 0) {
      return null
    }

    const currency = await getCurrencySymbol()
    const totalRevenue = data.locations.reduce((sum: number, l: any) => sum + l.revenue, 0)
    const totalOrders = data.locations.reduce((sum: number, l: any) => sum + l.order_count, 0)

    return {
      type: 'summary',
      metrics: [
        { label: 'Locations', value: data.total_locations, icon: <TrendingUp /> },
        { label: 'Total Revenue', value: `${currency}${totalRevenue.toFixed(2)}`, icon: <AttachMoney /> },
        { label: 'Total Orders', value: totalOrders, icon: <ShoppingCart /> },
        { label: 'Avg per Location', value: `${currency}${(totalRevenue / data.total_locations).toFixed(2)}`, icon: <InventoryIcon /> },
      ],
      tables: [
        {
          title: 'Sales by Location',
          columns: ['Country', 'City', 'Orders', 'Revenue', 'Avg Order Value'],
          rows: data.locations.slice(0, 50).map((location: any) => {
            const avgOrderValue = location.order_count > 0 ? (location.revenue / location.order_count).toFixed(2) : '0.00'
            return [
              location.country,
              location.city,
              location.order_count,
              `${currency}${location.revenue.toFixed(2)}`,
              `${currency}${avgOrderValue}`,
            ]
          }),
        },
      ],
    }
  } catch (error) {
    console.error('Error loading Shopify geographic sales:', error)
    return null
  }
}

export const loadShopifyProductPerformance = async () => {
  try {
    const data = await shopifyService.getProductPerformance()
    
    if (!data || data.products.length === 0) {
      return null
    }

    const totalRevenue = data.products.reduce((sum: number, p: any) => sum + p.revenue, 0)
    const totalQuantity = data.products.reduce((sum: number, p: any) => sum + p.quantity_sold, 0)
    const currency = await getCurrencySymbol()

    return {
      type: 'summary',
      metrics: [
        { label: 'Total Products', value: data.total_products, icon: <ShoppingCart /> },
        { label: 'Total Revenue', value: `${currency}${totalRevenue.toFixed(2)}`, icon: <AttachMoney /> },
        { label: 'Units Sold', value: totalQuantity, icon: <InventoryIcon /> },
        { label: 'Avg Revenue/Product', value: `${currency}${(totalRevenue / data.products.length).toFixed(2)}`, icon: <TrendingUp /> },
      ],
      tables: [
        {
          title: 'Top Products by Revenue',
          columns: ['Product', 'SKU', 'Quantity Sold', 'Revenue', 'Orders'],
          rows: data.products.slice(0, 50).map((product: any) => [
            product.title,
            product.sku || '-',
            product.quantity_sold,
            `${currency}${product.revenue.toFixed(2)}`,
            product.order_count,
          ]),
        },
      ],
    }
  } catch (error) {
    console.error('Error loading Shopify product performance:', error)
    return null
  }
}

export const loadShopifyCustomerAnalysis = async () => {
  try {
    const data = await shopifyService.getCustomerAnalysis()
    
    if (!data || data.customers.length === 0) {
      return null
    }

    const avgOrderValue = data.total_revenue / data.customers.reduce((sum: number, c: any) => sum + c.order_count, 0)
    const avgCustomerValue = data.total_revenue / data.total_customers
    const currency = await getCurrencySymbol()

    return {
      type: 'summary',
      metrics: [
        { label: 'Total Customers', value: data.total_customers, icon: <People /> },
        { label: 'Total Revenue', value: `${currency}${data.total_revenue.toFixed(2)}`, icon: <AttachMoney /> },
        { label: 'Avg Customer Value', value: `${currency}${avgCustomerValue.toFixed(2)}`, icon: <TrendingUp /> },
        { label: 'Avg Order Value', value: `${currency}${avgOrderValue.toFixed(2)}`, icon: <ShoppingCart /> },
      ],
      tables: [
        {
          title: 'Top Customers by Spend',
          columns: ['Customer', 'Email', 'Orders', 'Total Spent', 'Avg Order Value'],
          rows: data.customers.slice(0, 50).map((customer: any) => [
            customer.name,
            customer.email,
            customer.order_count,
            `${currency}${customer.total_spent.toFixed(2)}`,
            `${currency}${customer.avg_order_value.toFixed(2)}`,
          ]),
        },
      ],
    }
  } catch (error) {
    console.error('Error loading Shopify customer analysis:', error)
    return null
  }
}

export const loadShopifyTrafficSource = async () => {
  try {
    const data = await shopifyService.getTrafficSource()
    
    if (!data || data.sources.length === 0) {
      return null
    }

    const totalRevenue = data.sources.reduce((sum: number, s: any) => sum + s.revenue, 0)
    const totalOrders = data.sources.reduce((sum: number, s: any) => sum + s.order_count, 0)
    const currency = await getCurrencySymbol()

    return {
      type: 'summary',
      metrics: [
        { label: 'Traffic Sources', value: data.total_sources, icon: <TrendingUp /> },
        { label: 'Total Revenue', value: `${currency}${totalRevenue.toFixed(2)}`, icon: <AttachMoney /> },
        { label: 'Total Orders', value: totalOrders, icon: <ShoppingCart /> },
        { label: 'Avg per Source', value: `${currency}${(totalRevenue / data.total_sources).toFixed(2)}`, icon: <InventoryIcon /> },
      ],
      tables: [
        {
          title: 'Sales by Traffic Source',
          columns: ['Source', 'Orders', 'Revenue', '% of Total', 'Avg Order Value'],
          rows: data.sources.map((source: any) => {
            const percentage = totalRevenue > 0 ? ((source.revenue / totalRevenue) * 100).toFixed(1) : '0.0'
            const avgOrderValue = source.order_count > 0 ? (source.revenue / source.order_count).toFixed(2) : '0.00'
            return [
              source.source.charAt(0).toUpperCase() + source.source.slice(1),
              source.order_count,
              `${currency}${source.revenue.toFixed(2)}`,
              `${percentage}%`,
              `${currency}${avgOrderValue}`,
            ]
          }),
        },
      ],
    }
  } catch (error) {
    console.error('Error loading Shopify traffic source:', error)
    return null
  }
}

export const loadShopifyAverageOrderValue = async () => {
  try {
    const data = await shopifyService.getSalesSummary()
    
    if (!data || data.summary.total_transactions === 0) {
      return null
    }

    const summary = data.summary
    const currency = await getCurrencySymbol()

    return {
      type: 'summary',
      metrics: [
        { label: 'Overall AOV', value: `${currency}${summary.avg_transaction_value.toFixed(2)}`, icon: <AttachMoney /> },
        { label: 'Total Transactions', value: summary.total_transactions, icon: <ShoppingCart /> },
        { label: 'Total Revenue', value: `${currency}${summary.total_sales.toFixed(2)}`, icon: <TrendingUp /> },
        { label: 'Total Items', value: summary.total_items, icon: <InventoryIcon /> },
      ],
      tables: [
        {
          title: 'AOV by Channel',
          columns: ['Channel', 'Transactions', 'Revenue', 'Avg Order Value'],
          rows: data.by_channel.map(item => [
            item.sales_channel.charAt(0).toUpperCase() + item.sales_channel.slice(1),
            item.transaction_count,
            `${currency}${item.total_sales.toFixed(2)}`,
            `${currency}${item.avg_value.toFixed(2)}`,
          ]),
        },
      ],
    }
  } catch (error) {
    console.error('Error loading Shopify AOV:', error)
    return null
  }
}

export const loadShopifyInventorySummary = async () => {
  try {
    const data = await shopifyService.getInventorySummary()
    
    if (!data || data.total_products === 0) {
      return null
    }

    const currency = await getCurrencySymbol()

    return {
      type: 'summary',
      metrics: [
        { label: 'Total Products', value: data.total_products, icon: <InventoryIcon /> },
        { label: 'Total Quantity', value: data.total_quantity, icon: <ShoppingCart /> },
        { label: 'Inventory Value', value: `${currency}${data.total_value.toFixed(2)}`, icon: <AttachMoney /> },
        { label: 'Out of Stock', value: data.out_of_stock_count, icon: <TrendingUp />, trend: 'down' },
      ],
      tables: [
        {
          title: 'Low Stock Items',
          columns: ['Product', 'SKU', 'Quantity', 'Price'],
          rows: data.low_stock_items.map((item: any) => [
            item.title,
            item.sku || '-',
            item.quantity,
            `${currency}${item.price.toFixed(2)}`,
          ]),
        },
        {
          title: 'Out of Stock Items',
          columns: ['Product', 'SKU', 'Price'],
          rows: data.out_of_stock_items.map((item: any) => [
            item.title,
            item.sku || '-',
            `${currency}${item.price.toFixed(2)}`,
          ]),
        },
      ],
    }
  } catch (error) {
    console.error('Error loading Shopify inventory summary:', error)
    return null
  }
}

export const loadShopifyReturnsAnalysis = async () => {
  try {
    const data = await shopifyService.getReturnsAnalysis()
    
    if (!data || data.refund_count === 0) {
      return null
    }

    const currency = await getCurrencySymbol()

    return {
      type: 'summary',
      metrics: [
        { label: 'Total Refunds', value: `${currency}${data.total_refunds.toFixed(2)}`, icon: <AttachMoney />, trend: 'down' },
        { label: 'Refund Count', value: data.refund_count, icon: <LocalShipping />, trend: 'down' },
        { label: 'Refund Rate', value: `${data.refund_rate.toFixed(2)}%`, icon: <TrendingUp />, trend: 'down' },
        { label: 'Avg Refund', value: `${currency}${(data.total_refunds / data.refund_count).toFixed(2)}`, icon: <ShoppingCart /> },
      ],
      tables: [
        {
          title: 'Top Refund Reasons',
          columns: ['Reason', 'Count', 'Percentage'],
          rows: data.top_reasons.map((reason: any) => {
            const percentage = data.refund_count > 0 ? ((reason.count / data.refund_count) * 100).toFixed(1) : '0.0'
            return [
              reason.reason,
              reason.count,
              `${percentage}%`,
            ]
          }),
        },
      ],
    }
  } catch (error) {
    console.error('Error loading Shopify returns analysis:', error)
    return null
  }
}
