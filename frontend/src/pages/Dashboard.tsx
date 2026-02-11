import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Chip, Grid, LinearProgress, List, ListItem, ListItemText, Paper, Snackbar, Stack, Typography } from '@mui/material'
import {
  Assessment,
  CheckCircle,
  Inventory,
  PendingActions,
  ReceiptLong,
  SouthEast,
  RadioButtonUnchecked,
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import MetricCard from '../components/ui/MetricCard'
import EmptyState from '../components/ui/EmptyState'
import { metadataService, type FashionReadiness } from '../services/metadata.service'

const quickActions = [
  { label: 'Create Product', path: '/master-data' },
  { label: 'New Document', path: '/documents' },
  { label: 'Inventory Check', path: '/inventory' },
  { label: 'Generate Report', path: '/reports' },
]

type SetupAction = {
  id: string
  label: string
  path: string
}

const getStageActions = (stageId: string): SetupAction[] => {
  if (stageId === 'setup') {
    return [
      { id: 'setup-metadata', label: 'Configure Metadata', path: '/metadata' },
      { id: 'setup-master', label: 'Add Locations/Company', path: '/master-data' },
    ]
  }
  if (stageId === 'catalog') {
    return [
      { id: 'catalog-master', label: 'Create Products and SKUs', path: '/master-data' },
    ]
  }
  if (stageId === 'factory') {
    return [
      { id: 'factory-barcodes', label: 'Assign Barcodes', path: '/inventory/barcodes' },
      { id: 'factory-receiving', label: 'Run Receiving Scan', path: '/inventory/receiving' },
    ]
  }
  if (stageId === 'sales') {
    return [
      { id: 'sales-docs', label: 'Create Sales Documents', path: '/documents' },
      { id: 'sales-shopify', label: 'Connect Shopify', path: '/shopify' },
    ]
  }

  return []
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [readiness, setReadiness] = useState<FashionReadiness | null>(null)
  const [loadingBootstrap, setLoadingBootstrap] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'info' },
  )

  const loadReadiness = async () => {
    try {
      const data = await metadataService.getFashionReadiness()
      setReadiness(data)
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load fashion readiness status.', severity: 'error' })
    }
  }

  useEffect(() => {
    void loadReadiness()
  }, [])

  const handleBootstrapFashion = async () => {
    setLoadingBootstrap(true)
    try {
      const result = await metadataService.bootstrapFashion()
      if (result.success) {
        setSnackbar({ open: true, message: 'Fashion template initialized successfully.', severity: 'success' })
      } else {
        setSnackbar({ open: true, message: 'Bootstrap finished with validation warnings.', severity: 'info' })
      }
      setLoadingBootstrap(false)
      void loadReadiness()
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to initialize fashion template.', severity: 'error' })
      setLoadingBootstrap(false)
    }
  }

  const nextStage = (readiness?.stages ?? []).find((stage) => !stage.done)
  const nextAction = nextStage ? getStageActions(nextStage.id)[0] : null

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
            <Button variant="contained" onClick={() => navigate('/metadata')}>
              Configure Platform
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            label="Total Products"
            value={String(readiness?.metrics?.products ?? 0)}
            icon={<Inventory />}
            note="Master catalog products"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            label="Active Documents"
            value={String(readiness?.metrics?.documents ?? 0)}
            icon={<ReceiptLong />}
            note="Purchase and sales activity"
            tone="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            label="Inventory Value"
            value={String(readiness?.metrics?.inventory_balances ?? 0)}
            icon={<Assessment />}
            note="Tracked balance records"
            tone="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            label="Readiness Progress"
            value={`${readiness?.progress_percent ?? 0}%`}
            icon={<PendingActions />}
            note="Factory-to-sale completion"
            tone="warning"
          />
        </Grid>

        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.25}>
              <Typography variant="h6">Fashion Readiness</Typography>
              <Stack direction="row" spacing={1}>
                {nextAction && (
                  <Button variant="outlined" onClick={() => navigate(nextAction.path)}>
                    Do Next Step
                  </Button>
                )}
                <Button variant="contained" onClick={() => void handleBootstrapFashion()} disabled={loadingBootstrap}>
                  {loadingBootstrap ? 'Initializing...' : 'Initialize Fashion Setup'}
                </Button>
              </Stack>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              Guided flow for factory-to-sale operations. Use this to onboard less-experienced users.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Progress: {readiness?.progress_percent ?? 0}%
              </Typography>
              <LinearProgress variant="determinate" value={readiness?.progress_percent ?? 0} sx={{ mt: 0.5, height: 8, borderRadius: 10 }} />
            </Box>
            <List disablePadding sx={{ mt: 1.5 }}>
              {(readiness?.stages ?? []).map((stage) => (
                <ListItem key={stage.id} sx={{ px: 0, alignItems: 'flex-start' }}>
                  {stage.done ? <CheckCircle color="success" sx={{ mr: 1, mt: 0.5 }} /> : <RadioButtonUnchecked color="disabled" sx={{ mr: 1, mt: 0.5 }} />}
                  <Box sx={{ width: '100%' }}>
                    <ListItemText
                      primary={stage.name}
                      secondary={stage.done ? 'Complete' : `Pending: ${stage.required.join(', ')}`}
                    />
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                      {getStageActions(stage.id).map((action) => (
                        <Button
                          key={action.id}
                          size="small"
                          variant={stage.done ? 'outlined' : 'contained'}
                          onClick={() => navigate(action.path)}
                        >
                          {action.label}
                        </Button>
                      ))}
                      {stage.done && <Chip label="Done" size="small" color="success" />}
                    </Stack>
                  </Box>
                </ListItem>
              ))}
            </List>
            {!readiness && (
              <EmptyState
                title="Readiness loading"
                description="Fetching operational readiness status."
              />
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Factory-to-Sale Advice
            </Typography>
            <List disablePadding>
              {(readiness?.advice ?? ['Run Fashion Setup to begin guided operations.']).map((item) => (
                <ListItem key={item} sx={{ px: 0 }}>
                  <ListItemText primary={item} />
                </ListItem>
              ))}
            </List>
          </Paper>
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
