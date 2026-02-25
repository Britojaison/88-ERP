import { useState, useEffect } from 'react'
import {
    Box,
    Card,
    CardContent,
    Grid,
    Typography,
    TextField,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Button,
    Alert,
    CircularProgress,
} from '@mui/material'
import {
    TrendingUp,
    ShoppingCart,
    LocalOffer,
    Refresh,
    CameraAlt,
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import api from '../services/api'
import { mdmService, Location } from '../services/mdm.service'

interface DailySalesData {
    date: string
    overview: {
        total_revenue: number
        total_transactions: number
        total_items: number
        total_discount: number
        avg_transaction: number
    }
    payment_breakdown: Array<{ payment_method: string; count: number; total: number }>
    channel_breakdown: Array<{ sales_channel: string; count: number; total: number }>
    top_products: Array<{
        sku__code: string
        sku__name: string
        qty_sold: number
        revenue: number
        discount_given: number
    }>
    customer_breakdown: Array<{ customer_type: string; count: number; total: number }>
}

interface StockSummary {
    date: string
    total_skus: number
    total_opening: number
    total_closing: number
    total_sold: number
    total_received: number
    total_transferred_in: number
    total_transferred_out: number
    total_adjusted: number
}

function formatCurrency(val: number) {
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPayment(method: string) {
    const labels: Record<string, string> = {
        cash: '💵 Cash',
        card: '💳 Card',
        upi: '📱 UPI',
        wallet: '👛 Wallet',
        mixed: '🔀 Mixed',
    }
    return labels[method] || method
}

function formatChannel(channel: string) {
    const labels: Record<string, string> = {
        store: '🏬 Store',
        online: '🌐 Online',
        mobile: '📱 Mobile',
        marketplace: '🛒 Marketplace',
    }
    return labels[channel] || channel
}

export default function DailySalesReport() {
    const today = new Date().toISOString().split('T')[0]
    const [selectedDate, setSelectedDate] = useState(today)
    const [selectedStore, setSelectedStore] = useState('')
    const [stores, setStores] = useState<Location[]>([])
    const [salesData, setSalesData] = useState<DailySalesData | null>(null)
    const [stockSummary, setStockSummary] = useState<StockSummary | null>(null)
    const [loading, setLoading] = useState(false)
    const [snapshotLoading, setSnapshotLoading] = useState(false)
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

    useEffect(() => {
        loadStores()
    }, [])

    useEffect(() => {
        void loadReport()
    }, [selectedDate, selectedStore])

    const loadStores = async () => {
        try {
            const data = await mdmService.getLocations()
            setStores(data.filter(l => l.location_type === 'store'))
        } catch { }
    }

    const loadReport = async () => {
        setLoading(true)
        try {
            const params: any = { date: selectedDate }
            if (selectedStore) params.store = selectedStore
            if (selectedStore) params.location = selectedStore

            const [salesRes, stockRes] = await Promise.all([
                api.get('/inventory/reports/daily-sales-report/', { params }),
                api.get('/inventory/reports/stock-summary/', { params }),
            ])
            setSalesData(salesRes.data)
            setStockSummary(stockRes.data)
        } catch {
            setSalesData(null)
            setStockSummary(null)
        } finally {
            setLoading(false)
        }
    }

    const handleSnapshot = async () => {
        setSnapshotLoading(true)
        try {
            await api.post('/inventory/reports/take-snapshot/', { date: selectedDate })
            setFeedback({ type: 'success', msg: `Stock snapshot taken for ${selectedDate}` })
            void loadReport()
        } catch {
            setFeedback({ type: 'error', msg: 'Failed to take snapshot' })
        } finally {
            setSnapshotLoading(false)
        }
    }

    const ov = salesData?.overview

    return (
        <Box>
            <PageHeader
                title="Daily Sales & Stock Report"
                subtitle="View daily sales performance, discount tracking, customer metrics, and opening/closing stock."
                actions={
                    <Button variant="outlined" startIcon={<CameraAlt />} onClick={handleSnapshot} disabled={snapshotLoading}>
                        {snapshotLoading ? 'Snapping...' : 'Take Stock Snapshot'}
                    </Button>
                }
            />

            {feedback && (
                <Alert severity={feedback.type} sx={{ mb: 2 }} onClose={() => setFeedback(null)}>
                    {feedback.msg}
                </Alert>
            )}

            {/* Filters */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4}>
                    <TextField
                        fullWidth type="date" label="Report Date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <TextField
                        select fullWidth label="Store (Optional)"
                        value={selectedStore}
                        onChange={(e) => setSelectedStore(e.target.value)}
                    >
                        <MenuItem value="">All Stores</MenuItem>
                        {stores.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                    </TextField>
                </Grid>
                <Grid item xs={12} sm={4} display="flex" alignItems="center">
                    <Button fullWidth variant="contained" startIcon={<Refresh />} onClick={loadReport}>
                        Refresh
                    </Button>
                </Grid>
            </Grid>

            {loading ? (
                <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
            ) : (
                <>
                    {/* KPI Cards */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={6} md={3}>
                            <Card elevation={2} sx={{ bgcolor: 'primary.main', color: 'white' }}>
                                <CardContent>
                                    <Typography variant="body2" sx={{ opacity: 0.8 }}>Total Revenue</Typography>
                                    <Typography variant="h5" fontWeight="bold">
                                        {formatCurrency(ov?.total_revenue || 0)}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Card elevation={2}>
                                <CardContent>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <ShoppingCart fontSize="small" color="primary" />
                                        <Typography variant="body2" color="text.secondary">Transactions</Typography>
                                    </Box>
                                    <Typography variant="h5" fontWeight="bold">{ov?.total_transactions || 0}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Card elevation={2}>
                                <CardContent>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <LocalOffer fontSize="small" color="error" />
                                        <Typography variant="body2" color="text.secondary">Total Discount</Typography>
                                    </Box>
                                    <Typography variant="h5" fontWeight="bold" color="error.main">
                                        {formatCurrency(ov?.total_discount || 0)}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Card elevation={2}>
                                <CardContent>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <TrendingUp fontSize="small" color="success" />
                                        <Typography variant="body2" color="text.secondary">Avg. Bill Value</Typography>
                                    </Box>
                                    <Typography variant="h5" fontWeight="bold">
                                        {formatCurrency(ov?.avg_transaction || 0)}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Stock Summary Row */}
                    {stockSummary && stockSummary.total_skus > 0 && (
                        <Card elevation={1} sx={{ mb: 3, p: 2 }}>
                            <Typography variant="h6" mb={2}>📦 Stock Summary — {selectedDate}</Typography>
                            <Grid container spacing={2}>
                                {[
                                    { label: 'Opening Stock', val: stockSummary.total_opening, color: 'info.main' },
                                    { label: 'Closing Stock', val: stockSummary.total_closing, color: 'success.main' },
                                    { label: 'Units Sold', val: stockSummary.total_sold, color: 'error.main' },
                                    { label: 'Units Received', val: stockSummary.total_received, color: 'primary.main' },
                                ].map(item => (
                                    <Grid item xs={6} md={3} key={item.label}>
                                        <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                                        <Typography variant="h6" fontWeight="bold" color={item.color}>
                                            {item.val.toLocaleString()}
                                        </Typography>
                                    </Grid>
                                ))}
                            </Grid>
                        </Card>
                    )}

                    <Grid container spacing={3}>
                        {/* Payment Breakdown */}
                        <Grid item xs={12} md={6}>
                            <Card elevation={1}>
                                <CardContent>
                                    <Typography variant="h6" mb={2}>💳 Payment Breakdown</Typography>
                                    {salesData?.payment_breakdown?.length ? (
                                        <TableContainer>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Method</TableCell>
                                                        <TableCell align="right">Count</TableCell>
                                                        <TableCell align="right">Total</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {salesData.payment_breakdown.map(row => (
                                                        <TableRow key={row.payment_method}>
                                                            <TableCell>{formatPayment(row.payment_method)}</TableCell>
                                                            <TableCell align="right">{row.count}</TableCell>
                                                            <TableCell align="right">{formatCurrency(row.total)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    ) : (
                                        <Typography color="text.secondary" py={2} textAlign="center">No transactions today</Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Customer Breakdown */}
                        <Grid item xs={12} md={6}>
                            <Card elevation={1}>
                                <CardContent>
                                    <Typography variant="h6" mb={2}>👥 Customer Breakdown</Typography>
                                    {salesData?.customer_breakdown?.length ? (
                                        <TableContainer>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Type</TableCell>
                                                        <TableCell align="right">Count</TableCell>
                                                        <TableCell align="right">Revenue</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {salesData.customer_breakdown.map(row => (
                                                        <TableRow key={row.customer_type}>
                                                            <TableCell>
                                                                <Chip
                                                                    label={row.customer_type === 'walk-in' ? 'Walk-in' : row.customer_type === 'member' ? 'Member' : 'VIP'}
                                                                    size="small"
                                                                    color={row.customer_type === 'vip' ? 'warning' : row.customer_type === 'member' ? 'primary' : 'default'}
                                                                />
                                                            </TableCell>
                                                            <TableCell align="right">{row.count}</TableCell>
                                                            <TableCell align="right">{formatCurrency(row.total)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    ) : (
                                        <Typography color="text.secondary" py={2} textAlign="center">No data</Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Top Products */}
                        <Grid item xs={12}>
                            <Card elevation={1}>
                                <CardContent>
                                    <Typography variant="h6" mb={2}>🏆 Top 10 Products</Typography>
                                    {salesData?.top_products?.length ? (
                                        <TableContainer>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>#</TableCell>
                                                        <TableCell>SKU Code</TableCell>
                                                        <TableCell>Product Name</TableCell>
                                                        <TableCell align="right">Qty Sold</TableCell>
                                                        <TableCell align="right">Revenue</TableCell>
                                                        <TableCell align="right">Discount Given</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {salesData.top_products.map((row, idx) => (
                                                        <TableRow key={row.sku__code}>
                                                            <TableCell>{idx + 1}</TableCell>
                                                            <TableCell><strong>{row.sku__code}</strong></TableCell>
                                                            <TableCell>{row.sku__name}</TableCell>
                                                            <TableCell align="right">{row.qty_sold}</TableCell>
                                                            <TableCell align="right">{formatCurrency(row.revenue)}</TableCell>
                                                            <TableCell align="right" sx={{ color: 'error.main' }}>
                                                                {formatCurrency(row.discount_given)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    ) : (
                                        <Typography color="text.secondary" py={4} textAlign="center">
                                            No sales recorded for this date
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Channel Breakdown */}
                        {salesData?.channel_breakdown && salesData.channel_breakdown.length > 0 && (
                            <Grid item xs={12} md={6}>
                                <Card elevation={1}>
                                    <CardContent>
                                        <Typography variant="h6" mb={2}>📊 Sales by Channel</Typography>
                                        <TableContainer>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Channel</TableCell>
                                                        <TableCell align="right">Orders</TableCell>
                                                        <TableCell align="right">Revenue</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {salesData.channel_breakdown.map(row => (
                                                        <TableRow key={row.sales_channel}>
                                                            <TableCell>{formatChannel(row.sales_channel)}</TableCell>
                                                            <TableCell align="right">{row.count}</TableCell>
                                                            <TableCell align="right">{formatCurrency(row.total)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </CardContent>
                                </Card>
                            </Grid>
                        )}
                    </Grid>
                </>
            )}
        </Box>
    )
}
