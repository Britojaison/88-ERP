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
  Tooltip,
  TablePagination,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
} from '@mui/material'
import { Add, CheckCircle, Cancel, Delete as DeleteIcon, PhotoCamera as PhotoCameraIcon, Collections as CollectionsIcon, Edit as EditIcon } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, type BusinessUnit, type Company, type Location, type Product, type SKU, type Fabric } from '../services/mdm.service'
import { shopifyService, type ShopifyCollection } from '../services/shopify.service'

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
  const [totalProducts, setTotalProducts] = useState(0)
  const [productPage, setProductPage] = useState(0)

  const [skus, setSkus] = useState<SKU[]>([])
  const [totalSkus, setTotalSkus] = useState(0)
  const [skuPage, setSkuPage] = useState(0)

  const [companies, setCompanies] = useState<Company[]>([])
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])

  const [locations, setLocations] = useState<Location[]>([])
  const [totalLocations, setTotalLocations] = useState(0)
  const [locationPage, setLocationPage] = useState(0)

  const [fabrics, setFabrics] = useState<Fabric[]>([])
  const [totalFabrics, setTotalFabrics] = useState(0)
  const [fabricPage, setFabricPage] = useState(0)

  const [loading, setLoading] = useState(false)
  const [shopifyCollections, setShopifyCollections] = useState<ShopifyCollection[]>([])
  const [fabricFilter, setFabricFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [openProductDialog, setOpenProductDialog] = useState(false)
  const [openSkuDialog, setOpenSkuDialog] = useState(false)
  const [openVariantsDialog, setOpenVariantsDialog] = useState(false)
  const [openFabricDialog, setOpenFabricDialog] = useState(false)
  const [openRejectDialog, setOpenRejectDialog] = useState(false)
  const [openStoreDialog, setOpenStoreDialog] = useState(false)
  const [openWarehouseDialog, setOpenWarehouseDialog] = useState(false)
  const [editWarehouseId, setEditWarehouseId] = useState<string | null>(null)
  const [editProductId, setEditProductId] = useState<string | null>(null)
  const [editStoreId, setEditStoreId] = useState<string | null>(null)
  const [rejectFabricId, setRejectFabricId] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: string; id: string; name: string }>({ open: false, type: '', id: '', name: '' })
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
    shopify_collection: '',
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
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [productImagePreview, setProductImagePreview] = useState('')
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
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'info' },
  )

  const fetchData = async (index: number) => {
    setLoading(true)
    try {
      if (companies.length === 0) {
        const [companyData, bizData] = await Promise.all([
          mdmService.getCompanies(),
          mdmService.getBusinessUnits()
        ])
        setCompanies(companyData.results)
        setBusinessUnits(bizData.results)
      }

      switch (index) {
        case 0: {
          const res = await mdmService.getProducts({ hide_shopify: true, page: productPage + 1, page_size: 50 })
          setProducts(res.results)
          setTotalProducts(res.count)
          break
        }
        case 1: {
          const res = await mdmService.getSKUs({ hide_shopify: true, page: skuPage + 1, page_size: 50 })
          setSkus(res.results)
          setTotalSkus(res.count)
          break
        }
        case 2: {
          const res = await mdmService.getFabrics({ page: fabricPage + 1, page_size: 50 })
          setFabrics(res.results)
          setTotalFabrics(res.count)
          break
        }
        case 3:
        case 4: {
          const type = index === 3 ? 'warehouse' : 'store'
          const res = await mdmService.getLocations({ location_type: type, page: locationPage + 1, page_size: 50 })
          setLocations(res.results)
          setTotalLocations(res.count)
          break
        }
      }
      
      if (shopifyCollections.length === 0) {
        shopifyService.listCollections().then(setShopifyCollections).catch(() => [])
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load master data.', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setFabricPage(0)
  }, [fabricFilter])

  useEffect(() => {
    void fetchData(tabValue)
  }, [tabValue, productPage, skuPage, fabricPage, locationPage])

  const handleAddNew = () => {
    if (tabValue === 0) {
      setEditProductId(null)
      setProductForm({ code: '', name: '', description: '', shopify_collection: '' })
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
      setProductImageFile(null)
      setProductImagePreview('')
      setOpenProductDialog(true)
      return
    } else if (tabValue === 2) {
      setFabricForm({ name: '', color: '', fabric_type: '', total_meters: '', cost_per_meter: '', dispatch_unit: '', notes: '' })
      setFabricPhotoFile(null)
      setFabricPhotoPreview('')
      setOpenFabricDialog(true)
      return
    } else if (tabValue === 3) {
      setEditWarehouseId(null)
      setWarehouseForm({ code: '', name: '', email: '', opening_date: '', business_unit: '' })
      setOpenWarehouseDialog(true)
      return
    } else if (tabValue === 4) {
      setEditStoreId(null)
      setStoreForm({ code: '', name: '', email: '', opening_date: '', business_unit: '' })
      setOpenStoreDialog(true)
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
      let product: Product;
      if (editProductId) {
        product = await mdmService.updateProduct(editProductId, productForm, productImageFile || undefined)
      } else {
        product = await mdmService.createProduct(productForm, productImageFile || undefined)
      }

      if (!editProductId && variantForm.sizes.length === 0 && variantForm.selling_price && variantForm.mrp) {
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

      setOpenProductDialog(false)
      setSnackbar({ open: true, message: editProductId ? 'Product updated successfully.' : 'Product created successfully.', severity: 'success' })

      // Small delay to let transition finish before heavy re-renders/resets
      setTimeout(() => {
        setEditProductId(null)
        setProductForm({ code: '', name: '', description: '', shopify_collection: '' })
        setProductImageFile(null)
        setProductImagePreview('')
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
        void fetchData(tabValue);
      }, 300);

    } catch (error: any) {
      console.error('Create product error:', error)
      if (error.response?.data) {
        console.error('Error Response Data:', JSON.stringify(error.response.data, null, 2));
      }
      const errorMsg = error?.response?.data?.error || error?.response?.data?.detail || JSON.stringify(error?.response?.data) || 'Unknown error'
      setSnackbar({ open: true, message: `Failed to create product/SKU: ${errorMsg}`, severity: 'error' })
    }
  }

  const handleCreateSku = async () => {
    try {
      await mdmService.createSKU(skuForm)
      setOpenSkuDialog(false)
      fetchData(tabValue)
      setSnackbar({ open: true, message: 'SKU created successfully!', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to create SKU.', severity: 'error' })
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
      const result = await mdmService.createProductVariants(selectedProduct.id, variantForm, productImageFile || undefined)
      setOpenVariantsDialog(false)
      setSnackbar({
        open: true,
        message: `Created ${result.created} SKUs. ${result.skipped > 0 ? `Skipped ${result.skipped} existing sizes.` : ''}`,
        severity: 'success'
      })

      setTimeout(() => {
        setVariantForm({ sizes: [], selling_price: '', mrp: '' })
        setProductImageFile(null)
        setProductImagePreview('')
        setSelectedProduct(null)
        void fetchData(tabValue);
      }, 300);
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
      setSnackbar({ open: true, message: 'Fabric created successfully with auto-generated SKU!', severity: 'success' })

      setTimeout(() => {
        setFabricForm({ name: '', color: '', fabric_type: '', total_meters: '', cost_per_meter: '', dispatch_unit: '', notes: '' })
        setFabricPhotoFile(null)
        setFabricPhotoPreview('')
        void fetchData(tabValue)
      }, 300)
    } catch (error: any) {
      setSnackbar({ open: true, message: error?.response?.data?.detail || 'Failed to create fabric.', severity: 'error' })
    }
  }


  const handleRejectFabric = async () => {
    if (!rejectFabricId) return
    try {
      await mdmService.rejectFabric(rejectFabricId, rejectReason)
      setOpenRejectDialog(false)
      setRejectReason('')
      setRejectFabricId('')
      setTimeout(() => { void fetchData(tabValue) }, 300)
      setSnackbar({ open: true, message: 'Fabric rejected.', severity: 'info' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to reject fabric.', severity: 'error' })
    }
  }



  const handleSaveWarehouse = async () => {
    if (!warehouseForm.code || !warehouseForm.name) {
      setSnackbar({ open: true, message: 'Warehouse Code and Name are required.', severity: 'error' })
      return
    }
    try {
      const payload = {
        code: warehouseForm.code,
        name: warehouseForm.name,
        email: warehouseForm.email,
        opening_date: warehouseForm.opening_date,
        location_type: 'warehouse' as const,
        business_unit: warehouseForm.business_unit || (businessUnits.length > 0 ? businessUnits[0].id : ''),
        is_inventory_location: true,
      }

      if (editWarehouseId) {
        await mdmService.updateLocation(editWarehouseId, payload)
        setSnackbar({ open: true, message: 'Warehouse updated successfully!', severity: 'success' })
      } else {
        await mdmService.createLocation(payload)
        setSnackbar({ open: true, message: 'Warehouse created successfully!', severity: 'success' })
      }

      setOpenWarehouseDialog(false)
      setTimeout(() => { void fetchData(tabValue) }, 300)
    } catch (error: any) {
      setSnackbar({ open: true, message: error?.response?.data?.detail || 'Failed to save warehouse.', severity: 'error' })
    }
  }

  const handleSaveStore = async () => {
    if (!storeForm.code || !storeForm.name) {
      setSnackbar({ open: true, message: 'Store Code and Name are required.', severity: 'error' })
      return
    }
    try {
      const payload = {
        code: storeForm.code,
        name: storeForm.name,
        email: storeForm.email,
        opening_date: storeForm.opening_date,
        location_type: 'store' as const,
        business_unit: storeForm.business_unit || (businessUnits.length > 0 ? businessUnits[0].id : ''),
        is_inventory_location: true,
      }

      if (editStoreId) {
        await mdmService.updateLocation(editStoreId, payload)
        setSnackbar({ open: true, message: 'Store updated successfully!', severity: 'success' })
      } else {
        await mdmService.createLocation(payload)
        setSnackbar({ open: true, message: 'Store created successfully!', severity: 'success' })
      }

      setOpenStoreDialog(false)
      setTimeout(() => { void fetchData(tabValue) }, 300)
    } catch (error: any) {
      setSnackbar({ open: true, message: error?.response?.data?.detail || 'Failed to save store.', severity: 'error' })
    }
  }

  const handleDelete = async () => {
    const { type, id } = deleteConfirm
    try {
      if (type === 'product') await mdmService.deleteProduct(id)
      else if (type === 'sku') await mdmService.deleteSKU(id)
      else if (type === 'fabric') await mdmService.deleteFabric(id)
      else if (type === 'location' || type === 'warehouse' || type === 'store') await mdmService.deleteLocation(id)
      setSnackbar({ open: true, message: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully.`, severity: 'success' })
      setDeleteConfirm({ open: false, type: '', id: '', name: '' })
      void fetchData(tabValue)
    } catch (error: any) {
      const msg = error?.response?.data?.detail || `Failed to delete ${type}. It may be referenced by other records.`
      setSnackbar({ open: true, message: msg, severity: 'error' })
      setDeleteConfirm({ open: false, type: '', id: '', name: '' })
    }
  }


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
          <Tab label="Warehouses" />
          <Tab label="Stores" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <TableContainer>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
            ) : (
              <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Image</TableCell>
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
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No products found. Click "Add New" to create your first product.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        {product.image_url ? (
                          <Box component="img" src={product.image_url} sx={{ width: 40, height: 40, borderRadius: 0.5, objectFit: 'cover' }} />
                        ) : (
                          <Box sx={{ width: 40, height: 40, bgcolor: 'action.hover', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CollectionsIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>{product.code}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.description || '-'}</TableCell>
                      <TableCell>{product.status}</TableCell>
                      <TableCell>{new Date(product.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setSelectedProduct(product)
                              setProductImagePreview(product.image_url || '')
                              setProductImageFile(null)
                              // Auto-fill selling price and MRP from the product's existing SKUs
                              const productSkus = skus.filter(s => s.product === product.id || s.product_name === product.name)
                              if (productSkus.length > 0) {
                                setVariantForm({
                                  sizes: [],
                                  selling_price: productSkus[0].base_price || '',
                                  mrp: productSkus[0].cost_price || '',
                                })
                              } else {
                                setVariantForm({ sizes: [], selling_price: '', mrp: '' })
                              }
                              setOpenVariantsDialog(true)
                            }}
                          >
                            Create Variants
                          </Button>
                          <Tooltip title="Delete product">
                            <IconButton size="small" color="error" onClick={() => setDeleteConfirm({ open: true, type: 'product', id: product.id, name: product.name })}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit product">
                            <IconButton
                              size="small"
                              color="info"
                              onClick={() => {
                                setEditProductId(product.id)
                                setProductForm({
                                  code: product.code,
                                  name: product.name,
                                  description: product.description || '',
                                  shopify_collection: product.shopify_collection || '',
                                })
                                setProductImagePreview(product.image_url || '')
                                setProductImageFile(null)
                                setOpenProductDialog(true)
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>
          <TablePagination
            component="div"
            count={totalProducts}
            page={productPage}
            onPageChange={(_, newPage) => setProductPage(newPage)}
            rowsPerPage={50}
            rowsPerPageOptions={[50]}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <TableContainer>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>SKU Code</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Style / Size</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {skus.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
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
                        <TableCell>{sku.style_code || '-'} / {sku.size || '-'}</TableCell>
                        <TableCell>{sku.status}</TableCell>
                        <TableCell>₹{sku.base_price}</TableCell>
                        <TableCell>{new Date(sku.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Tooltip title="Delete SKU">
                            <IconButton size="small" color="error" onClick={() => setDeleteConfirm({ open: true, type: 'sku', id: sku.id, name: sku.code })}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TableContainer>
          <TablePagination
            component="div"
            count={totalSkus}
            page={skuPage}
            onPageChange={(_, newPage) => setSkuPage(newPage)}
            rowsPerPage={50}
            rowsPerPageOptions={[50]}
          />
        </TabPanel>

        {/* Fabrics Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
            {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
              <Chip
                key={f}
                label={f === 'all' ? `All (${fabrics.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${fabrics.filter(fb => fb.approval_status === f).length})`}
                onClick={() => { setFabricFilter(f); setFabricPage(0); }}
                color={fabricFilter === f ? (f === 'approved' ? 'success' : f === 'rejected' ? 'error' : f === 'pending' ? 'warning' : 'primary') : 'default'}
                variant={fabricFilter === f ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
          <TableContainer>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
            ) : (
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
                  {fabrics.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                          No fabrics found.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    fabrics.map((fabric) => (
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
                            variant="outlined"
                          />
                          {fabric.rejection_reason && (
                            <Typography variant="caption" display="block" color="error.main">{fabric.rejection_reason}</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {fabric.approval_status === 'pending' && (
                              <>
                                <Tooltip title="Approve">
                                  <IconButton size="small" color="success" onClick={() => mdmService.approveFabric(fabric.id).then(() => { void fetchData(tabValue) })}>
                                    <CheckCircle fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Reject">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => {
                                      setRejectFabricId(fabric.id)
                                      setRejectReason('')
                                      setOpenRejectDialog(true)
                                    }}
                                  >
                                    <Cancel fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                            <Tooltip title="Delete fabric">
                              <IconButton size="small" color="error" onClick={() => setDeleteConfirm({ open: true, type: 'fabric', id: fabric.id, name: fabric.name })}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TableContainer>
          <TablePagination
            component="div"
            count={totalFabrics}
            page={fabricPage}
            onPageChange={(_, newPage) => setFabricPage(newPage)}
            rowsPerPage={50}
            rowsPerPageOptions={[50]}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <TableContainer>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Business Unit</TableCell>
                    <TableCell>Opening Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {locations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                          No warehouses found.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    locations.map((loc) => (
                      <TableRow key={loc.id}>
                        <TableCell>{loc.code}</TableCell>
                        <TableCell>{loc.name}</TableCell>
                        <TableCell>{loc.email || '-'}</TableCell>
                        <TableCell>{loc.business_unit_code || '-'}</TableCell>
                        <TableCell>{loc.opening_date || '-'}</TableCell>
                        <TableCell>{loc.status}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <IconButton size="small" color="info" onClick={() => {
                              setEditWarehouseId(loc.id)
                              setWarehouseForm({
                                code: loc.code,
                                name: loc.name,
                                email: loc.email || '',
                                opening_date: loc.opening_date || '',
                                business_unit: loc.business_unit || '',
                              })
                              setOpenWarehouseDialog(true)
                            }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => setDeleteConfirm({ open: true, type: 'warehouse', id: loc.id, name: loc.name })}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TableContainer>
          <TablePagination
            component="div"
            count={totalLocations}
            page={locationPage}
            onPageChange={(_, newPage) => setLocationPage(newPage)}
            rowsPerPage={50}
            rowsPerPageOptions={[50]}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <TableContainer>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Business Unit</TableCell>
                    <TableCell>Opening Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {locations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                          No stores found.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    locations.map((loc) => (
                      <TableRow key={loc.id}>
                        <TableCell>{loc.code}</TableCell>
                        <TableCell>{loc.name}</TableCell>
                        <TableCell>{loc.email || '-'}</TableCell>
                        <TableCell>{loc.business_unit_code || '-'}</TableCell>
                        <TableCell>{loc.opening_date || '-'}</TableCell>
                        <TableCell>{loc.status}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <IconButton size="small" color="info" onClick={() => {
                              setEditStoreId(loc.id)
                              setStoreForm({
                                code: loc.code,
                                name: loc.name,
                                email: loc.email || '',
                                opening_date: loc.opening_date || '',
                                business_unit: loc.business_unit || '',
                              })
                              setOpenStoreDialog(true)
                            }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => setDeleteConfirm({ open: true, type: 'store', id: loc.id, name: loc.name })}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TableContainer>
          <TablePagination
            component="div"
            count={totalLocations}
            page={locationPage}
            onPageChange={(_, newPage) => setLocationPage(newPage)}
            rowsPerPage={50}
            rowsPerPageOptions={[50]}
          />
        </TabPanel>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, type: '', id: '', name: '' })}>
        <DialogTitle>Delete {deleteConfirm.type}?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
          </Typography>
          <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
            If this item is referenced by other records (orders, inventory, etc.), the delete may fail.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm({ open: false, type: '', id: '', name: '' })}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => void handleDelete()}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Product Dialog */}
      <Dialog open={openProductDialog} onClose={() => setOpenProductDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editProductId ? 'Edit Product' : 'Create Product'}</DialogTitle>
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

          <FormControl fullWidth margin="normal">
            <InputLabel>Shopify Collection (Optional)</InputLabel>
            <Select
              value={productForm.shopify_collection}
              label="Shopify Collection (Optional)"
              onChange={(e) => setProductForm((prev) => ({ ...prev, shopify_collection: e.target.value }))}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {shopifyCollections.map((col) => (
                <MenuItem key={col.id} value={col.id}>
                  {col.title} ({col.collection_type})
                </MenuItem>
              ))}
            </Select>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5, gap: 1 }}>
              <Button 
                size="small" 
                onClick={async () => {
                  try {
                    setSnackbar({ open: true, message: 'Syncing collections in background...', severity: 'info' });
                    const result = await shopifyService.syncCollections();
                    setSnackbar({ 
                      open: true, 
                      message: `Sync job started (ID: ${result.job_id.substring(0, 8)}). This will sync collections and their products.`, 
                      severity: 'success' 
                    });
                    // Refresh the dropdown list after a delay
                    setTimeout(() => {
                      void shopifyService.listCollections().then(setShopifyCollections);
                    }, 5000);
                  } catch (error) {
                    setSnackbar({ open: true, message: 'Failed to start collection sync.', severity: 'error' });
                  }
                }}
              >
                Sync from Shopify
              </Button>
              <Button 
                size="small" 
                color="info"
                onClick={async () => {
                  try {
                    setSnackbar({ open: true, message: 'Syncing collection assignments...', severity: 'info' });
                    const result = await shopifyService.syncMemberships();
                    setSnackbar({ 
                      open: true, 
                      message: `Assignment sync started (ID: ${result.job_id.substring(0, 8)}). Fixes '—' issues in filters.`, 
                      severity: 'success' 
                    });
                  } catch (error) {
                    setSnackbar({ open: true, message: 'Failed to start membership sync.', severity: 'error' });
                  }
                }}
              >
                Sync Assignments
              </Button>
              <Button 
                size="small" 
                color="secondary"
                onClick={async () => {
                  try {
                    setSnackbar({ open: true, message: 'Starting collection backfill in background...', severity: 'info' });
                    const result = await shopifyService.backfillCollections();
                    setSnackbar({ 
                      open: true, 
                      message: `Backfill job started (ID: ${result.job_id.substring(0, 8)}). Pushes local assignments to Shopify.`, 
                      severity: 'success' 
                    });
                  } catch (error) {
                    setSnackbar({ open: true, message: 'Failed to start collection backfill.', severity: 'error' });
                  }
                }}
              >
                Backfill Collections
              </Button>
            </Box>
          </FormControl>

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
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  {productImagePreview ? (
                    <Box
                      component="img"
                      src={productImagePreview}
                      sx={{ width: 200, height: 200, objectFit: 'cover', borderRadius: 1 }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 200,
                        height: 200,
                        bgcolor: 'action.hover',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 1,
                        border: '1px dashed',
                        borderColor: 'divider',
                      }}
                    >
                      <CollectionsIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                    </Box>
                  )}
                  <Button variant="outlined" component="label" startIcon={<PhotoCameraIcon />}>
                    Upload Product Image
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setProductImageFile(file)
                          const reader = new FileReader()
                          reader.onloadend = () => {
                            setProductImagePreview(reader.result as string)
                          }
                          reader.readAsDataURL(file)
                        }
                      }}
                    />
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenProductDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateProduct()}>
            {editProductId ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SKU Dialog */}
      <Dialog open={openSkuDialog} onClose={() => setOpenSkuDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Quick Create SKU</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Product</InputLabel>
                <Select
                  value={skuForm.product}
                  label="Product"
                  onChange={(e) => setSkuForm({ ...skuForm, product: e.target.value })}
                >
                  {products.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.name} ({p.code})</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="SKU Code" value={skuForm.code} onChange={(e) => setSkuForm({ ...skuForm, code: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="SKU Name" value={skuForm.name} onChange={(e) => setSkuForm({ ...skuForm, name: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Base Price" type="number" value={skuForm.base_price} onChange={(e) => setSkuForm({ ...skuForm, base_price: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Cost Price" type="number" value={skuForm.cost_price} onChange={(e) => setSkuForm({ ...skuForm, cost_price: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSkuDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateSku()}>Create SKU</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={openVariantsDialog} onClose={() => setOpenVariantsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Product Variants</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Product: <strong>{selectedProduct?.name}</strong>
          </Typography>
          {(() => {
            const productSkus = skus.filter(s => s.product === selectedProduct?.id || s.product_name === selectedProduct?.name)
            const productPrice = productSkus.length > 0 ? productSkus[0].base_price : null
            const productMrp = productSkus.length > 0 ? productSkus[0].cost_price : null
            return productPrice ? (
              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, display: 'flex', gap: 3, alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Product Price: <strong style={{ color: '#2e7d32' }}>₹{productPrice}</strong>
                </Typography>
                {productMrp && (
                  <Typography variant="body2" color="text.secondary">
                    MRP: <strong style={{ color: '#1565c0' }}>₹{productMrp}</strong>
                  </Typography>
                )}
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                No existing price found. Enter selling price and MRP below.
              </Typography>
            )
          })()}
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
                helperText={variantForm.selling_price ? 'Auto-filled from product (editable)' : 'Enter selling price'}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="MRP"
                value={variantForm.mrp}
                onChange={(e) => setVariantForm((prev) => ({ ...prev, mrp: e.target.value }))}
                type="number"
                helperText={variantForm.mrp ? 'Auto-filled from product (editable)' : 'Enter MRP'}
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                {productImagePreview ? (
                  <Box
                    component="img"
                    src={productImagePreview}
                    sx={{ width: 200, height: 200, objectFit: 'cover', borderRadius: 1 }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 200,
                      height: 200,
                      bgcolor: 'action.hover',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 1,
                      border: '1px dashed',
                      borderColor: 'divider',
                    }}
                  >
                    <CollectionsIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                  </Box>
                )}
                <Button variant="outlined" component="label" startIcon={<PhotoCameraIcon />}>
                  Upload Product Image
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setProductImageFile(file)
                        const reader = new FileReader()
                        reader.onloadend = () => {
                          setProductImagePreview(reader.result as string)
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                </Button>
              </Box>
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



      {/* Create Warehouse Dialog */}
      < Dialog open={openWarehouseDialog} onClose={() => setOpenWarehouseDialog(false)} maxWidth="sm" fullWidth >
        <DialogTitle>{editWarehouseId ? 'Edit Warehouse' : 'Create New Warehouse'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth margin="normal" label="Warehouse Name" required
            value={warehouseForm.name}
            onChange={(e) => {
              const name = e.target.value
              setWarehouseForm(prev => {
                let nextNum = 1
                const whCodes = locations.map((w: any) => w.code || '')
                whCodes.forEach(code => {
                  const match = code.match(/WH-(\d+)/)
                  if (match) {
                    const num = parseInt(match[1])
                    if (num >= nextNum) nextNum = num + 1
                  }
                })
                const suggestedCode = `WH-${nextNum.toString().padStart(3, '0')}`

                // Only auto-update if code is empty or matches a previous numeric WH-NNN pattern
                const shouldAutoUpdate = !prev.code || prev.code === '' || /^WH-\d{3}$/.test(prev.code)
                return {
                  ...prev,
                  name,
                  code: shouldAutoUpdate && !editWarehouseId ? suggestedCode : prev.code,
                }
              })
            }}
            placeholder="e.g. Main Warehouse"
          />
          <TextField
            fullWidth margin="normal" label="Warehouse Code" required
            value={warehouseForm.code}
            onChange={(e) => setWarehouseForm(prev => ({ ...prev, code: e.target.value }))}
            helperText="Auto-generated (editable)"
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


        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenWarehouseDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSaveWarehouse()}>{editWarehouseId ? 'Save Changes' : 'Create Warehouse'}</Button>
        </DialogActions>
      </Dialog >

      {/* Create Store Dialog */}
      < Dialog open={openStoreDialog} onClose={() => setOpenStoreDialog(false)} maxWidth="sm" fullWidth >
        <DialogTitle>{editStoreId ? 'Edit Store' : 'Create New Store'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth margin="normal" label="Store Name" required
            value={storeForm.name}
            onChange={(e) => {
              const name = e.target.value
              setStoreForm(prev => {
                let nextNum = 1
                const storeCodes = locations.map((s: any) => s.code || '')
                storeCodes.forEach(code => {
                  const match = code.match(/STORE-(\d+)/)
                  if (match) {
                    const num = parseInt(match[1])
                    if (num >= nextNum) nextNum = num + 1
                  }
                })
                const suggestedCode = `STORE-${nextNum.toString().padStart(3, '0')}`

                // Only auto-update if code is empty or matches a previous numeric STORE-NNN pattern
                const shouldAutoUpdate = !prev.code || prev.code === '' || /^STORE-\d{3}$/.test(prev.code)
                return {
                  ...prev,
                  name,
                  code: shouldAutoUpdate && !editStoreId ? suggestedCode : prev.code,
                }
              })
            }}
            placeholder="e.g. Main Store"
          />
          <TextField
            fullWidth margin="normal" label="Store Code" required
            value={storeForm.code}
            onChange={(e) => setStoreForm(prev => ({ ...prev, code: e.target.value }))}
            helperText="Auto-generated from name (editable)"
          />
          <TextField
            fullWidth margin="normal" label="Store Email"
            value={storeForm.email}
            onChange={(e) => setStoreForm(prev => ({ ...prev, email: e.target.value }))}
            placeholder="e.g. store@company.com"
            type="email"
          />
          <TextField
            fullWidth margin="normal" label="Opening Date"
            value={storeForm.opening_date}
            onChange={(e) => setStoreForm(prev => ({ ...prev, opening_date: e.target.value }))}
            type="date"
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenStoreDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSaveStore()}>{editStoreId ? 'Save Changes' : 'Create Store'}</Button>
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