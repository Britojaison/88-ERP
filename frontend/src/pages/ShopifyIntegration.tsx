import React, { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Snackbar,
  LinearProgress,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Tooltip,
} from '@mui/material'
import {
  Add,
  Refresh,
  Sync,
  CloudUpload,
  CheckCircle,
  Error as ErrorIcon,
  Delete,
  Settings,
  Webhook,
  Inventory,
  Search,
  FilterList,
  Info,
  ShoppingCart,
  Receipt,
  LocalOffer,
  MonetizationOn,
  Assessment,
} from '@mui/icons-material'
import { shopifyService, ShopifyStore, ShopifyProduct, ShopifySyncJob, ShopifyDraftOrder, ShopifyDiscount, ProductDemandResponse } from '../services/shopify.service'
import PageHeader from '../components/ui/PageHeader'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export default function ShopifyIntegration() {
  const [stores, setStores] = useState<ShopifyStore[]>([])
  const [selectedStore, setSelectedStore] = useState<ShopifyStore | null>(null)
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [productCount, setProductCount] = useState(0)
  const [productPage, setProductPage] = useState(1)
  const [syncJobs, setSyncJobs] = useState<ShopifySyncJob[]>([])
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [productDemand, setProductDemand] = useState<ProductDemandResponse | null>(null)
  const [draftOrders, setDraftOrders] = useState<ShopifyDraftOrder[]>([])
  const [discounts, setDiscounts] = useState<ShopifyDiscount[]>([])
  const [tabValue, setTabValue] = useState(0)
  const [demandSearch, setDemandSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [filterVendor, setFilterVendor] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')

  const [openStoreDialog, setOpenStoreDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingStores, setLoadingStores] = useState(false)
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info'
  })

  const [newStore, setNewStore] = useState({
    name: '',
    shop_domain: '',
    access_token: '',
    api_version: '2024-01',
    webhook_secret: '',
    auto_sync_products: true,
    auto_sync_inventory: true,
    auto_sync_orders: false,
    sync_interval_minutes: 15,
  })

  console.log('ShopifyIntegration rendering, stores:', stores.length, 'selectedStore:', selectedStore?.id)

  useEffect(() => {
    loadStores()
  }, [])

  const syncJobsRef = React.useRef(syncJobs)
  syncJobsRef.current = syncJobs

  useEffect(() => {
    if (selectedStore) {
      loadStoreData(selectedStore.id)

      // Set up polling only if a sync is running
      const interval = setInterval(() => {
        const isRunning = syncJobsRef.current.some(j => j.status === 'running')
        if (isRunning) {
          loadStoreData(selectedStore.id)
        }
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [selectedStore])

  const loadStores = async () => {
    setLoadingStores(true)
    try {
      const data = await shopifyService.listStores()
      setStores(data)
      if (data.length > 0 && !selectedStore) {
        setSelectedStore(data[0])
      }
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: 'Failed to load stores',
        severity: 'error'
      })
    } finally {
      setLoadingStores(false)
    }
  }

  const totalSales = useMemo(() => {
    return productDemand?.total_revenue?.toFixed(2) || '0.00'
  }, [productDemand])

  const loadStoreData = async (storeId: string) => {
    try {
      // Load essential status first to ensure UI displays
      const statusData = await shopifyService.getSyncStatus(storeId);
      setSyncStatus(statusData);

      // Load lightweight data in parallel — NO bulk order fetching
      void Promise.all([
        shopifyService.listProducts({ store: storeId, page: 1 }).then(res => {
          if (res && res.results) {
            setProducts(res.results)
            setProductCount(res.count || 0)
            setProductPage(1)
          }
        }).catch(e => console.error('Failed to load products:', e)),
        shopifyService.listSyncJobs(storeId).then(setSyncJobs).catch(e => console.error('Failed to load sync jobs:', e)),
        shopifyService.getProductDemand(storeId).then(setProductDemand).catch(e => console.error('Failed to load product demand:', e)),
        shopifyService.listDraftOrders(storeId).then(setDraftOrders).catch(e => console.error('Failed to load draft orders:', e)),
        shopifyService.listDiscounts(storeId).then(setDiscounts).catch(e => console.error('Failed to load discounts:', e))
      ]);
    } catch (error: any) {
      console.error('Failed to load essential store data:', error)
      setSnackbar({
        open: true,
        message: 'Could not fetch store status. Please check your connection.',
        severity: 'error'
      })
    }
  }

  const loadProductPage = async (page: number) => {
    if (!selectedStore) return
    try {
      const res = await shopifyService.listProducts({ store: selectedStore.id, page })
      setProducts(res.results)
      setProductCount(res.count)
      setProductPage(page)
    } catch (e) {
      console.error('Failed to load products page:', e)
    }
  }

  const productTypes = useMemo(() => {
    const types = Array.from(new Set(products.map(p => p.shopify_product_type).filter(Boolean)))
    return ['All', ...types.sort()]
  }, [products])

  const vendors = useMemo(() => {
    const v = Array.from(new Set(products.map(p => p.shopify_vendor).filter(Boolean)))
    return ['All', ...v.sort()]
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch =
        product.shopify_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.shopify_sku.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesType = filterType === 'All' || product.shopify_product_type === filterType
      const matchesVendor = filterVendor === 'All' || product.shopify_vendor === filterVendor
      const matchesStatus = filterStatus === 'All' || product.sync_status === filterStatus.toLowerCase()

      return matchesSearch && matchesType && matchesVendor && matchesStatus
    })
  }, [products, searchQuery, filterType, filterVendor, filterStatus])

  const handleCreateStore = async () => {
    if (!newStore.name || !newStore.shop_domain || !newStore.access_token) {
      setSnackbar({
        open: true,
        message: 'Name, Shop Domain, and Access Token are required',
        severity: 'error'
      })
      return
    }

    setLoading(true)
    try {
      const created = await shopifyService.createStore(newStore)
      setSnackbar({
        open: true,
        message: 'Store connected successfully!',
        severity: 'success'
      })
      setOpenStoreDialog(false)
      setNewStore({
        name: '',
        shop_domain: '',
        access_token: '',
        api_version: '2024-01',
        webhook_secret: '',
        auto_sync_products: true,
        auto_sync_inventory: true,
        auto_sync_orders: false,
        sync_interval_minutes: 15,
      })
      loadStores()
      setSelectedStore(created)
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.connection_error ||
        error.response?.data?.message ||
        error.message ||
        'Failed to connect store'

      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSyncProducts = async (store: ShopifyStore) => {
    try {
      const result = await shopifyService.syncProducts(store.id)
      setSnackbar({
        open: true,
        message: result.message,
        severity: 'info'
      })
      setTimeout(() => loadStoreData(store.id), 2000)
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: 'Failed to start product sync',
        severity: 'error'
      })
    }
  }

  const handleSyncInventory = async (store: ShopifyStore) => {
    try {
      const result = await shopifyService.syncInventory(store.id)
      setSnackbar({
        open: true,
        message: result.message,
        severity: 'info'
      })
      setTimeout(() => loadStoreData(store.id), 2000)
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: 'Failed to start inventory sync',
        severity: 'error'
      })
    }
  }


  const handleSetupWebhooks = async (store: ShopifyStore) => {
    try {
      const result = await shopifyService.setupWebhooks(store.id)
      setSnackbar({
        open: true,
        message: result.message,
        severity: result.success ? 'success' : 'error'
      })
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: 'Failed to setup webhooks',
        severity: 'error'
      })
    }
  }

  const handleSyncOrders = async (store: ShopifyStore) => {
    try {
      const result = await shopifyService.syncOrders(store.id)
      setSnackbar({ open: true, message: result.message, severity: 'info' })
      setTimeout(() => loadStoreData(store.id), 2000)
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to sync orders', severity: 'error' })
    }
  }

  const handleSyncDraftOrders = async (store: ShopifyStore) => {
    try {
      const result = await shopifyService.syncDraftOrders(store.id)
      setSnackbar({ open: true, message: result.message, severity: 'info' })
      setTimeout(() => loadStoreData(store.id), 2000)
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to sync draft orders', severity: 'error' })
    }
  }

  const handleSyncDiscounts = async (store: ShopifyStore) => {
    try {
      const result = await shopifyService.syncDiscounts(store.id)
      setSnackbar({ open: true, message: result.message, severity: 'info' })
      setTimeout(() => loadStoreData(store.id), 2000)
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to sync discounts', severity: 'error' })
    }
  }

  const handleTestConnection = async (store: ShopifyStore) => {
    try {
      const result = await shopifyService.testConnection(store.id)
      setSnackbar({
        open: true,
        message: result.message,
        severity: result.connected ? 'success' : 'error'
      })
    } catch (error) {
      setSnackbar({ open: true, message: 'Connection test failed', severity: 'error' })
    }
  }

  const handleDeleteStore = async (id: string) => {
    if (!window.confirm('Are you sure you want to disconnect this store?')) return

    try {
      await shopifyService.deleteStore(id)
      setSnackbar({
        open: true,
        message: 'Store disconnected successfully!',
        severity: 'success'
      })
      loadStores()
      if (selectedStore?.id === id) {
        setSelectedStore(null)
      }
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: 'Failed to disconnect store',
        severity: 'error'
      })
    }
  }

  const handleSaveStoreSettings = async () => {
    if (!selectedStore) return

    try {
      const updated = await shopifyService.updateStore(selectedStore.id, {
        auto_sync_products: selectedStore.auto_sync_products,
        auto_sync_inventory: selectedStore.auto_sync_inventory,
        auto_sync_orders: selectedStore.auto_sync_orders,
        sync_interval_minutes: Number(selectedStore.sync_interval_minutes),
      })

      setSelectedStore(updated)
      setStores((prev) => prev.map((store) => (store.id === updated.id ? updated : store)))
      setSnackbar({
        open: true,
        message: 'Store settings saved.',
        severity: 'success',
      })
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to save store settings.',
        severity: 'error',
      })
    }
  }

  const handleQuickConnect = async () => {
    setLoading(true)
    try {
      const result = await shopifyService.quickConnect()
      setSnackbar({
        open: true,
        message: result.message,
        severity: result.connected ? 'success' : 'error',
      })
      loadStores()
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Quick connect failed'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <PageHeader
        title="Shopify Integration"
        subtitle="Connect, sync, and monitor your Shopify storefront data."
        actions={
          <Box sx={{ display: 'flex', gap: 1.25 }}>
            <Button variant="outlined" startIcon={<Refresh />} onClick={loadStores} disabled={loadingStores}>
              Refresh
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleQuickConnect}
              disabled={loading}
            >
              {loading ? <CircularProgress size={20} /> : 'Quick Connect'}
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => setOpenStoreDialog(true)}>
              Connect Store
            </Button>
          </Box>
        }
      />

      {loadingStores ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : stores.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <CloudUpload sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Shopify Stores Connected
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            You haven't linked any Shopify stores yet. Click "Connect Store" to link your e-commerce platform and start syncing products and inventory automatically.
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setOpenStoreDialog(true)}
          >
            Connect Store
          </Button>
        </Paper>
      ) : (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {stores.map((store) => (
              <Grid item xs={12} md={6} lg={4} key={store.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    border: selectedStore?.id === store.id ? '2px solid' : '1px solid',
                    borderColor: selectedStore?.id === store.id ? 'primary.main' : 'divider',
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: 3,
                    },
                  }}
                  onClick={() => setSelectedStore(store)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {store.name}
                      </Typography>
                      {store.is_connected ? (
                        <Chip icon={<CheckCircle />} label="Connected" size="small" color="success" />
                      ) : (
                        <Chip icon={<ErrorIcon />} label="Disconnected" size="small" color="error" />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {store.shop_domain}
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Last Product Sync: {store.last_product_sync ? new Date(store.last_product_sync).toLocaleString() : 'Never'}
                      </Typography>
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button size="small" onClick={(e) => { e.stopPropagation(); handleTestConnection(store); }}>
                      Test
                    </Button>
                    <Button size="small" onClick={(e) => { e.stopPropagation(); handleSyncProducts(store); }}>
                      Sync
                    </Button>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteStore(store.id); }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {selectedStore && (
            <Paper sx={{ mb: 3 }}>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
                <Tab label="Overview" icon={<Assessment />} iconPosition="start" />
                <Tab label="Products" icon={<Inventory />} iconPosition="start" />
                <Tab label="Product Demand" icon={<Assessment />} iconPosition="start" />
                <Tab label="Sales" icon={<LocalOffer />} iconPosition="start" />
                <Tab label="Sync Jobs" icon={<Sync />} iconPosition="start" />
                <Tab label="Settings" icon={<Settings />} iconPosition="start" />
              </Tabs>

              <TabPanel value={tabValue} index={0}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4} lg={2.4}>
                    <Card sx={{ height: '100%', borderTop: '4px solid', borderColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                            Total Products
                          </Typography>
                          <Inventory color="primary" sx={{ opacity: 0.5 }} />
                        </Box>
                        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                          {syncStatus?.products?.total || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Shopify Variants
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4} lg={2.4}>
                    <Card sx={{ height: '100%', borderTop: '4px solid', borderColor: 'success.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                            Synced SKUs
                          </Typography>
                          <CheckCircle color="success" sx={{ opacity: 0.5 }} />
                        </Box>
                        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, color: 'success.main' }}>
                          {syncStatus?.products?.synced || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Mapped to ERP
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4} lg={2.4}>
                    <Card sx={{ height: '100%', borderTop: '4px solid', borderColor: 'warning.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                            Pending
                          </Typography>
                          <Info color="warning" sx={{ opacity: 0.5 }} />
                        </Box>
                        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, color: 'warning.main' }}>
                          {syncStatus?.products?.pending || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Needs Mapping
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6} lg={2.4}>
                    <Card sx={{ height: '100%', borderTop: '4px solid', borderColor: 'info.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                            Total Orders
                          </Typography>
                          <ShoppingCart color="info" sx={{ opacity: 0.5 }} />
                        </Box>
                        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                          {productDemand?.total_orders || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Synced Orders
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6} lg={2.4}>
                    <Card sx={{ height: '100%', borderTop: '4px solid', borderColor: 'secondary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                            Sales Volume
                          </Typography>
                          <MonetizationOn color="secondary" sx={{ opacity: 0.5 }} />
                        </Box>
                        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, color: 'secondary.main' }}>
                          {'\u20B9'}{totalSales}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Value
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Paper sx={{ p: 3, mt: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Quick Actions
                  </Typography>
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} sm={4} md={2}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Sync />}
                        onClick={() => handleSyncProducts(selectedStore!)}
                      >
                        Products
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<ShoppingCart />}
                        onClick={() => handleSyncOrders(selectedStore!)}
                      >
                        Orders
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<LocalOffer />}
                        onClick={() => handleSyncDiscounts(selectedStore!)}
                      >
                        Discounts
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Receipt />}
                        onClick={() => handleSyncDraftOrders(selectedStore!)}
                      >
                        Sync Drafts
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Webhook />}
                        onClick={() => handleSetupWebhooks(selectedStore!)}
                      >
                        Webhooks
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                {/* Product search and filtering */}
                <Box sx={{ mb: 3 }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Search by Title or SKU..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search sx={{ fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Type</InputLabel>
                        <Select
                          value={filterType}
                          label="Type"
                          onChange={(e) => setFilterType(e.target.value)}
                        >
                          {productTypes.map(type => (
                            <MenuItem key={type} value={type}>{type}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4} md={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Vendor</InputLabel>
                        <Select
                          value={filterVendor}
                          label="Vendor"
                          onChange={(e) => setFilterVendor(e.target.value)}
                        >
                          {vendors.map(v => (
                            <MenuItem key={v} value={v}>{v}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4} md={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Sync Status</InputLabel>
                        <Select
                          value={filterStatus}
                          label="Sync Status"
                          onChange={(e) => setFilterStatus(e.target.value)}
                        >
                          <MenuItem value="All">All Statuses</MenuItem>
                          <MenuItem value="Synced">Synced</MenuItem>
                          <MenuItem value="Pending">Pending</MenuItem>
                          <MenuItem value="Error">Error</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Box>

                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Shopify Product</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>SKU/Barcode</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Category/Vendor</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Price</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Inventory</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>ERP Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                            <Box sx={{ color: 'text.secondary', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <FilterList sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
                              <Typography variant="body1">
                                {searchQuery || filterType !== 'All' || filterVendor !== 'All' || filterStatus !== 'All'
                                  ? 'No products match your filters.'
                                  : 'You haven\'t synced any products yet. Click "Sync" or "Products" in Quick Actions to pull them from Shopify.'}
                              </Typography>
                              {(searchQuery || filterType !== 'All' || filterVendor !== 'All' || filterStatus !== 'All') && (
                                <Button
                                  size="small"
                                  onClick={() => {
                                    setSearchQuery('')
                                    setFilterType('All')
                                    setFilterVendor('All')
                                    setFilterStatus('All')
                                  }}
                                  sx={{ mt: 1 }}
                                >
                                  Clear all filters
                                </Button>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredProducts.map((product) => (
                          <TableRow key={product.id} hover>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {product.shopify_image_url ? (
                                  <Box
                                    component="img"
                                    src={product.shopify_image_url}
                                    sx={{ width: 40, height: 40, borderRadius: 1, mr: 2, objectFit: 'cover' }}
                                  />
                                ) : (
                                  <Box sx={{ width: 40, height: 40, borderRadius: 1, mr: 2, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Inventory sx={{ fontSize: 20, color: 'text.secondary', opacity: 0.5 }} />
                                  </Box>
                                )}
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                    {product.shopify_title}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    ID: {product.shopify_product_id}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{product.shopify_sku || '-'}</Typography>
                              <Typography variant="caption" color="text.secondary">{product.shopify_barcode || ''}</Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Chip label={product.shopify_product_type || 'Uncategorized'} size="small" sx={{ mb: 0.5, maxWidth: 'fit-content' }} />
                                <Typography variant="caption" color="text.secondary">{product.shopify_vendor}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell>{'\u20B9'}{product.shopify_price}</TableCell>
                            <TableCell>
                              <Chip
                                label={product.shopify_inventory_quantity}
                                size="small"
                                color={product.shopify_inventory_quantity > 0 ? 'default' : 'error'}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Chip
                                  label={product.sync_status}
                                  size="small"
                                  color={product.sync_status === 'synced' ? 'success' : 'warning'}
                                />
                                {product.erp_sku_code && (
                                  <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center' }}>
                                    <CheckCircle sx={{ fontSize: 12, mr: 0.5, color: 'success.main' }} />
                                    {product.erp_sku_code}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                {/* Pagination */}
                {productCount > 50 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, px: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Showing {(productPage - 1) * 50 + 1}-{Math.min(productPage * 50, productCount)} of {productCount} products
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={productPage <= 1}
                        onClick={() => loadProductPage(productPage - 1)}
                      >
                        Previous
                      </Button>
                      <Chip label={`Page ${productPage} of ${Math.ceil(productCount / 50)}`} variant="outlined" />
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={productPage * 50 >= productCount}
                        onClick={() => loadProductPage(productPage + 1)}
                      >
                        Next
                      </Button>
                    </Box>
                  </Box>
                )}
              </TabPanel>


              <TabPanel value={tabValue} index={2}>
                {/* Summary Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6} md={3}>
                    <Card variant="outlined" sx={{ textAlign: 'center', py: 1 }}>
                      <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                        <Typography variant="overline" color="text.secondary">Total Orders</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {productDemand?.total_orders || 0}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Card variant="outlined" sx={{ textAlign: 'center', py: 1 }}>
                      <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                        <Typography variant="overline" color="text.secondary">Units Sold</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                          {productDemand?.total_units_sold?.toLocaleString() || 0}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Card variant="outlined" sx={{ textAlign: 'center', py: 1 }}>
                      <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                        <Typography variant="overline" color="text.secondary">Products Ordered</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                          {productDemand?.total_products || 0}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Card variant="outlined" sx={{ textAlign: 'center', py: 1 }}>
                      <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                        <Typography variant="overline" color="text.secondary">Total Revenue</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: 'secondary.main' }}>
                          INR {(productDemand?.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Search */}
                <Box sx={{ mb: 2 }}>
                  <TextField
                    size="small"
                    placeholder="Search by product name, variant, or SKU..."
                    value={demandSearch}
                    onChange={(e) => setDemandSearch(e.target.value)}
                    sx={{ width: 400 }}
                    InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
                  />
                </Box>

                {/* Product Demand Table */}
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Variant</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>SKU</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Units Sold</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Orders</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Revenue</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Current Stock</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {!productDemand || productDemand.items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                            <Typography color="text.secondary">
                              No order data yet. Sync orders first using Quick Actions, then this view will show aggregated product demand.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        productDemand.items
                          .filter(item => {
                            if (!demandSearch) return true
                            const q = demandSearch.toLowerCase()
                            return (
                              item.title.toLowerCase().includes(q) ||
                              (item.variant_title || '').toLowerCase().includes(q) ||
                              (item.sku || '').toLowerCase().includes(q)
                            )
                          })
                          .slice(0, 100) // Limit to first 100 items for performance
                          .map((item, idx) => {
                            const isLowStock = item.current_stock !== null && item.current_stock <= 10
                            const isOutOfStock = item.current_stock !== null && item.current_stock <= 0
                            return (
                              <TableRow key={`${item.title}-${item.variant_title}-${item.sku}`} hover>
                                <TableCell sx={{ color: 'text.secondary' }}>{idx + 1}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{item.title}</TableCell>
                                <TableCell>
                                  {item.variant_title ? (
                                    <Chip label={item.variant_title} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                                  ) : (
                                    <Typography variant="caption" color="text.secondary">-</Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.sku ? (
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{item.sku}</Typography>
                                  ) : (
                                    <Typography variant="caption" color="text.secondary">N/A</Typography>
                                  )}
                                </TableCell>
                                <TableCell sx={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1rem' }}>
                                  {item.total_quantity_sold}
                                </TableCell>
                                <TableCell sx={{ textAlign: 'center' }}>
                                  {item.order_count}
                                </TableCell>
                                <TableCell sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                                  INR {item.total_revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell sx={{ textAlign: 'center' }}>
                                  {item.current_stock !== null ? (
                                    <Chip
                                      label={item.current_stock}
                                      size="small"
                                      color={isOutOfStock ? 'error' : isLowStock ? 'warning' : 'default'}
                                      variant={isOutOfStock || isLowStock ? 'filled' : 'outlined'}
                                    />
                                  ) : (
                                    <Typography variant="caption" color="text.secondary">-</Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {isOutOfStock ? (
                                    <Chip label="Out of Stock" size="small" color="error" />
                                  ) : isLowStock ? (
                                    <Chip label="Low Stock" size="small" color="warning" />
                                  ) : item.current_stock !== null ? (
                                    <Chip label="In Stock" size="small" color="success" variant="outlined" />
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            )
                          })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                {/* Discounts Section */}
                <Box sx={{ mb: 4 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>Discounts & Price Rules</Typography>
                      <Typography variant="body2" color="text.secondary">{discounts.length} active discounts</Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Sync />}
                      onClick={() => handleSyncDiscounts(selectedStore!)}
                    >
                      Sync Discounts
                    </Button>
                  </Box>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Code</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Value</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Valid From</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Valid Until</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {discounts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                              <Typography color="text.secondary">No discounts synced. Click "Sync Discounts" to pull from Shopify.</Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          discounts.map(d => (
                            <TableRow key={d.id} hover>
                              <TableCell sx={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{d.code}</TableCell>
                              <TableCell><Chip label={d.type || 'discount'} size="small" variant="outlined" /></TableCell>
                              <TableCell sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                {d.value_type === 'percentage' ? `${d.value}%` : `INR ${Number(d.value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                              </TableCell>
                              <TableCell>{d.starts_at ? new Date(d.starts_at).toLocaleDateString() : '-'}</TableCell>
                              <TableCell>{d.ends_at ? new Date(d.ends_at).toLocaleDateString() : 'No expiry'}</TableCell>
                              <TableCell>
                                <Chip label={d.is_active ? 'Active' : 'Expired'} size="small" color={d.is_active ? 'success' : 'default'} variant="outlined" />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>

                {/* Draft Orders Section */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>Draft Orders</Typography>
                      <Typography variant="body2" color="text.secondary">{draftOrders.length} draft orders (quotations / proposals)</Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Sync />}
                      onClick={() => handleSyncDraftOrders(selectedStore!)}
                    >
                      Sync Draft Orders
                    </Button>
                  </Box>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Draft #</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Customer</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Items</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Total</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>ERP Doc</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {draftOrders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                              <Typography color="text.secondary">No draft orders synced. Click "Sync Draft Orders" to pull from Shopify.</Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          draftOrders.map(draft => (
                            <TableRow key={draft.id} hover>
                              <TableCell sx={{ fontWeight: 'bold' }}>#{draft.shopify_draft_order_id}</TableCell>
                              <TableCell>{draft.customer_name || '-'}</TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                  {(draft.line_items || []).length > 0 ? (
                                    draft.line_items.map((item, idx) => (
                                      <Tooltip key={idx} title={`${item.title}${item.variant_title ? ` - ${item.variant_title}` : ''} | SKU: ${item.sku || 'N/A'} | Qty: ${item.quantity} | Price: ${item.price}`}>
                                        <Chip
                                          label={`${item.title.substring(0, 25)}${item.title.length > 25 ? '...' : ''} x${item.quantity}`}
                                          size="small"
                                          variant="outlined"
                                          sx={{ fontSize: '0.7rem' }}
                                        />
                                      </Tooltip>
                                    ))
                                  ) : (
                                    <Typography variant="caption" color="text.secondary">No items</Typography>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>INR {Number(draft.total_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell><Chip label={draft.status} size="small" color={draft.status === 'open' ? 'info' : draft.status === 'completed' ? 'success' : 'default'} /></TableCell>
                              <TableCell>
                                {draft.erp_document_number ? (
                                  <Chip label={draft.erp_document_number} size="small" color="primary" variant="outlined" />
                                ) : (
                                  <Typography variant="caption" color="text.secondary">Pending</Typography>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </TabPanel>

              <TabPanel value={tabValue} index={4}>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Job Type</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Started</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Duration</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Items</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Progress</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {syncJobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell sx={{ textTransform: 'capitalize' }}>{job.job_type.replace(/_/g, ' ')}</TableCell>
                          <TableCell>
                            <Chip
                              label={job.status}
                              size="small"
                              color={
                                job.status === 'completed' ? 'success' :
                                  job.status === 'failed' ? 'error' : 'info'
                              }
                            />
                          </TableCell>
                          <TableCell>{new Date(job.started_at).toLocaleString()}</TableCell>
                          <TableCell>{job.duration_seconds ? `${job.duration_seconds}s` : '-'}</TableCell>
                          <TableCell>{job.processed_items} / {job.total_items}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={job.total_items > 0 ? (job.processed_items / job.total_items) * 100 : 0}
                                sx={{ flexGrow: 1 }}
                              />
                              <Typography variant="caption">
                                {job.total_items > 0 ? Math.round((job.processed_items / job.total_items) * 100) : 0}%
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </TabPanel>

              <TabPanel value={tabValue} index={5}>
                <Typography variant="h6" gutterBottom>Store Settings</Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedStore.auto_sync_products}
                            onChange={(e) =>
                              setSelectedStore((prev) => prev ? { ...prev, auto_sync_products: e.target.checked } : prev)
                            }
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            Auto-sync Products
                            <Tooltip title="Automatically pulls new products from Shopify into your Master Data every sync interval.">
                              <Info sx={{ fontSize: 16, ml: 0.5, color: 'text.secondary', cursor: 'help' }} />
                            </Tooltip>
                          </Box>
                        }
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedStore.auto_sync_inventory}
                            onChange={(e) =>
                              setSelectedStore((prev) => prev ? { ...prev, auto_sync_inventory: e.target.checked } : prev)
                            }
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            Auto-sync Inventory
                            <Tooltip title="Automatically updates Shopify inventory counts whenever items are received or sold in the ERP.">
                              <Info sx={{ fontSize: 16, ml: 0.5, color: 'text.secondary', cursor: 'help' }} />
                            </Tooltip>
                          </Box>
                        }
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedStore.auto_sync_orders}
                            onChange={(e) =>
                              setSelectedStore((prev) => prev ? { ...prev, auto_sync_orders: e.target.checked } : prev)
                            }
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            Auto-sync Orders
                            <Tooltip title="Automatically pulls new customer orders from Shopify to process them in the ERP.">
                              <Info sx={{ fontSize: 16, ml: 0.5, color: 'text.secondary', cursor: 'help' }} />
                            </Tooltip>
                          </Box>
                        }
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Sync Interval (minutes)"
                      type="number"
                      value={selectedStore.sync_interval_minutes}
                      onChange={(e) =>
                        setSelectedStore((prev) => prev ? { ...prev, sync_interval_minutes: Number(e.target.value) || 0 } : prev)
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button variant="contained" onClick={() => void handleSaveStoreSettings()}>
                      Save Store Settings
                    </Button>
                  </Grid>
                </Grid>
              </TabPanel>
            </Paper>
          )}
        </>
      )}

      {/* Connect Store Dialog */}
      <Dialog open={openStoreDialog} onClose={() => setOpenStoreDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Connect Shopify Store</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            You'll need a Shopify Admin API access token with necessary scopes.
          </Alert>
          <TextField
            fullWidth
            label="Store Name"
            value={newStore.name}
            onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
            margin="normal"
            placeholder="My Shopify Store"
          />
          <TextField
            fullWidth
            label="Shop Domain"
            value={newStore.shop_domain}
            onChange={(e) => setNewStore({ ...newStore, shop_domain: e.target.value })}
            margin="normal"
            placeholder="mystore.myshopify.com"
          />
          <TextField
            fullWidth
            label="Access Token"
            value={newStore.access_token}
            onChange={(e) => setNewStore({ ...newStore, access_token: e.target.value })}
            margin="normal"
            type="password"
          />
          <TextField
            fullWidth
            label="Webhook Secret (Optional)"
            value={newStore.webhook_secret}
            onChange={(e) => setNewStore({ ...newStore, webhook_secret: e.target.value })}
            margin="normal"
            type="password"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenStoreDialog(false)}>Cancel</Button>
          <Button onClick={() => void handleCreateStore()} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
