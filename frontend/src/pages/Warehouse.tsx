import { useEffect, useState } from 'react'
import {
    Box,
    Chip,
    Grid,
    Paper,
    Stack,
    Typography,
    CircularProgress,
    Divider,
    TextField,
    InputAdornment,
    Autocomplete,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Card,
    CardContent,
    Tabs,
    Tab
} from '@mui/material'
import {
    Warehouse as WarehouseIcon,
    Inventory2,
    Search,
    Email,
    CalendarToday,
    Badge,
    History,
    ReceiptLong
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, Location } from '../services/mdm.service'
import { inventoryService, InventoryBalance, GoodsReceiptScanLog } from '../services/inventory.service'

export default function Warehouse() {
    const [warehouses, setWarehouses] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedWarehouse, setSelectedWarehouse] = useState<Location | null>(null)
    const [balances, setBalances] = useState<InventoryBalance[]>([])
    const [fetchingBalances, setFetchingBalances] = useState(false)
    const [scanLogs, setScanLogs] = useState<GoodsReceiptScanLog[]>([])
    const [fetchingLogs, setFetchingLogs] = useState(false)
    const [tabValue, setTabValue] = useState(0)

    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const locations = await mdmService.getLocations({ location_type: 'warehouse' })
                const list = (Array.isArray(locations) ? locations : (locations as any).results || [])
                    .sort((a: Location, b: Location) => a.name.localeCompare(b.name))
                setWarehouses(list)

                if (list.length === 1) {
                    setSelectedWarehouse(list[0])
                }
            } catch (error) {
                console.error('Error fetching warehouses:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchWarehouses()
    }, [])

    useEffect(() => {
        const fetchData = async () => {
            if (!selectedWarehouse) {
                setBalances([])
                setScanLogs([])
                return
            }

            setFetchingBalances(true)
            setFetchingLogs(true)

            try {
                const [balanceData, logData] = await Promise.all([
                    inventoryService.getBalances({ location: selectedWarehouse.id }),
                    inventoryService.getGoodsReceiptScans({ location: selectedWarehouse.id })
                ])

                setBalances(Array.isArray(balanceData) ? balanceData : (balanceData as any).results || [])
                setScanLogs(Array.isArray(logData) ? logData : (logData as any).results || [])
            } catch (error) {
                console.error('Error fetching warehouse data:', error)
                setBalances([])
                setScanLogs([])
            } finally {
                setFetchingBalances(false)
                setFetchingLogs(false)
            }
        }
        fetchData()
    }, [selectedWarehouse])

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue)
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
            </Box>
        )
    }

    return (
        <Box>
            <PageHeader
                title="Warehouse Management"
                subtitle="Monitor stock levels, track receiving history, and manage warehouse operations."
            />

            {/* Selection Bar */}
            <Paper
                elevation={0}
                sx={{
                    p: 3,
                    mb: 4,
                    borderRadius: 4,
                    border: '1px solid rgba(15, 23, 42, 0.08)',
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(12px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3
                }}
            >
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                        Active Storage Unit
                    </Typography>
                    <Autocomplete
                        options={warehouses}
                        getOptionLabel={(option) => `${option.name} (${option.code})`}
                        value={selectedWarehouse}
                        onChange={(_, newValue) => setSelectedWarehouse(newValue)}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="Search or select a warehouse..."
                                variant="outlined"
                                size="small"
                                InputProps={{
                                    ...params.InputProps,
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <WarehouseIcon color="primary" sx={{ fontSize: 20 }} />
                                        </InputAdornment>
                                    ),
                                    sx: { borderRadius: 3, bgcolor: 'white' }
                                }}
                            />
                        )}
                        sx={{ maxWidth: 500 }}
                    />
                </Box>
                {selectedWarehouse && (
                    <Stack direction="row" spacing={1}>
                        <Chip
                            icon={<Badge sx={{ fontSize: '1rem !important' }} />}
                            label={`ID: ${selectedWarehouse.code}`}
                            variant="outlined"
                            sx={{ borderRadius: 2, fontWeight: 600 }}
                        />
                        <Chip
                            icon={<Email sx={{ fontSize: '1rem !important' }} />}
                            label={selectedWarehouse.email || 'No Contact'}
                            variant="outlined"
                            sx={{ borderRadius: 2, fontWeight: 600 }}
                        />
                    </Stack>
                )}
            </Paper>

            {!selectedWarehouse ? (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        py: 12,
                        backgroundColor: 'rgba(248, 250, 252, 0.5)',
                        borderRadius: 6,
                        border: '2px dashed rgba(15, 23, 42, 0.05)'
                    }}
                >
                    <Box sx={{ mb: 3, p: 3, borderRadius: '50%', bgcolor: 'rgba(15, 109, 106, 0.05)' }}>
                        <WarehouseIcon sx={{ fontSize: 64, color: 'primary.main', opacity: 0.3 }} />
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#1e293b' }}>
                        Select a Warehouse
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Please choose a warehouse from the dropdown to view its details.
                    </Typography>
                </Box>
            ) : (
                <Grid container spacing={4}>
                    {/* Metrics Section */}
                    <Grid item xs={12}>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={4}>
                                <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(15,23,42,0.08)', bgcolor: '#0f6d6a', color: 'white' }}>
                                    <CardContent sx={{ p: 4 }}>
                                        <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 700, textTransform: 'uppercase' }}>
                                            Stocked Items (SKUs)
                                        </Typography>
                                        <Typography variant="h3" sx={{ fontWeight: 800, mt: 1 }}>
                                            {balances.length}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(15,23,42,0.08)', bgcolor: 'white' }}>
                                    <CardContent sx={{ p: 4 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                                            Total Unit Count
                                        </Typography>
                                        <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, color: '#0f6d6a' }}>
                                            {balances.reduce((acc, b) => acc + parseInt(b.quantity_available || '0'), 0)}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid rgba(15,23,42,0.08)', bgcolor: 'white' }}>
                                    <CardContent sx={{ p: 4 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                                            Zero Stock Alerts
                                        </Typography>
                                        <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, color: 'error.main' }}>
                                            {balances.filter(b => parseInt(b.quantity_available || '0') <= 0).length}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    </Grid>

                    {/* Tabs Section */}
                    <Grid item xs={12}>
                        <Paper
                            elevation={0}
                            sx={{
                                borderRadius: 5,
                                border: '1px solid rgba(15, 23, 42, 0.08)',
                                overflow: 'hidden',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.03)'
                            }}
                        >
                            <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#f8fafc', px: 2 }}>
                                <Tabs value={tabValue} onChange={handleTabChange} sx={{ minHeight: 64 }}>
                                    <Tab
                                        icon={<Inventory2 sx={{ fontSize: 20 }} />}
                                        iconPosition="start"
                                        label="Current Inventory"
                                        sx={{ minHeight: 64, fontWeight: 700 }}
                                    />
                                    <Tab
                                        icon={<History sx={{ fontSize: 20 }} />}
                                        iconPosition="start"
                                        label="Scan Audit Log"
                                        sx={{ minHeight: 64, fontWeight: 700 }}
                                    />
                                </Tabs>
                            </Box>

                            {tabValue === 0 && (
                                <Box>
                                    {fetchingBalances ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                                            <CircularProgress size={32} />
                                        </Box>
                                    ) : balances.length === 0 ? (
                                        <Box sx={{ textAlign: 'center', py: 10 }}>
                                            <Inventory2 sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                                            <Typography variant="body1" color="text.secondary" fontWeight={500}>
                                                No inventory records found for this warehouse.
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <TableContainer>
                                            <Table>
                                                <TableHead sx={{ bgcolor: 'rgba(248, 250, 252, 0.8)' }}>
                                                    <TableRow>
                                                        <TableCell sx={{ fontWeight: 800 }}>SKU Code</TableCell>
                                                        <TableCell sx={{ fontWeight: 800 }}>Product Name</TableCell>
                                                        <TableCell sx={{ fontWeight: 800 }}>Condition</TableCell>
                                                        <TableCell sx={{ fontWeight: 800 }} align="right">On Hand</TableCell>
                                                        <TableCell sx={{ fontWeight: 800 }} align="right">Available</TableCell>
                                                        <TableCell sx={{ fontWeight: 800 }} align="center">Status</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {balances.map((row) => (
                                                        <TableRow
                                                            key={row.id}
                                                            sx={{ '&:hover': { bgcolor: 'rgba(15, 109, 106, 0.02)' } }}
                                                        >
                                                            <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>
                                                                {row.sku_code || 'MMW-UNK'}
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 500 }}>
                                                                {row.sku_code ? row.sku_code.split('-').slice(0, 2).join(' ') : 'Unknown Item'}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Chip
                                                                    label={row.condition}
                                                                    size="small"
                                                                    sx={{
                                                                        textTransform: 'capitalize',
                                                                        fontWeight: 600,
                                                                        borderRadius: 1,
                                                                        bgcolor: 'action.hover'
                                                                    }}
                                                                />
                                                            </TableCell>
                                                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                                                                {row.quantity_on_hand}
                                                            </TableCell>
                                                            <TableCell align="right" sx={{ fontWeight: 800, color: parseInt(row.quantity_available) > 0 ? 'inherit' : 'error.main' }}>
                                                                {row.quantity_available}
                                                            </TableCell>
                                                            <TableCell align="center">
                                                                <Chip
                                                                    label={parseInt(row.quantity_available) > 0 ? 'In Stock' : 'Out of Stock'}
                                                                    color={parseInt(row.quantity_available) > 0 ? 'success' : 'error'}
                                                                    size="small"
                                                                    sx={{ borderRadius: 1.5, fontWeight: 700 }}
                                                                />
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )}
                                </Box>
                            )}

                            {tabValue === 1 && (
                                <Box>
                                    {fetchingLogs ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                                            <CircularProgress size={32} />
                                        </Box>
                                    ) : scanLogs.length === 0 ? (
                                        <Box sx={{ textAlign: 'center', py: 10 }}>
                                            <ReceiptLong sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                                            <Typography variant="body1" color="text.secondary" fontWeight={500}>
                                                No receiving logs found for this warehouse.
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <TableContainer>
                                            <Table>
                                                <TableHead sx={{ bgcolor: 'rgba(248, 250, 252, 0.8)' }}>
                                                    <TableRow>
                                                        <TableCell sx={{ fontWeight: 800 }}>Scanned At</TableCell>
                                                        <TableCell sx={{ fontWeight: 800 }}>Barcode</TableCell>
                                                        <TableCell sx={{ fontWeight: 800 }}>SKU</TableCell>
                                                        <TableCell sx={{ fontWeight: 800 }} align="right">Qty</TableCell>
                                                        <TableCell sx={{ fontWeight: 800 }} align="center">Result</TableCell>
                                                        <TableCell sx={{ fontWeight: 800 }}>Message</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {scanLogs.map((log) => (
                                                        <TableRow
                                                            key={log.id}
                                                            sx={{ '&:hover': { bgcolor: 'rgba(15, 109, 106, 0.02)' } }}
                                                        >
                                                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                                                                {new Date(log.scanned_at).toLocaleString()}
                                                            </TableCell>
                                                            <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                                                {log.barcode_value}
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>
                                                                {log.sku_code || '---'}
                                                            </TableCell>
                                                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                                                                {log.quantity}
                                                            </TableCell>
                                                            <TableCell align="center">
                                                                <Chip
                                                                    label={log.result}
                                                                    color={log.result === 'matched' ? 'success' : 'warning'}
                                                                    size="small"
                                                                    sx={{ borderRadius: 1.5, fontWeight: 700, textTransform: 'capitalize' }}
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                                                                {log.message}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )}
                                </Box>
                            )}
                        </Paper>
                    </Grid>
                </Grid>
            )}
        </Box>
    )
}
