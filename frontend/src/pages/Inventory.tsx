import { useNavigate } from 'react-router-dom'
import { Box, Button, Grid, Paper, Stack, Typography } from '@mui/material'
import { Inventory2, LocalOffer, QrCodeScanner, Brush, PrecisionManufacturing } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import MetricCard from '../components/ui/MetricCard'

export default function Inventory() {
  const navigate = useNavigate()

  return (
    <Box>
      <PageHeader
        title="Inventory Control Center"
        subtitle="Manage stock operations, barcode labeling, and receiving validation."
        actions={
          <Stack direction="row" spacing={1.25}>
            <Button variant="outlined" onClick={() => navigate('/inventory/barcodes')}>
              Barcode Workspace
            </Button>
            <Button variant="contained" onClick={() => navigate('/inventory/receiving')}>
              Goods Receipt
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={3}>
          <Box onClick={() => navigate('/inventory/barcodes')} sx={{ cursor: 'pointer' }}>
            <MetricCard
              label="Barcode Operations"
              value="Assign"
              icon={<LocalOffer />}
              note="Assign barcode per SKU and preview printable labels."
            />
          </Box>
        </Grid>
        <Grid item xs={12} md={3}>
          <Box onClick={() => navigate('/inventory/receiving')} sx={{ cursor: 'pointer' }}>
            <MetricCard
              label="Scan Receiving"
              value="Receive"
              icon={<QrCodeScanner />}
              tone="success"
              note="Confirm inbound goods via barcode scanning and validation."
            />
          </Box>
        </Grid>
        <Grid item xs={12} md={3}>
          <Box onClick={() => navigate('/inventory/tracking')} sx={{ cursor: 'pointer' }}>
            <MetricCard
              label="Inventory Ledger"
              value="Audit"
              icon={<Inventory2 />}
              tone="info"
              note="All movements and scan confirmations are audit-tracked."
            />
          </Box>
        </Grid>
        <Grid item xs={12} md={3}>
          <Box onClick={() => navigate('/inventory/product-journey')} sx={{ cursor: 'pointer' }}>
            <MetricCard
              label="Product Journey"
              value="Trace"
              icon={<LocalOffer />}
              tone="warning"
              note="Track products from receipt to delivery with checkpoints."
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={3}>
          <Box onClick={() => navigate('/inventory/design-approvals')} sx={{ cursor: 'pointer' }}>
            <MetricCard
              label="Designer Workbench"
              value="Approve"
              icon={<Brush />}
              tone="error"
              note="Approve designs and start the Product Journey to factory."
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={3}>
          <Box onClick={() => navigate('/inventory/production-kanban')} sx={{ cursor: 'pointer' }}>
            <MetricCard
              label="Production Kanban"
              value="Track"
              icon={<PrecisionManufacturing />}
              tone="primary"
              note="Manage Production and Warehouse Receiving via drag and drop."
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={3}>
          <Box onClick={() => navigate('/inventory/stock-transfers')} sx={{ cursor: 'pointer' }}>
            <MetricCard
              label="Stock Transfers"
              value="Transfer"
              icon={<Inventory2 />}
              tone="success"
              note="Move physical goods between Warehouse and Retail Stores."
            />
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Workflow
            </Typography>
            <Typography variant="body2" color="text.secondary">
              1) Assign barcode to SKU and print labels.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              2) Receive goods by scan against location and optional source document.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              3) Track product journey from receipt to delivery using the Product Journey tracker.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              4) Click the "Tracked" card to view complete audit trail and movement history.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box >
  )
}
