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
    IconButton,
    Alert,
    CircularProgress,
    Paper,
    LinearProgress,
    Chip,
    ToggleButton,
    ToggleButtonGroup,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    InputAdornment,
} from '@mui/material'
import { Storefront, DeleteOutline, PointOfSale, Search, LocalOffer, Refresh, Close, Receipt, Add, Remove, History, FilterList, CalendarToday } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, Location, SKU } from '../services/mdm.service'

import { salesService, SalesTransaction } from '../services/sales.service'
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
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all')

    // Recent Transactions
    const [recentTransactions, setRecentTransactions] = useState<SalesTransaction[]>([])

    const [cart, setCart] = useState<CartItem[]>([])
    const [checkingOut, setCheckingOut] = useState(false)
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null)

    // Receipt Printing State
    const [lastSale, setLastSale] = useState<any>(null)
    const [lastCart, setLastCart] = useState<CartItem[]>([])
    const invoiceRef = useRef<HTMLDivElement>(null)

    // Transaction Detail Dialog
    const [selectedTx, setSelectedTx] = useState<SalesTransaction | null>(null)
    const [txDetailOpen, setTxDetailOpen] = useState(false)
    const [txDetailLoading, setTxDetailLoading] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)

    // History Filters
    const [historySearch, setHistorySearch] = useState('')
    const [historyLimit] = useState(30)

    const handleOpenTxDetail = async (tx: SalesTransaction) => {
        setTxDetailOpen(true)
        setTxDetailLoading(true)
        try {
            const detail = await salesService.getTransaction(tx.id)
            setSelectedTx(detail)
        } catch (err) {
            console.error('Failed to fetch transaction details', err)
            setSelectedTx(tx)
        } finally {
            setTxDetailLoading(false)
        }
    }

    const handlePrint = useReactToPrint({
        contentRef: invoiceRef,
        documentTitle: `Receipt-${new Date().getTime()}`,
    })

    const fetchTransactions = async () => {
        if (!selectedStore) {
            setRecentTransactions([])
            return
        }
        try {
            const data = await salesService.getTransactions({ store: selectedStore })
            setRecentTransactions(data)
        } catch (err) {
            console.error('Failed to fetch transactions', err)
        }
    }

    const filteredTransactions = recentTransactions.filter(tx => {
        if (historySearch) {
            const search = historySearch.toLowerCase()
            return (
                tx.transaction_number.toLowerCase().includes(search) ||
                (tx.customer && tx.customer.toLowerCase().includes(search))
            )
        }
        return true
    }).slice(0, 30)

    useEffect(() => {
        fetchStores()
        fetchSearchSKUs('')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (selectedStore) {
            fetchTransactions()
        } else {
            setRecentTransactions([])
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStore])

    const fetchSearchSKUs = async (query: string) => {
        setLoading(true)
        try {
            const data = await mdmService.searchSKUsWithStock({ search: query, page_size: 50 })
            const results = data.results || []
            const mappedSKUs = results.map(r => ({
                id: r.id,
                code: r.code,
                name: r.name,
                product_name: r.product_name,
                size: r.size,
                base_price: r.base_price,
                warehouse_stock: r.warehouse_stock,
                is_offer_eligible: r.is_offer_eligible
            } as any))
            setSkus(mappedSKUs)
        } catch (err) {
            console.error('Failed to search SKUs', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim().length >= 2) {
                fetchSearchSKUs(searchQuery)
            } else if (searchQuery.trim().length === 0) {
                fetchSearchSKUs('')
            }
        }, 500)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery])

    const handleSearchKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            setLoading(true)
            try {
                const data = await mdmService.searchSKUsWithStock({ search: searchQuery, page_size: 2 })
                if (data.results && data.results.length === 1) {
                    const matchedSku = data.results[0]
                    addToCart(matchedSku as any)
                    setSearchQuery('')
                    setFeedback({ type: 'success', msg: `Added ${matchedSku.name} to cart` })
                    setTimeout(() => searchInputRef.current?.focus(), 50)
                }
            } catch (err) {
                console.error('Fast search failed', err)
            } finally {
                setLoading(false)
            }
        }
    }

    const fetchStores = async () => {
        try {
            const data = await mdmService.getLocations()
            const list = Array.isArray(data) ? data : data.results
            const storeLocations = list.filter((loc: any) => loc.location_type === 'store')
            setStores(storeLocations)

            if (storeLocations.length > 0) setSelectedStore(storeLocations[0].id)
        } catch (err) {
            console.error('Failed to load stores', err)
        }
    }

    const filteredSKUs = skus.filter(s => {
        if (stockFilter !== 'all') {
            const available = parseFloat((s as any).warehouse_stock?.toString() || '0')
            const inCart = cart.find(c => c.sku.id === s.id)?.quantity || 0
            const netAvailable = available - inCart
            if (stockFilter === 'in_stock' && netAvailable <= 0) return false
            if (stockFilter === 'out_of_stock' && netAvailable > 0) return false
        }
        return true
    }).slice(0, 50)

    const addToCart = (sku: SKU) => {
        const available = parseFloat((sku as any).warehouse_stock?.toString() || '0')
        const existing = cart.find(item => item.sku.id === sku.id)
        const currentCartQty = existing ? existing.quantity : 0

        if (currentCartQty >= available) {
            setFeedback({ type: 'error', msg: `Stockout! Cannot add more ${sku.code}. Only ${available} units in warehouse.` })
            return
        }

        setCart(prev => {
            if (existing) {
                return prev.map(item => item.sku.id === sku.id ? { ...item, quantity: item.quantity + 1 } : item)
            }
            return [{ sku, quantity: 1, discountPercent: 0 }, ...prev]
        })
    }

    const updateCartQuantity = (skuId: string, newQty: number) => {
        const item = cart.find(i => i.sku.id === skuId)
        if (!item) return
        
        const available = parseFloat((item.sku as any).warehouse_stock?.toString() || '0')
        
        if (newQty > available) {
            setFeedback({ type: 'error', msg: `Cannot set quantity for ${item.sku.code} to ${newQty}. Only ${available} units available.` })
            return
        }

        if (newQty <= 0) {
            removeFromCart(skuId)
            return
        }

        setCart(prev => prev.map(i => i.sku.id === skuId ? { ...i, quantity: newQty } : i))
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

    const calculateOfferDiscounts = () => {
        let totalOfferSavings = 0
        const groups: Record<string, number[]> = { 'b1g1': [], 'b2g1': [], 'b3g1': [] }

        if (activeStoreOffer !== 'none' && groups[activeStoreOffer]) {
            cart.forEach(item => {
                let isEligible = true
                if (activeStoreOfferMode === 'selected') {
                    isEligible = (item.sku as any).is_offer_eligible || false
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
            units.sort((a, b) => a - b)
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
                isEligible = (item.sku as any).is_offer_eligible || false
            }
            if (isEligible) {
                const eligibleGross = cart.reduce((tempAcc, tempItem) => {
                    let tempEligible = true
                    if (activeStoreOfferMode === 'selected') {
                        tempEligible = (tempItem.sku as any).is_offer_eligible || false
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

            setLastSale(saleData)
            setLastCart([...cart])
            setFeedback({ type: 'success', msg: 'Sale recorded! Preparing receipt...' })

            setTimeout(() => {
                setCart([])
                setCustomerMobile('')
                setCustomerEmail('')
                setBillDiscount('')
                setPaymentMethod('cash')
                fetchSearchSKUs(searchQuery)
                fetchTransactions()
            }, 100)

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
            <Box sx={{ mb: 4, p: 3, borderRadius: 4, bgcolor: 'background.paper', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid', borderColor: 'divider' }}>
                <PageHeader
                    title="Store POS Terminal"
                    subtitle="Centralized retail checkout for warehouse inventory. Auto-syncs with Shopify."
                />
            </Box>

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

            <div style={{ display: 'none' }}>
                <StoreInvoice ref={invoiceRef} saleData={lastSale} cart={lastCart} />
            </div>

            <Grid container spacing={3}>
                <Grid item xs={12} md={5}>
                    <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardContent>
                            <Typography variant="h6" display="flex" alignItems="center" gap={1} mb={2}>
                                <Storefront color="primary" /> Checkout Details
                            </Typography>

                            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Store Location"
                                    value={selectedStore}
                                    onChange={(e) => setSelectedStore(e.target.value)}
                                >
                                    {stores.length === 0 && <MenuItem value="" disabled>No Stores Found</MenuItem>}
                                    {stores.map(store => (
                                        <MenuItem key={store.id} value={store.id}>{store.name} ({store.code})</MenuItem>
                                    ))}
                                </TextField>
                                <Button
                                    variant="outlined"
                                    onClick={() => fetchSearchSKUs(searchQuery)}
                                    disabled={!selectedStore}
                                    sx={{ minWidth: 56, p: 0 }}
                                    title="Refresh Inventory"
                                >
                                    <Refresh />
                                </Button>
                            </Box>

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
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, opacity: 0.5 }}>
                                    <Receipt sx={{ fontSize: 48, mb: 1 }} />
                                    <Typography color="text.secondary">Cart is empty</Typography>
                                </Box>
                            ) : (
                                <List sx={{ maxHeight: 400, overflow: 'auto', px: 0 }}>
                                    {cart.map(item => (
                                        <Paper 
                                            key={item.sku.id} 
                                            variant="outlined" 
                                            sx={{ mb: 1.5, p: 1.5, position: 'relative', borderColor: 'divider' }}
                                        >
                                            <IconButton 
                                                size="small" 
                                                color="error" 
                                                onClick={() => removeFromCart(item.sku.id)}
                                                sx={{ position: 'absolute', top: 4, right: 4 }}
                                            >
                                                <DeleteOutline fontSize="small" />
                                            </IconButton>

                                            <Box sx={{ pr: 4 }}>
                                                <Typography variant="subtitle2" fontWeight="bold" noWrap sx={{ maxWidth: '85%' }}>
                                                    {item.sku.name}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                                    {item.sku.code} • WH: {parseFloat((item.sku as any).warehouse_stock?.toString() || '0')}
                                                </Typography>
                                            </Box>

                                            <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                                                <Box display="flex" alignItems="center" gap={0.5} sx={{ bgcolor: 'action.hover', borderRadius: 1.5, p: 0.5 }}>
                                                    <IconButton 
                                                        size="small" 
                                                        onClick={() => updateCartQuantity(item.sku.id, item.quantity - 1)}
                                                        disabled={item.quantity <= 1}
                                                        sx={{ p: 0.5 }}
                                                    >
                                                        <Remove fontSize="small" />
                                                    </IconButton>
                                                    
                                                    <TextField
                                                        size="small"
                                                        value={item.quantity}
                                                        onChange={(e) => updateCartQuantity(item.sku.id, parseInt(e.target.value) || 0)}
                                                        sx={{ 
                                                            width: 40,
                                                            '& .MuiInputBase-input': { p: 0.5, textAlign: 'center', fontWeight: 'bold' },
                                                            '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
                                                        }}
                                                    />

                                                    <IconButton 
                                                        size="small" 
                                                        onClick={() => updateCartQuantity(item.sku.id, item.quantity + 1)}
                                                        sx={{ p: 0.5 }}
                                                    >
                                                        <Add fontSize="small" />
                                                    </IconButton>
                                                </Box>

                                                <Box textAlign="right">
                                                    <Typography variant="body2" fontWeight="bold">
                                                        ₹{(() => {
                                                            const lineGross = parseFloat(item.sku.base_price || '0') * item.quantity
                                                            let lineOfferSavings = 0

                                                            if (offerDiscountTotal > 0 && activeStoreOffer !== 'none') {
                                                                let isEligible = true
                                                                if (activeStoreOfferMode === 'selected') {
                                                                    isEligible = (item.sku as any).is_offer_eligible || false
                                                                }

                                                                if (isEligible) {
                                                                    const eligibleGross = cart.reduce((acc, tempItem) => {
                                                                        let tempEligible = true
                                                                        if (activeStoreOfferMode === 'selected') {
                                                                            tempEligible = (tempItem.sku as any).is_offer_eligible || false
                                                                        }
                                                                        return acc + (tempEligible ? parseFloat(tempItem.sku.base_price || '0') * tempItem.quantity : 0)
                                                                    }, 0)
                                                                    lineOfferSavings = eligibleGross > 0 ? (lineGross / eligibleGross) * offerDiscountTotal : 0
                                                                }
                                                            }
                                                            return ((lineGross - lineOfferSavings) * (1 - item.discountPercent / 100)).toFixed(2)
                                                        })()}
                                                    </Typography>
                                                    {item.discountPercent > 0 && (
                                                        <Typography variant="caption" color="error.main">
                                                            -{item.discountPercent}% OFF
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                            
                                            <Box mt={1}>
                                                <TextField
                                                    size="small"
                                                    label="Item Discount %"
                                                    variant="standard"
                                                    type="number"
                                                    value={item.discountPercent || ''}
                                                    onChange={(e) => updateItemDiscount(item.sku.id, parseFloat(e.target.value) || 0)}
                                                    sx={{ width: 100 }}
                                                    inputProps={{ min: 0, max: 100, style: { fontSize: '0.75rem' } }}
                                                />
                                            </Box>
                                        </Paper>
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

                <Grid item xs={12} md={7}>
                    <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', height: '100%', borderRadius: 3 }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3} gap={2} flexWrap="wrap">
                            <TextField
                                fullWidth
                                variant="standard"
                                inputRef={searchInputRef}
                                autoFocus
                                placeholder="Scan barcode or search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Search color="action" />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ flex: 1 }}
                            />

                            <Box display="flex" alignItems="center" gap={2}>
                                <ToggleButtonGroup
                                    size="small"
                                    value={stockFilter}
                                    exclusive
                                    onChange={(_, val) => { if (val) setStockFilter(val) }}
                                    sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, px: 1.5, py: 0.5, fontSize: '0.8rem' } }}
                                >
                                    <ToggleButton value="all">All</ToggleButton>
                                    <ToggleButton value="in_stock" color="success">In Stock</ToggleButton>
                                    <ToggleButton value="out_of_stock" color="error">Out of Stock</ToggleButton>
                                </ToggleButtonGroup>

                                {activeStoreOffer !== 'none' && (
                                    <Chip
                                        icon={<LocalOffer sx={{ fontSize: '1rem !important' }} />}
                                        label={`${activeStoreOffer.toUpperCase()}`}
                                        color="error"
                                        variant="outlined"
                                        sx={{ fontWeight: 'bold' }}
                                    />
                                )}
                            </Box>
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
                                                height: '100%',
                                                borderRadius: 3,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                transition: 'all 0.2s',
                                                position: 'relative',
                                                overflow: 'hidden',
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    transform: 'translateY(-4px)',
                                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                                    borderColor: 'primary.main'
                                                },
                                                border: '1px solid',
                                                borderColor: 'divider',
                                            }}
                                        >
                                            {(() => {
                                                if (activeStoreOffer === 'none') return null
                                                let isEligible = true
                                                if (activeStoreOfferMode === 'selected') {
                                                    isEligible = (sku as any).is_offer_eligible || false
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
                                            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                                    <Box sx={{ maxWidth: '70%' }}>
                                                        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ lineHeight: 1 }}>
                                                            {sku.code}
                                                        </Typography>
                                                        <Typography variant="body2" fontWeight="bold" noWrap sx={{ mt: 0.5 }}>
                                                            {sku.name}
                                                        </Typography>
                                                    </Box>
                                                    
                                                    {(() => {
                                                        const baseAvailable = parseFloat((sku as any).warehouse_stock?.toString() || '0')
                                                        const inCart = cart.find(c => c.sku.id === sku.id)?.quantity || 0
                                                        const available = baseAvailable - inCart

                                                        return (
                                                            <Chip 
                                                                label={available}
                                                                size="small"
                                                                color={available > 0 ? 'success' : 'error'}
                                                                variant={available > 0 ? 'filled' : 'outlined'}
                                                                sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800, borderRadius: 1 }}
                                                            />
                                                        )
                                                    })()}
                                                </Box>

                                                <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                                                    <Typography variant="subtitle1" color="primary.main" fontWeight={800}>
                                                        ₹{parseFloat(sku.base_price || '0').toFixed(0)}
                                                    </Typography>
                                                    
                                                    <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1, py: 0, height: 24, fontSize: '0.7rem', fontWeight: 'bold' }}>
                                                        ADD
                                                    </Button>
                                                </Box>
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

            {selectedStore && (
                <Box mt={8}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-end" mb={3}>
                        <Box>
                            <Typography variant="h5" fontWeight="bold" display="flex" alignItems="center" gap={1}>
                                <History color="primary" /> Recent Checkouts
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Showing last 30 transactions for {activeStore?.name}
                            </Typography>
                        </Box>
                        
                        <Box display="flex" gap={2}>
                            <TextField
                                size="small"
                                placeholder="Search by Receipt # or Phone..."
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <FilterList fontSize="small" color="action" />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ width: 300, bgcolor: 'background.paper' }}
                            />
                            <Button 
                                variant="outlined" 
                                startIcon={<Refresh />} 
                                onClick={fetchTransactions}
                                sx={{ borderRadius: 2 }}
                            >
                                Refresh
                            </Button>
                        </Box>
                    </Box>

                    <Card elevation={2} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                        <TableContainer>
                            <Table sx={{ minWidth: 800 }}>
                                <TableHead sx={{ bgcolor: 'action.hover' }}>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Date & Time</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Receipt #</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Customer</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Payment</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Items</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Total</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Status</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredTransactions.map((tx) => (
                                        <TableRow
                                            key={tx.id}
                                            hover
                                            sx={{ cursor: 'pointer', transition: '0.2s' }}
                                            onClick={() => handleOpenTxDetail(tx)}
                                        >
                                            <TableCell>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <CalendarToday sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
                                                    {new Date(tx.transaction_date).toLocaleString()}
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold" color="primary">
                                                    {tx.transaction_number}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{tx.customer || 'Walk-in'}</TableCell>
                                            <TableCell>
                                                <Chip 
                                                    label={tx.payment_method.toUpperCase()} 
                                                    size="small" 
                                                    variant="outlined"
                                                    sx={{ fontSize: '0.65rem', fontWeight: 800 }}
                                                />
                                            </TableCell>
                                            <TableCell align="center">{tx.item_count}</TableCell>
                                            <TableCell align="right">
                                                <Typography variant="body2" fontWeight="bold">
                                                    ₹{parseFloat(tx.total_amount).toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip
                                                    label="Completed"
                                                    size="small"
                                                    color="success"
                                                    sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredTransactions.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                                <Box sx={{ opacity: 0.5 }}>
                                                    <Receipt sx={{ fontSize: 40, mb: 1 }} />
                                                    <Typography>No checkouts match your search.</Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>
                </Box>
            )}

            <Dialog
                open={txDetailOpen}
                onClose={() => { setTxDetailOpen(false); setSelectedTx(null) }}
                maxWidth="md"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <Receipt color="primary" />
                        <Typography variant="h6" fontWeight={700}>
                            {selectedTx?.transaction_number || 'Loading...'}
                        </Typography>
                    </Box>
                    <IconButton onClick={() => { setTxDetailOpen(false); setSelectedTx(null) }} size="small">
                        <Close />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {txDetailLoading ? (
                        <Box display="flex" justifyContent="center" py={6}>
                            <CircularProgress />
                        </Box>
                    ) : selectedTx ? (
                        <Box>
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid item xs={6} sm={3}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Date</Typography>
                                    <Typography variant="body2" fontWeight={600}>
                                        {new Date(selectedTx.transaction_date).toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Store</Typography>
                                    <Typography variant="body2" fontWeight={600}>
                                        {selectedTx.store_name || selectedTx.store_code || '-'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Payment</Typography>
                                    <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                                        {selectedTx.payment_method}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Customer</Typography>
                                    <Typography variant="body2" fontWeight={600}>
                                        {selectedTx.customer || 'Walk-in'}
                                    </Typography>
                                </Grid>
                            </Grid>

                            <Divider sx={{ mb: 2 }} />

                            <Typography variant="subtitle2" fontWeight={700} mb={1}>Products Purchased</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>SKU Code</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Product Name</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }} align="center">Qty</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }} align="right">Unit Price</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }} align="right">Discount</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }} align="center">Status</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {(selectedTx.lines || []).map((line) => (
                                            <TableRow key={line.id}>
                                                <TableCell>{line.line_number}</TableCell>
                                                <TableCell sx={{ fontWeight: 600, color: 'primary.main', fontFamily: 'monospace' }}>
                                                    {line.sku_code || '-'}
                                                </TableCell>
                                                <TableCell>{line.sku_name || '-'}</TableCell>
                                                <TableCell align="center">{line.quantity}</TableCell>
                                                <TableCell align="right">₹{parseFloat(line.unit_price).toFixed(2)}</TableCell>
                                                <TableCell align="right">
                                                    {parseFloat(line.discount_amount) > 0
                                                        ? <Typography variant="body2" color="error.main">-₹{parseFloat(line.discount_amount).toFixed(2)}</Typography>
                                                        : '-'
                                                    }
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 700 }}>
                                                    ₹{parseFloat(line.line_total).toFixed(2)}
                                                </TableCell>
                                                <TableCell align="center">
                                                    {line.is_returned ? (
                                                        <Chip label="Returned" size="small" color="warning" variant="outlined" sx={{ fontWeight: 600 }} />
                                                    ) : (
                                                        <Chip label="Sold" size="small" color="success" variant="outlined" sx={{ fontWeight: 600 }} />
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {(selectedTx.lines || []).length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                                    No line items found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                                <Box display="flex" justifyContent="space-between" mb={0.5}>
                                    <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                                    <Typography variant="body2">₹{parseFloat(selectedTx.subtotal || '0').toFixed(2)}</Typography>
                                </Box>
                                {parseFloat(selectedTx.discount_amount || '0') > 0 && (
                                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                                        <Typography variant="body2" color="error.main">Total Discount</Typography>
                                        <Typography variant="body2" color="error.main">
                                            -₹{parseFloat(selectedTx.discount_amount).toFixed(2)}
                                        </Typography>
                                    </Box>
                                )}
                                <Divider sx={{ my: 1 }} />
                                <Box display="flex" justifyContent="space-between">
                                    <Typography variant="h6" fontWeight={700}>Total Paid</Typography>
                                    <Typography variant="h6" fontWeight={700} color="primary">
                                        ₹{parseFloat(selectedTx.total_amount).toFixed(2)}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                    ) : null}
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => { setTxDetailOpen(false); setSelectedTx(null) }} variant="outlined">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    )
}
