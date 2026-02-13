import { useEffect, useState } from 'react'
import {
  Alert,
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
    is_primary: true,
  })

  const loadData = async () => {
    try {
      const [skus, barcodes] = await Promise.all([mdmService.getSKUs(), mdmService.getSKUBarcodes()])
      
      // Get SKU IDs that already have barcodes
      const skusWithBarcodes = new Set(barcodes.map(barcode => barcode.sku))
      
      // Filter out SKUs that already have barcodes
      const availableSkus = skus.filter(sku => !skusWithBarcodes.has(sku.id))
      
      setSkuList(availableSkus)
      setBarcodeList(barcodes)
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load barcode workspace data.', severity: 'error' })
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

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
    if (!form.size_label || form.size_label.trim() === '') {
      setSnackbar({ open: true, message: 'Size Label is required.', severity: 'error' })
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
                <FormControl fullWidth required>
                  <InputLabel>SKU *</InputLabel>
                  <Select
                    value={form.sku}
                    label="SKU *"
                    onChange={(e) => {
                      const skuId = e.target.value;
                      const selectedSku = skuList.find(s => s.id === skuId);
                      
                      if (selectedSku) {
                        setForm((prev) => ({
                          ...prev,
                          sku: skuId,
                          display_code: selectedSku.code,
                          label_title: selectedSku.name,
                          size_label: selectedSku.size || '',
                          selling_price: selectedSku.base_price || '',
                          mrp: selectedSku.cost_price || '',
                        }));
                      } else {
                        setForm((prev) => ({ ...prev, sku: skuId }));
                      }
                    }}
                    required
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
                <FormControl fullWidth required>
                  <InputLabel>Size Label *</InputLabel>
                  <Select
                    value={form.size_label}
                    label="Size Label *"
                    onChange={(e) => setForm((prev) => ({ ...prev, size_label: e.target.value }))}
                    required
                  >
                    <MenuItem value="XS">XS - Extra Small</MenuItem>
                    <MenuItem value="S">S - Small</MenuItem>
                    <MenuItem value="M">M - Medium</MenuItem>
                    <MenuItem value="L">L - Large</MenuItem>
                    <MenuItem value="XL">XL - Extra Large</MenuItem>
                    <MenuItem value="XXL">XXL - Double Extra Large</MenuItem>
                    <MenuItem value="XXXL">XXXL - Triple Extra Large</MenuItem>
                    <MenuItem value="Free Size">Free Size</MenuItem>
                    <MenuItem value="One Size">One Size</MenuItem>
                    <MenuItem value="28">28</MenuItem>
                    <MenuItem value="30">30</MenuItem>
                    <MenuItem value="32">32</MenuItem>
                    <MenuItem value="34">34</MenuItem>
                    <MenuItem value="36">36</MenuItem>
                    <MenuItem value="38">38</MenuItem>
                    <MenuItem value="40">40</MenuItem>
                    <MenuItem value="42">42</MenuItem>
                    <MenuItem value="44">44</MenuItem>
                  </Select>
                </FormControl>
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
                  label="Primary Barcode (only one primary barcode allowed per SKU)"
                />
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
