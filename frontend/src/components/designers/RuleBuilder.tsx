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
  Typography,
  Card,
  CardContent,
  IconButton,
  Chip,
  Divider,
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
  Save,
  PlayArrow,
  Code,
  Refresh,
  Edit,
} from '@mui/icons-material'
import Editor from '@monaco-editor/react'
import { rulesService, Rule, RuleTemplate } from '../../services'

interface RuleCondition {
  field: string
  operator: string
  value: any
}

const ruleTypes = [
  { value: 'validation', label: 'Validation' },
  { value: 'calculation', label: 'Calculation' },
  { value: 'constraint', label: 'Constraint' },
]

const triggers = [
  { value: 'pre_save', label: 'Before Save' },
  { value: 'pre_submit', label: 'Before Submit' },
  { value: 'pre_approve', label: 'Before Approve' },
]

const operators = [
  { value: '==', label: 'Equals' },
  { value: '!=', label: 'Not Equals' },
  { value: '>', label: 'Greater Than' },
  { value: '<', label: 'Less Than' },
  { value: '>=', label: 'Greater or Equal' },
  { value: '<=', label: 'Less or Equal' },
  { value: 'in', label: 'In List' },
  { value: 'contains', label: 'Contains' },
]

export default function RuleBuilder() {
  const [rule, setRule] = useState<Partial<Rule>>({
    code: '',
    name: '',
    description: '',
    rule_type: 'validation',
    trigger: 'pre_save',
    entity_type: 'sku',
    condition_expression: {},
    error_message: '',
    error_code: '',
    priority: 100,
    is_blocking: true,
  })

  const [existingRules, setExistingRules] = useState<Rule[]>([])
  const [templates, setTemplates] = useState<RuleTemplate[]>([])
  const [conditions, setConditions] = useState<RuleCondition[]>([])
  const [showJsonEditor, setShowJsonEditor] = useState(false)
  const [showList, setShowList] = useState(true)
  const [jsonExpression, setJsonExpression] = useState('{}')
  const [testResult, setTestResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [snackbar, setSnackbar] = useState({ 
    open: false, 
    message: '', 
    severity: 'success' as 'success' | 'error' | 'info' 
  })

  useEffect(() => {
    loadRules()
    loadTemplates()
  }, [])

  const loadRules = async () => {
    setLoadingList(true)
    try {
      const data = await rulesService.listRules()
      setExistingRules(data)
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: 'Failed to load rules', 
        severity: 'error' 
      })
    } finally {
      setLoadingList(false)
    }
  }

  const loadTemplates = async () => {
    try {
      const data = await rulesService.getTemplates()
      setTemplates(data)
    } catch (error: any) {
      console.error('Failed to load templates:', error)
    }
  }

  const handleAddCondition = () => {
    setConditions([...conditions, { field: '', operator: '==', value: '' }])
  }

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  const handleUpdateCondition = (index: number, field: keyof RuleCondition, value: any) => {
    const newConditions = [...conditions]
    newConditions[index] = { ...newConditions[index], [field]: value }
    setConditions(newConditions)
  }

  const handleApplyTemplate = (template: RuleTemplate) => {
    setJsonExpression(JSON.stringify(template.expression, null, 2))
    setRule({
      ...rule,
      condition_expression: template.expression,
      error_message: template.error_message,
    })
    setSnackbar({ 
      open: true, 
      message: 'Template applied successfully!', 
      severity: 'success' 
    })
  }

  const handleTestRule = async () => {
    if (!rule.id) {
      setSnackbar({ 
        open: true, 
        message: 'Please save the rule first before testing', 
        severity: 'info' 
      })
      return
    }

    try {
      const context = {
        amount: 1000,
        category: 'apparel',
        entity_id: '00000000-0000-0000-0000-000000000000',
      }
      
      const result = await rulesService.testRule(rule.id, context)
      setTestResult(result)
      setSnackbar({ 
        open: true, 
        message: result.passed ? 'Rule test passed!' : 'Rule test failed', 
        severity: result.passed ? 'success' : 'error' 
      })
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: 'Failed to test rule', 
        severity: 'error' 
      })
    }
  }

  const handleSave = async () => {
    if (!rule.code || !rule.name) {
      setSnackbar({ 
        open: true, 
        message: 'Code and Name are required', 
        severity: 'error' 
      })
      return
    }

    // Parse JSON expression if in JSON mode
    if (showJsonEditor) {
      try {
        const parsed = JSON.parse(jsonExpression)
        rule.condition_expression = parsed
      } catch (error) {
        setSnackbar({ 
          open: true, 
          message: 'Invalid JSON expression', 
          severity: 'error' 
        })
        return
      }
    }

    setLoading(true)
    try {
      if (editMode && rule.id) {
        await rulesService.updateRule(rule.id, rule)
        setSnackbar({ 
          open: true, 
          message: 'Rule updated successfully!', 
          severity: 'success' 
        })
      } else {
        await rulesService.createRule(rule)
        setSnackbar({ 
          open: true, 
          message: 'Rule created successfully!', 
          severity: 'success' 
        })
      }
      
      resetForm()
      loadRules()
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.message || 'Failed to save rule', 
        severity: 'error' 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (r: Rule) => {
    setRule(r)
    setJsonExpression(JSON.stringify(r.condition_expression, null, 2))
    setEditMode(true)
    setShowList(false)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return

    try {
      await rulesService.deleteRule(id)
      setSnackbar({ 
        open: true, 
        message: 'Rule deleted successfully!', 
        severity: 'success' 
      })
      loadRules()
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: 'Failed to delete rule', 
        severity: 'error' 
      })
    }
  }

  const resetForm = () => {
    setRule({
      code: '',
      name: '',
      description: '',
      rule_type: 'validation',
      trigger: 'pre_save',
      entity_type: 'sku',
      condition_expression: {},
      error_message: '',
      error_code: '',
      priority: 100,
      is_blocking: true,
    })
    setConditions([])
    setJsonExpression('{}')
    setEditMode(false)
    setTestResult(null)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {editMode ? 'Edit Business Rule' : 'Create Business Rule'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadRules}
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
            startIcon={<PlayArrow />}
            onClick={handleTestRule}
            disabled={!rule.id}
          >
            Test Rule
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
            Existing Rules
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
                    <TableCell>Type</TableCell>
                    <TableCell>Trigger</TableCell>
                    <TableCell>Entity</TableCell>
                    <TableCell>Blocking</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {existingRules.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{r.code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.rule_type}</TableCell>
                      <TableCell>{r.trigger}</TableCell>
                      <TableCell>{r.entity_type}</TableCell>
                      <TableCell>
                        {r.is_blocking && <Chip label="Yes" size="small" color="error" />}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleEdit(r)}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(r.id!)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {existingRules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        No rules found. Create your first rule!
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
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Rule Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Rule Code"
                  value={rule.code}
                  onChange={(e) => setRule({ ...rule, code: e.target.value })}
                  placeholder="e.g., size_required"
                  disabled={editMode}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Rule Name"
                  value={rule.name}
                  onChange={(e) => setRule({ ...rule, name: e.target.value })}
                  placeholder="e.g., Size Required for Apparel"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Description"
                  value={rule.description}
                  onChange={(e) => setRule({ ...rule, description: e.target.value })}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Rule Type</InputLabel>
                  <Select
                    value={rule.rule_type}
                    onChange={(e) => setRule({ ...rule, rule_type: e.target.value as any })}
                    label="Rule Type"
                  >
                    {ruleTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Trigger</InputLabel>
                  <Select
                    value={rule.trigger}
                    onChange={(e) => setRule({ ...rule, trigger: e.target.value as any })}
                    label="Trigger"
                  >
                    {triggers.map((trigger) => (
                      <MenuItem key={trigger.value} value={trigger.value}>
                        {trigger.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Entity Type"
                  value={rule.entity_type}
                  onChange={(e) => setRule({ ...rule, entity_type: e.target.value })}
                  placeholder="e.g., sku, product"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Rule Conditions
              </Typography>
              <Button
                size="small"
                startIcon={<Code />}
                onClick={() => setShowJsonEditor(!showJsonEditor)}
              >
                {showJsonEditor ? 'Visual Builder' : 'JSON Editor'}
              </Button>
            </Box>

            {showJsonEditor ? (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                <Editor
                  height="300px"
                  defaultLanguage="json"
                  value={jsonExpression}
                  onChange={(value) => setJsonExpression(value || '{}')}
                  theme="vs-light"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                  }}
                />
              </Box>
            ) : (
              <>
                {conditions.map((condition, index) => (
                  <Card key={index} sx={{ mb: 2, bgcolor: 'grey.50' }}>
                    <CardContent>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Field"
                            value={condition.field}
                            onChange={(e) => handleUpdateCondition(index, 'field', e.target.value)}
                            placeholder="e.g., size, price"
                          />
                        </Grid>
                        <Grid item xs={3}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Operator</InputLabel>
                            <Select
                              value={condition.operator}
                              onChange={(e) => handleUpdateCondition(index, 'operator', e.target.value)}
                              label="Operator"
                            >
                              {operators.map((op) => (
                                <MenuItem key={op.value} value={op.value}>
                                  {op.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Value"
                            value={condition.value}
                            onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                            placeholder="Comparison value"
                          />
                        </Grid>
                        <Grid item xs={1}>
                          <IconButton onClick={() => handleRemoveCondition(index)} size="small">
                            <Delete />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={handleAddCondition}
                  fullWidth
                >
                  Add Condition
                </Button>
              </>
            )}

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Error Handling
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  size="small"
                  label="Error Message"
                  value={rule.error_message}
                  onChange={(e) => setRule({ ...rule, error_message: e.target.value })}
                  placeholder="User-friendly error message"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Error Code"
                  value={rule.error_code}
                  onChange={(e) => setRule({ ...rule, error_code: e.target.value })}
                  placeholder="e.g., SIZE_REQUIRED"
                />
              </Grid>
            </Grid>

            {testResult && (
              <Alert
                severity={testResult.passed ? 'success' : 'error'}
                sx={{ mt: 2 }}
                onClose={() => setTestResult(null)}
              >
                {testResult.passed ? 'Rule test passed!' : testResult.error_message} 
                (Execution time: {testResult.execution_time_ms}ms)
              </Alert>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Rule Templates
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              Click to apply a template
            </Typography>
            {templates.map((template, index) => (
              <Card
                key={index}
                sx={{
                  mb: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: 3,
                    transform: 'translateY(-2px)',
                  },
                }}
                onClick={() => handleApplyTemplate(template)}
              >
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    {template.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {template.description}
                  </Typography>
                </CardContent>
              </Card>
            ))}

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              Rule Properties
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Chip
                label={`Priority: ${rule.priority}`}
                size="small"
                sx={{ mr: 1, mb: 1 }}
              />
              <Chip
                label={rule.is_blocking ? 'Blocking' : 'Non-blocking'}
                size="small"
                color={rule.is_blocking ? 'error' : 'default'}
                sx={{ mr: 1, mb: 1 }}
              />
            </Box>
          </Paper>
        </Grid>
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
