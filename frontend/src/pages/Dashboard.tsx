import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Grid, Paper, Snackbar, Stack, Typography, CircularProgress, Divider, List, ListItem, ListItemText, ListItemIcon, Chip } from '@mui/material'
import {
  Assessment,
  Inventory,
  PendingActions,
  ReceiptLong,
  SouthEast,
  Warning as WarningIcon,
  TrendingUp,
  Storefront,
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import MetricCard from '../components/ui/MetricCard'

const quickActions = [
  { label: 'Create Product', path: '/master-data' },
  { label: 'New POS Sale', path: '/pos' },
  { label: 'Inventory Check', path: '/inventory' },
  { label: 'Generate Report', path: '/reports' },
]

import { mdmService } from '../services/mdm.service'
import { inventoryService } from '../services/inventory.service'
import { salesService } from '../services/sales.service'

export default function Dashboard() {
  const navigate = useNavigate()
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'info' },
  )

  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    totalProducts: 0,
    activeLocations: 0,
    criticalAlerts: 0,
    fastMovingSkus: 0,
    totalSales: 0,
    totalTransactions: 0,
  })

  const [recentAlerts, setRecentAlerts] = useState<any[]>([])

  const loadDashboardData = async () => {
    try {
      const [productsData, locationsData, alertsData, velocityData] = await Promise.all([
        mdmService.getProducts(),
        mdmService.getLocations(),
        inventoryService.getStockAlerts(),
        inventoryService.getStockVelocity(),
      ])

      // Attempt to load sales summary for today if supported
      let salesSum = 0;
      let transCount = 0;
      let salesDataObj: any = null;
      try {
        const now = new Date();
        const startOfTodayDt = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfTodayDt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const startOfToday = startOfTodayDt.toISOString();
        const endOfToday = endOfTodayDt.toISOString();

        const sales = await salesService.getSalesSummary({
          date_from: startOfToday,
          date_to: endOfToday
        })
        salesDataObj = sales;
        salesSum = sales?.total_sales || 0;
        transCount = sales?.total_transactions || 0;
      } catch (e) {
        // Sales endpoint might fail if no POS config, ignore gracefully
      }

      setMetrics({
        totalProducts: Array.isArray(productsData) ? productsData.length : (productsData as any).results?.length || 0,
        activeLocations: Array.isArray(locationsData) ? locationsData.length : (locationsData as any).results?.length || 0,
        criticalAlerts: alertsData?.summary?.critical_count || 0,
        fastMovingSkus: velocityData?.summary?.fast_count || 0,
        totalSales: salesSum,
        totalTransactions: transCount,
        netSales: salesDataObj?.net_sales || salesSum,
        onlineSales: salesDataObj?.online_sales || 0,
      } as any)

      setRecentAlerts(alertsData?.critical_best_sellers?.slice(0, 5) || [])

    } catch (error) {
      console.error("Dashboard refresh error", error)
      setSnackbar({ open: true, message: 'Failed to refresh dashboard data.', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboardData()
  }, [])

  return (
    <Box>
      <PageHeader
        title="Dashboard Overview"
        subtitle="Live metrics, alerts, and operational status."
        actions={
          <Stack direction="row" spacing={1.25}>
            <Button variant="outlined" onClick={() => void loadDashboardData()} disabled={loading}>
              Refresh
            </Button>
            <Button variant="contained" onClick={() => navigate('/reports')}>
              View Analytics
            </Button>
          </Stack>
        }
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2.5}>
          {/* Top Metric Cards */}
          <Grid item xs={12} sm={6} lg={3}>
            <MetricCard
              label="Products Catalog"
              value={metrics.totalProducts.toString()}
              icon={<Inventory />}
              note="Total registered SKUs"
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <MetricCard
              label="Active Locations"
              value={metrics.activeLocations.toString()}
              icon={<Storefront />}
              note="Warehouses & Stores"
              tone="info"
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <MetricCard
              label="Fast Moving Items"
              value={metrics.fastMovingSkus.toString()}
              icon={<TrendingUp />}
              note="High sales velocity past 30 days"
              tone="success"
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <MetricCard
              label="Stock Alerts"
              value={metrics.criticalAlerts.toString()}
              icon={metrics.criticalAlerts > 0 ? <WarningIcon /> : <PendingActions />}
              note={metrics.criticalAlerts > 0 ? "Critical lowest stock!" : "Inventory level healthy"}
              tone={metrics.criticalAlerts > 0 ? "error" : "success"}
            />
          </Grid>

          {/* Main Visual Data / Alerts Area */}
          <Grid item xs={12} md={7} lg={8}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Critical Inventory Alerts
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {recentAlerts.length > 0 ? (
                <List disablePadding>
                  {recentAlerts.map((alert: any) => (
                    <ListItem key={alert.sku_id} sx={{ px: 0, borderBottom: '1px solid #f0f0f0' }}>
                      <ListItemIcon>
                        <WarningIcon color="error" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body1" fontWeight={500}>{alert.sku_name || 'Unknown Item'}</Typography>
                            {(alert.classification === 'fast' || alert.is_best_seller) && (
                              <Chip label="IN DEMAND" size="small" color="error" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }} />
                            )}
                          </Stack>
                        }
                        secondary={`Location: ${alert.location_name || alert.location_code} | Reorder Point: ${alert.min_stock_level} | On Hand: ${alert.quantity_on_hand}`}
                      />
                      <Button size="small" variant="outlined" onClick={() => navigate('/inventory/health')}>
                        Review
                      </Button>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Assessment color="disabled" sx={{ fontSize: 48, mb: 1 }} />
                  <Typography color="text.secondary">All tracking systems report healthy inventory.</Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={5} lg={4}>
            <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>
                Today's Operations
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', py: 3 }}>
                <ReceiptLong sx={{ fontSize: 50, color: 'primary.main', opacity: 0.8, mb: 2 }} />
                <Typography variant="h3" color="primary.main" fontWeight={700}>
                  {metrics.totalTransactions}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Sales Transactions
                </Typography>
                <Typography variant="h5" sx={{ mt: 3, fontWeight: 600 }}>
                  ₹{metrics.totalSales.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Gross Revenue (POS + Shopify)
                </Typography>
                {/* Net Sales */}
                <Typography variant="h6" sx={{ mt: 1, color: 'success.main', fontWeight: 600 }}>
                  ₹{(metrics as any).netSales?.toLocaleString() || metrics.totalSales.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Net Revenue (After Refunds)
                </Typography>
              </Box>
            </Paper>
          </Grid>

          {/* Quick Actions Footer */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Grid container spacing={1.5} sx={{ mt: 0.25 }}>
                {quickActions.map((action) => (
                  <Grid item xs={12} sm={6} md={3} key={action.label}>
                    <Button
                      variant="outlined"
                      fullWidth
                      endIcon={<SouthEast fontSize="small" />}
                      onClick={() => navigate(action.path)}
                      sx={{ justifyContent: 'space-between', py: 1.25 }}
                    >
                      {action.label}
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
