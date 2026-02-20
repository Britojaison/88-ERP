import { useState, useEffect } from 'react'
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    Button,
    TextField,
    MenuItem,
    Divider,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Alert,
    CircularProgress,
    Paper,
} from '@mui/material'
import { Storefront, DeleteOutline, PointOfSale, Search } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, Location, SKU } from '../services/mdm.service'
import { salesService } from '../services/sales.service'

interface CartItem {
    sku: SKU
    quantity: number
}

export default function POSCheckout() {
    const [stores, setStores] = useState<Location[]>([])
    const [selectedStore, setSelectedStore] = useState<string>('')
    const [customerMobile, setCustomerMobile] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('cash')

    const [skus, setSkus] = useState<SKU[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(false)

    const [cart, setCart] = useState<CartItem[]>([])
    const [checkingOut, setCheckingOut] = useState(false)
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null)

    useEffect(() => {
        fetchStores()
        fetchSKUs()
    }, [])

    const fetchStores = async () => {
        try {
            const data = await mdmService.getLocations()
            // Fallback: If your backend has type filters, use them. Otherwise filter here.
            const storeLocations = data.filter(loc => loc.location_type === 'store')
            setStores(storeLocations)
            if (storeLocations.length > 0) setSelectedStore(storeLocations[0].id)
        } catch (err) {
            console.error('Failed to load stores', err)
        }
    }

    const fetchSKUs = async () => {
        setLoading(true)
        try {
            const data = await mdmService.getSKUs()
            // Unwrap pagination if applicable
            const skuList = Array.isArray(data) ? data : (data as any).results || []
            setSkus(skuList)
        } catch (err) {
            console.error('Failed to load SKUs', err)
        } finally {
            setLoading(false)
        }
    }

    const filteredSKUs = skus.filter(s =>
        s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 50) // Limit display

    const addToCart = (sku: SKU) => {
        setCart(prev => {
            const existing = prev.find(item => item.sku.id === sku.id)
            if (existing) {
                return prev.map(item => item.sku.id === sku.id ? { ...item, quantity: item.quantity + 1 } : item)
            }
            return [...prev, { sku, quantity: 1 }]
        })
    }

    const removeFromCart = (skuId: string) => {
        setCart(prev => prev.filter(item => item.sku.id !== skuId))
    }

    const subtotal = cart.reduce((acc, item) => acc + (parseFloat(item.sku.base_price || '0') * item.quantity), 0)

    const handleCheckout = async () => {
        if (!selectedStore) {
            setFeedback({ type: 'error', msg: 'Please select a Store Location.' })
            return
        }
        if (cart.length === 0) {
            setFeedback({ type: 'error', msg: 'Cart is empty.' })
            return
        }

        setCheckingOut(true)
        setFeedback(null)

        try {
            await salesService.posCheckout({
                store_id: selectedStore,
                payment_method: paymentMethod,
                customer_mobile: customerMobile,
                items: cart.map(item => ({
                    sku_id: item.sku.id,
                    quantity: item.quantity,
                    unit_price: parseFloat(item.sku.base_price || '0')
                }))
            })

            setFeedback({ type: 'success', msg: 'Sale completed successfully!' })
            setCart([]) // Clear cart
            setCustomerMobile('')
        } catch (err: any) {
            setFeedback({ type: 'error', msg: err?.response?.data?.error || err.message || 'Checkout failed' })
        } finally {
            setCheckingOut(false)
        }
    }

    return (
        <Box>
            <PageHeader
                title="Store POS Terminal"
                subtitle="Quickly ring up customers, log sales, and deduct store inventory automatically."
            />

            {feedback && (
                <Alert severity={feedback.type} sx={{ mb: 3 }} onClose={() => setFeedback(null)}>
                    {feedback.msg}
                </Alert>
            )}

            <Grid container spacing={3}>

                {/* LEFT COLUMN: Cart & Checkout Form */}
                <Grid item xs={12} md={5}>
                    <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardContent>
                            <Typography variant="h6" display="flex" alignItems="center" gap={1} mb={2}>
                                <Storefront color="primary" /> Checkout Details
                            </Typography>

                            <TextField
                                select
                                fullWidth
                                label="Store Location"
                                value={selectedStore}
                                onChange={(e) => setSelectedStore(e.target.value)}
                                sx={{ mb: 2 }}
                            >
                                {stores.length === 0 && <MenuItem value="" disabled>No Stores Found</MenuItem>}
                                {stores.map(store => (
                                    <MenuItem key={store.id} value={store.id}>{store.name} ({store.code})</MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                fullWidth
                                label="Customer Phone (Optional)"
                                value={customerMobile}
                                onChange={(e) => setCustomerMobile(e.target.value)}
                                sx={{ mb: 2 }}
                                placeholder="+1 555-1234"
                            />

                            <TextField
                                select
                                fullWidth
                                label="Payment Method"
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                sx={{ mb: 3 }}
                            >
                                <MenuItem value="cash">Cash</MenuItem>
                                <MenuItem value="card">Card / POS Terminal</MenuItem>
                                <MenuItem value="upi">UPI / Mobile Wallet</MenuItem>
                            </TextField>

                            <Divider sx={{ mb: 2 }}><Typography variant="body2" color="text.secondary">CART ITEMS</Typography></Divider>

                            {cart.length === 0 ? (
                                <Typography color="text.secondary" align="center" py={4}>Cart is empty</Typography>
                            ) : (
                                <List sx={{ maxHeight: 300, overflow: 'auto', p: 0 }}>
                                    {cart.map(item => (
                                        <ListItem
                                            key={item.sku.id}
                                            disablePadding
                                            secondaryAction={
                                                <IconButton edge="end" color="error" onClick={() => removeFromCart(item.sku.id)}>
                                                    <DeleteOutline />
                                                </IconButton>
                                            }
                                            sx={{ mb: 1 }}
                                        >
                                            <ListItemText
                                                primary={item.sku.name}
                                                secondary={`${item.quantity}x @ $${parseFloat(item.sku.base_price || '0').toFixed(2)}`}
                                            />
                                            <Typography variant="body1" fontWeight="bold" mr={2}>
                                                ${(parseFloat(item.sku.base_price || '0') * item.quantity).toFixed(2)}
                                            </Typography>
                                        </ListItem>
                                    ))}
                                </List>
                            )}

                        </CardContent>

                        <Box sx={{ mt: 'auto', p: 2, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Typography variant="h5">Total Due:</Typography>
                                <Typography variant="h4" fontWeight="bold" color="primary">${subtotal.toFixed(2)}</Typography>
                            </Box>
                            <Button
                                fullWidth
                                variant="contained"
                                size="large"
                                color="primary"
                                startIcon={checkingOut ? <CircularProgress size={20} color="inherit" /> : <PointOfSale />}
                                disabled={checkingOut || cart.length === 0}
                                onClick={handleCheckout}
                                sx={{ py: 1.5, fontSize: '1.1rem' }}
                            >
                                {checkingOut ? 'Processing...' : 'Complete Checkout'}
                            </Button>
                        </Box>
                    </Card>
                </Grid>

                {/* RIGHT COLUMN: Product Catalog */}
                <Grid item xs={12} md={7}>
                    <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                        <Box display="flex" alignItems="center" gap={2} mb={3}>
                            <Search color="action" />
                            <TextField
                                fullWidth
                                variant="standard"
                                placeholder="Search products by SKU code or name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </Box>

                        {loading ? (
                            <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
                        ) : (
                            <Grid container spacing={2}>
                                {filteredSKUs.map(sku => (
                                    <Grid item xs={12} sm={6} md={4} key={sku.id}>
                                        <Card
                                            variant="outlined"
                                            onClick={() => addToCart(sku)}
                                            sx={{
                                                cursor: 'pointer',
                                                transition: '0.2s',
                                                '&:hover': { borderColor: 'primary.main', boxShadow: 2, bgcolor: 'action.hover' }
                                            }}
                                        >
                                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                                <Typography variant="caption" color="text.secondary" display="block">{sku.code}</Typography>
                                                <Typography variant="subtitle2" fontWeight="bold" noWrap title={sku.name}>
                                                    {sku.name}
                                                </Typography>
                                                <Typography variant="body1" color="primary.main" mt={1}>
                                                    ${parseFloat(sku.base_price || '0').toFixed(2)}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                                {filteredSKUs.length === 0 && (
                                    <Grid item xs={12}>
                                        <Typography color="text.secondary" align="center" py={4}>No products found.</Typography>
                                    </Grid>
                                )}
                            </Grid>
                        )}
                    </Paper>
                </Grid>

            </Grid>
        </Box>
    )
}
