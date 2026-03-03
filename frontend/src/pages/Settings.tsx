import { useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
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
  AdminPanelSettings,
  People,
  DarkMode,
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import PermissionDesigner from '../components/designers/PermissionDesigner'
import UserManagement from '../components/designers/UserManagement'
import { useThemeContext } from '../ThemeContext'

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
}

type SettingsType = typeof defaultSettings

export default function Settings() {
  const [tabValue, setTabValue] = useState(0)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info',
  })

  const currentUser = useSelector((state: RootState) => state.auth.user)
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'
  const { mode, toggleMode } = useThemeContext()

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
        subtitle="Configure company, security, and user access control preferences."
      />

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<Business />} label="Company" iconPosition="start" />
          <Tab icon={<Security />} label="Security" iconPosition="start" />
          {isAdmin && <Tab icon={<AdminPanelSettings />} label="User Access" iconPosition="start" />}
          {isAdmin && <Tab icon={<People />} label="Users" iconPosition="start" />}
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

            {/* Display/Theme Options Area */}
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mt: 5 }}>
              Display Options
            </Typography>
            <Card sx={{ mt: 1 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <DarkMode color="action" />
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>Dark Mode</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Switch between light and dark display themes across the application.
                      </Typography>
                    </Box>
                  </Box>
                  <Switch checked={mode === 'dark'} onChange={toggleMode} color="primary" />
                </Box>
              </CardContent>
            </Card>

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
          {isAdmin ? (
            <Box sx={{ maxWidth: '100%', mx: 'auto', px: { xs: 2, sm: 0 } }}>
              <PermissionDesigner />
            </Box>
          ) : (
            <Alert severity="error">Access Denied</Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          {isAdmin ? (
            <Box sx={{ maxWidth: '100%', mx: 'auto', px: { xs: 2, sm: 0 } }}>
              <UserManagement />
            </Box>
          ) : (
            <Alert severity="error">Access Denied</Alert>
          )}
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
