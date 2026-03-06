const PROPERTY_STATUSES = [
  { value: '', label: 'Select status...' },
  { value: 'current_residence', label: 'Current Residence' },
  { value: 'rental', label: 'Rental' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'mortgage_with_tenants', label: 'Mortgage with Tenants' },
]

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

export default function PropertyLocationSettings({ properties = [], onChange }) {
  function updateProperty(id, field, val) {
    onChange(properties.map(p => p.id === id ? { ...p, [field]: val } : p))
  }

  function deleteProperty(id) {
    onChange(properties.filter(p => p.id !== id))
  }

  function addProperty() {
    onChange([
      ...properties,
      { id: Date.now(), address: '', parcelNumber: '', status: '', description: '' },
    ])
  }

  return (
    <div className="space-y-4">
      {properties.length === 0 ? (
        <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>
          No properties yet. Add a property to track your locations.
        </p>
      ) : (
        <div className="space-y-4">
          {properties.map(property => (
            <div
              key={property.id}
              className="rounded-lg border p-4 space-y-3"
              style={{ borderColor: 'var(--border-subtle, #e5e7eb)', background: 'var(--bg-input, #f9fafb)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-3">
                  {/* Address */}
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                      Address
                    </label>
                    <input
                      type="text"
                      value={property.address}
                      onChange={e => updateProperty(property.id, 'address', e.target.value)}
                      className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{
                        background: 'var(--bg-card, #fff)',
                        border: '1px solid var(--border-default, #d1d5db)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder="123 Main St, City, ST 12345"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Parcel ID */}
                    <div className="flex-1">
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                        Parcel ID
                      </label>
                      <input
                        type="text"
                        value={property.parcelNumber}
                        onChange={e => updateProperty(property.id, 'parcelNumber', e.target.value)}
                        className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{
                          background: 'var(--bg-card, #fff)',
                          border: '1px solid var(--border-default, #d1d5db)',
                          color: 'var(--text-primary)',
                        }}
                        placeholder="e.g. 012-345-678"
                      />
                    </div>

                    {/* Status */}
                    <div className="flex-1">
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                        Status
                      </label>
                      <select
                        value={property.status || ''}
                        onChange={e => updateProperty(property.id, 'status', e.target.value)}
                        className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{
                          background: 'var(--bg-card, #fff)',
                          border: '1px solid var(--border-default, #d1d5db)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {PROPERTY_STATUSES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                      Notes
                    </label>
                    <input
                      type="text"
                      value={property.description || ''}
                      onChange={e => updateProperty(property.id, 'description', e.target.value)}
                      className="w-full rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{
                        background: 'var(--bg-card, #fff)',
                        border: '1px solid var(--border-default, #d1d5db)',
                        color: 'var(--text-secondary)',
                      }}
                      placeholder="Add a note..."
                    />
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => deleteProperty(property.id)}
                  className="mt-5 p-1.5 rounded-md transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                  style={{ color: 'var(--text-muted)' }}
                  title="Remove property"
                >
                  <TrashIcon />
                </button>
              </div>

              {/* Status badge */}
              {property.status && (
                <div>
                  <span
                    className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: property.status === 'current_residence'
                        ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)',
                      color: property.status === 'current_residence'
                        ? '#10b981' : '#3b82f6',
                    }}
                  >
                    {PROPERTY_STATUSES.find(s => s.value === property.status)?.label}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={addProperty}
        className="w-full py-2.5 rounded-lg border border-dashed text-sm font-medium transition-colors"
        style={{
          borderColor: 'var(--border-default, #d1d5db)',
          color: 'var(--text-secondary)',
        }}
      >
        + Add Property
      </button>
    </div>
  )
}
