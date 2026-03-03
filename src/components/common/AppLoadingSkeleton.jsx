import { SkeletonLine, SkeletonBlock, SkeletonStyles } from './Skeleton'

/**
 * Full-page skeleton shown while the auth token is being validated
 * or cloud data is being restored. Mimics the app shell layout.
 */
export default function AppLoadingSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <SkeletonStyles />

      {/* Header bar skeleton */}
      <header
        className="sticky top-0 z-40 border-b px-4 h-14 flex items-center justify-between"
        style={{ background: 'var(--bg-card, var(--bg-page))', borderColor: 'var(--border-subtle)' }}
      >
        <SkeletonLine width="9rem" height="1.1rem" />
        <div className="flex items-center gap-3">
          <SkeletonLine width="1.75rem" height="1.75rem" style={{ borderRadius: '0.5rem' }} />
          <SkeletonLine width="1.75rem" height="1.75rem" style={{ borderRadius: '0.5rem' }} />
          <SkeletonLine width="1.75rem" height="1.75rem" style={{ borderRadius: '50%' }} />
        </div>
      </header>

      {/* Page content area */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Banner skeleton */}
        <div className="theme-card rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-4">
            <SkeletonLine width="0.5rem" height="0.5rem" style={{ borderRadius: '50%' }} />
            <SkeletonLine width="8rem" height="0.6rem" />
          </div>
          <SkeletonLine width="14rem" height="2rem" style={{ marginBottom: '0.5rem' }} />
          <SkeletonLine width="10rem" height="0.65rem" style={{ marginBottom: '1.25rem' }} />
          <div className="flex gap-10 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div>
              <SkeletonLine width="3.5rem" height="0.5rem" style={{ marginBottom: '0.5rem' }} />
              <SkeletonLine width="5rem" height="1.25rem" />
            </div>
            <div>
              <SkeletonLine width="5rem" height="0.5rem" style={{ marginBottom: '0.5rem' }} />
              <SkeletonLine width="4.5rem" height="1.25rem" />
            </div>
          </div>
        </div>

        {/* Chart placeholder */}
        <SkeletonBlock height="16rem" />

        {/* Card grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SkeletonBlock height="10rem" />
          <SkeletonBlock height="10rem" />
        </div>

        <SkeletonBlock height="8rem" />
      </main>
    </div>
  )
}
