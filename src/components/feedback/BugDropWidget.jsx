import { useEffect, useRef } from 'react'
import { useTheme } from '../../context/ThemeContext'

const SCRIPT_URL = 'https://bugdrop.neonwatty.workers.dev/widget.v1.js'
const REPO = 'RAG-Consulting-LLC/unemployment-burndown'

export default function BugDropWidget() {
  const { resolved } = useTheme()
  const scriptRef = useRef(null)

  // Load the BugDrop widget script on mount
  useEffect(() => {
    // Avoid loading twice
    if (document.querySelector(`script[src="${SCRIPT_URL}"]`)) return

    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.setAttribute('data-repo', REPO)
    script.setAttribute('data-theme', resolved)
    script.setAttribute('data-position', 'bottom-right')
    script.setAttribute('data-color', '#14b8a6')
    script.setAttribute('data-show-name', 'false')
    script.setAttribute('data-show-email', 'false')
    script.setAttribute('data-button-dismissible', 'true')
    script.setAttribute('data-show-restore', 'true')
    document.body.appendChild(script)
    scriptRef.current = script

    return () => {
      // Clean up the script and any widget DOM on unmount
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current)
      }
      // BugDrop renders into a shadow-DOM host; remove it if present
      const host = document.querySelector('bugdrop-widget')
      if (host) host.remove()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync theme changes to the widget's data-theme attribute
  useEffect(() => {
    const script = document.querySelector(`script[src="${SCRIPT_URL}"]`)
    if (script) {
      script.setAttribute('data-theme', resolved)
    }
  }, [resolved])

  // Nothing to render — the widget injects its own UI via Shadow DOM
  return null
}
