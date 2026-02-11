import { useNavigate } from 'react-router-dom'
import { Box, Button, Grid, Paper, Stack, Typography } from '@mui/material'
import { Inventory2, LocalOffer, QrCodeScanner } from '@mui/icons-material'
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
        <Grid item xs={12} md={4}>
          <MetricCard
            label="Barcode Operations"
            value="Ready"
            icon={<LocalOffer />}
            note="Assign barcode per SKU and preview printable labels."
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            label="Scan Receiving"
            value="Ready"
            icon={<QrCodeScanner />}
            tone="success"
            note="Confirm inbound goods via barcode scanning and validation."
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            label="Inventory Ledger"
            value="Tracked"
            icon={<Inventory2 />}
            tone="info"
            note="All movements and scan confirmations are audit-tracked."
          />
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
              3) Review scan audit logs and exception outcomes (mismatch/over-receipt).
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
