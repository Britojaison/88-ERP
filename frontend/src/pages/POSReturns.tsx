import { useState } from 'react'
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
    Alert,
    CircularProgress,
    Chip,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    ToggleButtonGroup,
    ToggleButton
} from '@mui/material'

import { useEffect, useMemo } from 'react'

export default function POSReturns() {
    const [transactionNumber, setTransactionNumber] = useState('')
    const [transaction, setTransaction] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const [returnItems, setReturnItems] = useState<any[]>([])
    const [records, setRecords] = useState<any[]>([])
    const [recordFilter, setRecordFilter] = useState<'all' | 'sellable' | 'damaged'>('all')

    const token = localStorage.getItem('token')
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }

    const fetchRecords = async () => {
        try {
            const res = await fetch(`http://localhost:8000/api/sales/returns/records/`, { headers })
            if (res.ok) {
                const data = await res.json()
                setRecords(data)
            }
        } catch (err) {
            console.error('Failed to fetch return records', err)
        }
    }

    useEffect(() => {
        fetchRecords()
    }, [])

    const filteredRecords = useMemo(() => {
        if (recordFilter === 'all') return records
        return records.filter(r => r.condition === recordFilter)
    }, [records, recordFilter])

    const handleSearch = async () => {
        if (!transactionNumber) return
        setLoading(true)
        setError('')
        setSuccess('')
        setTransaction(null)
        setReturnItems([])

        try {
            const res = await fetch(`http://localhost:8000/api/sales/transactions/?transaction_number=${transactionNumber}`, {
                headers
            })
            if (!res.ok) throw new Error('Failed to fetch transaction')
            const data = await res.json()

            if (data.results && data.results.length > 0) {
                setTransaction(data.results[0])
            } else {
                setError('Transaction not found. Check the receipt number.')
            }
        } catch (err: any) {
            setError(err.message || 'Error occurred')
        } finally {
            setLoading(false)
        }
    }

    const toggleItemForReturn = (line: any) => {
        if (line.is_returned) return

        setReturnItems(prev => {
            const exists = prev.find(i => i.line_id === line.id)
            if (exists) {
                return prev.filter(i => i.line_id !== line.id)
            } else {
                return [...prev, {
                    line_id: line.id,
                    sku: line.sku_name || 'Item',
                    total: Number(line.line_total),
                    return_reason: 'Customer changed mind',
                    condition: 'sellable'
                }]
            }
        })
    }

    const updateReturnItem = (lineId: number, field: string, value: string) => {
        setReturnItems(prev =>
            prev.map(i => {
                if (i.line_id === lineId) {
                    const updated = { ...i, [field]: value }
                    if (field === 'return_reason') {
                        updated.condition = (value === 'Damaged / Defective') ? 'damaged' : 'sellable'
                    }
                    return updated
                }
                return i
            })
        )
    }

    const handleProcessReturn = async () => {
        if (returnItems.length === 0) {
            setError('Please select at least one item to return')
            return
        }

        setLoading(true)
        setError('')
        try {
            const payload = {
                store_id: transaction.store, // we need store_id
                original_transaction_id: transaction.id,
                return_type: 'refund',
                items: returnItems
            }

            const res = await fetch(`http://localhost:8000/api/sales/returns/process/`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to process return')
            }

            setSuccess(`Return processed successfully! Refund Amount: ₹${data.refund_amount} | Ref: ${data.return_number}`)
            setTransaction(null)
            setReturnItems([])
            setTransactionNumber('')

            // Refresh the records
            fetchRecords()
        } catch (err: any) {
            setError(err.message || 'Error processing return')
        } finally {
            setLoading(false)
        }
    }

    const totalRefundAmount = returnItems.reduce((acc, curr) => acc + curr.total, 0)

    return (
        <Box>
            <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>POS Returns</Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
                Process refunds and return items to inventory automatically.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

            <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2 }}>Lookup Transaction</Typography>
                            <TextField
                                fullWidth
                                label="Receipt Number (e.g., POS-A1B2C3D4)"
                                value={transactionNumber}
                                onChange={e => setTransactionNumber(e.target.value)}
                                sx={{ mb: 2 }}
                                onKeyPress={e => e.key === 'Enter' && handleSearch()}
                            />
                            <Button
                                variant="contained"
                                fullWidth
                                onClick={handleSearch}
                                disabled={loading || !transactionNumber}
                            >
                                {loading ? <CircularProgress size={24} /> : 'Search Order'}
                            </Button>
                        </CardContent>
                    </Card>

                    {returnItems.length > 0 && (
                        <Card sx={{ mt: 3, bgcolor: '#fdfbf7', border: '1px solid #e0dcd3' }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ mb: 2 }}>Refund Summary</Typography>
                                <List disablePadding>
                                    {returnItems.map(item => (
                                        <ListItem key={item.line_id} sx={{ py: 1, px: 0 }}>
                                            <ListItemText
                                                primary={item.sku}
                                                secondary={`Reason: ${item.return_reason} | Cond: ${item.condition}`}
                                            />
                                            <Typography fontWeight={600}>₹{item.total.toFixed(2)}</Typography>
                                        </ListItem>
                                    ))}
                                    <Divider sx={{ my: 1 }} />
                                    <ListItem sx={{ py: 1, px: 0 }}>
                                        <ListItemText primary={<Typography fontWeight={700}>Total Refund</Typography>} />
                                        <Typography variant="h6" color="primary.main" fontWeight={700}>₹{totalRefundAmount.toFixed(2)}</Typography>
                                    </ListItem>
                                </List>
                                <Button
                                    variant="contained"
                                    color="error"
                                    fullWidth
                                    sx={{ mt: 2 }}
                                    onClick={handleProcessReturn}
                                    disabled={loading}
                                >
                                    Process Refund
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                </Grid>

                <Grid item xs={12} md={8}>
                    {transaction ? (
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h5">Order {transaction.transaction_number}</Typography>
                                    <Chip label={`Date: ${new Date(transaction.transaction_date).toLocaleDateString()}`} />
                                </Box>
                                <Divider sx={{ mb: 2 }} />

                                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Select Items to Return</Typography>

                                <List>
                                    {transaction.lines.map((line: any) => {
                                        const isSelected = returnItems.some(i => i.line_id === line.id)
                                        const returnedAlready = line.is_returned

                                        return (
                                            <Box key={line.id} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: isSelected ? 'error.main' : 'divider', borderRadius: 2, bgcolor: isSelected ? '#fff5f5' : returnedAlready ? '#f5f5f5' : 'white' }}>
                                                <Grid container spacing={2} alignItems="center">
                                                    <Grid item xs={12} sm={4}>
                                                        <Typography fontWeight={600}>{line.sku_name || 'Product'} (Qty: {line.quantity})</Typography>
                                                        <Typography variant="body2" color="text.secondary">Code: {line.sku_code || line.sku}</Typography>
                                                        <Typography variant="body2" color="text.secondary">Paid: ₹{line.line_total}</Typography>
                                                        {returnedAlready && <Chip size="small" label="Already Returned" color="warning" sx={{ mt: 1 }} />}
                                                    </Grid>

                                                    <Grid item xs={12} sm={6}>
                                                        {isSelected && !returnedAlready && (
                                                            <Grid container spacing={1}>
                                                                <Grid item xs={12}>
                                                                    <TextField
                                                                        select
                                                                        fullWidth
                                                                        size="small"
                                                                        label="Reason for Return"
                                                                        value={returnItems.find(i => i.line_id === line.id)?.return_reason || ''}
                                                                        onChange={(e) => updateReturnItem(line.id, 'return_reason', e.target.value)}
                                                                    >
                                                                        <MenuItem value="Customer changed mind">Customer changed mind</MenuItem>
                                                                        <MenuItem value="Wrong size">Wrong size</MenuItem>
                                                                        <MenuItem value="Wrong product">Wrong product</MenuItem>
                                                                        <MenuItem value="Damaged / Defective">Damaged / Defective (No Restock)</MenuItem>
                                                                        <MenuItem value="Gift Return">Gift Return</MenuItem>
                                                                        <MenuItem value="Not as Pictured">Not as Pictured</MenuItem>
                                                                        <MenuItem value="Arrived Late">Arrived Late</MenuItem>
                                                                        <MenuItem value="Better price elsewhere">Better price elsewhere</MenuItem>
                                                                        <MenuItem value="Other">Other</MenuItem>
                                                                    </TextField>
                                                                </Grid>
                                                            </Grid>
                                                        )}
                                                    </Grid>

                                                    <Grid item xs={12} sm={2} sx={{ textAlign: 'right' }}>
                                                        <Button
                                                            variant={isSelected ? "outlined" : "contained"}
                                                            color={isSelected ? "inherit" : "primary"}
                                                            disabled={returnedAlready}
                                                            onClick={() => toggleItemForReturn(line)}
                                                        >
                                                            {isSelected ? "Cancel" : "Return"}
                                                        </Button>
                                                    </Grid>
                                                </Grid>
                                            </Box>
                                        )
                                    })}
                                </List>

                            </CardContent>
                        </Card>
                    ) : (
                        <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4, bgcolor: '#fafafa', borderStyle: 'dashed' }}>
                            <Typography color="text.secondary">
                                Search for an order on the left to see contents.
                            </Typography>
                        </Card>
                    )}
                </Grid>

            </Grid>

            {/* Return Records Section */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 6, mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Return & Damage Records</Typography>
                <ToggleButtonGroup
                    value={recordFilter}
                    exclusive
                    onChange={(_, val) => val && setRecordFilter(val)}
                    size="small"
                >
                    <ToggleButton value="all">All Records</ToggleButton>
                    <ToggleButton value="sellable">Restocked Only</ToggleButton>
                    <ToggleButton value="damaged">Damaged Only</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            <Card>
                <TableContainer component={Box}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'background.default' }}>
                            <TableRow>
                                <TableCell>Date</TableCell>
                                <TableCell>Receipt</TableCell>
                                <TableCell>SKU</TableCell>
                                <TableCell>Product Name</TableCell>
                                <TableCell align="center">Qty</TableCell>
                                <TableCell>Reason</TableCell>
                                <TableCell>Condition</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredRecords.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                        No return records found matching the filter.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRecords.map((rec) => (
                                    <TableRow key={rec.id}>
                                        <TableCell>{new Date(rec.date).toLocaleString()}</TableCell>
                                        <TableCell>{rec.transaction_number}</TableCell>
                                        <TableCell>{rec.sku_code}</TableCell>
                                        <TableCell>{rec.sku_name}</TableCell>
                                        <TableCell align="center">{rec.quantity}</TableCell>
                                        <TableCell>{rec.reason}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={rec.condition === 'sellable' ? 'Restocked' : 'Damaged / No Restock'}
                                                size="small"
                                                color={rec.condition === 'sellable' ? 'success' : 'error'}
                                                variant="outlined"
                                                sx={{ fontWeight: 'bold' }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Card>

        </Box>
    )
}
