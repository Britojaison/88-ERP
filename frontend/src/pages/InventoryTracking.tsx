import { useEffect, useState } from 'react'
import {
  Alert,
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
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import {
  Refresh,
  CheckCircle,
  Error,
  Warning as WarningIcon,
  Timeline,
  Inventory2,
  QrCodeScanner,
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { inventoryService, type InventoryMovement, type GoodsReceiptScanLog } from '../services/inventory.service'
import { mdmService, type Location } from '../services/mdm.service'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export default function InventoryTracking() {
  const [tabValue, setTabValue] = useState(0)
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [scanLogs, setScanLogs] = useState<GoodsReceiptScanLog[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('7')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'info' },
  )
  const [movementPage, setMovementPage] = useState(1)
  const [movementCount, setMovementCount] = useState(0)
  const [scanPage, setScanPage] = useState(1)
  const [scanCount, setScanCount] = useState(0)

  const loadData = async (mPage = 1, sPage = 1) => {
    try {
      const [movementData, scanData, locationData] = await Promise.all([
        inventoryService.getMovements({ page: mPage, search: searchTerm }),
        inventoryService.getGoodsReceiptScans({ page: sPage, search: searchTerm }),
        mdmService.getLocations(),
      ])

      if (movementData && 'results' in movementData) {
        setMovements(movementData.results)
        setMovementCount(movementData.count)
        setMovementPage(mPage)
      } else {
        setMovements(movementData as InventoryMovement[])
      }

      if (scanData && 'results' in scanData) {
        setScanLogs(scanData.results)
        setScanCount(scanData.count)
        setScanPage(sPage)
      } else {
        setScanLogs(scanData as GoodsReceiptScanLog[])
      }

      setLocations(Array.isArray(locationData) ? locationData : (locationData as any).results || [])
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load tracking data.', severity: 'error' })
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData(1, 1)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    void loadData(movementPage, scanPage)
  }, [locationFilter, dateRange])

  // Filter movements
  const filteredMovements = movements.filter((movement) => {
    const daysAgo = parseInt(dateRange)
    const movementDate = new Date(movement.movement_date)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo)

    if (movementDate < cutoffDate) return false
    if (locationFilter !== 'all') {
      const matchesFrom = movement.from_location === locationFilter
      const matchesTo = movement.to_location === locationFilter
      if (!matchesFrom && !matchesTo) return false
    }
    if (searchTerm && !movement.sku_code?.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  // Filter scan logs
  const filteredScans = scanLogs.filter((scan) => {
    const daysAgo = parseInt(dateRange)
    const scanDate = new Date(scan.scanned_at)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo)

    if (scanDate < cutoffDate) return false
    if (locationFilter !== 'all' && scan.location !== locationFilter) return false
    if (searchTerm && !scan.barcode_value?.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  // Calculate statistics
  const stats = {
    totalMovements: filteredMovements.length,
    totalScans: filteredScans.length,
    successfulScans: filteredScans.filter((s) => s.result === 'matched').length,
    failedScans: filteredScans.filter((s) => s.result !== 'matched').length,
    receipts: filteredMovements.filter((m) => m.movement_type === 'receipt').length,
    issues: filteredMovements.filter((m) => m.movement_type === 'issue').length,
    transfers: filteredMovements.filter((m) => m.movement_type === 'transfer').length,
    totalValue: filteredMovements.reduce((sum, m) => sum + parseFloat(m.total_cost), 0),
  }

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'receipt':
      case 'return':
        return 'success'
      case 'issue':
        return 'error'
      case 'transfer':
        return 'info'
      case 'adjustment':
        return 'warning'
      default:
        return 'default'
    }
  }

  return (
    <Box>
      <PageHeader
        title="Inventory Tracking & Audit Trail"
        subtitle="Complete visibility into all inventory movements and scan confirmations with full audit trail."
        actions={
          <Button variant="outlined" startIcon={<Refresh />} onClick={() => void loadData()}>
            Refresh
          </Button>
        }
      />

      <Grid container spacing={2.5}>
        {/* Statistics Cards */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total Movements
                      </Typography>
                      <Typography variant="h4">{stats.totalMovements}</Typography>
                    </Box>
                    <Timeline color="primary" sx={{ fontSize: 40 }} />
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Chip size="small" label={`↑ ${stats.receipts}`} color="success" />
                    <Chip size="small" label={`↓ ${stats.issues}`} color="error" />
                    <Chip size="small" label={`⇄ ${stats.transfers}`} color="info" />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total Scans
                      </Typography>
                      <Typography variant="h4">{stats.totalScans}</Typography>
                    </Box>
                    <QrCodeScanner color="info" sx={{ fontSize: 40 }} />
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Chip size="small" label={`✓ ${stats.successfulScans}`} color="success" />
                    <Chip size="small" label={`✗ ${stats.failedScans}`} color="error" />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total Value
                      </Typography>
                      <Typography variant="h4">${stats.totalValue.toFixed(0)}</Typography>
                    </Box>
                    <Inventory2 color="success" sx={{ fontSize: 40 }} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    Tracked movements value
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Scan Success Rate
                      </Typography>
                      <Typography variant="h4">
                        {stats.totalScans > 0 ? ((stats.successfulScans / stats.totalScans) * 100).toFixed(0) : 0}%
                      </Typography>
                    </Box>
                    <CheckCircle color="success" sx={{ fontSize: 40 }} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    Validation accuracy
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Filters */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2.5 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Search SKU/Barcode"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
                sx={{ minWidth: 200 }}
              />
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Location</InputLabel>
                <Select value={locationFilter} label="Location" onChange={(e) => setLocationFilter(e.target.value)}>
                  <MenuItem value="all">All Locations</MenuItem>
                  {locations.map((loc) => (
                    <MenuItem key={loc.id} value={loc.id}>
                      {loc.code} - {loc.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Date Range</InputLabel>
                <Select value={dateRange} label="Date Range" onChange={(e) => setDateRange(e.target.value)}>
                  <MenuItem value="1">Last 24 Hours</MenuItem>
                  <MenuItem value="7">Last 7 Days</MenuItem>
                  <MenuItem value="30">Last 30 Days</MenuItem>
                  <MenuItem value="90">Last 90 Days</MenuItem>
                  <MenuItem value="365">Last Year</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Paper>
        </Grid>

        {/* Tabs */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2.5 }}>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
              <Tab label={`Movements (${movementCount})`} />
              <Tab label={`Scan Logs (${scanCount})`} />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              {filteredMovements.length === 0 ? (
                <Alert severity="info">
                  {searchTerm || locationFilter !== 'all' || dateRange !== '7'
                    ? "No inventory movements match your current filters. Try relaxing the search criteria."
                    : "No inventory has been moved or received yet. Whenever items are transferred, sold, or brought into a location, they'll be tracked here."}
                </Alert>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date & Time</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell>From Location</TableCell>
                        <TableCell>To Location</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Unit Cost</TableCell>
                        <TableCell align="right">Total Cost</TableCell>
                        <TableCell>Reference</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {movements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell>{new Date(movement.movement_date).toLocaleString()}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={movement.movement_type}
                              color={getMovementColor(movement.movement_type) as any}
                            />
                          </TableCell>
                          <TableCell>{movement.sku_code || movement.sku}</TableCell>
                          <TableCell>{movement.from_location_code || movement.from_location || '-'}</TableCell>
                          <TableCell>{movement.to_location_code || movement.to_location || '-'}</TableCell>
                          <TableCell align="right">{movement.quantity}</TableCell>
                          <TableCell align="right">${movement.unit_cost}</TableCell>
                          <TableCell align="right">${movement.total_cost}</TableCell>
                          <TableCell>{movement.reference_number || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {movementCount > 50 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Showing {(movementPage - 1) * 50 + 1}-{Math.min(movementPage * 50, movementCount)} of {movementCount} movements
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={movementPage === 1}
                      onClick={() => void loadData(movementPage - 1, scanPage)}
                    >
                      Previous
                    </Button>
                    <Typography variant="body2" sx={{ px: 1, fontWeight: 500 }}>
                      Page {movementPage}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={movementPage * 50 >= movementCount}
                      onClick={() => void loadData(movementPage + 1, scanPage)}
                    >
                      Next
                    </Button>
                  </Stack>
                </Box>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {scanLogs.length === 0 ? (
                <Alert severity="info">
                  {searchTerm || locationFilter !== 'all' || dateRange !== '7'
                    ? "No scan logs match your current filters. Try relaxing the search criteria."
                    : "No barcodes have been scanned yet. Go to 'Receiving' and scan product barcodes to track them."}
                </Alert>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Scanned At</TableCell>
                        <TableCell>Barcode Value</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell>Location</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell>Result</TableCell>
                        <TableCell>Message</TableCell>
                        <TableCell>Batch/Serial</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scanLogs.map((scan) => (
                        <TableRow key={scan.id}>
                          <TableCell>{new Date(scan.scanned_at).toLocaleString()}</TableCell>
                          <TableCell>{scan.barcode_value}</TableCell>
                          <TableCell>{scan.sku_code || '-'}</TableCell>
                          <TableCell>{scan.location_code || scan.location}</TableCell>
                          <TableCell align="right">{scan.quantity}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              icon={
                                scan.result === 'matched' ? (
                                  <CheckCircle fontSize="small" />
                                ) : scan.result === 'over_receipt' ? (
                                  <WarningIcon fontSize="small" />
                                ) : (
                                  <Error fontSize="small" />
                                )
                              }
                              label={scan.result}
                              color={
                                scan.result === 'matched'
                                  ? 'success'
                                  : scan.result === 'over_receipt'
                                    ? 'warning'
                                    : 'error'
                              }
                            />
                          </TableCell>
                          <TableCell>{scan.message}</TableCell>
                          <TableCell>
                            {scan.batch_number || scan.serial_number
                              ? `${scan.batch_number || ''} ${scan.serial_number || ''}`.trim()
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {scanCount > 50 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Showing {(scanPage - 1) * 50 + 1}-{Math.min(scanPage * 50, scanCount)} of {scanCount} scans
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={scanPage === 1}
                      onClick={() => void loadData(movementPage, scanPage - 1)}
                    >
                      Previous
                    </Button>
                    <Typography variant="body2" sx={{ px: 1, fontWeight: 500 }}>
                      Page {scanPage}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={scanPage * 50 >= scanCount}
                      onClick={() => void loadData(movementPage, scanPage + 1)}
                    >
                      Next
                    </Button>
                  </Stack>
                </Box>
              )}
            </TabPanel>
          </Paper>
        </Grid>
      </Grid>

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
