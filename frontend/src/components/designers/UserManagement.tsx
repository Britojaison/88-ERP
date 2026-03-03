import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import {
    Alert,
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Select,
    MenuItem,
    Snackbar,
    TextField,
    Grid,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Chip,
    InputAdornment,
    Tooltip,
} from '@mui/material'
import { PersonAdd, Lock, Visibility, VisibilityOff, Close, CheckCircle } from '@mui/icons-material'
import api from '../../services/api'
import { DEFAULT_ROLES } from '../../constants/permissions'

interface User {
    id: string
    email: string
    username: string
    first_name: string
    last_name: string
    role: string
    is_active: boolean
}

export default function UserManagement() {
    const currentUser = useSelector((state: RootState) => state.auth.user)
    const isAdmin = currentUser?.role?.toLowerCase() === 'admin'

    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)

    const [availableRoles] = useState(() => {
        const saved = localStorage.getItem('metadata_permission_roles')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                return Array.isArray(parsed) ? parsed : DEFAULT_ROLES
            } catch {
                return DEFAULT_ROLES
            }
        }
        return DEFAULT_ROLES
    })

    // New user form
    const [newUser, setNewUser] = useState({ name: '', email: '', role: 'warehouse', password: '' })
    const [showNewPassword, setShowNewPassword] = useState(false)

    // Set password dialog
    const [pwdDialog, setPwdDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null })
    const [newPassword, setNewPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [pwdLoading, setPwdLoading] = useState(false)

    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
        open: false, message: '', severity: 'info'
    })

    const showMsg = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
        setSnackbar({ open: true, message, severity })

    const fetchUsers = async () => {
        try {
            setLoading(true)
            const res = await api.get('/mdm/users/')
            const data = Array.isArray(res.data) ? res.data : res.data.results || []
            setUsers(data)
        } catch {
            showMsg('Failed to load users.', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { if (isAdmin) fetchUsers() }, [isAdmin])

    const handleRoleChange = async (user: User, newRole: string) => {
        if (!isAdmin) return
        try {
            await api.patch(`/mdm/users/${user.id}/`, { role: newRole })
            setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole } : u))
            showMsg(`Role updated for ${user.email}.`)
        } catch {
            showMsg('Failed to update role.', 'error')
        }
    }

    const handleAddUser = async () => {
        if (!isAdmin || !newUser.name || !newUser.email || !newUser.password) {
            showMsg('Name, email, and password are required.', 'error')
            return
        }
        try {
            const [first_name, ...rest] = newUser.name.trim().split(' ')
            await api.post('/mdm/users/', {
                email: newUser.email,
                username: newUser.email,
                first_name,
                last_name: rest.join(' '),
                role: newUser.role,
                password: newUser.password,
                is_active: true,
            })
            showMsg('User created successfully.')
            setNewUser({ name: '', email: '', role: 'warehouse', password: '' })
            fetchUsers()
        } catch (e: any) {
            const msg = e.response?.data?.email?.[0] || e.response?.data?.username?.[0] || 'Failed to create user.'
            showMsg(msg, 'error')
        }
    }

    const openPwdDialog = (user: User) => {
        setNewPassword('')
        setShowPassword(false)
        setPwdDialog({ open: true, user })
    }

    const handleSetPassword = async () => {
        if (!pwdDialog.user) return
        if (newPassword.length < 6) {
            showMsg('Password must be at least 6 characters.', 'error')
            return
        }
        setPwdLoading(true)
        try {
            await api.post(`/mdm/users/${pwdDialog.user.id}/set-password/`, { password: newPassword })
            showMsg(`Password updated for ${pwdDialog.user.email}.`)
            setPwdDialog({ open: false, user: null })
            setNewPassword('')
        } catch {
            showMsg('Failed to set password.', 'error')
        } finally {
            setPwdLoading(false)
        }
    }

    const getRoleColor = (role: string) => {
        const colors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
            admin: 'error',
            warehouse: 'primary',
            store: 'success',
            designer: 'secondary',
            operations: 'warning',
        }
        return colors[role?.toLowerCase()] || 'default'
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    User Management
                </Typography>
                <Button variant="outlined" size="small" onClick={fetchUsers}>
                    Refresh
                </Button>
            </Box>

            {!isAdmin && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    Only administrators can manage users and roles.
                </Alert>
            )}

            {isAdmin && (
                <Paper sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>
                        ➕ Add New User
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth size="small" label="Full Name *"
                                value={newUser.name}
                                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth size="small" label="Email *" type="email"
                                value={newUser.email}
                                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <Select
                                fullWidth size="small"
                                value={newUser.role}
                                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                            >
                                {availableRoles.filter((r: any) => r.code !== 'admin').map((role: any) => (
                                    <MenuItem key={role.code} value={role.code}>{role.name}</MenuItem>
                                ))}
                            </Select>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth size="small" label="Password *"
                                type={showNewPassword ? 'text' : 'password'}
                                value={newUser.password}
                                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={() => setShowNewPassword(p => !p)}>
                                                {showNewPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={1}>
                            <Button fullWidth variant="contained" onClick={handleAddUser} startIcon={<PersonAdd />}>
                                Add
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>
            )}

            <TableContainer component={Paper}>
                <Table>
                    <TableHead sx={{ bgcolor: 'rgba(248,250,252,0.9)' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                            {isAdmin && <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    Loading users...
                                </TableCell>
                            </TableRow>
                        ) : users.filter(u => u.username !== 'admin' && u.role?.toLowerCase() !== 'admin').map((user) => (
                            <TableRow key={user.id} hover>
                                <TableCell sx={{ fontWeight: 500 }}>
                                    {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}
                                </TableCell>
                                <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>{user.email}</TableCell>
                                <TableCell>
                                    {isAdmin ? (
                                        <Select
                                            size="small"
                                            value={user.role?.toLowerCase() || ''}
                                            onChange={(e) => handleRoleChange(user, e.target.value)}
                                            sx={{ minWidth: 130 }}
                                        >
                                            {availableRoles.map((role: any) => (
                                                <MenuItem key={role.code} value={role.code}>{role.name}</MenuItem>
                                            ))}
                                        </Select>
                                    ) : (
                                        <Chip
                                            label={user.role || 'Unknown'}
                                            color={getRoleColor(user.role)}
                                            size="small"
                                            sx={{ fontWeight: 600, textTransform: 'capitalize', borderRadius: 1.5 }}
                                        />
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={user.is_active ? 'Active' : 'Inactive'}
                                        color={user.is_active ? 'success' : 'default'}
                                        size="small"
                                        sx={{ borderRadius: 1.5, fontWeight: 600 }}
                                    />
                                </TableCell>
                                {isAdmin && (
                                    <TableCell align="center">
                                        <Tooltip title="Set Password">
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<Lock />}
                                                onClick={() => openPwdDialog(user)}
                                                sx={{ borderRadius: 2 }}
                                            >
                                                Set Password
                                            </Button>
                                        </Tooltip>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Set Password Dialog */}
            <Dialog open={pwdDialog.open} onClose={() => setPwdDialog({ open: false, user: null })} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        <Typography variant="h6" fontWeight={700}>Set Password</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {pwdDialog.user?.email}
                        </Typography>
                    </Box>
                    <IconButton onClick={() => setPwdDialog({ open: false, user: null })} size="small">
                        <Close />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="New Password"
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        sx={{ mt: 1 }}
                        helperText="Minimum 6 characters"
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => setShowPassword(p => !p)}>
                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            )
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setPwdDialog({ open: false, user: null })} color="inherit">
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSetPassword}
                        disabled={pwdLoading || newPassword.length < 6}
                        startIcon={<CheckCircle />}
                        sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                    >
                        {pwdLoading ? 'Saving...' : 'Confirm Password'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3500}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    )
}
