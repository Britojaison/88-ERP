import { useState, useEffect } from 'react'
import {
    Box, Card, CardContent, Grid, Typography, TextField, MenuItem,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Button, Alert, CircularProgress, Chip, Paper, Tabs, Tab,
} from '@mui/material'
import { Speed, Refresh, TrendingDown, TrendingUp } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import api from '../services/api'
import { mdmService, Location } from '../services/mdm.service'

interface StockItem {
    sku_id: string; sku_code: string; sku_name: string; product_name: string
    current_stock: number; sold_in_period: number; revenue: number
    daily_rate: number; days_of_stock: number | null; stock_value: number
}

interface VelocityData {
    period_days: number
    fast_threshold: number
    summary: {
        fast_count: number; slow_count: number; dead_count: number
        total_skus: number; dead_stock_value: number
    }
    fast_moving: StockItem[]; slow_moving: StockItem[]; dead_stock: StockItem[]
}

const fmt = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function WeeklyStockReport() {
    const [period, setPeriod] = useState('7')
    const [storeId, setStoreId] = useState('')
    const [stores, setStores] = useState<Location[]>([])
    const [data, setData] = useState<VelocityData | null>(null)
    const [loading, setLoading] = useState(false)
    const [tab, setTab] = useState(0)

    useEffect(() => { mdmService.getLocations().then(d => setStores(d.filter(l => l.location_type === 'store'))).catch(() => { }) }, [])
    useEffect(() => { void loadData() }, [period, storeId])

    const loadData = async () => {
        setLoading(true)
        try {
            const params: any = { period }
            if (storeId) params.location = storeId
            const res = await api.get('/inventory/reports/weekly-stock-velocity/', { params })
            setData(res.data)
        } catch { setData(null) }
        finally { setLoading(false) }
    }

    const StockTable = ({ items, color }: { items: StockItem[], color: string }) => (
        <TableContainer component={Paper} variant="outlined">
            <Table size="small">
                <TableHead>
                    <TableRow sx={{ bgcolor: `${color}` }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>SKU</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Product</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Stock</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Sold</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Daily Rate</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Days Left</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Revenue</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {items.length === 0 ? (
                        <TableRow><TableCell colSpan={7} align="center"><Typography color="text.secondary" py={3}>No items in this category</Typography></TableCell></TableRow>
                    ) : items.map(item => (
                        <TableRow key={item.sku_id} hover>
                            <TableCell><strong>{item.sku_code}</strong></TableCell>
                            <TableCell>{item.sku_name || item.product_name}</TableCell>
                            <TableCell align="right">{item.current_stock}</TableCell>
                            <TableCell align="right">{item.sold_in_period}</TableCell>
                            <TableCell align="right">{item.daily_rate}/day</TableCell>
                            <TableCell align="right">
                                {item.days_of_stock != null ? (
                                    <Chip size="small" label={`${item.days_of_stock}d`}
                                        color={item.days_of_stock < 7 ? 'error' : item.days_of_stock < 30 ? 'warning' : 'success'} />
                                ) : <Chip size="small" label="∞" color="default" />}
                            </TableCell>
                            <TableCell align="right">{fmt(item.revenue)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    )

    const s = data?.summary

    return (
        <Box>
            <PageHeader title="Weekly Stock Velocity Report" subtitle="Fast, slow, and dead stock analysis with days-of-stock calculations." />

            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4}>
                    <TextField select fullWidth label="Period" value={period} onChange={e => setPeriod(e.target.value)} size="small">
                        <MenuItem value="7">Last 7 Days</MenuItem>
                        <MenuItem value="14">Last 14 Days</MenuItem>
                        <MenuItem value="30">Last 30 Days</MenuItem>
                    </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                    <TextField select fullWidth label="Store (Optional)" value={storeId} onChange={e => setStoreId(e.target.value)} size="small">
                        <MenuItem value="">All Locations</MenuItem>
                        {stores.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                    </TextField>
                </Grid>
                <Grid item xs={12} sm={4} display="flex" alignItems="center">
                    <Button fullWidth variant="contained" startIcon={<Refresh />} onClick={loadData}>Refresh</Button>
                </Grid>
            </Grid>

            {loading ? <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box> : data && (
                <>
                    {/* Summary KPIs */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={6} md={3}>
                            <Card sx={{ borderLeft: '4px solid', borderColor: 'success.main' }}>
                                <CardContent>
                                    <Typography variant="body2" color="text.secondary">🚀 Fast Moving</Typography>
                                    <Typography variant="h4" fontWeight="bold" color="success.main">{s?.fast_count || 0}</Typography>
                                    <Typography variant="caption">SKUs with ≥{data.fast_threshold} units sold</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Card sx={{ borderLeft: '4px solid', borderColor: 'warning.main' }}>
                                <CardContent>
                                    <Typography variant="body2" color="text.secondary">🐢 Slow Moving</Typography>
                                    <Typography variant="h4" fontWeight="bold" color="warning.main">{s?.slow_count || 0}</Typography>
                                    <Typography variant="caption">SKUs with some sales</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Card sx={{ borderLeft: '4px solid', borderColor: 'error.main' }}>
                                <CardContent>
                                    <Typography variant="body2" color="text.secondary">💀 Dead Stock</Typography>
                                    <Typography variant="h4" fontWeight="bold" color="error.main">{s?.dead_count || 0}</Typography>
                                    <Typography variant="caption">Zero sales in period</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Card sx={{ borderLeft: '4px solid', borderColor: 'info.main' }}>
                                <CardContent>
                                    <Typography variant="body2" color="text.secondary">📦 Dead Stock Value</Typography>
                                    <Typography variant="h5" fontWeight="bold" color="error.main">{fmt(s?.dead_stock_value || 0)}</Typography>
                                    <Typography variant="caption">Capital locked in dead stock</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Tabs for each category */}
                    <Paper sx={{ mb: 2 }}>
                        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
                            <Tab icon={<TrendingUp />} label={`Fast (${s?.fast_count || 0})`} iconPosition="start" />
                            <Tab icon={<Speed />} label={`Slow (${s?.slow_count || 0})`} iconPosition="start" />
                            <Tab icon={<TrendingDown />} label={`Dead (${s?.dead_count || 0})`} iconPosition="start" />
                        </Tabs>
                    </Paper>

                    {tab === 0 && <StockTable items={data.fast_moving} color="#2e7d32" />}
                    {tab === 1 && <StockTable items={data.slow_moving} color="#ed6c02" />}
                    {tab === 2 && (
                        <>
                            {(s?.dead_stock_value || 0) > 0 && (
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                    <strong>{fmt(s?.dead_stock_value || 0)}</strong> worth of inventory had zero sales in the last {data.period_days} days. Consider markdowns, bundling, or returns to supplier.
                                </Alert>
                            )}
                            <StockTable items={data.dead_stock} color="#d32f2f" />
                        </>
                    )}
                </>
            )}
        </Box>
    )
}
