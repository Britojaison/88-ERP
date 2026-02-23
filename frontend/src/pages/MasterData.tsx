import { useEffect, useState } from 'react'
import {
  Alert,
  Autocomplete,
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
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material'
import { Add } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, type BusinessUnit, type Company, type Location, type Product, type SKU } from '../services/mdm.service'

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
  const [openProductDialog, setOpenProductDialog] = useState(false)
  // @ts-ignore: TS6133
  const [openSkuDialog, setOpenSkuDialog] = useState(false)
  // @ts-ignore: TS6133
  const [openCompanyDialog, setOpenCompanyDialog] = useState(false)
  // @ts-ignore: TS6133
  const [openLocationDialog, setOpenLocationDialog] = useState(false)
  const [openVariantsDialog, setOpenVariantsDialog] = useState(false)
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
  // @ts-ignore: TS6133
  const [skuForm, setSkuForm] = useState({
    code: '',
    name: '',
    product: '',
    base_price: '',
    cost_price: '',
    weight: '',
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
      const [productData, skuData, companyData, businessUnitData, locationData] = await Promise.all([
        mdmService.getProducts(),
        mdmService.getSKUs(),
        mdmService.getCompanies(),
        mdmService.getBusinessUnits(),
        mdmService.getLocations(),
      ])
      setProducts(productData)
      setSkus(skuData)
      setCompanies(companyData)
      setBusinessUnits(businessUnitData)
      setLocations(locationData)
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
      setOpenProductDialog(true)
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
        is_serialized: false,
        is_batch_tracked: false,
      })
      setOpenSkuDialog(true)
      return
    }
    if (tabValue === 2) {
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
    if (tabValue === 3) {
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
    try {
      await mdmService.createProduct(productForm)
      setOpenProductDialog(false)
      setProductForm({ code: '', name: '', description: '' })
      await loadData()
      setSnackbar({ open: true, message: 'Product created.', severity: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to create product.', severity: 'error' })
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
      await loadData()
      setSnackbar({
        open: true,
        message: `Created ${result.created} SKUs. ${result.skipped > 0 ? `Skipped ${result.skipped} existing sizes.` : ''}`,
        severity: 'success'
      })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to create variants.', severity: 'error' })
    }
  }

  return (
    <Box>
      <PageHeader
        title="Master Data Management"
        subtitle="Manage products, SKUs, and business entities."
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={handleAddNew}>
            Add New
          </Button>
        }
      />

      <Paper>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Products" />
          <Tab label="SKUs" />
          <Tab label="Companies" />
          <Tab label="Locations" />
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

        <TabPanel value={tabValue} index={3}>
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
                  .slice(0, 1)
                  .join('');

                // Add a random 3-digit number for uniqueness
                const randomSuffix = Math.floor(1 + Math.random() * 999).toString().padStart(3, '0');
                const suggestedCode = baseCode ? `MMW-${randomSuffix}-${baseCode}` : '';

                return {
                  ...prev,
                  name,
                  // Only update code if it's empty or matches a previous auto-suggestion pattern
                  code: prev.code === '' || /^MMW-\d{3}-[A-Z0-9]+$/.test(prev.code.toUpperCase()) || /^[a-z0-9-]+-\d{3}$/.test(prev.code)
                    ? suggestedCode
                    : prev.code
                };
              });
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
          <Autocomplete
            multiple
            options={['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size']}
            value={variantForm.sizes}
            onChange={(_, newValue) => setVariantForm((prev) => ({ ...prev, sizes: newValue }))}
            renderInput={(params) => (
              <TextField {...params} label="Sizes" placeholder="Select sizes..." />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip variant="outlined" label={option} {...getTagProps({ index })} key={option} />
              ))
            }
            sx={{ mb: 2 }}
          />
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