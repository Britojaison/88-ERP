import { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Grid,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Divider,
  Card,
  CardContent,
  Alert,
  Snackbar,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import {
  Add,
  Delete,
  DragIndicator,
  Save,
  Visibility,
  Edit,
  Refresh,
} from '@mui/icons-material'
import { attributesService, AttributeDefinition } from '../../services'

const dataTypes = [
  { value: 'string', label: 'Text' },
  { value: 'integer', label: 'Number' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
]

const entityTypes = [
  { value: 'product', label: 'Product' },
  { value: 'sku', label: 'SKU' },
  { value: 'customer', label: 'Customer' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'document', label: 'Document' },
]

export default function AttributeDesigner() {
  const [attribute, setAttribute] = useState<Partial<AttributeDefinition>>({
    code: '',
    name: '',
    entity_type: 'sku',
    data_type: 'string',
    is_required: false,
    is_variant_dimension: false,
    is_searchable: true,
    is_filterable: true,
    validation_rules: {},
    display_order: 0,
    options: [],
  })

  const [existingAttributes, setExistingAttributes] = useState<AttributeDefinition[]>([])
  const [newOption, setNewOption] = useState({ code: '', label: '' })
  const [showPreview, setShowPreview] = useState(false)
  const [showList, setShowList] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [snackbar, setSnackbar] = useState({ 
    open: false, 
    message: '', 
    severity: 'success' as 'success' | 'error' | 'info' 
  })

  useEffect(() => {
    loadAttributes()
  }, [])

  const loadAttributes = async () => {
    setLoadingList(true)
    try {
      const data = await attributesService.listDefinitions()
      setExistingAttributes(data)
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: 'Failed to load attributes', 
        severity: 'error' 
      })
    } finally {
      setLoadingList(false)
    }
  }

  const handleAddOption = () => {
    if (!newOption.code || !newOption.label) return

    setAttribute({
      ...attribute,
      options: [
        ...(attribute.options || []),
        {
          ...newOption,
          display_order: (attribute.options?.length || 0) + 1,
        },
      ],
    })
    setNewOption({ code: '', label: '' })
  }

  const handleRemoveOption = (index: number) => {
    setAttribute({
      ...attribute,
      options: attribute.options?.filter((_, i) => i !== index),
    })
  }

  const handleSave = async () => {
    if (!attribute.code || !attribute.name) {
      setSnackbar({ 
        open: true, 
        message: 'Code and Name are required', 
        severity: 'error' 
      })
      return
    }

    setLoading(true)
    try {
      if (editMode && attribute.id) {
        await attributesService.updateDefinition(attribute.id, attribute)
        setSnackbar({ 
          open: true, 
          message: 'Attribute updated successfully!', 
          severity: 'success' 
        })
      } else {
        await attributesService.createDefinition(attribute)
        setSnackbar({ 
          open: true, 
          message: 'Attribute created successfully!', 
          severity: 'success' 
        })
      }
      
      // Reset form
      resetForm()
      loadAttributes()
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.message || 'Failed to save attribute', 
        severity: 'error' 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (attr: AttributeDefinition) => {
    setAttribute(attr)
    setEditMode(true)
    setShowList(false)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this attribute?')) return

    try {
      await attributesService.deleteDefinition(id)
      setSnackbar({ 
        open: true, 
        message: 'Attribute deleted successfully!', 
        severity: 'success' 
      })
      loadAttributes()
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: 'Failed to delete attribute', 
        severity: 'error' 
      })
    }
  }

  const resetForm = () => {
    setAttribute({
      code: '',
      name: '',
      entity_type: 'sku',
      data_type: 'string',
      is_required: false,
      is_variant_dimension: false,
      is_searchable: true,
      is_filterable: true,
      validation_rules: {},
      display_order: 0,
      options: [],
    })
    setEditMode(false)
  }

  const renderFieldPreview = (field: Partial<AttributeDefinition>) => {
    switch (field.data_type) {
      case 'string':
        if (field.options && field.options.length > 0) {
          return (
            <FormControl fullWidth size="small">
              <InputLabel>{field.name || 'Attribute Name'}</InputLabel>
              <Select label={field.name || 'Attribute Name'}>
                {field.options.map((opt) => (
                  <MenuItem key={opt.code} value={opt.code}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )
        }
        return (
          <TextField
            fullWidth
            size="small"
            label={field.name || 'Attribute Name'}
            required={field.is_required}
          />
        )
      case 'boolean':
        return (
          <FormControlLabel
            control={<Checkbox />}
            label={field.name || 'Attribute Name'}
          />
        )
      default:
        return (
          <TextField
            fullWidth
            size="small"
            label={field.name || 'Attribute Name'}
            type={field.data_type === 'integer' || field.data_type === 'decimal' ? 'number' : 'text'}
            required={field.is_required}
          />
        )
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {editMode ? 'Edit Attribute' : 'Create New Attribute'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadAttributes}
            disabled={loadingList}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            onClick={() => setShowList(!showList)}
          >
            {showList ? 'Hide List' : 'Show List'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Visibility />}
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? 'Hide' : 'Show'} Preview
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSave}
            disabled={loading}
            sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            {loading ? <CircularProgress size={24} /> : editMode ? 'Update' : 'Save'}
          </Button>
          {editMode && (
            <Button
              variant="outlined"
              onClick={() => {
                resetForm()
                setShowList(true)
              }}
            >
              Cancel
            </Button>
          )}
        </Box>
      </Box>

      {showList && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            Existing Attributes
          </Typography>
          {loadingList ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Entity Type</TableCell>
                    <TableCell>Data Type</TableCell>
                    <TableCell>Required</TableCell>
                    <TableCell>Variant</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {existingAttributes.map((attr) => (
                    <TableRow key={attr.id} hover>
                      <TableCell>{attr.code}</TableCell>
                      <TableCell>{attr.name}</TableCell>
                      <TableCell>{attr.entity_type}</TableCell>
                      <TableCell>{attr.data_type}</TableCell>
                      <TableCell>
                        {attr.is_required && <Chip label="Yes" size="small" color="error" />}
                      </TableCell>
                      <TableCell>
                        {attr.is_variant_dimension && <Chip label="Yes" size="small" color="primary" />}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleEdit(attr)}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(attr.id!)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {existingAttributes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        No attributes found. Create your first attribute!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={showPreview ? 8 : 12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Basic Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Attribute Code"
                  value={attribute.code}
                  onChange={(e) => setAttribute({ ...attribute, code: e.target.value })}
                  placeholder="e.g., size, color"
                  helperText="Unique identifier (lowercase, no spaces)"
                  disabled={editMode}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Attribute Name"
                  value={attribute.name}
                  onChange={(e) => setAttribute({ ...attribute, name: e.target.value })}
                  placeholder="e.g., Size, Color"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Entity Type</InputLabel>
                  <Select
                    value={attribute.entity_type}
                    onChange={(e) => setAttribute({ ...attribute, entity_type: e.target.value })}
                    label="Entity Type"
                  >
                    {entityTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Data Type</InputLabel>
                  <Select
                    value={attribute.data_type}
                    onChange={(e) => setAttribute({ ...attribute, data_type: e.target.value })}
                    label="Data Type"
                  >
                    {dataTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Behavior
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={attribute.is_required}
                      onChange={(e) => setAttribute({ ...attribute, is_required: e.target.checked })}
                    />
                  }
                  label="Required Field"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={attribute.is_variant_dimension}
                      onChange={(e) => setAttribute({ ...attribute, is_variant_dimension: e.target.checked })}
                    />
                  }
                  label="Variant Dimension (creates SKU variants)"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={attribute.is_searchable}
                      onChange={(e) => setAttribute({ ...attribute, is_searchable: e.target.checked })}
                    />
                  }
                  label="Searchable"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={attribute.is_filterable}
                      onChange={(e) => setAttribute({ ...attribute, is_filterable: e.target.checked })}
                    />
                  }
                  label="Filterable"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Options (for dropdown/select fields)
            </Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={5}>
                <TextField
                  fullWidth
                  size="small"
                  label="Option Code"
                  value={newOption.code}
                  onChange={(e) => setNewOption({ ...newOption, code: e.target.value })}
                  placeholder="e.g., s, m, l"
                />
              </Grid>
              <Grid item xs={5}>
                <TextField
                  fullWidth
                  size="small"
                  label="Option Label"
                  value={newOption.label}
                  onChange={(e) => setNewOption({ ...newOption, label: e.target.value })}
                  placeholder="e.g., Small, Medium, Large"
                />
              </Grid>
              <Grid item xs={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleAddOption}
                  sx={{ height: '40px' }}
                >
                  <Add />
                </Button>
              </Grid>
            </Grid>

            <List>
              {attribute.options?.map((option, index) => (
                <ListItem
                  key={index}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <DragIndicator sx={{ mr: 1, color: 'text.secondary' }} />
                  <ListItemText
                    primary={option.label}
                    secondary={`Code: ${option.code}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={() => handleRemoveOption(index)}>
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {showPreview && (
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Preview
              </Typography>
              <Card sx={{ mt: 2, bgcolor: 'grey.50' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    How this field will appear:
                  </Typography>
                  
                  {renderFieldPreview(attribute)}

                  <Box sx={{ mt: 2 }}>
                    {attribute.is_required && (
                      <Chip label="Required" size="small" color="error" sx={{ mr: 1, mb: 1 }} />
                    )}
                    {attribute.is_variant_dimension && (
                      <Chip label="Variant" size="small" color="primary" sx={{ mr: 1, mb: 1 }} />
                    )}
                    {attribute.is_searchable && (
                      <Chip label="Searchable" size="small" sx={{ mr: 1, mb: 1 }} />
                    )}
                    {attribute.is_filterable && (
                      <Chip label="Filterable" size="small" sx={{ mr: 1, mb: 1 }} />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Paper>
          </Grid>
        )}
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
