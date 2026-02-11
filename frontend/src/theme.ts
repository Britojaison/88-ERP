import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    primary: {
      main: '#0f6d6a',
      light: '#2e8f8a',
      dark: '#0b4f4d',
    },
    secondary: {
      main: '#2563eb',
      light: '#4b86f0',
      dark: '#1d4fc0',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
    },
    background: {
      default: '#f3f6f9',
      paper: '#ffffff',
    },
    success: {
      main: '#15803d',
    },
    error: {
      main: '#dc2626',
    },
    warning: {
      main: '#d97706',
    },
    info: {
      main: '#0284c7',
    },
  },
  typography: {
    fontFamily: '"Manrope", "Segoe UI", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      letterSpacing: '-0.03em',
    },
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      fontWeight: 600,
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            'radial-gradient(circle at 0% 0%, rgba(37,99,235,0.08), transparent 30%), radial-gradient(circle at 100% 0%, rgba(15,109,106,0.08), transparent 24%)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 10,
          paddingLeft: 16,
          paddingRight: 16,
        },
        contained: {
          boxShadow: '0 8px 18px rgba(15, 109, 106, 0.22)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: '0 6px 24px rgba(15, 23, 42, 0.06)',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 999,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(15, 23, 42, 0.03)',
        },
      },
    },
  },
})

export default theme
