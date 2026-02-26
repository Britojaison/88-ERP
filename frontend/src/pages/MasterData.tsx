import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Tooltip,
} from '@mui/material'
import { Add, CheckCircle, Cancel } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, type BusinessUnit, type Company, type Location, type Product, type SKU, type Fabric } from '../services/mdm.service'

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

export default function MasterData() {
  const [tabValue, setTabValue] = useState(0)
  const [products, setProducts] = useState<Product[]>([])
  const [skus, setSkus] = useState<SKU[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  // @ts-ignore: TS6133
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [fabrics, setFabrics] = useState<Fabric[]>([])
  const [fabricFilter, setFabricFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [openProductDialog, setOpenProductDialog] = useState(false)
  // @ts-ignore: TS6133
  const [openSkuDialog, setOpenSkuDialog] = useState(false)
  // @ts-ignore: TS6133
  const [openCompanyDialog, setOpenCompanyDialog] = useState(false)
  // @ts-ignore: TS6133
  const [openLocationDialog, setOpenLocationDialog] = useState(false)
  const [openVariantsDialog, setOpenVariantsDialog] = useState(false)
  const [openFabricDialog, setOpenFabricDialog] = useState(false)
  const [openRejectDialog, setOpenRejectDialog] = useState(false)
  const [openStoreDialog, setOpenStoreDialog] = useState(false)
  const [openWarehouseDialog, setOpenWarehouseDialog] = useState(false)
  const [rejectFabricId, setRejectFabricId] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [variantForm, setVariantForm] = useState({
    sizes: [] as string[],
    selling_price: '',
    mrp: '',
  })
  const [productForm, setProductForm] = useState({
    code: '',
    name: '',
    description: '',
  })
  const [fabricForm, setFabricForm] = useState({
    name: '',
    color: '',
    fabric_type: '',
    total_meters: '',
    cost_per_meter: '',
    dispatch_unit: '',
    notes: '',
  })
  const [storeForm, setStoreForm] = useState({
    code: '',
    name: '',
    email: '',
    opening_date: '',
    business_unit: '',
  })
  const [warehouseForm, setWarehouseForm] = useState({
    code: '',
    name: '',
    email: '',
    opening_date: '',
    business_unit: '',
  })
  const [fabricPhotoFile, setFabricPhotoFile] = useState<File | null>(null)
  const [fabricPhotoPreview, setFabricPhotoPreview] = useState('')
  // @ts-ignore: TS6133
  const [skuForm, setSkuForm] = useState({
    code: '',
    name: '',
    product: '',
    base_price: '',
    cost_price: '',
    weight: '',
    size: '',
    is_serialized: false,
    is_batch_tracked: false,
  })
  // @ts-ignore: TS6133
  const [companyForm, setCompanyForm] = useState({
    code: '',
    name: '',
    legal_name: '',
    tax_id: '',
    currency: 'INR',
  })
  // @ts-ignore: TS6133
  const [locationForm, setLocationForm] = useState({
    code: '',
    name: '',
    location_type: 'warehouse' as Location['location_type'],
    business_unit: '',
    is_inventory_location: true,
  })
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'info' },
  )

  const loadData = async () => {
    try {
      const [productData, skuData, companyData, businessUnitData, locationData, fabricData] = await Promise.all([
        mdmService.getProducts(),
        mdmService.getSKUs(),
        mdmService.getCompanies(),
        mdmService.getBusinessUnits(),
        mdmService.getLocations(),
        mdmService.getFabrics(),
      ])
      setProducts(productData)
      setSkus(skuData)
      setCompanies(companyData)
      setBusinessUnits(businessUnitData)
      setLocations(locationData)
      setFabrics(fabricData)
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load master data.', severity: 'error' })
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleAddNew = () => {
    if (tabValue === 0) {
      setProductForm({ code: '', name: '', description: '' })
      setVariantForm({ sizes: [], selling_price: '', mrp: '' })
      setSkuForm({
        code: '',
        name: '',
        product: '',
        base_price: '',
        cost_price: '',
        weight: '',
        size: '',
        is_serialized: false,
        is_batch_tracked: false,
      })
      setOpenProductDialog(true)
      return
    } else if (tabValue === 2) {
      setFabricForm({ name: '', color: '', fabric_type: '', total_meters: '', cost_per_meter: '', dispatch_unit: '', notes: '' })
      setFabricPhotoFile(null)
      setFabricPhotoPreview('')
      setOpenFabricDialog(true)
      return
    }
    if (tabValue === 1) {
      if (products.length === 0) {
        setSnackbar({
          open: true,
          message: 'Create at least one product first, then add SKUs.',
          severity: 'info',
        })
        return
      }
      setSkuForm({
        code: '',
        name: '',
        product: '',
        base_price: '',
        cost_price: '',
        weight: '',
        size: '',
        is_serialized: false,
        is_batch_tracked: false,
      })
      setOpenSkuDialog(true)
      return
    }
    if (tabValue === 3) {
      setCompanyForm({
        code: '',
        name: '',
        legal_name: '',
        tax_id: '',
        currency: 'INR',
      })
      setOpenCompanyDialog(true)
      return
    }
    if (tabValue === 4) {
      setLocationForm({
        code: '',
        name: '',
        location_type: 'warehouse' as Location['location_type'],
        business_unit: '',
        is_inventory_location: true,
      })
      setOpenLocationDialog(true)
      return
    }
    if (tabValue === 5) {
      setWarehouseForm({
        code: '',
        name: '',
        email: '',
        opening_date: new Date().toISOString().split('T')[0],
        business_unit: '',
      })
      setOpenWarehouseDialog(true)
      return
    }
    if (tabValue === 6) {
      setStoreForm({
        code: '',
        name: '',
        email: '',
        opening_date: new Date().toISOString().split('T')[0],
        business_unit: '',
      })
      setOpenStoreDialog(true)
      return
    }
    setSnackbar({
      open: true,
      message: 'Quick create is enabled for Products. Configure other entities via API/metadata setup.',
      severity: 'info',
    })
  }

  const handleCreateProduct = async () => {
    if (!productForm.code || !productForm.name) {
      setSnackbar({ open: true, message: 'Code and name are required.', severity: 'error' })
      return
    }

    const hasPricing = !!(variantForm.selling_price || variantForm.mrp);
    if (hasPricing && (!variantForm.selling_price || !variantForm.mrp)) {
      setSnackbar({ open: true, message: 'Both Selling price and MRP are required if pricing is provided.', severity: 'error' })
      return
    }

    try {
      const product = await mdmService.createProduct(productForm)

      if (variantForm.sizes.length === 0 && variantForm.selling_price && variantForm.mrp) {
        let finalSkuCode = skuForm.code;
        if (!finalSkuCode) {
          const result = await mdmService.getNextSkuCode(product.name);
          finalSkuCode = result.sku_code;
        }
        const payload = {
          ...skuForm,
          product: product.id,
          size: undefined,
          code: finalSkuCode,
          name: product.name,
          base_price: variantForm.selling_price.toString(),
          cost_price: variantForm.mrp.toString(),
        }
        console.log('Sending Initial SKU Payload:', payload);
        await mdmService.createSKU(payload as any)
      } else if (variantForm.sizes.length > 0 && variantForm.selling_price && variantForm.mrp) {
        await mdmService.createProductVariants(product.id, variantForm)
      }

      setProductForm({ code: '', name: '', description: '' })
      setVariantForm({ sizes: [], selling_price: '', mrp: '' })
      setSkuForm({
        code: '',
        name: '',
        product: '',
        base_price: '',
        cost_price: '',
        weight: '',
        size: '',
        is_serialized: false,
        is_batch_tracked: false,
      })

      setSnackbar({ open: true, message: 'Product created successfully.', severity: 'success' })

      // Small delay to ensure database transactions are committed before fetching
      setTimeout(() => {
        void loadData();
      }, 500);

    } catch (error: any) {
      console.error('Create product error:', error)
      if (error.response?.data) {
        console.error('Error Response Data:', JSON.stringify(error.response.data, null, 2));
      }
      const errorMsg = error?.response?.data?.error || error?.response?.data?.detail || JSON.stringify(error?.response?.data) || 'Unknown error'
      setSnackbar({ open: true, message: `Failed to create product/SKU: ${errorMsg}`, severity: 'error' })
    }
  }

  const handleCreateVariants = async () => {
    if (!selectedProduct) return

    if (variantForm.sizes.length === 0) {
      setSnackbar({ open: true, message: 'Please select at least one size.', severity: 'error' })
      return
    }

    if (!variantForm.selling_price || !variantForm.mrp) {
      setSnackbar({ open: true, message: 'Selling price and MRP are required.', severity: 'error' })
      return
    }

    try {
      const result = await mdmService.createProductVariants(selectedProduct.id, variantForm)
      setOpenVariantsDialog(false)
      setVariantForm({ sizes: [], selling_price: '', mrp: '' })
      setSelectedProduct(null)

      // Small delay to ensure database transactions are committed before fetching
      setTimeout(() => {
        void loadData();
      }, 500);

      setSnackbar({
        open: true,
        message: `Created ${result.created} SKUs. ${result.skipped > 0 ? `Skipped ${result.skipped} existing sizes.` : ''}`,
        severity: 'success'
      })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to create variants.', severity: 'error' })
    }
  }

  const handleCreateFabric = async () => {
    if (!fabricForm.name.trim()) {
      setSnackbar({ open: true, message: 'Fabric name is required.', severity: 'error' })
      return
    }
    try {
      await mdmService.createFabric(fabricForm, fabricPhotoFile || undefined)
      setOpenFabricDialog(false)
      setFabricForm({ name: '', color: '', fabric_type: '', total_meters: '', cost_per_meter: '', dispatch_unit: '', notes: '' })
      setFabricPhotoFile(null)
      setFabricPhotoPreview('')
      setTimeout(() => { void loadData() }, 500)
      setSnackbar({ open: true, message: 'Fabric created successfully with auto-generated SKU!', severity: 'success' })
    } catch (error: any) {
      setSnackbar({ open: true, message: error?.response?.data?.detail || 'Failed to create fabric.', severity: 'error' })
    }
  }

  const handleApproveFabric = async (id: string) => {
    try {
      await mdmService.approveFabric(id)
      setTimeout(() => { void loadData() }, 300)
      setSnackbar({ open: true, message: 'Fabric approved!', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to approve fabric.', severity: 'error' })
    }
  }

  const handleRejectFabric = async () => {
    if (!rejectFabricId) return
    try {
      await mdmService.rejectFabric(rejectFabricId, rejectReason)
      setOpenRejectDialog(false)
      setRejectReason('')
      setRejectFabricId('')
      setTimeout(() => { void loadData() }, 300)
      setSnackbar({ open: true, message: 'Fabric rejected.', severity: 'info' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to reject fabric.', severity: 'error' })
    }
  }

  const handleCreateLocation = async () => {
    if (!locationForm.code || !locationForm.name) {
      setSnackbar({ open: true, message: 'Location Code and Name are required.', severity: 'error' })
      return
    }
    // ensure business_unit is passed (even if empty, though API might require it. We will send existing bu or null)
    try {
      await mdmService.createLocation({
        ...locationForm,
        business_unit: locationForm.business_unit || (businessUnits.length > 0 ? businessUnits[0].id : '')
      })
      setOpenLocationDialog(false)
      setTimeout(() => { void loadData() }, 300)
      setSnackbar({ open: true, message: 'Location created successfully!', severity: 'success' })
    } catch (error: any) {
      setSnackbar({ open: true, message: error?.response?.data?.detail || 'Failed to create location.', severity: 'error' })
    }
  }

  const handleCreateWarehouse = async () => {
    if (!warehouseForm.code || !warehouseForm.name) {
      setSnackbar({ open: true, message: 'Warehouse Code and Name are required.', severity: 'error' })
      return
    }
    try {
      await mdmService.createLocation({
        code: warehouseForm.code,
        name: warehouseForm.name,
        email: warehouseForm.email,
        opening_date: warehouseForm.opening_date,
        location_type: 'warehouse',
        business_unit: warehouseForm.business_unit || (businessUnits.length > 0 ? businessUnits[0].id : ''),
        is_inventory_location: true,
      })
      setOpenWarehouseDialog(false)
      setTimeout(() => { void loadData() }, 300)
      setSnackbar({ open: true, message: 'Warehouse created successfully!', severity: 'success' })
    } catch (error: any) {
      setSnackbar({ open: true, message: error?.response?.data?.detail || 'Failed to create warehouse.', severity: 'error' })
    }
  }

  const handleCreateStore = async () => {
    if (!storeForm.code || !storeForm.name) {
      setSnackbar({ open: true, message: 'Store Code and Name are required.', severity: 'error' })
      return
    }
    try {
      await mdmService.createLocation({
        code: storeForm.code,
        name: storeForm.name,
        email: storeForm.email,
        opening_date: storeForm.opening_date,
        location_type: 'store',
        business_unit: storeForm.business_unit || (businessUnits.length > 0 ? businessUnits[0].id : ''),
        is_inventory_location: true,
      })
      setOpenStoreDialog(false)
      setTimeout(() => { void loadData() }, 300)
      setSnackbar({ open: true, message: 'Store created successfully!', severity: 'success' })
    } catch (error: any) {
      setSnackbar({ open: true, message: error?.response?.data?.detail || 'Failed to create store.', severity: 'error' })
    }
  }

  const filteredFabrics = fabricFilter === 'all' ? fabrics : fabrics.filter(f => f.approval_status === fabricFilter)
  const filteredWarehouses = locations.filter(loc => loc.location_type === 'warehouse')
  const filteredStores = locations.filter(loc => loc.location_type === 'store')

  return (
    <Box>
      <PageHeader
        title="Master Data Management"
        subtitle="Manage products, SKUs, fabrics, and business entities."
        actions={
          tabValue !== 1 ? (
            <Button variant="contained" startIcon={<Add />} onClick={handleAddNew}>
              Add New
            </Button>
          ) : null
        }
      />

      <Paper>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Products" />
          <Tab label="SKUs" />
          <Tab label="Fabrics" />
          <Tab label="Companies" />
          <Tab label="Locations" />
          <Tab label="Warehouses" />
          <Tab label="Stores" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No products found. Click "Add New" to create your first product.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>{product.code}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.description || '-'}</TableCell>
                      <TableCell>{product.status}</TableCell>
                      <TableCell>{new Date(product.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setSelectedProduct(product)
                            setOpenVariantsDialog(true)
                          }}
                        >
                          Create Variants
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>SKU Code</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Attributes</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Stock</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {skus.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No SKUs found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  skus.map((sku) => (
                    <TableRow key={sku.id}>
                      <TableCell>{sku.code}</TableCell>
                      <TableCell>{sku.product_name || sku.product_code || sku.product}</TableCell>
                      <TableCell>{sku.style_code || '-'}</TableCell>
                      <TableCell>{sku.status}</TableCell>
                      <TableCell>{sku.base_price}</TableCell>
                      <TableCell>{new Date(sku.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Fabrics Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
            {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
              <Chip
                key={f}
                label={f === 'all' ? `All (${fabrics.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${fabrics.filter(fb => fb.approval_status === f).length})`}
                onClick={() => setFabricFilter(f)}
                color={fabricFilter === f ? (f === 'approved' ? 'success' : f === 'rejected' ? 'error' : f === 'pending' ? 'warning' : 'primary') : 'default'}
                variant={fabricFilter === f ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Code / SKU</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Color</TableCell>
                  <TableCell>Meters (Total / Used / Left)</TableCell>
                  <TableCell>₹/m</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Approval</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredFabrics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No fabrics found. Click "Add New" to create your first fabric.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFabrics.map((fabric) => (
                    <TableRow key={fabric.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{fabric.code}</Typography>
                        {fabric.sku_code && <Typography variant="caption" color="text.secondary">SKU: {fabric.sku_code}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {fabric.photo_url && (
                            <Box component="img" src={fabric.photo_url} sx={{ width: 32, height: 32, borderRadius: 0.5, objectFit: 'cover' }} />
                          )}
                          {fabric.name}
                        </Box>
                      </TableCell>
                      <TableCell>{fabric.fabric_type || '-'}</TableCell>
                      <TableCell>{fabric.color || '-'}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {fabric.total_meters} / {fabric.used_meters} / <strong>{fabric.remaining_meters}</strong>
                        </Typography>
                      </TableCell>
                      <TableCell>₹{fabric.cost_per_meter}</TableCell>
                      <TableCell>
                        {fabric.dispatch_unit ? (
                          <Chip label={`Unit ${fabric.dispatch_unit}`} size="small" color="info" variant="outlined" />
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={fabric.approval_status}
                          size="small"
                          color={fabric.approval_status === 'approved' ? 'success' : fabric.approval_status === 'rejected' ? 'error' : 'warning'}
                        />
                        {fabric.rejection_reason && (
                          <Typography variant="caption" display="block" color="error.main">{fabric.rejection_reason}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {fabric.approval_status === 'pending' && (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Approve">
                              <IconButton size="small" color="success" onClick={() => void handleApproveFabric(fabric.id)}>
                                <CheckCircle fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <IconButton size="small" color="error" onClick={() => { setRejectFabricId(fabric.id); setRejectReason(''); setOpenRejectDialog(true) }}>
                                <Cancel fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Company Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {companies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No companies found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>{company.name}</TableCell>
                      <TableCell>{company.currency}</TableCell>
                      <TableCell>{company.status}</TableCell>
                      <TableCell>{new Date(company.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Location Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {locations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No locations found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  locations.map((location) => (
                    <TableRow key={location.id}>
                      <TableCell>{location.code}</TableCell>
                      <TableCell>{location.name}</TableCell>
                      <TableCell>{location.location_type}</TableCell>
                      <TableCell>{location.status}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Warehouse Code</TableCell>
                  <TableCell>Warehouse Name</TableCell>
                  <TableCell>Contact Email</TableCell>
                  <TableCell>Opening Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredWarehouses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No warehouses found. Click "Add New" to create your first warehouse.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWarehouses.map((wh) => (
                    <TableRow key={wh.id}>
                      <TableCell>{wh.code}</TableCell>
                      <TableCell>{wh.name}</TableCell>
                      <TableCell>{wh.email || '-'}</TableCell>
                      <TableCell>{wh.opening_date ? new Date(wh.opening_date).toLocaleDateString() : '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={6}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Store Code</TableCell>
                  <TableCell>Store Name</TableCell>
                  <TableCell>Store Email</TableCell>
                  <TableCell>Opening Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredStores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No stores found. Click "Add New" to create your first store.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell>{store.code}</TableCell>
                      <TableCell>{store.name}</TableCell>
                      <TableCell>{store.email || '-'}</TableCell>
                      <TableCell>{store.opening_date ? new Date(store.opening_date).toLocaleDateString() : '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Paper>

      {/* Product Dialog */}
      <Dialog open={openProductDialog} onClose={() => setOpenProductDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Product</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Product Name"
            value={productForm.name}
            onChange={(e) => {
              const name = e.target.value;
              setProductForm((prev) => {
                // Auto-suggest code from name if code is empty or was auto-generated
                const baseCode = name
                  .toUpperCase()
                  .replace(/[^A-Z0-9\s]/g, '')
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .join('-');

                // Add a random 3-digit number for uniqueness
                const randomSuffix = Math.floor(100 + Math.random() * 900);
                const suggestedCode = baseCode ? `${baseCode}-${randomSuffix}` : '';

                return {
                  ...prev,
                  name,
                  // Only update code if it's empty or matches a previous auto-suggestion pattern
                  code: prev.code === '' || /^MMW-\d{3}-[A-Z0-9]+$/.test(prev.code.toUpperCase()) || /^[a-z0-9-]+-\d{3}$/.test(prev.code)
                    ? suggestedCode
                    : prev.code
                };
              });

              if (name.trim()) {
                mdmService.getNextSkuCode(name, skuForm.size || undefined).then((result) => {
                  setSkuForm((prev) => {
                    if (prev.code === '' || prev.code.startsWith('MMW-')) {
                      return { ...prev, code: result.sku_code };
                    }
                    return prev;
                  });
                }).catch(() => { });
              }
            }}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Product Code"
            value={productForm.code}
            onChange={(e) => setProductForm((prev) => ({ ...prev, code: e.target.value }))}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Description"
            value={productForm.description}
            onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
            multiline
            rows={2}
          />

          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              SKU Details (Optional)
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="SKU Code"
                  value={skuForm.code}
                  onChange={(e) => setSkuForm((prev) => ({ ...prev, code: e.target.value }))}
                  helperText="Auto-generated (editable)"
                  size="small"
                />
              </Grid>
            </Grid>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Create Variants (Select Sizes):
              </Typography>
              <Grid container spacing={1}>
                {['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL', 'Free Size'].map((size) => (
                  <Grid item key={size}>
                    <Chip
                      label={size}
                      onClick={() => {
                        setVariantForm(prev => {
                          const isSelected = prev.sizes.includes(size);
                          return {
                            ...prev,
                            sizes: isSelected
                              ? prev.sizes.filter(s => s !== size)
                              : [...prev.sizes, size]
                          };
                        });
                      }}
                      color={variantForm.sizes.includes(size) ? "primary" : "default"}
                      variant={variantForm.sizes.includes(size) ? "filled" : "outlined"}
                      sx={{
                        borderRadius: 1,
                        minWidth: '60px',
                        height: '40px',
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: variantForm.sizes.includes(size) ? 'primary.dark' : 'action.hover'
                        }
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Selling Price"
                  value={variantForm.selling_price}
                  onChange={(e) => setVariantForm((prev) => ({ ...prev, selling_price: e.target.value }))}
                  type="number"
                  size="small"
                  required={variantForm.sizes.length > 0}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="MRP"
                  value={variantForm.mrp}
                  onChange={(e) => setVariantForm((prev) => ({ ...prev, mrp: e.target.value }))}
                  type="number"
                  size="small"
                  required={variantForm.sizes.length > 0}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenProductDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateProduct()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Variants Dialog */}
      <Dialog open={openVariantsDialog} onClose={() => setOpenVariantsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Product Variants</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Product: {selectedProduct?.name}
          </Typography>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Select Sizes:
            </Typography>
            <Grid container spacing={1}>
              {['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL', 'Free Size'].map((size) => (
                <Grid item key={size}>
                  <Chip
                    label={size}
                    onClick={() => {
                      setVariantForm(prev => {
                        const isSelected = prev.sizes.includes(size);
                        return {
                          ...prev,
                          sizes: isSelected
                            ? prev.sizes.filter(s => s !== size)
                            : [...prev.sizes, size]
                        };
                      });
                    }}
                    color={variantForm.sizes.includes(size) ? "primary" : "default"}
                    variant={variantForm.sizes.includes(size) ? "filled" : "outlined"}
                    sx={{
                      borderRadius: 1,
                      minWidth: '60px',
                      height: '40px',
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: variantForm.sizes.includes(size) ? 'primary.dark' : 'action.hover'
                      }
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Selling Price"
                value={variantForm.selling_price}
                onChange={(e) => setVariantForm((prev) => ({ ...prev, selling_price: e.target.value }))}
                type="number"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="MRP"
                value={variantForm.mrp}
                onChange={(e) => setVariantForm((prev) => ({ ...prev, mrp: e.target.value }))}
                type="number"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenVariantsDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateVariants()}>
            Create Variants
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Fabric Dialog */}
      <Dialog open={openFabricDialog} onClose={() => setOpenFabricDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Fabric</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth margin="normal" label="Fabric Name" required
            value={fabricForm.name}
            onChange={(e) => setFabricForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Royal Blue Cotton"
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth margin="normal" label="Color"
                value={fabricForm.color}
                onChange={(e) => setFabricForm(prev => ({ ...prev, color: e.target.value }))}
                placeholder="e.g. Royal Blue"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Fabric Type</InputLabel>
                <Select
                  value={fabricForm.fabric_type}
                  label="Fabric Type"
                  onChange={(e) => setFabricForm(prev => ({ ...prev, fabric_type: e.target.value }))}
                >
                  <MenuItem value="Cotton">Cotton</MenuItem>
                  <MenuItem value="Silk">Silk</MenuItem>
                  <MenuItem value="Polyester">Polyester</MenuItem>
                  <MenuItem value="Linen">Linen</MenuItem>
                  <MenuItem value="Rayon">Rayon</MenuItem>
                  <MenuItem value="Denim">Denim</MenuItem>
                  <MenuItem value="Wool">Wool</MenuItem>
                  <MenuItem value="Blend">Blend</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth margin="normal" label="Total Meters" type="number"
                value={fabricForm.total_meters}
                onChange={(e) => setFabricForm(prev => ({ ...prev, total_meters: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth margin="normal" label="Cost per Meter (₹)" type="number"
                value={fabricForm.cost_per_meter}
                onChange={(e) => setFabricForm(prev => ({ ...prev, cost_per_meter: e.target.value }))}
              />
            </Grid>
          </Grid>
          <FormControl fullWidth margin="normal">
            <InputLabel>Dispatch Unit</InputLabel>
            <Select
              value={fabricForm.dispatch_unit}
              label="Dispatch Unit"
              onChange={(e) => setFabricForm(prev => ({ ...prev, dispatch_unit: e.target.value }))}
            >
              <MenuItem value="">None</MenuItem>
              <MenuItem value="A">Unit A</MenuItem>
              <MenuItem value="B">Unit B</MenuItem>
              <MenuItem value="C">Unit C</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Fabric Photo</Typography>
            <Button variant="outlined" component="label" size="small">
              {fabricPhotoFile ? 'Change Photo' : 'Upload Photo'}
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setFabricPhotoFile(file)
                    setFabricPhotoPreview(URL.createObjectURL(file))
                  }
                }}
              />
            </Button>
            {fabricPhotoPreview && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box component="img" src={fabricPhotoPreview} sx={{ width: 80, height: 80, borderRadius: 1, objectFit: 'cover' }} />
                <Typography variant="caption" color="text.secondary">{fabricPhotoFile?.name}</Typography>
              </Box>
            )}
          </Box>
          <TextField
            fullWidth margin="normal" label="Notes (optional)" multiline rows={2}
            value={fabricForm.notes}
            onChange={(e) => setFabricForm(prev => ({ ...prev, notes: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenFabricDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateFabric()}>Create Fabric</Button>
        </DialogActions>
      </Dialog >

      {/* Reject Fabric Dialog */}
      < Dialog open={openRejectDialog} onClose={() => setOpenRejectDialog(false)} maxWidth="xs" fullWidth >
        <DialogTitle>Reject Fabric</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please provide a reason for rejecting this fabric:
          </Typography>
          <TextField
            fullWidth multiline rows={3} label="Rejection Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRejectDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => void handleRejectFabric()}>Reject</Button>
        </DialogActions>
      </Dialog >

      {/* Create Location Dialog */}
      < Dialog open={openLocationDialog} onClose={() => setOpenLocationDialog(false)} maxWidth="sm" fullWidth >
        <DialogTitle>Create Location</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth margin="normal" label="Location Code" required
            value={locationForm.code}
            onChange={(e) => setLocationForm(prev => ({ ...prev, code: e.target.value }))}
            placeholder="e.g. STORE-01"
          />
          <TextField
            fullWidth margin="normal" label="Name" required
            value={locationForm.name}
            onChange={(e) => setLocationForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. MG Road Branch"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Location Type</InputLabel>
            <Select
              value={locationForm.location_type}
              label="Location Type"
              onChange={(e) => setLocationForm(prev => ({ ...prev, location_type: e.target.value as any }))}
            >
              <MenuItem value="warehouse">Warehouse</MenuItem>
              <MenuItem value="store">Retail Store</MenuItem>
              <MenuItem value="factory">Factory</MenuItem>
              <MenuItem value="office">Office</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Business Unit</InputLabel>
            <Select
              value={locationForm.business_unit}
              label="Business Unit"
              onChange={(e) => setLocationForm(prev => ({ ...prev, business_unit: e.target.value }))}
            >
              <MenuItem value="" disabled>Select Business Unit</MenuItem>
              {businessUnits.map((bu) => (
                <MenuItem key={bu.id} value={bu.id}>{bu.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenLocationDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateLocation()}>Create Location</Button>
        </DialogActions>
      </Dialog >

      {/* Create Warehouse Dialog */}
      < Dialog open={openWarehouseDialog} onClose={() => setOpenWarehouseDialog(false)} maxWidth="sm" fullWidth >
        <DialogTitle>Create New Warehouse</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth margin="normal" label="Warehouse Code" required
            value={warehouseForm.code}
            onChange={(e) => setWarehouseForm(prev => ({ ...prev, code: e.target.value }))}
            placeholder="e.g. WH-01"
          />
          <TextField
            fullWidth margin="normal" label="Warehouse Name" required
            value={warehouseForm.name}
            onChange={(e) => setWarehouseForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Main Warehouse"
          />
          <TextField
            fullWidth margin="normal" label="Warehouse Email"
            value={warehouseForm.email}
            onChange={(e) => setWarehouseForm(prev => ({ ...prev, email: e.target.value }))}
            placeholder="e.g. warehouse@company.com"
            type="email"
          />
          <TextField
            fullWidth margin="normal" label="Opening Date"
            value={warehouseForm.opening_date}
            onChange={(e) => setWarehouseForm(prev => ({ ...prev, opening_date: e.target.value }))}
            type="date"
            InputLabelProps={{ shrink: true }}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Business Unit</InputLabel>
            <Select
              value={warehouseForm.business_unit}
              label="Business Unit"
              onChange={(e) => setWarehouseForm(prev => ({ ...prev, business_unit: e.target.value }))}
            >
              <MenuItem value="" disabled>Select Business Unit</MenuItem>
              {businessUnits.map((bu) => (
                <MenuItem key={bu.id} value={bu.id}>{bu.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenWarehouseDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateWarehouse()}>Create Warehouse</Button>
        </DialogActions>
      </Dialog >

      {/* Create Store Dialog */}
      < Dialog open={openStoreDialog} onClose={() => setOpenStoreDialog(false)} maxWidth="sm" fullWidth >
        <DialogTitle>Create New Store</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth margin="normal" label="Store Code" required
            value={storeForm.code}
            onChange={(e) => setStoreForm(prev => ({ ...prev, code: e.target.value }))}
            placeholder="e.g. 124"
          />
          <TextField
            fullWidth margin="normal" label="Store Name" required
            value={storeForm.name}
            onChange={(e) => setStoreForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Stores"
          />
          <TextField
            fullWidth margin="normal" label="Store Email"
            value={storeForm.email}
            onChange={(e) => setStoreForm(prev => ({ ...prev, email: e.target.value }))}
            placeholder="e.g. jdkjksdkjkj@gmail.com"
            type="email"
          />
          <TextField
            fullWidth margin="normal" label="Opening Date"
            value={storeForm.opening_date}
            onChange={(e) => setStoreForm(prev => ({ ...prev, opening_date: e.target.value }))}
            type="date"
            InputLabelProps={{ shrink: true }}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Business Unit</InputLabel>
            <Select
              value={storeForm.business_unit}
              label="Business Unit"
              onChange={(e) => setStoreForm(prev => ({ ...prev, business_unit: e.target.value }))}
            >
              <MenuItem value="" disabled>Select Business Unit</MenuItem>
              {businessUnits.map((bu) => (
                <MenuItem key={bu.id} value={bu.id}>{bu.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenStoreDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateStore()}>Create Store</Button>
        </DialogActions>
      </Dialog >

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
    </Box >
  )
}