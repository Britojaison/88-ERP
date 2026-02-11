import api, { extractListData } from './api'

export interface AttributeOption {
  id?: string
  code: string
  label: string
  display_order: number
  status?: string
}

export interface AttributeDefinition {
  id?: string
  code: string
  name: string
  entity_type: string
  data_type: string
  is_required: boolean
  is_variant_dimension: boolean
  is_searchable: boolean
  is_filterable: boolean
  validation_rules: any
  display_order: number
  group?: string
  group_code?: string
  options?: AttributeOption[]
  status?: string
  created_at?: string
  updated_at?: string
}

export interface AttributeGroup {
  id?: string
  code: string
  name: string
  entity_type: string
  display_order: number
  attributes_count?: number
  status?: string
}

export const attributesService = {
  // Attribute Definitions
  listDefinitions: async (entityType?: string): Promise<AttributeDefinition[]> => {
    const params = entityType ? { entity_type: entityType } : {}
    const response = await api.get('/attributes/definitions/', { params })
    return extractListData<AttributeDefinition>(response.data)
  },

  getDefinition: async (id: string): Promise<AttributeDefinition> => {
    const response = await api.get(`/attributes/definitions/${id}/`)
    return response.data
  },

  createDefinition: async (data: Partial<AttributeDefinition>): Promise<AttributeDefinition> => {
    const response = await api.post('/attributes/definitions/', data)
    return response.data
  },

  updateDefinition: async (id: string, data: Partial<AttributeDefinition>): Promise<AttributeDefinition> => {
    const response = await api.patch(`/attributes/definitions/${id}/`, data)
    return response.data
  },

  deleteDefinition: async (id: string): Promise<void> => {
    await api.delete(`/attributes/definitions/${id}/`)
  },

  addOption: async (attributeId: string, option: AttributeOption): Promise<AttributeOption> => {
    const response = await api.post(`/attributes/definitions/${attributeId}/add_option/`, option)
    return response.data
  },

  removeOption: async (attributeId: string, optionId: string): Promise<void> => {
    await api.delete(`/attributes/definitions/${attributeId}/remove_option/`, {
      data: { option_id: optionId }
    })
  },

  validateValue: async (attributeId: string, value: any): Promise<{ valid: boolean; error?: string }> => {
    const response = await api.post(`/attributes/definitions/${attributeId}/validate_value/`, { value })
    return response.data
  },

  // Attribute Groups
  listGroups: async (entityType?: string): Promise<AttributeGroup[]> => {
    const params = entityType ? { entity_type: entityType } : {}
    const response = await api.get('/attributes/groups/', { params })
    return extractListData<AttributeGroup>(response.data)
  },

  getGroup: async (id: string): Promise<AttributeGroup> => {
    const response = await api.get(`/attributes/groups/${id}/`)
    return response.data
  },

  createGroup: async (data: Partial<AttributeGroup>): Promise<AttributeGroup> => {
    const response = await api.post('/attributes/groups/', data)
    return response.data
  },

  updateGroup: async (id: string, data: Partial<AttributeGroup>): Promise<AttributeGroup> => {
    const response = await api.patch(`/attributes/groups/${id}/`, data)
    return response.data
  },

  deleteGroup: async (id: string): Promise<void> => {
    await api.delete(`/attributes/groups/${id}/`)
  },
}
