import { useEffect } from 'react'

/**
 * Warns users when closing or refreshing the browser with unsaved changes.
 * Registers a beforeunload handler that triggers the browser's native
 * "Leave site?" confirmation dialog.
 *
 * @param {boolean} isDirty - Whether there are unsaved changes
 */
export function useUnsavedChangesWarning(isDirty) {
  useEffect(() => {
    if (!isDirty) return

    function handleBeforeUnload(e) {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])
}
