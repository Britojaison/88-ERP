import { useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import {
  Alert,
  Box,
  Paper,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Button,
  TextField,
  Chip,
  IconButton,
  Tooltip,
  Snackbar,
} from '@mui/material'
import {
  Save,
  Add,
  Delete,
  Info,
} from '@mui/icons-material'

import {
  PERMISSION_CATEGORIES,
  DEFAULT_ROLES,
  Role,
  Permission,
  PermissionCategory,
} from '../../constants/permissions'

export default function PermissionDesigner() {
  const [roles, setRoles] = useState<Role[]>(() => {
    const saved = localStorage.getItem('metadata_permission_roles')
    if (!saved) return DEFAULT_ROLES
    try {
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed : DEFAULT_ROLES
    } catch {
      return DEFAULT_ROLES
    }
  })
  const [newRoleName, setNewRoleName] = useState('')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info',
  })

  const currentUser = useSelector((state: RootState) => state.auth.user)
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'

  const handleTogglePermission = (roleCode: string, permissionCode: string) => {
    if (!isAdmin) return
    setRoles(
      roles.map((role) => {
        if (role.code === roleCode) {
          const hasPermission = role.permissions.includes(permissionCode)
          return {
            ...role,
            permissions: hasPermission
              ? role.permissions.filter((p) => p !== permissionCode)
              : [...role.permissions, permissionCode],
          }
        }
        return role
      })
    )
  }

  const handleAddRole = () => {
    if (!isAdmin || !newRoleName.trim()) return
    const code = newRoleName.toLowerCase().replace(/\s+/g, '_')
    if (roles.some((role) => role.code === code)) {
      setSnackbar({ open: true, message: 'Role already exists.', severity: 'error' })
      return
    }
    setRoles([...roles, { code, name: newRoleName, permissions: [] }])
    setNewRoleName('')
    setSnackbar({ open: true, message: 'Role added.', severity: 'success' })
  }

  const handleRemoveRole = (roleCode: string) => {
    if (!isAdmin) return
    setRoles(roles.filter((r) => r.code !== roleCode))
    setSnackbar({ open: true, message: 'Role removed.', severity: 'info' })
  }

  const handleSave = () => {
    if (!isAdmin) return
    localStorage.setItem('metadata_permission_roles', JSON.stringify(roles))
    setSnackbar({ open: true, message: 'Permissions saved.', severity: 'success' })
  }

  const handleSelectAll = (roleCode: string, category: string) => {
    if (!isAdmin) return
    const categoryPerms = PERMISSION_CATEGORIES.find((c: PermissionCategory) => c.category === category)
    if (!categoryPerms) return

    const allPermCodes = categoryPerms.permissions.map((p: Permission) => p.code)
    setRoles(
      roles.map((role) => {
        if (role.code === roleCode) {
          const hasAll = allPermCodes.every((p) => role.permissions.includes(p))
          return {
            ...role,
            permissions: hasAll
              ? role.permissions.filter((p) => !allPermCodes.includes(p))
              : [...new Set([...role.permissions, ...allPermCodes])],
          }
        }
        return role
      })
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Permission Matrix
        </Typography>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={handleSave}
          disabled={!isAdmin}
          sx={{ background: isAdmin ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'grey' }}
        >
          Save Permissions
        </Button>
      </Box>

      {!isAdmin && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You do not have permission to modify the access control matrix. Only administrators can perform these actions.
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          Add New Role
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              size="small"
              label="Role Name"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g., Warehouse Manager"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Add />}
              onClick={handleAddRole}
              disabled={!isAdmin}
            >
              Add Role
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Permission Matrix
          </Typography>
          <Tooltip title="Check boxes to grant permissions to roles">
            <IconButton size="small" sx={{ ml: 1 }}>
              <Info fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, minWidth: 200 }}>Permission</TableCell>
                {roles.map((role) => (
                  <TableCell key={role.code} align="center" sx={{ fontWeight: 600, minWidth: 120 }}>
                    <Box>
                      <Typography variant="body2">{role.name}</Typography>
                      <Chip
                        label={`${role.permissions.length} perms`}
                        size="small"
                        sx={{ mt: 0.5 }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveRole(role.code)}
                        sx={{ ml: 0.5 }}
                        disabled={!isAdmin}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {PERMISSION_CATEGORIES.map((category: PermissionCategory) => (
                <>
                  <TableRow key={category.category}>
                    <TableCell
                      colSpan={roles.length + 1}
                      sx={{
                        bgcolor: 'primary.light',
                        color: 'white',
                        fontWeight: 600,
                      }}
                    >
                      {category.category}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                      Select All
                    </TableCell>
                    {roles.map((role) => {
                      const allPerms = category.permissions.map((p: Permission) => p.code)
                      const hasAll = allPerms.every((p: string) => role.permissions.includes(p))
                      const hasSome = allPerms.some((p: string) => role.permissions.includes(p))
                      return (
                        <TableCell key={role.code} align="center">
                          <Checkbox
                            checked={hasAll}
                            indeterminate={hasSome && !hasAll}
                            onChange={() => handleSelectAll(role.code, category.category)}
                            disabled={!isAdmin}
                          />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  {category.permissions.map((permission: Permission) => (
                    <TableRow key={permission.code} hover>
                      <TableCell>
                        <Typography variant="body2">{permission.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {permission.code}
                        </Typography>
                      </TableCell>
                      {roles.map((role) => (
                        <TableCell key={role.code} align="center">
                          <Checkbox
                            checked={role.permissions.includes(permission.code)}
                            onChange={() => handleTogglePermission(role.code, permission.code)}
                            disabled={!isAdmin}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          Role Summary
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {roles.map((role) => (
            <Grid item xs={12} md={6} lg={3} key={role.code}>
              <Box
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  {role.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {role.permissions.length} permissions assigned
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
