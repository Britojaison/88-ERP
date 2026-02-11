import { useState } from 'react'
import {
  Alert,
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Grid,
  Card,
  CardContent,
  Snackbar,
} from '@mui/material'
import {
  Save,
  Business,
  Security,
  Notifications,
  Palette,
  Language,
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export default function Settings() {
  const [tabValue, setTabValue] = useState(0)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info',
  })

  const handleSave = (section: string) => {
    const key = `settings:last_saved:${section.toLowerCase().replace(/\s+/g, '_')}`
    localStorage.setItem(key, new Date().toISOString())
    setSnackbar({ open: true, message: `${section} settings saved.`, severity: 'success' })
  }

  return (
    <Box>
      <PageHeader
        title="Settings"
        subtitle="Configure company, security, notification, and localization preferences."
      />

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<Business />} label="Company" iconPosition="start" />
          <Tab icon={<Security />} label="Security" iconPosition="start" />
          <Tab icon={<Notifications />} label="Notifications" iconPosition="start" />
          <Tab icon={<Palette />} label="Appearance" iconPosition="start" />
          <Tab icon={<Language />} label="Localization" iconPosition="start" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Company Information
            </Typography>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Company Name"
                  defaultValue="88 ERP"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Tax ID"
                  defaultValue=""
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  multiline
                  rows={3}
                  defaultValue=""
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  defaultValue=""
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  defaultValue=""
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={() => handleSave('Company')}
                >
                  Save Changes
                </Button>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Security Settings
            </Typography>
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Enable Two-Factor Authentication"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Require Strong Passwords"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch />}
                  label="Enable Session Timeout"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Log All User Activities"
                />
              </CardContent>
            </Card>
            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={() => handleSave('Security')}
              >
                Save Security Settings
              </Button>
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Notification Preferences
            </Typography>
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Email Notifications"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Low Stock Alerts"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Order Status Updates"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch />}
                  label="Weekly Reports"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="System Maintenance Alerts"
                />
              </CardContent>
            </Card>
            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={() => handleSave('Notifications')}
              >
                Save Notification Settings
              </Button>
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Appearance Settings
            </Typography>
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <FormControlLabel
                  control={<Switch />}
                  label="Dark Mode"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Compact View"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Show Animations"
                />
              </CardContent>
            </Card>
            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={() => handleSave('Appearance')}
              >
                Save Appearance Settings
              </Button>
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Localization Settings
            </Typography>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  select
                  label="Language"
                  defaultValue="en"
                  SelectProps={{
                    native: true,
                  }}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  select
                  label="Timezone"
                  defaultValue="UTC"
                  SelectProps={{
                    native: true,
                  }}
                >
                  <option value="UTC">UTC</option>
                  <option value="EST">Eastern Time</option>
                  <option value="PST">Pacific Time</option>
                  <option value="CET">Central European Time</option>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  select
                  label="Date Format"
                  defaultValue="MM/DD/YYYY"
                  SelectProps={{
                    native: true,
                  }}
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  select
                  label="Currency"
                  defaultValue="USD"
                  SelectProps={{
                    native: true,
                  }}
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="JPY">JPY - Japanese Yen</option>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={() => handleSave('Localization')}
                >
                  Save Localization Settings
                </Button>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>
      </Paper>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
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
