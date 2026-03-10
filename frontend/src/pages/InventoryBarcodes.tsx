import { useEffect, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add,
  Delete,
  Download,
  LocalPrintshop,
  PictureAsPdf,
  PlaylistAdd,
  Refresh,
  Info,
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, type SKU, type SKUBarcode } from '../services/mdm.service'
import api from '../services/api'

interface BulkQueueItem {
  id: string
  sku_id: string
  sku_code: string
  product_name: string
  size: string
  barcode_id?: string
  barcode_value?: string
  selling_price: string
  mrp: string
  quantity: number
}

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null
}

export default function InventoryBarcodes() {
  // ─── Shared State ───
  const [skuList, setSkuList] = useState<SKU[]>([])
  const [barcodeList, setBarcodeList] = useState<SKUBarcode[]>([])
  const [selectedLabel, setSelectedLabel] = useState('')
  const [labelName, setLabelName] = useState('')
  const [activeBarcodeId, setActiveBarcodeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [barcodePage, setBarcodePage] = useState(1)
  const [barcodeCount, setBarcodeCount] = useState(0)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'info' },
  )
  const [skuSearch, setSkuSearch] = useState('')
  const [tabValue, setTabValue] = useState(0)

  // ─── Single Barcode Form ───
  const [form, setForm] = useState({
    sku: '',
    barcode_type: 'code128',
    barcode_value: '',
    display_code: '',
    label_title: '',
    size_label: '',
    selling_price: '',
    mrp: '',
    is_primary: true,
  })

  // ─── Bulk Generation State ───
  const [bulkQueue, setBulkQueue] = useState<BulkQueueItem[]>([])
  const [bulkLayout, setBulkLayout] = useState('51x26')
  const [bulkSearchInput, setBulkSearchInput] = useState('')
  const [bulkSkuResults, setBulkSkuResults] = useState<SKU[]>([])
  const [bulkGenerating, setBulkGenerating] = useState(false)

  // ─── Data Loading ───
  const loadData = async (page = 1) => {
    try {
      const [skuRes, barcodeRes] = await Promise.all([
        mdmService.getSKUs({ search: skuSearch }),
        mdmService.getSKUBarcodes({ page })
      ])

      const skus: any[] = Array.isArray(skuRes) ? skuRes : (skuRes as any).results
      const barcodes: any[] = Array.isArray(barcodeRes) ? barcodeRes : (barcodeRes as any).results
      const totalBarcodes = Array.isArray(barcodeRes) ? barcodes.length : (barcodeRes as any).count

      setSkuList(skus)
      setBarcodeList(barcodes)
      setBarcodeCount(totalBarcodes)
      setBarcodePage(page)
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load barcode workspace data.', severity: 'error' })
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [skuSearch])

  // Bulk SKU search
  useEffect(() => {
    if (bulkSearchInput.length < 1) {
      setBulkSkuResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await mdmService.getSKUs({ search: bulkSearchInput })
        const results: SKU[] = Array.isArray(res) ? res : (res as any).results
        setBulkSkuResults(results)
      } catch {
        setBulkSkuResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [bulkSearchInput])

  // ─── Single Barcode Handlers ───
  const handleAssign = async () => {
    if (!form.sku) {
      setSnackbar({ open: true, message: 'Please select a SKU.', severity: 'error' })
      return
    }
    if (!form.display_code || form.display_code.trim() === '') {
      setSnackbar({ open: true, message: 'Display Code is required.', severity: 'error' })
      return
    }
    if (!form.label_title || form.label_title.trim() === '') {
      setSnackbar({ open: true, message: 'Label Title is required.', severity: 'error' })
      return
    }
    if (!form.selling_price || form.selling_price.trim() === '') {
      setSnackbar({ open: true, message: 'Selling Price is required.', severity: 'error' })
      return
    }
    if (!form.mrp || form.mrp.trim() === '') {
      setSnackbar({ open: true, message: 'MRP is required.', severity: 'error' })
      return
    }

    const sellingPrice = parseFloat(form.selling_price)
    const mrp = parseFloat(form.mrp)

    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      setSnackbar({ open: true, message: 'Selling Price must be a positive number.', severity: 'error' })
      return
    }
    if (isNaN(mrp) || mrp <= 0) {
      setSnackbar({ open: true, message: 'MRP must be a positive number.', severity: 'error' })
      return
    }
    if (sellingPrice > mrp) {
      setSnackbar({ open: true, message: 'Selling Price cannot be greater than MRP.', severity: 'error' })
      return
    }

    setLoading(true)
    try {
      const created = await mdmService.createSKUBarcode({
        sku: form.sku,
        barcode_type: form.barcode_type as 'code128' | 'gs1_128' | 'ean13',
        barcode_value: form.barcode_value || undefined,
        display_code: form.display_code,
        label_title: form.label_title,
        size_label: form.size_label,
        selling_price: form.selling_price,
        mrp: form.mrp,
        is_primary: form.is_primary,
      })
      setBarcodeList((prev) => [created, ...prev])
      setSnackbar({ open: true, message: 'Barcode assigned successfully.', severity: 'success' })
      setForm({
        sku: '',
        barcode_type: 'code128',
        barcode_value: '',
        display_code: '',
        label_title: '',
        size_label: '',
        selling_price: '',
        mrp: '',
        is_primary: true,
      })
      await loadData()
    } catch (error: any) {
      let errorMsg = 'Failed to assign barcode. Please check your inputs.'
      if (error.response?.data) {
        if (error.response.data.barcode_value) {
          errorMsg = Array.isArray(error.response.data.barcode_value) ? error.response.data.barcode_value[0] : 'This barcode value is already assigned.'
        } else if (error.response.data.display_code) {
          errorMsg = error.response.data.display_code[0]
        } else if (error.response.data.label_title) {
          errorMsg = error.response.data.label_title[0]
        } else if (error.response.data.selling_price) {
          errorMsg = error.response.data.selling_price[0]
        } else if (error.response.data.mrp) {
          errorMsg = error.response.data.mrp[0]
        } else if (error.response.data.sku) {
          errorMsg = error.response.data.sku[0]
        } else if (error.response.data.detail) {
          errorMsg = error.response.data.detail
        } else if (typeof error.response.data === 'string') {
          errorMsg = error.response.data
        } else {
          errorMsg = JSON.stringify(error.response.data)
        }
      }
      setSnackbar({ open: true, message: errorMsg, severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = async (barcode: SKUBarcode) => {
    try {
      setActiveBarcodeId(barcode.id)
      const response = await mdmService.getSKUBarcodeLabel(barcode.id)
      setSelectedLabel(response.label_svg)
      setLabelName(`${barcode.sku_code || 'barcode'}-${barcode.barcode_value}`)
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load label preview.', severity: 'error' })
    }
  }

  const handlePrint = () => {
    if (!selectedLabel) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Label</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: #fff;
            }
            .label-container {
              width: 51mm;
              height: 26mm;
              text-align: center;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .label-container svg {
              width: 51mm;
              height: 26mm;
            }
            @media print {
              @page {
                size: 51mm 26mm;
                margin: 0;
              }
              body {
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
              }
            }
          </style>
        </head>
        <body>
          <div class="label-container">${selectedLabel}</div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const handleDownloadSVG = () => {
    if (!selectedLabel) return
    const blob = new Blob([selectedLabel], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${labelName || 'barcode-label'}.svg`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadFormat = async (format: 'png' | 'pdf') => {
    if (!activeBarcodeId) return
    try {
      setSnackbar({ open: true, message: `Generating ${format.toUpperCase()}...`, severity: 'info' })
      const response = await api.get(`/mdm/sku-barcodes/${activeBarcodeId}/download/`, {
        params: { format },
        responseType: 'blob'
      })
      const url = URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${labelName}.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setSnackbar({ open: true, message: `${format.toUpperCase()} downloaded successfully.`, severity: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: `Failed to download ${format.toUpperCase()}.`, severity: 'error' })
    }
  }

  // ─── Bulk Generation Handlers ───
  const handleAddToQueue = (sku: SKU) => {
    // Avoid duplicate
    if (bulkQueue.some(q => q.sku_id === sku.id)) {
      setSnackbar({ open: true, message: `${sku.code} is already in the queue.`, severity: 'info' })
      return
    }

    // Check if this SKU has an existing barcode
    const existingBarcode = barcodeList.find(b => (b.sku === sku.id || b.sku_code === sku.code))

    const newItem: BulkQueueItem = {
      id: crypto.randomUUID(),
      sku_id: sku.id,
      sku_code: sku.code,
      product_name: (sku as any).product_name || sku.name || '',
      size: sku.size || '',
      barcode_id: existingBarcode?.id,
      barcode_value: existingBarcode?.barcode_value || '',
      selling_price: existingBarcode?.selling_price || sku.base_price || '',
      mrp: existingBarcode?.mrp || sku.cost_price || sku.base_price || '',
      quantity: 1,
    }
    setBulkQueue(prev => [...prev, newItem])
  }

  const handleAddProductSkusToQueue = (productName: string) => {
    const productSkus = bulkSkuResults.filter(s =>
      (s as any).product_name === productName || s.name === productName
    )
    let addedCount = 0
    for (const sku of productSkus) {
      if (!bulkQueue.some(q => q.sku_id === sku.id)) {
        handleAddToQueue(sku)
        addedCount++
      }
    }
    if (addedCount === 0) {
      setSnackbar({ open: true, message: 'All variants already in queue.', severity: 'info' })
    } else {
      setSnackbar({ open: true, message: `Added ${addedCount} variant(s) to queue.`, severity: 'success' })
    }
  }

  const handleRemoveFromQueue = (queueId: string) => {
    setBulkQueue(prev => prev.filter(q => q.id !== queueId))
  }

  const handleUpdateQueueQuantity = (queueId: string, qty: number) => {
    setBulkQueue(prev => prev.map(q =>
      q.id === queueId ? { ...q, quantity: Math.max(1, qty) } : q
    ))
  }

  const handleBulkGenerate = async () => {
    if (bulkQueue.length === 0) {
      setSnackbar({ open: true, message: 'Add items to the queue first.', severity: 'error' })
      return
    }

    setBulkGenerating(true)
    try {
      const items = bulkQueue.map(q => ({
        ...(q.barcode_id ? { barcode_id: q.barcode_id } : { sku_id: q.sku_id }),
        quantity: q.quantity,
      }))

      const response = await api.post('/mdm/sku-barcodes/bulk-generate/', {
        items,
        layout: bulkLayout,
      }, { responseType: 'blob' })

      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `bulk_labels_${bulkLayout}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      const totalLabels = bulkQueue.reduce((sum, q) => sum + q.quantity, 0)
      setSnackbar({ open: true, message: `Generated PDF with ${totalLabels} labels successfully!`, severity: 'success' })
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to generate bulk PDF.'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setBulkGenerating(false)
    }
  }

  const totalLabelsInQueue = bulkQueue.reduce((sum, q) => sum + q.quantity, 0)

  // Group search results by product name
  const groupedSearchResults = bulkSkuResults.reduce<Record<string, SKU[]>>((acc, sku) => {
    const productName = (sku as any).product_name || sku.name || 'Unknown'
    if (!acc[productName]) acc[productName] = []
    acc[productName].push(sku)
    return acc
  }, {})

  return (
    <Box>
      <PageHeader
        title="Barcode Workspace"
        subtitle="Assign SKU barcodes, produce labels, and generate bulk barcode sheets."
        actions={
          <Stack direction="row" spacing={1.25}>
            <Button variant="outlined" startIcon={<Refresh />} onClick={() => void loadData()}>
              Refresh
            </Button>
          </Stack>
        }
      />

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 0 }}>
        <Tab label="Single Barcode" />
        <Tab
          label={
            <Stack direction="row" spacing={0.5} alignItems="center">
              <span>Bulk Generation</span>
              {bulkQueue.length > 0 && (
                <Chip label={bulkQueue.length} size="small" color="primary" sx={{ height: 20, fontSize: 11 }} />
              )}
            </Stack>
          }
        />
      </Tabs>

      {/* ────────── TAB 0: Single Barcode (original) ────────── */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={2.5}>
          <Grid item xs={12} lg={7}>
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="h6" gutterBottom>
                Assign Barcode to SKU
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={form.sku && !skuList.some(s => s.id === form.sku) ? [...skuList, {
                      id: form.sku,
                      code: form.display_code,
                      name: form.label_title,
                      size: form.size_label,
                      base_price: form.selling_price,
                      cost_price: form.mrp
                    } as SKU] : skuList}
                    getOptionLabel={(option) => `${option.code} - ${option.name}${option.size ? ` (${option.size})` : ''}`}
                    value={form.sku ? {
                      id: form.sku,
                      code: form.display_code,
                      name: form.label_title,
                      size: form.size_label,
                      base_price: form.selling_price,
                      cost_price: form.mrp
                    } as SKU : null}
                    onInputChange={(_, value, reason) => {
                      if (reason === 'input' || reason === 'clear') {
                        setSkuSearch(value)
                      }
                    }}
                    onChange={(_event, newValue) => {
                      if (newValue) {
                        setForm((prev) => ({
                          ...prev,
                          sku: newValue.id,
                          display_code: newValue.code,
                          label_title: newValue.name,
                          size_label: newValue.size || '',
                          selling_price: newValue.base_price || '',
                          mrp: newValue.cost_price || '',
                        }));
                      } else {
                        setForm((prev) => ({
                          ...prev,
                          sku: '',
                          display_code: '',
                          label_title: '',
                          size_label: '',
                          selling_price: '',
                          mrp: '',
                        }));
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="SKU *"
                        required
                        placeholder="Type to search SKU..."
                      />
                    )}
                    renderOption={(props, option) => (
                      <li {...props} key={option.id}>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {option.code}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.name}{option.size ? ` • Size: ${option.size}` : ''} • ₹{option.base_price}
                          </Typography>
                        </Box>
                      </li>
                    )}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    noOptionsText="No SKUs available"
                    fullWidth
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Display Code *"
                    value={form.display_code}
                    onChange={(e) => setForm((prev) => ({ ...prev, display_code: e.target.value }))}
                    required
                    helperText="Code shown on label"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Label Title *"
                    value={form.label_title}
                    onChange={(e) => setForm((prev) => ({ ...prev, label_title: e.target.value }))}
                    required
                    helperText="Product name on label"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Size Label"
                    value={form.size_label}
                    onChange={(e) => setForm((prev) => ({ ...prev, size_label: e.target.value }))}
                    helperText="Size shown on label (optional)"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Selling Price *"
                    value={form.selling_price}
                    onChange={(e) => setForm((prev) => ({ ...prev, selling_price: e.target.value }))}
                    type="number"
                    required
                    helperText="Must be less than or equal to MRP"
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="MRP *"
                    value={form.mrp}
                    onChange={(e) => setForm((prev) => ({ ...prev, mrp: e.target.value }))}
                    type="number"
                    required
                    helperText="Maximum Retail Price"
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.is_primary ?? true}
                        onChange={(e) => setForm((prev) => ({ ...prev, is_primary: e.target.checked }))}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        Primary Barcode (only one primary barcode allowed per SKU)
                        <Tooltip title="If checked, this barcode will become the default used for scanning. Any existing primary barcode for this SKU will become secondary.">
                          <Info sx={{ fontSize: 16, ml: 0.5, color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                      </Box>
                    }
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button variant="contained" onClick={() => void handleAssign()} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Barcode Assignment'}
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Paper sx={{ p: 2.5, minHeight: 420 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">Label Preview</Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" startIcon={<LocalPrintshop />} variant="outlined" onClick={handlePrint} disabled={!selectedLabel}>
                    Print
                  </Button>
                  <Button size="small" startIcon={<Download />} variant="outlined" onClick={handleDownloadSVG} disabled={!selectedLabel}>
                    SVG
                  </Button>
                  <Button size="small" startIcon={<Download />} variant="outlined" onClick={() => void handleDownloadFormat('png')} disabled={!selectedLabel}>
                    PNG
                  </Button>
                  <Button size="small" startIcon={<Download />} variant="outlined" onClick={() => void handleDownloadFormat('pdf')} disabled={!selectedLabel}>
                    PDF
                  </Button>
                </Stack>
              </Stack>
              {!selectedLabel ? (
                <Alert severity="info">Select a barcode row and click "Preview".</Alert>
              ) : (
                <Box
                  sx={{
                    overflow: 'auto',
                    bgcolor: '#fafafa',
                    p: 1.5,
                    borderRadius: 1.5,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: 350,
                    '& svg': {
                      width: 'auto',
                      height: 'auto',
                      maxWidth: '100%'
                    }
                  }}
                  dangerouslySetInnerHTML={{ __html: selectedLabel }}
                />
              )}
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="h6" gutterBottom>
                Assigned Barcodes
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>SKU</TableCell>
                      <TableCell>Product Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Barcode Value</TableCell>
                      <TableCell>Label Title</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {barcodeList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                            You haven't generated any barcodes yet. Select a SKU above to create your first printable barcode label.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      barcodeList.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.sku_code || row.sku}</TableCell>
                          <TableCell>{row.product_name || '-'}</TableCell>
                          <TableCell>{row.barcode_type}</TableCell>
                          <TableCell>{row.barcode_value}</TableCell>
                          <TableCell>{row.label_title || '-'}</TableCell>
                          <TableCell>
                            <Button size="small" onClick={() => void handlePreview(row)}>
                              Preview
                            </Button>
                          </TableCell>
                        </TableRow>
                      )))}
                  </TableBody>
                </Table>
              </TableContainer>
              {barcodeCount > 50 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Showing {(barcodePage - 1) * 50 + 1}-{Math.min(barcodePage * 50, barcodeCount)} of {barcodeCount} barcodes
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={barcodePage === 1}
                      onClick={() => void loadData(barcodePage - 1)}
                    >
                      Previous
                    </Button>
                    <Typography variant="body2" sx={{ px: 1, fontWeight: 500 }}>
                      Page {barcodePage}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={barcodePage * 50 >= barcodeCount}
                      onClick={() => void loadData(barcodePage + 1)}
                    >
                      Next
                    </Button>
                  </Stack>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      {/* ────────── TAB 1: Bulk Generation ────────── */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2.5}>
          {/* Left: Search & Add */}
          <Grid item xs={12} lg={5}>
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PlaylistAdd /> Search & Add Products
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Search by product name or SKU code, then add individual variants or all variants of a product.
              </Typography>

              <TextField
                fullWidth
                label="Search products or SKU codes..."
                value={bulkSearchInput}
                onChange={(e) => setBulkSearchInput(e.target.value)}
                placeholder="e.g. Test-1, MMW-4800, Shirt..."
                size="small"
                sx={{ mb: 2 }}
              />

              {/* Search Results */}
              {bulkSearchInput.length > 0 && (
                <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
                  {Object.keys(groupedSearchResults).length === 0 ? (
                    <Alert severity="info" sx={{ mb: 1 }}>No products found matching "{bulkSearchInput}"</Alert>
                  ) : (
                    Object.entries(groupedSearchResults).map(([productName, skus]) => (
                      <Paper
                        key={productName}
                        variant="outlined"
                        sx={{ mb: 1.5, overflow: 'hidden' }}
                      >
                        <Box sx={{
                          px: 2, py: 1,
                          bgcolor: 'action.hover',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {productName}
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Add />}
                            onClick={() => handleAddProductSkusToQueue(productName)}
                          >
                            Add All ({skus.length})
                          </Button>
                        </Box>
                        {skus.map(sku => {
                          const inQueue = bulkQueue.some(q => q.sku_id === sku.id)
                          return (
                            <Box
                              key={sku.id}
                              sx={{
                                px: 2, py: 0.75,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                borderTop: '1px solid',
                                borderColor: 'divider',
                                opacity: inQueue ? 0.5 : 1,
                              }}
                            >
                              <Box>
                                <Typography variant="body2" fontWeight={500}>
                                  {sku.code}
                                  {sku.size && <Chip label={sku.size} size="small" sx={{ ml: 1, height: 20, fontSize: 11 }} />}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ₹{sku.base_price}
                                </Typography>
                              </Box>
                              <IconButton
                                size="small"
                                color="primary"
                                disabled={inQueue}
                                onClick={() => handleAddToQueue(sku)}
                              >
                                <Add fontSize="small" />
                              </IconButton>
                            </Box>
                          )
                        })}
                      </Paper>
                    ))
                  )}
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Right: Print Queue */}
          <Grid item xs={12} lg={7}>
            <Paper sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PictureAsPdf /> Print Queue
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {bulkQueue.length} item{bulkQueue.length !== 1 ? 's' : ''} • {totalLabelsInQueue} total label{totalLabelsInQueue !== 1 ? 's' : ''}
                  </Typography>
                </Box>
                {bulkQueue.length > 0 && (
                  <Button
                    size="small"
                    color="error"
                    variant="text"
                    onClick={() => setBulkQueue([])}
                  >
                    Clear All
                  </Button>
                )}
              </Stack>

              {bulkQueue.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Search for products on the left and add them to the print queue. Then set the quantity of labels per item and choose a paper layout.
                </Alert>
              ) : (
                <TableContainer sx={{ mb: 2, maxHeight: 350, overflowY: 'auto' }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>SKU Code</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell>Size</TableCell>
                        <TableCell align="center" sx={{ width: 100 }}>Qty Labels</TableCell>
                        <TableCell align="center" sx={{ width: 50 }}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bulkQueue.map(item => (
                        <TableRow key={item.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>{item.sku_code}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{item.product_name}</Typography>
                          </TableCell>
                          <TableCell>
                            {item.size ? (
                              <Chip label={item.size} size="small" sx={{ height: 22 }} />
                            ) : '-'}
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              type="number"
                              size="small"
                              value={item.quantity}
                              onChange={(e) => handleUpdateQueueQuantity(item.id, parseInt(e.target.value) || 1)}
                              inputProps={{ min: 1, max: 500, style: { textAlign: 'center', width: 60 } }}
                              sx={{ '& .MuiOutlinedInput-root': { height: 32 } }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" color="error" onClick={() => handleRemoveFromQueue(item.id)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Layout Selection & Generate */}
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Label Size</InputLabel>
                    <Select
                      value={bulkLayout}
                      label="Label Size"
                      onChange={(e) => setBulkLayout(e.target.value)}
                    >
                      <MenuItem value="51x26">
                        <Box>
                          <Typography variant="body2" fontWeight={500}>51 × 26 mm (2″ × 1″)</Typography>
                          <Typography variant="caption" color="text.secondary">Code 128 • Scale 100% • Standard retail barcode</Typography>
                        </Box>
                      </MenuItem>
                      <MenuItem value="50x25">
                        <Box>
                          <Typography variant="body2" fontWeight={500}>50 × 25 mm</Typography>
                          <Typography variant="caption" color="text.secondary">Standard retail barcode sticker</Typography>
                        </Box>
                      </MenuItem>
                      <MenuItem value="50x30">
                        <Box>
                          <Typography variant="body2" fontWeight={500}>50 × 30 mm</Typography>
                          <Typography variant="caption" color="text.secondary">Slightly taller sticker</Typography>
                        </Box>
                      </MenuItem>
                      <MenuItem value="38x25">
                        <Box>
                          <Typography variant="body2" fontWeight={500}>38 × 25 mm</Typography>
                          <Typography variant="caption" color="text.secondary">Compact barcode label</Typography>
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={<PictureAsPdf />}
                    disabled={bulkQueue.length === 0 || bulkGenerating}
                    onClick={() => void handleBulkGenerate()}
                    sx={{ height: 48 }}
                  >
                    {bulkGenerating
                      ? 'Generating...'
                      : `Generate PDF (${totalLabelsInQueue} label${totalLabelsInQueue !== 1 ? 's' : ''})`
                    }
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

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
