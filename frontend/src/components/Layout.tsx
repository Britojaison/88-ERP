import { useMemo, useState, type MouseEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material'
import {
  AccountCircle,
  Assessment as ReportIcon,
  FactCheck as ReceivingIcon,
  Dashboard as DashboardIcon,
  Description as DocumentIcon,
  Inventory as InventoryIcon,
  Logout,
  Menu as MenuIcon,
  Settings as SettingsIcon,
  ShoppingCart as ShopifyIcon,
  LocalOffer as BarcodeIcon,
  People as PeopleIcon,
  Storefront as StoreIcon,
  Warehouse as WarehouseIcon,
  Speed as VelocityIcon,
  TrendingUp as MarginIcon,
  CompareArrows as CompareIcon,
  PointOfSale as DailySalesIcon,
  Brush as DesignerIcon,
  PrecisionManufacturing as KanbanIcon,
  SwapHoriz as TransferIcon,
} from '@mui/icons-material'
import { logout } from '../store/slices/authSlice'
import { authService } from '../services/auth.service'

const drawerWidth = 272

const navSections = [
  {
    heading: 'Operations',
    items: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
      { text: 'Master Data', icon: <PeopleIcon />, path: '/master-data' },
      { text: 'Documents', icon: <DocumentIcon />, path: '/documents' },
      { text: 'Inventory', icon: <InventoryIcon />, path: '/inventory' },
      { text: 'Barcodes', icon: <BarcodeIcon />, path: '/inventory/barcodes' },
      { text: 'Receiving', icon: <ReceivingIcon />, path: '/inventory/receiving' },
      { text: 'Warehouses', icon: <WarehouseIcon />, path: '/warehouses' },
      { text: 'Stores', icon: <StoreIcon />, path: '/stores' },
      { text: 'Transfers', icon: <TransferIcon />, path: '/inventory/stock-transfers' },
      { text: 'Store POS', icon: <StoreIcon />, path: '/pos' },
      { text: 'POS Returns', icon: <StoreIcon />, path: '/pos/returns' },
      { text: 'Reports', icon: <ReportIcon />, path: '/reports' },
    ],
  },
  {
    heading: 'Design & Production',
    items: [
      { text: 'Designer Workbench', icon: <DesignerIcon />, path: '/inventory/design-approvals' },
      { text: 'Production Kanban', icon: <KanbanIcon />, path: '/inventory/production-kanban' },
      { text: 'Product Journey', icon: <BarcodeIcon />, path: '/inventory/product-journey' },
    ],
  },
  {
    heading: 'Reports Detailed',
    items: [
      { text: 'Daily Sales', icon: <DailySalesIcon />, path: '/reports/daily' },
      { text: 'Stock Velocity', icon: <VelocityIcon />, path: '/reports/weekly-stock' },
      { text: 'Margin Analysis', icon: <MarginIcon />, path: '/reports/monthly-margin' },
      { text: 'Store vs Online', icon: <CompareIcon />, path: '/reports/channel-comparison' },
    ],
  },
  {
    heading: 'Platform',
    items: [
      { text: 'Shopify', icon: <ShopifyIcon />, path: '/shopify' },
      { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
    ],
  },
]

export default function Layout() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()

  const activeTitle = useMemo(() => {
    const matched = navSections
      .flatMap((section) => section.items)
      .find((item) =>
        item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path),
      )
    return matched?.text ?? 'ERP Platform'
  }, [location.pathname])

  const handleMenu = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = () => {
    authService.logout()
    dispatch(logout())
    navigate('/login')
    handleClose()
  }

  const drawer = (
    <Box>
      <Toolbar sx={{ px: 2.5, py: 1 }}>
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.12em' }}>
            88 ERP
          </Typography>
          <Typography variant="h6">Control Center</Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1.5, py: 2 }}>
        {navSections.map((section) => (
          <Box key={section.heading} sx={{ mb: 1.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ px: 1.5, mb: 0.75, display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
              {section.heading}
            </Typography>
            {section.items.map((item) => (
              <ListItemButton
                key={item.text}
                component={NavLink}
                to={item.path}
                end
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  '&.active': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                }}
                onClick={() => setMobileOpen(false)}
              >
                <ListItemIcon sx={{ color: 'text.secondary', minWidth: 38 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: 600 }} />
              </ListItemButton>
            ))}
          </Box>
        ))}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        color="inherit"
        sx={{
          zIndex: (muiTheme) => muiTheme.zIndex.drawer + 1,
          borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: 'none',
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(255,255,255,0.9)',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Workspace
            </Typography>
            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
              {activeTitle}
            </Typography>
          </Box>
          <IconButton size="large" onClick={handleMenu}>
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main' }}>
              <AccountCircle />
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={() => { navigate('/settings'); handleClose() }}>Settings</MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid rgba(15, 23, 42, 0.08)',
            backgroundColor: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
          },
        }}
      >
        {drawer}
      </Drawer>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        {drawer}
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, minHeight: '100vh' }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  )
}
