import { useState, useCallback } from 'react'

const STORAGE_KEY = 'burndown_templates'
const ACTIVE_KEY  = 'burndown_active_template_id'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(templates) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch (err) {
    console.warn('Failed to save templates to localStorage:', err.message)
  }
}

function loadActiveIdFromStorage(templates) {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    if (!raw) return null
    const id = JSON.parse(raw)
    return templates.some(t => t.id === id) ? id : null
  } catch {
    return null
  }
}

function persistActiveId(id) {
  try {
    if (id == null) localStorage.removeItem(ACTIVE_KEY)
    else localStorage.setItem(ACTIVE_KEY, JSON.stringify(id))
  } catch (err) {
    console.warn('Failed to persist active template ID:', err.message)
  }
}

export function useTemplates() {
  const [templates, setTemplates] = useState(() => loadFromStorage())
  const [activeTemplateId, _setActiveTemplateId] = useState(() => {
    const tpls = loadFromStorage()
    return loadActiveIdFromStorage(tpls)
  })

  const setActiveTemplateId = useCallback((id) => {
    _setActiveTemplateId(id)
    persistActiveId(id)
  }, [])

  // Persist and update state together
  function persist(next) {
    setTemplates(next)
    saveToStorage(next)
  }

  // Save current app state as a new template
  const saveNew = useCallback((name, snapshot) => {
    const template = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Untitled',
      savedAt: new Date().toISOString(),
      snapshot,
    }
    const next = [template, ...templates]
    persist(next)
    setActiveTemplateId(template.id)
    return template
  }, [templates, setActiveTemplateId])

  // Overwrite an existing template's snapshot (keeping id, name)
  const overwrite = useCallback((id, snapshot) => {
    const next = templates.map(t =>
      t.id === id
        ? { ...t, snapshot, savedAt: new Date().toISOString() }
        : t
    )
    persist(next)
  }, [templates])

  // Rename a template
  const rename = useCallback((id, newName) => {
    const next = templates.map(t =>
      t.id === id ? { ...t, name: newName.trim() || t.name } : t
    )
    persist(next)
  }, [templates])

  // Delete a template
  const remove = useCallback((id) => {
    const next = templates.filter(t => t.id !== id)
    persist(next)
    if (activeTemplateId === id) setActiveTemplateId(null)
  }, [templates, activeTemplateId, setActiveTemplateId])

  // Get a template's snapshot by id
  const getSnapshot = useCallback((id) => {
    const t = templates.find(t => t.id === id)
    return t ? t.snapshot : null
  }, [templates])

  // Replace all templates at once (used when loading from cloud/file)
  const bulkLoad = useCallback((newTemplates) => {
    const arr = Array.isArray(newTemplates) ? newTemplates : []
    persist(arr)
  }, [])

  // Update specific fields in a template's snapshot (without loading it)
  const updateSnapshot = useCallback((id, partialSnapshot) => {
    const next = templates.map(t =>
      t.id === id
        ? { ...t, snapshot: { ...t.snapshot, ...partialSnapshot }, savedAt: new Date().toISOString() }
        : t
    )
    persist(next)
  }, [templates])

  // Duplicate a template — inserts copy directly after the original
  const duplicate = useCallback((id) => {
    const idx = templates.findIndex(t => t.id === id)
    if (idx === -1) return
    const original = templates[idx]
    const copy = {
      ...original,
      id: crypto.randomUUID(),
      name: `${original.name} (copy)`,
      savedAt: new Date().toISOString(),
    }
    const next = [
      ...templates.slice(0, idx + 1),
      copy,
      ...templates.slice(idx + 1),
    ]
    persist(next)
  }, [templates])

  return {
    templates,
    activeTemplateId,
    setActiveTemplateId,
    saveNew,
    overwrite,
    rename,
    remove,
    getSnapshot,
    duplicate,
    bulkLoad,
    updateSnapshot,
  }
}
