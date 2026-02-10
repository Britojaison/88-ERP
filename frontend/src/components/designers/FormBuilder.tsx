import { useState } from 'react'
import {
  Box,
  Paper,
  Grid,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Chip,
} from '@mui/material'
import {
  Add,
  Delete,
  DragIndicator,
  Save,
  Visibility,
  Edit,
} from '@mui/icons-material'

interface FormField {
  id: string
  name: string
  label: string
  type: string
  required: boolean
  placeholder?: string
  defaultValue?: any
  options?: string[]
  validation?: any
  conditionalDisplay?: any
  gridWidth: number
}

interface FormLayout {
  name: string
  description: string
  entityType: string
  fields: FormField[]
}

const fieldTypes = [
  { value: 'text', label: 'Text Input' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
  { value: 'textarea', label: 'Text Area' },
]

export default function FormBuilder() {
  const [form, setForm] = useState<FormLayout>({
    name: '',
    description: '',
    entityType: 'sku',
    fields: [],
  })

  const [selectedField, setSelectedField] = useState<FormField | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const handleAddField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      name: '',
      label: '',
      type: 'text',
      required: false,
      gridWidth: 12,
    }
    setForm({ ...form, fields: [...form.fields, newField] })
    setSelectedField(newField)
  }

  const handleUpdateField = (id: string, updates: Partial<FormField>) => {
    setForm({
      ...form,
      fields: form.fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })
    if (selectedField?.id === id) {
      setSelectedField({ ...selectedField, ...updates })
    }
  }

  const handleRemoveField = (id: string) => {
    setForm({
      ...form,
      fields: form.fields.filter((f) => f.id !== id),
    })
    if (selectedField?.id === id) {
      setSelectedField(null)
    }
  }

  const handleSave = () => {
    console.log('Saving form:', form)
    // TODO: Call API to save form
  }

  const renderFieldPreview = (field: FormField) => {
    switch (field.type) {
      case 'select':
        return (
          <FormControl fullWidth size="small">
            <InputLabel>{field.label || 'Field Label'}</InputLabel>
            <Select label={field.label || 'Field Label'}>
              {field.options?.map((opt, i) => (
                <MenuItem key={i} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )
      case 'checkbox':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <input type="checkbox" />
            <Typography variant="body2" sx={{ ml: 1 }}>
              {field.label || 'Field Label'}
            </Typography>
          </Box>
        )
      case 'textarea':
        return (
          <TextField
            fullWidth
            size="small"
            label={field.label || 'Field Label'}
            multiline
            rows={3}
            required={field.required}
          />
        )
      default:
        return (
          <TextField
            fullWidth
            size="small"
            label={field.label || 'Field Label'}
            type={field.type}
            required={field.required}
            placeholder={field.placeholder}
          />
        )
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Form Builder
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
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
            sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            Save Form
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={showPreview ? 4 : 3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Form Settings
            </Typography>
            <TextField
              fullWidth
              size="small"
              label="Form Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              size="small"
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              margin="normal"
              multiline
              rows={2}
            />
            <FormControl fullWidth size="small" margin="normal">
              <InputLabel>Entity Type</InputLabel>
              <Select
                value={form.entityType}
                onChange={(e) => setForm({ ...form, entityType: e.target.value })}
                label="Entity Type"
              >
                <MenuItem value="sku">SKU</MenuItem>
                <MenuItem value="product">Product</MenuItem>
                <MenuItem value="customer">Customer</MenuItem>
                <MenuItem value="vendor">Vendor</MenuItem>
              </Select>
            </FormControl>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Fields
            </Typography>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Add />}
              onClick={handleAddField}
              sx={{ mb: 2 }}
            >
              Add Field
            </Button>

            <List dense>
              {form.fields.map((field) => (
                <ListItem
                  key={field.id}
                  button
                  selected={selectedField?.id === field.id}
                  onClick={() => setSelectedField(field)}
                  sx={{
                    border: '1px solid',
                    borderColor: selectedField?.id === field.id ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <DragIndicator sx={{ mr: 1, color: 'text.secondary', fontSize: 16 }} />
                  <ListItemText
                    primary={field.label || 'Untitled Field'}
                    secondary={field.type}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" size="small" onClick={() => handleRemoveField(field.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={showPreview ? 4 : 9}>
          {selectedField ? (
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Field Properties
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Field Name"
                    value={selectedField.name}
                    onChange={(e) => handleUpdateField(selectedField.id, { name: e.target.value })}
                    helperText="Internal field name (no spaces)"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Field Label"
                    value={selectedField.label}
                    onChange={(e) => handleUpdateField(selectedField.id, { label: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Field Type</InputLabel>
                    <Select
                      value={selectedField.type}
                      onChange={(e) => handleUpdateField(selectedField.id, { type: e.target.value })}
                      label="Field Type"
                    >
                      {fieldTypes.map((type) => (
                        <MenuItem key={type.value} value={type.value}>
                          {type.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Grid Width</InputLabel>
                    <Select
                      value={selectedField.gridWidth}
                      onChange={(e) => handleUpdateField(selectedField.id, { gridWidth: Number(e.target.value) })}
                      label="Grid Width"
                    >
                      <MenuItem value={12}>Full Width (12)</MenuItem>
                      <MenuItem value={6}>Half Width (6)</MenuItem>
                      <MenuItem value={4}>Third Width (4)</MenuItem>
                      <MenuItem value={3}>Quarter Width (3)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Placeholder"
                    value={selectedField.placeholder || ''}
                    onChange={(e) => handleUpdateField(selectedField.id, { placeholder: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedField.required}
                      onChange={(e) => handleUpdateField(selectedField.id, { required: e.target.checked })}
                    />
                    <Typography variant="body2" sx={{ ml: 1 }}>
                      Required Field
                    </Typography>
                  </Box>
                </Grid>

                {(selectedField.type === 'select' || selectedField.type === 'multiselect') && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Options (comma-separated)"
                      value={selectedField.options?.join(', ') || ''}
                      onChange={(e) =>
                        handleUpdateField(selectedField.id, {
                          options: e.target.value.split(',').map((s) => s.trim()),
                        })
                      }
                      helperText="e.g., Small, Medium, Large"
                    />
                  </Grid>
                )}
              </Grid>
            </Paper>
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              <Edit sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
              <Typography variant="body1">Select a field to edit its properties</Typography>
              <Typography variant="body2">or add a new field to get started</Typography>
            </Paper>
          )}
        </Grid>

        {showPreview && (
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Form Preview
              </Typography>
              <Card sx={{ mt: 2, bgcolor: 'grey.50' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {form.name || 'Form Name'}
                  </Typography>
                  {form.description && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                      {form.description}
                    </Typography>
                  )}
                  <Grid container spacing={2}>
                    {form.fields.map((field) => (
                      <Grid item xs={field.gridWidth} key={field.id}>
                        {renderFieldPreview(field)}
                        {field.required && (
                          <Chip label="Required" size="small" color="error" sx={{ mt: 0.5 }} />
                        )}
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}
