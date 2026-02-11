import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { QrCodeScanner, Refresh } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { inventoryService, type GoodsReceiptScanLog } from '../services/inventory.service'
import { mdmService, type Location } from '../services/mdm.service'
import { documentsService, type Document } from '../services/documents.service'

export default function InventoryReceiving() {
  const barcodeInputRef = useRef<HTMLInputElement | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [logs, setLogs] = useState<GoodsReceiptScanLog[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [showExceptionsOnly, setShowExceptionsOnly] = useState(false)
  const [resultFilter, setResultFilter] = useState<'all' | 'matched' | 'mismatch' | 'over_receipt' | 'unknown'>('all')
  const [barcodeFilter, setBarcodeFilter] = useState('')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'info' },
  )

  const [form, setForm] = useState({
    barcode_value: '',
    location_id: '',
    document_id: '',
    quantity: '1',
    strict: true,
  })

  const loadData = async () => {
    const toArray = <T,>(data: unknown): T[] => {
      if (Array.isArray(data)) return data as T[]
      if (data && typeof data === 'object' && 'results' in data) {
        const paged = data as { results?: unknown }
        return Array.isArray(paged.results) ? (paged.results as T[]) : []
      }
      return []
    }

    try {
      const [locationData, documentData, logData] = await Promise.all([
        mdmService.getLocations(),
        documentsService.getDocuments(),
        inventoryService.getGoodsReceiptScans(),
      ])
      setLocations(toArray<Location>(locationData))
      setDocuments(toArray<Document>(documentData))
      setLogs(toArray<GoodsReceiptScanLog>(logData))
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load receiving workspace data.', severity: 'error' })
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const recentDocuments = useMemo(() => documents.slice(0, 5), [documents])

  const filteredLogs = useMemo(() => {
    let result = [...logs]
    if (showExceptionsOnly) {
      result = result.filter((log) => log.result !== 'matched')
    }
    if (resultFilter !== 'all') {
      result = result.filter((log) => log.result === resultFilter)
    }
    if (barcodeFilter.trim()) {
      const term = barcodeFilter.trim().toLowerCase()
      result = result.filter(
        (log) =>
          log.barcode_value.toLowerCase().includes(term) ||
          (log.sku_code || '').toLowerCase().includes(term),
      )
    }
    return result
  }, [logs, showExceptionsOnly, resultFilter, barcodeFilter])

  const focusBarcodeInput = () => {
    setTimeout(() => barcodeInputRef.current?.focus(), 50)
  }

  const handleScan = async () => {
    if (!form.barcode_value || !form.location_id) {
      setSnackbar({ open: true, message: 'Barcode and location are required.', severity: 'error' })
      return
    }
    setIsScanning(true)
    try {
      const result = await inventoryService.scanGoodsReceipt({
        barcode_value: form.barcode_value,
        location_id: form.location_id,
        document_id: form.document_id || undefined,
        quantity: Number(form.quantity),
        strict: form.strict,
      })
      setLogs((prev) => [result, ...prev])
      setSnackbar({ open: true, message: `Scan completed: ${result.result}.`, severity: 'success' })
      setForm((prev) => ({ ...prev, barcode_value: '' }))
      focusBarcodeInput()
    } catch (error) {
      setSnackbar({ open: true, message: 'Scan failed.', severity: 'error' })
      focusBarcodeInput()
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <Box>
      <PageHeader
        title="Goods Receipt Scanning"
        subtitle="Confirm inbound goods with barcode scans and document-aware validation."
        actions={
          <Button variant="outlined" startIcon={<Refresh />} onClick={() => void loadData()}>
            Refresh
          </Button>
        }
      />

      <Grid container spacing={2.5}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h6" gutterBottom>
              Receive by Scan
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Barcode Value"
                  inputRef={barcodeInputRef}
                  value={form.barcode_value}
                  onChange={(e) => setForm((prev) => ({ ...prev, barcode_value: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleScan()
                    }
                  }}
                  helperText="Scan and press Enter to submit quickly."
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Location</InputLabel>
                  <Select
                    value={form.location_id}
                    label="Location"
                    onChange={(e) => setForm((prev) => ({ ...prev, location_id: e.target.value }))}
                  >
                    {locations.map((loc) => (
                      <MenuItem key={loc.id} value={loc.id}>
                        {loc.code} - {loc.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Source Document (Optional)</InputLabel>
                  <Select
                    value={form.document_id}
                    label="Source Document (Optional)"
                    onChange={(e) => setForm((prev) => ({ ...prev, document_id: e.target.value }))}
                  >
                    <MenuItem value="">None</MenuItem>
                    {documents.map((doc) => (
                      <MenuItem key={doc.id} value={doc.id}>
                        {doc.document_number}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Quantity"
                  value={form.quantity}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Validation Mode</InputLabel>
                  <Select
                    value={form.strict ? 'strict' : 'relaxed'}
                    label="Validation Mode"
                    onChange={(e) => setForm((prev) => ({ ...prev, strict: e.target.value === 'strict' }))}
                  >
                    <MenuItem value="strict">Strict</MenuItem>
                    <MenuItem value="relaxed">Relaxed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack direction="row" sx={{ height: '100%' }} alignItems="center">
                  <Button
                    variant="contained"
                    startIcon={<QrCodeScanner />}
                    onClick={() => void handleScan()}
                    disabled={isScanning}
                  >
                    {isScanning ? 'Scanning...' : 'Confirm Scan'}
                  </Button>
                </Stack>
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography variant="body2" color="text.secondary">
                    Recent documents:
                  </Typography>
                  <Chip
                    size="small"
                    label="None"
                    color={form.document_id === '' ? 'primary' : 'default'}
                    onClick={() => setForm((prev) => ({ ...prev, document_id: '' }))}
                  />
                  {recentDocuments.map((doc) => (
                    <Chip
                      key={doc.id}
                      size="small"
                      label={doc.document_number}
                      color={form.document_id === doc.id ? 'primary' : 'default'}
                      onClick={() => setForm((prev) => ({ ...prev, document_id: doc.id }))}
                    />
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2.5 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', md: 'center' }}
              sx={{ mb: 1.5 }}
            >
              <Typography variant="h6">Scan Audit Log</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: { xs: '100%', md: 'auto' } }}>
                <TextField
                  size="small"
                  label="Search Barcode/SKU"
                  value={barcodeFilter}
                  onChange={(e) => setBarcodeFilter(e.target.value)}
                />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Result</InputLabel>
                  <Select
                    value={resultFilter}
                    label="Result"
                    onChange={(e) =>
                      setResultFilter(e.target.value as 'all' | 'matched' | 'mismatch' | 'over_receipt' | 'unknown')
                    }
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="matched">Matched</MenuItem>
                    <MenuItem value="mismatch">Mismatch</MenuItem>
                    <MenuItem value="over_receipt">Over Receipt</MenuItem>
                    <MenuItem value="unknown">Unknown</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showExceptionsOnly}
                      onChange={(e) => setShowExceptionsOnly(e.target.checked)}
                    />
                  }
                  label="Exceptions Only"
                />
              </Stack>
            </Stack>
            {filteredLogs.length === 0 ? (
              <Alert severity="info">No scan logs available yet.</Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Scanned At</TableCell>
                      <TableCell>Barcode</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell>Quantity</TableCell>
                      <TableCell>Result</TableCell>
                      <TableCell>Message</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{new Date(log.scanned_at).toLocaleString()}</TableCell>
                        <TableCell>{log.barcode_value}</TableCell>
                        <TableCell>{log.sku_code || '-'}</TableCell>
                        <TableCell>{log.location_code || log.location}</TableCell>
                        <TableCell>{log.quantity}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={log.result}
                            color={
                              log.result === 'matched'
                                ? 'success'
                                : log.result === 'over_receipt'
                                ? 'warning'
                                : 'error'
                            }
                          />
                        </TableCell>
                        <TableCell>{log.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
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
    </Box>
  )
}
