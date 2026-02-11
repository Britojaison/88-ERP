import api, { extractListData } from './api'

export interface Report {
  id: string
  name: string
  type: string
  parameters?: Record<string, any>
  created_at: string
}

export interface ReportType {
  value: string
  label: string
}

export const reportingService = {
  getReports: async (params?: any) => {
    const response = await api.get('/reporting/reports/', { params })
    return extractListData<Report>(response.data)
  },

  generateReport: async (reportType: string, parameters?: any) => {
    const response = await api.post('/reporting/generate/', {
      report_type: reportType,
      parameters,
    })
    return response.data
  },

  downloadReport: async (id: string, format: string = 'pdf') => {
    const response = await api.get(`/reporting/reports/${id}/download/`, {
      params: { format },
      responseType: 'blob',
    })
    return response.data
  },

  getReportTypes: async (): Promise<ReportType[]> => {
    const response = await api.get('/reporting/types/')
    return extractListData<ReportType>(response.data)
  },
}
