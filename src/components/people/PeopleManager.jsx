import CommentButton from '../comments/CommentButton'

const COLORS = ['blue', 'purple', 'emerald', 'amber', 'rose', 'cyan']

const COLOR_CLASSES = {
  blue:    'bg-blue-500',
  purple:  'bg-purple-500',
  emerald: 'bg-emerald-500',
  amber:   'bg-amber-400',
  rose:    'bg-rose-500',
  cyan:    'bg-cyan-500',
}

const COLOR_RING = {
  blue:    'ring-blue-500',
  purple:  'ring-purple-500',
  emerald: 'ring-emerald-500',
  amber:   'ring-amber-400',
  rose:    'ring-rose-500',
  cyan:    'ring-cyan-500',
}

function getInitials(name) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

export default function PeopleManager({ people, onChange }) {

  function updatePerson(id, field, val) {
    onChange(people.map(p => p.id === id ? { ...p, [field]: val } : p))
  }

  function cycleColor(id) {
    const person = people.find(p => p.id === id)
    if (!person) return
    const idx = COLORS.indexOf(person.color)
    const next = COLORS[(idx + 1) % COLORS.length]
    updatePerson(id, 'color', next)
  }

  function deletePerson(id) {
    onChange(people.filter(p => p.id !== id))
  }

  function addPerson() {
    const usedColors = people.map(p => p.color)
    const nextColor = COLORS.find(c => !usedColors.includes(c)) ?? COLORS[people.length % COLORS.length]
    onChange([...people, { id: Date.now(), name: 'New Person', color: nextColor }])
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Add people in your household. Assign them to any financial item using the colored pill on each row.
      </p>

      <div className="flex flex-wrap gap-3">
        {people.map(person => (
            <div
              key={person.id}
              className="flex items-center gap-2 border rounded-xl px-3 py-2 transition-all"
              style={{
                background: 'rgba(55,65,81,0.6)',
                borderColor: 'rgb(75,85,99)',
              }}
            >
              {/* Color swatch — click to cycle */}
              <button
                type="button"
                onClick={() => cycleColor(person.id)}
                title="Click to change color"
                className={`w-7 h-7 rounded-full flex-shrink-0 ${COLOR_CLASSES[person.color] ?? 'bg-gray-500'} flex items-center justify-center text-xs font-bold text-white ring-2 ring-offset-1 ring-offset-gray-700 ${COLOR_RING[person.color] ?? 'ring-gray-500'} transition-all`}
              >
                {getInitials(person.name)}
              </button>

              {/* Name input */}
              <input
                type="text"
                value={person.name}
                onChange={e => updatePerson(person.id, 'name', e.target.value)}
                className="bg-transparent text-white text-sm font-medium w-24 outline-none border-b border-transparent focus:border-gray-500 transition-colors"
                placeholder="Name"
              />

              {/* Comment button */}
              <CommentButton itemId={`person_${person.id}`} label={person.name} />

              {/* Delete */}
              <button
                onClick={() => deletePerson(person.id)}
                className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                title="Remove person"
              >
                <TrashIcon />
              </button>
            </div>
          ))}

        <button
          onClick={addPerson}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-600 text-gray-500 hover:border-blue-500 hover:text-blue-400 text-sm transition-colors"
        >
          + Add Person
        </button>
      </div>
    </div>
  )
}
