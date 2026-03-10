import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
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
  QrCodeScanner,
  Refresh,
  Warning,
  CloudUpload,
  CameraAlt,
  BrokenImage,
  Delete,
  CheckCircle,
  ErrorOutline,
  PlayArrow,
  Stop,
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { inventoryService, type GoodsReceiptScanLog } from '../services/inventory.service'
import { mdmService, type Location } from '../services/mdm.service'

interface ScanQueueItem {
  id: string
  barcode_value: string
  sku_code: string
  product_name: string
  location_code: string
  quantity: number
  result: 'matched' | 'mismatch' | 'over_receipt' | 'unknown'
  message: string
  scanned_at: string
}

export default function InventoryReceiving() {
  const barcodeInputRef = useRef<HTMLInputElement | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [locations, setLocations] = useState<Location[]>([])
  const [logs, setLogs] = useState<GoodsReceiptScanLog[]>([])
  const [damageRecords, setDamageRecords] = useState<any[]>([])
  const [unviewedDamageCount, setUnviewedDamageCount] = useState(0)
  const [isScanning, setIsScanning] = useState(false)
  const [showExceptionsOnly, setShowExceptionsOnly] = useState(false)
  const [resultFilter, setResultFilter] = useState<'all' | 'matched' | 'mismatch' | 'over_receipt' | 'unknown'>('all')
  const [barcodeFilter, setBarcodeFilter] = useState('')
  const [openDamageDialog, setOpenDamageDialog] = useState(false)
  const [openDamageFormDialog, setOpenDamageFormDialog] = useState(false)
  const [openCameraDialog, setOpenCameraDialog] = useState(false)
  const [currentScanResult, setCurrentScanResult] = useState<GoodsReceiptScanLog | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [damageForm, setDamageForm] = useState({
    damage_type: '',
    severity: '',
    description: '',
    suggested_action: '',
    photo: null as File | null,
  })
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'info' },
  )

  const [form, setForm] = useState({
    barcode_value: '',
    location_id: '',
    quantity: '1',
    strict: true,
  })

  // ─── Multi-scan mode state ───
  const [scanQueue, setScanQueue] = useState<ScanQueueItem[]>([])
  const [multiScanMode, setMultiScanMode] = useState(false)
  const [scanCount, setScanCount] = useState(0)

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
      const [locationData, logData] = await Promise.all([
        mdmService.getLocations(),
        inventoryService.getGoodsReceiptScans(),
      ])
      setLocations(toArray<Location>(locationData))
      setLogs(toArray<GoodsReceiptScanLog>(logData))
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load receiving workspace data.', severity: 'error' })
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

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

  // ─── Multi-scan: handle each scan ───
  const handleScan = async () => {
    if (!form.barcode_value || !form.location_id) {
      setSnackbar({ open: true, message: 'Barcode and location are required.', severity: 'error' })
      focusBarcodeInput()
      return
    }
    setIsScanning(true)
    try {
      const result = await inventoryService.scanGoodsReceipt({
        barcode_value: form.barcode_value,
        location_id: form.location_id,
        quantity: Number(form.quantity),
        strict: form.strict,
      })

      // Add to logs
      setLogs((prev) => [result, ...prev])

      // Get location name
      const loc = locations.find(l => l.id === form.location_id)

      if (multiScanMode) {
        // In multi-scan: add to queue, auto-refocus, NO damage dialog
        const queueItem: ScanQueueItem = {
          id: result.id || crypto.randomUUID(),
          barcode_value: result.barcode_value,
          sku_code: result.sku_code || 'Unknown',
          product_name: result.sku_code || result.barcode_value,
          location_code: result.location_code || loc?.code || '',
          quantity: Number(result.quantity),
          result: result.result,
          message: result.message,
          scanned_at: new Date().toISOString(),
        }

        setScanQueue((prev) => {
          // Check if same barcode was already scanned at same location
          const existing = prev.find(
            q => q.barcode_value === result.barcode_value && q.location_code === queueItem.location_code
          )
          if (existing) {
            // Increment quantity on existing entry
            return prev.map(q =>
              q.id === existing.id
                ? { ...q, quantity: q.quantity + Number(result.quantity) }
                : q
            )
          }
          return [queueItem, ...prev]
        })

        setScanCount(prev => prev + 1)

        // Flash feedback
        if (result.result === 'matched') {
          setSnackbar({ open: true, message: `✓ ${result.sku_code || result.barcode_value} — ${result.quantity} received`, severity: 'success' })
        } else {
          setSnackbar({ open: true, message: `⚠ ${result.message}`, severity: 'error' })
        }

        // Clear barcode field, auto-refocus for next scan
        setForm(prev => ({ ...prev, barcode_value: '' }))
        focusBarcodeInput()
      } else {
        // Single scan mode: show damage dialog as before
        setCurrentScanResult(result)
        setOpenDamageDialog(true)
        setForm(prev => ({ ...prev, barcode_value: '' }))
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Scan failed.', severity: 'error' })
      focusBarcodeInput()
    } finally {
      setIsScanning(false)
    }
  }

  const handleDamageDialogResponse = (isDamaged: boolean) => {
    setOpenDamageDialog(false)
    if (isDamaged) {
      setOpenDamageFormDialog(true)
    } else {
      setSnackbar({ open: true, message: 'Item received in good condition.', severity: 'success' })
      focusBarcodeInput()
    }
  }

  const handleDamageFormSubmit = async () => {
    if (!damageForm.damage_type || !damageForm.severity) {
      setSnackbar({ open: true, message: 'Damage type and severity are required.', severity: 'error' })
      return
    }

    try {
      const damageRecord = {
        id: Date.now().toString(),
        scan_log_id: currentScanResult?.id,
        sku_code: currentScanResult?.sku_code || 'N/A',
        barcode: currentScanResult?.barcode_value || 'N/A',
        quantity: currentScanResult?.quantity || 1,
        damage_type: damageForm.damage_type,
        severity: damageForm.severity,
        description: damageForm.description,
        suggested_action: damageForm.suggested_action,
        photo: damageForm.photo?.name || null,
        recorded_at: new Date().toISOString(),
        location: currentScanResult?.location_code || 'N/A',
      }

      setDamageRecords((prev) => [damageRecord, ...prev])
      setUnviewedDamageCount((prev) => prev + 1)

      setSnackbar({ open: true, message: 'Damage recorded successfully.', severity: 'success' })
      setOpenDamageFormDialog(false)
      setDamageForm({
        damage_type: '',
        severity: '',
        description: '',
        suggested_action: '',
        photo: null,
      })
      focusBarcodeInput()
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to record damage.', severity: 'error' })
    }
  }

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setDamageForm((prev) => ({ ...prev, photo: file }))
    }
  }

  const handleOpenCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      setCameraStream(stream)
      setOpenCameraDialog(true)

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      }, 100)
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Camera access denied. Please allow camera permissions.',
        severity: 'error'
      })
    }
  }

  const handleCloseCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setOpenCameraDialog(false)
  }

  const handleTabChange = (newValue: number) => {
    setActiveTab(newValue)
    if (newValue === 2) {
      setUnviewedDamageCount(0)
    }
  }

  const handleCapturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const context = canvas.getContext('2d')
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `damage-photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
            setDamageForm((prev) => ({ ...prev, photo: file }))
            handleCloseCamera()
            setSnackbar({ open: true, message: 'Photo captured successfully!', severity: 'success' })
          }
        }, 'image/jpeg', 0.9)
      }
    }
  }

  // ─── Multi-scan helpers ───
  const startMultiScan = () => {
    if (!form.location_id) {
      setSnackbar({ open: true, message: 'Please select a location before starting multi-scan.', severity: 'error' })
      return
    }
    setMultiScanMode(true)
    setScanQueue([])
    setScanCount(0)
    setSnackbar({ open: true, message: 'Multi-scan mode started! Scan barcodes continuously.', severity: 'info' })
    focusBarcodeInput()
  }

  const stopMultiScan = () => {
    setMultiScanMode(false)
    setSnackbar({
      open: true,
      message: `Multi-scan session complete. ${scanCount} scan(s) processed.`,
      severity: 'success'
    })
  }

  const removeFromQueue = (queueId: string) => {
    setScanQueue(prev => prev.filter(q => q.id !== queueId))
  }

  const totalReceived = scanQueue.reduce((sum, q) => q.result === 'matched' ? sum + q.quantity : sum, 0)
  const totalErrors = scanQueue.filter(q => q.result !== 'matched').length

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
          <Paper sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={(_, newValue) => handleTabChange(newValue)}>
              <Tab label="Receive by Scan" />
              <Tab label="Scan Audit Log" />
              <Tab
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>Damaged Items</span>
                    {unviewedDamageCount > 0 && (
                      <Chip size="small" label={unviewedDamageCount} color="error" />
                    )}
                  </Stack>
                }
              />
            </Tabs>
          </Paper>
        </Grid>

        {/* Tab 0: Receive by Scan */}
        {activeTab === 0 && (
          <>
            <Grid item xs={12}>
              <Paper sx={{ p: 2.5 }}>
                {/* Multi-scan mode banner */}
                {multiScanMode && (
                  <Box sx={{
                    mb: 2, p: 1.5, borderRadius: 1,
                    bgcolor: 'success.main', color: 'white',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <QrCodeScanner />
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>
                          Multi-Scan Mode Active
                        </Typography>
                        <Typography variant="caption">
                          Keep scanning — each barcode is received instantly. {scanCount} scan(s) this session.
                        </Typography>
                      </Box>
                    </Stack>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Stop />}
                      onClick={stopMultiScan}
                      sx={{ bgcolor: 'white', color: 'success.main', '&:hover': { bgcolor: 'grey.100' } }}
                    >
                      End Session
                    </Button>
                  </Box>
                )}

                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6">
                    Receive by Scan
                  </Typography>
                  {!multiScanMode && (
                    <Button
                      variant="outlined"
                      size="small"
                      color="success"
                      startIcon={<PlayArrow />}
                      onClick={startMultiScan}
                    >
                      Start Multi-Scan
                    </Button>
                  )}
                </Stack>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={multiScanMode ? 6 : 4}>
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
                      autoFocus={multiScanMode}
                      helperText={multiScanMode ? 'Scan barcode — auto-submits on Enter' : 'Scan and press Enter to submit quickly.'}
                      sx={multiScanMode ? {
                        '& .MuiOutlinedInput-root': {
                          borderColor: 'success.main',
                          '& fieldset': { borderColor: 'success.main', borderWidth: 2 },
                        }
                      } : undefined}
                    />
                  </Grid>
                  <Grid item xs={12} md={multiScanMode ? 4 : 4}>
                    <FormControl fullWidth>
                      <InputLabel>Location</InputLabel>
                      <Select
                        value={form.location_id}
                        label="Location"
                        onChange={(e) => setForm((prev) => ({ ...prev, location_id: e.target.value }))}
                        disabled={multiScanMode}
                      >
                        {locations.map((loc) => (
                          <MenuItem key={loc.id} value={loc.id}>
                            {loc.code} - {loc.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={multiScanMode ? 2 : 4}>
                    <TextField
                      fullWidth
                      label="Quantity"
                      value={form.quantity}
                      onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                      type="number"
                      inputProps={{ min: 1 }}
                    />
                  </Grid>
                  {!multiScanMode && (
                    <>
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
                    </>
                  )}
                </Grid>

                {isScanning && <LinearProgress sx={{ mt: 1 }} />}
              </Paper>
            </Grid>

            {/* Scan Queue (visible in multi-scan or when queue has items) */}
            {(multiScanMode || scanQueue.length > 0) && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="h6">Scan Queue</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {scanQueue.length} unique item{scanQueue.length !== 1 ? 's' : ''} • {totalReceived} unit{totalReceived !== 1 ? 's' : ''} received
                        {totalErrors > 0 && (
                          <Chip
                            size="small"
                            label={`${totalErrors} error${totalErrors !== 1 ? 's' : ''}`}
                            color="error"
                            sx={{ ml: 1, height: 20, fontSize: 11 }}
                          />
                        )}
                      </Typography>
                    </Box>
                    {scanQueue.length > 0 && (
                      <Button
                        size="small"
                        color="error"
                        variant="text"
                        onClick={() => setScanQueue([])}
                      >
                        Clear Queue
                      </Button>
                    )}
                  </Stack>

                  {scanQueue.length === 0 ? (
                    <Alert severity="info">
                      Start scanning barcodes. Each scanned item will appear here with its status.
                    </Alert>
                  ) : (
                    <TableContainer sx={{ maxHeight: 400 }}>
                      <Table stickyHeader size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: 30 }}></TableCell>
                            <TableCell>SKU Code</TableCell>
                            <TableCell>Barcode</TableCell>
                            <TableCell>Location</TableCell>
                            <TableCell align="center">Qty</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Message</TableCell>
                            <TableCell>Time</TableCell>
                            <TableCell sx={{ width: 40 }}></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {scanQueue.map((item) => (
                            <TableRow
                              key={item.id}
                              hover
                              sx={{
                                bgcolor: item.result === 'matched'
                                  ? 'rgba(46, 125, 50, 0.04)'
                                  : 'rgba(211, 47, 47, 0.04)',
                              }}
                            >
                              <TableCell>
                                {item.result === 'matched' ? (
                                  <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} />
                                ) : (
                                  <ErrorOutline sx={{ fontSize: 18, color: 'error.main' }} />
                                )}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>{item.sku_code}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                                  {item.barcode_value}
                                </Typography>
                              </TableCell>
                              <TableCell>{item.location_code}</TableCell>
                              <TableCell align="center">
                                <Chip label={item.quantity} size="small" color="primary" sx={{ fontWeight: 700, minWidth: 36 }} />
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={item.result}
                                  color={
                                    item.result === 'matched' ? 'success'
                                      : item.result === 'over_receipt' ? 'warning'
                                        : 'error'
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" color="text.secondary">{item.message}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(item.scanned_at).toLocaleTimeString()}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <IconButton size="small" onClick={() => removeFromQueue(item.id)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Paper>
              </Grid>
            )}
          </>
        )}

        {/* Tab 1: Scan Audit Log */}
        {activeTab === 1 && (
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
        )}

        {/* Tab 2: Damaged Items */}
        {activeTab === 2 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">Damaged Items Log</Typography>
                <Chip
                  icon={<BrokenImage />}
                  label={`${damageRecords.length} Damaged Item${damageRecords.length !== 1 ? 's' : ''}`}
                  color="error"
                />
              </Stack>
              {damageRecords.length === 0 ? (
                <Alert severity="info">No damaged items recorded yet.</Alert>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Recorded At</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell>Barcode</TableCell>
                        <TableCell>Quantity</TableCell>
                        <TableCell>Damage Type</TableCell>
                        <TableCell>Severity</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Suggested Action</TableCell>
                        <TableCell>Location</TableCell>
                        <TableCell>Photo</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {damageRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{new Date(record.recorded_at).toLocaleString()}</TableCell>
                          <TableCell>{record.sku_code}</TableCell>
                          <TableCell>{record.barcode}</TableCell>
                          <TableCell>{record.quantity}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={record.damage_type.replace('_', ' ')}
                              color="warning"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={record.severity}
                              color={
                                record.severity === 'critical' ? 'error' :
                                  record.severity === 'major' ? 'warning' : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell>{record.description || '-'}</TableCell>
                          <TableCell>{record.suggested_action ? record.suggested_action.replace('_', ' ') : '-'}</TableCell>
                          <TableCell>{record.location}</TableCell>
                          <TableCell>
                            {record.photo ? (
                              <Chip size="small" label="Yes" color="success" />
                            ) : (
                              <Chip size="small" label="No" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Damage Check Dialog */}
      <Dialog open={openDamageDialog} onClose={() => handleDamageDialogResponse(false)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" />
          Item Condition Check
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Is this item damaged?
          </Typography>
          {currentScanResult && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                SKU: {currentScanResult.sku_code || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Barcode: {currentScanResult.barcode_value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Quantity: {currentScanResult.quantity}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleDamageDialogResponse(false)} color="success" variant="contained">
            No - Good Condition
          </Button>
          <Button onClick={() => handleDamageDialogResponse(true)} color="error" variant="outlined">
            Yes - Item is Damaged
          </Button>
        </DialogActions>
      </Dialog>

      {/* Damage Details Form Dialog */}
      <Dialog
        open={openDamageFormDialog}
        onClose={() => setOpenDamageFormDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Record Damage Details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Damage Type</InputLabel>
              <Select
                value={damageForm.damage_type}
                label="Damage Type"
                onChange={(e) => setDamageForm((prev) => ({ ...prev, damage_type: e.target.value }))}
              >
                <MenuItem value="physical">Physical Damage</MenuItem>
                <MenuItem value="packaging">Packaging Damage</MenuItem>
                <MenuItem value="quality">Quality Issue</MenuItem>
                <MenuItem value="missing_parts">Missing Parts</MenuItem>
                <MenuItem value="wrong_item">Wrong Item</MenuItem>
                <MenuItem value="expired">Expired/Near Expiry</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Severity</InputLabel>
              <Select
                value={damageForm.severity}
                label="Severity"
                onChange={(e) => setDamageForm((prev) => ({ ...prev, severity: e.target.value }))}
              >
                <MenuItem value="minor">Minor - Cosmetic only</MenuItem>
                <MenuItem value="major">Major - Affects functionality</MenuItem>
                <MenuItem value="critical">Critical - Unusable</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={damageForm.description}
              onChange={(e) => setDamageForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the damage in detail..."
            />

            <FormControl fullWidth>
              <InputLabel>Suggested Action</InputLabel>
              <Select
                value={damageForm.suggested_action}
                label="Suggested Action"
                onChange={(e) => setDamageForm((prev) => ({ ...prev, suggested_action: e.target.value }))}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="return_to_vendor">Return to Vendor</MenuItem>
                <MenuItem value="dispose">Dispose</MenuItem>
                <MenuItem value="repair">Repair</MenuItem>
                <MenuItem value="discount_sale">Discount Sale</MenuItem>
                <MenuItem value="use_as_is">Use As-Is</MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<CloudUpload />}
                  fullWidth
                >
                  Upload Photo
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handlePhotoUpload}
                  />
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CameraAlt />}
                  fullWidth
                  color="primary"
                  onClick={() => void handleOpenCamera()}
                >
                  Take Photo
                </Button>
              </Stack>
              {damageForm.photo && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Selected: {damageForm.photo.name}
                </Typography>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDamageFormDialog(false)}>Cancel</Button>
          <Button onClick={() => void handleDamageFormSubmit()} variant="contained" color="error">
            Record Damage
          </Button>
        </DialogActions>
      </Dialog>

      {/* Camera Dialog */}
      <Dialog
        open={openCameraDialog}
        onClose={handleCloseCamera}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Take Photo</DialogTitle>
        <DialogContent>
          <Box sx={{ position: 'relative', width: '100%', bgcolor: 'black', borderRadius: 1, overflow: 'hidden' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCamera}>Cancel</Button>
          <Button onClick={handleCapturePhoto} variant="contained" color="primary" startIcon={<CameraAlt />}>
            Capture Photo
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={multiScanMode ? 2000 : 4000}
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
