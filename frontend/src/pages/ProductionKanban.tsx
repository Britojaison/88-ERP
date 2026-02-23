import { useState, useEffect, DragEvent } from 'react'
import {
    Box,
    Typography,
    Card,
    CardContent,
    Alert,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Chip,
    IconButton,
    Tooltip,
    MenuItem
} from '@mui/material'
import { CloudUpload, Link as LinkIcon } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { productionKanbanService, ProductionKanbanItem } from '../services/inventory.service'

const COLUMNS = [
    { id: 'fabric_sourced', title: 'Fabric Sourced', color: 'info' as const },
    { id: 'fabric_dispatched', title: 'Dispatched to Unit', color: 'secondary' as const },
    { id: 'design_approved', title: 'Design Approved', color: 'warning' as const },
    { id: 'in_production', title: 'In Production', color: 'primary' as const },
    { id: 'shoot', title: 'Shoot Status', color: 'error' as const },
    { id: 'received', title: 'Warehouse Received', color: 'info' as const },
    { id: 'quality_check', title: 'Quality Check', color: 'warning' as const },
    { id: 'ready', title: 'Ready for Storage', color: 'success' as const },
]

export default function ProductionKanban() {
    const [boardData, setBoardData] = useState<Record<string, ProductionKanbanItem[]>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [modalOpen, setModalOpen] = useState(false)
    const [targetStage, setTargetStage] = useState('')
    const [activeItem, setActiveItem] = useState<ProductionKanbanItem | null>(null)

    const [moveForm, setMoveForm] = useState({
        notes: '',
        measurementValue: '',
        locationId: '',
    })
    const [attachment, setAttachment] = useState<File | null>(null)
    const [moving, setMoving] = useState(false)
    const [locations, setLocations] = useState<any[]>([])

    const fetchBoard = async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await productionKanbanService.getBoard()
            setBoardData(data || {})
            const locData = await productionKanbanService.getLocations()
            setLocations(locData || [])
        } catch (err: any) {
            setError(err.message || 'Failed to fetch Kanban board')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchBoard()
    }, [])

    const handleDragStart = (e: DragEvent<HTMLDivElement>, item: ProductionKanbanItem, sourceCol: string) => {
        e.dataTransfer.setData('itemId', item.id)
        e.dataTransfer.setData('sourceCol', sourceCol)
    }

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault() // Necessary to allow dropping
    }

    const handleDrop = (e: DragEvent<HTMLDivElement>, targetCol: string) => {
        e.preventDefault()
        const itemId = e.dataTransfer.getData('itemId')
        const sourceCol = e.dataTransfer.getData('sourceCol')

        if (sourceCol === targetCol || !itemId) return

        // Find the item
        const item = boardData[sourceCol]?.find(i => i.id === itemId)
        if (!item) return

        // Open confirmation modal to ask for notes/files
        setActiveItem(item)
        setTargetStage(targetCol)
        setMoveForm({
            notes: `Moved to ${COLUMNS.find(c => c.id === targetCol)?.title}`,
            measurementValue: '',
            locationId: ''
        })
        setAttachment(null)
        setModalOpen(true)
    }

    const confirmMove = async () => {
        if (!activeItem || !targetStage) return
        setMoving(true)
        try {
            await productionKanbanService.moveItem(
                activeItem.id,
                targetStage,
                moveForm.notes,
                moveForm.measurementValue || undefined,
                attachment || undefined,
                moveForm.locationId || undefined
            )
            setModalOpen(false)
            fetchBoard()
        } catch (err: any) {
            alert(err.message || 'Error moving item')
        } finally {
            setMoving(false)
        }
    }

    return (
        <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <PageHeader
                title="Production Kanban"
                subtitle="Drag and Drop products through the manufacturing lifecycle, track fabric dispatches, and shoot status."
            />

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
                <Box display="flex" justifyContent="center" p={5}><CircularProgress /></Box>
            ) : (
                <Box sx={{ flexGrow: 1, display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
                    {COLUMNS.map(col => (
                        <Box
                            key={col.id}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                            sx={{
                                minWidth: 300,
                                width: 300,
                                bgcolor: 'background.default',
                                borderRadius: 2,
                                p: 2,
                                display: 'flex',
                                flexDirection: 'column',
                                border: '1px solid',
                                borderColor: 'divider',
                            }}
                        >
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip size="small" label={(boardData[col.id] || []).length} color={col.color} />
                                {col.title}
                            </Typography>

                            <Box sx={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {(boardData[col.id] || []).map(item => (
                                    <Card
                                        key={item.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item, col.id)}
                                        sx={{
                                            cursor: 'grab',
                                            '&:active': { cursor: 'grabbing' },
                                            borderLeft: '4px solid',
                                            borderLeftColor: `${col.color}.main`,
                                            boxShadow: 1
                                        }}
                                    >
                                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                {item.code}
                                            </Typography>
                                            <Typography variant="subtitle2" fontWeight="bold">
                                                {item.name}
                                            </Typography>

                                            {item.measurement_value && (
                                                <Typography variant="caption" display="block" color="text.secondary" mt={1}>
                                                    Fabric: {item.measurement_value} {item.measurement_unit}
                                                </Typography>
                                            )}

                                            {item.attachment_url && (
                                                <Tooltip title="View Attachment / Pattern">
                                                    <IconButton component="a" href={item.attachment_url} target="_blank" size="small" sx={{ mt: 1, ml: -1 }}>
                                                        <LinkIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </Box>
                        </Box>
                    ))}
                </Box>
            )}

            {/* Move / Action Modal */}
            <Dialog open={modalOpen} onClose={() => !moving && setModalOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Update Status: {activeItem?.name}</DialogTitle>
                <DialogContent dividers>
                    <Typography gutterBottom>
                        Moving to <strong>{COLUMNS.find(c => c.id === targetStage)?.title}</strong>
                    </Typography>

                    <Box mt={2}>
                        <TextField
                            fullWidth
                            label="Action Notes"
                            multiline
                            rows={2}
                            value={moveForm.notes}
                            onChange={(e) => setMoveForm({ ...moveForm, notes: e.target.value })}
                            sx={{ mb: 2 }}
                        />

                        {(targetStage === 'fabric_dispatched' || targetStage === 'in_production') && (
                            <TextField
                                fullWidth
                                label="Fabric Measurement (Meters)"
                                type="number"
                                value={moveForm.measurementValue}
                                onChange={(e) => setMoveForm({ ...moveForm, measurementValue: e.target.value })}
                                sx={{ mb: 2 }}
                                helperText="How many meters of fabric are being dispatched or used?"
                            />
                        )}

                        {(targetStage === 'fabric_dispatched' || targetStage === 'in_production') && locations.length > 0 && (
                            <TextField
                                select
                                fullWidth
                                label="Select Production Unit"
                                value={moveForm.locationId}
                                onChange={(e) => setMoveForm({ ...moveForm, locationId: e.target.value })}
                                sx={{ mb: 2 }}
                                helperText="Which unit is the fabric going to or currently at?"
                            >
                                <MenuItem value=""><em>None / Unknown</em></MenuItem>
                                {locations.map(loc => (
                                    <MenuItem key={loc.id} value={loc.id}>
                                        {loc.name} ({loc.code})
                                    </MenuItem>
                                ))}
                            </TextField>
                        )}

                        <Box>
                            <Typography variant="subtitle2" gutterBottom>
                                Upload Pattern, Photo, or Document (Optional)
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
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setModalOpen(false)} disabled={moving}>Cancel</Button>
                    <Button onClick={confirmMove} variant="contained" disabled={moving}>
                        {moving ? 'Saving...' : 'Confirm Action'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}
