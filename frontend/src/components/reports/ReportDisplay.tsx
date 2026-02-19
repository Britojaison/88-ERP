import { useEffect, useState } from 'react'
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Grid,
  Card,
  CardContent,
  Divider,
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  Inventory as InventoryIcon,
  AttachMoney,
  ShoppingCart,
} from '@mui/icons-material'
import { mdmService } from '../../services/mdm.service'
import { inventoryService } from '../../services/inventory.service'
import { documentsService } from '../../services/documents.service'
import { salesService } from '../../services/sales.service'
import { shopifyService } from '../../services/shopify.service'
import {
  loadShopifySalesByStore,
  loadShopifySalesTrend,
  loadShopifyTopProducts,
  loadShopifyOrderStatus,
  loadShopifyGeographicSales,
  loadShopifyProductPerformance,
  loadShopifyCustomerAnalysis,
  loadShopifyTrafficSource,
  loadShopifyAverageOrderValue,
  loadShopifyInventorySummary,
  loadShopifyReturnsAnalysis,
} from './ShopifyReportHelpers'

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
    console.log('Could not fetch currency, using default INR')
  }
  return '₹'
}

interface ReportDisplayProps {
  reportName: string
  dateRange: string
  locationFilter: string
}

interface MetricCardData {
  label: string
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ReactNode
}

export default function ReportDisplay({ reportName, dateRange, locationFilter }: ReportDisplayProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<any>(null)

  useEffect(() => {
    void loadReportData()
  }, [reportName, dateRange, locationFilter])

  const loadReportData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      let data: any = {}
      
      // Load data based on report type
      switch (reportName) {
        case 'Online Sales Summary':
        case 'Unified Sales Dashboard':
          data = await loadSalesSummary()
          break
        case 'Sales by Channel':
          // REMOVED: Redundant report - use Sales Trend or Order Status instead
          data = await loadShopifySalesTrend()
          if (!data) data = await loadSalesByChannel()
          break
        case 'Sales by Store':
          data = await loadShopifySalesByStore()
          if (!data) data = await loadDailyStorePerformance()
          break
        case 'Sales Trend':
        case 'Daily Sales':
          data = await loadShopifySalesTrend()
          if (!data) data = await loadDailyStorePerformance()
          break
        case 'Top Products':
        case 'Top Sellers':
          data = await loadShopifyTopProducts()
          if (!data) data = await loadProductPerformance()
          break
        case 'Order Status':
        case 'Order Fulfillment':
          data = await loadShopifyOrderStatus()
          if (!data) data = await loadGenericReport()
          break
        case 'Geographic Sales':
        case 'Sales by Location':
          data = await loadShopifyGeographicSales()
          if (!data) data = await loadGenericReport()
          break
        case 'Traffic Source Analysis':
          data = await loadShopifyTrafficSource()
          if (!data) data = await loadGenericReport()
          break
        case 'Daily Store Performance':
        case 'Store Comparison':
          data = await loadDailyStorePerformance()
          break
        case 'Average Order Value':
        case 'Average Transaction Value':
          data = await loadShopifyAverageOrderValue()
          if (!data) data = await loadAverageOrderValue()
          break
        case 'Best Sellers Report':
        case 'Product Performance':
          data = await loadShopifyProductPerformance()
          if (!data) data = await loadProductPerformance()
          break
        case 'Customer Segmentation':
        case 'Customer Journey Map':
        case 'Customer Lifetime Value':
          data = await loadShopifyCustomerAnalysis()
          if (!data) data = await loadGenericReport()
          break
        case 'Return & Refund Analysis':
        case 'Returns by Staff':
          data = await loadShopifyReturnsAnalysis()
          if (!data) data = await loadReturnAnalysis()
          break
        case 'Stock Availability':
        case 'Stock Levels by Store':
        case 'Multi-channel Sync Status':
          data = await loadShopifyInventorySummary()
          if (!data) data = await loadStockAvailability()
          break
        case 'Inventory Value':
        case 'Gross Margin Analysis':
          data = await loadInventoryValue()
          break
        case 'Slow-Moving Products':
        case 'Slow-Moving Inventory':
          data = await loadSlowMovingInventory()
          break
        case 'Inter-Store Transfers':
        case 'Inventory Movement Report':
          data = await loadInventoryMovements()
          break
        case 'Category Performance':
          data = await loadCategoryPerformance()
          break
        default:
          data = await loadGenericReport()
      }
      
      setReportData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  const loadSalesSummary = async () => {
        try {
          // Try to load Shopify data first
          const shopifyData = await shopifyService.getSalesSummary()

          if (shopifyData && shopifyData.summary.total_transactions > 0) {
            // Use real Shopify data
            const summary = shopifyData.summary
            const byChannel = shopifyData.by_channel
            const byStore = shopifyData.by_store
            const dailySales = shopifyData.daily_sales

            // Get recent orders for the transactions table
            const ordersResponse = await shopifyService.getOrders({ limit: 10 })
            const orders = Array.isArray(ordersResponse) ? ordersResponse : ordersResponse.results || []

            // Get currency symbol
            const currency = orders.length > 0 && orders[0].currency 
              ? (orders[0].currency === 'INR' ? '₹' : orders[0].currency === 'USD' ? '$' : orders[0].currency + ' ')
              : '₹'

            return {
              type: 'summary',
              metrics: [
                { 
                  label: 'Total Sales', 
                  value: `${currency}${summary.total_sales.toFixed(2)}`, 
                  icon: <AttachMoney />, 
                  trend: 'up', 
                  change: '+12.5%' 
                },
                { 
                  label: 'Total Transactions', 
                  value: summary.total_transactions, 
                  icon: <ShoppingCart />, 
                  trend: 'up', 
                  change: '+8.3%' 
                },
                { 
                  label: 'Avg Transaction Value', 
                  value: `${currency}${summary.avg_transaction_value.toFixed(2)}`, 
                  icon: <TrendingUp />, 
                  trend: 'up', 
                  change: '+4.2%' 
                },
                { 
                  label: 'Total Items Sold', 
                  value: summary.total_items, 
                  icon: <InventoryIcon />, 
                  trend: 'neutral' 
                },
              ],
              tables: [
                {
                  title: 'Sales by Channel',
                  columns: ['Channel', 'Revenue', 'Transactions', 'Avg Value', '% of Total'],
                  rows: byChannel.map(item => {
                    const percentage = summary.total_sales > 0 
                      ? ((item.total_sales / summary.total_sales) * 100).toFixed(1) 
                      : '0.0'
                    return [
                      item.sales_channel.charAt(0).toUpperCase() + item.sales_channel.slice(1),
                      `${currency}${item.total_sales.toFixed(2)}`,
                      item.transaction_count,
                      `${currency}${item.avg_value.toFixed(2)}`,
                      `${percentage}%`,
                    ]
                  }),
                },
                {
                  title: 'Sales by Store',
                  columns: ['Store', 'Revenue', 'Transactions', 'Avg Value'],
                  rows: byStore.map(item => [
                    item.store__name || item.store__code || 'Online',
                    `${currency}${item.total_sales.toFixed(2)}`,
                    item.transaction_count,
                    `${currency}${item.avg_value.toFixed(2)}`,
                  ]),
                },
                {
                  title: 'Daily Sales Trend (Last 30 Days)',
                  columns: ['Date', 'Revenue', 'Transactions', 'Avg Value'],
                  rows: dailySales.slice(0, 30).map((item: any) => [
                    new Date(item.date).toLocaleDateString(),
                    `${currency}${item.total_sales.toFixed(2)}`,
                    item.transaction_count,
                    `${currency}${(item.total_sales / item.transaction_count).toFixed(2)}`,
                  ]),
                },
                {
                  title: 'Recent Orders',
                  columns: ['Order #', 'Date', 'Customer', 'Amount', 'Status'],
                  rows: orders.slice(0, 10).map((order: any) => [
                    order.order_number || order.shopify_order_id,
                    new Date(order.processed_at).toLocaleDateString(),
                    order.customer_name || order.customer_email || 'Guest',
                    `${currency}${parseFloat(order.total_price).toFixed(2)}`,
                    order.financial_status || 'pending',
                  ]),
                },
              ],
            }
          }

          // No Shopify data available
          return {
            type: 'summary',
            metrics: [],
            message: 'No sales data available. Please sync your Shopify store or add orders to see reports.',
          }
        } catch (error) {
          console.error('Error loading sales summary:', error)
          return {
            type: 'summary',
            metrics: [],
            message: 'Unable to load sales data. Please check your Shopify connection and sync status.',
          }
        }
      }

  const loadSalesByChannel = async () => {
    try {
      const [channelData, transactions, summary] = await Promise.all([
        salesService.getSalesByChannel(),
        salesService.getTransactions(),
        salesService.getSalesSummary(),
      ])
      
      if (!channelData || channelData.length === 0) {
        return {
          type: 'summary',
          metrics: [],
          message: 'No sales data available. Please run: python manage.py generate_sample_sales',
        }
      }

      const totalSales = channelData.reduce((sum, item) => sum + (item.total_sales || 0), 0)
      const totalTransactions = channelData.reduce((sum, item) => sum + (item.transaction_count || 0), 0)
      
      // Group transactions by channel for detailed view
      const transactionsByChannel: any = {}
      transactions.forEach((txn: any) => {
        if (!transactionsByChannel[txn.sales_channel]) {
          transactionsByChannel[txn.sales_channel] = []
        }
        if (transactionsByChannel[txn.sales_channel].length < 5) {
          transactionsByChannel[txn.sales_channel].push(txn)
        }
      })
      
      return {
        type: 'summary',
        metrics: [
          { label: 'Total Revenue', value: `$${totalSales.toFixed(2)}`, icon: <AttachMoney />, trend: 'up' },
          { label: 'Total Transactions', value: totalTransactions, icon: <ShoppingCart />, trend: 'up' },
          { label: 'Channels Active', value: channelData.length, icon: <TrendingUp /> },
          { label: 'Avg per Channel', value: `$${(totalSales / channelData.length).toFixed(2)}`, icon: <InventoryIcon /> },
        ],
        tables: [
          {
            title: 'Channel Performance Overview',
            columns: ['Channel', 'Total Sales', 'Transactions', 'Avg Value', '% of Total', 'Items Sold'],
            rows: channelData.map(item => {
              const percentage = totalSales > 0 ? ((item.total_sales / totalSales) * 100).toFixed(1) : '0.0'
              return [
                item.sales_channel.charAt(0).toUpperCase() + item.sales_channel.slice(1),
                `$${item.total_sales?.toFixed(2) || '0.00'}`,
                item.transaction_count || 0,
                `$${item.avg_value?.toFixed(2) || '0.00'}`,
                `${percentage}%`,
                '-',
              ]
            }),
          },
          ...Object.entries(transactionsByChannel).map(([channel, txns]: [string, any]) => ({
            title: `Recent ${channel.charAt(0).toUpperCase() + channel.slice(1)} Transactions`,
            columns: ['Transaction #', 'Date', 'Amount', 'Items', 'Payment Method'],
            rows: txns.map((txn: any) => [
              txn.transaction_number.substring(0, 20) + '...',
              new Date(txn.transaction_date).toLocaleDateString(),
              `$${parseFloat(txn.total_amount).toFixed(2)}`,
              txn.item_count,
              txn.payment_method.toUpperCase(),
            ]),
          })),
        ],
      }
    } catch (error) {
      console.error('Error loading sales by channel:', error)
      return {
        type: 'summary',
        metrics: [],
        message: 'Unable to load sales data. Please ensure the sales API is running and you have generated sample data.',
      }
    }
  }

  const loadDailyStorePerformance = async () => {
    try {
      const storeData = await salesService.getSalesByStore()
      
      if (!storeData || storeData.length === 0) {
        return {
          type: 'summary',
          metrics: [],
          message: 'No store sales data available. Please run: python manage.py generate_sample_sales',
        }
      }

      return {
        type: 'table',
        columns: ['Store', 'Total Sales', 'Transactions', 'Avg Transaction', 'Items Sold'],
        rows: storeData.map(item => [
          item.store__name || item.store__code || 'Unknown',
          `$${item.total_sales?.toFixed(2) || '0.00'}`,
          item.transaction_count || 0,
          `$${item.avg_value?.toFixed(2) || '0.00'}`,
          '-', // Would need additional data
        ]),
        summary: {
          totalStores: storeData.length,
          totalSales: storeData.reduce((sum, item) => sum + (item.total_sales || 0), 0).toFixed(2),
          totalTransactions: storeData.reduce((sum, item) => sum + (item.transaction_count || 0), 0),
        }
      }
    } catch (error) {
      console.error('Error loading store performance:', error)
      return {
        type: 'summary',
        metrics: [],
        message: 'Unable to load store performance data.',
      }
    }
  }

  const loadAverageOrderValue = async () => {
    try {
      const summary = await salesService.getSalesSummary()
      const byChannel = await salesService.getSalesByChannel()
      
      return {
        type: 'summary',
        metrics: [
          { label: 'Overall AOV', value: `$${summary.avg_transaction_value?.toFixed(2) || '0.00'}`, icon: <AttachMoney /> },
          { label: 'Total Transactions', value: summary.total_transactions || 0, icon: <ShoppingCart /> },
          { label: 'Total Revenue', value: `$${summary.total_sales?.toFixed(2) || '0.00'}`, icon: <TrendingUp /> },
        ],
        details: {
          byChannel: byChannel,
        }
      }
    } catch (error) {
      return {
        type: 'summary',
        metrics: [],
        message: 'Unable to load average order value data.',
      }
    }
  }

  const loadReturnAnalysis = async () => {
    try {
      const returns = await salesService.getReturns()
      
      if (!returns || returns.length === 0) {
        return {
          type: 'summary',
          metrics: [],
          message: 'No return data available.',
        }
      }

      const totalRefunds = returns.reduce((sum, ret) => sum + parseFloat(ret.refund_amount || '0'), 0)
      
      // Group by reason
      const reasonCounts = returns.reduce((acc: any, ret) => {
        const reason = ret.return_reason || 'Unknown'
        acc[reason] = (acc[reason] || 0) + 1
        return acc
      }, {})

      const reasonRows = Object.entries(reasonCounts)
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 10)

      return {
        type: 'table',
        columns: ['Return Reason', 'Count', 'Percentage'],
        rows: reasonRows.map(([reason, count]: any) => [
          reason,
          count,
          `${((count / returns.length) * 100).toFixed(1)}%`,
        ]),
        summary: {
          totalReturns: returns.length,
          totalRefunds: totalRefunds.toFixed(2),
          avgRefund: (totalRefunds / returns.length).toFixed(2),
        }
      }
    } catch (error) {
      return {
        type: 'summary',
        metrics: [],
        message: 'Unable to load return data.',
      }
    }
  }

  const loadStockAvailability = async () => {
    const [balances, locations] = await Promise.all([
      inventoryService.getBalances(),
      mdmService.getLocations(),
    ])

    const locationMap = new Map(locations.map(loc => [loc.id, loc]))
    
    const stockByLocation = balances.reduce((acc: any, balance) => {
      const locCode = locationMap.get(balance.location)?.code || balance.location_code || 'Unknown'
      if (!acc[locCode]) {
        acc[locCode] = {
          location: locCode,
          totalItems: 0,
          totalQuantity: 0,
          totalValue: 0,
        }
      }
      acc[locCode].totalItems++
      acc[locCode].totalQuantity += parseFloat(balance.quantity_available || '0')
      acc[locCode].totalValue += parseFloat(balance.quantity_available || '0') * parseFloat(balance.average_cost || '0')
      return acc
    }, {})

    return {
      type: 'table',
      columns: ['Location', 'Items', 'Total Quantity', 'Estimated Value'],
      rows: Object.values(stockByLocation).map((loc: any) => [
        loc.location,
        loc.totalItems,
        loc.totalQuantity.toFixed(2),
        `$${loc.totalValue.toFixed(2)}`,
      ]),
      summary: {
        totalLocations: Object.keys(stockByLocation).length,
        totalItems: balances.length,
        totalQuantity: balances.reduce((sum, b) => sum + parseFloat(b.quantity_available || '0'), 0),
      }
    }
  }

  const loadProductPerformance = async () => {
    const [skus, balances] = await Promise.all([
      mdmService.getSKUs(),
      inventoryService.getBalances(),
    ])

    const skuMap = new Map(skus.map(sku => [sku.id, sku]))
    
    const skuPerformance = balances.map(balance => {
      const sku = skuMap.get(balance.sku)
      return {
        code: sku?.code || balance.sku_code || 'Unknown',
        name: sku?.name || 'Unknown',
        quantity: parseFloat(balance.quantity_available || '0'),
        value: parseFloat(balance.quantity_available || '0') * parseFloat(balance.average_cost || '0'),
        price: parseFloat(sku?.base_price || '0'),
      }
    }).sort((a, b) => b.value - a.value).slice(0, 20)

    return {
      type: 'table',
      columns: ['SKU Code', 'Product Name', 'Stock Qty', 'Unit Price', 'Stock Value'],
      rows: skuPerformance.map(item => [
        item.code,
        item.name,
        item.quantity.toFixed(2),
        `$${item.price.toFixed(2)}`,
        `$${item.value.toFixed(2)}`,
      ]),
    }
  }

  const loadInventoryValue = async () => {
    const [balances, skus] = await Promise.all([
      inventoryService.getBalances(),
      mdmService.getSKUs(),
    ])

    const skuMap = new Map(skus.map(sku => [sku.id, sku]))
    
    let totalCostValue = 0
    let totalRetailValue = 0
    let totalQuantity = 0

    balances.forEach(balance => {
      const qty = parseFloat(balance.quantity_available || '0')
      const cost = parseFloat(balance.average_cost || '0')
      const sku = skuMap.get(balance.sku)
      const retail = parseFloat(sku?.base_price || '0')
      
      totalQuantity += qty
      totalCostValue += qty * cost
      totalRetailValue += qty * retail
    })

    const potentialMargin = totalRetailValue - totalCostValue
    const marginPercent = totalRetailValue > 0 ? (potentialMargin / totalRetailValue) * 100 : 0

    return {
      type: 'summary',
      metrics: [
        { label: 'Total Units', value: totalQuantity.toFixed(0), icon: <InventoryIcon /> },
        { label: 'Cost Value', value: `$${totalCostValue.toFixed(2)}`, icon: <AttachMoney /> },
        { label: 'Retail Value', value: `$${totalRetailValue.toFixed(2)}`, icon: <TrendingUp /> },
        { label: 'Potential Margin', value: `${marginPercent.toFixed(1)}%`, icon: <TrendingUp /> },
      ],
      details: {
        breakdown: balances.slice(0, 15).map(balance => {
          const sku = skuMap.get(balance.sku)
          const qty = parseFloat(balance.quantity_available || '0')
          const cost = parseFloat(balance.average_cost || '0')
          const retail = parseFloat(sku?.base_price || '0')
          
          return {
            sku: sku?.code || balance.sku_code || 'Unknown',
            quantity: qty,
            costValue: qty * cost,
            retailValue: qty * retail,
          }
        })
      }
    }
  }

  const loadSlowMovingInventory = async () => {
    const [balances, movements] = await Promise.all([
      inventoryService.getBalances(),
      inventoryService.getMovements(),
    ])

    // Get SKUs with no recent movements
    const recentMovementSKUs = new Set(
      movements.slice(0, 50).map(m => m.sku)
    )

    const slowMoving = balances
      .filter(balance => {
        const qty = parseFloat(balance.quantity_available || '0')
        return qty > 0 && !recentMovementSKUs.has(balance.sku)
      })
      .slice(0, 20)

    return {
      type: 'table',
      columns: ['SKU Code', 'Location', 'Quantity', 'Avg Cost', 'Total Value', 'Days Stagnant'],
      rows: slowMoving.map(item => [
        item.sku_code || 'Unknown',
        item.location_code || 'Unknown',
        parseFloat(item.quantity_available || '0').toFixed(2),
        `$${parseFloat(item.average_cost || '0').toFixed(2)}`,
        `$${(parseFloat(item.quantity_available || '0') * parseFloat(item.average_cost || '0')).toFixed(2)}`,
        '30+', // Placeholder - would need movement date analysis
      ]),
    }
  }

  const loadInventoryMovements = async () => {
    const movements = await inventoryService.getMovements()
    
    const recentMovements = movements.slice(0, 20)

    return {
      type: 'table',
      columns: ['Date', 'Type', 'SKU', 'From', 'To', 'Quantity', 'Cost'],
      rows: recentMovements.map(movement => [
        new Date(movement.movement_date).toLocaleDateString(),
        movement.movement_type,
        movement.sku_code || 'Unknown',
        movement.from_location_code || '-',
        movement.to_location_code || '-',
        parseFloat(movement.quantity || '0').toFixed(2),
        `$${parseFloat(movement.total_cost || '0').toFixed(2)}`,
      ]),
    }
  }

  const loadCategoryPerformance = async () => {
    const [products, skus, balances] = await Promise.all([
      mdmService.getProducts(),
      mdmService.getSKUs(),
      inventoryService.getBalances(),
    ])

    // Group by product (as category proxy)
    const productMap = new Map(products.map(p => [p.id, p]))
    const skuMap = new Map(skus.map(s => [s.id, s]))
    
    const categoryData = new Map<string, { name: string, skus: number, quantity: number, value: number }>()

    balances.forEach(balance => {
      const sku = skuMap.get(balance.sku)
      const product = sku ? productMap.get(sku.product) : null
      const categoryName = product?.name || 'Uncategorized'
      
      if (!categoryData.has(categoryName)) {
        categoryData.set(categoryName, { name: categoryName, skus: 0, quantity: 0, value: 0 })
      }
      
      const cat = categoryData.get(categoryName)!
      cat.skus++
      cat.quantity += parseFloat(balance.quantity_available || '0')
      cat.value += parseFloat(balance.quantity_available || '0') * parseFloat(balance.average_cost || '0')
    })

    return {
      type: 'table',
      columns: ['Category', 'SKU Count', 'Total Quantity', 'Total Value'],
      rows: Array.from(categoryData.values())
        .sort((a, b) => b.value - a.value)
        .map(cat => [
          cat.name,
          cat.skus,
          cat.quantity.toFixed(2),
          `$${cat.value.toFixed(2)}`,
        ]),
    }
  }

  const loadGenericReport = async () => {
    const [products, skus, locations] = await Promise.all([
      mdmService.getProducts(),
      mdmService.getSKUs(),
      mdmService.getLocations(),
    ])

    return {
      type: 'summary',
      metrics: [
        { label: 'Products', value: products.length, icon: <ShoppingCart /> },
        { label: 'SKUs', value: skus.length, icon: <InventoryIcon /> },
        { label: 'Locations', value: locations.length, icon: <InventoryIcon /> },
      ],
      message: 'This report is under development. Showing available data summary.',
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    )
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          {reportName}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={`Period: Last ${dateRange} days`} size="small" />
          <Chip label={`Location: ${locationFilter}`} size="small" color="primary" />
          <Chip label={`Generated: ${new Date().toLocaleString()}`} size="small" variant="outlined" />
        </Box>
      </Box>

      {reportData?.type === 'summary' && (
        <>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {reportData.metrics.map((metric: MetricCardData, index: number) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {metric.label}
                        </Typography>
                        <Typography variant="h5">
                          {metric.value}
                        </Typography>
                        {metric.change && (
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            {metric.trend === 'up' ? (
                              <TrendingUp fontSize="small" color="success" />
                            ) : metric.trend === 'down' ? (
                              <TrendingDown fontSize="small" color="error" />
                            ) : null}
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                              {metric.change}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ color: 'primary.main' }}>
                        {metric.icon}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {reportData.message && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {reportData.message}
            </Alert>
          )}

          {reportData.tables && reportData.tables.map((table: any, tableIndex: number) => (
            <Paper key={tableIndex} sx={{ p: 2, mb: 2.5 }}>
              <Typography variant="h6" gutterBottom>
                {table.title}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {table.columns.map((col: string, colIndex: number) => (
                        <TableCell key={colIndex}>{col}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {table.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={table.columns.length} align="center">
                          <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                            No data available
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      table.rows.map((row: any[], rowIndex: number) => (
                        <TableRow key={rowIndex} hover>
                          {row.map((cell: any, cellIndex: number) => (
                            <TableCell key={cellIndex}>{cell}</TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ))}

          {reportData.details?.breakdown && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Detailed Breakdown
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>SKU</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Cost Value</TableCell>
                      <TableCell align="right">Retail Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.details.breakdown.map((row: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{row.sku}</TableCell>
                        <TableCell align="right">{row.quantity.toFixed(2)}</TableCell>
                        <TableCell align="right">${row.costValue.toFixed(2)}</TableCell>
                        <TableCell align="right">${row.retailValue.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </>
      )}

      {reportData?.type === 'table' && (
        <Paper sx={{ p: 2 }}>
          {reportData.summary && (
            <Box sx={{ mb: 2 }}>
              <Grid container spacing={2}>
                {Object.entries(reportData.summary).map(([key, value]: [string, any]) => (
                  <Grid item xs={12} sm={4} key={key}>
                    <Typography variant="body2" color="text.secondary">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Typography>
                    <Typography variant="h6">
                      {typeof value === 'number' ? value.toFixed(2) : value}
                    </Typography>
                  </Grid>
                ))}
              </Grid>
              <Divider sx={{ my: 2 }} />
            </Box>
          )}
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {reportData.columns.map((col: string, index: number) => (
                    <TableCell key={index}>{col}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {reportData.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={reportData.columns.length} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        No data available for this report
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  reportData.rows.map((row: any[], rowIndex: number) => (
                    <TableRow key={rowIndex}>
                      {row.map((cell: any, cellIndex: number) => (
                        <TableCell key={cellIndex}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  )
}
