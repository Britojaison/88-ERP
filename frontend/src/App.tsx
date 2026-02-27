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
import ProductionKanban from './pages/ProductionKanban'
import StockTransfer from './pages/StockTransfer'
import InventoryHealth from './pages/InventoryHealth'
import POSCheckout from './pages/POSCheckout'
import Stores from './pages/Stores'
import Warehouse from './pages/Warehouse'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import ShopifyIntegration from './pages/ShopifyIntegration'
import DailySalesReport from './pages/DailySalesReport'
import WeeklyStockReport from './pages/WeeklyStockReport'
import MonthlyMarginReport from './pages/MonthlyMarginReport'
import ChannelComparisonReport from './pages/ChannelComparisonReport'
import POSReturns from './pages/POSReturns'

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
          <Route path="pos" element={<POSCheckout />} />
          <Route path="pos/returns" element={<POSReturns />} />
          <Route path="stores" element={<Stores />} />
          <Route path="warehouses" element={<Warehouse />} />
          <Route path="master-data" element={<MasterData />} />
          <Route path="documents" element={<Documents />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="inventory/barcodes" element={<InventoryBarcodes />} />
          <Route path="inventory/receiving" element={<InventoryReceiving />} />
          <Route path="inventory/tracking" element={<InventoryTracking />} />
          <Route path="inventory/product-journey" element={<ProductJourney />} />
          <Route path="inventory/design-approvals" element={<DesignApprovals />} />
          <Route path="inventory/production-kanban" element={<ProductionKanban />} />
          <Route path="inventory/stock-transfers" element={<StockTransfer />} />
          <Route path="inventory/health" element={<InventoryHealth />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/daily" element={<DailySalesReport />} />
          <Route path="reports/weekly-stock" element={<WeeklyStockReport />} />
          <Route path="reports/monthly-margin" element={<MonthlyMarginReport />} />
          <Route path="reports/channel-comparison" element={<ChannelComparisonReport />} />
          <Route path="settings" element={<Settings />} />
          <Route path="shopify" element={<ShopifyIntegration />} />
        </Route>
      </Routes>
    </Box>
  )
}

export default App
