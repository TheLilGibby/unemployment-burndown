/**
 * Reusable skeleton/shimmer primitives for loading states.
 * Uses CSS custom properties from the theme so skeletons adapt to light/dark mode.
 */

const baseStyle = {
  background: 'var(--bg-input, #1f2937)',
  borderRadius: '0.5rem',
}

const shimmerStyle = {
  ...baseStyle,
  backgroundImage:
    'linear-gradient(90deg, var(--bg-input, #1f2937) 0%, var(--border-subtle, #374151) 50%, var(--bg-input, #1f2937) 100%)',
  backgroundSize: '200% 100%',
  animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
}

export function SkeletonLine({ width = '100%', height = '0.75rem', className = '', style = {} }) {
  return (
    <div
      className={`${className}`}
      style={{ ...shimmerStyle, width, height, ...style }}
    />
  )
}

export function SkeletonBlock({ width = '100%', height = '4rem', className = '', style = {} }) {
  return (
    <div
      className={`${className}`}
      style={{ ...shimmerStyle, width, height, borderRadius: '0.75rem', ...style }}
    />
  )
}

export function SkeletonCircle({ size = '2.5rem', className = '', style = {} }) {
  return (
    <div
      className={`${className}`}
      style={{ ...shimmerStyle, width: size, height: size, borderRadius: '50%', flexShrink: 0, ...style }}
    />
  )
}

/** Injects the keyframe animation once. Place this anywhere in the tree. */
export function SkeletonStyles() {
  return (
    <style>{`
      @keyframes skeleton-shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  )
}
