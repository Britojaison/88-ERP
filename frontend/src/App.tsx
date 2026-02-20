import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Box } from '@mui/material'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import MasterData from './pages/MasterData'
import Documents from './pages/Documents'
import Inventory from './pages/Inventory'
import InventoryBarcodes from './pages/InventoryBarcodes'
import InventoryReceiving from './pages/InventoryReceiving'
import InventoryTracking from './pages/InventoryTracking'
import ProductJourney from './pages/ProductJourney'
import DesignApprovals from './pages/DesignApprovals'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import MetadataManagement from './pages/MetadataManagement'
import ShopifyIntegration from './pages/ShopifyIntegration'

function RequireAuth({ children }: { children: JSX.Element }) {
  const location = useLocation()
  const token = localStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

function PublicOnly({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('token')
  if (token) {
    return <Navigate to="/" replace />
  }
  return children
}

function App() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <Login />
            </PublicOnly>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="master-data" element={<MasterData />} />
          <Route path="documents" element={<Documents />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="inventory/barcodes" element={<InventoryBarcodes />} />
          <Route path="inventory/receiving" element={<InventoryReceiving />} />
          <Route path="inventory/tracking" element={<InventoryTracking />} />
          <Route path="inventory/product-journey" element={<ProductJourney />} />
          <Route path="inventory/design-approvals" element={<DesignApprovals />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="metadata" element={<MetadataManagement />} />
          <Route path="shopify" element={<ShopifyIntegration />} />
        </Route>
      </Routes>
    </Box>
  )
}

export default App
