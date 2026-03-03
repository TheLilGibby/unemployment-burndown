import { useState, useRef, useEffect } from 'react'

function SaveIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
      <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  )
}

function DuplicateIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
      <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
    </svg>
  )
}

export default function TemplateManager({
  templates,
  activeTemplateId,
  onLoad,
  onSave,
  onSaveNew,
  onRename,
  onDelete,
  onDuplicate,
  onUpdateSnapshot,
}) {
  const [open, setOpen] = useState(false)
  // 'idle' | 'saving-new' | 'renaming:{id}'
  const [mode, setMode] = useState('idle')
  const [inputVal, setInputVal] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [editingDateId, setEditingDateId] = useState(null)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)
  const dateInputRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
        setMode('idle')
        setConfirmDeleteId(null)
        setEditingDateId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Auto-focus input when mode changes
  useEffect(() => {
    if ((mode === 'saving-new' || mode.startsWith('renaming:')) && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [mode])

  // Auto-focus date input when editing
  useEffect(() => {
    if (editingDateId !== null && dateInputRef.current) {
      dateInputRef.current.focus()
    }
  }, [editingDateId])

  function handleDateChange(id, newDate) {
    if (onUpdateSnapshot) onUpdateSnapshot(id, { furloughDate: newDate })
    setEditingDateId(null)
  }

  const activeTemplate = templates.find(t => t.id === activeTemplateId)

  function handleSaveClick() {
    if (activeTemplateId) {
      // Overwrite existing — flash confirmation
      onSave(activeTemplateId)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } else {
      // No active template — open Save As flow
      setOpen(true)
      setMode('saving-new')
      setInputVal('My Config')
    }
  }

  function handleSaveNew() {
    const name = inputVal.trim()
    if (!name) return
    onSaveNew(name)
    setMode('idle')
    setInputVal('')
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  function handleStartRename(id, currentName) {
    setMode(`renaming:${id}`)
    setInputVal(currentName)
  }

  function handleCommitRename(id) {
    if (inputVal.trim()) onRename(id, inputVal.trim())
    setMode('idle')
    setInputVal('')
  }

  function handleLoad(id) {
    onLoad(id)
    setOpen(false)
    setMode('idle')
  }

  function handleDelete(id) {
    if (confirmDeleteId === id) {
      onDelete(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
    }
  }

  function formatSavedAt(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  return (
    <div className="flex items-center gap-0" ref={dropdownRef}>
      {/* Combined template name + save + dropdown trigger */}
      <div className="relative flex items-center">
        <div className="flex items-center h-8 rounded-lg"
          style={{ border: activeTemplateId ? '1px solid var(--border-subtle, rgba(255,255,255,0.08))' : 'none' }}
        >
          {/* Save button */}
          <button
            onClick={handleSaveClick}
            className={`h-8 flex items-center justify-center rounded-l-lg transition-all px-2 ${
              savedFlash
                ? 'text-emerald-400'
                : 'hover:bg-white/10'
            }`}
            style={!savedFlash ? { color: activeTemplateId ? 'var(--accent-blue, #3b82f6)' : 'var(--text-muted)' } : undefined}
            title={savedFlash ? 'Saved!' : activeTemplateId ? `Save to "${activeTemplate?.name}"` : 'Save as new template'}
          >
            {savedFlash ? <CheckIcon /> : <SaveIcon />}
          </button>

          {/* Template name + dropdown toggle */}
          <button
            onClick={() => { setOpen(o => !o); setMode('idle'); setConfirmDeleteId(null) }}
            className="h-8 flex items-center gap-1 rounded-r-lg transition-colors hover:bg-white/10 pr-1.5"
            style={{ color: activeTemplateId ? 'var(--text-primary, #e5e7eb)' : 'var(--text-muted)' }}
            title={activeTemplate ? `Templates: ${activeTemplate.name}` : 'Templates'}
          >
            {activeTemplate && (
              <span className="text-xs font-medium truncate max-w-[120px] sm:max-w-[180px]">{activeTemplate.name}</span>
            )}
            <ChevronDownIcon />
          </button>
        </div>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-72 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl z-50 overflow-hidden">

            {/* Save As new template */}
            {mode === 'saving-new' ? (
              <div className="p-3 border-b border-gray-700">
                <p className="text-xs text-gray-400 mb-2 font-medium">Save current config as:</p>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveNew(); if (e.key === 'Escape') setMode('idle') }}
                    className="flex-1 bg-gray-700 border border-blue-500 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none"
                    placeholder="Template name"
                  />
                  <button onClick={handleSaveNew} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 border-b border-gray-700">
                <button
                  onClick={() => { setMode('saving-new'); setInputVal('My Config') }}
                  className="w-full text-left text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center gap-2 transition-colors"
                >
                  <span className="text-lg leading-none">+</span>
                  <span>Save current config as new template</span>
                </button>
              </div>
            )}

            {/* Template list */}
            <div className="max-h-72 overflow-y-auto">
              {templates.length === 0 ? (
                <p className="text-gray-600 text-xs text-center py-6 px-4">
                  No saved templates yet. Use "Save" to create one.
                </p>
              ) : (
                templates.map(t => (
                  <div
                    key={t.id}
                    className={`group flex items-center gap-2 px-3 py-2.5 border-b border-gray-700/50 last:border-0 transition-colors ${
                      t.id === activeTemplateId ? 'bg-blue-950/40' : 'hover:bg-gray-700/40'
                    }`}
                  >
                    {/* Load / rename inline */}
                    <div className="flex-1 min-w-0">
                      {mode === `renaming:${t.id}` ? (
                        <div className="flex gap-1.5">
                          <input
                            ref={inputRef}
                            type="text"
                            value={inputVal}
                            onChange={e => setInputVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleCommitRename(t.id); if (e.key === 'Escape') setMode('idle') }}
                            className="flex-1 bg-gray-700 border border-blue-500 rounded px-2 py-0.5 text-white text-sm outline-none"
                          />
                          <button onClick={() => handleCommitRename(t.id)} className="text-emerald-400 hover:text-emerald-300">
                            <CheckIcon />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleLoad(t.id)}
                          className="text-left w-full"
                        >
                          <p className={`text-sm font-medium truncate ${t.id === activeTemplateId ? 'text-blue-300' : 'text-white'}`}>
                            {t.id === activeTemplateId && <span className="text-blue-400 mr-1">●</span>}
                            {t.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">Saved {formatSavedAt(t.savedAt)}</p>
                        </button>
                      )}
                      {/* Furlough / start date inline editor */}
                      {mode !== `renaming:${t.id}` && (
                        <div className="flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
                          <span className="text-gray-600" style={{ flexShrink: 0 }}><CalendarIcon /></span>
                          {editingDateId === t.id ? (
                            <input
                              ref={dateInputRef}
                              type="date"
                              defaultValue={t.snapshot?.furloughDate || ''}
                              onBlur={e => handleDateChange(t.id, e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleDateChange(t.id, e.target.value)
                                if (e.key === 'Escape') setEditingDateId(null)
                              }}
                              className="text-xs bg-gray-700 border border-blue-500 rounded px-1.5 py-0.5 text-white outline-none"
                              style={{ colorScheme: 'dark' }}
                            />
                          ) : (
                            <button
                              onClick={() => setEditingDateId(t.id)}
                              className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
                              title="Edit start / furlough date"
                            >
                              {t.snapshot?.furloughDate
                                ? new Date(t.snapshot.furloughDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : 'Set start date'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    {mode !== `renaming:${t.id}` && (
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleStartRename(t.id, t.name)}
                          className="p-1 text-gray-500 hover:text-blue-400 rounded transition-colors"
                          title="Rename"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          onClick={() => { onDuplicate(t.id); setConfirmDeleteId(null) }}
                          className="p-1 text-gray-500 hover:text-emerald-400 rounded transition-colors"
                          title="Duplicate"
                        >
                          <DuplicateIcon />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className={`p-1 rounded transition-colors ${
                            confirmDeleteId === t.id
                              ? 'text-red-400 bg-red-950/40'
                              : 'text-gray-500 hover:text-red-400'
                          }`}
                          title={confirmDeleteId === t.id ? 'Click again to confirm delete' : 'Delete'}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
