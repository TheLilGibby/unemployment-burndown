import { useState } from 'react'
import { formatCurrency, formatMonths, formatDate } from '../../utils/formatters'

export default function ComparePanel({ templates, currentResult, currentLabel }) {
  const [selectedId, setSelectedId] = useState(null)

  const selected = templates.find(t => t.id === selectedId) || null
  const compareResult = selected?._burndownResult || null

  if (templates.length === 0) {
    return (
      <div className="text-[10px] text-gray-500 text-center py-3">
        Save a template first to enable comparison.
      </div>
    )
  }

  const aMonths = currentResult?.totalRunwayMonths
  const bMonths = compareResult?.totalRunwayMonths
  const delta = aMonths != null && bMonths != null ? aMonths - bMonths : null

  return (
    <div className="space-y-3 pt-2">
      {/* Selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 shrink-0">vs.</label>
        <select
          value={selectedId ?? ''}
          onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
          className="flex-1 rounded px-2 py-1 pr-7 text-xs focus:outline-none themed-select"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        >
          <option value="">Select template...</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Compact comparison */}
      {currentResult && compareResult && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-blue-950/20 border border-blue-700/30 rounded px-2.5 py-2">
              <p className="text-blue-400 font-semibold text-[10px] truncate">{currentLabel || 'Current'}</p>
              <p className="text-white font-bold">
                {aMonths != null ? formatMonths(aMonths) : '10+ yrs'}
              </p>
              <p className="text-gray-500 text-[10px]">
                {currentResult.runoutDate ? formatDate(currentResult.runoutDate) : 'Beyond 10 yrs'}
              </p>
            </div>
            <div className="bg-purple-950/20 border border-purple-700/30 rounded px-2.5 py-2">
              <p className="text-purple-400 font-semibold text-[10px] truncate">{selected?.name || 'Saved'}</p>
              <p className="text-white font-bold">
                {bMonths != null ? formatMonths(bMonths) : '10+ yrs'}
              </p>
              <p className="text-gray-500 text-[10px]">
                {compareResult.runoutDate ? formatDate(compareResult.runoutDate) : 'Beyond 10 yrs'}
              </p>
            </div>
          </div>

          {delta !== null && delta !== 0 && (
            <div className={`rounded px-3 py-1.5 text-xs border text-center ${
              delta > 0
                ? 'bg-emerald-950/20 border-emerald-700/30 text-emerald-400'
                : 'bg-red-950/20 border-red-700/30 text-red-400'
            }`}>
              {delta > 0
                ? <>Current is <strong>{formatMonths(delta)}</strong> longer</>
                : <><strong>{selected?.name}</strong> is <strong>{formatMonths(Math.abs(delta))}</strong> longer</>
              }
            </div>
          )}
        </div>
      )}
    </div>
  )
}
