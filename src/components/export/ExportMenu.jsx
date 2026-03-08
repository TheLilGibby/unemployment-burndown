import { useState, useRef, useEffect } from 'react'
import { Download, FileText, Table, Package, CreditCard, TrendingUp, DollarSign, Database } from 'lucide-react'
import {
  exportBurndownCSV,
  exportExpensesCSV,
  exportSavingsCSV,
  exportScenariosCSV,
  exportTransactionsCSV,
  exportIncomeCSV,
  exportCreditCardsCSV,
  exportInvestmentsCSV,
  exportAllData,
  exportSummaryJSON,
  exportFullBackupJSON,
} from '../../utils/export'

export default function ExportMenu({
  burndown,
  expenses,
  savingsAccounts,
  scenarios,
  scenarioResults,
  totalSavings,
  unemployment,
  creditCards,
  monthlyIncome,
  investments,
  transactions,
  fullState,
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
        creditCards,
        investments,
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

  const MenuItem = ({ icon: Icon, label, onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ color: 'var(--text-default)' }}
      onMouseEnter={(e) => {
        if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--bg-hover)'
      }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  )

  const SectionLabel = ({ children }) => (
    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
      {children}
    </div>
  )

  const Divider = () => (
    <div className="my-2 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
  )

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
          className="absolute right-0 top-full mt-2 w-64 rounded-xl shadow-xl border z-50 max-h-96 overflow-y-auto"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="p-2">
            <SectionLabel>CSV Exports</SectionLabel>
            <MenuItem icon={Table} label="Burndown Timeline" onClick={() => handleExport(exportBurndownCSV, burndown)} disabled={!burndown?.timeline?.length} />
            <MenuItem icon={Table} label="Expenses" onClick={() => handleExport(exportExpensesCSV, expenses)} disabled={!expenses?.length} />
            <MenuItem icon={Table} label="Savings Accounts" onClick={() => handleExport(exportSavingsCSV, savingsAccounts)} disabled={!savingsAccounts?.length} />
            <MenuItem icon={Table} label="Scenarios" onClick={() => handleExport(exportScenariosCSV, scenarios, scenarioResults)} disabled={!scenarios?.length} />
            <MenuItem icon={CreditCard} label="Credit Cards" onClick={() => handleExport(exportCreditCardsCSV, creditCards)} disabled={!creditCards?.length} />
            <MenuItem icon={DollarSign} label="Income Sources" onClick={() => handleExport(exportIncomeCSV, monthlyIncome)} disabled={!monthlyIncome?.length} />
            <MenuItem icon={TrendingUp} label="Investments" onClick={() => handleExport(exportInvestmentsCSV, investments)} disabled={!investments?.length} />
            <MenuItem icon={Table} label="Transactions" onClick={() => handleExport(exportTransactionsCSV, transactions)} disabled={!transactions?.length} />

            <Divider />
            <SectionLabel>Bundles</SectionLabel>
            <MenuItem icon={Package} label="Export All (CSV Bundle)" onClick={handleExportAll} />
            <MenuItem icon={FileText} label="Summary JSON" onClick={handleExportJSON} />

            <Divider />
            <SectionLabel>Backup</SectionLabel>
            <MenuItem icon={Database} label="Full Data Backup" onClick={() => handleExport(exportFullBackupJSON, fullState || { burndown, expenses, savingsAccounts, scenarios, scenarioResults, totalSavings, unemployment, creditCards, monthlyIncome, investments, transactions })} />
          </div>
        </div>
      )}
    </div>
  )
}
