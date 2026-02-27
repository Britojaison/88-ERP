import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Grid, Paper, Snackbar, Stack, Typography } from '@mui/material'
import {
  Assessment,
  Inventory,
  PendingActions,
  ReceiptLong,
  SouthEast,
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import MetricCard from '../components/ui/MetricCard'

const quickActions = [
  { label: 'Create Product', path: '/master-data' },
  { label: 'New Document', path: '/documents' },
  { label: 'Inventory Check', path: '/inventory' },
  { label: 'Generate Report', path: '/reports' },
]



export default function Dashboard() {
  const navigate = useNavigate()
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'info' },
  )

  return (
    <Box>
      <PageHeader
        title="Dashboard Overview"
        subtitle="Monitor operations, status, and actions from one place."
        actions={
          <Stack direction="row" spacing={1.25}>
            <Button variant="outlined" onClick={() => navigate('/reports')}>
              View Analytics
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            label="SKUs Monitored"
            value="All"
            icon={<Inventory />}
            note="Master catalog products"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            label="Online Orders"
            value="N/A"
            icon={<ReceiptLong />}
            note="Purchase and sales activity"
            tone="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            label="Stock Health"
            value="OK"
            icon={<Assessment />}
            note="Tracked balance records"
            tone="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            label="Active Notifications"
            value="0"
            icon={<PendingActions />}
            note="No pending actions required"
            tone="warning"
          />
        </Grid>


        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Grid container spacing={1.5} sx={{ mt: 0.25 }}>
              {quickActions.map((action) => (
                <Grid item xs={12} sm={6} md={3} key={action.label}>
                  <Button
                    variant="outlined"
                    fullWidth
                    endIcon={<SouthEast fontSize="small" />}
                    onClick={() => navigate(action.path)}
                    sx={{ justifyContent: 'space-between', py: 1.25 }}
                  >
                    {action.label}
                  </Button>
                </Grid>
              ))}
            </Grid>
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
