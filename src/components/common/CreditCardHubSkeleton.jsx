import { SkeletonLine, SkeletonBlock, SkeletonCircle, SkeletonStyles } from './Skeleton'

function SectionCardSkeleton({ titleWidth = '8rem', children }) {
  return (
    <div className="theme-card rounded-xl border p-5">
      <SkeletonLine width={titleWidth} height="0.65rem" style={{ marginBottom: '1rem' }} />
      {children}
    </div>
  )
}

function StatementRowSkeleton() {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-xl border"
      style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)' }}
    >
      <div className="flex items-center gap-3">
        <SkeletonCircle size="1.75rem" />
        <div>
          <SkeletonLine width={`${6 + Math.random() * 5}rem`} height="0.65rem" style={{ marginBottom: '0.4rem' }} />
          <SkeletonLine width="5rem" height="0.5rem" />
        </div>
      </div>
      <div className="text-right">
        <SkeletonLine width="3.5rem" height="0.65rem" style={{ marginBottom: '0.3rem', marginLeft: 'auto' }} />
        <SkeletonLine width="4rem" height="0.45rem" style={{ marginLeft: 'auto' }} />
      </div>
    </div>
  )
}

export default function CreditCardHubSkeleton() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-6 main-bottom-pad space-y-5">
      <SkeletonStyles />

      {/* Page title skeleton */}
      <div>
        <SkeletonLine width="10rem" height="1.1rem" style={{ marginBottom: '0.4rem' }} />
        <SkeletonLine width="18rem" height="0.6rem" />
      </div>

      {/* Import status bar skeleton */}
      <div
        className="rounded-xl border px-4 py-3 flex items-center gap-4"
        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <SkeletonLine width="0.5rem" height="0.5rem" style={{ borderRadius: '50%' }} />
          <SkeletonLine width="4rem" height="0.55rem" />
        </div>
        <SkeletonLine width="6rem" height="0.55rem" />
        <SkeletonLine width="4rem" height="1.5rem" style={{ borderRadius: '0.5rem', marginLeft: 'auto' }} />
      </div>

      {/* Account selector skeleton */}
      <SectionCardSkeleton titleWidth="7rem">
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="flex-shrink-0 rounded-xl border p-4"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)', width: '11rem' }}
            >
              <SkeletonLine width="7rem" height="0.6rem" style={{ marginBottom: '0.5rem' }} />
              <SkeletonLine width="4.5rem" height="1.1rem" style={{ marginBottom: '0.35rem' }} />
              <SkeletonLine width="5rem" height="0.45rem" />
            </div>
          ))}
        </div>
      </SectionCardSkeleton>

      {/* Charts skeleton */}
      <SectionCardSkeleton titleWidth="6rem">
        <SkeletonBlock height="12rem" />
      </SectionCardSkeleton>

      {/* Statements list skeleton */}
      <SectionCardSkeleton titleWidth="6rem">
        <div className="space-y-2">
          <StatementRowSkeleton />
          <StatementRowSkeleton />
          <StatementRowSkeleton />
        </div>
      </SectionCardSkeleton>

      {/* Transactions table skeleton */}
      <SectionCardSkeleton titleWidth="7rem">
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-4 py-2">
              <SkeletonLine width="4.5rem" height="0.55rem" />
              <SkeletonLine width={`${8 + Math.random() * 6}rem`} height="0.55rem" />
              <SkeletonLine width="3rem" height="0.55rem" style={{ marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      </SectionCardSkeleton>
    </main>
  )
}
