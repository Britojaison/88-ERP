import { useState, useEffect } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Avatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material'
import {
  Search,
  CheckCircle,
  LocalShipping,
  Inventory,
  Assignment,
  LocationOn,
  AccessTime,
  Person,
  Description,
  Timeline as TimelineIcon,
  FilterList,
  Edit,
  Brush,
  Factory,
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, type SKU } from '../services/mdm.service'
import { productJourneyService } from '../services/inventory.service'

interface ProductOption {
  sku: string
  productName: string
  price: string
  barcode: string
  orderNumber: string
}

interface JourneyCheckpoint {
  id: string
  stage: string
  status: 'completed' | 'in_progress' | 'pending' | 'delayed' | string
  location_name?: string
  timestamp?: string
  user_name?: string
  notes?: string
  expected_time?: string
  attachment_url?: string
  measurement_value?: string
  measurement_unit?: string
}

export default function ProductJourney() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)
  const [searchResults, setSearchResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  // Manual Update State
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<JourneyCheckpoint | null>(null)
  const [updateForm, setUpdateForm] = useState({
    status: '',
    expectedTime: '',
    notes: '',
  })

  // Gallery State
  const [photosDialogOpen, setPhotosDialogOpen] = useState(false)
  const [galleryPhotos, setGalleryPhotos] = useState<any[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)

  // Load all products from API
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoadingProducts(true)
        const skuData = await mdmService.getSKUs()
        const skus = Array.isArray(skuData) ? skuData : (skuData as any).results

        // Convert SKUs to ProductOption format
        const options: ProductOption[] = skus.map((sku: SKU) => ({
          sku: sku.code,
          productName: sku.product_name || sku.name,
          price: `₹${sku.base_price}`,
          barcode: '', // Barcodes would need to be fetched separately if needed
          orderNumber: '', // This would come from actual orders
        }))

        setProductOptions(options)
      } catch (error) {
        console.error('Failed to load products:', error)
      } finally {
        setLoadingProducts(false)
      }
    }

    void loadProducts()
  }, [])

  // No mock data needed anymore!

  const handleSearch = async () => {
    if (!searchTerm.trim()) return
    setLoading(true)
    try {
      const result = await productJourneyService.searchJourney(searchTerm)
      setSearchResults(result)
    } catch (err: any) {
      alert(err.response?.data?.error || 'SKU not found')
      setSearchResults(null)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickSearch = async (searchValue: string) => {
    setSearchTerm(searchValue)
    setLoading(true)
    try {
      const result = await productJourneyService.searchJourney(searchValue)
      setSearchResults(result)
    } catch (err: any) {
      alert(err.response?.data?.error || 'SKU not found')
      setSearchResults(null)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenGallery = async () => {
    if (!searchResults) return
    setPhotosDialogOpen(true)
    setLoadingPhotos(true)
    try {
      const res = await productJourneyService.getPhotos(searchResults.sku)
      setGalleryPhotos(res.photos || [])
    } catch (err: any) {
      alert('Error fetching photos: ' + err.message)
    } finally {
      setLoadingPhotos(false)
    }
  }

  const handleOpenUpdate = (checkpoint: JourneyCheckpoint) => {
    setSelectedCheckpoint(checkpoint)
    setUpdateForm({
      status: checkpoint.status,
      expectedTime: checkpoint.expected_time ? new Date(checkpoint.expected_time).toISOString().slice(0, 16) : '',
      notes: checkpoint.notes || '',
    })
    setUpdateDialogOpen(true)
  }

  const handleSaveUpdate = async () => {
    if (!selectedCheckpoint || !searchResults) return
    try {
      await productJourneyService.addCheckpoint(searchResults.sku, {
        stage: selectedCheckpoint.stage,
        status: updateForm.status,
        notes: updateForm.notes
        // ignoring datetime/location here as the frontend model just overwrites basic fields on quick edit
      })
      // reload search to refresh timeline
      await handleQuickSearch(searchResults.sku_code)
      setUpdateDialogOpen(false)
    } catch (e: any) {
      alert('Error updating checkpoint: ' + e.message)
    }
  }

  const filteredCheckpoints = searchResults?.checkpoints.filter((cp: JourneyCheckpoint) => {
    if (statusFilter !== 'all' && cp.status !== statusFilter) return false
    if (stageFilter !== 'all' && cp.stage !== stageFilter) return false
    if (locationFilter !== 'all' && !(cp.location_name || '').includes(locationFilter)) return false
    return true
  }) || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'in_progress':
        return 'warning'
      case 'delayed':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />
      case 'in_progress':
        return <LocalShipping color="warning" />
      case 'pending':
        return <AccessTime color="disabled" />
      default:
        return <AccessTime color="disabled" />
    }
  }

  const activeStep = searchResults?.checkpoints.findIndex((cp: any) => cp.status !== 'completed') || 0

  return (
    <Box>
      <PageHeader
        title="Product Journey Tracker"
        subtitle="Track products from receipt through delivery with complete visibility at every checkpoint."
      />

      <Grid container spacing={2.5}>
        {/* Search Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Autocomplete
                  fullWidth
                  options={productOptions}
                  loading={loadingProducts}
                  value={selectedProduct}
                  onChange={(_, newValue) => {
                    setSelectedProduct(newValue)
                    if (newValue) {
                      handleQuickSearch(newValue.sku)
                    }
                  }}
                  inputValue={searchTerm}
                  onInputChange={(_, newInputValue) => {
                    setSearchTerm(newInputValue)
                  }}
                  getOptionLabel={(option) => option.sku}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Track Product Journey"
                      placeholder={loadingProducts ? "Loading products..." : "Enter barcode, SKU, or product name to track..."}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchTerm) {
                          handleSearch()
                        }
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props} key={option.sku}>
                      <Box sx={{ width: '100%' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="body1" fontWeight={600}>
                              {option.sku}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {option.productName}
                            </Typography>
                          </Box>
                          <Typography variant="body2" fontWeight={500} color="primary">
                            {option.price}
                          </Typography>
                        </Stack>
                      </Box>
                    </li>
                  )}
                  filterOptions={(options, { inputValue }) => {
                    const searchLower = inputValue.toLowerCase()
                    return options.filter(
                      (option) =>
                        option.sku.toLowerCase().includes(searchLower) ||
                        option.productName.toLowerCase().includes(searchLower) ||
                        option.barcode.includes(searchLower) ||
                        option.orderNumber.toLowerCase().includes(searchLower)
                    )
                  }}
                  noOptionsText={loadingProducts ? "Loading products..." : "No products found"}
                />
                <Button
                  variant="contained"
                  startIcon={<Search />}
                  onClick={handleSearch}
                  disabled={loading}
                  sx={{ minWidth: 120 }}
                >
                  {loading ? 'Searching...' : 'Search'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Brush />}
                  onClick={handleOpenGallery}
                  disabled={loading}
                  sx={{ minWidth: 150 }}
                  color="secondary"
                >
                  Photo History
                </Button>
              </Stack>

              {/* Quick Search Buttons */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Quick Search:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    label="Pre-Production Proto • ₹0"
                    onClick={() => handleQuickSearch('MMW-NEW-DESIGN')}
                    size="small"
                    variant="outlined"
                    color="secondary"
                  />
                  <Chip
                    label="Shawl Style Casual Lounge • ₹699"
                    onClick={() => handleQuickSearch('MMW-2804-S-CL')}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label="Floral Designer Silk Kurti • ₹799"
                    onClick={() => handleQuickSearch('MMW-4448-L-CLEAR')}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label="Nyra Maxi • ₹1599"
                    onClick={() => handleQuickSearch('MMW-1347-S-MAXI')}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label="Tharani Kurti Set • ₹1999"
                    onClick={() => handleQuickSearch('MMW-169-3XL-KURTI')}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        {/* Results Section */}
        {searchResults ? (
          <>
            {/* Product Info Card */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={3}>
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          SKU
                        </Typography>
                        <Typography variant="h6">{searchResults.sku}</Typography>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          Product
                        </Typography>
                        <Typography variant="body1">{searchResults.product_name}</Typography>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          Barcode
                        </Typography>
                        <Typography variant="body1">{searchResults.barcode || 'N/A'}</Typography>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          Current Status
                        </Typography>
                        <Chip
                          label={(searchResults.current_status || '').replace('_', ' ').toUpperCase()}
                          color={getStatusColor(searchResults.current_status || 'pending')}
                          size="small"
                        />
                      </Stack>
                    </Grid>
                    <Grid item xs={12}>
                      <Divider />
                    </Grid>
                    <Grid item xs={12}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <LocationOn color="primary" />
                        <Typography variant="body2" color="text.secondary">
                          Current Location:
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {searchResults.current_location || 'Unknown'}
                        </Typography>
                      </Stack>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Journey Timeline - Stepper */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
                  <TimelineIcon color="primary" />
                  <Typography variant="h6">Journey Timeline</Typography>
                </Stack>
                <Stepper activeStep={activeStep} alternativeLabel>
                  {searchResults.checkpoints.map((checkpoint: JourneyCheckpoint) => (
                    <Step key={checkpoint.id} completed={checkpoint.status === 'completed'}>
                      <StepLabel
                        error={checkpoint.status === 'delayed'}
                        StepIconComponent={() => (
                          <Avatar
                            sx={{
                              bgcolor:
                                checkpoint.status === 'completed'
                                  ? 'success.main'
                                  : checkpoint.status === 'in_progress'
                                    ? 'warning.main'
                                    : checkpoint.status === 'delayed'
                                      ? 'error.main'
                                      : 'grey.300',
                              width: 40,
                              height: 40,
                            }}
                          >
                            {getStatusIcon(checkpoint.status)}
                          </Avatar>
                        )}
                      >
                        <Typography variant="body2" fontWeight={500}>
                          {checkpoint.stage}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {checkpoint.location_name}
                        </Typography>
                      </StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Paper>
            </Grid>

            {/* Filters */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <FilterList color="primary" />
                  <Typography variant="h6">Filters</Typography>
                </Stack>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={statusFilter}
                        label="Status"
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <MenuItem value="all">All Status</MenuItem>
                        <MenuItem value="completed">Completed</MenuItem>
                        <MenuItem value="in_progress">In Progress</MenuItem>
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="delayed">Delayed</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Stage</InputLabel>
                      <Select
                        value={stageFilter}
                        label="Stage"
                        onChange={(e) => setStageFilter(e.target.value)}
                      >
                        <MenuItem value="all">All Stages</MenuItem>
                        <MenuItem value="Fabric Sourced">Fabric Sourced</MenuItem>
                        <MenuItem value="Design Approved">Design Approved</MenuItem>
                        <MenuItem value="In Production">In Production</MenuItem>
                        <MenuItem value="Received">Received</MenuItem>
                        <MenuItem value="Quality Check">Quality Check</MenuItem>
                        <MenuItem value="Storage">Storage</MenuItem>
                        <MenuItem value="Picked">Picked</MenuItem>
                        <MenuItem value="Packed">Packed</MenuItem>
                        <MenuItem value="Dispatched">Dispatched</MenuItem>
                        <MenuItem value="In Transit">In Transit</MenuItem>
                        <MenuItem value="Delivered">Delivered</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Location</InputLabel>
                      <Select
                        value={locationFilter}
                        label="Location"
                        onChange={(e) => setLocationFilter(e.target.value)}
                      >
                        <MenuItem value="all">All Locations</MenuItem>
                        <MenuItem value="WH-NYC">WH-NYC</MenuItem>
                        <MenuItem value="WH-LA">WH-LA</MenuItem>
                        <MenuItem value="STORE-SF">STORE-SF</MenuItem>
                        <MenuItem value="En Route">En Route</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
                <Box sx={{ mt: 2 }}>
                  <Chip
                    label={`Showing ${filteredCheckpoints.length} of ${searchResults?.checkpoints.length || 0} checkpoints`}
                    color="primary"
                    size="small"
                  />
                </Box>
              </Paper>
            </Grid>

            {/* Detailed Checkpoint History */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2.5 }}>
                <Typography variant="h6" gutterBottom>
                  Checkpoint Details
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Stage</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Location</TableCell>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>User</TableCell>
                        <TableCell>Notes</TableCell>
                        <TableCell>Expected Time</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredCheckpoints.map((checkpoint: JourneyCheckpoint) => (
                        <TableRow
                          key={checkpoint.id}
                          sx={{
                            bgcolor:
                              checkpoint.status === 'in_progress'
                                ? 'warning.light'
                                : checkpoint.status === 'delayed'
                                  ? 'error.light'
                                  : 'inherit',
                          }}
                        >
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              {checkpoint.stage === 'Fabric Sourced' && <Inventory fontSize="small" />}
                              {checkpoint.stage === 'Design Approved' && <Brush fontSize="small" />}
                              {checkpoint.stage === 'In Production' && <Factory fontSize="small" />}
                              {checkpoint.stage === 'Received' && <Inventory fontSize="small" />}
                              {checkpoint.stage === 'Quality Check' && <Assignment fontSize="small" />}
                              {checkpoint.stage === 'Dispatched' && <LocalShipping fontSize="small" />}
                              {checkpoint.stage === 'Delivered' && <CheckCircle fontSize="small" />}
                              <Typography variant="body2">{checkpoint.stage}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={checkpoint.status.replace('_', ' ')}
                              color={getStatusColor(checkpoint.status)}
                            />
                          </TableCell>
                          <TableCell>{checkpoint.location_name}</TableCell>
                          <TableCell>
                            {checkpoint.timestamp ? new Date(checkpoint.timestamp).toLocaleString() : '-'}
                          </TableCell>
                          <TableCell>
                            {checkpoint.user_name ? (
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Person fontSize="small" color="action" />
                                <Typography variant="body2">{checkpoint.user_name}</Typography>
                              </Stack>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {checkpoint.notes ? (
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Description fontSize="small" color="action" />
                                <Typography variant="body2">{checkpoint.notes}</Typography>
                              </Stack>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {checkpoint.expected_time ? (
                              <Typography variant="caption" color="text.secondary">
                                {new Date(checkpoint.expected_time).toLocaleString()}
                              </Typography>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              {checkpoint.attachment_url && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="secondary"
                                  component="a"
                                  href={checkpoint.attachment_url}
                                  target="_blank"
                                >
                                  View File
                                </Button>
                              )}
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Edit />}
                                onClick={() => handleOpenUpdate(checkpoint)}
                              >
                                Update
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </>
        ) : (
          <Grid item xs={12}>
            <Alert severity="info" icon={<Search />}>
              Enter a SKU, barcode, or order number above to track the product journey.
            </Alert>
          </Grid>
        )}
      </Grid>

      {/* Update Journey Checkpoint Dialog */}
      <Dialog open={updateDialogOpen} onClose={() => setUpdateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Manual Checkpoint</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 3 }}>
            Use this to manually progress upstream phases like Design and Production, or update Expected Warehouse Delivery dates if delayed.
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">Stage:</Typography>
              <Typography variant="body1" fontWeight={500}>{selectedCheckpoint?.stage}</Typography>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={updateForm.status}
                  label="Status"
                  onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="delayed">Delayed</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Expected Return/Completion Time"
                type="datetime-local"
                InputLabelProps={{ shrink: true }}
                value={updateForm.expectedTime}
                onChange={(e) => setUpdateForm({ ...updateForm, expectedTime: e.target.value })}
                helperText="Manually update this if there are delays in production or design."
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes (Approvals, Delays, etc)"
                multiline
                rows={3}
                value={updateForm.notes}
                onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpdateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveUpdate} variant="contained">Save Updates</Button>
        </DialogActions>
      </Dialog>

      {/* Photo Gallery Dialog */}
      <Dialog open={photosDialogOpen} onClose={() => setPhotosDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Photo & Pattern History</DialogTitle>
        <DialogContent dividers>
          {loadingPhotos ? (
            <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
          ) : galleryPhotos.length === 0 ? (
            <Alert severity="info" sx={{ m: 2 }}>No photos or patterns found for this product.</Alert>
          ) : (
            <Grid container spacing={2}>
              {galleryPhotos.map((photo, i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Card variant="outlined">
                    <CardContent>
                      <img src={photo.attachment_url} alt="Upload" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 4 }} />
                      <Typography variant="subtitle2" mt={1}>{photo.stage}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {new Date(photo.timestamp).toLocaleString()}
                      </Typography>
                      {photo.measurement_value && (
                        <Typography variant="caption" color="primary" display="block">
                          Fabric: {photo.measurement_value} {photo.measurement_unit}
                        </Typography>
                      )}
                      {photo.notes && (
                        <Typography variant="body2" mt={1} sx={{ fontStyle: 'italic' }}>"{photo.notes}"</Typography>
                      )}
                      {photo.user_name && (
                        <Typography variant="caption" color="text.secondary" mt={1} display="block">By {photo.user_name}</Typography>
                      )}
                      {photo.location_name && (
                        <Typography variant="caption" color="text.secondary" display="block">At {photo.location_name}</Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPhotosDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
