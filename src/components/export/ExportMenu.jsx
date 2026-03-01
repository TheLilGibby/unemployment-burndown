import { useState, useRef, useEffect } from 'react'
import { Download, FileText, Table, Package } from 'lucide-react'
import {
  exportBurndownCSV,
  exportExpensesCSV,
  exportSavingsCSV,
  exportScenariosCSV,
  exportAllData,
  exportSummaryJSON,
} from '../../utils/export'

export default function ExportMenu({ 
  burndown, 
  expenses, 
  savingsAccounts, 
  scenarios, 
  scenarioResults,
  totalSavings,
  unemployment 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleExport = (exportFn, ...args) => {
    try {
      exportFn(...args)
      setIsOpen(false)
    } catch (error) {
      alert(`Export failed: ${error.message}`)
    }
  }

  const handleExportAll = () => {
    try {
      exportAllData({
        burndown,
        expenses,
        savingsAccounts,
        scenarios,
        scenarioResults,
        totalSavings,
        unemployment,
      })
      setIsOpen(false)
    } catch (error) {
      alert(`Export failed: ${error.message}`)
    }
  }

  const handleExportJSON = () => {
    try {
      exportSummaryJSON({
        burndown,
        expenses,
        savingsAccounts,
        scenarios,
        scenarioResults,
        totalSavings,
        monthlyExpenses: burndown?.current?.effectiveExpenses,
        monthlyIncome: burndown?.current?.monthlyBenefits,
        runwayMonths: burndown?.current?.totalRunwayMonths,
        runoutDate: burndown?.current?.runoutDate,
        unemployment,
      })
      setIsOpen(false)
    } catch (error) {
      alert(`Export failed: ${error.message}`)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors"
        style={{
          borderColor: 'var(--border-subtle)',
          background: 'var(--bg-input)',
          color: 'var(--text-default)',
        }}
        title="Export data"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Export</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-xl shadow-xl border z-50"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="p-2">
            <div
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              Export Data
            </div>

            <button
              onClick={() => handleExport(exportBurndownCSV, burndown)}
              disabled={!burndown?.timeline || burndown.timeline.length === 0}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                color: 'var(--text-default)',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'var(--bg-hover)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Table className="w-4 h-4" />
              <span>Burndown Timeline CSV</span>
            </button>

            <button
              onClick={() => handleExport(exportExpensesCSV, expenses)}
              disabled={!expenses || expenses.length === 0}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                color: 'var(--text-default)',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'var(--bg-hover)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Table className="w-4 h-4" />
              <span>Expenses CSV</span>
            </button>

            <button
              onClick={() => handleExport(exportSavingsCSV, savingsAccounts)}
              disabled={!savingsAccounts || savingsAccounts.length === 0}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                color: 'var(--text-default)',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'var(--bg-hover)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Table className="w-4 h-4" />
              <span>Savings Accounts CSV</span>
            </button>

            <button
              onClick={() => handleExport(exportScenariosCSV, scenarios, scenarioResults)}
              disabled={!scenarios || scenarios.length === 0}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                color: 'var(--text-default)',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'var(--bg-hover)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Table className="w-4 h-4" />
              <span>Scenarios CSV</span>
            </button>

            <div
              className="my-2 border-t"
              style={{ borderColor: 'var(--border-subtle)' }}
            />

            <button
              onClick={handleExportAll}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                color: 'var(--text-default)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Package className="w-4 h-4" />
              <span>Export All (CSV Bundle)</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                color: 'var(--text-default)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <FileText className="w-4 h-4" />
              <span>Summary JSON</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
