import { useEffect, useRef, useState, useCallback } from 'react'
import { qty } from '../utils'
import {
    Box,
    Chip,
    Grid,
    Paper,
    Stack,
    Typography,
    CircularProgress,
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
    Button,
    ToggleButtonGroup,
    ToggleButton,
    IconButton,
    Tooltip
} from '@mui/material'
import { useReactToPrint } from 'react-to-print'
import {
    Warehouse as WarehouseIcon,
    Inventory2,
    Email,
    Badge,
    History,
    ReceiptLong,
    Search as SearchIcon,
    LocalPrintshop
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { mdmService, Location } from '../services/mdm.service'
import { inventoryService, InventoryBalance, GoodsReceiptScanLog } from '../services/inventory.service'
import { shopifyService, ShopifyCollection } from '../services/shopify.service'
import { FilterList } from '@mui/icons-material'

export default function Warehouse() {
    const [warehouses, setWarehouses] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedWarehouse, setSelectedWarehouse] = useState<Location | null>(null)
    const [balances, setBalances] = useState<InventoryBalance[]>([])
    const [fetchingBalances, setFetchingBalances] = useState(false)
    const [scanLogs, setScanLogs] = useState<GoodsReceiptScanLog[]>([])
    const [fetchingLogs, setFetchingLogs] = useState(false)
    const [tabValue, setTabValue] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [totalCount, setTotalCount] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [hasNextPage, setHasNextPage] = useState(false)
    const [hasPrevPage, setHasPrevPage] = useState(false)
    const [summary, setSummary] = useState<{ total_skus: number; total_units: number; zero_stock: number }>({ total_skus: 0, total_units: 0, zero_stock: 0 })

    const [collections, setCollections] = useState<ShopifyCollection[]>([])
    const [selectedCollection, setSelectedCollection] = useState<ShopifyCollection | null>(null)
    const [ordering, setOrdering] = useState<string>('-updated_at')

    const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all')

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
        const fetchCollections = async () => {
            try {
                const data = await shopifyService.listCollections()
                setCollections(data || [])
            } catch (error) {
                console.error('Error fetching collections:', error)
            }
        }
        fetchWarehouses()
        fetchCollections()
    }, [])

    const fetchBalances = useCallback(async (locationId: string, search?: string, filter?: string, page?: number, collectionId?: string, order?: string) => {
        setFetchingBalances(true)
        try {
            const params: any = { location: locationId }
            if (search?.trim()) {
                params.search = search.trim()
            }
            if (filter && filter !== 'all') {
                params.stock_filter = filter
            }
            if (page && page > 1) {
                params.page = page
            }
            if (collectionId) {
                params.shopify_collection = collectionId
            }
            if (order) {
                params.ordering = order
            }
            const data = await inventoryService.getBalances(params) as any
            if (data && data.results) {
                setBalances(data.results)
                setTotalCount(data.count || 0)
                setHasNextPage(!!data.next)
                setHasPrevPage(!!data.previous)
            } else {
                setBalances(Array.isArray(data) ? data : [])
                setTotalCount(Array.isArray(data) ? data.length : 0)
                setHasNextPage(false)
                setHasPrevPage(false)
            }
        } catch (error) {
            console.error('Error fetching balances:', error)
            setBalances([])
            setTotalCount(0)
            setHasNextPage(false)
            setHasPrevPage(false)
        } finally {
            setFetchingBalances(false)
        }
    }, [])

    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Warehouse-Inventory-${selectedWarehouse?.name || 'Report'}`
    })

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
                const [, logData] = await Promise.all([
                    fetchBalances(selectedWarehouse.id, '', stockFilter, 1, selectedCollection?.id, ordering),
                    inventoryService.getGoodsReceiptScans({ location: selectedWarehouse.id })
                ])

                // Fetch aggregate summary separately (not affected by pagination)
                try {
                    const summaryData = await inventoryService.getBalanceSummary(selectedWarehouse.id)
                    setSummary(summaryData)
                } catch { setSummary({ total_skus: 0, total_units: 0, zero_stock: 0 }) }

                setScanLogs(Array.isArray(logData) ? logData : (logData as any).results || [])
            } catch (error) {
                console.error('Error fetching warehouse data:', error)
                setScanLogs([])
            } finally {
                setFetchingLogs(false)
            }
        }
        setSearchQuery('')
        setCurrentPage(1)
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedWarehouse])

    const handleSearch = (value: string) => {
        setSearchQuery(value)
        setCurrentPage(1)
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
        if (!selectedWarehouse) return
        searchTimerRef.current = setTimeout(() => {
            fetchBalances(selectedWarehouse.id, value, stockFilter, 1, selectedCollection?.id, ordering)
        }, 400)
    }

    const handleFilterChange = (_: any, newFilter: string | null) => {
        if (!newFilter) return
        setStockFilter(newFilter as any)
        setCurrentPage(1)
        if (!selectedWarehouse) return
        fetchBalances(selectedWarehouse.id, searchQuery, newFilter, 1, selectedCollection?.id, ordering)
    }

    const handleCollectionChange = (_: any, newValue: ShopifyCollection | null) => {
        setSelectedCollection(newValue)
        setCurrentPage(1)
        if (!selectedWarehouse) return
        fetchBalances(selectedWarehouse.id, searchQuery, stockFilter, 1, newValue?.id, ordering)
    }

    const toggleOrdering = (field: string) => {
        const newOrder = ordering === field ? `-${field}` : field
        setOrdering(newOrder)
        setCurrentPage(1)
        if (!selectedWarehouse) return
        fetchBalances(selectedWarehouse.id, searchQuery, stockFilter, 1, selectedCollection?.id, newOrder)
    }

    const handlePageChange = (newPage: number) => {
        if (!selectedWarehouse) return
        setCurrentPage(newPage)
        fetchBalances(selectedWarehouse.id, searchQuery, stockFilter, newPage, selectedCollection?.id, ordering)
    }

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
                                            {summary.total_skus}
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
                                            {summary.total_units}
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
                                            {summary.zero_stock}
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
                                <Box display="flex" alignItems="center" gap={2}>
                                    <ToggleButtonGroup
                                        size="small"
                                        value={stockFilter}
                                        exclusive
                                        onChange={handleFilterChange}
                                        sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, px: 2, height: 36 } }}
                                    >
                                        <ToggleButton value="all">All Items</ToggleButton>
                                        <ToggleButton value="in_stock" color="success">In Stock</ToggleButton>
                                        <ToggleButton value="out_of_stock" color="error">Out of Stock</ToggleButton>
                                    </ToggleButtonGroup>

                                    <Autocomplete
                                        size="small"
                                        options={collections}
                                        getOptionLabel={(option) => option.title}
                                        value={selectedCollection}
                                        onChange={handleCollectionChange}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                placeholder="Collection filter..."
                                                variant="outlined"
                                                InputProps={{
                                                    ...params.InputProps,
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <FilterList sx={{ fontSize: 18, color: 'text.disabled' }} />
                                                        </InputAdornment>
                                                    ),
                                                    sx: { borderRadius: 2, bgcolor: 'white', fontSize: '0.875rem' }
                                                }}
                                            />
                                        )}
                                        sx={{ width: 220 }}
                                    />

                                    <TextField
                                        size="small"
                                        placeholder="Search SKU..."
                                        value={searchQuery}
                                        onChange={(e) => handleSearch(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                                                </InputAdornment>
                                            ),
                                            sx: { borderRadius: 2, bgcolor: 'white', fontSize: '0.875rem', height: 36 }
                                        }}
                                        sx={{ width: 280 }}
                                    />

                                    <Tooltip title="Print Filtered View">
                                        <IconButton
                                            color="primary"
                                            onClick={() => handlePrint()}
                                            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, height: 36, width: 36, bgcolor: 'white' }}
                                            disabled={fetchingBalances || balances.length === 0}
                                        >
                                            <LocalPrintshop fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
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
                                                {searchQuery ? 'No items match your search.' : 'No inventory records found for this warehouse.'}
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <>
                                            <TableContainer>
                                                <Table>
                                                    <TableHead sx={{ bgcolor: 'rgba(248, 250, 252, 0.8)' }}>
                                                        <TableRow>
                                                            <TableCell sx={{ fontWeight: 800 }}>SKU Code</TableCell>
                                                            <TableCell sx={{ fontWeight: 800 }}>Product Name</TableCell>
                                                            <TableCell 
                                                                sx={{ fontWeight: 800, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                                                                onClick={() => toggleOrdering('collection')}
                                                            >
                                                                Collection {ordering.includes('collection') && (ordering.startsWith('-') ? '↓' : '↑')}
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 800 }}>Variant</TableCell>
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
                                                                    {row.sku_code || '—'}
                                                                </TableCell>
                                                                <TableCell sx={{ fontWeight: 600 }}>
                                                                    {(row as any).product_name || row.sku_name || '—'}
                                                                </TableCell>
                                                                <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                                                                    {row.shopify_collection_name || '—'}
                                                                </TableCell>
                                                                <TableCell sx={{ color: '#475569', fontSize: '0.85rem' }}>
                                                                    {row.sku_name || '—'}
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
                                                                    {qty(row.quantity_on_hand)}
                                                                </TableCell>
                                                                <TableCell align="right" sx={{ fontWeight: 800, color: parseInt(row.quantity_available) > 0 ? 'inherit' : 'error.main' }}>
                                                                    {qty(row.quantity_available)}
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
                                            {/* Pagination Controls */}
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderTop: '1px solid rgba(15,23,42,0.06)' }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Showing {balances.length} of {totalCount} items (Page {currentPage})
                                                </Typography>
                                                <Stack direction="row" spacing={1}>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        disabled={!hasPrevPage || fetchingBalances}
                                                        onClick={() => handlePageChange(currentPage - 1)}
                                                    >
                                                        Previous
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        disabled={!hasNextPage || fetchingBalances}
                                                        onClick={() => handlePageChange(currentPage + 1)}
                                                    >
                                                        Next
                                                    </Button>
                                                </Stack>
                                            </Box>
                                        </>
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
            )
            }

            {/* Hidden Printable Area */}
            <div style={{ display: 'none' }}>
                <div ref={printRef} style={{ padding: '40px', fontFamily: 'sans-serif' }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: '#0f6d6a' }}>
                        {selectedWarehouse?.name} - Inventory Report
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        <strong>Generated:</strong> {new Date().toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        <strong>Filter:</strong> {stockFilter.replace('_', ' ').toUpperCase()} | <strong>Search:</strong> {searchQuery ? `"${searchQuery}"` : 'None'}
                    </Typography>

                    <Table size="small" sx={{ width: '100%', '& th': { fontWeight: 'bold', borderBottom: '2px solid #000' }, '& td': { borderBottom: '1px solid #ddd' } }}>
                        <TableHead>
                            <TableRow>
                                <TableCell>SKU Code</TableCell>
                                <TableCell>Product Name</TableCell>
                                <TableCell>Variant</TableCell>
                                <TableCell align="right">On Hand</TableCell>
                                <TableCell align="right">Available</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {balances.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell>{row.sku_code || '—'}</TableCell>
                                    <TableCell>{(row as any).product_name || row.sku_name || '—'}</TableCell>
                                    <TableCell>{row.sku_name || '—'}</TableCell>
                                    <TableCell align="right">{qty(row.quantity_on_hand)}</TableCell>
                                    <TableCell align="right">{qty(row.quantity_available)}</TableCell>
                                </TableRow>
                            ))}
                            {balances.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 3, fontStyle: 'italic' }}>No records to print.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <Typography variant="caption" sx={{ display: 'block', mt: 4, textAlign: 'center', color: 'text.secondary' }}>
                        End of Report - Page {currentPage} of {Math.ceil(totalCount / 50)}
                    </Typography>
                </div>
            </div>
        </Box >
    )
}
