import { useState, useEffect } from 'react'
import {
    Box, Card, CardContent, Grid, Typography, TextField, MenuItem,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Button, CircularProgress, Chip,
} from '@mui/material'
import { Refresh, TrendingUp, TrendingDown } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import api from '../services/api'
import { mdmService, Location } from '../services/mdm.service'

interface SkuMargin {
    sku_code: string; sku_name: string; product_name: string; category: string
    qty_sold: number; revenue: number; cogs: number; gross_profit: number
    margin_pct: number; discount_given: number; avg_inventory: number; turnover_ratio: number
}

interface CategoryMargin {
    category: string; revenue: number; cogs: number; gross_profit: number; margin_pct: number; items: number
}

interface MarginData {
    month: string
    overview: {
        total_revenue: number; total_cogs: number; gross_profit: number
        overall_margin_pct: number; total_discount: number; total_skus_sold: number
    }
    by_category: CategoryMargin[]
    by_sku: SkuMargin[]
}

const fmt = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

function getMonthOptions(): string[] {
    const result: string[] = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return result
}

export default function MonthlyMarginReport() {
    const months = getMonthOptions()
    const [selectedMonth, setSelectedMonth] = useState(months[0])
    const [storeId, setStoreId] = useState('')
    const [stores, setStores] = useState<Location[]>([])
    const [data, setData] = useState<MarginData | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => { mdmService.getLocations().then(d => setStores(d.filter(l => l.location_type === 'store'))).catch(() => { }) }, [])
    useEffect(() => { void loadData() }, [selectedMonth, storeId])

    const loadData = async () => {
        setLoading(true)
        try {
            const params: any = { month: selectedMonth }
            if (storeId) params.location = storeId
            const res = await api.get('/inventory/reports/monthly-turnover-margin/', { params })
            setData(res.data)
        } catch { setData(null) }
        finally { setLoading(false) }
    }

    const ov = data?.overview

    return (
        <Box>
            <PageHeader title="Monthly Turnover & Margin Analysis" subtitle="Track gross margins, COGS, stock turnover ratios, and profitability by product and category." />

            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4}>
                    <TextField select fullWidth label="Month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} size="small">
                        {months.map(m => <MenuItem key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</MenuItem>)}
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
                    {/* Overview KPIs */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        {[
                            { label: 'Total Revenue', value: fmt(ov?.total_revenue || 0), color: 'primary.main', icon: '💰' },
                            { label: 'COGS', value: fmt(ov?.total_cogs || 0), color: 'warning.main', icon: '🏭' },
                            { label: 'Gross Profit', value: fmt(ov?.gross_profit || 0), color: (ov?.gross_profit || 0) >= 0 ? 'success.main' : 'error.main', icon: '📈' },
                            { label: 'Margin %', value: `${ov?.overall_margin_pct || 0}%`, color: (ov?.overall_margin_pct || 0) >= 30 ? 'success.main' : 'warning.main', icon: '📊' },
                            { label: 'Discounts Given', value: fmt(ov?.total_discount || 0), color: 'error.main', icon: '🏷️' },
                            { label: 'SKUs Sold', value: `${ov?.total_skus_sold || 0}`, color: 'info.main', icon: '📦' },
                        ].map(kpi => (
                            <Grid item xs={6} md={2} key={kpi.label}>
                                <Card variant="outlined">
                                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Typography variant="caption" color="text.secondary">{kpi.icon} {kpi.label}</Typography>
                                        <Typography variant="h6" fontWeight="bold" color={kpi.color}>{kpi.value}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    {/* Category Breakdown */}
                    {data.by_category.length > 0 && (
                        <Card variant="outlined" sx={{ mb: 3 }}>
                            <CardContent>
                                <Typography variant="h6" mb={2}>📂 Margin by Category</Typography>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                                                <TableCell><strong>Category</strong></TableCell>
                                                <TableCell align="right"><strong>Revenue</strong></TableCell>
                                                <TableCell align="right"><strong>COGS</strong></TableCell>
                                                <TableCell align="right"><strong>Gross Profit</strong></TableCell>
                                                <TableCell align="right"><strong>Margin %</strong></TableCell>
                                                <TableCell align="right"><strong>Products</strong></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.by_category.map(cat => (
                                                <TableRow key={cat.category} hover>
                                                    <TableCell><strong>{cat.category}</strong></TableCell>
                                                    <TableCell align="right">{fmt(cat.revenue)}</TableCell>
                                                    <TableCell align="right">{fmt(cat.cogs)}</TableCell>
                                                    <TableCell align="right" sx={{ color: cat.gross_profit >= 0 ? 'success.main' : 'error.main' }}>
                                                        {fmt(cat.gross_profit)}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Chip size="small" label={`${cat.margin_pct}%`}
                                                            color={cat.margin_pct >= 40 ? 'success' : cat.margin_pct >= 20 ? 'warning' : 'error'} />
                                                    </TableCell>
                                                    <TableCell align="right">{cat.items}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* Per-SKU Detail */}
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="h6" mb={2}>📋 SKU-Level Detail ({data.by_sku.length} products)</Typography>
                            <TableContainer sx={{ maxHeight: 600 }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell><strong>SKU</strong></TableCell>
                                            <TableCell><strong>Product</strong></TableCell>
                                            <TableCell align="right"><strong>Qty</strong></TableCell>
                                            <TableCell align="right"><strong>Revenue</strong></TableCell>
                                            <TableCell align="right"><strong>COGS</strong></TableCell>
                                            <TableCell align="right"><strong>Margin</strong></TableCell>
                                            <TableCell align="right"><strong>Avg Inv.</strong></TableCell>
                                            <TableCell align="right"><strong>Turnover</strong></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.by_sku.map(item => (
                                            <TableRow key={item.sku_code} hover>
                                                <TableCell><strong>{item.sku_code}</strong></TableCell>
                                                <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {item.sku_name || item.product_name}
                                                </TableCell>
                                                <TableCell align="right">{item.qty_sold}</TableCell>
                                                <TableCell align="right">{fmt(item.revenue)}</TableCell>
                                                <TableCell align="right">{fmt(item.cogs)}</TableCell>
                                                <TableCell align="right">
                                                    <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                                                        {item.margin_pct >= 30 ? <TrendingUp fontSize="small" color="success" /> : <TrendingDown fontSize="small" color="error" />}
                                                        <Typography variant="body2" color={item.margin_pct >= 30 ? 'success.main' : 'error.main'} fontWeight="bold">
                                                            {item.margin_pct}%
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="right">{item.avg_inventory}</TableCell>
                                                <TableCell align="right">
                                                    <Chip size="small" variant="outlined" label={`${item.turnover_ratio}x`}
                                                        color={item.turnover_ratio >= 2 ? 'success' : item.turnover_ratio >= 1 ? 'warning' : 'error'} />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {data.by_sku.length === 0 && (
                                            <TableRow><TableCell colSpan={8} align="center">
                                                <Typography py={4} color="text.secondary">No sales data for this month</Typography>
                                            </TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </>
            )}
        </Box>
    )
}
