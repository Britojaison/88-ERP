import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
  Divider,
} from '@mui/material'
import {
  Download,
  Refresh,
  Store,
  ShoppingCart,
  TrendingUp,
  Assessment,
  Inventory,
  AttachMoney,
  People,
  LocalShipping,
  Close,
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import ReportDisplay from '../components/reports/ReportDisplay'
import VisualDashboard from '../components/reports/VisualDashboard'
import { reportingService } from '../services/reporting.service'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

const onlineReports = [
  {
    title: 'E-commerce Performance',
    icon: <ShoppingCart />,
    reports: [
      { name: 'Online Sales Summary', description: 'Total sales, orders, and revenue from online channels' },
      { name: 'Sales Trend', description: 'Daily sales performance over time' },
      { name: 'Top Products', description: 'Best selling products by revenue and quantity' },
      { name: 'Order Status', description: 'Payment and fulfillment status breakdown' },
      { name: 'Average Order Value', description: 'AOV trends and customer spending patterns' },
    ],
  },
  {
    title: 'Digital Marketing',
    icon: <TrendingUp />,
    reports: [
      { name: 'Traffic Source Analysis', description: 'Sales by Google, Facebook, Instagram, Email' },
      { name: 'Geographic Sales', description: 'Sales breakdown by country and city' },
      { name: 'Campaign Performance', description: 'ROI and ROAS for marketing campaigns' },
      { name: 'Customer Lifetime Value', description: 'LTV analysis by acquisition source' },
    ],
  },
  {
    title: 'Online Fulfillment',
    icon: <LocalShipping />,
    reports: [
      { name: 'Order Processing Time', description: 'Time from order to shipment' },
      { name: 'Shipping Performance', description: 'Delivery time and success rate by carrier' },
      { name: 'Return & Refund Analysis', description: 'Return rates and reasons by product' },
      { name: 'Packaging Cost Report', description: 'Packaging materials and shipping costs' },
    ],
  },
  {
    title: 'Online Inventory',
    icon: <Inventory />,
    reports: [
      { name: 'Stock Availability', description: 'Products in stock vs out of stock online' },
      { name: 'Slow-Moving Inventory', description: 'Products with low online sales velocity' },
      { name: 'Seasonal Demand Patterns', description: 'Historical demand trends by season' },
      { name: 'Multi-channel Sync Status', description: 'Inventory sync across platforms' },
    ],
  },
]

const storeReports = [
  {
    title: 'Store Operations',
    icon: <Store />,
    reports: [
      { name: 'Daily Store Performance', description: 'Sales, transactions, and foot traffic by store' },
      { name: 'Sales by Store', description: 'Aggregated performance across all stores' },
      { name: 'Sales by Time of Day', description: 'Peak hours and sales patterns' },
      { name: 'Store Ranking', description: 'Best and worst performing locations' },
    ],
  },
  {
    title: 'Store Inventory',
    icon: <Inventory />,
    reports: [
      { name: 'Stock Levels by Store', description: 'Current inventory at each location' },
      { name: 'Inter-Store Transfers', description: 'Stock movement between stores' },
      { name: 'Store Reorder Needs', description: 'Reorder recommendations per store' },
      { name: 'Shrinkage Report', description: 'Loss and theft tracking by location' },
      { name: 'Cycle Count Variance', description: 'Physical count vs system inventory' },
    ],
  },
  {
    title: 'Staff Performance',
    icon: <People />,
    reports: [
      { name: 'Sales by Employee', description: 'Individual staff member performance' },
      { name: 'Average Transaction Value', description: 'Staff efficiency and upselling metrics' },
      { name: 'Returns by Staff', description: 'Return handling and customer service' },
      { name: 'Commission Calculations', description: 'Staff commission and incentives' },
    ],
  },
  {
    title: 'Store Efficiency',
    icon: <Assessment />,
    reports: [
      { name: 'Checkout Time Analysis', description: 'Average time per transaction' },
      { name: 'Queue Management', description: 'Wait times and customer flow' },
      { name: 'Peak Hours Identification', description: 'Busiest times for staffing optimization' },
      { name: 'Staff Scheduling Report', description: 'Optimal staffing recommendations' },
    ],
  },
]

const unifiedReports = [
  {
    title: 'Omnichannel Analytics',
    icon: <TrendingUp />,
    reports: [
      { name: 'Unified Sales Dashboard', description: 'Total sales across all channels' },
      { name: 'Channel Contribution', description: 'Revenue percentage by channel' },
      { name: 'BOPIS Performance', description: 'Buy online, pick up in store metrics' },
      { name: 'Cross-Channel Customers', description: 'Customers shopping both online and in-store' },
      { name: 'Return to Store Analysis', description: 'Online purchases returned to stores' },
    ],
  },
  {
    title: 'Financial Reports',
    icon: <AttachMoney />,
    reports: [
      { name: 'Profit & Loss Statement', description: 'Revenue, costs, and net profit by channel' },
      { name: 'Revenue by Channel', description: 'Online vs store revenue breakdown' },
      { name: 'Gross Margin Analysis', description: 'Margin by product and category' },
      { name: 'Cash Flow Report', description: 'Daily cash collection and settlements' },
      { name: 'Payment Method Breakdown', description: 'Cash, card, UPI, wallet analysis' },
    ],
  },
  {
    title: 'Product Performance',
    icon: <Assessment />,
    reports: [
      { name: 'Best Sellers Report', description: 'Top 10 products online vs store' },
      { name: 'Slow-Moving Products', description: 'Low velocity inventory identification' },
      { name: 'Dead Stock Analysis', description: 'Products with no sales in 90+ days' },
      { name: 'Category Performance', description: 'Sales by product category' },
      { name: 'Seasonal Trends', description: 'Product demand by season' },
    ],
  },
  {
    title: 'Customer Insights',
    icon: <People />,
    reports: [
      { name: 'Customer Segmentation', description: 'Online vs store vs omnichannel customers' },
      { name: 'Repeat Purchase Rate', description: 'Customer retention by channel' },
      { name: 'Customer Journey Map', description: 'Touchpoints and conversion paths' },
      { name: 'Loyalty Program Performance', description: 'Member engagement and rewards' },
    ],
  },
]

export default function Reports() {
  const [tabValue, setTabValue] = useState(0)
  const [reportTypes, setReportTypes] = useState<Array<{ value: string; label: string }>>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState('30')
  const [locationFilter, setLocationFilter] = useState('all')
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'info' },
  )

  const loadReportTypes = async () => {
    setLoading(true)
    try {
      const types = await reportingService.getReportTypes()
      setReportTypes(types)
      setSnackbar({ open: true, message: 'Report types refreshed.', severity: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to refresh report configuration.', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReportTypes()
  }, [])

  const handleGenerate = async (reportName: string) => {
    setSelectedReport(reportName)
  }

  const handleExportBundle = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      date_range: dateRange,
      location_filter: locationFilter,
      online_reports: onlineReports,
      store_reports: storeReports,
      unified_reports: unifiedReports,
      available_report_types: reportTypes,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-bundle-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setSnackbar({ open: true, message: 'Report bundle exported.', severity: 'success' })
  }

  return (
    <Box>
      <PageHeader
        title="Reports and Analytics"
        subtitle="Generate operational, financial, and planning insights for online and store management."
        actions={
          <Stack direction="row" spacing={1.25}>
            <Button variant="outlined" startIcon={<Refresh />} onClick={() => void loadReportTypes()} disabled={loading}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<Download />} onClick={handleExportBundle}>
              Export Bundle
            </Button>
          </Stack>
        }
      />

      {/* Filters */}
      <Paper sx={{ p: 2.5, mb: 2.5 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Date Range</InputLabel>
              <Select value={dateRange} label="Date Range" onChange={(e) => setDateRange(e.target.value)}>
                <MenuItem value="7">Last 7 Days</MenuItem>
                <MenuItem value="30">Last 30 Days</MenuItem>
                <MenuItem value="90">Last 90 Days</MenuItem>
                <MenuItem value="365">Last Year</MenuItem>
                <MenuItem value="custom">Custom Range</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Location</InputLabel>
              <Select value={locationFilter} label="Location" onChange={(e) => setLocationFilter(e.target.value)}>
                <MenuItem value="all">All Locations</MenuItem>
                <MenuItem value="online">Online Only</MenuItem>
                <MenuItem value="stores">All Stores</MenuItem>
                <MenuItem value="wh-nyc">WH-NYC</MenuItem>
                <MenuItem value="store-sf">STORE-SF</MenuItem>
                <MenuItem value="store-la">STORE-LA</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Stack direction="row" spacing={1}>
              <Chip label={`Period: ${dateRange} days`} color="primary" size="small" />
              <Chip label={locationFilter === 'all' ? 'All Locations' : locationFilter} color="info" size="small" />
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 2.5 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} variant="fullWidth">
          <Tab label="Visual Analytics" icon={<TrendingUp />} iconPosition="start" />
          <Tab label="Online Business" icon={<ShoppingCart />} iconPosition="start" />
          <Tab label="Store Management" icon={<Store />} iconPosition="start" />
          <Tab label="Unified Reports" icon={<Assessment />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Visual Analytics */}
      <TabPanel value={tabValue} index={0}>
        <VisualDashboard />
      </TabPanel>

      {/* Online Business Reports */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2.5}>
          {onlineReports.map((category) => (
            <Grid item xs={12} md={6} key={category.title}>
              <Card>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    {category.icon}
                    <Typography variant="h6">{category.title}</Typography>
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                  <List disablePadding>
                    {category.reports.map((report) => (
                      <ListItemButton
                        key={report.name}
                        sx={{ borderRadius: 1, mb: 0.5 }}
                        onClick={() => void handleGenerate(report.name)}
                      >
                        <ListItemText primary={report.name} secondary={report.description} />
                      </ListItemButton>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Store Management Reports */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={2.5}>
          {storeReports.map((category) => (
            <Grid item xs={12} md={6} key={category.title}>
              <Card>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    {category.icon}
                    <Typography variant="h6">{category.title}</Typography>
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                  <List disablePadding>
                    {category.reports.map((report) => (
                      <ListItemButton
                        key={report.name}
                        sx={{ borderRadius: 1, mb: 0.5 }}
                        onClick={() => void handleGenerate(report.name)}
                      >
                        <ListItemText primary={report.name} secondary={report.description} />
                      </ListItemButton>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Unified Reports */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={2.5}>
          {unifiedReports.map((category) => (
            <Grid item xs={12} md={6} key={category.title}>
              <Card>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    {category.icon}
                    <Typography variant="h6">{category.title}</Typography>
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                  <List disablePadding>
                    {category.reports.map((report) => (
                      <ListItemButton
                        key={report.name}
                        sx={{ borderRadius: 1, mb: 0.5 }}
                        onClick={() => void handleGenerate(report.name)}
                      >
                        <ListItemText primary={report.name} secondary={report.description} />
                      </ListItemButton>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

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

      {/* Report Display Dialog */}
      <Dialog
        open={selectedReport !== null}
        onClose={() => setSelectedReport(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { minHeight: '80vh' }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Report Viewer</Typography>
            <IconButton onClick={() => setSelectedReport(null)} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedReport && (
            <ReportDisplay
              reportName={selectedReport}
              dateRange={dateRange}
              locationFilter={locationFilter}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
