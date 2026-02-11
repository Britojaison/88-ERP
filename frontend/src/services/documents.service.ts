import api, { extractListData } from './api'

export interface Document {
  id: string
  document_type: string
  document_number: string
  document_date?: string
  status: string
  date: string
  total_amount?: number
  notes?: string
  lines: DocumentLine[]
  created_at: string
  updated_at: string
}

export interface DocumentTypeOption {
  id: string
  code: string
  name: string
}

export interface DocumentLine {
  id: string
  sku: string
  quantity: number
  unit_price?: number
  total_price?: number
}

export const documentsService = {
  getDocuments: async (params?: any) => {
    const response = await api.get('/documents/', { params })
    return extractListData<Document>(response.data)
  },

  getDocument: async (id: string) => {
    const response = await api.get(`/documents/${id}/`)
    return response.data
  },

  createDocument: async (data: Partial<Document>) => {
    const response = await api.post('/documents/', data)
    return response.data
  },

  updateDocument: async (id: string, data: Partial<Document>) => {
    const response = await api.put(`/documents/${id}/`, data)
    return response.data
  },

  deleteDocument: async (id: string) => {
    await api.delete(`/documents/${id}/`)
  },

  getDocumentTypes: async (): Promise<DocumentTypeOption[]> => {
    const response = await api.get('/documents/types/')
    return extractListData<DocumentTypeOption>(response.data)
  },
}
