import { useState, useEffect } from 'react'
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
} from '@mui/icons-material'
import { shopifyService, ShopifyStore, ShopifyProduct, ShopifySyncJob } from '../services/shopify.service'

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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
            Shopify Integration
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Connect and sync your Shopify stores with the ERP
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadStores}
            disabled={loadingStores}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setOpenStoreDialog(true)}
            sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            Connect Store
          </Button>
        </Box>
      </Box>

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
            sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
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
                    <Card>
                      <CardContent>
                        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                          {syncStatus.products.total}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Products
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: 'success.main' }}>
                          {syncStatus.products.synced}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Synced Products
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: 'warning.main' }}>
                          {syncStatus.products.pending}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Pending Mapping
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
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Shopify Title</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell>Price</TableCell>
                        <TableCell>Inventory</TableCell>
                        <TableCell>ERP SKU</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>{product.shopify_title}</TableCell>
                          <TableCell>{product.shopify_sku}</TableCell>
                          <TableCell>${product.shopify_price}</TableCell>
                          <TableCell>{product.shopify_inventory_quantity}</TableCell>
                          <TableCell>{product.erp_sku_code || '-'}</TableCell>
                          <TableCell>
                            <Chip
                              label={product.sync_status}
                              size="small"
                              color={
                                product.sync_status === 'synced' ? 'success' :
                                product.sync_status === 'error' ? 'error' : 'warning'
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
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
                      control={<Checkbox checked={selectedStore.auto_sync_products} />}
                      label="Auto-sync Products"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={<Checkbox checked={selectedStore.auto_sync_inventory} />}
                      label="Auto-sync Inventory"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={<Checkbox checked={selectedStore.auto_sync_orders} />}
                      label="Auto-sync Orders"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Sync Interval (minutes)"
                      type="number"
                      value={selectedStore.sync_interval_minutes}
                    />
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
