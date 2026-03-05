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
        <p className="text-sm text-gray-600 text-center py-4">
          No assets yet. Add things like a car, electronics, collectibles, or investments you could sell.
        </p>
      ) : (
        <>
          {/* Column headers — desktop only */}
          <div
            className="hidden sm:grid items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-semibold px-1"
            style={{ gridTemplateColumns: '20px 1fr 130px 90px 32px 32px 32px' }}
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
                    className="text-gray-600 hover:text-gray-400 transition-colors flex items-center justify-center select-none flex-shrink-0"
                    {...dragHandleProps(asset.id)}
                  >
                    <DragHandle />
                  </div>
                  <input
                    type="text"
                    value={asset.name}
                    onChange={e => updateAsset(asset.id, 'name', e.target.value)}
                    className={`flex-1 min-w-0 bg-gray-700 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none transition-colors ${
                      asset.sold
                        ? 'border-green-600/60 focus:border-green-400'
                        : asset.includedInWhatIf
                          ? 'border-violet-600/60 focus:border-violet-400'
                          : 'border-gray-600 focus:border-blue-500'
                    }`}
                    placeholder="e.g. Car, Guitar, Stocks"
                  />
                </div>

                {/* Subrow 2: value · sell · assignee · trash */}
                <div className="flex items-center gap-2 sm:contents">
                  <div className={`flex-1 sm:flex-none flex items-center bg-gray-700 border rounded-lg px-2 py-2 transition-colors ${
                    asset.sold
                      ? 'border-green-600/60 focus-within:border-green-400'
                      : asset.includedInWhatIf
                        ? 'border-violet-600/60 focus-within:border-violet-400'
                        : 'border-gray-600 focus-within:border-blue-500'
                  }`}>
                    <span className="text-gray-500 text-sm mr-1">$</span>
                    <CurrencyInput
                      value={asset.estimatedValue}
                      onChange={val => updateAsset(asset.id, 'estimatedValue', val)}
                      className="bg-transparent text-white text-sm w-full outline-none"
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
                          : 'bg-gray-700 text-gray-500 border border-gray-600 hover:border-gray-400'
                      }`}
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
                    className="text-gray-600 hover:text-red-400 transition-colors flex items-center justify-center"
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
                    className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg px-3 py-1.5 text-gray-300 text-xs focus:outline-none focus:border-violet-500 placeholder-gray-600"
                    placeholder="Add a note..."
                  />
                </div>

                {/* Expanded sell details — shown when item is marked to sell */}
                {asset.includedInWhatIf && (
                  <div className="sm:col-span-7 border-t border-violet-800/30 pt-2 pb-1 space-y-2">
                    {/* FB Marketplace link */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 flex-shrink-0">FB Marketplace:</span>
                      <input
                        type="url"
                        value={asset.marketplaceLink || ''}
                        onChange={e => updateAsset(asset.id, 'marketplaceLink', e.target.value)}
                        placeholder="Paste listing URL..."
                        className="flex-1 min-w-0 bg-gray-700/50 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
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
                            : 'bg-gray-700/50 text-gray-500 border border-gray-600 hover:border-blue-500 hover:text-blue-400'
                        }`}
                      >
                        {asset.listed ? '✓ Listed' : 'Mark Listed'}
                      </button>

                      {!asset.sold ? (
                        <button
                          onClick={() => updateAsset(asset.id, 'sold', true)}
                          className="px-2 py-1 rounded text-xs font-semibold bg-gray-700/50 text-gray-500 border border-gray-600 hover:border-green-500 hover:text-green-400 transition-all"
                        >
                          Mark Sold
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-green-600/40 text-green-300 border border-green-500/60">
                            ✓ Sold
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Date:</span>
                            <input
                              type="date"
                              value={asset.saleDate || ''}
                              onChange={e => updateAsset(asset.id, 'saleDate', e.target.value)}
                              className="bg-gray-700/50 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-green-500"
                            />
                          </div>
                          <div className="flex items-center bg-gray-700/50 border border-gray-600 rounded px-2 py-1">
                            <span className="text-xs text-gray-500 mr-1">$</span>
                            <CurrencyInput
                              value={asset.saleAmount || 0}
                              onChange={val => updateAsset(asset.id, 'saleAmount', val)}
                              className="bg-transparent text-white text-xs w-20 outline-none"
                              min="0"
                            />
                          </div>
                          <button
                            onClick={() => updateAsset(asset.id, 'sold', false)}
                            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
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
        className="w-full py-2 rounded-lg border border-dashed border-gray-600 text-gray-500 hover:border-violet-500 hover:text-violet-400 text-sm transition-colors"
      >
        + Add Asset
      </button>

      {assets.length > 0 && (
        <div className="bg-gray-700/40 rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-gray-500">Total est. value: </span>
            <span className="text-white font-semibold">{formatCurrency(grandTotal)}</span>
          </div>
          {includedTotal > 0 && (
            <div>
              <span className="text-gray-500">Marked to sell: </span>
              <span className="text-violet-300 font-semibold">{formatCurrency(includedTotal)}</span>
              <span className="text-gray-600 text-xs ml-1">(shown in what-if)</span>
            </div>
          )}
          {listedCount > 0 && (
            <div>
              <span className="text-gray-500">Listed: </span>
              <span className="text-blue-300 font-semibold">{listedCount} item{listedCount !== 1 ? 's' : ''}</span>
            </div>
          )}
          {soldItems.length > 0 && (
            <div>
              <span className="text-gray-500">Sold: </span>
              <span className="text-green-300 font-semibold">{formatCurrency(soldTotal)}</span>
              <span className="text-gray-600 text-xs ml-1">({soldItems.length} item{soldItems.length !== 1 ? 's' : ''})</span>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-600">
        Toggle <span className="text-violet-400 font-medium">Sell</span> to reveal listing tools. Drag <span className="text-gray-500">⠿</span> to reorder.
      </p>
    </div>
  )
}
