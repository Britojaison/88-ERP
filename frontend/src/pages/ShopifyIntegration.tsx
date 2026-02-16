import { useState, useEffect, useMemo } from 'react'
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
} from '@mui/icons-material'
import { shopifyService, ShopifyStore, ShopifyProduct, ShopifySyncJob } from '../services/shopify.service'
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
  const [syncJobs, setSyncJobs] = useState<ShopifySyncJob[]>([])
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [tabValue, setTabValue] = useState(0)
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

  useEffect(() => {
    loadStores()
  }, [])

  useEffect(() => {
    if (selectedStore) {
      loadStoreData(selectedStore.id)

      // Set up polling if a sync is running
      const interval = setInterval(() => {
        const isRunning = syncJobs.some(j => j.status === 'running')
        if (isRunning) {
          loadStoreData(selectedStore.id)
        }
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [selectedStore, syncJobs])

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

  const loadStoreData = async (storeId: string) => {
    try {
      const [productsData, jobsData, statusData] = await Promise.all([
        shopifyService.listProducts({ store: storeId }),
        shopifyService.listSyncJobs(storeId),
        shopifyService.getSyncStatus(storeId),
      ])
      setProducts(productsData)
      setSyncJobs(jobsData)
      setSyncStatus(statusData)
    } catch (error: any) {
      console.error('Failed to load store data:', error)
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
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to connect store',
        severity: 'error'
      })
    } finally {
      setLoading(false)
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
      loadStores()
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: 'Connection test failed',
        severity: 'error'
      })
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
      // Reload data after a delay
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
            Connect your first Shopify store to start syncing products and inventory
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

          {selectedStore && syncStatus && (
            <Paper sx={{ mb: 3 }}>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                <Tab label="Overview" />
                <Tab label="Products" />
                <Tab label="Sync Jobs" />
                <Tab label="Settings" />
              </Tabs>

              <TabPanel value={tabValue} index={0}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
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
                          Variants found in Shopify
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Card sx={{ height: '100%', borderTop: '4px solid', borderColor: 'success.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                            Synced Products
                          </Typography>
                          <CheckCircle color="success" sx={{ opacity: 0.5 }} />
                        </Box>
                        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, color: 'success.main' }}>
                          {syncStatus?.products?.synced || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Successfully mapped to ERP SKUs
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Card sx={{ height: '100%', borderTop: '4px solid', borderColor: 'warning.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                            Pending Mapping
                          </Typography>
                          <Info color="warning" sx={{ opacity: 0.5 }} />
                        </Box>
                        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, color: 'warning.main' }}>
                          {syncStatus?.products?.pending || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Waiting for ERP SKU association
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
                    <Grid item xs={12} sm={6} md={3}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Sync />}
                        onClick={() => handleSyncProducts(selectedStore)}
                      >
                        Sync Products
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Inventory />}
                        onClick={() => handleSyncInventory(selectedStore)}
                      >
                        Sync Inventory
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Webhook />}
                        onClick={() => handleSetupWebhooks(selectedStore)}
                      >
                        Setup Webhooks
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Settings />}
                        onClick={() => setTabValue(3)}
                      >
                        Settings
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
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
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
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
                            <Box sx={{ color: 'text.secondary' }}>
                              <FilterList sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
                              <Typography variant="body1">No products match your filters</Typography>
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
                                    sx={{ width: 40, height: 40, borderRadius: 1, mr: 2, objectFit: 'cover', border: '1px solid', borderColor: 'divider' }}
                                  />
                                ) : (
                                  <Box sx={{ width: 40, height: 40, borderRadius: 1, mr: 2, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid', borderColor: 'divider' }}>
                                    <Inventory sx={{ fontSize: 20, color: 'text.secondary', opacity: 0.5 }} />
                                  </Box>
                                )}
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                    {product.shopify_title}
                                  </Typography>
                                  {product.shopify_product_id && (
                                    <Typography variant="caption" color="text.secondary">
                                      ID: {product.shopify_product_id}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{product.shopify_sku || '-'}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {product.shopify_barcode || ''}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Chip label={product.shopify_product_type || 'Uncategorized'} size="small" sx={{ mb: 0.5, maxWidth: 'fit-content' }} />
                                <Typography variant="caption" color="text.secondary">
                                  {product.shopify_vendor || 'No Vendor'}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                ₹{product.shopify_price}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={product.shopify_inventory_quantity}
                                size="small"
                                color={product.shopify_inventory_quantity > 0 ? 'default' : 'error'}
                                variant={product.shopify_inventory_quantity > 0 ? 'outlined' : 'filled'}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Chip
                                  label={product.sync_status}
                                  size="small"
                                  color={
                                    product.sync_status === 'synced' ? 'success' :
                                      product.sync_status === 'error' ? 'error' : 'warning'
                                  }
                                  sx={{ textTransform: 'capitalize' }}
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
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Job Type</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Started</TableCell>
                        <TableCell>Duration</TableCell>
                        <TableCell>Items</TableCell>
                        <TableCell>Progress</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {syncJobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell>{job.job_type}</TableCell>
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

              <TabPanel value={tabValue} index={3}>
                <Typography variant="h6" gutterBottom>
                  Store Settings
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedStore.auto_sync_products}
                          onChange={(e) =>
                            setSelectedStore((prev) =>
                              prev
                                ? { ...prev, auto_sync_products: e.target.checked }
                                : prev,
                            )
                          }
                        />
                      }
                      label="Auto-sync Products"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedStore.auto_sync_inventory}
                          onChange={(e) =>
                            setSelectedStore((prev) =>
                              prev
                                ? { ...prev, auto_sync_inventory: e.target.checked }
                                : prev,
                            )
                          }
                        />
                      }
                      label="Auto-sync Inventory"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedStore.auto_sync_orders}
                          onChange={(e) =>
                            setSelectedStore((prev) =>
                              prev
                                ? { ...prev, auto_sync_orders: e.target.checked }
                                : prev,
                            )
                          }
                        />
                      }
                      label="Auto-sync Orders"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Sync Interval (minutes)"
                      type="number"
                      value={selectedStore.sync_interval_minutes}
                      onChange={(e) =>
                        setSelectedStore((prev) =>
                          prev
                            ? { ...prev, sync_interval_minutes: Number(e.target.value) || 0 }
                            : prev,
                        )
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
            You'll need a Shopify Admin API access token. Get it from your Shopify admin panel under Apps → Develop apps.
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
            helperText="Your Shopify store domain"
          />
          <TextField
            fullWidth
            label="Access Token"
            value={newStore.access_token}
            onChange={(e) => setNewStore({ ...newStore, access_token: e.target.value })}
            margin="normal"
            type="password"
            helperText="Admin API access token"
          />
          <TextField
            fullWidth
            label="Webhook Secret (Optional)"
            value={newStore.webhook_secret}
            onChange={(e) => setNewStore({ ...newStore, webhook_secret: e.target.value })}
            margin="normal"
            type="password"
            helperText="For webhook verification"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={newStore.auto_sync_products}
                onChange={(e) => setNewStore({ ...newStore, auto_sync_products: e.target.checked })}
              />
            }
            label="Auto-sync Products"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={newStore.auto_sync_inventory}
                onChange={(e) => setNewStore({ ...newStore, auto_sync_inventory: e.target.checked })}
              />
            }
            label="Auto-sync Inventory"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenStoreDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateStore} variant="contained" disabled={loading}>
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
