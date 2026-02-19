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
  ToggleButton,
  ToggleButtonGroup,
  ListItem,
  ListItemText,
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
  CurrencyRupee,
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, type SKU } from '../services/mdm.service'

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
  status: 'completed' | 'in_progress' | 'pending' | 'delayed'
  location: string
  timestamp?: string
  user?: string
  notes?: string
  expectedTime?: string
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

  // Load all products from API
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoadingProducts(true)
        const skus = await mdmService.getSKUs()
        
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

  // Mock data - replace with actual API call
  const mockJourneyData: Record<string, any> = {
    'MMW-2804-S-CL': {
      sku: 'MMW-2804-S-CL',
      productName: 'Shawl Style_V2 Casual Loungewear - Full Length',
      barcode: '74178073563812',
      currentStatus: 'in_transit',
      currentLocation: 'En Route to SHOPIFY-WH',
      orderNumber: 'ORD-2024-001',
    checkpoints: [
      {
        id: '1',
        stage: 'Received',
        status: 'completed' as const,
        location: 'WH-NYC',
        timestamp: '2024-02-10T10:00:00',
        user: 'John Smith',
        notes: 'Received from vendor, quantity verified',
        expectedTime: '2024-02-10T10:00:00',
      },
      {
        id: '2',
        stage: 'Quality Check',
        status: 'completed' as const,
        location: 'WH-NYC',
        timestamp: '2024-02-10T11:30:00',
        user: 'Sarah Johnson',
        notes: 'Quality inspection passed',
        expectedTime: '2024-02-10T11:00:00',
      },
      {
        id: '3',
        stage: 'Storage',
        status: 'completed' as const,
        location: 'WH-NYC - Bin A-15',
        timestamp: '2024-02-10T14:00:00',
        user: 'Mike Wilson',
        notes: 'Stored in designated bin',
        expectedTime: '2024-02-10T14:00:00',
      },
      {
        id: '4',
        stage: 'Picked',
        status: 'completed' as const,
        location: 'WH-NYC',
        timestamp: '2024-02-11T09:00:00',
        user: 'Emily Davis',
        notes: 'Picked for order ORD-2024-001',
        expectedTime: '2024-02-11T09:00:00',
      },
      {
        id: '5',
        stage: 'Packed',
        status: 'completed' as const,
        location: 'WH-NYC - Packing Station 3',
        timestamp: '2024-02-11T10:30:00',
        user: 'Robert Brown',
        notes: 'Packed in box #BOX-456, weight: 0.5kg',
        expectedTime: '2024-02-11T10:00:00',
      },
      {
        id: '6',
        stage: 'Dispatched',
        status: 'completed' as const,
        location: 'WH-NYC',
        timestamp: '2024-02-11T14:00:00',
        user: 'David Lee',
        notes: 'Loaded on Truck #TRK-789, Carrier: FedEx',
        expectedTime: '2024-02-11T14:00:00',
      },
      {
        id: '7',
        stage: 'In Transit',
        status: 'in_progress' as const,
        location: 'En Route',
        timestamp: '2024-02-11T14:30:00',
        user: 'System',
        notes: 'Last checkpoint: Chicago Hub',
        expectedTime: '2024-02-12T17:00:00',
      },
      {
        id: '8',
        stage: 'Delivered',
        status: 'pending' as const,
        location: 'STORE-SF',
        expectedTime: '2024-02-12T17:00:00',
      },
    ],
    },
    'MMW-1347-S-MAXI': {
      sku: 'MMW-1347-S-MAXI',
      productName: 'Nyra Maternity Maxi',
      barcode: '50460223539172',
      currentStatus: 'completed',
      currentLocation: 'SHOPIFY-WH',
      orderNumber: 'ORD-2024-002',
      checkpoints: [
        {
          id: '1',
          stage: 'Received',
          status: 'completed' as const,
          location: 'WH-LA',
          timestamp: '2024-02-08T09:00:00',
          user: 'Alice Brown',
          notes: 'Received from vendor',
          expectedTime: '2024-02-08T09:00:00',
        },
        {
          id: '2',
          stage: 'Quality Check',
          status: 'completed' as const,
          location: 'WH-LA',
          timestamp: '2024-02-08T10:00:00',
          user: 'Bob White',
          notes: 'Quality approved',
          expectedTime: '2024-02-08T10:00:00',
        },
        {
          id: '3',
          stage: 'Storage',
          status: 'completed' as const,
          location: 'WH-LA - Bin B-20',
          timestamp: '2024-02-08T11:00:00',
          user: 'Carol Green',
          notes: 'Stored successfully',
          expectedTime: '2024-02-08T11:00:00',
        },
        {
          id: '4',
          stage: 'Picked',
          status: 'completed' as const,
          location: 'WH-LA',
          timestamp: '2024-02-09T08:00:00',
          user: 'Dan Black',
          notes: 'Picked for order',
          expectedTime: '2024-02-09T08:00:00',
        },
        {
          id: '5',
          stage: 'Packed',
          status: 'completed' as const,
          location: 'WH-LA',
          timestamp: '2024-02-09T09:00:00',
          user: 'Eve Blue',
          notes: 'Packed in box #BOX-789',
          expectedTime: '2024-02-09T09:00:00',
        },
        {
          id: '6',
          stage: 'Dispatched',
          status: 'completed' as const,
          location: 'WH-LA',
          timestamp: '2024-02-09T10:00:00',
          user: 'Frank Red',
          notes: 'Dispatched via UPS',
          expectedTime: '2024-02-09T10:00:00',
        },
        {
          id: '7',
          stage: 'In Transit',
          status: 'completed' as const,
          location: 'En Route',
          timestamp: '2024-02-09T11:00:00',
          user: 'System',
          notes: 'In transit to store',
          expectedTime: '2024-02-10T15:00:00',
        },
        {
          id: '8',
          stage: 'Delivered',
          status: 'completed' as const,
          location: 'STORE-SF',
          timestamp: '2024-02-10T14:30:00',
          user: 'Store Manager',
          notes: 'Delivered and signed',
          expectedTime: '2024-02-10T15:00:00',
        },
      ],
    },
  }

  const handleSearch = () => {
    if (!searchTerm.trim()) return
    setLoading(true)
    // Simulate API call - search by SKU, barcode, order, or product name
    setTimeout(() => {
      const term = searchTerm.toLowerCase()
      let result = null
      
      // Search through all mock data
      for (const key in mockJourneyData) {
        const data = mockJourneyData[key]
        if (
          data.sku.toLowerCase().includes(term) ||
          data.barcode.includes(term) ||
          data.orderNumber.toLowerCase().includes(term) ||
          data.productName.toLowerCase().includes(term)
        ) {
          result = data
          break
        }
      }
      
      setSearchResults(result || mockJourneyData['MMW-2804-S-CL'])
      setLoading(false)
    }, 500)
  }

  const handleQuickSearch = (searchValue: string) => {
    setSearchTerm(searchValue)
    setTimeout(() => {
      const result = mockJourneyData[searchValue] || mockJourneyData['MMW-2804-S-CL']
      setSearchResults(result)
    }, 100)
  }

  const filteredCheckpoints = searchResults?.checkpoints.filter((cp: JourneyCheckpoint) => {
    if (statusFilter !== 'all' && cp.status !== statusFilter) return false
    if (stageFilter !== 'all' && cp.stage !== stageFilter) return false
    if (locationFilter !== 'all' && !cp.location.includes(locationFilter)) return false
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
              </Stack>
              
              {/* Quick Search Buttons */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Quick Search:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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
                        <Typography variant="body1">{searchResults.productName}</Typography>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          Order Number
                        </Typography>
                        <Typography variant="body1">{searchResults.orderNumber}</Typography>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          Current Status
                        </Typography>
                        <Chip
                          label={searchResults.currentStatus.replace('_', ' ').toUpperCase()}
                          color={getStatusColor(searchResults.currentStatus)}
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
                          {searchResults.currentLocation}
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
                          {checkpoint.location}
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
                          <TableCell>{checkpoint.location}</TableCell>
                          <TableCell>
                            {checkpoint.timestamp ? new Date(checkpoint.timestamp).toLocaleString() : '-'}
                          </TableCell>
                          <TableCell>
                            {checkpoint.user ? (
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Person fontSize="small" color="action" />
                                <Typography variant="body2">{checkpoint.user}</Typography>
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
                            {checkpoint.expectedTime ? (
                              <Typography variant="caption" color="text.secondary">
                                {new Date(checkpoint.expectedTime).toLocaleString()}
                              </Typography>
                            ) : (
                              '-'
                            )}
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
    </Box>
  )
}
