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
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [openProductDialog, setOpenProductDialog] = useState(false)
  const [openSkuDialog, setOpenSkuDialog] = useState(false)
  const [openCompanyDialog, setOpenCompanyDialog] = useState(false)
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
  const [companyForm, setCompanyForm] = useState({
    code: '',
    name: '',
    legal_name: '',
    tax_id: '',
    currency: 'USD',
  })
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
      setOpenSkuDialog(true)
      return
    }
    if (tabValue === 2) {
      setOpenCompanyDialog(true)
      return
    }
    if (tabValue === 3) {
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
    
    const sellingPrice = parseFloat(variantForm.selling_price)
    const mrp = parseFloat(variantForm.mrp)
    
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      setSnackbar({ open: true, message: 'Selling price must be a positive number.', severity: 'error' })
      return
    }
    
    if (isNaN(mrp) || mrp <= 0) {
      setSnackbar({ open: true, message: 'MRP must be a positive number.', severity: 'error' })
      return
    }
    
    if (sellingPrice > mrp) {
      setSnackbar({ open: true, message: 'Selling price cannot be greater than MRP.', severity: 'error' })
      return
    }
    
    try {
      const result = await mdmService.createProductVariants(selectedProduct.id, variantForm)
      setOpenVariantsDialog(false)
      setVariantForm({ sizes: [], selling_price: '', mrp: '' })
      setSelectedProduct(null)
      await loadData()
      
      let message = `${result.created} SKU(s) created successfully.`
      if (result.skipped > 0) {
        message += ` ${result.skipped} size(s) skipped (already exist).`
      }
      
      setSnackbar({ open: true, message, severity: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to create variants.', severity: 'error' })
    }
  }

  const handleCreateSKU = async () => {
    if (!skuForm.code || !skuForm.name || !skuForm.product || !skuForm.base_price || !skuForm.cost_price) {
      setSnackbar({ open: true, message: 'Code, name, product, selling price, and MRP are required.', severity: 'error' })
      return
    }

    try {
      await mdmService.createSKU({
        code: skuForm.code,
        name: skuForm.name,
        product: skuForm.product,
        base_price: skuForm.base_price,
        cost_price: skuForm.cost_price,
        weight: skuForm.weight || undefined,
        size: skuForm.size || undefined,
        is_serialized: skuForm.is_serialized,
        is_batch_tracked: skuForm.is_batch_tracked,
      })
      setOpenSkuDialog(false)
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
      await loadData()
      setSnackbar({ open: true, message: 'SKU created.', severity: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to create SKU.', severity: 'error' })
    }
  }

  const handleCreateCompany = async () => {
    if (!companyForm.code || !companyForm.name) {
      setSnackbar({ open: true, message: 'Company code and name are required.', severity: 'error' })
      return
    }

    try {
      await mdmService.createCompany({
        code: companyForm.code,
        name: companyForm.name,
        legal_name: companyForm.legal_name || undefined,
        tax_id: companyForm.tax_id || undefined,
        currency: companyForm.currency,
      })
      setOpenCompanyDialog(false)
      setCompanyForm({ code: '', name: '', legal_name: '', tax_id: '', currency: 'USD' })
      await loadData()
      setSnackbar({ open: true, message: 'Company created.', severity: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to create company.', severity: 'error' })
    }
  }

  const handleCreateLocation = async () => {
    if (!locationForm.code || !locationForm.name) {
      setSnackbar({ open: true, message: 'Location code and name are required.', severity: 'error' })
      return
    }

    try {
      let businessUnitId = locationForm.business_unit
      if (!businessUnitId) {
        const fallback = businessUnits[0]
        if (fallback) {
          businessUnitId = fallback.id
        } else {
          const createdBU = await mdmService.createBusinessUnit({
            code: 'MAIN',
            name: 'Main Unit',
          })
          businessUnitId = createdBU.id
        }
      }

      await mdmService.createLocation({
        code: locationForm.code,
        name: locationForm.name,
        location_type: locationForm.location_type,
        business_unit: businessUnitId,
        is_inventory_location: locationForm.is_inventory_location,
      })
      setOpenLocationDialog(false)
      setLocationForm({
        code: '',
        name: '',
        location_type: 'warehouse',
        business_unit: '',
        is_inventory_location: true,
      })
      await loadData()
      setSnackbar({ open: true, message: 'Location created.', severity: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to create location.', severity: 'error' })
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

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
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
                  <TableCell>Category</TableCell>
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
                      <TableCell>{sku.product_code || sku.product}</TableCell>
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
                  .toLowerCase()
                  .replace(/[^a-z0-9\s]/g, '')
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
                  code: prev.code === '' || /^[a-z0-9-]+-\d{3}$/.test(prev.code)
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
      <Dialog open={openSkuDialog} onClose={() => setOpenSkuDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create SKU</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={products}
            getOptionLabel={(option) => `${option.code} - ${option.name}`}
            value={products.find(p => p.id === skuForm.product) || null}
            onChange={(event, newValue) => {
              if (newValue) {
                const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                const suggestedCode = `${newValue.code}-${randomSuffix}`;
                
                setSkuForm((prev) => ({
                  ...prev,
                  product: newValue.id,
                  code: prev.code === '' || /^[a-z0-9-]+-\d{4}$/.test(prev.code)
                    ? suggestedCode
                    : prev.code,
                  name: prev.name === '' ? newValue.name : prev.name
                }));
              } else {
                setSkuForm((prev) => ({ ...prev, product: '', code: '', name: '' }));
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Product *"
                required
                margin="normal"
                placeholder="Type to search product..."
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {option.code}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.name}
                  </Typography>
                </Box>
              </li>
            )}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            noOptionsText="No products available"
            fullWidth
          />
          <TextField
            fullWidth
            margin="normal"
            label="SKU Code *"
            value={skuForm.code}
            onChange={(e) => setSkuForm((prev) => ({ ...prev, code: e.target.value }))}
            helperText="Auto-suggested, editable"
          />
          <TextField
            fullWidth
            margin="normal"
            label="SKU Name *"
            value={skuForm.name}
            onChange={(e) => setSkuForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <TextField
            fullWidth
            select
            margin="normal"
            label="Size"
            value={skuForm.size || ''}
            onChange={(e) => setSkuForm((prev) => ({ ...prev, size: e.target.value }))}
            SelectProps={{ native: true }}
            helperText="Optional: Select size for this SKU"
          >
            <option value="">No Size</option>
            <option value="XS">XS - Extra Small</option>
            <option value="S">S - Small</option>
            <option value="M">M - Medium</option>
            <option value="L">L - Large</option>
            <option value="XL">XL - Extra Large</option>
            <option value="XXL">XXL - Double Extra Large</option>
            <option value="XXXL">XXXL - Triple Extra Large</option>
            <option value="Free Size">Free Size</option>
            <option value="One Size">One Size</option>
            <option value="28">28</option>
            <option value="30">30</option>
            <option value="32">32</option>
            <option value="34">34</option>
            <option value="36">36</option>
            <option value="38">38</option>
            <option value="40">40</option>
            <option value="42">42</option>
            <option value="44">44</option>
          </TextField>
          <TextField
            fullWidth
            margin="normal"
            label="Selling Price *"
            type="number"
            value={skuForm.base_price}
            onChange={(e) => setSkuForm((prev) => ({ ...prev, base_price: e.target.value }))}
            helperText="Actual selling price"
            inputProps={{ min: 0, step: 0.01 }}
          />
          <TextField
            fullWidth
            margin="normal"
            label="MRP *"
            type="number"
            value={skuForm.cost_price}
            onChange={(e) => setSkuForm((prev) => ({ ...prev, cost_price: e.target.value }))}
            helperText="Maximum Retail Price"
            inputProps={{ min: 0, step: 0.01 }}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Weight (optional)"
            type="number"
            value={skuForm.weight}
            onChange={(e) => setSkuForm((prev) => ({ ...prev, weight: e.target.value }))}
          />
          <TextField
            fullWidth
            select
            margin="normal"
            label="Serialized Tracking"
            value={skuForm.is_serialized ? 'yes' : 'no'}
            onChange={(e) => setSkuForm((prev) => ({ ...prev, is_serialized: e.target.value === 'yes' }))}
            SelectProps={{ native: true }}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </TextField>
          <TextField
            fullWidth
            select
            margin="normal"
            label="Batch Tracking"
            value={skuForm.is_batch_tracked ? 'yes' : 'no'}
            onChange={(e) => setSkuForm((prev) => ({ ...prev, is_batch_tracked: e.target.value === 'yes' }))}
            SelectProps={{ native: true }}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSkuDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateSKU()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Create Variants Dialog */}
      <Dialog open={openVariantsDialog} onClose={() => setOpenVariantsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Variants for "{selectedProduct?.name}"</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 1 }}>
            Select sizes to create SKU variants. Each variant will have the same pricing.
          </Typography>
          
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Select Sizes:
          </Typography>
          <Grid container spacing={1}>
            {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size', 'One Size', '28', '30', '32', '34', '36', '38', '40', '42', '44'].map((size) => (
              <Grid item key={size}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={variantForm.sizes.includes(size)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setVariantForm((prev) => ({ ...prev, sizes: [...prev.sizes, size] }))
                        } else {
                          setVariantForm((prev) => ({ ...prev, sizes: prev.sizes.filter(s => s !== size) }))
                        }
                      }}
                    />
                  }
                  label={size}
                />
              </Grid>
            ))}
          </Grid>
          
          {variantForm.sizes.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Selected: {variantForm.sizes.map(s => <Chip key={s} label={s} size="small" sx={{ mr: 0.5 }} />)}
              </Typography>
            </Box>
          )}
          
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Pricing (applies to all variants):
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Selling Price *"
                type="number"
                value={variantForm.selling_price}
                onChange={(e) => setVariantForm((prev) => ({ ...prev, selling_price: e.target.value }))}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="MRP *"
                type="number"
                value={variantForm.mrp}
                onChange={(e) => setVariantForm((prev) => ({ ...prev, mrp: e.target.value }))}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
          </Grid>
          
          {variantForm.sizes.length > 0 && selectedProduct && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Preview ({variantForm.sizes.length} SKUs will be created):
              </Typography>
              {variantForm.sizes.slice(0, 5).map((size) => {
                const sizeCode = size.toLowerCase().replace(/\s+/g, '')
                return (
                  <Typography key={size} variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    • {selectedProduct.code}-{sizeCode} → {selectedProduct.name} - {size}
                  </Typography>
                )
              })}
              {variantForm.sizes.length > 5 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  ... and {variantForm.sizes.length - 5} more
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenVariantsDialog(false)
            setVariantForm({ sizes: [], selling_price: '', mrp: '' })
            setSelectedProduct(null)
          }}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={() => void handleCreateVariants()}
            disabled={variantForm.sizes.length === 0}
          >
            Create {variantForm.sizes.length} SKU{variantForm.sizes.length !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>
      
      <Dialog open={openCompanyDialog} onClose={() => setOpenCompanyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Company</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Company Code"
            value={companyForm.code}
            onChange={(e) => setCompanyForm((prev) => ({ ...prev, code: e.target.value }))}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Company Name"
            value={companyForm.name}
            onChange={(e) => setCompanyForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Legal Name (optional)"
            value={companyForm.legal_name}
            onChange={(e) => setCompanyForm((prev) => ({ ...prev, legal_name: e.target.value }))}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Tax ID (optional)"
            value={companyForm.tax_id}
            onChange={(e) => setCompanyForm((prev) => ({ ...prev, tax_id: e.target.value }))}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Currency"
            value={companyForm.currency}
            onChange={(e) => setCompanyForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCompanyDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateCompany()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={openLocationDialog} onClose={() => setOpenLocationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Location</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Location Code"
            value={locationForm.code}
            onChange={(e) => setLocationForm((prev) => ({ ...prev, code: e.target.value }))}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Location Name"
            value={locationForm.name}
            onChange={(e) => setLocationForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <TextField
            fullWidth
            select
            margin="normal"
            label="Location Type"
            value={locationForm.location_type}
            onChange={(e) => setLocationForm((prev) => ({ ...prev, location_type: e.target.value as Location['location_type'] }))}
            SelectProps={{ native: true }}
          >
            <option value="warehouse">Warehouse</option>
            <option value="store">Store</option>
            <option value="office">Office</option>
            <option value="virtual">Virtual</option>
          </TextField>
          <TextField
            fullWidth
            select
            margin="normal"
            label="Business Unit"
            value={locationForm.business_unit}
            onChange={(e) => setLocationForm((prev) => ({ ...prev, business_unit: e.target.value }))}
            SelectProps={{ native: true }}
            helperText={businessUnits.length === 0 ? 'A default business unit will be created automatically.' : ''}
          >
            <option value="">Auto / First available</option>
            {businessUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.code} - {unit.name}
              </option>
            ))}
          </TextField>
          <TextField
            fullWidth
            select
            margin="normal"
            label="Inventory Location"
            value={locationForm.is_inventory_location ? 'yes' : 'no'}
            onChange={(e) => setLocationForm((prev) => ({ ...prev, is_inventory_location: e.target.value === 'yes' }))}
            SelectProps={{ native: true }}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenLocationDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateLocation()}>
            Create
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
