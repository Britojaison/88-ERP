import { useEffect, useState } from 'react'
import {
    Box,
    Card,
    CardContent,
    Chip,
    Grid,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Alert,
    CircularProgress,
    Tab,
    Tabs,
    Button
} from '@mui/material'
import {
    TrendingUp,
    TrendingDown,
    Warning,
    Error as ErrorIcon,
    History,
    FlashOn,
    Opacity,
    Inventory2
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import MetricCard from '../components/ui/MetricCard'
import { inventoryService } from '../services/inventory.service'

interface VelocityItem {
    sku_id: string
    sku_code: string
    sku_name: string
    current_stock: number
    sold_period: number
}

interface StockAlert {
    id: string
    sku_code: string
    sku_name: string
    location: string
    available_quantity: string
    min_stock_level: string
    is_best_seller: boolean
    updated_at: string
}

export default function InventoryHealth() {
    const [activeTab, setActiveTab] = useState(0)
    const [loading, setLoading] = useState(true)
    const [velocityData, setVelocityData] = useState<{
        fast_moving: VelocityItem[]
        slow_moving: VelocityItem[]
        dead_stock: VelocityItem[]
        summary: { fast_count: number; slow_count: number; dead_count: number }
    } | null>(null)
    const [alertData, setAlertData] = useState<{
        critical_best_sellers: StockAlert[]
        standard_alerts: StockAlert[]
        summary: { critical_count: number; standard_count: number }
    } | null>(null)

    const loadData = async () => {
        setLoading(true)
        try {
            const [vel, alerts] = await Promise.all([
                inventoryService.getStockVelocity(),
                inventoryService.getStockAlerts()
            ])
            setVelocityData(vel)
            setAlertData(alerts as any)
        } catch (error) {
            console.error('Failed to load inventory health data', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadData()
    }, [])

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        )
    }

    return (
        <Box>
            <PageHeader
                title="Inventory Health & Velocity"
                subtitle="Classification (Fast/Slow/Dead) and Best Seller Stock Alerts."
                actions={
                    <Button variant="contained" startIcon={<History />} onClick={() => void loadData()}>
                        Refresh Analysis
                    </Button>
                }
            />

            <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid item xs={12} md={3}>
                    <MetricCard
                        label="Critical Low Stock"
                        value={alertData?.summary.critical_count.toString() || '0'}
                        icon={<ErrorIcon />}
                        tone="error"
                        note="Best Sellers below minimum level."
                    />
                </Grid>
                <Grid item xs={12} md={3}>
                    <MetricCard
                        label="Fast Moving SKUs"
                        value={velocityData?.summary.fast_count.toString() || '0'}
                        icon={<FlashOn />}
                        tone="success"
                        note="High sales velocity last 30 days."
                    />
                </Grid>
                <Grid item xs={12} md={3}>
                    <MetricCard
                        label="Dead Stock Items"
                        value={velocityData?.summary.dead_count.toString() || '0'}
                        icon={<Opacity />}
                        tone="warning"
                        note="Zero sales recorded in the period."
                    />
                </Grid>
                <Grid item xs={12} md={3}>
                    <MetricCard
                        label="Standard Alerts"
                        value={alertData?.summary.standard_count.toString() || '0'}
                        icon={<Warning />}
                        tone="info"
                        note="Regular items below reorder point."
                    />
                </Grid>
            </Grid>

            <Paper sx={{ mb: 3 }}>
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="fullWidth">
                    <Tab label="Critical Alerts (Best Sellers)" icon={<ErrorIcon />} iconPosition="start" />
                    <Tab label="Stock Velocity" icon={<TrendingUp />} iconPosition="start" />
                    <Tab label="Dead Stock Analysis" icon={<Inventory2 />} iconPosition="start" />
                </Tabs>
            </Paper>

            {/* Tab 0: Critical Alerts */}
            {activeTab === 0 && (
                <Grid container spacing={2.5}>
                    <Grid item xs={12}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom color="error.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ErrorIcon /> Best Seller Critical Low Stock
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    These items are marked as "Best Sellers" and have fallen below their per-SKU minimum stock level.
                                </Typography>
                                {alertData?.critical_best_sellers.length === 0 ? (
                                    <Alert severity="success">No critical alerts for best sellers!</Alert>
                                ) : (
                                    <TableContainer>
                                        <Table>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>SKU Code</TableCell>
                                                    <TableCell>Name</TableCell>
                                                    <TableCell>Location</TableCell>
                                                    <TableCell align="right">Current Stock</TableCell>
                                                    <TableCell align="right">Min Level</TableCell>
                                                    <TableCell>Last Updated</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {alertData?.critical_best_sellers.map((alert) => (
                                                    <TableRow key={alert.id}>
                                                        <TableCell sx={{ fontWeight: 600 }}>{alert.sku_code}</TableCell>
                                                        <TableCell>{alert.sku_name}</TableCell>
                                                        <TableCell>{alert.location}</TableCell>
                                                        <TableCell align="right">
                                                            <Box sx={{ color: 'error.main', fontWeight: 700 }}>
                                                                {alert.available_quantity}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell align="right">{alert.min_stock_level}</TableCell>
                                                        <TableCell>{new Date(alert.updated_at).toLocaleString()}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom color="info.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Warning /> Standard Threshold Alerts
                                </Typography>
                                {alertData?.standard_alerts.length === 0 ? (
                                    <Alert severity="info">No regular stock alerts.</Alert>
                                ) : (
                                    <TableContainer>
                                        <Table>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>SKU Code</TableCell>
                                                    <TableCell>Name</TableCell>
                                                    <TableCell>Location</TableCell>
                                                    <TableCell align="right">Current Stock</TableCell>
                                                    <TableCell align="right">Min Level</TableCell>
                                                    <TableCell>Last Updated</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {alertData?.standard_alerts.map((alert) => (
                                                    <TableRow key={alert.id}>
                                                        <TableCell>{alert.sku_code}</TableCell>
                                                        <TableCell>{alert.sku_name}</TableCell>
                                                        <TableCell>{alert.location}</TableCell>
                                                        <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 600 }}>
                                                            {alert.available_quantity}
                                                        </TableCell>
                                                        <TableCell align="right">{alert.min_stock_level}</TableCell>
                                                        <TableCell>{new Date(alert.updated_at).toLocaleString()}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Tab 1: Velocity */}
            {activeTab === 1 && (
                <Grid container spacing={2.5}>
                    <Grid item xs={12} md={6}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <TrendingUp /> Fast Moving SKUs
                                </Typography>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>SKU</TableCell>
                                                <TableCell align="right">Sold (30d)</TableCell>
                                                <TableCell align="right">Stock</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {velocityData?.fast_moving.map((item) => (
                                                <TableRow key={item.sku_id}>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={600}>{item.sku_code}</Typography>
                                                        <Typography variant="caption" color="text.secondary">{item.sku_name}</Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Chip label={item.sold_period} size="small" color="success" />
                                                    </TableCell>
                                                    <TableCell align="right">{item.current_stock}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom color="info.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <TrendingDown /> Slow Moving SKUs
                                </Typography>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>SKU</TableCell>
                                                <TableCell align="right">Sold (30d)</TableCell>
                                                <TableCell align="right">Stock</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {velocityData?.slow_moving.map((item) => (
                                                <TableRow key={item.sku_id}>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={600}>{item.sku_code}</Typography>
                                                        <Typography variant="caption" color="text.secondary">{item.sku_name}</Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Chip label={item.sold_period} size="small" color="info" />
                                                    </TableCell>
                                                    <TableCell align="right">{item.current_stock}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Tab 2: Dead Stock */}
            {activeTab === 2 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom color="warning.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Inventory2 /> Dead Stock Analysis (Zero Sales in 30 Days)
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            These items are consuming warehouse space and capital without generating revenue. Consider clearance sales or returns.
                        </Typography>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>SKU Code</TableCell>
                                        <TableCell>Product Name</TableCell>
                                        <TableCell align="right">Available Stock</TableCell>
                                        <TableCell>Location</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {velocityData?.dead_stock.map((item) => (
                                        <TableRow key={item.sku_id}>
                                            <TableCell sx={{ fontWeight: 600 }}>{item.sku_code}</TableCell>
                                            <TableCell>{item.sku_name}</TableCell>
                                            <TableCell align="right">
                                                <Chip label={item.current_stock} size="small" variant="outlined" />
                                            </TableCell>
                                            <TableCell>Multiple</TableCell>
                                        </TableRow>
                                    ))}
                                    {velocityData?.dead_stock.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} align="center">No dead stock found!</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}
        </Box>
    )
}
