import { useCallback, useState, useEffect } from 'react'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  Connection,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Box,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Typography,
  Toolbar,
  Snackbar,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
} from '@mui/material'
import {
  Add,
  PlayArrow,
  Refresh,
  Edit,
  Delete,
} from '@mui/icons-material'
import { workflowsService, Workflow } from '../../services'

interface WorkflowStateData {
  id?: string
  code: string
  name: string
  is_initial: boolean
  is_final: boolean
  allow_edit: boolean
  allow_delete: boolean
}

export default function WorkflowDesigner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [openStateDialog, setOpenStateDialog] = useState(false)
  const [openTransitionDialog, setOpenTransitionDialog] = useState(false)
  const [openWorkflowDialog, setOpenWorkflowDialog] = useState(false)
  const [showList, setShowList] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null)
  
  const [newWorkflow, setNewWorkflow] = useState({
    code: '',
    name: '',
    description: '',
    entity_type: 'document',
  })

  const [newState, setNewState] = useState<WorkflowStateData>({
    code: '',
    name: '',
    is_initial: false,
    is_final: false,
    allow_edit: true,
    allow_delete: false,
  })

  const [newTransition, setNewTransition] = useState({
    name: '',
    requires_approval: false,
    approver_role: '',
    condition_expression: {},
  })

  const [snackbar, setSnackbar] = useState({ 
    open: false, 
    message: '', 
    severity: 'success' as 'success' | 'error' | 'info' 
  })

  useEffect(() => {
    loadWorkflows()
  }, [])

  const loadWorkflows = async () => {
    setLoadingList(true)
    try {
      const data = await workflowsService.listWorkflows()
      setWorkflows(data)
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: 'Failed to load workflows', 
        severity: 'error' 
      })
    } finally {
      setLoadingList(false)
    }
  }

  const loadWorkflowDetails = async (workflow: Workflow) => {
    try {
      const details = await workflowsService.getWorkflow(workflow.id!)
      setSelectedWorkflow(details)
      
      // Build nodes from states
      const newNodes: Node[] = (details.states || []).map((state, index) => ({
        id: state.id!,
        type: 'default',
        data: { label: state.name },
        position: { x: (index % 3) * 250 + 100, y: Math.floor(index / 3) * 150 + 50 },
        style: {
          background: state.is_initial ? '#667eea' : state.is_final ? '#fa709a' : '#4facfe',
          color: 'white',
          border: `2px solid ${state.is_initial ? '#667eea' : state.is_final ? '#fa709a' : '#4facfe'}`,
        },
      }))
      
      // Build edges from transitions
      const newEdges: Edge[] = (details.transitions || []).map((trans) => ({
        id: trans.id!,
        source: trans.from_state,
        target: trans.to_state,
        type: 'smoothstep',
        animated: true,
        label: trans.name,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      }))
      
      setNodes(newNodes)
      setEdges(newEdges)
      setShowList(false)
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: 'Failed to load workflow details', 
        severity: 'error' 
      })
    }
  }

  const onConnect = useCallback(
    (params: Connection) => {
      setPendingConnection(params)
      setOpenTransitionDialog(true)
    },
    []
  )

  const handleCreateWorkflow = async () => {
    if (!newWorkflow.code || !newWorkflow.name) {
      setSnackbar({ 
        open: true, 
        message: 'Code and Name are required', 
        severity: 'error' 
      })
      return
    }

    setLoading(true)
    try {
      const created = await workflowsService.createWorkflow(newWorkflow)
      setSnackbar({ 
        open: true, 
        message: 'Workflow created successfully!', 
        severity: 'success' 
      })
      setOpenWorkflowDialog(false)
      setNewWorkflow({ code: '', name: '', description: '', entity_type: 'document' })
      loadWorkflows()
      loadWorkflowDetails(created)
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.message || 'Failed to create workflow', 
        severity: 'error' 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddState = async () => {
    if (!selectedWorkflow || !newState.name) {
      setSnackbar({ 
        open: true, 
        message: 'Workflow and State Name are required', 
        severity: 'error' 
      })
      return
    }

    setLoading(true)
    try {
      const state = await workflowsService.addState(selectedWorkflow.id!, {
        ...newState,
        workflow: selectedWorkflow.id!,
      } as any)
      
      const newNode: Node = {
        id: state.id!,
        type: 'default',
        data: { label: state.name },
        position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
        style: {
          background: state.is_initial ? '#667eea' : state.is_final ? '#fa709a' : '#4facfe',
          color: 'white',
          border: `2px solid ${state.is_initial ? '#667eea' : state.is_final ? '#fa709a' : '#4facfe'}`,
        },
      }

      setNodes((nds) => [...nds, newNode])
      setOpenStateDialog(false)
      setNewState({
        code: '',
        name: '',
        is_initial: false,
        is_final: false,
        allow_edit: true,
        allow_delete: false,
      })
      setSnackbar({ 
        open: true, 
        message: 'State added successfully!', 
        severity: 'success' 
      })
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.message || 'Failed to add state', 
        severity: 'error' 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTransition = async () => {
    if (!selectedWorkflow || !pendingConnection) return

    setLoading(true)
    try {
      const transition = await workflowsService.addTransition(selectedWorkflow.id!, {
        ...newTransition,
        from_state: pendingConnection.source!,
        to_state: pendingConnection.target!,
        workflow: selectedWorkflow.id!,
        display_order: edges.length + 1,
        actions: [],
      } as any)

      const edge: Edge = {
        id: transition.id!,
        source: pendingConnection.source!,
        target: pendingConnection.target!,
        type: 'smoothstep',
        animated: true,
        label: transition.name,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      }
      
      setEdges((eds) => addEdge(edge, eds))
      setOpenTransitionDialog(false)
      setPendingConnection(null)
      setNewTransition({
        name: '',
        requires_approval: false,
        approver_role: '',
        condition_expression: {},
      })
      setSnackbar({ 
        open: true, 
        message: 'Transition added successfully!', 
        severity: 'success' 
      })
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.message || 'Failed to add transition', 
        severity: 'error' 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTestWorkflow = async () => {
    if (!selectedWorkflow) return

    try {
      const result = await workflowsService.validateWorkflow(selectedWorkflow.id!)
      if (result.valid) {
        setSnackbar({ 
          open: true, 
          message: 'Workflow validation passed!', 
          severity: 'success' 
        })
      } else {
        setSnackbar({ 
          open: true, 
          message: `Validation errors: ${result.errors.join(', ')}`, 
          severity: 'error' 
        })
      }
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: 'Failed to validate workflow', 
        severity: 'error' 
      })
    }
  }

  const handleDeleteWorkflow = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this workflow?')) return

    try {
      await workflowsService.deleteWorkflow(id)
      setSnackbar({ 
        open: true, 
        message: 'Workflow deleted successfully!', 
        severity: 'success' 
      })
      loadWorkflows()
      if (selectedWorkflow?.id === id) {
        setSelectedWorkflow(null)
        setNodes([])
        setEdges([])
      }
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: 'Failed to delete workflow', 
        severity: 'error' 
      })
    }
  }

  return (
    <Box sx={{ height: '700px', width: '100%' }}>
      <Toolbar sx={{ mb: 2, gap: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpenWorkflowDialog(true)}
          sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
          New Workflow
        </Button>
        {selectedWorkflow && (
          <>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={() => setOpenStateDialog(true)}
            >
              Add State
            </Button>
            <Button
              variant="outlined"
              startIcon={<PlayArrow />}
              onClick={handleTestWorkflow}
            >
              Validate
            </Button>
          </>
        )}
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadWorkflows}
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
        <Box sx={{ flexGrow: 1 }} />
        {selectedWorkflow && (
          <Typography variant="body2" color="text.secondary">
            Editing: {selectedWorkflow.name}
          </Typography>
        )}
      </Toolbar>

      {showList && (
        <Paper sx={{ p: 3, mb: 2, maxHeight: 300, overflow: 'auto' }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            Existing Workflows
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
                    <TableCell>States</TableCell>
                    <TableCell>Transitions</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workflows.map((wf) => (
                    <TableRow key={wf.id} hover>
                      <TableCell>{wf.code}</TableCell>
                      <TableCell>{wf.name}</TableCell>
                      <TableCell>{wf.entity_type}</TableCell>
                      <TableCell>{wf.states?.length || 0}</TableCell>
                      <TableCell>{wf.transitions?.length || 0}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => loadWorkflowDetails(wf)}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteWorkflow(wf.id!)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {workflows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No workflows found. Create your first workflow!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      <Paper sx={{ height: showList ? 'calc(100% - 380px)' : 'calc(100% - 80px)', position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </Paper>

      {/* Create Workflow Dialog */}
      <Dialog open={openWorkflowDialog} onClose={() => setOpenWorkflowDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Workflow</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Workflow Code"
            value={newWorkflow.code}
            onChange={(e) => setNewWorkflow({ ...newWorkflow, code: e.target.value })}
            margin="normal"
            placeholder="e.g., purchase_order_approval"
          />
          <TextField
            fullWidth
            label="Workflow Name"
            value={newWorkflow.name}
            onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
            margin="normal"
            placeholder="e.g., Purchase Order Approval"
          />
          <TextField
            fullWidth
            label="Description"
            value={newWorkflow.description}
            onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
            margin="normal"
            multiline
            rows={2}
          />
          <TextField
            fullWidth
            label="Entity Type"
            value={newWorkflow.entity_type}
            onChange={(e) => setNewWorkflow({ ...newWorkflow, entity_type: e.target.value })}
            margin="normal"
            placeholder="e.g., document, product"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenWorkflowDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateWorkflow} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add State Dialog */}
      <Dialog open={openStateDialog} onClose={() => setOpenStateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Workflow State</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="State Code"
            value={newState.code}
            onChange={(e) => setNewState({ ...newState, code: e.target.value })}
            margin="normal"
            placeholder="e.g., draft, approved"
          />
          <TextField
            fullWidth
            label="State Name"
            value={newState.name}
            onChange={(e) => setNewState({ ...newState, name: e.target.value })}
            margin="normal"
            placeholder="e.g., Draft, Approved"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={newState.is_initial}
                onChange={(e) => setNewState({ ...newState, is_initial: e.target.checked })}
              />
            }
            label="Initial State"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={newState.is_final}
                onChange={(e) => setNewState({ ...newState, is_final: e.target.checked })}
              />
            }
            label="Final State"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={newState.allow_edit}
                onChange={(e) => setNewState({ ...newState, allow_edit: e.target.checked })}
              />
            }
            label="Allow Edit"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={newState.allow_delete}
                onChange={(e) => setNewState({ ...newState, allow_delete: e.target.checked })}
              />
            }
            label="Allow Delete"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenStateDialog(false)}>Cancel</Button>
          <Button onClick={handleAddState} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Add State'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transition Dialog */}
      <Dialog open={openTransitionDialog} onClose={() => setOpenTransitionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Configure Transition</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Transition Name"
            value={newTransition.name}
            onChange={(e) => setNewTransition({ ...newTransition, name: e.target.value })}
            margin="normal"
            placeholder="e.g., Submit for Approval"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={newTransition.requires_approval}
                onChange={(e) => setNewTransition({ ...newTransition, requires_approval: e.target.checked })}
              />
            }
            label="Requires Approval"
          />
          <TextField
            fullWidth
            label="Approver Role"
            value={newTransition.approver_role}
            onChange={(e) => setNewTransition({ ...newTransition, approver_role: e.target.value })}
            margin="normal"
            placeholder="e.g., manager"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenTransitionDialog(false)
            setPendingConnection(null)
          }}>Cancel</Button>
          <Button onClick={handleSaveTransition} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Save Transition'}
          </Button>
        </DialogActions>
      </Dialog>

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
