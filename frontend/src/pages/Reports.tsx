import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material'
import {
  Assessment,
  TrendingUp,
  Inventory,
  Receipt,
  Download,
  Refresh,
} from '@mui/icons-material'

const reportCategories = [
  {
    title: 'Inventory Reports',
    icon: <Inventory sx={{ fontSize: 40 }} />,
    color: '#667eea',
    reports: [
      'Stock Level Report',
      'Inventory Valuation',
      'Stock Movement History',
      'Low Stock Alert Report',
    ],
  },
  {
    title: 'Sales Reports',
    icon: <Receipt sx={{ fontSize: 40 }} />,
    color: '#f093fb',
    reports: [
      'Sales Summary',
      'Sales by Product',
      'Sales by Location',
      'Customer Analysis',
    ],
  },
  {
    title: 'Financial Reports',
    icon: <TrendingUp sx={{ fontSize: 40 }} />,
    color: '#4facfe',
    reports: [
      'Profit & Loss',
      'Balance Sheet',
      'Cash Flow Statement',
      'Accounts Receivable',
    ],
  },
  {
    title: 'Analytics',
    icon: <Assessment sx={{ fontSize: 40 }} />,
    color: '#fa709a',
    reports: [
      'Performance Dashboard',
      'Trend Analysis',
      'Forecasting Report',
      'KPI Summary',
    ],
  },
]

export default function Reports() {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
            Reports & Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Generate and view business reports
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Download />}
            sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            Export All
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {reportCategories.map((category) => (
          <Grid item xs={12} md={6} key={category.title}>
            <Card
              sx={{
                height: '100%',
                background: `linear-gradient(135deg, ${category.color}15 0%, ${category.color}05 100%)`,
                border: `1px solid ${category.color}30`,
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: `${category.color}20`,
                      color: category.color,
                      mr: 2,
                    }}
                  >
                    {category.icon}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {category.title}
                  </Typography>
                </Box>
                <List dense>
                  {category.reports.map((report) => (
                    <ListItem
                      key={report}
                      sx={{
                        borderRadius: 1,
                        mb: 0.5,
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'rgba(0,0,0,0.04)',
                        },
                      }}
                    >
                      <ListItemText primary={report} />
                      <Chip label="Generate" size="small" />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ mt: 3, p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Recent Reports
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
            No recent reports generated
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}
