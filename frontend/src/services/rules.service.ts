import api from './api'

export interface Rule {
  id?: string
  code: string
  name: string
  description: string
  rule_type: 'validation' | 'calculation' | 'constraint'
  trigger: 'pre_save' | 'pre_submit' | 'pre_approve'
  entity_type: string
  condition_expression: any
  error_message: string
  error_code: string
  priority: number
  is_blocking: boolean
  status?: string
  created_at?: string
  updated_at?: string
}

export interface RuleExecution {
  id: string
  rule: string
  rule_code: string
  rule_name: string
  entity_type: string
  entity_id: string
  passed: boolean
  error_message: string
  execution_time_ms: number
  context: any
  created_at: string
}

export interface RuleTemplate {
  name: string
  description: string
  expression: any
  error_message: string
}

export const rulesService = {
  // Rules
  listRules: async (params?: {
    entity_type?: string
    rule_type?: string
    trigger?: string
  }): Promise<Rule[]> => {
    const response = await api.get('/rules/rules/', { params })
    return response.data
  },

  getRule: async (id: string): Promise<Rule> => {
    const response = await api.get(`/rules/rules/${id}/`)
    return response.data
  },

  createRule: async (data: Partial<Rule>): Promise<Rule> => {
    const response = await api.post('/rules/rules/', data)
    return response.data
  },

  updateRule: async (id: string, data: Partial<Rule>): Promise<Rule> => {
    const response = await api.patch(`/rules/rules/${id}/`, data)
    return response.data
  },

  deleteRule: async (id: string): Promise<void> => {
    await api.delete(`/rules/rules/${id}/`)
  },

  testRule: async (
    id: string,
    context: any
  ): Promise<{
    passed: boolean
    error_message: string
    execution_time_ms: number
    rule: {
      code: string
      name: string
      is_blocking: boolean
    }
  }> => {
    const response = await api.post(`/rules/rules/${id}/test/`, { context })
    return response.data
  },

  validateExpression: async (
    id: string,
    expression: any
  ): Promise<{
    valid: boolean
    error?: string
    message?: string
  }> => {
    const response = await api.post(`/rules/rules/${id}/validate_expression/`, { expression })
    return response.data
  },

  getTemplates: async (): Promise<RuleTemplate[]> => {
    const response = await api.get('/rules/rules/templates/')
    return response.data
  },

  // Rule Executions
  listExecutions: async (params?: {
    rule?: string
    entity_type?: string
    entity_id?: string
  }): Promise<RuleExecution[]> => {
    const response = await api.get('/rules/executions/', { params })
    return response.data
  },

  getExecution: async (id: string): Promise<RuleExecution> => {
    const response = await api.get(`/rules/executions/${id}/`)
    return response.data
  },
}
