import api from './api'

export interface WorkflowState {
  id?: string
  code: string
  name: string
  is_initial: boolean
  is_final: boolean
  allow_edit: boolean
  allow_delete: boolean
  status?: string
}

export interface WorkflowTransition {
  id?: string
  from_state: string
  from_state_code?: string
  to_state: string
  to_state_code?: string
  name: string
  condition_expression: any
  requires_approval: boolean
  approver_role?: string
  approver_role_code?: string
  actions: any[]
  display_order: number
  status?: string
}

export interface Workflow {
  id?: string
  code: string
  name: string
  description: string
  entity_type: string
  initial_state?: string
  initial_state_code?: string
  states?: WorkflowState[]
  transitions?: WorkflowTransition[]
  status?: string
  created_at?: string
  updated_at?: string
}

export const workflowsService = {
  // Workflows
  listWorkflows: async (entityType?: string): Promise<Workflow[]> => {
    const params = entityType ? { entity_type: entityType } : {}
    const response = await api.get('/workflow/workflows/', { params })
    return response.data
  },

  getWorkflow: async (id: string): Promise<Workflow> => {
    const response = await api.get(`/workflow/workflows/${id}/`)
    return response.data
  },

  createWorkflow: async (data: Partial<Workflow>): Promise<Workflow> => {
    const response = await api.post('/workflow/workflows/', data)
    return response.data
  },

  updateWorkflow: async (id: string, data: Partial<Workflow>): Promise<Workflow> => {
    const response = await api.patch(`/workflow/workflows/${id}/`, data)
    return response.data
  },

  deleteWorkflow: async (id: string): Promise<void> => {
    await api.delete(`/workflow/workflows/${id}/`)
  },

  addState: async (workflowId: string, state: WorkflowState): Promise<WorkflowState> => {
    const response = await api.post(`/workflow/workflows/${workflowId}/add_state/`, state)
    return response.data
  },

  addTransition: async (workflowId: string, transition: WorkflowTransition): Promise<WorkflowTransition> => {
    const response = await api.post(`/workflow/workflows/${workflowId}/add_transition/`, transition)
    return response.data
  },

  validateWorkflow: async (workflowId: string): Promise<{ valid: boolean; errors: string[] }> => {
    const response = await api.post(`/workflow/workflows/${workflowId}/validate/`)
    return response.data
  },

  testTransition: async (
    workflowId: string,
    fromState: string,
    toState: string,
    context: any
  ): Promise<{
    allowed: boolean
    transition?: WorkflowTransition
    requires_approval?: boolean
    approver_role?: string
    error?: string
  }> => {
    const response = await api.post(`/workflow/workflows/${workflowId}/test_transition/`, {
      from_state: fromState,
      to_state: toState,
      context,
    })
    return response.data
  },

  // States
  listStates: async (workflowId?: string): Promise<WorkflowState[]> => {
    const params = workflowId ? { workflow: workflowId } : {}
    const response = await api.get('/workflow/states/', { params })
    return response.data
  },

  getState: async (id: string): Promise<WorkflowState> => {
    const response = await api.get(`/workflow/states/${id}/`)
    return response.data
  },

  createState: async (data: Partial<WorkflowState>): Promise<WorkflowState> => {
    const response = await api.post('/workflow/states/', data)
    return response.data
  },

  updateState: async (id: string, data: Partial<WorkflowState>): Promise<WorkflowState> => {
    const response = await api.patch(`/workflow/states/${id}/`, data)
    return response.data
  },

  deleteState: async (id: string): Promise<void> => {
    await api.delete(`/workflow/states/${id}/`)
  },

  // Transitions
  listTransitions: async (workflowId?: string): Promise<WorkflowTransition[]> => {
    const params = workflowId ? { workflow: workflowId } : {}
    const response = await api.get('/workflow/transitions/', { params })
    return response.data
  },

  getTransition: async (id: string): Promise<WorkflowTransition> => {
    const response = await api.get(`/workflow/transitions/${id}/`)
    return response.data
  },

  createTransition: async (data: Partial<WorkflowTransition>): Promise<WorkflowTransition> => {
    const response = await api.post('/workflow/transitions/', data)
    return response.data
  },

  updateTransition: async (id: string, data: Partial<WorkflowTransition>): Promise<WorkflowTransition> => {
    const response = await api.patch(`/workflow/transitions/${id}/`, data)
    return response.data
  },

  deleteTransition: async (id: string): Promise<void> => {
    await api.delete(`/workflow/transitions/${id}/`)
  },
}
