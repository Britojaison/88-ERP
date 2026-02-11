import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { mdmService, type Company, type Location, type Product, type SKU } from '../services/mdm.service'

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
  const [locations, setLocations] = useState<Location[]>([])
  const [openProductDialog, setOpenProductDialog] = useState(false)
  const [productForm, setProductForm] = useState({
    code: '',
    name: '',
    description: '',
  })
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'info' },
  )

  const loadData = async () => {
    try {
      const [productData, skuData, companyData, locationData] = await Promise.all([
        mdmService.getProducts(),
        mdmService.getSKUs(),
        mdmService.getCompanies(),
        mdmService.getLocations(),
      ])
      setProducts(productData)
      setSkus(skuData)
      setCompanies(companyData)
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
                </TableRow>
              </TableHead>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
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
            label="Product Code"
            value={productForm.code}
            onChange={(e) => setProductForm((prev) => ({ ...prev, code: e.target.value }))}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Product Name"
            value={productForm.name}
            onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
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
