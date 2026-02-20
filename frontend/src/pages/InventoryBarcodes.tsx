import { useEffect, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tooltip,
} from '@mui/material'
import { Download, LocalPrintshop, Refresh, Info } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, type SKU, type SKUBarcode } from '../services/mdm.service'
import api from '../services/api'

export default function InventoryBarcodes() {
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

  const loadData = async (page = 1) => {
    try {
      const [skuRes, barcodeRes] = await Promise.all([
        mdmService.getSKUs({ search: skuSearch }),
        mdmService.getSKUBarcodes({ page })
      ])

      const skus = Array.isArray(skuRes) ? skuRes : skuRes.results
      const barcodes = Array.isArray(barcodeRes) ? barcodeRes : barcodeRes.results
      const totalBarcodes = Array.isArray(barcodeRes) ? barcodes.length : barcodeRes.count

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

  const handleAssign = async () => {
    // Validate required fields
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
    // Size label is optional - no validation needed
    if (!form.selling_price || form.selling_price.trim() === '') {
      setSnackbar({ open: true, message: 'Selling Price is required.', severity: 'error' })
      return
    }
    if (!form.mrp || form.mrp.trim() === '') {
      setSnackbar({ open: true, message: 'MRP is required.', severity: 'error' })
      return
    }

    // Validate numeric fields
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
      // Reset form
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
      // Reload data to update available SKUs list
      await loadData()
    } catch (error: any) {
      const errorMsg = error.response?.data?.barcode_value ? 'This barcode value is already assigned.' :
        error.response?.data?.non_field_errors?.[0] ||
        error.response?.data?.sku?.[0] ||
        'Failed to assign barcode. Please check your inputs.'
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
              text-align: center;
            }
            .label-container svg {
              max-width: 100%;
              height: auto;
            }
            @media print {
              @page { margin: 10mm; }
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

  return (
    <Box>
      <PageHeader
        title="Barcode Workspace"
        subtitle="Assign SKU barcodes and produce standardized printable labels."
        actions={
          <Stack direction="row" spacing={1.25}>
            <Button variant="outlined" startIcon={<Refresh />} onClick={() => void loadData()}>
              Refresh
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h6" gutterBottom>
              Assign Barcode to SKU
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={skuList}
                  getOptionLabel={(option) => `${option.code} - ${option.name}${option.size ? ` (${option.size})` : ''}`}
                  value={skuList.find(s => s.id === form.sku) || null}
                  onInputChange={(_, value) => setSkuSearch(value)}
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
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Barcode Type *</InputLabel>
                  <Select
                    value={form.barcode_type}
                    label="Barcode Type *"
                    onChange={(e) => setForm((prev) => ({ ...prev, barcode_type: e.target.value }))}
                    required
                  >
                    <MenuItem value="code128">Code 128</MenuItem>
                    <MenuItem value="gs1_128">GS1-128</MenuItem>
                    <MenuItem value="ean13">EAN-13</MenuItem>
                  </Select>
                </FormControl>
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
