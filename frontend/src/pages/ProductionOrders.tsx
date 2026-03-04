import { useEffect, useState, useCallback, useRef } from 'react'
import {
    Box, Typography, Paper, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Tooltip, LinearProgress, Select, MenuItem, FormControl, InputLabel,
    Snackbar, Alert, Card, CardContent, Divider, Tabs, Tab, Badge,
    Autocomplete, CircularProgress,
} from '@mui/material'
import {
    Add, CheckCircle, PlayArrow, Inventory as InventoryIcon, Close as CloseIcon,
    Cancel, Warning, ArrowBack,
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

interface SKUOption {
    id: string
    code: string
    name: string
    product_name: string
    size: string
    base_price: string
    warehouse_stock: number
}

// Debounced SKU search hook
function useSKUSearch() {
    const [options, setOptions] = useState<SKUOption[]>([])
    const [loading, setLoading] = useState(false)
    const [totalCount, setTotalCount] = useState(0)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const search = useCallback((query: string) => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(async () => {
            setLoading(true)
            try {
                const data = await mdmService.searchSKUsWithStock({
                    search: query,
                    page: 1,
                    page_size: 50,
                })
                setOptions(data.results)
                setTotalCount(data.count)
            } catch (e) {
                console.error('SKU search failed:', e)
            }
            setLoading(false)
        }, 300)
    }, [])

    // Load initial set
    const loadInitial = useCallback(async () => {
        setLoading(true)
        try {
            const data = await mdmService.searchSKUsWithStock({ page: 1, page_size: 50 })
            setOptions(data.results)
            setTotalCount(data.count)
        } catch (e) {
            console.error('SKU initial load failed:', e)
        }
        setLoading(false)
    }, [])

    return { options, loading, totalCount, search, loadInitial }
}

export default function ProductionOrders() {
    const [orders, setOrders] = useState<ProductionOrder[]>([])
    const [_skus, setSkus] = useState<SKU[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [tabFilter, setTabFilter] = useState('all')
    const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null)
    const [openCreateDialog, setOpenCreateDialog] = useState(false)
    const [openReceiveDialog, setOpenReceiveDialog] = useState(false)
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'info' })
    const [dashboard, setDashboard] = useState<any>(null)

    // SKU search state for each line
    const [lineSelectedSKUs, setLineSelectedSKUs] = useState<(SKUOption | null)[]>([null])

    // Create form state
    const [createForm, setCreateForm] = useState<{
        order_type: string
        destination: string
        order_date: string
        expected_delivery: string
        notes: string
        lines: { sku: string; planned_quantity: number }[]
    }>({
        order_type: 'new_production',
        destination: '',
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery: '',
        notes: '',
        lines: [{ sku: '', planned_quantity: 1 }],
    })

    // Receive form state
    const [receiveForm, setReceiveForm] = useState<{ sku_id: string; quantity: number; rejected: number }[]>([])

    const skuSearch = useSKUSearch()

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
            lines: [...prev.lines, { sku: '', planned_quantity: 1 }],
        }))
        setLineSelectedSKUs(prev => [...prev, null])
    }

    const removeLine = (index: number) => {
        setCreateForm(prev => ({
            ...prev,
            lines: prev.lines.filter((_, i) => i !== index),
        }))
        setLineSelectedSKUs(prev => prev.filter((_, i) => i !== index))
    }

    const warehouses = locations.filter(l => l.location_type === 'warehouse')

    // Detail view
    if (selectedOrder) {
        const pct = selectedOrder.fulfillment_pct
        const pctColor = pct >= 100 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'

        return (
            <Box>
                {/* Header bar */}
                <Paper
                    elevation={0}
                    sx={{
                        p: 2.5, mb: 3, borderRadius: 4,
                        border: '1px solid rgba(15,23,42,0.08)',
                        display: 'flex', alignItems: 'center', gap: 2,
                    }}
                >
                    <IconButton onClick={() => setSelectedOrder(null)} sx={{ bgcolor: 'action.hover' }}><ArrowBack /></IconButton>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>{selectedOrder.order_number}</Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                            <Chip label={STATUS_LABELS[selectedOrder.po_status]} color={STATUS_COLORS[selectedOrder.po_status]} size="small" sx={{ fontWeight: 700, borderRadius: 1.5 }} />
                            <Chip label={TYPE_LABELS[selectedOrder.order_type]} variant="outlined" size="small" sx={{ borderRadius: 1.5 }} />
                            {selectedOrder.is_overdue && <Chip label="OVERDUE" color="error" size="small" sx={{ fontWeight: 700, borderRadius: 1.5 }} />}
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {selectedOrder.po_status === 'draft' && (
                            <>
                                <Button variant="contained" color="info" size="small" startIcon={<CheckCircle />} onClick={() => void handleConfirm(selectedOrder.id)}>Confirm</Button>
                                <Button variant="outlined" color="error" size="small" startIcon={<Cancel />} onClick={() => void handleCancel(selectedOrder.id)}>Cancel</Button>
                            </>
                        )}
                        {selectedOrder.po_status === 'confirmed' && (
                            <Button variant="contained" color="primary" size="small" startIcon={<PlayArrow />} onClick={() => void handleStart(selectedOrder.id)}>Start Production</Button>
                        )}
                        {['in_production', 'partially_received', 'confirmed'].includes(selectedOrder.po_status) && (
                            <Button variant="contained" color="success" size="small" startIcon={<InventoryIcon />} onClick={() => openReceive(selectedOrder)}>Receive Goods</Button>
                        )}
                        {['partially_received', 'in_production'].includes(selectedOrder.po_status) && (
                            <Button variant="outlined" color="warning" size="small" startIcon={<Warning />} onClick={() => void handleShortClose(selectedOrder.id)}>Short Close</Button>
                        )}
                    </Box>
                </Paper>

                {/* Metrics row */}
                <Grid container spacing={2.5} sx={{ mb: 3 }}>
                    <Grid item xs={6} sm={3}>
                        <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid rgba(15,23,42,0.08)', bgcolor: '#f8fafc' }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Planned</Typography>
                            <Typography variant="h3" sx={{ fontWeight: 800, mt: 0.5, color: '#1e293b' }}>{selectedOrder.total_planned}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid rgba(15,23,42,0.08)', bgcolor: '#f0fdf4' }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Received</Typography>
                            <Typography variant="h3" sx={{ fontWeight: 800, mt: 0.5, color: '#16a34a' }}>{selectedOrder.total_received}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid rgba(15,23,42,0.08)', bgcolor: selectedOrder.total_rejected > 0 ? '#fef2f2' : '#f8fafc' }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: selectedOrder.total_rejected > 0 ? '#dc2626' : 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rejected</Typography>
                            <Typography variant="h3" sx={{ fontWeight: 800, mt: 0.5, color: selectedOrder.total_rejected > 0 ? '#dc2626' : '#94a3b8' }}>{selectedOrder.total_rejected}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: `2px solid ${pctColor}20`, bgcolor: `${pctColor}08` }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: pctColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fulfillment</Typography>
                            <Typography variant="h3" sx={{ fontWeight: 800, mt: 0.5, color: pctColor }}>{pct}%</Typography>
                            <LinearProgress
                                variant="determinate"
                                value={Math.min(pct, 100)}
                                sx={{ mt: 1.5, height: 4, borderRadius: 2, bgcolor: `${pctColor}15`, '& .MuiLinearProgress-bar': { bgcolor: pctColor, borderRadius: 2 } }}
                            />
                        </Paper>
                    </Grid>
                </Grid>

                {/* Order details */}
                <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 4, border: '1px solid rgba(15,23,42,0.08)' }}>
                    <Grid container spacing={3}>
                        {[
                            { label: 'Destination', value: selectedOrder.destination_name },
                            { label: 'Factory', value: selectedOrder.factory_name || '—' },
                            { label: 'Order Date', value: selectedOrder.order_date },
                            { label: 'Expected Delivery', value: selectedOrder.expected_delivery || '—' },
                        ].map((item) => (
                            <Grid item xs={6} sm={3} key={item.label}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 0.5 }}>{item.label}</Typography>
                                <Typography sx={{ fontWeight: 600, color: '#1e293b' }}>{item.value}</Typography>
                            </Grid>
                        ))}
                    </Grid>
                    {selectedOrder.notes && (
                        <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid rgba(15,23,42,0.06)' }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 0.5 }}>Notes</Typography>
                            <Typography variant="body2" sx={{ color: '#475569' }}>{selectedOrder.notes}</Typography>
                        </Box>
                    )}
                </Paper>

                {/* Order lines */}
                <Paper elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(15,23,42,0.08)', overflow: 'hidden' }}>
                    <Box sx={{ px: 3, py: 2, bgcolor: '#f8fafc', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                        <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#1e293b' }}>Order Lines</Typography>
                    </Box>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>SKU</TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>Product</TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: '#64748b' }} align="center">Planned</TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: '#64748b' }} align="center">Received</TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: '#64748b' }} align="center">Rejected</TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: '#64748b' }} align="center">Shortfall</TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>Progress</TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {selectedOrder.lines.map((line) => {
                                    const linePct = line.fulfillment_pct
                                    const lineColor = linePct >= 100 ? '#16a34a' : linePct >= 50 ? '#d97706' : '#dc2626'
                                    return (
                                        <TableRow key={line.id} sx={{ '&:hover': { bgcolor: 'rgba(15,109,106,0.02)' } }}>
                                            <TableCell>
                                                <Typography sx={{ fontWeight: 700, color: '#0f6d6a', fontSize: '0.875rem' }}>{line.sku_code}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ color: '#475569' }}>{line.product_name || line.sku_name}</Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Typography sx={{ fontWeight: 600 }}>{line.planned_quantity}</Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Typography sx={{ fontWeight: 700, color: '#16a34a' }}>{line.received_quantity}</Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Typography sx={{ fontWeight: 600, color: line.rejected_quantity > 0 ? '#dc2626' : '#94a3b8' }}>{line.rejected_quantity}</Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                {line.shortfall > 0 ? (
                                                    <Chip label={line.shortfall} size="small" sx={{ fontWeight: 700, bgcolor: '#fef3c7', color: '#92400e', borderRadius: 1.5 }} />
                                                ) : (
                                                    <Typography sx={{ color: '#94a3b8' }}>—</Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={Math.min(linePct, 100)}
                                                        sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: `${lineColor}15`, '& .MuiLinearProgress-bar': { bgcolor: lineColor, borderRadius: 2 } }}
                                                    />
                                                    <Typography variant="caption" sx={{ fontWeight: 700, color: lineColor, minWidth: 36 }}>{linePct}%</Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={line.line_status.replace(/_/g, ' ')}
                                                    size="small"
                                                    sx={{
                                                        fontWeight: 700,
                                                        textTransform: 'capitalize',
                                                        borderRadius: 1.5,
                                                        ...(line.line_status === 'completed' ? { bgcolor: '#dcfce7', color: '#166534' } :
                                                            line.line_status === 'partially_received' ? { bgcolor: '#fef3c7', color: '#92400e' } :
                                                                line.line_status === 'short_closed' ? { bgcolor: '#fce7f3', color: '#9d174d' } :
                                                                    { bgcolor: '#f1f5f9', color: '#475569' })
                                                    }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
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
                            lines: [{ sku: '', planned_quantity: 1 }],
                        })
                        setLineSelectedSKUs([null])
                        setOpenCreateDialog(true)
                        // Pre-load SKU options
                        void skuSearch.loadInitial()
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
                        <Grid item xs={12} sm={6} md={3}>
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
                        <Grid item xs={12} sm={6} md={3}>
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
                        <Grid item xs={6} sm={6} md={3}>
                            <TextField
                                fullWidth size="small" type="date" label="Order Date"
                                value={createForm.order_date}
                                onChange={(e) => setCreateForm(prev => ({ ...prev, order_date: e.target.value }))}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={6} sm={6} md={3}>
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
                        <Grid container spacing={2} key={idx} sx={{ mb: 1.5 }}>
                            <Grid item xs={12} sm={7}>
                                <Autocomplete
                                    size="small"
                                    options={skuSearch.options}
                                    loading={skuSearch.loading}
                                    value={lineSelectedSKUs[idx] || null}
                                    getOptionLabel={(option) => `${option.code} — ${option.product_name}${option.size ? ` (${option.size})` : ''}`}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                    filterOptions={(x) => x}
                                    onInputChange={(_e, value, reason) => {
                                        if (reason === 'input') {
                                            skuSearch.search(value)
                                        }
                                    }}
                                    onOpen={() => {
                                        if (skuSearch.options.length === 0) {
                                            void skuSearch.loadInitial()
                                        }
                                    }}
                                    onChange={(_e, newValue) => {
                                        setLineSelectedSKUs(prev => prev.map((s, i) => i === idx ? newValue : s))
                                        setCreateForm(prev => ({
                                            ...prev,
                                            lines: prev.lines.map((l, i) => i === idx ? { ...l, sku: newValue?.id || '' } : l),
                                        }))
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Search SKU or Product"
                                            placeholder="Type to search by SKU code, product name..."
                                            InputProps={{
                                                ...params.InputProps,
                                                endAdornment: (
                                                    <>
                                                        {skuSearch.loading ? <CircularProgress color="inherit" size={18} /> : null}
                                                        {params.InputProps.endAdornment}
                                                    </>
                                                ),
                                            }}
                                        />
                                    )}
                                    renderOption={(props, option) => (
                                        <li {...props} key={option.id}>
                                            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f6d6a', fontFamily: 'monospace' }}>
                                                        {option.code}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" noWrap>
                                                        {option.product_name}{option.size ? ` · ${option.size}` : ''}
                                                    </Typography>
                                                </Box>
                                                <Chip
                                                    label={`Stock: ${option.warehouse_stock}`}
                                                    size="small"
                                                    sx={{
                                                        ml: 1,
                                                        fontWeight: 700,
                                                        fontSize: '0.7rem',
                                                        flexShrink: 0,
                                                        ...(option.warehouse_stock <= 0
                                                            ? { bgcolor: '#fef2f2', color: '#dc2626' }
                                                            : option.warehouse_stock <= 10
                                                                ? { bgcolor: '#fef3c7', color: '#92400e' }
                                                                : { bgcolor: '#f0fdf4', color: '#16a34a' })
                                                    }}
                                                />
                                            </Box>
                                        </li>
                                    )}
                                    noOptionsText={
                                        skuSearch.loading ? 'Searching...' : 'No SKUs found. Try a different search.'
                                    }
                                    ListboxProps={{
                                        style: { maxHeight: 300 },
                                    }}
                                />
                                {lineSelectedSKUs[idx] && (
                                    <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: lineSelectedSKUs[idx]!.warehouse_stock <= 0 ? '#dc2626' : '#16a34a' }}>
                                        Warehouse stock: {lineSelectedSKUs[idx]!.warehouse_stock} units
                                    </Typography>
                                )}
                            </Grid>
                            <Grid item xs={8} sm={4}>
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
                            <Grid item xs={4} sm={1} sx={{ display: 'flex', alignItems: 'center' }}>
                                {createForm.lines.length > 1 && (
                                    <IconButton size="small" color="error" onClick={() => removeLine(idx)}>
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                )}
                            </Grid>
                        </Grid>
                    ))}

                    {skuSearch.totalCount > 50 && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            Showing top 50 of {skuSearch.totalCount} SKUs. Type to search for more.
                        </Typography>
                    )}
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
