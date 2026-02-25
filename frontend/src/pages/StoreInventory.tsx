import { useState, useEffect } from 'react'
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    CircularProgress,
    Divider,
} from '@mui/material'
import { Storefront, Inventory, Label } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, type Store } from '../services/mdm.service'
import { inventoryService, type InventoryBalance } from '../services/inventory.service'

export default function StoreInventory() {
    const [stores, setStores] = useState<Store[]>([])
    const [balances, setBalances] = useState<InventoryBalance[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            try {
                const [storesData, balancesData] = await Promise.all([
                    mdmService.getStores(),
                    inventoryService.getBalances({ limit: 2000 })
                ])
                setStores(storesData)
                if (Array.isArray(balancesData)) {
                    setBalances(balancesData)
                } else {
                    setBalances((balancesData as any).results || [])
                }
            } catch (err) {
                console.error('Failed to load store inventory:', err)
            } finally {
                setLoading(false)
            }
        }
        void loadData()
    }, [])

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                <CircularProgress />
            </Box>
        )
    }

    return (
        <Box>
            <PageHeader
                title="Store Inventory Management"
                subtitle="Comprehensive view of all stores and their individual product stock levels."
            />

            <Grid container spacing={3}>
                {stores.map((store) => {
                    const storeProducts = balances.filter(
                        (b) => b.location === store.location && parseFloat(b.quantity_available) > 0
                    )

                    return (
                        <Grid item xs={12} key={store.id}>
                            <Card elevation={2}>
                                <CardContent>
                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                        <Box display="flex" alignItems="center" gap={1.5}>
                                            <Storefront color="primary" fontSize="large" />
                                            <Box>
                                                <Typography variant="h5" fontWeight="bold">
                                                    {store.name}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Code: {store.code} | Location: {store.location_name || 'N/A'}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Chip
                                            label={`${storeProducts.length} Products in Stock`}
                                            color="primary"
                                            variant="outlined"
                                        />
                                    </Box>

                                    <Divider sx={{ mb: 2 }} />

                                    {storeProducts.length === 0 ? (
                                        <Box py={4} textAlign="center" bgcolor="action.hover" borderRadius={1}>
                                            <Inventory sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                                            <Typography color="text.secondary">
                                                No inventory currently available in this store.
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <TableContainer component={Paper} variant="outlined">
                                            <Table size="small">
                                                <TableHead sx={{ bgcolor: 'action.hover' }}>
                                                    <TableRow>
                                                        <TableCell sx={{ fontWeight: 'bold' }}>SKU Code</TableCell>
                                                        <TableCell sx={{ fontWeight: 'bold' }}>Product Name</TableCell>
                                                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Condition</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Quantity Available</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Quantity Reserved</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total On Hand</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {storeProducts.map((bal) => (
                                                        <TableRow key={bal.id} hover>
                                                            <TableCell>
                                                                <Box display="flex" alignItems="center" gap={1}>
                                                                    <Label fontSize="small" color="action" />
                                                                    <Typography variant="body2" fontWeight={500}>
                                                                        {bal.sku_code}
                                                                    </Typography>
                                                                </Box>
                                                            </TableCell>
                                                            <TableCell>SKU Item</TableCell> {/* Ideally fetch SKU name if not in balance */}
                                                            <TableCell align="center">
                                                                <Chip
                                                                    label={bal.condition.toUpperCase()}
                                                                    size="small"
                                                                    color={bal.condition === 'new' ? 'success' : 'warning'}
                                                                    variant="outlined"
                                                                    sx={{ fontSize: '0.65rem', height: 20 }}
                                                                />
                                                            </TableCell>
                                                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                                                {parseFloat(bal.quantity_available).toFixed(0)}
                                                            </TableCell>
                                                            <TableCell align="right">
                                                                {parseFloat(bal.quantity_reserved).toFixed(0)}
                                                            </TableCell>
                                                            <TableCell align="right">
                                                                {parseFloat(bal.quantity_on_hand).toFixed(0)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>
                    )
                })}

                {stores.length === 0 && (
                    <Grid item xs={12}>
                        <Box py={8} textAlign="center">
                            <Typography variant="h6" color="text.secondary">
                                No stores found. Set up stores in Master Data first.
                            </Typography>
                        </Box>
                    </Grid>
                )}
            </Grid>
        </Box>
    )
}
