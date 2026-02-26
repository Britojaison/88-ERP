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
    Tab,
    Switch,
    FormControlLabel,
    Checkbox,
    Tooltip
} from '@mui/material'
import {
    Storefront,
    Inventory2,
    Search,
    Badge,
    History,
    ReceiptLong,
    GppGood,
    GppMaybe,
    Settings
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, Location } from '../services/mdm.service'
import { inventoryService, InventoryBalance, GoodsReceiptScanLog } from '../services/inventory.service'

export default function Stores() {
    const [stores, setStores] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedStore, setSelectedStore] = useState<Location | null>(null)
    const [balances, setBalances] = useState<InventoryBalance[]>([])
    const [fetchingBalances, setFetchingBalances] = useState(false)
    const [scanLogs, setScanLogs] = useState<GoodsReceiptScanLog[]>([])
    const [fetchingLogs, setFetchingLogs] = useState(false)
    const [tabValue, setTabValue] = useState(0)
    const [productSearch, setProductSearch] = useState('')
    const [updatingOffer, setUpdatingOffer] = useState(false)
    const [showOnlyOffers, setShowOnlyOffers] = useState(false)

    useEffect(() => {
        const fetchStores = async () => {
            try {
                const locations = await mdmService.getLocations({ location_type: 'store' })
                const list = (Array.isArray(locations) ? locations : (locations as any).results || [])
                    .sort((a: Location, b: Location) => a.name.localeCompare(b.name))
                setStores(list)

                if (list.length === 1) {
                    setSelectedStore(list[0])
                }
            } catch (error) {
                console.error('Error fetching stores:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchStores()
    }, [])

    useEffect(() => {
        const fetchData = async () => {
            if (!selectedStore) {
                setBalances([])
                setScanLogs([])
                return
            }

            setFetchingBalances(true)
            setFetchingLogs(true)

            try {
                const [balanceData, logData] = await Promise.all([
                    inventoryService.getBalances({ location: selectedStore.id }),
                    inventoryService.getGoodsReceiptScans({ location: selectedStore.id })
                ])

                const sortedBalances = (Array.isArray(balanceData) ? balanceData : (balanceData as any).results || [])
                    .sort((a: InventoryBalance, b: InventoryBalance) => (a.sku_code || '').localeCompare(b.sku_code || ''))

                setBalances(sortedBalances)
                setScanLogs(Array.isArray(logData) ? logData : (logData as any).results || [])
            } catch (error) {
                console.error('Error fetching store data:', error)
                setBalances([])
                setScanLogs([])
            } finally {
                setFetchingBalances(false)
                setFetchingLogs(false)
            }
        }
        fetchData()
    }, [selectedStore])

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue)
    }

    const handleUpdateOffer = async (newOffer: string) => {
        if (!selectedStore) return
        setUpdatingOffer(true)
        try {
            const updated = await mdmService.updateLocation(selectedStore.id, { offer_tag: newOffer } as any)
            setSelectedStore(updated)
            setStores(prev => prev.map(s => s.id === updated.id ? updated : s))
        } catch (error) {
            console.error('Error updating offer:', error)
        } finally {
            setUpdatingOffer(false)
        }
    }

    const handleUpdateOfferMode = async (newMode: 'all' | 'selected') => {
        if (!selectedStore) return
        setUpdatingOffer(true)
        try {
            const updated = await mdmService.updateLocation(selectedStore.id, { offer_mode: newMode } as any)
            setSelectedStore(updated)
            setStores(prev => prev.map(s => s.id === updated.id ? updated : s))
        } catch (error) {
            console.error('Error updating offer mode:', error)
        } finally {
            setUpdatingOffer(false)
        }
    }

    const handleToggleEligibility = async (balanceId: string, current: boolean) => {
        try {
            const updated = await inventoryService.updateBalance(balanceId, { is_offer_eligible: !current })
            setBalances(prev => prev.map(b => b.id === balanceId ? { ...b, is_offer_eligible: updated.is_offer_eligible } : b))
        } catch (error) {
            console.error('Error toggling eligibility:', error)
        }
    }

    const filteredBalances = balances.filter(b => {
        const matchesSearch = (b.sku_code || '').toLowerCase().includes(productSearch.toLowerCase()) ||
            (b.sku_name || '').toLowerCase().includes(productSearch.toLowerCase())
        if (showOnlyOffers) {
            return matchesSearch && b.is_offer_eligible
        }
        return matchesSearch
    })

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
                title="Store Operations"
                subtitle="View retail inventory, product availability, and monitor recent stock updates."
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
                        Active Retail Store
                    </Typography>
                    <Autocomplete
                        options={stores}
                        getOptionLabel={(option) => `${option.name} (${option.code})`}
                        value={selectedStore}
                        onChange={(_, newValue) => setSelectedStore(newValue)}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="Search or select a store..."
                                variant="outlined"
                                size="small"
                                InputProps={{
                                    ...params.InputProps,
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Storefront color="primary" sx={{ fontSize: 20 }} />
                                        </InputAdornment>
                                    ),
                                    sx: { borderRadius: 3, bgcolor: 'white' }
                                }}
                            />
                        )}
                        sx={{ maxWidth: 500 }}
                    />
                </Box>
                {selectedStore && (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                            icon={<Badge sx={{ fontSize: '1rem !important' }} />}
                            label={`Store: ${selectedStore.code}`}
                            variant="outlined"
                            sx={{ borderRadius: 2, fontWeight: 600 }}
                        />
                        <TextField
                            select
                            size="small"
                            label="Set Store Offer"
                            value={selectedStore.offer_tag || 'none'}
                            onChange={(e) => handleUpdateOffer(e.target.value)}
                            disabled={updatingOffer}
                            SelectProps={{ native: true }}
                            sx={{ width: 220, '& select': { py: 0.5, borderRadius: 2 } }}
                        >
                            <option value="none">No Active Offer</option>
                            <option value="b1g1">Buy 1 Get 1 (B1G1)</option>
                            <option value="b2g1">Buy 2 Get 1 (B2G1)</option>
                            <option value="b3g1">Buy 3 Get 1 (B3G1)</option>
                        </TextField>

                        <Divider orientation="vertical" flexItem sx={{ mx: 1, my: 1 }} />

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={selectedStore.offer_mode === 'selected'}
                                        onChange={(e) => handleUpdateOfferMode(e.target.checked ? 'selected' : 'all')}
                                        disabled={updatingOffer || selectedStore.offer_tag === 'none'}
                                    />
                                }
                                label={
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                        <Typography variant="body2" fontWeight={600}>
                                            {selectedStore.offer_mode === 'selected' ? 'Selected Products' : 'All Products'}
                                        </Typography>
                                        <Tooltip title={selectedStore.offer_mode === 'selected' ? "Only chosen items get the offer" : "Every item in the store gets the offer"}>
                                            <Settings sx={{ fontSize: 16, color: 'text.secondary' }} />
                                        </Tooltip>
                                    </Box>
                                }
                                sx={{ m: 0 }}
                            />
                        </Box>
                    </Stack>
                )}
            </Paper>

            {!selectedStore ? (
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
                        <Storefront sx={{ fontSize: 64, color: 'primary.main', opacity: 0.3 }} />
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#1e293b' }}>
                        No Store Selected
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Please use the selection menu above to view store inventory.
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
                                            Total SKUs
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
                                            Available Quantity
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
                                            Out of Stock Items
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
                            <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#f8fafc', px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Tabs value={tabValue} onChange={handleTabChange} sx={{ minHeight: 64 }}>
                                    <Tab
                                        icon={<Inventory2 sx={{ fontSize: 20 }} />}
                                        iconPosition="start"
                                        label="Live Inventory"
                                        sx={{ minHeight: 64, fontWeight: 700 }}
                                    />
                                    <Tab
                                        icon={<History sx={{ fontSize: 20 }} />}
                                        iconPosition="start"
                                        label="Scan Audit Log"
                                        sx={{ minHeight: 64, fontWeight: 700 }}
                                    />
                                </Tabs>
                                {tabValue === 0 && (
                                    <Box display="flex" alignItems="center" gap={2}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    size="small"
                                                    checked={showOnlyOffers}
                                                    onChange={(e) => setShowOnlyOffers(e.target.checked)}
                                                    color="primary"
                                                />
                                            }
                                            label={<Typography variant="body2" fontWeight={600}>Offer Items Only</Typography>}
                                            sx={{ m: 0 }}
                                        />
                                        <TextField
                                            size="small"
                                            placeholder="Search products..."
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <Search sx={{ fontSize: 20, color: 'text.secondary' }} />
                                                    </InputAdornment>
                                                ),
                                                sx: { borderRadius: 2, bgcolor: 'white', width: 300 }
                                            }}
                                        />
                                    </Box>
                                )}
                            </Box>

                            {tabValue === 0 && (
                                <Box>
                                    {fetchingBalances ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                                            <CircularProgress size={32} />
                                        </Box>
                                    ) : filteredBalances.length === 0 ? (
                                        <Box sx={{ textAlign: 'center', py: 10 }}>
                                            <Search sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                                            <Typography variant="body1" color="text.secondary" fontWeight={500}>
                                                No products matching "{productSearch}"
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
                                                        <TableCell sx={{ fontWeight: 800 }} align="center">Offer</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {filteredBalances.map((row) => (
                                                        <TableRow
                                                            key={row.id}
                                                            sx={{ '&:hover': { bgcolor: 'rgba(15, 109, 106, 0.02)' } }}
                                                        >
                                                            <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>
                                                                {row.sku_code || 'N/A'}
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 500 }}>
                                                                {row.sku_name || 'Unknown Item'}
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
                                                                    label={parseInt(row.quantity_available) > 0 ? 'Active' : 'Stockout'}
                                                                    color={parseInt(row.quantity_available) > 0 ? 'success' : 'error'}
                                                                    size="small"
                                                                    sx={{ borderRadius: 1.5, fontWeight: 700 }}
                                                                />
                                                            </TableCell>
                                                            <TableCell align="center">
                                                                <Tooltip title={selectedStore?.offer_mode === 'all' ? "Offer is currently applied to ALL products" : (row.is_offer_eligible ? "Eligible for Offer" : "Excluded from Offer")}>
                                                                    <span>
                                                                        <Checkbox
                                                                            size="small"
                                                                            checked={selectedStore?.offer_mode === 'all' || row.is_offer_eligible}
                                                                            onChange={() => handleToggleEligibility(row.id, row.is_offer_eligible)}
                                                                            disabled={selectedStore?.offer_mode === 'all' || selectedStore?.offer_tag === 'none'}
                                                                            icon={<GppMaybe sx={{ color: 'text.disabled', fontSize: 32 }} />}
                                                                            checkedIcon={<GppGood color="success" sx={{ fontSize: 32 }} />}
                                                                        />
                                                                    </span>
                                                                </Tooltip>
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
                                                No scan audit history found for this store.
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <TableContainer>
                                            <Table>
                                                <TableHead sx={{ bgcolor: 'rgba(248, 250, 252, 0.8)' }}>
                                                    <TableRow>
                                                        <TableCell sx={{ fontWeight: 800 }}>Date & Time</TableCell>
                                                        <TableCell sx={{ fontWeight: 800 }}>Barcode</TableCell>
                                                        <TableCell sx={{ fontWeight: 800 }}>SKU</TableCell>
                                                        <TableCell sx={{ fontWeight: 800 }} align="right">Quantity</TableCell>
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
