import { useState, useEffect } from 'react'
import {
    Box,
    Typography,
    Card,
    Alert,
    CircularProgress,
    Button,
    TextField,
    Chip,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Checkbox,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TablePagination,
    InputAdornment,
    Autocomplete
} from '@mui/material'
import { CloudUpload, Search, LocalShipping, Add } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { productionKanbanService, ProductionKanbanItem } from '../services/inventory.service'
import { mdmService, SKU } from '../services/mdm.service'

const STAGES = [
    { id: 'in_production', title: 'In Production', color: 'primary' as const },
    { id: 'shoot', title: 'Shoot Status', color: 'error' as const },
    { id: 'received', title: 'Warehouse Received', color: 'info' as const },
    { id: 'quality_check', title: 'Quality Check', color: 'warning' as const },
    { id: 'ready', title: 'Ready for Storage', color: 'success' as const },
]

export default function ProductionKanban() {
    const [items, setItems] = useState<(ProductionKanbanItem & { currentStage: string })[]>([])
    const [filteredItems, setFilteredItems] = useState<(ProductionKanbanItem & { currentStage: string })[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    // Table Pagination
    const [page, setPage] = useState(0)
    const [rowsPerPage, setRowsPerPage] = useState(25)

    // Selection for bulk
    const [selectedIds, setSelectedIds] = useState<string[]>([])

    // Move modal state
    const [modalOpen, setModalOpen] = useState(false)
    const [moving, setMoving] = useState(false)
    const [targetStage, setTargetStage] = useState('')
    const [moveForm, setMoveForm] = useState({
        notes: '',
        measurementValue: '',
        locationId: '',
    })
    const [attachment, setAttachment] = useState<File | null>(null)
    const [locations, setLocations] = useState<any[]>([])

    // "New Batch" modal state
    const [newBatchModalOpen, setNewBatchModalOpen] = useState(false)
    const [skuSearch, setSkuSearch] = useState('')
    const [skuList, setSkuList] = useState<SKU[]>([])
    const [selectedSku, setSelectedSku] = useState<SKU | null>(null)
    const [batchMoving, setBatchMoving] = useState(false)

    // Which items are being moved (could be array of 1 for single row, or many for bulk)
    const [actionItems, setActionItems] = useState<(ProductionKanbanItem & { currentStage: string })[]>([])

    const fetchBoard = async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await productionKanbanService.getBoard()
            let flatList: (ProductionKanbanItem & { currentStage: string })[] = []

            // Flatten board into a list
            Object.keys(data).forEach(colId => {
                data[colId].forEach((item: ProductionKanbanItem) => {
                    flatList.push({ ...item, currentStage: colId })
                })
            })

            setItems(flatList)
            setFilteredItems(flatList)

            const locData = await productionKanbanService.getLocations()
            setLocations(locData || [])
        } catch (err: any) {
            setError(err.message || 'Failed to fetch Production items')
        } finally {
            setLoading(false)
            setSelectedIds([])
        }
    }

    useEffect(() => {
        fetchBoard()
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => {
            if (newBatchModalOpen) {
                mdmService.getSKUs({ search: skuSearch }).then(res => {
                    const skus = Array.isArray(res) ? res : (res as any).results
                    setSkuList(skus || [])
                }).catch(() => { })
            }
        }, 500)
        return () => clearTimeout(timer)
    }, [skuSearch, newBatchModalOpen])

    useEffect(() => {
        let results = items
        if (searchQuery) {
            const lowerq = searchQuery.toLowerCase()
            results = items.filter(i =>
                i.code.toLowerCase().includes(lowerq) ||
                i.name.toLowerCase().includes(lowerq)
            )
        }
        setFilteredItems(results)
        setPage(0)
    }, [searchQuery, items])

    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            setSelectedIds(filteredItems.map(i => i.id))
            return
        }
        setSelectedIds([])
    }

    const handleSelectOne = (id: string) => {
        const selectedIndex = selectedIds.indexOf(id)
        let newSelected: string[] = []

        if (selectedIndex === -1) {
            newSelected = newSelected.concat(selectedIds, id)
        } else if (selectedIndex === 0) {
            newSelected = newSelected.concat(selectedIds.slice(1))
        } else if (selectedIndex === selectedIds.length - 1) {
            newSelected = newSelected.concat(selectedIds.slice(0, -1))
        } else if (selectedIndex > 0) {
            newSelected = newSelected.concat(
                selectedIds.slice(0, selectedIndex),
                selectedIds.slice(selectedIndex + 1)
            )
        }
        setSelectedIds(newSelected)
    }

    const openMoveModal = (itemsToMove: (ProductionKanbanItem & { currentStage: string })[]) => {
        setActionItems(itemsToMove)
        setTargetStage('')
        setMoveForm({
            notes: '',
            measurementValue: '',
            locationId: '',
        })
        setAttachment(null)
        setModalOpen(true)
    }

    const confirmMove = async () => {
        if (actionItems.length === 0 || !targetStage) return
        setMoving(true)
        try {
            // Bulk update sequentially to avoid overpowering backend/rate limits
            for (const item of actionItems) {
                await productionKanbanService.moveItem(
                    item.id,
                    targetStage,
                    moveForm.notes || `Moved to ${STAGES.find(c => c.id === targetStage)?.title}`,
                    moveForm.measurementValue || undefined,
                    attachment || undefined,
                    moveForm.locationId || undefined
                )
            }
            setModalOpen(false)
            fetchBoard()
        } catch (err: any) {
            alert(err.message || 'Error moving item(s)')
        } finally {
            setMoving(false)
        }
    }

    const confirmNewBatch = async () => {
        if (!selectedSku) return
        setBatchMoving(true)
        try {
            await productionKanbanService.moveItem(
                selectedSku.id,
                'in_production',
                `Started new production batch for ${selectedSku.code}`,
            )
            setNewBatchModalOpen(false)
            setSelectedSku(null)
            fetchBoard()
        } catch (err: any) {
            alert(err.message || 'Error creating new batch')
        } finally {
            setBatchMoving(false)
        }
    }

    const displayedRows = filteredItems.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <PageHeader
                title="Production Tracker"
                subtitle="Track manufacturing WIP (Work in Progress). Scalable bulk-updates for advancing products through stages."
            />

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                <TextField
                    size="small"
                    placeholder="Search SKU or Name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    sx={{ width: 300, bgcolor: 'background.paper', borderRadius: 1 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Search />
                            </InputAdornment>
                        ),
                    }}
                />

                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        onClick={() => setNewBatchModalOpen(true)}
                        startIcon={<Add />}
                    >
                        New Production Batch
                    </Button>
                    <Button
                        variant="contained"
                        disabled={selectedIds.length === 0}
                        onClick={() => {
                            const selected = filteredItems.filter(i => selectedIds.includes(i.id))
                            openMoveModal(selected)
                        }}
                        startIcon={<LocalShipping />}
                    >
                        Bulk Update Status ({selectedIds.length})
                    </Button>
                </Box>
            </Box>

            <Card>
                <TableContainer>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        color="primary"
                                        indeterminate={selectedIds.length > 0 && selectedIds.length < filteredItems.length}
                                        checked={filteredItems.length > 0 && selectedIds.length === filteredItems.length}
                                        onChange={handleSelectAll}
                                    />
                                </TableCell>
                                <TableCell><strong>SKU</strong></TableCell>
                                <TableCell><strong>Product Name</strong></TableCell>
                                <TableCell><strong>Current Stage</strong></TableCell>
                                <TableCell><strong>Last updated by</strong></TableCell>
                                <TableCell align="right"><strong>Action</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                                        <CircularProgress />
                                    </TableCell>
                                </TableRow>
                            ) : displayedRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                                        <Typography color="text.secondary">No products currently in production.</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                displayedRows.map((item) => {
                                    const isItemSelected = selectedIds.indexOf(item.id) !== -1;
                                    const stageConf = STAGES.find(s => s.id === item.currentStage)

                                    return (
                                        <TableRow
                                            key={item.id}
                                            hover
                                            selected={isItemSelected}
                                        >
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    color="primary"
                                                    checked={isItemSelected}
                                                    onChange={() => handleSelectOne(item.id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">{item.code}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">{item.name}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    label={stageConf ? stageConf.title : item.currentStage}
                                                    color={stageConf ? stageConf.color : 'default'}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="text.secondary">
                                                    System Admin
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => openMoveModal([item])}
                                                >
                                                    Update
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    rowsPerPageOptions={[25, 50, 100, 200]}
                    component="div"
                    count={filteredItems.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10))
                        setPage(0)
                    }}
                />
            </Card>


            {/* Move / Action Modal */}
            <Dialog open={modalOpen} onClose={() => !moving && setModalOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {actionItems.length > 1
                        ? `Bulk Update (${actionItems.length} SKUs)`
                        : `Update Status: ${actionItems[0]?.code}`}
                </DialogTitle>
                <DialogContent dividers>
                    <Box mt={1}>
                        <TextField
                            select
                            fullWidth
                            label="Move to New Stage"
                            value={targetStage}
                            onChange={(e) => setTargetStage(e.target.value)}
                            sx={{ mb: 3 }}
                        >
                            <MenuItem value="" disabled>Select the next stage...</MenuItem>
                            {STAGES.map(stage => (
                                <MenuItem key={stage.id} value={stage.id}>
                                    {stage.title}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            fullWidth
                            label="Action Notes (Optional)"
                            multiline
                            rows={2}
                            value={moveForm.notes}
                            onChange={(e) => setMoveForm({ ...moveForm, notes: e.target.value })}
                            sx={{ mb: 2 }}
                            placeholder={targetStage ? `e.g. Products completed ${STAGES.find(s => s.id === targetStage)?.title} successfully.` : ''}
                        />

                        {targetStage === 'in_production' && (
                            <TextField
                                fullWidth
                                label="Fabric Used (Meters/Kg)"
                                type="number"
                                value={moveForm.measurementValue}
                                onChange={(e) => setMoveForm({ ...moveForm, measurementValue: e.target.value })}
                                sx={{ mb: 2 }}
                                helperText="How much material was used for this production batch? (Optional)"
                            />
                        )}

                        {targetStage === 'in_production' && locations.length > 0 && (
                            <TextField
                                select
                                fullWidth
                                label="Select Production Unit"
                                value={moveForm.locationId}
                                onChange={(e) => setMoveForm({ ...moveForm, locationId: e.target.value })}
                                sx={{ mb: 2 }}
                                helperText="Which unit is this being produced at? (Optional)"
                            >
                                <MenuItem value=""><em>None / Unknown</em></MenuItem>
                                {locations.map(loc => (
                                    <MenuItem key={loc.id} value={loc.id}>
                                        {loc.name} ({loc.code})
                                    </MenuItem>
                                ))}
                            </TextField>
                        )}

                        {actionItems.length === 1 && (
                            <Box>
                                <Typography variant="subtitle2" gutterBottom>
                                    Upload Document or Photo (Optional)
                                </Typography>
                                <Button
                                    variant="outlined"
                                    component="label"
                                    startIcon={<CloudUpload />}
                                    fullWidth
                                >
                                    {attachment ? attachment.name : 'Choose File'}
                                    <input
                                        type="file"
                                        hidden
                                        onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                                    />
                                </Button>
                            </Box>
                        )}
                        {actionItems.length > 1 && (
                            <Typography variant="body2" color="warning.main">
                                * File uploads are disabled for bulk updates.
                            </Typography>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setModalOpen(false)} disabled={moving}>Cancel</Button>
                    <Button onClick={confirmMove} variant="contained" disabled={moving || !targetStage}>
                        {moving ? 'Processing...' : 'Confirm Update'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* New Batch Modal */}
            <Dialog open={newBatchModalOpen} onClose={() => !batchMoving && setNewBatchModalOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Start Production Batch (Existing SKU)</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Select an existing SKU to move it completely back into "In Production". This is used when you are manufacturing older products again and want to track their WIP progress before receipt.
                    </Typography>

                    <Autocomplete
                        options={skuList}
                        getOptionLabel={(option) => `${option.code} - ${option.name}${option.size ? ` (${option.size})` : ''}`}
                        value={selectedSku}
                        onInputChange={(_, value) => setSkuSearch(value)}
                        onChange={(_event, newValue) => setSelectedSku(newValue)}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Search SKU *"
                                required
                                placeholder="Type to search SKU..."
                            />
                        )}
                        renderOption={(props, option) => (
                            <li {...props} key={option.id}>
                                <Box>
                                    <Typography variant="body2" fontWeight={500}>{option.code}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {option.name} • ₹{option.base_price} {option.lifecycle_status === 'active' ? ' (Active)' : ''}
                                    </Typography>
                                </Box>
                            </li>
                        )}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        noOptionsText="No SKUs available"
                        fullWidth
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNewBatchModalOpen(false)} disabled={batchMoving}>Cancel</Button>
                    <Button onClick={confirmNewBatch} variant="contained" disabled={batchMoving || !selectedSku}>
                        {batchMoving ? 'Starting...' : 'Start Manufacturing'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}
