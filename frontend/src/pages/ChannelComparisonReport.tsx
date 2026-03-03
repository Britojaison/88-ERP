import { useState, useEffect } from 'react'
import {
    Box, Card, CardContent, Grid, Typography, TextField,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Button, CircularProgress, Chip, useTheme,
} from '@mui/material'
import { Refresh, Storefront, ShoppingCart, CompareArrows } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import api from '../services/api'

interface DailyChannel {
    date: string; store_revenue: number; store_orders: number
    online_revenue: number; online_orders: number
}

interface ComparisonData {
    start_date: string; end_date: string
    totals: {
        store_revenue: number; online_revenue: number
        store_orders: number; online_orders: number
        grand_total: number; store_pct: number; online_pct: number
    }
    daily: DailyChannel[]
}

const fmt = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

function SimpleBarChart({ data }: { data: DailyChannel[] }) {
    const theme = useTheme()
    if (!data.length) return null

    const maxVal = Math.max(...data.map(d => Math.max(d.store_revenue, d.online_revenue)), 1)
    const barWidth = Math.max(6, Math.min(20, Math.floor(800 / data.length) - 4))

    return (
        <Box sx={{ overflowX: 'auto', pb: 1, width: '100%', WebkitOverflowScrolling: 'touch' }}>
            <svg width={Math.max(600, data.length * (barWidth * 2 + 8))} height={160} style={{ display: 'block', minWidth: '100%' }}>
                {data.map((d, i) => {
                    const x = i * (barWidth * 2 + 8) + 20
                    const storeH = (d.store_revenue / maxVal) * 120
                    const onlineH = (d.online_revenue / maxVal) * 120

                    return (
                        <g key={d.date}>
                            <rect x={x} y={140 - storeH} width={barWidth} height={storeH}
                                fill={theme.palette.primary.main} rx={2} opacity={0.85}>
                                <title>Store: {fmt(d.store_revenue)} on {d.date}</title>
                            </rect>
                            <rect x={x + barWidth + 2} y={140 - onlineH} width={barWidth} height={onlineH}
                                fill={theme.palette.secondary.main} rx={2} opacity={0.85}>
                                <title>Online: {fmt(d.online_revenue)} on {d.date}</title>
                            </rect>
                            {i % Math.ceil(data.length / 10) === 0 && (
                                <text x={x + barWidth} y={155} textAnchor="middle" fontSize={9} fill={theme.palette.text.secondary}>
                                    {d.date.slice(5)}
                                </text>
                            )}
                        </g>
                    )
                })}
            </svg>
            <Box display="flex" gap={3} justifyContent="center" mt={1}>
                <Box display="flex" alignItems="center" gap={0.5}>
                    <Box sx={{ width: 12, height: 12, bgcolor: 'primary.main', borderRadius: '2px' }} />
                    <Typography variant="caption">Store</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={0.5}>
                    <Box sx={{ width: 12, height: 12, bgcolor: 'secondary.main', borderRadius: '2px' }} />
                    <Typography variant="caption">Online / Shopify</Typography>
                </Box>
            </Box>
        </Box>
    )
}

export default function ChannelComparisonReport() {
    const today = new Date().toISOString().split('T')[0]
    const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

    const [startDate, setStartDate] = useState(thirtyAgo)
    const [endDate, setEndDate] = useState(today)
    const [data, setData] = useState<ComparisonData | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => { void loadData() }, [startDate, endDate])

    const loadData = async () => {
        setLoading(true)
        try {
            const res = await api.get('/inventory/reports/channel-comparison/', {
                params: { start_date: startDate, end_date: endDate }
            })
            setData(res.data)
        } catch { setData(null) }
        finally { setLoading(false) }
    }

    const t = data?.totals

    return (
        <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', p: { xs: 1, sm: 2 } }}>
            <PageHeader title="Store vs Shopify Sales Comparison"
                subtitle="Compare in-store POS sales against online/Shopify sales side by side." />

            <Grid container spacing={1} sx={{ mb: 1.5 }}>
                <Grid item xs={12} sm={6} md={4}>
                    <TextField fullWidth type="date" label="Start Date" value={startDate}
                        onChange={e => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <TextField fullWidth type="date" label="End Date" value={endDate}
                        onChange={e => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
                </Grid>
                <Grid item xs={12} md={4} display="flex" alignItems="center">
                    <Button fullWidth variant="contained" startIcon={<Refresh />} onClick={loadData} size="small" sx={{ height: 40 }}>Refresh</Button>
                </Grid>
            </Grid>

            {loading ? <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box> : data && (
                <>
                    {/* Summary Cards */}
                    <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
                        <Grid item xs={12} md={4}>
                            <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                                        <Storefront fontSize="small" />
                                        <Typography variant="subtitle2" fontWeight={600}>Store Sales</Typography>
                                    </Box>
                                    <Typography variant="h5" fontWeight="bold">{fmt(t?.store_revenue || 0)}</Typography>
                                    <Box display="flex" justifyContent="space-between" mt={0.5}>
                                        <Typography variant="caption" sx={{ opacity: 0.8 }}>{t?.store_orders || 0} orders</Typography>
                                        <Chip label={`${t?.store_pct || 0}%`} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Card sx={{ bgcolor: 'secondary.main', color: 'white' }}>
                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                                        <ShoppingCart fontSize="small" />
                                        <Typography variant="subtitle2" fontWeight={600}>Online / Shopify</Typography>
                                    </Box>
                                    <Typography variant="h5" fontWeight="bold">{fmt(t?.online_revenue || 0)}</Typography>
                                    <Box display="flex" justifyContent="space-between" mt={0.5}>
                                        <Typography variant="caption" sx={{ opacity: 0.8 }}>{t?.online_orders || 0} orders</Typography>
                                        <Chip label={`${t?.online_pct || 0}%`} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Card variant="outlined">
                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                                        <CompareArrows color="primary" fontSize="small" />
                                        <Typography variant="subtitle2" fontWeight={600}>Combined Total</Typography>
                                    </Box>
                                    <Typography variant="h5" fontWeight="bold" color="primary">{fmt(t?.grand_total || 0)}</Typography>
                                    <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                                        {(t?.store_orders || 0) + (t?.online_orders || 0)} total orders
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Chart */}
                    <Card variant="outlined" sx={{ mb: 1.5 }}>
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1 } }}>
                            <Typography variant="subtitle1" fontWeight={600} mb={1}>📊 Daily Revenue Comparison</Typography>
                            <SimpleBarChart data={data.daily} />
                        </CardContent>
                    </Card>

                    {/* Daily Table */}
                    <Card variant="outlined">
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <Typography variant="subtitle1" fontWeight={600} mb={1}>📋 Daily Breakdown</Typography>
                            <TableContainer sx={{ maxHeight: 300 }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell><strong>Date</strong></TableCell>
                                            <TableCell align="right"><strong>Store Revenue</strong></TableCell>
                                            <TableCell align="right"><strong>Store Orders</strong></TableCell>
                                            <TableCell align="right"><strong>Online Revenue</strong></TableCell>
                                            <TableCell align="right"><strong>Online Orders</strong></TableCell>
                                            <TableCell align="right"><strong>Total</strong></TableCell>
                                            <TableCell align="right"><strong>Winner</strong></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.daily.map(d => {
                                            const total = d.store_revenue + d.online_revenue
                                            const winner = d.store_revenue > d.online_revenue ? 'store' :
                                                d.online_revenue > d.store_revenue ? 'online' : 'tie'
                                            return (
                                                <TableRow key={d.date} hover>
                                                    <TableCell>{new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</TableCell>
                                                    <TableCell align="right">{fmt(d.store_revenue)}</TableCell>
                                                    <TableCell align="right">{d.store_orders}</TableCell>
                                                    <TableCell align="right">{fmt(d.online_revenue)}</TableCell>
                                                    <TableCell align="right">{d.online_orders}</TableCell>
                                                    <TableCell align="right"><strong>{fmt(total)}</strong></TableCell>
                                                    <TableCell align="right">
                                                        {total === 0 ? <Chip size="small" label="—" /> :
                                                            winner === 'store' ?
                                                                <Chip size="small" icon={<Storefront />} label="Store" color="primary" variant="outlined" /> :
                                                                winner === 'online' ?
                                                                    <Chip size="small" icon={<ShoppingCart />} label="Online" color="secondary" variant="outlined" /> :
                                                                    <Chip size="small" label="Tie" />
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        {data.daily.length === 0 && (
                                            <TableRow><TableCell colSpan={7} align="center">
                                                <Typography py={4} color="text.secondary">No data for this period</Typography>
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
