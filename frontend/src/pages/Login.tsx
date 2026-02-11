import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  Business,
  Email,
  Lock,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material'
import { setCredentials } from '../store/slices/authSlice'
import { authService } from '../services/auth.service'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await authService.login({ email, password })
      
      dispatch(
        setCredentials({
          user: response.user,
          token: response.access,
        }),
      )
      
      navigate('/')
    } catch (err: any) {
      console.error('Login error:', err)
      setError(
        err.response?.data?.detail || 
        err.response?.data?.message || 
        'Invalid email or password. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' },
        bgcolor: '#0b1020',
      }}
    >
      <Box
        sx={{
          px: { xs: 3, md: 6 },
          py: { xs: 5, md: 8 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          color: 'white',
          background:
            'radial-gradient(circle at 20% 10%, rgba(37,99,235,0.42), transparent 48%), radial-gradient(circle at 80% 80%, rgba(15,109,106,0.4), transparent 44%)',
        }}
      >
        <Business sx={{ fontSize: 52, mb: 2 }} />
        <Typography variant="h3" gutterBottom>
          88 ERP Platform
        </Typography>
        <Typography variant="h6" sx={{ maxWidth: 520, opacity: 0.92 }}>
          Metadata-driven operations for inventory, documents, workflow, and integrations.
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 3 }}>
          <Chip label="Audit Ready" sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: 'white' }} />
          <Chip label="Multi-module" sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: 'white' }} />
          <Chip label="Scalable" sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: 'white' }} />
        </Stack>
      </Box>

      <Box sx={{ display: 'grid', placeItems: 'center', p: 3, bgcolor: '#f3f6f9' }}>
        <Paper sx={{ width: '100%', maxWidth: 430, p: 4 }}>
          <Typography variant="h4" gutterBottom>
            Sign In
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Access your workspace dashboard and system controls.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              required
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              required
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton edge="end" onClick={() => setShowPassword(!showPassword)} disabled={loading}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button 
              fullWidth 
              type="submit" 
              variant="contained" 
              size="large" 
              sx={{ mt: 2, py: 1.35 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Continue'}
            </Button>
          </form>

          <Divider sx={{ my: 2.5 }} />
          <Typography variant="caption" color="text.secondary" display="block">
            Demo: admin@88erp.com / admin123
          </Typography>
        </Paper>
      </Box>
    </Box>
  )
}
