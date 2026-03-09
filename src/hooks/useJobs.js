import { useState, useCallback, useEffect } from 'react'
import { apiFetch, getToken } from '../utils/apiClient'
import { useToast } from '../context/ToastContext'

export function useJobs() {
  const toast = useToast()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchJobs = useCallback(async () => {
    if (!getToken()) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch('/api/jobs')
      setJobs(data.jobs || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const createJob = useCallback(async (jobData) => {
    setError(null)
    try {
      const data = await apiFetch('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(jobData),
      })
      setJobs(prev => [...prev, data.job])
      return data.job
    } catch (err) {
      setError(err.message)
      toast.error('Create Job Failed', err.message)
      return null
    }
  }, [toast])

  const updateJob = useCallback(async (jobId, updates) => {
    setError(null)
    try {
      const data = await apiFetch(`/api/jobs/${jobId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
      setJobs(prev => prev.map(j => j.jobId === jobId ? data.job : j))
      return data.job
    } catch (err) {
      setError(err.message)
      toast.error('Update Job Failed', err.message)
      return null
    }
  }, [toast])

  const deleteJob = useCallback(async (jobId) => {
    setError(null)
    try {
      await apiFetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
      setJobs(prev => prev.filter(j => j.jobId !== jobId))
      return true
    } catch (err) {
      setError(err.message)
      toast.error('Delete Job Failed', err.message)
      return false
    }
  }, [toast])

  return { jobs, loading, error, fetchJobs, createJob, updateJob, deleteJob }
}
