import { useState, useEffect } from 'react'
import {
    Box, Typography, Card, CardContent, Grid, TextField, Button,
    MenuItem, Alert, CircularProgress, Autocomplete
} from '@mui/material'
import PageHeader from '../components/ui/PageHeader'
import { SwapHoriz } from '@mui/icons-material'
import { mdmService, Location } from '../services/mdm.service'
import { inventoryService, InventoryBalance } from '../services/inventory.service'

export default function StockTransfer() {
    const [locations, setLocations] = useState<Location[]>([])
    const [fromLocation, setFromLocation] = useState('')
    const [toLocation, setToLocation] = useState('')
    const [balances, setBalances] = useState<InventoryBalance[]>([])
    const [selectedBalance, setSelectedBalance] = useState<InventoryBalance | null>(null)
    const [quantity, setQuantity] = useState('')
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
            // reset selected
            setSelectedBalance(null)
            setQuantity('')
        } else {
            setBalances([])
            setSelectedBalance(null)
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
            const res = await inventoryService.getBalances({ location: locationId, limit: 500 })
            const data: any = res
            // Filter out zero availability
            const availableOnly = (data.results || data).filter((b: any) => parseFloat(b.quantity_available) > 0)
            setBalances(availableOnly)
        } catch (err) {
            console.error('Failed to load balances', err)
        } finally {
            setFetchingBalances(false)
        }
    }

    const handleTransfer = async () => {
        setError(null)
        setSuccess(null)

        if (!fromLocation || !toLocation || !selectedBalance || !quantity) {
            setError("Please fill all required fields.")
            return
        }

        if (fromLocation === toLocation) {
            setError("Source and Destination locations must be different.")
            return
        }

        const transferQty = parseFloat(quantity)
        const availableQty = parseFloat(selectedBalance.quantity_available)

        if (transferQty <= 0 || isNaN(transferQty)) {
            setError("Quantity must be greater than zero.")
            return
        }

        if (transferQty > availableQty) {
            setError(`Cannot transfer more than available stock (${availableQty}).`)
            return
        }

        setLoading(true)
        try {
            await inventoryService.createMovement({
                movement_type: 'transfer',
                movement_date: new Date().toISOString(),
                sku: selectedBalance.sku,
                from_location: fromLocation,
                to_location: toLocation,
                quantity: transferQty.toString(),
                unit_cost: '0',
                notes: notes || `Transfer from ${selectedBalance.location_code} to location ${toLocation}`,
            })
            setSuccess(`Successfully transferred ${transferQty} units of ${selectedBalance.sku_code}.`)
            // Refresh balances
            fetchBalances(fromLocation)
            setQuantity('')
            setNotes('')
            setSelectedBalance(null)
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Failed to complete transfer")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Box>
            <PageHeader
                title="Stock Transfer Allocation"
                subtitle="Move inventory securely between the Central Warehouse and Offline Stores."
            />

            <Card sx={{ maxWidth: 800, mx: 'auto', mt: 3, boxShadow: 3 }}>
                <CardContent sx={{ p: 4 }}>
                    {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
                    {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

                    <Grid container spacing={4} alignItems="center">
                        {/* Source Location */}
                        <Grid item xs={12} md={5}>
                            <Typography variant="subtitle2" gutterBottom color="textSecondary">
                                Transfer From (Source)
                            </Typography>
                            <TextField
                                select
                                fullWidth
                                variant="outlined"
                                value={fromLocation}
                                onChange={(e) => setFromLocation(e.target.value)}
                            >
                                <MenuItem value="" disabled>Select Source Location</MenuItem>
                                {locations.map(loc => (
                                    <MenuItem key={loc.id} value={loc.id}>
                                        {loc.name} ({loc.code})
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>

                        {/* Icon */}
                        <Grid item xs={12} md={2} sx={{ display: 'flex', justifyContent: 'center', p: 0 }}>
                            <SwapHoriz color="action" sx={{ fontSize: 40, opacity: 0.6 }} />
                        </Grid>

                        {/* Destination Location */}
                        <Grid item xs={12} md={5}>
                            <Typography variant="subtitle2" gutterBottom color="textSecondary">
                                Transfer To (Destination)
                            </Typography>
                            <TextField
                                select
                                fullWidth
                                variant="outlined"
                                value={toLocation}
                                onChange={(e) => setToLocation(e.target.value)}
                            >
                                <MenuItem value="" disabled>Select Destination Location</MenuItem>
                                {locations.map(loc => (
                                    <MenuItem key={loc.id} value={loc.id} disabled={loc.id === fromLocation}>
                                        {loc.name} ({loc.code})
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>

                        <Grid item xs={12}>
                            <Typography variant="subtitle2" gutterBottom color="textSecondary">
                                Select Product (Only available stock shown)
                            </Typography>
                            <Autocomplete
                                options={balances}
                                getOptionLabel={(option) => `${option.sku_code} - Available: ${parseFloat(option.quantity_available).toString()}`}
                                value={selectedBalance}
                                onChange={(_, newValue) => setSelectedBalance(newValue)}
                                disabled={!fromLocation || fetchingBalances}
                                loading={fetchingBalances}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        fullWidth
                                        variant="outlined"
                                        placeholder={fromLocation ? "Search SKU to transfer..." : "First select a source location"}
                                    />
                                )}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" gutterBottom color="textSecondary">
                                Quantity to Transfer
                            </Typography>
                            <TextField
                                fullWidth
                                type="number"
                                variant="outlined"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="0"
                                inputProps={{ min: 1, max: selectedBalance ? parseFloat(selectedBalance.quantity_available) : undefined }}
                                disabled={!selectedBalance}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" gutterBottom color="textSecondary">
                                Internal Notes (Optional)
                            </Typography>
                            <TextField
                                fullWidth
                                variant="outlined"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="e.g. Replenishing Salem store stock."
                            />
                        </Grid>

                        <Grid item xs={12} sx={{ mt: 2 }}>
                            <Button
                                variant="contained"
                                size="large"
                                fullWidth
                                onClick={handleTransfer}
                                disabled={loading || !fromLocation || !toLocation || !selectedBalance || !quantity}
                                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                            >
                                {loading ? 'Processing Transfer...' : 'Confirm Stock Transfer'}
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
        </Box>
    )
}
