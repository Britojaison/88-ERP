import { useNavigate } from 'react-router-dom'
import { Box, Button, Chip, Grid, List, ListItem, ListItemText, Paper, Stack, Typography } from '@mui/material'
import {
  Assessment,
  Inventory,
  PendingActions,
  ReceiptLong,
  SouthEast,
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import MetricCard from '../components/ui/MetricCard'
import EmptyState from '../components/ui/EmptyState'

const quickActions = [
  { label: 'Create Product', path: '/master-data' },
  { label: 'New Document', path: '/documents' },
  { label: 'Inventory Check', path: '/inventory' },
  { label: 'Generate Report', path: '/reports' },
]

export default function Dashboard() {
  const navigate = useNavigate()

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
          <MetricCard label="Total Products" value="0" icon={<Inventory />} note="No product records yet" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            label="Active Documents"
            value="0"
            icon={<ReceiptLong />}
            note="Purchase and sales activity"
            tone="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            label="Inventory Value"
            value="$0"
            icon={<Assessment />}
            note="Valuation in base currency"
            tone="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            label="Pending Approvals"
            value="0"
            icon={<PendingActions />}
            note="Workflow queue"
            tone="warning"
          />
        </Grid>

        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Activity Feed
            </Typography>
            <EmptyState
              title="No recent activity"
              description="When operations start, approvals and document updates will appear here."
            />
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              System Health
            </Typography>
            <List disablePadding>
              {[
                { label: 'Database', status: 'Healthy', tone: 'success' as const },
                { label: 'API Services', status: 'Online', tone: 'success' as const },
                { label: 'Background Jobs', status: 'Running', tone: 'success' as const },
              ].map((item) => (
                <ListItem key={item.label} sx={{ px: 0 }}>
                  <ListItemText primary={item.label} />
                  <Chip size="small" color={item.tone} label={item.status} />
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
    </Box>
  )
}
