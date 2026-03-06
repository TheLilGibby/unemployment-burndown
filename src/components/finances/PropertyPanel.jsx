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
      { id: Date.now(), address: '', parcelNumber: '', description: '' },
    ])
  }

  return (
    <div className="space-y-3">
      {properties.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-4">
          No properties yet. Add properties to track home improvement projects against.
        </p>
      ) : (
        <>
          {/* Column headers — desktop only */}
          <div
            className="hidden sm:grid items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-semibold px-1"
            style={{ gridTemplateColumns: '1fr 200px 32px 32px' }}
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
                  className="flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="123 Main St, City, ST 12345"
                />
                <input
                  type="text"
                  value={property.parcelNumber}
                  onChange={e => updateProperty(property.id, 'parcelNumber', e.target.value)}
                  className="min-w-0 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Parcel #"
                />
                <CommentButton itemId={`property_${property.id}`} label={property.address || 'Property'} />
                <button
                  onClick={() => deleteProperty(property.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors flex items-center justify-center"
                >
                  <TrashIcon />
                </button>
                {/* Description / notes */}
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    value={property.description || ''}
                    onChange={e => updateProperty(property.id, 'description', e.target.value)}
                    className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg px-3 py-1.5 text-gray-300 text-xs focus:outline-none focus:border-amber-500 placeholder-gray-600"
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
        className="w-full py-2 rounded-lg border border-dashed border-gray-600 text-gray-500 hover:border-amber-500 hover:text-amber-400 text-sm transition-colors"
      >
        + Add Property
      </button>

      {properties.length > 0 && (
        <p className="text-xs text-gray-600">
          Properties can be selected when adding home improvements.
        </p>
      )}
    </div>
  )
}
