import { useState, useEffect } from 'react'
import { qty } from '../utils'
import {
    Box, Typography, Card, CardContent, Grid, TextField, Button,
    MenuItem, Alert, CircularProgress, Autocomplete, IconButton,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Divider
} from '@mui/material'
import PageHeader from '../components/ui/PageHeader'
import { SwapHoriz, Delete, AddShoppingCart } from '@mui/icons-material'
import { mdmService, Location } from '../services/mdm.service'
import { inventoryService, InventoryBalance } from '../services/inventory.service'

interface TransferItem {
    sku_id: string
    sku_code: string
    product_name: string
    sku_name: string
    available: number
    quantity: string
}

export default function StockTransfer() {
    const [locations, setLocations] = useState<Location[]>([])
    const [fromLocation, setFromLocation] = useState('')
    const [toLocation, setToLocation] = useState('')
    const [balances, setBalances] = useState<InventoryBalance[]>([])
    const [selectedItems, setSelectedItems] = useState<TransferItem[]>([])
    const [searchValue, setSearchValue] = useState<InventoryBalance | null>(null)
    const [notes, setNotes] = useState('')

    const [loading, setLoading] = useState(false)
    const [fetchingBalances, setFetchingBalances] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    useEffect(() => {
        fetchLocations()
    }, [])

    useEffect(() => {
        if (fromLocation) {
            fetchBalances(fromLocation)
            // Empty the cart when location changes to prevent invalid transfers
            setSelectedItems([])
        } else {
            setBalances([])
            setSelectedItems([])
        }
    }, [fromLocation])

    const fetchLocations = async () => {
        try {
            const res = await mdmService.getLocations({ status: 'active', limit: 100 })
            const data: any = res
            setLocations(data.results || data)
        } catch (err) {
            console.error('Failed to load locations', err)
        }
    }

    const fetchBalances = async (locationId: string) => {
        setFetchingBalances(true)
        try {
            const res = await inventoryService.getBalances({ location: locationId, limit: 1000 })
            const data: any = res
            const availableOnly = (data.results || data).filter((b: any) => parseFloat(b.quantity_available) > 0)
            setBalances(availableOnly)
        } catch (err) {
            console.error('Failed to load balances', err)
        } finally {
            setFetchingBalances(false)
        }
    }

    const addItemToTransfer = (balance: InventoryBalance) => {
        if (!balance) return

        // Check if already in list
        const exists = selectedItems.find(item => item.sku_id === balance.sku)
        if (exists) {
            setSearchValue(null)
            return
        }

        const newItem: TransferItem = {
            sku_id: balance.sku,
            sku_code: balance.sku_code || '',
            product_name: balance.product_name || '',
            sku_name: balance.sku_name || '',
            available: parseFloat(balance.quantity_available),
            quantity: '1' // Default quantity
        }

        setSelectedItems(prev => [...prev, newItem])
        setSearchValue(null)
    }

    const removeItem = (id: string) => {
        setSelectedItems(prev => prev.filter(i => i.sku_id !== id))
    }

    const handleQtyChange = (id: string, val: string) => {
        setSelectedItems(prev => prev.map(item => {
            if (item.sku_id === id) {
                return { ...item, quantity: val }
            }
            return item
        }))
    }

    const handleBatchTransfer = async () => {
        setError(null)
        setSuccess(null)

        if (!fromLocation || !toLocation || selectedItems.length === 0) {
            setError("Please select locations and at least one item.")
            return
        }

        if (fromLocation === toLocation) {
            setError("Source and Destination locations must be different.")
            return
        }

        // Validate all quantities
        for (const item of selectedItems) {
            const transferQty = parseFloat(item.quantity)
            if (isNaN(transferQty) || transferQty <= 0) {
                setError(`Invalid quantity for ${item.sku_code}.`)
                return
            }
            if (transferQty > item.available) {
                setError(`Cannot transfer more than available stock for ${item.sku_code}.`)
                return
            }
        }

        setLoading(true)
        try {
            await inventoryService.bulkTransfer({
                from_location: fromLocation,
                to_location: toLocation,
                notes: notes,
                items: selectedItems.map(i => ({
                    sku: i.sku_id,
                    quantity: i.quantity
                }))
            })

            setSuccess(`Successfully transferred ${selectedItems.length} items to ${locations.find(l => l.id === toLocation)?.name}.`)
            setSelectedItems([])
            setNotes('')
            fetchBalances(fromLocation)
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Failed to complete batch transfer")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Box sx={{ pb: 8 }}>
            <PageHeader
                title="Stock Bulk Allocation"
                subtitle="Transfer multiple products instantly between the Central Warehouse and Offline Stores."
            />

            <Grid container spacing={3} sx={{ mt: 1 }}>
                {/* Left Side: Setup and Search */}
                <Grid item xs={12} lg={4}>
                    <Card sx={{ boxShadow: 2, height: '100%' }}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom color="primary">Configuration</Typography>
                            <Box sx={{ mt: 3 }}>
                                <Typography variant="subtitle2" gutterBottom color="textSecondary">Source (From)</Typography>
                                <TextField
                                    select fullWidth variant="outlined" size="small"
                                    value={fromLocation}
                                    onChange={(e) => setFromLocation(e.target.value)}
                                    disabled={selectedItems.length > 0}
                                    helperText={selectedItems.length > 0 ? "Empty the list to change source." : ""}
                                >
                                    <MenuItem value="" disabled>Select Source Location</MenuItem>
                                    {locations.map(loc => (
                                        <MenuItem key={loc.id} value={loc.id}>{loc.name} ({loc.code})</MenuItem>
                                    ))}
                                </TextField>
                            </Box>

                            <Box sx={{ mt: 3 }}>
                                <Typography variant="subtitle2" gutterBottom color="textSecondary">Destination (To)</Typography>
                                <TextField
                                    select fullWidth variant="outlined" size="small"
                                    value={toLocation}
                                    onChange={(e) => setToLocation(e.target.value)}
                                    disabled={selectedItems.length > 0}
                                    helperText={selectedItems.length > 0 ? "Empty the list to change routing." : ""}
                                >
                                    <MenuItem value="" disabled>Select Destination Location</MenuItem>
                                    {locations.map(loc => (
                                        <MenuItem key={loc.id} value={loc.id} disabled={loc.id === fromLocation}>
                                            {loc.name} ({loc.code})
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Box>

                            <Divider sx={{ my: 4 }} />

                            <Typography variant="h6" gutterBottom color="primary">Add Products</Typography>
                            <Box sx={{ mt: 2 }}>
                                <Autocomplete
                                    options={balances}
                                    getOptionLabel={(option) => {
                                        const name = option.product_name || option.sku_name;
                                        return `${name} | ${option.sku_code} (Stock: ${qty(option.quantity_available)})`;
                                    }}
                                    value={searchValue}
                                    key={selectedItems.length} // Force reset of internal search state
                                    onChange={(_, newValue) => {
                                        if (newValue) {
                                            addItemToTransfer(newValue);
                                            setSearchValue(null);
                                        }
                                    }}
                                    disabled={!fromLocation || fetchingBalances}
                                    loading={fetchingBalances}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            fullWidth variant="outlined" size="small"
                                            placeholder={fromLocation ? "Search SKU to add..." : "Select source first"}
                                        />
                                    )}
                                />
                                {fetchingBalances && <CircularProgress size={20} sx={{ mt: 1 }} />}
                            </Box>

                            <Box sx={{ mt: 4 }}>
                                <TextField
                                    fullWidth multiline rows={3} label="Batch Notes (Optional)"
                                    placeholder="e.g. Weekly replenishment cycle"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Right Side: Items List */}
                <Grid item xs={12} lg={8}>
                    <Card sx={{ boxShadow: 2, minHeight: 400 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" color="primary">Items in Transfer List ({selectedItems.length})</Typography>
                                {selectedItems.length > 0 && (
                                    <Button color="error" size="small" onClick={() => setSelectedItems([])}>Clear All</Button>
                                )}
                            </Box>

                            {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
                            {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

                            {selectedItems.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 10, opacity: 0.5 }}>
                                    <AddShoppingCart sx={{ fontSize: 60, mb: 2 }} />
                                    <Typography>No items added to the list.</Typography>
                                    <Typography variant="body2">Search and select products on the left to add them here.</Typography>
                                </Box>
                            ) : (
                                <TableContainer component={Paper} variant="outlined">
                                    <Table size="small">
                                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                                            <TableRow>
                                                <TableCell>Product / SKU</TableCell>
                                                <TableCell align="right">Source Stock</TableCell>
                                                <TableCell align="right" sx={{ width: 120 }}>Transfer Qty</TableCell>
                                                <TableCell align="center" sx={{ width: 60 }}>Action</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {selectedItems.map((item) => (
                                                <TableRow key={item.sku_id}>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={600}>{item.sku_code}</Typography>
                                                        <Typography variant="caption">{item.product_name} {item.sku_name}</Typography>
                                                    </TableCell>
                                                    <TableCell align="right">{qty(item.available)}</TableCell>
                                                    <TableCell align="right">
                                                        <TextField
                                                            type="number" size="small" variant="standard"
                                                            value={item.quantity}
                                                            onChange={(e) => handleQtyChange(item.sku_id, e.target.value)}
                                                            InputProps={{ disableUnderline: true, sx: { fontSize: '0.875rem', fontWeight: 600, textAlign: 'right' } }}
                                                            inputProps={{ min: 1, max: item.available, style: { textAlign: 'right' } }}
                                                            sx={{ bgcolor: 'action.hover', px: 1, borderRadius: 1 }}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <IconButton size="small" color="error" onClick={() => removeItem(item.sku_id)}>
                                                            <Delete fontSize="small" />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}

                            {selectedItems.length > 0 && (
                                <Box sx={{ mt: 4 }}>
                                    <Button
                                        variant="contained" size="large" fullWidth
                                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SwapHoriz />}
                                        onClick={handleBatchTransfer}
                                        disabled={loading || !fromLocation || !toLocation}
                                    >
                                        {loading ? 'Processing Transfer...' : `Confirm Transfer of ${selectedItems.length} Items`}
                                    </Button>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    )
}

