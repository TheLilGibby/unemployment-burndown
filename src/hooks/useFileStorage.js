import { useState, useEffect, useCallback } from 'react'
import { idbGet, idbSet, idbDel } from '../utils/idb'

const IDB_KEY = 'burndown_file_handle'

const FILE_TYPES = [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]

/**
 * Manages a FileSystemFileHandle stored in IndexedDB so the user
 * only has to pick their file once per browser session / permission grant.
 *
 * status values:
 *   'idle'             – no file ever linked
 *   'needs-permission' – handle restored from IDB but needs user gesture to re-grant
 *   'connected'        – handle ready, file can be read/written
 *   'saving'           – write in progress
 *   'error'            – last operation failed
 *
 * restoreData: parsed JSON from the file after an automatic restore on mount.
 *              Consumed and cleared by the caller (App.jsx).
 */
export function useFileStorage() {
  const isSupported = typeof window !== 'undefined' && 'showOpenFilePicker' in window

  const [fileHandle, setFileHandle]   = useState(null)
  const [status, setStatus]           = useState('idle')
  const [lastSaved, setLastSaved]     = useState(null)
  const [errorMsg, setErrorMsg]       = useState(null)
  const [restoreData, setRestoreData] = useState(null)

  // On mount: try to restore the previously-used file handle
  useEffect(() => {
    if (!isSupported) return
    async function tryRestore() {
      try {
        const handle = await idbGet(IDB_KEY)
        if (!handle) return
        const perm = await handle.queryPermission({ mode: 'readwrite' })
        if (perm === 'granted') {
          setFileHandle(handle)
          setStatus('connected')
          const file = await handle.getFile()
          const data = JSON.parse(await file.text())
          setRestoreData(data)
        } else {
          // Prompt will be needed — show a "Reconnect" button
          setFileHandle(handle)
          setStatus('needs-permission')
        }
      } catch {
        // IndexedDB unavailable, handle stale, or JSON malformed — ignore
      }
    }
    tryRestore()
  }, [isSupported])

  const clearRestoreData = useCallback(() => setRestoreData(null), [])

  // Open an existing .json file
  const openFile = useCallback(async () => {
    try {
      const [handle] = await window.showOpenFilePicker({ types: FILE_TYPES })
      await idbSet(IDB_KEY, handle)
      setFileHandle(handle)
      setStatus('connected')
      setErrorMsg(null)
      const file = await handle.getFile()
      return JSON.parse(await file.text())
    } catch (e) {
      if (e.name !== 'AbortError') {
        setStatus('error')
        setErrorMsg(e.message)
      }
      return null
    }
  }, [])

  // Create a new .json file (save-as dialog) and write initial data
  const createFile = useCallback(async (data) => {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'burndown.json',
        types: FILE_TYPES,
      })
      await idbSet(IDB_KEY, handle)
      setFileHandle(handle)
      setStatus('saving')
      setErrorMsg(null)
      let writable
      try {
        writable = await handle.createWritable()
        await writable.write(JSON.stringify(data, null, 2))
        await writable.close()
        writable = null
        setStatus('connected')
        setLastSaved(new Date())
      } finally {
        if (writable) writable.abort().catch(() => {})
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setStatus('error')
        setErrorMsg(e.message)
      }
    }
  }, [])

  // Write current state to the open file handle
  const saveToFile = useCallback(async (data) => {
    if (!fileHandle) return
    let writable
    try {
      setStatus('saving')
      writable = await fileHandle.createWritable()
      await writable.write(JSON.stringify(data, null, 2))
      await writable.close()
      writable = null
      setStatus('connected')
      setLastSaved(new Date())
      setErrorMsg(null)
    } catch (e) {
      setStatus('error')
      setErrorMsg(e.message)
    } finally {
      if (writable) writable.abort().catch(() => {})
    }
  }, [fileHandle])

  // Re-request permission on a handle that was restored but not yet permitted
  const reconnect = useCallback(async () => {
    if (!fileHandle) return null
    try {
      const perm = await fileHandle.requestPermission({ mode: 'readwrite' })
      if (perm === 'granted') {
        setStatus('connected')
        setErrorMsg(null)
        const file = await fileHandle.getFile()
        return JSON.parse(await file.text())
      }
      return null
    } catch (e) {
      setStatus('error')
      setErrorMsg(e.message || 'Failed to reconnect to file')
      return null
    }
  }, [fileHandle])

  // Forget the file handle entirely
  const disconnect = useCallback(async () => {
    await idbDel(IDB_KEY)
    setFileHandle(null)
    setStatus('idle')
    setLastSaved(null)
    setErrorMsg(null)
    setRestoreData(null)
  }, [])

  return {
    isSupported,
    fileHandle,
    fileName: fileHandle?.name ?? null,
    status,
    lastSaved,
    errorMsg,
    restoreData,
    clearRestoreData,
    openFile,
    createFile,
    saveToFile,
    reconnect,
    disconnect,
  }
}
