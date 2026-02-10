import { useState } from 'react'
import {
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
} from '@mui/material'
import {
  Save,
  Add,
  Delete,
  Info,
} from '@mui/icons-material'

interface Role {
  code: string
  name: string
  permissions: string[]
}

const permissionCategories = [
  {
    category: 'Master Data',
    permissions: [
      { code: 'mdm.product.view', name: 'View Products' },
      { code: 'mdm.product.create', name: 'Create Products' },
      { code: 'mdm.product.edit', name: 'Edit Products' },
      { code: 'mdm.product.delete', name: 'Delete Products' },
      { code: 'mdm.sku.view', name: 'View SKUs' },
      { code: 'mdm.sku.create', name: 'Create SKUs' },
      { code: 'mdm.sku.edit', name: 'Edit SKUs' },
      { code: 'mdm.sku.delete', name: 'Delete SKUs' },
    ],
  },
  {
    category: 'Documents',
    permissions: [
      { code: 'doc.view', name: 'View Documents' },
      { code: 'doc.create', name: 'Create Documents' },
      { code: 'doc.edit', name: 'Edit Documents' },
      { code: 'doc.delete', name: 'Delete Documents' },
      { code: 'doc.approve', name: 'Approve Documents' },
      { code: 'doc.post', name: 'Post Documents' },
    ],
  },
  {
    category: 'Inventory',
    permissions: [
      { code: 'inv.view', name: 'View Inventory' },
      { code: 'inv.adjust', name: 'Adjust Inventory' },
      { code: 'inv.transfer', name: 'Transfer Inventory' },
      { code: 'inv.count', name: 'Count Inventory' },
    ],
  },
  {
    category: 'Reports',
    permissions: [
      { code: 'report.view', name: 'View Reports' },
      { code: 'report.create', name: 'Create Reports' },
      { code: 'report.export', name: 'Export Reports' },
    ],
  },
  {
    category: 'Administration',
    permissions: [
      { code: 'admin.users', name: 'Manage Users' },
      { code: 'admin.roles', name: 'Manage Roles' },
      { code: 'admin.config', name: 'System Configuration' },
      { code: 'admin.audit', name: 'View Audit Logs' },
    ],
  },
]

const defaultRoles: Role[] = [
  { code: 'admin', name: 'Administrator', permissions: [] },
  { code: 'manager', name: 'Manager', permissions: [] },
  { code: 'user', name: 'User', permissions: [] },
  { code: 'viewer', name: 'Viewer', permissions: [] },
]

export default function PermissionDesigner() {
  const [roles, setRoles] = useState<Role[]>(defaultRoles)
  const [newRoleName, setNewRoleName] = useState('')

  const handleTogglePermission = (roleCode: string, permissionCode: string) => {
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
    if (!newRoleName) return
    const code = newRoleName.toLowerCase().replace(/\s+/g, '_')
    setRoles([...roles, { code, name: newRoleName, permissions: [] }])
    setNewRoleName('')
  }

  const handleRemoveRole = (roleCode: string) => {
    setRoles(roles.filter((r) => r.code !== roleCode))
  }

  const handleSave = () => {
    console.log('Saving permissions:', roles)
    // TODO: Call API to save permissions
  }

  const handleSelectAll = (roleCode: string, category: string) => {
    const categoryPerms = permissionCategories.find((c) => c.category === category)
    if (!categoryPerms) return

    const allPermCodes = categoryPerms.permissions.map((p) => p.code)
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
          sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
          Save Permissions
        </Button>
      </Box>

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
            <Button fullWidth variant="outlined" startIcon={<Add />} onClick={handleAddRole}>
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
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {permissionCategories.map((category) => (
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
                      const allPerms = category.permissions.map((p) => p.code)
                      const hasAll = allPerms.every((p) => role.permissions.includes(p))
                      const hasSome = allPerms.some((p) => role.permissions.includes(p))
                      return (
                        <TableCell key={role.code} align="center">
                          <Checkbox
                            checked={hasAll}
                            indeterminate={hasSome && !hasAll}
                            onChange={() => handleSelectAll(role.code, category.category)}
                          />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  {category.permissions.map((permission) => (
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
    </Box>
  )
}
