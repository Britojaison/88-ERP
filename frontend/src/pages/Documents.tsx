import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
} from '@mui/material'
import {
  Description,
  ShoppingCart,
  LocalShipping,
  Receipt,
  Add,
} from '@mui/icons-material'

const documentTypes = [
  {
    title: 'Purchase Orders',
    icon: <ShoppingCart sx={{ fontSize: 40 }} />,
    count: 0,
    color: '#667eea',
  },
  {
    title: 'Sales Orders',
    icon: <Receipt sx={{ fontSize: 40 }} />,
    count: 0,
    color: '#f093fb',
  },
  {
    title: 'Invoices',
    icon: <Description sx={{ fontSize: 40 }} />,
    count: 0,
    color: '#4facfe',
  },
  {
    title: 'Shipments',
    icon: <LocalShipping sx={{ fontSize: 40 }} />,
    count: 0,
    color: '#fa709a',
  },
]

export default function Documents() {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
            Documents
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage all business documents
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
          Create Document
        </Button>
      </Box>

      <Grid container spacing={3}>
        {documentTypes.map((doc) => (
          <Grid item xs={12} sm={6} md={3} key={doc.title}>
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                },
              }}
            >
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      backgroundColor: `${doc.color}20`,
                      color: doc.color,
                      mb: 2,
                    }}
                  >
                    {doc.icon}
                  </Box>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    {doc.title}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: doc.color }}>
                    {doc.count}
                  </Typography>
                  <Chip
                    label="View All"
                    size="small"
                    sx={{ mt: 2 }}
                    onClick={() => {}}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ mt: 3, p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Recent Documents
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
            No recent documents to display
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}
