import CommentButton from '../comments/CommentButton'

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

export default function PropertyPanel({ properties = [], onChange }) {
  function updateProperty(id, field, val) {
    onChange(properties.map(p => p.id === id ? { ...p, [field]: val } : p))
  }

  function deleteProperty(id) {
    onChange(properties.filter(p => p.id !== id))
  }

  function addProperty() {
    onChange([
      ...properties,
      { id: crypto.randomUUID(), address: '', parcelNumber: '', description: '' },
    ])
  }

  return (
    <div className="space-y-3">
      {properties.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-faint)' }}>
          No properties yet. Add properties to track home improvement projects against.
        </p>
      ) : (
        <>
          {/* Column headers — desktop only */}
          <div
            className="hidden sm:grid items-center gap-2 text-xs uppercase tracking-wider font-semibold px-1"
            style={{ gridTemplateColumns: '1fr 200px 32px 32px', color: 'var(--text-secondary)' }}
          >
            <span>Address</span>
            <span>Parcel Number</span>
            <span></span>
            <span></span>
          </div>

          {/* Property rows */}
          <div className="space-y-2">
            {properties.map(property => (
              <div
                key={property.id}
                className="flex flex-col gap-2 sm:grid sm:items-center rounded-lg transition-all"
                style={{ gridTemplateColumns: '1fr 200px 32px 32px' }}
              >
                <input
                  type="text"
                  value={property.address}
                  onChange={e => updateProperty(property.id, 'address', e.target.value)}
                  className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                  style={{
                    background: 'var(--bg-page)',
                    border: '1px solid var(--border-input)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="123 Main St, City, ST 12345"
                />
                <input
                  type="text"
                  value={property.parcelNumber}
                  onChange={e => updateProperty(property.id, 'parcelNumber', e.target.value)}
                  className="min-w-0 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                  style={{
                    background: 'var(--bg-page)',
                    border: '1px solid var(--border-input)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="Parcel #"
                />
                <CommentButton itemId={`property_${property.id}`} label={property.address || 'Property'} />
                <button
                  onClick={() => deleteProperty(property.id)}
                  className="transition-colors flex items-center justify-center"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <TrashIcon />
                </button>
                {/* Description / notes */}
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    value={property.description || ''}
                    onChange={e => updateProperty(property.id, 'description', e.target.value)}
                    className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/60"
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                    }}
                    placeholder="Add a note..."
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <button
        onClick={addProperty}
        className="w-full py-2 rounded-lg border border-dashed text-sm transition-colors"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#f59e0b'
          e.currentTarget.style.color = '#fbbf24'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border-subtle)'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
      >
        + Add Property
      </button>

      {properties.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          Properties can be selected when adding home improvements.
        </p>
      )}
    </div>
  )
}
