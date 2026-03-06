import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PROFILE_COLORS } from './ProfileBubble'
import {
  exportBurndownCSV,
  exportExpensesCSV,
  exportSavingsCSV,
  exportScenariosCSV,
  exportAllData,
  exportSummaryJSON,
} from '../../utils/export'

export default function ProfileMenu({
  user,
  onProfileOpen,
  onLogOpen,
  logCount,
  onPresent,
  onSignOut,
  onHousehold,
  exportData,
}) {
  const [open, setOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!open) setExportOpen(false)
  }, [open])

  const initials = user?.email ? user.email[0].toUpperCase() : '?'
  const ringColor = PROFILE_COLORS[user?.profileColor] || PROFILE_COLORS.blue
  const avatar = user?.avatarDataUrl

  const handleExport = (exportFn, ...args) => {
    try {
      exportFn(...args)
      setOpen(false)
    } catch (error) {
      alert(`Export failed: ${error.message}`)
    }
  }

  const handleExportAll = () => {
    try {
      exportAllData(exportData)
      setOpen(false)
    } catch (error) {
      alert(`Export failed: ${error.message}`)
    }
  }

  const handleExportJSON = () => {
    try {
      exportSummaryJSON({
        ...exportData,
        monthlyExpenses: exportData.burndown?.current?.effectiveExpenses,
        monthlyIncome: exportData.burndown?.current?.monthlyBenefits,
        runwayMonths: exportData.burndown?.current?.totalRunwayMonths,
        runoutDate: exportData.burndown?.current?.runoutDate,
      })
      setOpen(false)
    } catch (error) {
      alert(`Export failed: ${error.message}`)
    }
  }

  const menuItemClass = "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors"
  const menuItemStyle = { color: 'var(--text-secondary)' }
  const hoverOn = e => e.currentTarget.style.background = 'var(--bg-input)'
  const hoverOff = e => e.currentTarget.style.background = 'transparent'

  return (
    <div className="relative" ref={ref}>
      {/* Profile bubble trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Profile & menu"
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: `2px solid ${ringColor}`,
          padding: 0,
          background: 'none',
          cursor: 'pointer',
          flexShrink: 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt="Profile"
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: ringColor + '22',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
              color: ringColor,
              userSelect: 'none',
            }}
          >
            {initials}
          </div>
        )}
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border shadow-2xl z-50 py-1 overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          {/* User info header */}
          <div className="px-3 py-2.5">
            <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {user?.email}
            </div>
            {user?.orgRole && (
              <div className="text-[11px] mt-0.5 capitalize" style={{ color: 'var(--text-muted)' }}>
                {user.orgRole}
              </div>
            )}
          </div>

          <div className="my-0.5" style={{ borderTop: '1px solid var(--border-subtle)' }} />

          {/* Your profile */}
          <button
            onClick={() => { onProfileOpen(); setOpen(false) }}
            className={menuItemClass}
            style={menuItemStyle}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="flex-1 text-left">Your profile</span>
          </button>

          <div className="my-0.5" style={{ borderTop: '1px solid var(--border-subtle)' }} />

          {/* Activity Log */}
          <button
            onClick={() => { onLogOpen(); setOpen(false) }}
            className={menuItemClass}
            style={menuItemStyle}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" strokeLinecap="round" />
            </svg>
            <span className="flex-1 text-left">Activity Log</span>
            {logCount > 0 && (
              <span
                className="text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center"
                style={{ background: 'var(--accent-blue)', color: '#fff', lineHeight: '16px' }}
              >
                {logCount > 99 ? '99+' : logCount}
              </span>
            )}
          </button>

          {/* Export submenu */}
          <button
            onClick={() => setExportOpen(o => !o)}
            className={menuItemClass}
            style={menuItemStyle}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="flex-1 text-left">Export</span>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: exportOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {exportOpen && (
            <div className="py-0.5" style={{ background: 'var(--bg-input)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => handleExport(exportBurndownCSV, exportData.burndown)}
                disabled={!exportData.burndown?.timeline?.length}
                className="w-full flex items-center gap-2.5 pl-9 pr-3 py-1.5 text-[12px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                Burndown CSV
              </button>
              <button
                onClick={() => handleExport(exportExpensesCSV, exportData.expenses)}
                disabled={!exportData.expenses?.length}
                className="w-full flex items-center gap-2.5 pl-9 pr-3 py-1.5 text-[12px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                Expenses CSV
              </button>
              <button
                onClick={() => handleExport(exportSavingsCSV, exportData.savingsAccounts)}
                disabled={!exportData.savingsAccounts?.length}
                className="w-full flex items-center gap-2.5 pl-9 pr-3 py-1.5 text-[12px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                Savings CSV
              </button>
              <button
                onClick={() => handleExport(exportScenariosCSV, exportData.scenarios, exportData.scenarioResults)}
                disabled={!exportData.scenarios?.length}
                className="w-full flex items-center gap-2.5 pl-9 pr-3 py-1.5 text-[12px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                Scenarios CSV
              </button>
              <div className="my-0.5 mx-3" style={{ borderTop: '1px solid var(--border-subtle)' }} />
              <button
                onClick={handleExportAll}
                className="w-full flex items-center gap-2.5 pl-9 pr-3 py-1.5 text-[12px] transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                All Data (CSV Bundle)
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full flex items-center gap-2.5 pl-9 pr-3 py-1.5 text-[12px] transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Summary JSON
              </button>
            </div>
          )}

          {/* Present */}
          <button
            onClick={() => { onPresent(); setOpen(false) }}
            className={menuItemClass}
            style={menuItemStyle}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span className="flex-1 text-left">Present</span>
          </button>

          {/* Household */}
          <button
            onClick={() => { onHousehold(); setOpen(false) }}
            className={menuItemClass}
            style={menuItemStyle}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="flex-1 text-left">Household</span>
          </button>

          {/* Settings */}
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className={menuItemClass}
            style={menuItemStyle}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="flex-1 text-left">Settings</span>
          </Link>

          {/* Superadmin Tools */}
          {user?.isSuperAdmin && (
            <Link
              to="/admin/tools"
              onClick={() => setOpen(false)}
              className={menuItemClass}
              style={menuItemStyle}
              onMouseEnter={hoverOn}
              onMouseLeave={hoverOff}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <span className="flex-1 text-left">Superadmin Tools</span>
            </Link>
          )}

          <div className="my-0.5" style={{ borderTop: '1px solid var(--border-subtle)' }} />

          {/* Sign out */}
          <button
            onClick={() => { onSignOut(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="flex-1 text-left">Sign out</span>
          </button>
        </div>
      )}
    </div>
  )
}
