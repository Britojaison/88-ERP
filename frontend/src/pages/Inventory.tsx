import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  Warning,
} from '@mui/icons-material'

const inventoryStats = [
  {
    title: 'Total Items',
    value: '0',
    change: '+0%',
    trend: 'up',
    color: '#667eea',
  },
  {
    title: 'Low Stock Items',
    value: '0',
    change: '0 items',
    trend: 'warning',
    color: '#fa709a',
  },
  {
    title: 'Out of Stock',
    value: '0',
    change: '0 items',
    trend: 'down',
    color: '#f093fb',
  },
  {
    title: 'Total Value',
    value: '$0',
    change: '+0%',
    trend: 'up',
    color: '#4facfe',
  },
]

export default function Inventory() {
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
          Inventory Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track and manage your inventory levels
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {inventoryStats.map((stat) => (
          <Grid item xs={12} sm={6} lg={3} key={stat.title}>
            <Card
              sx={{
                height: '100%',
                background: `linear-gradient(135deg, ${stat.color}15 0%, ${stat.color}05 100%)`,
                border: `1px solid ${stat.color}30`,
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {stat.title}
                  </Typography>
                  {stat.trend === 'up' && <TrendingUp sx={{ color: 'success.main' }} />}
                  {stat.trend === 'down' && <TrendingDown sx={{ color: 'error.main' }} />}
                  {stat.trend === 'warning' && <Warning sx={{ color: 'warning.main' }} />}
                </Box>
                <Typography variant="h3" sx={{ fontWeight: 700, color: stat.color, mb: 1 }}>
                  {stat.value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {stat.change}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Inventory by Location
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                No inventory data available
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Stock Alerts
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                No alerts
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Recent Movements
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                No recent inventory movements
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
