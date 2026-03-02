import { useEffect, useState, useCallback } from 'react'
import {
    Box, Typography, Paper, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Tooltip, LinearProgress, Select, MenuItem, FormControl, InputLabel,
    Snackbar, Alert, Card, CardContent, Divider, Tabs, Tab, Badge,
} from '@mui/material'
import {
    Add, CheckCircle, PlayArrow, Inventory as InventoryIcon, Close as CloseIcon,
    Cancel, Warning, LocalShipping, Factory as FactoryIcon, ArrowBack,
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import {
    productionOrderService,
    type ProductionOrder,
    type CreateProductionOrderPayload,
} from '../services/inventory.service'
import { mdmService, type SKU, type Location } from '../services/mdm.service'

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info'> = {
    draft: 'default',
    confirmed: 'info',
    in_production: 'primary',
    partially_received: 'warning',
    completed: 'success',
    short_closed: 'secondary',
    cancelled: 'error',
}

const STATUS_LABELS: Record<string, string> = {
    draft: 'Draft',
    confirmed: 'Confirmed',
    in_production: 'In Production',
    partially_received: 'Partially Received',
    completed: 'Completed',
    short_closed: 'Short Closed',
    cancelled: 'Cancelled',
}

const TYPE_LABELS: Record<string, string> = {
    new_production: '🆕 New Production',
    restock: '🔄 Restock',
    urgent_restock: '🔴 Urgent Restock',
}

export default function ProductionOrders() {
    const [orders, setOrders] = useState<ProductionOrder[]>([])
    const [skus, setSkus] = useState<SKU[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [tabFilter, setTabFilter] = useState('all')
    const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null)
    const [openCreateDialog, setOpenCreateDialog] = useState(false)
    const [openReceiveDialog, setOpenReceiveDialog] = useState(false)
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'info' })
    const [dashboard, setDashboard] = useState<any>(null)

    // Create form state
    const [createForm, setCreateForm] = useState<{
        order_type: string
        destination: string
        order_date: string
        expected_delivery: string
        notes: string
        lines: { sku: string; planned_quantity: number; unit_cost: number }[]
    }>({
        order_type: 'new_production',
        destination: '',
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery: '',
        notes: '',
        lines: [{ sku: '', planned_quantity: 1, unit_cost: 0 }],
    })

    // Receive form state
    const [receiveForm, setReceiveForm] = useState<{ sku_id: string; quantity: number; rejected: number }[]>([])

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [orderData, skuData, locationData, dashData] = await Promise.all([
                productionOrderService.getOrders(),
                mdmService.getSKUs(),
                mdmService.getLocations(),
                productionOrderService.getDashboard(),
            ])
            const orderList = Array.isArray(orderData) ? orderData : orderData.results || []
            setOrders(orderList)
            setSkus(skuData)
            setLocations(locationData)
            setDashboard(dashData)
        } catch (error) {
            console.error('Failed to load production orders:', error)
        }
        setLoading(false)
    }, [])

    useEffect(() => { void loadData() }, [loadData])

    const filteredOrders = tabFilter === 'all' ? orders : orders.filter(o => o.po_status === tabFilter)

    const handleCreate = async () => {
        if (!createForm.destination) {
            setSnackbar({ open: true, message: 'Please select a destination warehouse.', severity: 'error' })
            return
        }
        const validLines = createForm.lines.filter(l => l.sku && l.planned_quantity > 0)
        if (validLines.length === 0) {
            setSnackbar({ open: true, message: 'Add at least one SKU with quantity.', severity: 'error' })
            return
        }

        try {
            const payload: CreateProductionOrderPayload = {
                order_type: createForm.order_type,
                destination: createForm.destination,
                order_date: createForm.order_date,
                expected_delivery: createForm.expected_delivery || null,
                notes: createForm.notes,
                lines: validLines,
            }
            const newOrder = await productionOrderService.createOrder(payload)
            setOpenCreateDialog(false)
            setSnackbar({ open: true, message: `Production Order ${newOrder.order_number} created!`, severity: 'success' })
            void loadData()
        } catch (error: any) {
            setSnackbar({ open: true, message: error?.response?.data?.detail || 'Failed to create order.', severity: 'error' })
        }
    }

    const handleConfirm = async (id: string) => {
        try {
            await productionOrderService.confirmOrder(id)
            setSnackbar({ open: true, message: 'Order confirmed!', severity: 'success' })
            void loadData()
            if (selectedOrder?.id === id) {
                setSelectedOrder(await productionOrderService.getOrder(id))
            }
        } catch (error: any) {
            setSnackbar({ open: true, message: error?.response?.data?.error || 'Failed to confirm.', severity: 'error' })
        }
    }

    const handleStart = async (id: string) => {
        try {
            await productionOrderService.startProduction(id)
            setSnackbar({ open: true, message: 'Production started!', severity: 'success' })
            void loadData()
            if (selectedOrder?.id === id) {
                setSelectedOrder(await productionOrderService.getOrder(id))
            }
        } catch (error: any) {
            setSnackbar({ open: true, message: error?.response?.data?.error || 'Failed to start.', severity: 'error' })
        }
    }

    const handleReceive = async () => {
        if (!selectedOrder) return
        const validReceipts = receiveForm.filter(r => r.quantity > 0 || r.rejected > 0)
        if (validReceipts.length === 0) {
            setSnackbar({ open: true, message: 'Enter at least one quantity.', severity: 'error' })
            return
        }
        try {
            const result = await productionOrderService.receiveGoods(selectedOrder.id, { receipts: validReceipts })
            setOpenReceiveDialog(false)
            setSnackbar({ open: true, message: `Received goods for ${result.order_number}. Status: ${STATUS_LABELS[result.po_status] || result.po_status}`, severity: 'success' })
            setSelectedOrder(await productionOrderService.getOrder(selectedOrder.id))
            void loadData()
        } catch (error: any) {
            setSnackbar({ open: true, message: error?.response?.data?.error || 'Failed to receive.', severity: 'error' })
        }
    }

    const handleShortClose = async (id: string) => {
        if (!window.confirm('Accept shortfall and close this order? This cannot be undone.')) return
        try {
            await productionOrderService.shortClose(id)
            setSnackbar({ open: true, message: 'Order short-closed.', severity: 'info' })
            void loadData()
            if (selectedOrder?.id === id) {
                setSelectedOrder(await productionOrderService.getOrder(id))
            }
        } catch (error: any) {
            setSnackbar({ open: true, message: error?.response?.data?.error || 'Failed.', severity: 'error' })
        }
    }

    const handleCancel = async (id: string) => {
        if (!window.confirm('Cancel this production order?')) return
        try {
            await productionOrderService.cancelOrder(id)
            setSnackbar({ open: true, message: 'Order cancelled.', severity: 'info' })
            void loadData()
            if (selectedOrder?.id === id) {
                setSelectedOrder(null)
            }
        } catch (error: any) {
            setSnackbar({ open: true, message: error?.response?.data?.error || 'Failed.', severity: 'error' })
        }
    }

    const openReceive = (order: ProductionOrder) => {
        setReceiveForm(
            order.lines.map(l => ({
                sku_id: l.sku,
                quantity: 0,
                rejected: 0,
            }))
        )
        setOpenReceiveDialog(true)
    }

    const addLine = () => {
        setCreateForm(prev => ({
            ...prev,
            lines: [...prev.lines, { sku: '', planned_quantity: 1, unit_cost: 0 }],
        }))
    }

    const removeLine = (index: number) => {
        setCreateForm(prev => ({
            ...prev,
            lines: prev.lines.filter((_, i) => i !== index),
        }))
    }

    const warehouses = locations.filter(l => l.location_type === 'warehouse')

    // Detail view
    if (selectedOrder) {
        return (
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <IconButton onClick={() => setSelectedOrder(null)}><ArrowBack /></IconButton>
                    <Box>
                        <Typography variant="h5" fontWeight={700}>{selectedOrder.order_number}</Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                            <Chip label={STATUS_LABELS[selectedOrder.po_status]} color={STATUS_COLORS[selectedOrder.po_status]} size="small" />
                            <Chip label={TYPE_LABELS[selectedOrder.order_type]} variant="outlined" size="small" />
                            {selectedOrder.is_overdue && <Chip label="⏰ OVERDUE" color="error" size="small" />}
                        </Box>
                    </Box>
                    <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                        {selectedOrder.po_status === 'draft' && (
                            <>
                                <Button variant="contained" color="info" startIcon={<CheckCircle />} onClick={() => void handleConfirm(selectedOrder.id)}>Confirm</Button>
                                <Button variant="outlined" color="error" startIcon={<Cancel />} onClick={() => void handleCancel(selectedOrder.id)}>Cancel</Button>
                            </>
                        )}
                        {selectedOrder.po_status === 'confirmed' && (
                            <Button variant="contained" color="primary" startIcon={<PlayArrow />} onClick={() => void handleStart(selectedOrder.id)}>Start Production</Button>
                        )}
                        {['in_production', 'partially_received', 'confirmed'].includes(selectedOrder.po_status) && (
                            <Button variant="contained" color="success" startIcon={<InventoryIcon />} onClick={() => openReceive(selectedOrder)}>Receive Goods</Button>
                        )}
                        {['partially_received', 'in_production'].includes(selectedOrder.po_status) && (
                            <Button variant="outlined" color="warning" startIcon={<Warning />} onClick={() => void handleShortClose(selectedOrder.id)}>Short Close</Button>
                        )}
                    </Box>
                </Box>

                {/* Summary cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6} sm={3}>
                        <Card><CardContent>
                            <Typography variant="overline" color="text.secondary">Planned</Typography>
                            <Typography variant="h4" fontWeight={700}>{selectedOrder.total_planned}</Typography>
                        </CardContent></Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Card><CardContent>
                            <Typography variant="overline" color="text.secondary">Received</Typography>
                            <Typography variant="h4" fontWeight={700} color="success.main">{selectedOrder.total_received}</Typography>
                        </CardContent></Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Card><CardContent>
                            <Typography variant="overline" color="text.secondary">Rejected</Typography>
                            <Typography variant="h4" fontWeight={700} color="error.main">{selectedOrder.total_rejected}</Typography>
                        </CardContent></Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Card><CardContent>
                            <Typography variant="overline" color="text.secondary">Fulfillment</Typography>
                            <Typography variant="h4" fontWeight={700} color={selectedOrder.fulfillment_pct >= 100 ? 'success.main' : selectedOrder.fulfillment_pct >= 50 ? 'warning.main' : 'error.main'}>
                                {selectedOrder.fulfillment_pct}%
                            </Typography>
                            <LinearProgress
                                variant="determinate"
                                value={Math.min(selectedOrder.fulfillment_pct, 100)}
                                color={selectedOrder.fulfillment_pct >= 100 ? 'success' : selectedOrder.fulfillment_pct >= 50 ? 'warning' : 'error'}
                                sx={{ mt: 1, height: 6, borderRadius: 3 }}
                            />
                        </CardContent></Card>
                    </Grid>
                </Grid>

                {/* Order info */}
                <Paper sx={{ p: 2, mb: 3 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={6} sm={3}>
                            <Typography variant="caption" color="text.secondary">Destination</Typography>
                            <Typography fontWeight={600}>{selectedOrder.destination_name}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <Typography variant="caption" color="text.secondary">Factory</Typography>
                            <Typography fontWeight={600}>{selectedOrder.factory_name || '—'}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <Typography variant="caption" color="text.secondary">Order Date</Typography>
                            <Typography fontWeight={600}>{selectedOrder.order_date}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <Typography variant="caption" color="text.secondary">Expected Delivery</Typography>
                            <Typography fontWeight={600}>{selectedOrder.expected_delivery || '—'}</Typography>
                        </Grid>
                    </Grid>
                    {selectedOrder.notes && (
                        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                            <Typography variant="caption" color="text.secondary">Notes</Typography>
                            <Typography>{selectedOrder.notes}</Typography>
                        </Box>
                    )}
                </Paper>

                {/* Lines table */}
                <Paper>
                    <Typography variant="h6" sx={{ p: 2, pb: 0 }}>Order Lines</Typography>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>SKU</TableCell>
                                    <TableCell>Product</TableCell>
                                    <TableCell align="center">Planned</TableCell>
                                    <TableCell align="center">Received</TableCell>
                                    <TableCell align="center">Rejected</TableCell>
                                    <TableCell align="center">Shortfall</TableCell>
                                    <TableCell>Fulfillment</TableCell>
                                    <TableCell>Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {selectedOrder.lines.map((line) => (
                                    <TableRow key={line.id}>
                                        <TableCell>
                                            <Typography fontWeight={600}>{line.sku_code}</Typography>
                                        </TableCell>
                                        <TableCell>{line.product_name || line.sku_name}</TableCell>
                                        <TableCell align="center">{line.planned_quantity}</TableCell>
                                        <TableCell align="center">
                                            <Typography color="success.main" fontWeight={600}>{line.received_quantity}</Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography color={line.rejected_quantity > 0 ? 'error.main' : 'text.secondary'}>{line.rejected_quantity}</Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography color={line.shortfall > 0 ? 'warning.main' : 'text.secondary'} fontWeight={line.shortfall > 0 ? 700 : 400}>
                                                {line.shortfall > 0 ? `⚠️ ${line.shortfall}` : '—'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={Math.min(line.fulfillment_pct, 100)}
                                                    color={line.fulfillment_pct >= 100 ? 'success' : line.fulfillment_pct >= 50 ? 'warning' : 'error'}
                                                    sx={{ flex: 1, height: 6, borderRadius: 3 }}
                                                />
                                                <Typography variant="caption" fontWeight={600}>{line.fulfillment_pct}%</Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={line.line_status.replace(/_/g, ' ')} size="small"
                                                color={line.line_status === 'completed' ? 'success' : line.line_status === 'short_closed' ? 'warning' : 'default'}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>

                {/* Receive Dialog */}
                <Dialog open={openReceiveDialog} onClose={() => setOpenReceiveDialog(false)} maxWidth="md" fullWidth>
                    <DialogTitle>Receive Goods — {selectedOrder.order_number}</DialogTitle>
                    <DialogContent>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>SKU</TableCell>
                                        <TableCell>Planned</TableCell>
                                        <TableCell>Already Received</TableCell>
                                        <TableCell>Receive Now</TableCell>
                                        <TableCell>Reject</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {selectedOrder.lines.map((line, idx) => (
                                        <TableRow key={line.id}>
                                            <TableCell>
                                                <Typography fontWeight={600}>{line.sku_code}</Typography>
                                                <Typography variant="caption" color="text.secondary">{line.sku_name}</Typography>
                                            </TableCell>
                                            <TableCell>{line.planned_quantity}</TableCell>
                                            <TableCell>{line.received_quantity}</TableCell>
                                            <TableCell>
                                                <TextField
                                                    type="number"
                                                    size="small"
                                                    sx={{ width: 100 }}
                                                    value={receiveForm[idx]?.quantity || 0}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 0
                                                        setReceiveForm(prev => prev.map((r, i) => i === idx ? { ...r, quantity: val } : r))
                                                    }}
                                                    inputProps={{ min: 0 }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    type="number"
                                                    size="small"
                                                    sx={{ width: 100 }}
                                                    value={receiveForm[idx]?.rejected || 0}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 0
                                                        setReceiveForm(prev => prev.map((r, i) => i === idx ? { ...r, rejected: val } : r))
                                                    }}
                                                    inputProps={{ min: 0 }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenReceiveDialog(false)}>Cancel</Button>
                        <Button variant="contained" color="success" onClick={() => void handleReceive()}>Confirm Receipt</Button>
                    </DialogActions>
                </Dialog>

                <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                    <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
                </Snackbar>
            </Box>
        )
    }

    // List view
    return (
        <Box>
            <PageHeader
                title="Production Orders"
                subtitle="Track production from order to receipt. Every action syncs with Product Journey."
                actions={
                    <Button variant="contained" startIcon={<Add />} onClick={() => {
                        setCreateForm({
                            order_type: 'new_production',
                            destination: warehouses.length > 0 ? warehouses[0].id : '',
                            order_date: new Date().toISOString().split('T')[0],
                            expected_delivery: '',
                            notes: '',
                            lines: [{ sku: '', planned_quantity: 1, unit_cost: 0 }],
                        })
                        setOpenCreateDialog(true)
                    }}>
                        New Production Order
                    </Button>
                }
            />

            {/* Dashboard cards */}
            {dashboard && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6} sm={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}>
                            <CardContent>
                                <Typography variant="overline" sx={{ opacity: 0.8 }}>Active Orders</Typography>
                                <Typography variant="h3" fontWeight={700}>{dashboard.active_orders}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: '#fff' }}>
                            <CardContent>
                                <Typography variant="overline" sx={{ opacity: 0.8 }}>Units In Production</Typography>
                                <Typography variant="h3" fontWeight={700}>{dashboard.units_in_production}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: '#fff' }}>
                            <CardContent>
                                <Typography variant="overline" sx={{ opacity: 0.8 }}>Awaiting Receipt</Typography>
                                <Typography variant="h3" fontWeight={700}>{dashboard.awaiting_receipt}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Card sx={{ background: dashboard.overdue > 0 ? 'linear-gradient(135deg, #ff5858 0%, #f09819 100%)' : 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: '#fff' }}>
                            <CardContent>
                                <Typography variant="overline" sx={{ opacity: 0.8 }}>Overdue</Typography>
                                <Typography variant="h3" fontWeight={700}>{dashboard.overdue}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Filter tabs */}
            <Paper sx={{ mb: 2 }}>
                <Tabs value={tabFilter} onChange={(_, v) => setTabFilter(v)} variant="scrollable" scrollButtons="auto">
                    <Tab label={`All (${orders.length})`} value="all" />
                    <Tab label={<Badge badgeContent={orders.filter(o => o.po_status === 'draft').length} color="default">Draft</Badge>} value="draft" />
                    <Tab label={<Badge badgeContent={orders.filter(o => o.po_status === 'confirmed').length} color="info">Confirmed</Badge>} value="confirmed" />
                    <Tab label={<Badge badgeContent={orders.filter(o => o.po_status === 'in_production').length} color="primary">In Production</Badge>} value="in_production" />
                    <Tab label={<Badge badgeContent={orders.filter(o => o.po_status === 'partially_received').length} color="warning">Partial</Badge>} value="partially_received" />
                    <Tab label={<Badge badgeContent={orders.filter(o => o.po_status === 'completed').length} color="success">Completed</Badge>} value="completed" />
                </Tabs>
            </Paper>

            {/* Orders table */}
            {loading ? (
                <LinearProgress />
            ) : (
                <Paper>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Order #</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Destination</TableCell>
                                    <TableCell>Order Date</TableCell>
                                    <TableCell>Expected</TableCell>
                                    <TableCell align="center">Planned</TableCell>
                                    <TableCell align="center">Received</TableCell>
                                    <TableCell>Fulfillment</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} align="center">
                                            <Typography variant="body2" color="text.secondary" sx={{ py: 6 }}>
                                                {orders.length === 0 ? 'No production orders yet. Create your first one!' : 'No orders match this filter.'}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredOrders.map((order) => (
                                        <TableRow key={order.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelectedOrder(order)}>
                                            <TableCell>
                                                <Typography fontWeight={700}>{order.order_number}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">{TYPE_LABELS[order.order_type]}</Typography>
                                            </TableCell>
                                            <TableCell>{order.destination_name}</TableCell>
                                            <TableCell>{order.order_date}</TableCell>
                                            <TableCell>
                                                {order.expected_delivery || '—'}
                                                {order.is_overdue && <Chip label="LATE" color="error" size="small" sx={{ ml: 1 }} />}
                                            </TableCell>
                                            <TableCell align="center">{order.total_planned}</TableCell>
                                            <TableCell align="center">{order.total_received}</TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={Math.min(order.fulfillment_pct, 100)}
                                                        color={order.fulfillment_pct >= 100 ? 'success' : order.fulfillment_pct >= 50 ? 'warning' : 'error'}
                                                        sx={{ flex: 1, height: 6, borderRadius: 3 }}
                                                    />
                                                    <Typography variant="caption" fontWeight={600}>{order.fulfillment_pct}%</Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Chip label={STATUS_LABELS[order.po_status]} color={STATUS_COLORS[order.po_status]} size="small" />
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                {order.po_status === 'draft' && (
                                                    <Tooltip title="Confirm">
                                                        <IconButton size="small" color="info" onClick={() => void handleConfirm(order.id)}>
                                                            <CheckCircle fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                {order.po_status === 'confirmed' && (
                                                    <Tooltip title="Start Production">
                                                        <IconButton size="small" color="primary" onClick={() => void handleStart(order.id)}>
                                                            <PlayArrow fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            {/* Create Dialog */}
            <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>Create Production Order</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0 }}>
                        <Grid item xs={12} sm={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Order Type</InputLabel>
                                <Select
                                    value={createForm.order_type}
                                    label="Order Type"
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, order_type: e.target.value }))}
                                >
                                    <MenuItem value="new_production">🆕 New Production</MenuItem>
                                    <MenuItem value="restock">🔄 Restock</MenuItem>
                                    <MenuItem value="urgent_restock">🔴 Urgent Restock</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <FormControl fullWidth size="small" required>
                                <InputLabel>Destination Warehouse</InputLabel>
                                <Select
                                    value={createForm.destination}
                                    label="Destination Warehouse"
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, destination: e.target.value }))}
                                >
                                    {warehouses.map(w => (
                                        <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6} sm={2}>
                            <TextField
                                fullWidth size="small" type="date" label="Order Date"
                                value={createForm.order_date}
                                onChange={(e) => setCreateForm(prev => ({ ...prev, order_date: e.target.value }))}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={6} sm={2}>
                            <TextField
                                fullWidth size="small" type="date" label="Expected Delivery"
                                value={createForm.expected_delivery}
                                onChange={(e) => setCreateForm(prev => ({ ...prev, expected_delivery: e.target.value }))}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth size="small" label="Notes" multiline rows={2}
                                value={createForm.notes}
                                onChange={(e) => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                            />
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 3 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>Order Lines (SKU × Quantity)</Typography>
                        <Button size="small" startIcon={<Add />} onClick={addLine}>Add Line</Button>
                    </Box>

                    {createForm.lines.map((line, idx) => (
                        <Grid container spacing={2} key={idx} sx={{ mb: 1 }}>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>SKU</InputLabel>
                                    <Select
                                        value={line.sku}
                                        label="SKU"
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setCreateForm(prev => ({
                                                ...prev,
                                                lines: prev.lines.map((l, i) => i === idx ? { ...l, sku: val } : l),
                                            }))
                                        }}
                                    >
                                        {skus.filter(s => !s.code?.startsWith('FAB-')).map(s => (
                                            <MenuItem key={s.id} value={s.id}>
                                                {s.code} — {s.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={5} sm={2}>
                                <TextField
                                    fullWidth size="small" type="number" label="Quantity"
                                    value={line.planned_quantity}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 1
                                        setCreateForm(prev => ({
                                            ...prev,
                                            lines: prev.lines.map((l, i) => i === idx ? { ...l, planned_quantity: val } : l),
                                        }))
                                    }}
                                    inputProps={{ min: 1 }}
                                />
                            </Grid>
                            <Grid item xs={5} sm={3}>
                                <TextField
                                    fullWidth size="small" type="number" label="Unit Cost (₹)"
                                    value={line.unit_cost}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0
                                        setCreateForm(prev => ({
                                            ...prev,
                                            lines: prev.lines.map((l, i) => i === idx ? { ...l, unit_cost: val } : l),
                                        }))
                                    }}
                                    inputProps={{ min: 0, step: 0.01 }}
                                />
                            </Grid>
                            <Grid item xs={2} sm={1} sx={{ display: 'flex', alignItems: 'center' }}>
                                {createForm.lines.length > 1 && (
                                    <IconButton size="small" color="error" onClick={() => removeLine(idx)}>
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                )}
                            </Grid>
                        </Grid>
                    ))}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={() => void handleCreate()}>Create Order</Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
            </Snackbar>
        </Box>
    )
}
