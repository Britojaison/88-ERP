import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  FormControl,
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
} from '@mui/material'
import { Download, LocalPrintshop, Refresh } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, type SKU, type SKUBarcode } from '../services/mdm.service'

export default function InventoryBarcodes() {
  const [skuList, setSkuList] = useState<SKU[]>([])
  const [barcodeList, setBarcodeList] = useState<SKUBarcode[]>([])
  const [selectedLabel, setSelectedLabel] = useState('')
  const [labelName, setLabelName] = useState('')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'info' },
  )

  const [form, setForm] = useState({
    sku: '',
    barcode_type: 'code128',
    barcode_value: '',
    display_code: '',
    label_title: '',
    size_label: '',
    selling_price: '',
    mrp: '',
  })

  const loadData = async () => {
    try {
      const [skus, barcodes] = await Promise.all([mdmService.getSKUs(), mdmService.getSKUBarcodes()])
      setSkuList(skus)
      setBarcodeList(barcodes)
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load barcode workspace data.', severity: 'error' })
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleAssign = async () => {
    if (!form.sku) {
      setSnackbar({ open: true, message: 'Please select a SKU.', severity: 'error' })
      return
    }
    try {
      const created = await mdmService.createSKUBarcode({
        sku: form.sku,
        barcode_type: form.barcode_type as 'code128' | 'gs1_128' | 'ean13',
        barcode_value: form.barcode_value || undefined,
        display_code: form.display_code || undefined,
        label_title: form.label_title || undefined,
        size_label: form.size_label || undefined,
        selling_price: form.selling_price || undefined,
        mrp: form.mrp || undefined,
      })
      setBarcodeList((prev) => [created, ...prev])
      setSnackbar({ open: true, message: 'Barcode assigned successfully.', severity: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to assign barcode.', severity: 'error' })
    }
  }

  const handlePreview = async (barcode: SKUBarcode) => {
    try {
      const response = await mdmService.getSKUBarcodeLabel(barcode.id)
      setSelectedLabel(response.label_svg)
      setLabelName(`${barcode.sku_code || 'barcode'}-${barcode.barcode_value}.svg`)
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
        <head><title>Print Label</title></head>
        <body style="margin:0;padding:16px;background:#fff;">${selectedLabel}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const handleDownload = () => {
    if (!selectedLabel) return
    const blob = new Blob([selectedLabel], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = labelName || 'barcode-label.svg'
    anchor.click()
    URL.revokeObjectURL(url)
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
                <FormControl fullWidth>
                  <InputLabel>SKU</InputLabel>
                  <Select
                    value={form.sku}
                    label="SKU"
                    onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
                  >
                    {skuList.map((sku) => (
                      <MenuItem key={sku.id} value={sku.id}>
                        {sku.code} - {sku.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Barcode Type</InputLabel>
                  <Select
                    value={form.barcode_type}
                    label="Barcode Type"
                    onChange={(e) => setForm((prev) => ({ ...prev, barcode_type: e.target.value }))}
                  >
                    <MenuItem value="code128">Code 128</MenuItem>
                    <MenuItem value="gs1_128">GS1-128</MenuItem>
                    <MenuItem value="ean13">EAN-13</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Barcode Value (optional)"
                  helperText="Leave blank to auto-generate."
                  value={form.barcode_value}
                  onChange={(e) => setForm((prev) => ({ ...prev, barcode_value: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Display Code" value={form.display_code} onChange={(e) => setForm((prev) => ({ ...prev, display_code: e.target.value }))} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Label Title" value={form.label_title} onChange={(e) => setForm((prev) => ({ ...prev, label_title: e.target.value }))} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Size Label" value={form.size_label} onChange={(e) => setForm((prev) => ({ ...prev, size_label: e.target.value }))} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Selling Price" value={form.selling_price} onChange={(e) => setForm((prev) => ({ ...prev, selling_price: e.target.value }))} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="MRP" value={form.mrp} onChange={(e) => setForm((prev) => ({ ...prev, mrp: e.target.value }))} />
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" onClick={() => void handleAssign()}>
                  Save Barcode Assignment
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
                <Button size="small" startIcon={<Download />} variant="outlined" onClick={handleDownload} disabled={!selectedLabel}>
                  Download
                </Button>
              </Stack>
            </Stack>
            {!selectedLabel ? (
              <Alert severity="info">Select a barcode row and click "Preview".</Alert>
            ) : (
              <Box sx={{ overflow: 'auto', bgcolor: '#fafafa', p: 1.5, borderRadius: 1.5 }} dangerouslySetInnerHTML={{ __html: selectedLabel }} />
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
                    <TableCell>Type</TableCell>
                    <TableCell>Barcode Value</TableCell>
                    <TableCell>Label Title</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {barcodeList.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.sku_code || row.sku}</TableCell>
                      <TableCell>{row.barcode_type}</TableCell>
                      <TableCell>{row.barcode_value}</TableCell>
                      <TableCell>{row.label_title || '-'}</TableCell>
                      <TableCell>
                        <Button size="small" onClick={() => void handlePreview(row)}>
                          Preview
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
