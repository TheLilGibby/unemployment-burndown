import { useState, useCallback, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''
const TOKEN_KEY = 'burndown_token'

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

async function apiFetch(path, opts = {}) {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export function useJobs() {
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
      return null
    }
  }, [])

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
      return null
    }
  }, [])

  const deleteJob = useCallback(async (jobId) => {
    setError(null)
    try {
      await apiFetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
      setJobs(prev => prev.filter(j => j.jobId !== jobId))
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }, [])

  return { jobs, loading, error, fetchJobs, createJob, updateJob, deleteJob }
}
