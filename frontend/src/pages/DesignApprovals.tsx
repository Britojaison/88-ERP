import { useEffect, useState } from 'react'
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    CardActions,
    Button,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    CircularProgress,
    Alert,
    Stack,
} from '@mui/material'
import { CheckCircle, Cancel, Schedule, Architecture, ChevronLeft, ChevronRight, CloudUpload } from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import { designApprovalService, DesignApprovalItem } from '../services/inventory.service'

export default function DesignApprovals() {
    const [items, setItems] = useState<DesignApprovalItem[]>([])
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const limit = 50
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [selectedItem, setSelectedItem] = useState<DesignApprovalItem | null>(null)
    const [approvalModalOpen, setApprovalModalOpen] = useState(false)
    const [approvalForm, setApprovalForm] = useState({
        notes: 'Fabric tested and design approved.',
        expectedDays: 14,
    })
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)
    const [attachment, setAttachment] = useState<File | null>(null)

    const fetchPending = async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await designApprovalService.getPendingApprovals(page, limit)
            setItems(data.results || [])
            setTotalPages(Math.ceil((data.count || 0) / limit) || 1)
        } catch (err: any) {
            setError(err.message || 'Failed to fetch pending approvals.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPending()
    }, [page])

    const handleOpenApproval = (item: DesignApprovalItem) => {
        setSelectedItem(item)
        setApprovalForm({
            notes: 'Fabric tested and design approved.',
            expectedDays: 14,
        })
        setAttachment(null)
        setApprovalModalOpen(true)
    }

    const handleApprove = async () => {
        if (!selectedItem) return
        setSubmitting(true)
        try {
            await designApprovalService.approveDesign(
                selectedItem.id,
                approvalForm.notes,
                approvalForm.expectedDays,
                attachment || undefined
            )
            setSuccessMsg('Design successfully approved and sent to production!')
            setApprovalModalOpen(false)
            fetchPending()
        } catch (err: any) {
            setError(err.message || 'Error approving design.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleReject = async (item: DesignApprovalItem) => {
        if (!window.confirm(`Are you sure you want to completely reject the design for ${item.name}? This will mark the SKU as inactive.`)) return

        setSubmitting(true)
        try {
            await designApprovalService.rejectDesign(item.id, 'Design rejected by designer.')
            setSuccessMsg('Design completely rejected and marked inactive.')
            fetchPending()
        } catch (err: any) {
            setError(err.message || 'Error rejecting design.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Box>
            <PageHeader
                title="Designer Workbench"
                subtitle="Review, approve, and send product designs to factory production."
            />

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {successMsg && (
                <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg(null)}>
                    {successMsg}
                </Alert>
            )}

            {loading ? (
                <Box display="flex" justifyContent="center" p={5}>
                    <CircularProgress />
                </Box>
            ) : (
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <Alert severity="info" icon={<Architecture />}>
                            These items are currently in the <strong>Proto / Design</strong> phase. Approve them to officially transition the SKU status to "In Production" and initiate the Product Journey.
                        </Alert>
                    </Grid>

                    {items.length === 0 ? (
                        <Grid item xs={12}>
                            <Box textAlign="center" py={8}>
                                <CheckCircle color="success" sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                                <Typography variant="h6" color="text.secondary">
                                    No Pending Approvals
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    All designs have been sent to production.
                                </Typography>
                                <Button variant="outlined" sx={{ mt: 3 }} onClick={fetchPending}>
                                    Refresh
                                </Button>
                            </Box>
                        </Grid>
                    ) : (
                        items.map((item) => (
                            <Grid item xs={12} sm={6} md={4} key={item.id}>
                                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                    <CardContent sx={{ flexGrow: 1 }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                                            <Chip label="Awaiting Approval" color="warning" size="small" />
                                            <Typography variant="caption" color="text.secondary" display="flex" alignItems="center">
                                                <Schedule fontSize="inherit" sx={{ mr: 0.5 }} /> Proto Stage
                                            </Typography>
                                        </Stack>

                                        <Typography variant="h6" gutterBottom noWrap title={item.name}>
                                            {item.name}
                                        </Typography>

                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            <strong>SKU:</strong> {item.code}
                                        </Typography>

                                        {item.product_name && (
                                            <Typography variant="body2" color="text.secondary">
                                                <strong>Parent:</strong> {item.product_name}
                                            </Typography>
                                        )}
                                    </CardContent>

                                    <CardActions sx={{ p: 2, pt: 0, gap: 1 }}>
                                        <Button
                                            variant="outlined"
                                            color="error"
                                            onClick={() => handleReject(item)}
                                            startIcon={<Cancel />}
                                            sx={{ flex: 1 }}
                                        >
                                            Reject
                                        </Button>
                                        <Button
                                            variant="contained"
                                            onClick={() => handleOpenApproval(item)}
                                            startIcon={<CheckCircle />}
                                            sx={{ flex: 2 }}
                                        >
                                            Review & Approve
                                        </Button>
                                    </CardActions>
                                </Card>
                            </Grid>
                        ))
                    )}

                    {items.length > 0 && totalPages > 1 && (
                        <Grid item xs={12}>
                            <Box display="flex" justifyContent="center" alignItems="center" mt={3} gap={2}>
                                <Button
                                    disabled={page === 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    startIcon={<ChevronLeft />}
                                >
                                    Previous
                                </Button>
                                <Typography variant="body2" color="text.secondary">
                                    Page {page} of {totalPages}
                                </Typography>
                                <Button
                                    disabled={page === totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    endIcon={<ChevronRight />}
                                >
                                    Next
                                </Button>
                            </Box>
                        </Grid>
                    )}
                </Grid>
            )}

            {/* Approval Modal */}
            <Dialog
                open={approvalModalOpen}
                onClose={() => !submitting && setApprovalModalOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Approve Design to Production</DialogTitle>
                <DialogContent dividers>
                    <Box mb={3}>
                        <Typography variant="subtitle2" color="text.secondary">Approving SKU:</Typography>
                        <Typography variant="h6">{selectedItem?.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{selectedItem?.code}</Typography>
                    </Box>

                    <Alert severity="success" sx={{ mb: 3 }}>
                        Approving this design will automatically:
                        <ul>
                            <li>Change the lifecycle status to <strong>In Production</strong></li>
                            <li>Log a "Design Approved" Product Journey checkpoint</li>
                            <li>Create a new "In Production" Product Journey checkpoint</li>
                        </ul>
                    </Alert>

                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Designer Notes"
                                multiline
                                rows={3}
                                value={approvalForm.notes}
                                onChange={(e) => setApprovalForm({ ...approvalForm, notes: e.target.value })}
                                placeholder="e.g. Dimensions confirmed, fabric stretch tested."
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Expected Factory Lead Time (Days)"
                                value={approvalForm.expectedDays}
                                onChange={(e) => setApprovalForm({ ...approvalForm, expectedDays: Number(e.target.value) })}
                                helperText="Estimated days until the factory delivers this to the warehouse."
                                sx={{ mb: 2 }}
                            />

                            <Box>
                                <Typography variant="subtitle2" gutterBottom>
                                    Upload Pattern File / Design Specs (Optional)
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
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setApprovalModalOpen(false)}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleApprove}
                        variant="contained"
                        color="primary"
                        disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={20} /> : <CheckCircle />}
                    >
                        {submitting ? 'Approving...' : 'Approve & Send'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}
