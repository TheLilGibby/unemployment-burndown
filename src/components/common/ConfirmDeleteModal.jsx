import { useEffect, useRef } from 'react'

export default function ConfirmDeleteModal({ itemName, onConfirm, onCancel }) {
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="theme-card rounded-2xl border shadow-2xl w-full max-w-sm pointer-events-auto p-6"
          role="alertdialog"
          aria-labelledby="confirm-delete-title"
          aria-describedby="confirm-delete-desc"
        >
          {/* Warning icon */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#ef4444" className="w-5 h-5">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>

          <h3 id="confirm-delete-title" className="text-center text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            Delete {itemName}?
          </h3>
          <p id="confirm-delete-desc" className="text-center text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            This action cannot be undone.
          </p>

          <div className="flex gap-3">
            <button
              ref={cancelRef}
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
              style={{ background: '#ef4444' }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
