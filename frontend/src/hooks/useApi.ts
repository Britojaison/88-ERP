import { useState, useCallback } from 'react'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useApi<T>() {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(async (apiFunc: () => Promise<T>) => {
    setState({ data: null, loading: true, error: null })
    try {
      const result = await apiFunc()
      setState({ data: result, loading: false, error: null })
      return result
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'An error occurred'
      setState({ data: null, loading: false, error: errorMessage })
      throw err
    }
  }, [])

  return { ...state, execute }
}
