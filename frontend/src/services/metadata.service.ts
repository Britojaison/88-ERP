import api, { extractListData } from './api'

export interface ConfigurationExport {
  version: string
  exported_at: string
  company_id: string
  attributes?: any
  workflows?: any
  rules?: any
  permissions?: any
  document_types?: any
  numbering?: any
}

export interface Template {
  id: string
  code: string
  name: string
  description: string
  industry: string
  usage_count: number
  configuration?: any
  sample_data?: any
}

export interface Sandbox {
  id: string
  name: string
  description: string
  status: string
  created_at: string
  created_by?: string
}

export interface ImportResult {
  success: boolean
  errors: string[]
  warnings: string[]
  imported: Record<string, number>
}

export interface ImpactAnalysis {
  entity_type: string
  entity_id: string
  affected_entities: Record<string, number>
  total_affected: number
}

export interface FashionReadiness {
  metrics: Record<string, number>
  stages: Array<{
    id: string
    name: string
    done: boolean
    required: string[]
  }>
  progress_percent: number
  advice: string[]
}

export const metadataService = {
  // Export/Import
  exportConfiguration: async (entityTypes?: string[], format: string = 'json'): Promise<Blob> => {
    const params: any = { format }
    if (entityTypes && entityTypes.length > 0) {
      params.entity_types = entityTypes.join(',')
    }
    
    const response = await api.get('/metadata/export/', {
      params,
      responseType: 'blob',
    })
    return response.data
  },

  importConfiguration: async (configuration: any, validateOnly: boolean = false): Promise<ImportResult> => {
    const response = await api.post('/metadata/import_config/', {
      configuration,
      validate_only: validateOnly,
    })
    return response.data
  },

  validateConfiguration: async (configuration: any): Promise<{ valid: boolean; errors: string[] }> => {
    const response = await api.post('/metadata/validate/', {
      configuration,
    })
    return response.data
  },

  getImpactAnalysis: async (entityType: string, entityId: string): Promise<ImpactAnalysis> => {
    const response = await api.get(`/metadata/impact/${entityType}/${entityId}/`)
    return response.data
  },

  bootstrapFashion: async (): Promise<ImportResult & { template?: Record<string, string> }> => {
    const response = await api.post('/metadata/fashion_bootstrap/', {}, { timeout: 30000 })
    return response.data
  },

  getFashionReadiness: async (): Promise<FashionReadiness> => {
    const response = await api.get('/metadata/fashion_readiness/', { timeout: 15000 })
    return response.data as FashionReadiness
  },

  // Templates
  listTemplates: async (industry?: string): Promise<Template[]> => {
    const params = industry ? { industry } : {}
    const response = await api.get('/templates/', { params })
    return extractListData<Template>(response.data)
  },

  getTemplate: async (id: string): Promise<Template> => {
    const response = await api.get(`/templates/${id}/`)
    return response.data
  },

  applyTemplate: async (id: string): Promise<ImportResult> => {
    const response = await api.post(`/templates/${id}/apply/`)
    return response.data
  },

  createTemplateFromCompany: async (name: string, industry: string): Promise<Template> => {
    const response = await api.post('/templates/create_from_company/', {
      name,
      industry,
    })
    return response.data
  },

  // Sandboxes
  listSandboxes: async (): Promise<Sandbox[]> => {
    const response = await api.get('/sandboxes/')
    return extractListData<Sandbox>(response.data)
  },

  createSandbox: async (name: string, changes: any): Promise<Sandbox> => {
    const response = await api.post('/sandboxes/', {
      name,
      changes,
    })
    return response.data
  },

  deploySandbox: async (id: string): Promise<ImportResult> => {
    const response = await api.post(`/sandboxes/${id}/deploy/`)
    return response.data
  },
}
