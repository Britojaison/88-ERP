import { useEffect, useState } from 'react'
import { Alert, Box, Button, Grid, List, ListItemButton, ListItemText, Paper, Snackbar, Stack, Typography } from '@mui/material'
import { Download, Refresh } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { reportingService } from '../services/reporting.service'

const reportCategories = [
  {
    title: 'Inventory Reports',
    reports: ['Stock Level Report', 'Inventory Valuation', 'Stock Movement History', 'Low Stock Alert Report'],
  },
  {
    title: 'Sales Reports',
    reports: ['Sales Summary', 'Sales by Product', 'Sales by Location', 'Customer Analysis'],
  },
  {
    title: 'Financial Reports',
    reports: ['Profit & Loss', 'Balance Sheet', 'Cash Flow Statement', 'Accounts Receivable'],
  },
  {
    title: 'Analytics',
    reports: ['Performance Dashboard', 'Trend Analysis', 'Forecasting Report', 'KPI Summary'],
  },
]

export default function Reports() {
  const [reportTypes, setReportTypes] = useState<Array<{ value: string; label: string }>>([])
  const [loading, setLoading] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'info' },
  )

  const loadReportTypes = async () => {
    setLoading(true)
    try {
      const types = await reportingService.getReportTypes()
      setReportTypes(types)
      setSnackbar({ open: true, message: 'Report types refreshed.', severity: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to refresh report configuration.', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReportTypes()
  }, [])

  const mapReportToType = (reportName: string): string | null => {
    const normalizedName = reportName.toLowerCase()
    const directMatch = reportTypes.find((type) => normalizedName.includes(type.label.toLowerCase()))
    if (directMatch) return directMatch.value
    return reportTypes[0]?.value ?? null
  }

  const handleGenerate = async (reportName: string) => {
    const reportType = mapReportToType(reportName)
    if (!reportType) {
      setSnackbar({ open: true, message: 'No report types configured yet.', severity: 'info' })
      return
    }

    try {
      await reportingService.generateReport(reportType, { report_name: reportName })
      setSnackbar({ open: true, message: `Report queued: ${reportName}`, severity: 'success' })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 404) {
        setSnackbar({
          open: true,
          message: 'Report definition missing. Configure report definitions first.',
          severity: 'info',
        })
        return
      }
      setSnackbar({ open: true, message: `Failed to generate ${reportName}.`, severity: 'error' })
    }
  }

  const handleExportBundle = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      categories: reportCategories,
      available_report_types: reportTypes,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-bundle-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setSnackbar({ open: true, message: 'Report bundle exported.', severity: 'success' })
  }

  return (
    <Box>
      <PageHeader
        title="Reports and Analytics"
        subtitle="Generate operational, financial, and planning insights."
        actions={
          <Stack direction="row" spacing={1.25}>
            <Button variant="outlined" startIcon={<Refresh />} onClick={() => void loadReportTypes()} disabled={loading}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<Download />} onClick={handleExportBundle}>
              Export Bundle
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={2.5}>
        {reportCategories.map((category) => (
          <Grid item xs={12} md={6} key={category.title}>
            <Paper sx={{ p: 2.5, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                {category.title}
              </Typography>
              <List disablePadding>
                {category.reports.map((report) => (
                  <ListItemButton key={report} sx={{ borderRadius: 2 }} onClick={() => void handleGenerate(report)}>
                    <ListItemText primary={report} secondary="Generate on demand" />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          </Grid>
        ))}
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
