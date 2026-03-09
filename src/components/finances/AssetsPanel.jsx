import { formatCurrency } from '../../utils/formatters'
import { matchesPersonFilter } from '../../utils/personFilter'
import { useDragReorder } from '../../hooks/useDragReorder'
import DragHandle from '../layout/DragHandle'
import AssigneeSelect from '../people/AssigneeSelect'
import CommentButton from '../comments/CommentButton'
import CurrencyInput from './CurrencyInput'

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
    </svg>
  )
}

export default function AssetsPanel({ assets, onChange, people = [], filterPersonId = null }) {
  const { dragHandleProps, getItemProps, draggingId, overedId } = useDragReorder(assets, onChange)

  function updateAsset(id, field, val) {
    onChange(assets.map(a => a.id === id ? { ...a, [field]: val } : a))
  }

  function deleteAsset(id) {
    onChange(assets.filter(a => a.id !== id))
  }

  function addAsset() {
    onChange([...assets, {
      id: Date.now(),
      name: 'New Asset',
      estimatedValue: 0,
      includedInWhatIf: false,
      assignedTo: null,
      marketplaceLink: '',
      listed: false,
      sold: false,
      saleDate: '',
      saleAmount: 0,
      description: '',
    }])
  }

  const includedTotal = assets
    .filter(a => a.includedInWhatIf)
    .reduce((sum, a) => sum + (Number(a.estimatedValue) || 0), 0)

  const grandTotal = assets
    .reduce((sum, a) => sum + (Number(a.estimatedValue) || 0), 0)

  const listedCount = assets.filter(a => a.listed).length
  const soldItems = assets.filter(a => a.sold)
  const soldTotal = soldItems.reduce((sum, a) => sum + (Number(a.saleAmount) || 0), 0)

  return (
    <div className="space-y-3">
      {assets.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-faint)' }}>
          No assets yet. Add things like a car, electronics, collectibles, or investments you could sell.
        </p>
      ) : (
        <>
          {/* Column headers — desktop only */}
          <div
            className="hidden sm:grid items-center gap-2 text-xs uppercase tracking-wider font-semibold px-1"
            style={{ gridTemplateColumns: '20px 1fr 130px 90px 32px 32px 32px', color: 'var(--text-secondary)' }}
          >
            <span></span>
            <span>Asset</span>
            <span>Est. Value</span>
            <span className="text-center">Sell?</span>
            <span></span>
            <span></span>
            <span></span>
          </div>

          {/* Asset rows */}
          <div className="space-y-2">
            {assets.map(asset => {
              const dimmed = filterPersonId && !matchesPersonFilter(asset.assignedTo, filterPersonId)
              return (
              <div
                key={asset.id}
                className={`row-assets-sm flex flex-col gap-2 sm:grid sm:items-center rounded-lg transition-all ${
                  asset.sold ? 'bg-green-950/20' : asset.includedInWhatIf ? 'bg-violet-950/20' : ''
                } ${draggingId === asset.id ? 'opacity-40' : ''} ${
                  overedId === asset.id && draggingId !== asset.id
                    ? 'ring-2 ring-violet-500/50 ring-inset'
                    : ''
                } ${dimmed ? 'opacity-25' : ''}`}
                {...getItemProps(asset.id)}
              >
                {/* Subrow 1: drag · name */}
                <div className="flex items-center gap-2 sm:contents">
                  <div
                    className="transition-colors flex items-center justify-center select-none flex-shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    {...dragHandleProps(asset.id)}
                  >
                    <DragHandle />
                  </div>
                  <input
                    type="text"
                    value={asset.name}
                    onChange={e => updateAsset(asset.id, 'name', e.target.value)}
                    className={`flex-1 min-w-0 rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors ${
                      asset.sold
                        ? 'border-green-600/60 focus:border-green-400'
                        : asset.includedInWhatIf
                          ? 'border-violet-600/60 focus:border-violet-400'
                          : ''
                    }`}
                    style={!asset.sold && !asset.includedInWhatIf ? {
                      background: 'var(--bg-page)',
                      border: '1px solid var(--border-input)',
                      color: 'var(--text-primary)',
                    } : {
                      background: 'var(--bg-page)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="e.g. Car, Guitar, Stocks"
                  />
                </div>

                {/* Subrow 2: value · sell · assignee · trash */}
                <div className="flex items-center gap-2 sm:contents">
                  <div
                    className={`flex-1 sm:flex-none flex items-center rounded-lg px-2 py-2 transition-colors ${
                      asset.sold
                        ? 'border-green-600/60 focus-within:border-green-400'
                        : asset.includedInWhatIf
                          ? 'border-violet-600/60 focus-within:border-violet-400'
                          : ''
                    }`}
                    style={!asset.sold && !asset.includedInWhatIf ? {
                      background: 'var(--bg-page)',
                      border: '1px solid var(--border-input)',
                    } : {
                      background: 'var(--bg-page)',
                    }}
                  >
                    <span className="text-sm mr-1" style={{ color: 'var(--text-muted)' }}>$</span>
                    <CurrencyInput
                      value={asset.estimatedValue}
                      onChange={val => updateAsset(asset.id, 'estimatedValue', val)}
                      className="bg-transparent text-sm w-full outline-none"
                      style={{ color: 'var(--text-primary)' }}
                      min="0"
                    />
                  </div>
                  <div className="flex justify-center flex-shrink-0">
                    <button
                      onClick={() => updateAsset(asset.id, 'includedInWhatIf', !asset.includedInWhatIf)}
                      title={asset.includedInWhatIf ? 'Remove from what-if' : 'Include in what-if (sell this)'}
                      className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                        asset.includedInWhatIf
                          ? 'bg-violet-600/40 text-violet-300 border border-violet-500/60 shadow-sm shadow-violet-900'
                          : ''
                      }`}
                      style={!asset.includedInWhatIf ? {
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-input)',
                        color: 'var(--text-muted)',
                      } : {}}
                    >
                      {asset.includedInWhatIf ? '✓ Sell' : 'Keep'}
                    </button>
                  </div>
                  <AssigneeSelect
                    people={people}
                    value={asset.assignedTo ?? null}
                    onChange={val => updateAsset(asset.id, 'assignedTo', val)}
                  />
                  <CommentButton itemId={`asset_${asset.id}`} label={asset.name || 'Asset'} />
                  <button
                    onClick={() => deleteAsset(asset.id)}
                    className="transition-colors flex items-center justify-center"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    title="Remove asset"
                  >
                    <TrashIcon />
                  </button>
                </div>

                {/* Description / notes */}
                <div className="sm:col-span-7">
                  <input
                    type="text"
                    value={asset.description || ''}
                    onChange={e => updateAsset(asset.id, 'description', e.target.value)}
                    className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/60"
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                    }}
                    placeholder="Add a note..."
                  />
                </div>

                {/* Expanded sell details — shown when item is marked to sell */}
                {asset.includedInWhatIf && (
                  <div className="sm:col-span-7 pt-2 pb-1 space-y-2" style={{ borderTop: '1px solid rgba(139,92,246,0.2)' }}>
                    {/* FB Marketplace link */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>FB Marketplace:</span>
                      <input
                        type="url"
                        value={asset.marketplaceLink || ''}
                        onChange={e => updateAsset(asset.id, 'marketplaceLink', e.target.value)}
                        placeholder="Paste listing URL..."
                        className="flex-1 min-w-0 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/60"
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-input)',
                          color: 'var(--text-primary)',
                        }}
                      />
                      {asset.marketplaceLink && (
                        <a
                          href={asset.marketplaceLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
                          title="Open listing"
                        >
                          <ExternalLinkIcon />
                        </a>
                      )}
                    </div>

                    {/* Status: Listed + Sold */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => updateAsset(asset.id, 'listed', !asset.listed)}
                        className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                          asset.listed
                            ? 'bg-blue-600/40 text-blue-300 border border-blue-500/60'
                            : ''
                        }`}
                        style={!asset.listed ? {
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-input)',
                          color: 'var(--text-muted)',
                        } : {}}
                        onMouseEnter={e => { if (!asset.listed) { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#93c5fd' } }}
                        onMouseLeave={e => { if (!asset.listed) { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.color = 'var(--text-muted)' } }}
                      >
                        {asset.listed ? '✓ Listed' : 'Mark Listed'}
                      </button>

                      {!asset.sold ? (
                        <button
                          onClick={() => updateAsset(asset.id, 'sold', true)}
                          className="px-2 py-1 rounded text-xs font-semibold transition-all"
                          style={{
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-input)',
                            color: 'var(--text-muted)',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#22c55e'; e.currentTarget.style.color = '#86efac' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                        >
                          Mark Sold
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-green-600/40 text-green-300 border border-green-500/60">
                            ✓ Sold
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Date:</span>
                            <input
                              type="date"
                              value={asset.saleDate || ''}
                              onChange={e => updateAsset(asset.id, 'saleDate', e.target.value)}
                              className="rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500/60"
                              style={{
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-input)',
                                color: 'var(--text-primary)',
                              }}
                            />
                          </div>
                          <div
                            className="flex items-center rounded px-2 py-1"
                            style={{
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border-input)',
                            }}
                          >
                            <span className="text-xs mr-1" style={{ color: 'var(--text-muted)' }}>$</span>
                            <CurrencyInput
                              value={asset.saleAmount || 0}
                              onChange={val => updateAsset(asset.id, 'saleAmount', val)}
                              className="bg-transparent text-xs w-20 outline-none"
                              style={{ color: 'var(--text-primary)' }}
                              min="0"
                            />
                          </div>
                          <button
                            onClick={() => updateAsset(asset.id, 'sold', false)}
                            className="text-xs transition-colors"
                            style={{ color: 'var(--text-faint)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
                          >
                            undo
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )})}
          </div>
        </>
      )}

      <button
        onClick={addAsset}
        className="w-full py-2 rounded-lg border border-dashed text-sm transition-colors"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#8b5cf6'
          e.currentTarget.style.color = '#a78bfa'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border-subtle)'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
      >
        + Add Asset
      </button>

      {assets.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Total est. value: </span>
            <span className="font-semibold sensitive" style={{ color: 'var(--text-primary)' }}>{formatCurrency(grandTotal)}</span>
          </div>
          {includedTotal > 0 && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Marked to sell: </span>
              <span className="text-violet-300 font-semibold sensitive">{formatCurrency(includedTotal)}</span>
              <span className="text-xs ml-1" style={{ color: 'var(--text-faint)' }}>(shown in what-if)</span>
            </div>
          )}
          {listedCount > 0 && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Listed: </span>
              <span className="text-blue-300 font-semibold">{listedCount} item{listedCount !== 1 ? 's' : ''}</span>
            </div>
          )}
          {soldItems.length > 0 && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Sold: </span>
              <span className="text-green-300 font-semibold sensitive">{formatCurrency(soldTotal)}</span>
              <span className="text-xs ml-1" style={{ color: 'var(--text-faint)' }}>({soldItems.length} item{soldItems.length !== 1 ? 's' : ''})</span>
            </div>
          )}
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Toggle <span className="text-violet-400 font-medium">Sell</span> to reveal listing tools. Drag <span style={{ color: 'var(--text-muted)' }}>⠿</span> to reorder.
      </p>
    </div>
  )
}
