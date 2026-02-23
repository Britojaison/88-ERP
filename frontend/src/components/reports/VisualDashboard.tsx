import { useEffect, useState } from 'react'
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    CircularProgress,
    Alert,
    LinearProgress,
    Stack,
    useTheme,
    Chip
} from '@mui/material'
import { Language, Speed } from '@mui/icons-material'
import { inventoryService } from '../../services/inventory.service'
import { salesService } from '../../services/sales.service'

interface StockVelocity {
    fast_moving: any[]
    slow_moving: any[]
    dead_stock: any[]
}

interface ChannelSales {
    date: string
    store: number
    online: number
}

// Simple SVG Bar Chart
const BarChart = ({ data, theme }: { data: ChannelSales[], theme: any }) => {
    if (!data || data.length === 0) return <Typography>No data</Typography>

    const maxVal = Math.max(...data.map(d => Math.max(d.store, d.online)), 1)

    return (
        <Box sx={{ width: '100%', height: 260, display: 'flex', alignItems: 'flex-end', gap: 1, overflowX: 'auto', pt: 4 }}>
            {data.map((d, i) => (
                <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 30, flex: 1 }}>
                    <Box sx={{ display: 'flex', gap: 0.5, height: 200, alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
                        {/* Store Bar */}
                        <Box title={`Store: ₹${d.store.toFixed(2)}`} sx={{
                            width: '12px',
                            height: `${(d.store / maxVal) * 100}%`,
                            bgcolor: theme.palette.primary.main,
                            borderRadius: '4px 4px 0 0',
                            transition: '0.3s',
                            '&:hover': { opacity: 0.8 }
                        }} />
                        {/* Online Bar */}
                        <Box title={`Online: ₹${d.online.toFixed(2)}`} sx={{
                            width: '12px',
                            height: `${(d.online / maxVal) * 100}%`,
                            bgcolor: theme.palette.secondary.main,
                            borderRadius: '4px 4px 0 0',
                            transition: '0.3s',
                            '&:hover': { opacity: 0.8 }
                        }} />
                    </Box>
                    <Typography variant="caption" sx={{ mt: 1, fontSize: '0.65rem', color: 'text.secondary', transform: 'rotate(-45deg)', transformOrigin: 'top left' }}>
                        {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Typography>
                </Box>
            ))}
        </Box>
    )
}

export default function VisualDashboard() {
    const theme = useTheme()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [velocity, setVelocity] = useState<StockVelocity | null>(null)
    const [channelData, setChannelData] = useState<ChannelSales[]>([])

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        setError(null)
        try {
            const [vel, chan] = await Promise.all([
                inventoryService.getStockVelocity(),
                salesService.getChannelComparison()
            ])
            setVelocity(vel)
            setChannelData(chan)
        } catch (err: any) {
            setError(err.message || 'Failed to load visual reports')
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <Box p={4} textAlign="center"><CircularProgress /></Box>
    if (error) return <Alert severity="error">{error}</Alert>

    const storeTotal = channelData.reduce((acc, d) => acc + d.store, 0)
    const onlineTotal = channelData.reduce((acc, d) => acc + d.online, 0)
    const totalBoth = storeTotal + onlineTotal || 1

    return (
        <Box sx={{ mt: 2 }}>
            <Grid container spacing={3}>

                {/* Store vs Shopify Sales Chart */}
                <Grid item xs={12} lg={8}>
                    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="h6" display="flex" alignItems="center" gap={1}>
                                    <Language color="primary" /> Store vs Shopify Revenue (Last 30 Days)
                                </Typography>
                                <Box display="flex" gap={2}>
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                        <Box sx={{ width: 12, height: 12, bgcolor: theme.palette.primary.main, borderRadius: '50%' }} />
                                        <Typography variant="body2">Store (${storeTotal.toFixed(0)})</Typography>
                                    </Box>
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                        <Box sx={{ width: 12, height: 12, bgcolor: theme.palette.secondary.main, borderRadius: '50%' }} />
                                        <Typography variant="body2">Online (${onlineTotal.toFixed(0)})</Typography>
                                    </Box>
                                </Box>
                            </Box>

                            <Box sx={{ mt: 3, mb: 1 }}>
                                {/* Progress Bar showing split */}
                                <Box display="flex" width="100%" height={8} sx={{ borderRadius: 4, overflow: 'hidden' }}>
                                    <Box width={`${(storeTotal / totalBoth) * 100}%`} bgcolor="primary.main" />
                                    <Box width={`${(onlineTotal / totalBoth) * 100}%`} bgcolor="secondary.main" />
                                </Box>
                                <Box display="flex" justifyContent="space-between" mt={0.5}>
                                    <Typography variant="caption" color="text.secondary">{((storeTotal / totalBoth) * 100).toFixed(1)}%</Typography>
                                    <Typography variant="caption" color="text.secondary">{((onlineTotal / totalBoth) * 100).toFixed(1)}%</Typography>
                                </Box>
                            </Box>

                            <BarChart data={channelData} theme={theme} />
                        </CardContent>
                    </Card>
                </Grid>

                {/* Velocity Metrics */}
                <Grid item xs={12} lg={4}>
                    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%', bgcolor: 'background.default' }}>
                        <CardContent>
                            <Typography variant="h6" display="flex" alignItems="center" gap={1} mb={3}>
                                <Speed color="warning" /> Stock Velocity Analysis
                            </Typography>

                            <Box mb={4}>
                                <Typography variant="subtitle2" color="success.main" gutterBottom>
                                    🔥 Fast Moving Stock (Top 5)
                                </Typography>
                                <Stack spacing={2} mt={1}>
                                    {velocity?.fast_moving.slice(0, 5).map(item => (
                                        <Box key={item.sku_code}>
                                            <Box display="flex" justifyContent="space-between" mb={0.5}>
                                                <Typography variant="body2" fontWeight="bold">{item.sku_name}</Typography>
                                                <Typography variant="body2">{item.sold_30d} sold</Typography>
                                            </Box>
                                            <LinearProgress variant="determinate" value={Math.min((item.sold_30d / 50) * 100, 100)} color="success" sx={{ height: 6, borderRadius: 3 }} />
                                        </Box>
                                    ))}
                                    {velocity?.fast_moving.length === 0 && <Typography variant="body2" color="text.secondary">No fast moving stock.</Typography>}
                                </Stack>
                            </Box>

                            <Box mb={4}>
                                <Typography variant="subtitle2" color="warning.main" gutterBottom>
                                    🐢 Slow Moving Stock (Top 5)
                                </Typography>
                                <Stack spacing={2} mt={1}>
                                    {velocity?.slow_moving.slice(0, 5).map(item => (
                                        <Box key={item.sku_code}>
                                            <Box display="flex" justifyContent="space-between" mb={0.5}>
                                                <Typography variant="body2">{item.sku_name} ({item.current_stock} in stock)</Typography>
                                                <Typography variant="body2">{item.sold_30d} sold</Typography>
                                            </Box>
                                            <LinearProgress variant="determinate" value={Math.max((item.sold_30d / (item.current_stock || 1)) * 100, 2)} color="warning" sx={{ height: 6, borderRadius: 3 }} />
                                        </Box>
                                    ))}
                                    {velocity?.slow_moving.length === 0 && <Typography variant="body2" color="text.secondary">No slow moving stock.</Typography>}
                                </Stack>
                            </Box>

                            <Box>
                                <Typography variant="subtitle2" color="error.main" gutterBottom>
                                    ☠️ Dead Stock (Highest Value)
                                </Typography>
                                <Stack spacing={1} mt={1}>
                                    {velocity?.dead_stock.slice(0, 5).map(item => (
                                        <Box key={item.sku_code} display="flex" justifyContent="space-between" alignItems="center" p={1} bgcolor="error.light" sx={{ borderRadius: 1, opacity: 0.9 }}>
                                            <Typography variant="body2" color="error.contrastText">{item.sku_name}</Typography>
                                            <Chip label={`${item.current_stock} units`} size="small" color="error" />
                                        </Box>
                                    ))}
                                    {velocity?.dead_stock.length === 0 && <Typography variant="body2" color="text.secondary">No dead stock detected.</Typography>}
                                </Stack>
                            </Box>

                        </CardContent>
                    </Card>
                </Grid>

            </Grid>
        </Box>
    )
}
