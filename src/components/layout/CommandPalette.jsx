import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import {
  Home, Briefcase, CreditCard, PiggyBank, Target,
  Settings, Search, ArrowRight, DollarSign, TrendingUp,
  ShieldCheck, FileText, Download, Plus, BarChart3, ClipboardList,
} from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import './CommandPalette.css'

const PAGE_ITEMS = [
  { id: 'nav-overview',      label: 'Overview',       path: '/',              icon: Home,       keywords: 'home dashboard burndown runway' },
  { id: 'nav-jobs',          label: 'Job Scenarios',   path: '/job-scenarios', icon: Briefcase,  keywords: 'jobs offers salary compare' },
  { id: 'nav-statements',    label: 'Statements',      path: '/credit-cards',  icon: CreditCard, keywords: 'credit cards transactions bank statements' },
  { id: 'nav-retirement',    label: 'Retirement',      path: '/retirement',    icon: PiggyBank,  keywords: 'retirement 401k savings plan' },
  { id: 'nav-goals',         label: 'Goals',           path: '/goals',         icon: Target,     keywords: 'goals targets savings milestones' },
  { id: 'nav-analysis',      label: 'Analysis',        path: '/analysis',      icon: BarChart3,      keywords: 'analysis net worth assets liabilities balance sheet charts' },
  { id: 'nav-budget',        label: 'Budget',          path: '/budget',        icon: ClipboardList,  keywords: 'budget spending categories' },
  { id: 'nav-settings',      label: 'Settings',        path: '/settings',      icon: Settings,   keywords: 'settings profile account preferences' },
]

const ADMIN_PAGE = { id: 'nav-admin', label: 'Admin', path: '/admin', icon: ShieldCheck, keywords: 'admin super tools' }

export default function CommandPalette({ open, onOpenChange, goals, jobScenarios, templates, savingsAccounts, creditCards, people, expenses, subscriptions, investments, isSuperAdmin }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  // Reset search when closing
  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  const runCommand = useCallback((fn) => {
    onOpenChange(false)
    fn()
  }, [onOpenChange])

  const pages = useMemo(() =>
    isSuperAdmin ? [...PAGE_ITEMS, ADMIN_PAGE] : PAGE_ITEMS,
    [isSuperAdmin],
  )

  const goalItems = useMemo(() =>
    (goals || []).map(g => ({
      id: `goal-${g.id}`,
      label: g.name,
      detail: g.targetAmount ? formatCurrency(g.targetAmount) : null,
      icon: g.icon || 'target',
    })),
    [goals],
  )

  const accountItems = useMemo(() =>
    (savingsAccounts || []).filter(a => a.active).map(a => ({
      id: `account-${a.id}`,
      label: a.name,
      detail: formatCurrency(a.amount),
    })),
    [savingsAccounts],
  )

  const ccItems = useMemo(() =>
    (creditCards || []).filter(c => c.active).map(c => ({
      id: `cc-${c.id}`,
      label: c.cardName,
      detail: formatCurrency(c.balance),
    })),
    [creditCards],
  )

  const investmentItems = useMemo(() =>
    (investments || []).filter(i => i.active).map(i => ({
      id: `inv-${i.id}`,
      label: i.name,
      detail: formatCurrency(i.currentValue),
    })),
    [investments],
  )

  const peopleItems = useMemo(() =>
    (people || []).map(p => ({
      id: `person-${p.id}`,
      label: p.name,
      color: p.color,
    })),
    [people],
  )

  const scenarioItems = useMemo(() =>
    (jobScenarios || []).map(s => ({
      id: `scenario-${s.id}`,
      label: s.name || s.company || 'Untitled Scenario',
      detail: s.monthlyTakeHome ? formatCurrency(s.monthlyTakeHome * 12) + '/yr' : null,
    })),
    [jobScenarios],
  )

  const templateItems = useMemo(() =>
    (templates || []).map(t => ({
      id: `template-${t.id}`,
      label: t.name,
    })),
    [templates],
  )

  if (!open) return null

  return (
    <div className="cmdk-overlay" onClick={() => onOpenChange(false)}>
      <div className="cmdk-container" onClick={e => e.stopPropagation()}>
        <Command label="Command palette" shouldFilter={true}>
          <div className="cmdk-input-wrapper">
            <Search size={16} strokeWidth={1.75} className="cmdk-input-icon" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search pages, accounts, goals..."
              className="cmdk-input"
              autoFocus
            />
            <kbd className="cmdk-shortcut">ESC</kbd>
          </div>

          <Command.List className="cmdk-list">
            <Command.Empty className="cmdk-empty">
              No results found.
            </Command.Empty>

            {/* Pages */}
            <Command.Group heading="Pages" className="cmdk-group">
              {pages.map(item => (
                <Command.Item
                  key={item.id}
                  value={`${item.label} ${item.keywords}`}
                  onSelect={() => runCommand(() => navigate(item.path))}
                  className="cmdk-item"
                >
                  <item.icon size={16} strokeWidth={1.75} />
                  <span>{item.label}</span>
                  <ArrowRight size={14} className="cmdk-item-action" />
                </Command.Item>
              ))}
            </Command.Group>

            {/* Actions */}
            <Command.Group heading="Quick Actions" className="cmdk-group">
              <Command.Item
                value="add goal create new goal"
                onSelect={() => runCommand(() => navigate('/goals'))}
                className="cmdk-item"
              >
                <Plus size={16} strokeWidth={1.75} />
                <span>Add a Goal</span>
                <ArrowRight size={14} className="cmdk-item-action" />
              </Command.Item>
              <Command.Item
                value="export download data reports"
                onSelect={() => runCommand(() => navigate('/settings'))}
                className="cmdk-item"
              >
                <Download size={16} strokeWidth={1.75} />
                <span>Export Data</span>
                <ArrowRight size={14} className="cmdk-item-action" />
              </Command.Item>
            </Command.Group>

            {/* Savings Accounts */}
            {accountItems.length > 0 && (
              <Command.Group heading="Accounts" className="cmdk-group">
                {accountItems.map(item => (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} account savings bank`}
                    onSelect={() => runCommand(() => navigate('/'))}
                    className="cmdk-item"
                  >
                    <DollarSign size={16} strokeWidth={1.75} />
                    <span>{item.label}</span>
                    {item.detail && <span className="cmdk-item-detail">{item.detail}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Credit Cards */}
            {ccItems.length > 0 && (
              <Command.Group heading="Credit Cards" className="cmdk-group">
                {ccItems.map(item => (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} credit card`}
                    onSelect={() => runCommand(() => navigate('/credit-cards'))}
                    className="cmdk-item"
                  >
                    <CreditCard size={16} strokeWidth={1.75} />
                    <span>{item.label}</span>
                    {item.detail && <span className="cmdk-item-detail">{item.detail}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Investments */}
            {investmentItems.length > 0 && (
              <Command.Group heading="Investments" className="cmdk-group">
                {investmentItems.map(item => (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} investment portfolio`}
                    onSelect={() => runCommand(() => navigate('/'))}
                    className="cmdk-item"
                  >
                    <TrendingUp size={16} strokeWidth={1.75} />
                    <span>{item.label}</span>
                    {item.detail && <span className="cmdk-item-detail">{item.detail}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Goals */}
            {goalItems.length > 0 && (
              <Command.Group heading="Goals" className="cmdk-group">
                {goalItems.map(item => (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} goal target`}
                    onSelect={() => runCommand(() => navigate('/goals'))}
                    className="cmdk-item"
                  >
                    <Target size={16} strokeWidth={1.75} />
                    <span>{item.label}</span>
                    {item.detail && <span className="cmdk-item-detail">{item.detail}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* People */}
            {peopleItems.length > 0 && (
              <Command.Group heading="People" className="cmdk-group">
                {peopleItems.map(item => (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} person household member`}
                    onSelect={() => runCommand(() => navigate('/settings'))}
                    className="cmdk-item"
                  >
                    <span
                      className="cmdk-person-dot"
                      style={{ background: `var(--accent-${item.color}, ${item.color})` }}
                    />
                    <span>{item.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Job Scenarios */}
            {scenarioItems.length > 0 && (
              <Command.Group heading="Job Scenarios" className="cmdk-group">
                {scenarioItems.map(item => (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} job scenario offer compare`}
                    onSelect={() => runCommand(() => navigate('/job-scenarios'))}
                    className="cmdk-item"
                  >
                    <Briefcase size={16} strokeWidth={1.75} />
                    <span>{item.label}</span>
                    {item.detail && <span className="cmdk-item-detail">{item.detail}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Templates */}
            {templateItems.length > 0 && (
              <Command.Group heading="Templates" className="cmdk-group">
                {templateItems.map(item => (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} template snapshot`}
                    onSelect={() => runCommand(() => navigate('/'))}
                    className="cmdk-item"
                  >
                    <FileText size={16} strokeWidth={1.75} />
                    <span>{item.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
