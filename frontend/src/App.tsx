import { Routes, Route } from 'react-router-dom'
import { Box } from '@mui/material'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import MasterData from './pages/MasterData'
import Documents from './pages/Documents'
import Inventory from './pages/Inventory'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import MetadataManagement from './pages/MetadataManagement'
import ShopifyIntegration from './pages/ShopifyIntegration'

function App() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="master-data" element={<MasterData />} />
          <Route path="documents" element={<Documents />} />
          <Route path="inventory" element={<Inventory />} />
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
