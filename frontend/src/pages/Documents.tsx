import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { Add, Description, LocalShipping, Receipt, ShoppingCart } from '@mui/icons-material'
import EmptyState from '../components/ui/EmptyState'
import MetricCard from '../components/ui/MetricCard'
import PageHeader from '../components/ui/PageHeader'
import { documentsService, type Document } from '../services/documents.service'

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [documentTypes, setDocumentTypes] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [openDialog, setOpenDialog] = useState(false)
  const [form, setForm] = useState({
    document_type: '',
    document_number: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'info' },
  )
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const loadData = async () => {
    try {
      const [docs, types] = await Promise.all([
        documentsService.getDocuments(),
        documentsService.getDocumentTypes(),
      ])
      setDocuments(docs)
      setDocumentTypes(types)
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load documents.', severity: 'error' })
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const counts = useMemo(() => {
    const purchaseOrders = documents.filter((doc) => {
      const typeName = doc.document_type?.toLowerCase?.() ?? ''
      return typeName.includes('purchase') || typeName.includes('po')
    }).length

    const salesOrders = documents.filter((doc) => {
      const typeName = doc.document_type?.toLowerCase?.() ?? ''
      return typeName.includes('sales') || typeName.includes('so')
    }).length

    const invoices = documents.filter((doc) => {
      const typeName = doc.document_type?.toLowerCase?.() ?? ''
      return typeName.includes('invoice')
    }).length

    const shipments = documents.filter((doc) => {
      const typeName = doc.document_type?.toLowerCase?.() ?? ''
      return typeName.includes('shipment') || typeName.includes('delivery')
    }).length

    return { purchaseOrders, salesOrders, invoices, shipments }
  }, [documents])

  const handleCreateDocument = async () => {
    if (!form.document_type || !form.document_number || !form.date) {
      setSnackbar({ open: true, message: 'Type, number, and date are required.', severity: 'error' })
      return
    }

    try {
      await documentsService.createDocument({
        document_type: form.document_type,
        document_number: form.document_number,
        document_date: form.date,
        notes: form.notes,
        lines: [],
      })
      setOpenDialog(false)
      setForm({
        document_type: '',
        document_number: '',
        date: new Date().toISOString().slice(0, 10),
        notes: '',
      })
      await loadData()
      setSnackbar({ open: true, message: 'Document created successfully.', severity: 'success' })
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.response?.data?.error
      setSnackbar({ open: true, message: detail || 'Failed to create document.', severity: 'error' })
    }
  }

  const handleImportBatch = () => {
    importInputRef.current?.click()
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) {
        setSnackbar({ open: true, message: 'Import file must be a JSON array.', severity: 'error' })
        return
      }

      for (const doc of parsed) {
        // Best-effort import; server-side validation enforces required fields.
        // eslint-disable-next-line no-await-in-loop
        await documentsService.createDocument(doc)
      }

      await loadData()
      setSnackbar({ open: true, message: `Imported ${parsed.length} documents.`, severity: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to import batch.', severity: 'error' })
    } finally {
      event.target.value = ''
    }
  }

  return (
    <Box>
      <PageHeader
        title="Documents"
        subtitle="Create and monitor transaction documents across the business."
        actions={
          <Stack direction="row" spacing={1.25}>
            <Button variant="outlined" onClick={handleImportBatch}>Import Batch</Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)}>
              Create Document
            </Button>
          </Stack>
        }
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={handleImportFile}
      />

      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard label="Purchase Orders" value={String(counts.purchaseOrders)} icon={<ShoppingCart />} note="Open and closed POs" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard label="Sales Orders" value={String(counts.salesOrders)} icon={<Receipt />} tone="info" note="Customer orders" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard label="Invoices" value={String(counts.invoices)} icon={<Description />} tone="success" note="Issued invoices" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard label="Shipments" value={String(counts.shipments)} icon={<LocalShipping />} tone="warning" note="In transit items" />
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Documents
            </Typography>
            {documents.length === 0 ? (
              <EmptyState
                title="No documents yet"
                description="Create your first transaction to begin building an operational trail."
                actionLabel="Create Document"
                onAction={() => setOpenDialog(true)}
              />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Number</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Lines</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.slice(0, 10).map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>{doc.document_number}</TableCell>
                      <TableCell>{doc.document_type}</TableCell>
                      <TableCell>{doc.date}</TableCell>
                      <TableCell>{doc.status}</TableCell>
                      <TableCell align="right">{doc.lines?.length ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Document</DialogTitle>
        <DialogContent>
          {documentTypes.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No document types found. Configure document types in metadata first.
            </Alert>
          )}
          <TextField
            select
            fullWidth
            margin="normal"
            label="Document Type"
            value={form.document_type}
            onChange={(e) => setForm((prev) => ({ ...prev, document_type: e.target.value }))}
            SelectProps={{ native: true }}
          >
            <option value="">Select type</option>
            {documentTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.code} - {type.name}
              </option>
            ))}
          </TextField>
          <TextField
            fullWidth
            margin="normal"
            label="Document Number"
            value={form.document_number}
            onChange={(e) => setForm((prev) => ({ ...prev, document_number: e.target.value }))}
            placeholder="e.g. PO-2026-0001"
          />
          <TextField
            fullWidth
            margin="normal"
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Notes"
            multiline
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateDocument()}>
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
