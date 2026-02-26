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
    MenuItem,
    InputAdornment,
    Autocomplete,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Card,
    CardContent
} from '@mui/material'
import { Storefront, Inventory2, Search, Email, CalendarToday, Badge } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, Location } from '../services/mdm.service'
import { inventoryService, InventoryBalance } from '../services/inventory.service'

export default function Stores() {
    const [stores, setStores] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedStore, setSelectedStore] = useState<Location | null>(null)
    const [balances, setBalances] = useState<InventoryBalance[]>([])
    const [fetchingBalances, setFetchingBalances] = useState(false)

    useEffect(() => {
        const fetchStores = async () => {
            try {
                const locations = await mdmService.getLocations({ location_type: 'store' })
                const storeList = Array.isArray(locations) ? locations : (locations as any).results || []
                setStores(storeList)

                // If there's only one store, select it by default
                if (storeList.length === 1) {
                    setSelectedStore(storeList[0])
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
        const fetchStoreBalances = async () => {
            if (!selectedStore) {
                setBalances([])
                return
            }
            setFetchingBalances(true)
            try {
                const data = await inventoryService.getBalances({ location: selectedStore.id })
                const balanceList = Array.isArray(data) ? data : (data as any).results || []
                setBalances(balanceList)
            } catch (error) {
                console.error('Error fetching store balances:', error)
                setBalances([])
            } finally {
                setFetchingBalances(false)
            }
        }
        fetchStoreBalances()
    }, [selectedStore])

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
                title="Store Inventory Details"
                subtitle="Select a store to view its localized inventory, product variants, and stock levels."
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
                        Active Store Selection
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
                    <Stack direction="row" spacing={1}>
                        <Chip
                            icon={<Badge sx={{ fontSize: '1rem !important' }} />}
                            label={`Code: ${selectedStore.code}`}
                            variant="outlined"
                            sx={{ borderRadius: 2, fontWeight: 600 }}
                        />
                        <Chip
                            icon={<Email sx={{ fontSize: '1rem !important' }} />}
                            label={selectedStore.email || 'No Email'}
                            variant="outlined"
                            sx={{ borderRadius: 2, fontWeight: 600 }}
                        />
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
                        <Search sx={{ fontSize: 64, color: 'primary.main', opacity: 0.3 }} />
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#1e293b' }}>
                        No Store Selected
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Please use the filter above to select a retail location.
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
                                            Total Available Quantity
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
                                            Out of Stock
                                        </Typography>
                                        <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, color: 'error.main' }}>
                                            {balances.filter(b => parseInt(b.quantity_available || '0') <= 0).length}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    </Grid>

                    {/* Inventory Table Section */}
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
                            <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f8fafc' }}>
                                <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
                                    Current Product Stock
                                </Typography>
                                {selectedStore.opening_date && (
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                            Opened on: {new Date(selectedStore.opening_date).toLocaleDateString()}
                                        </Typography>
                                    </Stack>
                                )}
                            </Box>
                            <Divider />

                            {fetchingBalances ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                                    <CircularProgress size={32} />
                                </Box>
                            ) : balances.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 10 }}>
                                    <Inventory2 sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                                    <Typography variant="body1" color="text.secondary" fontWeight={500}>
                                        No inventory found at this location.
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
                                                        {row.sku_code || 'N/A'}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 500 }}>
                                                        {/* This would ideally come from a join, but we show what we have */}
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
                                                            label={parseInt(row.quantity_available) > 0 ? 'Active' : 'Stockout'}
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
                        </Paper>
                    </Grid>
                </Grid>
            )}
        </Box>
    )
}
