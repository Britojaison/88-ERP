import { useEffect, useState } from 'react'
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

const defaultSettings = {
  companyName: '88 ERP',
  taxId: '',
  address: '',
  phone: '',
  email: '',
  twoFactor: true,
  strongPassword: true,
  sessionTimeout: false,
  logActivity: true,
  emailNotif: true,
  lowStockAlert: true,
  orderStatusUpdate: true,
  weeklyReports: false,
  systemMaintenance: true,
  darkMode: false,
  compactView: true,
  showAnimations: true,
  language: 'en',
  timezone: 'UTC',
  dateFormat: 'MM/DD/YYYY',
  currency: 'INR'
}

type SettingsType = typeof defaultSettings

export default function Settings() {
  const [tabValue, setTabValue] = useState(0)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info',
  })

  const [settings, setSettings] = useState<SettingsType>(() => {
    const saved = localStorage.getItem('erp_settings')
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved) }
      } catch (e) {
        return defaultSettings
      }
    }
    return defaultSettings
  })

  const handleChange = (field: keyof SettingsType, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = (section: string) => {
    localStorage.setItem('erp_settings', JSON.stringify(settings))
    setSnackbar({ open: true, message: `${section} settings saved successfully.`, severity: 'success' })
  }

  return (
    <Box>
      <PageHeader
        title="Settings"
        subtitle="Configure company, security, notification, and localization preferences."
      />

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<Business />} label="Company" iconPosition="start" />
          <Tab icon={<Security />} label="Security" iconPosition="start" />
          <Tab icon={<Notifications />} label="Notifications" iconPosition="start" />
          <Tab icon={<Palette />} label="Appearance" iconPosition="start" />
          <Tab icon={<Language />} label="Localization" iconPosition="start" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ maxWidth: 800, mx: 'auto', px: { xs: 2, sm: 0 } }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Company Information
            </Typography>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Company Name"
                  value={settings.companyName}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Tax ID"
                  value={settings.taxId}
                  onChange={(e) => handleChange('taxId', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  multiline
                  rows={3}
                  value={settings.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={settings.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => handleChange('email', e.target.value)}
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
          <Box sx={{ maxWidth: 800, mx: 'auto', px: { xs: 2, sm: 0 } }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Security Settings
            </Typography>
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <FormControlLabel
                  control={<Switch checked={settings.twoFactor} onChange={(e) => handleChange('twoFactor', e.target.checked)} />}
                  label="Enable Two-Factor Authentication"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch checked={settings.strongPassword} onChange={(e) => handleChange('strongPassword', e.target.checked)} />}
                  label="Require Strong Passwords"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch checked={settings.sessionTimeout} onChange={(e) => handleChange('sessionTimeout', e.target.checked)} />}
                  label="Enable Session Timeout"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch checked={settings.logActivity} onChange={(e) => handleChange('logActivity', e.target.checked)} />}
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
          <Box sx={{ maxWidth: 800, mx: 'auto', px: { xs: 2, sm: 0 } }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Notification Preferences
            </Typography>
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <FormControlLabel
                  control={<Switch checked={settings.emailNotif} onChange={(e) => handleChange('emailNotif', e.target.checked)} />}
                  label="Email Notifications"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch checked={settings.lowStockAlert} onChange={(e) => handleChange('lowStockAlert', e.target.checked)} />}
                  label="Low Stock Alerts"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch checked={settings.orderStatusUpdate} onChange={(e) => handleChange('orderStatusUpdate', e.target.checked)} />}
                  label="Order Status Updates"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch checked={settings.weeklyReports} onChange={(e) => handleChange('weeklyReports', e.target.checked)} />}
                  label="Weekly Reports"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch checked={settings.systemMaintenance} onChange={(e) => handleChange('systemMaintenance', e.target.checked)} />}
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
          <Box sx={{ maxWidth: 800, mx: 'auto', px: { xs: 2, sm: 0 } }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Appearance Settings
            </Typography>
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <FormControlLabel
                  control={<Switch checked={settings.darkMode} onChange={(e) => handleChange('darkMode', e.target.checked)} />}
                  label="Dark Mode"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch checked={settings.compactView} onChange={(e) => handleChange('compactView', e.target.checked)} />}
                  label="Compact View"
                />
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={<Switch checked={settings.showAnimations} onChange={(e) => handleChange('showAnimations', e.target.checked)} />}
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
          <Box sx={{ maxWidth: 800, mx: 'auto', px: { xs: 2, sm: 0 } }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Localization Settings
            </Typography>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  select
                  label="Language"
                  value={settings.language}
                  onChange={(e) => handleChange('language', e.target.value)}
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
                  value={settings.timezone}
                  onChange={(e) => handleChange('timezone', e.target.value)}
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
                  value={settings.dateFormat}
                  onChange={(e) => handleChange('dateFormat', e.target.value)}
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
                  value={settings.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  SelectProps={{
                    native: true,
                  }}
                >
                  <option value="INR">INR - Indian Rupee</option>
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
