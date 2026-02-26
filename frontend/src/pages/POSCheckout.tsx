import { useState, useEffect, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
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
    LinearProgress,
    Chip,
} from '@mui/material'
import { Storefront, DeleteOutline, PointOfSale, Search, LocalOffer } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, Location, SKU } from '../services/mdm.service'
import { inventoryService, InventoryBalance } from '../services/inventory.service'
import { salesService } from '../services/sales.service'
import { StoreInvoice } from '../components/pos/StoreInvoice'

interface CartItem {
    sku: SKU
    quantity: number
    discountPercent: number
}

export default function POSCheckout() {
    const [stores, setStores] = useState<Location[]>([])
    const [selectedStore, setSelectedStore] = useState<string>('')
    const [customerMobile, setCustomerMobile] = useState('')
    const [customerEmail, setCustomerEmail] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [billDiscount, setBillDiscount] = useState('')

    const [skus, setSkus] = useState<SKU[]>([])
    const [storeBalances, setStoreBalances] = useState<InventoryBalance[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(false)

    const [cart, setCart] = useState<CartItem[]>([])
    const [checkingOut, setCheckingOut] = useState(false)
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null)

    // Receipt Printing State
    const [lastSale, setLastSale] = useState<any>(null)
    const [lastCart, setLastCart] = useState<CartItem[]>([])
    const invoiceRef = useRef<HTMLDivElement>(null)

    const handlePrint = useReactToPrint({
        contentRef: invoiceRef,
        documentTitle: `Receipt-${new Date().getTime()}`,
    })

    useEffect(() => {
        fetchStores()
        fetchSKUs()
    }, [])

    useEffect(() => {
        if (!selectedStore) return
        const fetchBalances = async () => {
            try {
                const data = await inventoryService.getBalances({ location: selectedStore })
                const list = Array.isArray(data) ? data : (data as any).results || []
                setStoreBalances(list)
            } catch (err) {
                console.error('Failed to load store balances', err)
            }
        }
        fetchBalances()
    }, [selectedStore])

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
            const data = await mdmService.getSKUs({ exclude_fabrics: true })
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
        !s.code.startsWith('FAB-') && (
            s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
    ).slice(0, 50) // Limit display

    const addToCart = (sku: SKU) => {
        setCart(prev => {
            const existing = prev.find(item => item.sku.id === sku.id)
            if (existing) {
                return prev.map(item => item.sku.id === sku.id ? { ...item, quantity: item.quantity + 1 } : item)
            }
            return [...prev, { sku, quantity: 1, discountPercent: 0 }]
        })
    }

    const removeFromCart = (skuId: string) => {
        setCart(prev => prev.filter(item => item.sku.id !== skuId))
    }

    const updateItemDiscount = (skuId: string, discount: number) => {
        setCart(prev => prev.map(item =>
            item.sku.id === skuId ? { ...item, discountPercent: Math.max(0, Math.min(100, discount)) } : item
        ))
    }

    const grossSubtotal = cart.reduce((acc, item) => acc + (parseFloat(item.sku.base_price || '0') * item.quantity), 0)

    const activeStore = stores.find(s => s.id === selectedStore)
    const activeStoreOffer = activeStore?.offer_tag || 'none'
    const activeStoreOfferMode = activeStore?.offer_mode || 'all'

    // Mix & Match Offer Logic (Group-Level) - STORE WIDE
    const calculateOfferDiscounts = () => {
        let totalOfferSavings = 0
        const groups: Record<string, number[]> = { 'b1g1': [], 'b2g1': [], 'b3g1': [] }

        if (activeStoreOffer !== 'none' && groups[activeStoreOffer]) {
            cart.forEach(item => {
                // Check eligibility if mode is 'selected'
                let isEligible = true
                if (activeStoreOfferMode === 'selected') {
                    const balance = storeBalances.find(b => b.sku === item.sku.id)
                    isEligible = balance?.is_offer_eligible || false
                }

                if (isEligible) {
                    const price = parseFloat(item.sku.base_price || '0')
                    for (let i = 0; i < item.quantity; i++) groups[activeStoreOffer].push(price)
                }
            })
        }

        const stats: Record<string, { total: number, free: number, remaining: number, goal: number }> = {
            'b1g1': { total: groups.b1g1.length, free: Math.floor(groups.b1g1.length / 2), remaining: groups.b1g1.length % 2, goal: 2 },
            'b2g1': { total: groups.b2g1.length, free: Math.floor(groups.b2g1.length / 3), remaining: groups.b2g1.length % 3, goal: 3 },
            'b3g1': { total: groups.b3g1.length, free: Math.floor(groups.b3g1.length / 4), remaining: groups.b3g1.length % 4, goal: 4 },
        }

        Object.entries(groups).forEach(([tag, units]) => {
            if (units.length === 0) return
            units.sort((a, b) => a - b) // Sort by price ascending
            const freeCount = stats[tag].free
            for (let i = 0; i < freeCount; i++) totalOfferSavings += units[i]
        })
        return { totalOfferSavings, stats }
    }

    const { totalOfferSavings: offerDiscountTotal, stats: offerStats } = calculateOfferDiscounts()

    const itemDiscountTotal = cart.reduce((acc, item) => {
        const lineGross = parseFloat(item.sku.base_price || '0') * item.quantity
        let lineOfferSavings = 0

        if (offerDiscountTotal > 0 && activeStoreOffer !== 'none') {
            let isEligible = true
            if (activeStoreOfferMode === 'selected') {
                const balance = storeBalances.find(b => b.sku === item.sku.id)
                isEligible = balance?.is_offer_eligible || false
            }

            if (isEligible) {
                // Only divide by the gross of ELIGIBLE items to correctly distribute the discount
                const eligibleGross = cart.reduce((tempAcc, tempItem) => {
                    let tempEligible = true
                    if (activeStoreOfferMode === 'selected') {
                        const b = storeBalances.find(bal => bal.sku === tempItem.sku.id)
                        tempEligible = b?.is_offer_eligible || false
                    }
                    return tempAcc + (tempEligible ? parseFloat(tempItem.sku.base_price || '0') * tempItem.quantity : 0)
                }, 0)

                lineOfferSavings = (lineGross / eligibleGross) * offerDiscountTotal
            }
        }
        const priceAfterOffer = lineGross - lineOfferSavings
        return acc + (priceAfterOffer * item.discountPercent / 100)
    }, 0)

    const afterItemDiscounts = grossSubtotal - offerDiscountTotal - itemDiscountTotal
    const billDiscountPct = parseFloat(billDiscount || '0')
    const billDiscountAmt = afterItemDiscounts * billDiscountPct / 100
    const finalTotal = afterItemDiscounts - billDiscountAmt

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
            const saleData = await salesService.posCheckout({
                store_id: selectedStore,
                payment_method: paymentMethod,
                customer_mobile: customerMobile,
                customer_email: customerEmail,
                bill_discount_percent: billDiscountPct,
                items: cart.map(item => ({
                    sku_id: item.sku.id,
                    quantity: item.quantity,
                    unit_price: parseFloat(item.sku.base_price || '0'),
                    discount_percent: item.discountPercent,
                }))
            })

            // Save details for printing
            setLastSale(saleData)
            setLastCart([...cart])

            // Show print prompt
            setFeedback({ type: 'success', msg: 'Sale recorded! Preparing receipt...' })

            // Clear current cart immediately for next customer
            setCart([])
            setCustomerMobile('')
            setCustomerEmail('')
            setBillDiscount('')

            // Automatically prompt for print after react renders the new state
            setTimeout(() => {
                if (handlePrint) handlePrint()
            }, 300)

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

            {feedback && !lastSale && (
                <Alert severity={feedback.type} sx={{ mb: 3 }} onClose={() => setFeedback(null)}>
                    {feedback.msg}
                </Alert>
            )}

            {lastSale && (
                <Alert
                    severity="success"
                    sx={{ mb: 3 }}
                    action={
                        <Button color="inherit" size="small" onClick={handlePrint} startIcon={<PointOfSale />}>
                            Print / Download PDF
                        </Button>
                    }
                    onClose={() => setLastSale(null)}
                >
                    Sale completed! An invoice has been generated for {lastSale.receipt_number || 'the customer'}.
                </Alert>
            )}

            {/* Hidden printable receipt area */}
            <div style={{ display: 'none' }}>
                <StoreInvoice ref={invoiceRef} saleData={lastSale} cart={lastCart} />
            </div>

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

                            <Grid container spacing={2} sx={{ mb: 2 }}>
                                <Grid item xs={6}>
                                    <TextField
                                        fullWidth
                                        label="Phone (Optional)"
                                        value={customerMobile}
                                        onChange={(e) => setCustomerMobile(e.target.value)}
                                        placeholder="+91 9876543210"
                                        size="small"
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        fullWidth
                                        label="Email (Optional)"
                                        value={customerEmail}
                                        onChange={(e) => setCustomerEmail(e.target.value)}
                                        placeholder="customer@email.com"
                                        size="small"
                                    />
                                </Grid>
                            </Grid>

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

                            {/* Offer Progress Tracker */}
                            {Object.entries(offerStats).map(([tag, stat]) => {
                                if (stat.total === 0) return null;
                                const isUnlocked = stat.free > 0;
                                const progress = (stat.remaining / stat.goal) * 100;

                                return (
                                    <Box key={tag} sx={{ mb: 2, p: 1.5, bgcolor: isUnlocked ? 'success.light' : 'action.hover', borderRadius: 1, borderLeft: '4px solid', borderColor: isUnlocked ? 'success.main' : 'warning.main' }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                                            <Typography variant="caption" fontWeight="bold" color={isUnlocked ? 'success.dark' : 'warning.dark'}>
                                                {tag.toUpperCase()} TRACKER: {stat.total} Item{stat.total > 1 ? 's' : ''}
                                            </Typography>
                                            <Typography variant="caption" fontWeight="bold">
                                                {stat.free > 0 ? `${stat.free} FREE UNLOCKED` : `${stat.goal - stat.remaining} more for FREE`}
                                            </Typography>
                                        </Box>
                                        <LinearProgress
                                            variant="determinate"
                                            value={stat.remaining === 0 && stat.total > 0 ? 100 : progress}
                                            color={isUnlocked ? 'success' : 'warning'}
                                            sx={{ height: 6, borderRadius: 3 }}
                                        />
                                    </Box>
                                );
                            })}

                            <Divider sx={{ mb: 2 }}><Typography variant="body2" color="text.secondary">CART ITEMS</Typography></Divider>

                            {cart.length === 0 ? (
                                <Typography color="text.secondary" align="center" py={4}>Cart is empty</Typography>
                            ) : (
                                <List sx={{ maxHeight: 300, overflow: 'auto', p: 0 }}>
                                    {cart.map(item => (
                                        <ListItem
                                            key={item.sku.id}
                                            disablePadding
                                            sx={{ mb: 1, display: 'flex', alignItems: 'center' }}
                                        >
                                            <ListItemText
                                                primary={
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        {item.sku.name}
                                                        {(() => {
                                                            let isEligible = true
                                                            if (activeStoreOfferMode === 'selected') {
                                                                const balance = storeBalances.find(b => b.sku === item.sku.id)
                                                                isEligible = balance?.is_offer_eligible || false
                                                            }
                                                            return activeStoreOffer !== 'none' && isEligible && (
                                                                <Chip
                                                                    label={activeStoreOffer.toUpperCase()}
                                                                    size="small"
                                                                    color="error"
                                                                    sx={{ height: 18, fontSize: '0.65rem', fontWeight: 'bold' }}
                                                                />
                                                            )
                                                        })()}
                                                    </Box>
                                                }
                                                secondary={
                                                    <Box component="span">
                                                        {item.quantity}x @ ₹{parseFloat(item.sku.base_price || '0').toFixed(2)}
                                                        {(() => {
                                                            let isEligible = true
                                                            if (activeStoreOfferMode === 'selected') {
                                                                const balance = storeBalances.find(b => b.sku === item.sku.id)
                                                                isEligible = balance?.is_offer_eligible || false
                                                            }
                                                            return activeStoreOffer !== 'none' && isEligible && (
                                                                <Typography component="span" variant="caption" color="error.main" sx={{ ml: 1, fontWeight: 'bold' }}>
                                                                    (Part of {activeStoreOffer.toUpperCase()} Mix & Match)
                                                                </Typography>
                                                            )
                                                        })()}
                                                        {item.discountPercent > 0 && ` (-${item.discountPercent}%)`}
                                                    </Box>
                                                }
                                                sx={{ flexGrow: 1, mr: 1 }}
                                            />
                                            <TextField
                                                size="small"
                                                label="Disc%"
                                                type="number"
                                                value={item.discountPercent || ''}
                                                onChange={(e) => updateItemDiscount(item.sku.id, parseFloat(e.target.value) || 0)}
                                                sx={{ width: 70, mr: 1 }}
                                                inputProps={{ min: 0, max: 100, step: 5 }}
                                            />
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <Typography variant="body1" fontWeight="bold">
                                                    ₹{(() => {
                                                        const lineGross = parseFloat(item.sku.base_price || '0') * item.quantity
                                                        let lineOfferSavings = 0

                                                        if (offerDiscountTotal > 0 && activeStoreOffer !== 'none') {
                                                            let isEligible = true
                                                            if (activeStoreOfferMode === 'selected') {
                                                                const balance = storeBalances.find(b => b.sku === item.sku.id)
                                                                isEligible = balance?.is_offer_eligible || false
                                                            }

                                                            if (isEligible) {
                                                                const eligibleGross = cart.reduce((acc, tempItem) => {
                                                                    let tempEligible = true
                                                                    if (activeStoreOfferMode === 'selected') {
                                                                        const b = storeBalances.find(bal => bal.sku === tempItem.sku.id)
                                                                        tempEligible = b?.is_offer_eligible || false
                                                                    }
                                                                    return acc + (tempEligible ? parseFloat(tempItem.sku.base_price || '0') * tempItem.quantity : 0)
                                                                }, 0)
                                                                lineOfferSavings = eligibleGross > 0 ? (lineGross / eligibleGross) * offerDiscountTotal : 0
                                                            }
                                                        }
                                                        return ((lineGross - lineOfferSavings) * (1 - item.discountPercent / 100)).toFixed(2)
                                                    })()}
                                                </Typography>
                                                <IconButton edge="end" color="error" onClick={() => removeFromCart(item.sku.id)}>
                                                    <DeleteOutline />
                                                </IconButton>
                                            </Box>
                                        </ListItem>
                                    ))}
                                </List>
                            )}

                        </CardContent>

                        <Box sx={{ mt: 'auto', p: 2, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
                            <Box display="flex" justifyContent="space-between" mb={1}>
                                <Typography variant="body2" color="text.secondary">Gross Total:</Typography>
                                <Typography variant="body2">₹{grossSubtotal.toFixed(2)}</Typography>
                            </Box>
                            {offerDiscountTotal > 0 && (
                                <Box display="flex" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2" color="error.main">Offer Savings:</Typography>
                                    <Typography variant="body2" color="error.main">-₹{offerDiscountTotal.toFixed(2)}</Typography>
                                </Box>
                            )}
                            {itemDiscountTotal > 0 && (
                                <Box display="flex" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2" color="error.main">Item Discounts:</Typography>
                                    <Typography variant="body2" color="error.main">-₹{itemDiscountTotal.toFixed(2)}</Typography>
                                </Box>
                            )}
                            {(billDiscountAmt > 0) && (
                                <Box display="flex" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2" color="error.main">Bill Discount:</Typography>
                                    <Typography variant="body2" color="error.main">-₹{billDiscountAmt.toFixed(2)}</Typography>
                                </Box>
                            )}
                            <TextField
                                fullWidth
                                size="small"
                                label="Bill Discount %"
                                type="number"
                                value={billDiscount}
                                onChange={(e) => setBillDiscount(e.target.value)}
                                sx={{ mb: 2 }}
                                inputProps={{ min: 0, max: 100, step: 5 }}
                                placeholder="0"
                            />
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Typography variant="h5">Total Due:</Typography>
                                <Typography variant="h4" fontWeight="bold" color="primary">₹{finalTotal.toFixed(2)}</Typography>
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
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3} gap={2}>
                            <Box display="flex" alignItems="center" gap={2} flexGrow={1}>
                                <Search color="action" />
                                <TextField
                                    fullWidth
                                    variant="standard"
                                    placeholder="Search products by SKU code or name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </Box>
                            {activeStoreOffer !== 'none' && (
                                <Chip
                                    icon={<LocalOffer sx={{ fontSize: '1rem !important' }} />}
                                    label={`Active: ${activeStoreOffer.toUpperCase()} (${activeStoreOfferMode === 'selected' ? 'Selected items' : 'Store-wide'})`}
                                    color="error"
                                    variant="outlined"
                                    sx={{ fontWeight: 'bold' }}
                                />
                            )}
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
                                                position: 'relative',
                                                '&:hover': { borderColor: 'primary.main', boxShadow: 2, bgcolor: 'action.hover' }
                                            }}
                                        >
                                            {(() => {
                                                if (activeStoreOffer === 'none') return null
                                                let isEligible = true
                                                if (activeStoreOfferMode === 'selected') {
                                                    const balance = storeBalances.find(b => b.sku === sku.id)
                                                    isEligible = balance?.is_offer_eligible || false
                                                }
                                                return isEligible && (
                                                    <Box
                                                        sx={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            right: 0,
                                                            bgcolor: 'error.main',
                                                            color: 'white',
                                                            px: 1,
                                                            py: 0.25,
                                                            fontSize: '0.65rem',
                                                            fontWeight: 800,
                                                            borderBottomLeftRadius: 8,
                                                            zIndex: 2,
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                        }}
                                                    >
                                                        {activeStoreOffer.toUpperCase()}
                                                    </Box>
                                                )
                                            })()}
                                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                                <Typography variant="caption" color="text.secondary" display="block">{sku.code}</Typography>
                                                <Typography variant="subtitle2" fontWeight="bold" noWrap title={sku.name}>
                                                    {sku.name}
                                                </Typography>
                                                <Typography variant="body1" color="primary.main" mt={1}>
                                                    ₹{parseFloat(sku.base_price || '0').toFixed(2)}
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
