import { SkeletonLine, SkeletonBlock, SkeletonStyles } from './Skeleton'

function SectionCardSkeleton({ titleWidth = '8rem', children }) {
  return (
    <div className="theme-card rounded-xl border p-5">
      <SkeletonLine width={titleWidth} height="0.65rem" style={{ marginBottom: '1rem' }} />
      {children}
    </div>
  )
}

function StatRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <SkeletonLine width="1.25rem" height="1.25rem" style={{ borderRadius: '0.375rem' }} />
        <SkeletonLine width={`${5 + Math.random() * 6}rem`} height="0.65rem" />
      </div>
      <SkeletonLine width="4rem" height="0.65rem" />
    </div>
  )
}

export default function BurndownPageSkeleton() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-6 main-bottom-pad space-y-5">
      <SkeletonStyles />

      {/* Runway banner skeleton */}
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

      {/* Chart area skeleton */}
      <SectionCardSkeleton titleWidth="6rem">
        <SkeletonBlock height="14rem" style={{ marginBottom: '0.75rem' }} />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <SkeletonLine key={i} width="4.5rem" height="1.75rem" style={{ borderRadius: '0.5rem' }} />
          ))}
        </div>
      </SectionCardSkeleton>

      {/* Jobs section skeleton */}
      <SectionCardSkeleton titleWidth="10rem">
        <StatRowSkeleton />
        <StatRowSkeleton />
      </SectionCardSkeleton>

      {/* Two-column grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          {/* Savings skeleton */}
          <SectionCardSkeleton titleWidth="12rem">
            <StatRowSkeleton />
            <StatRowSkeleton />
            <StatRowSkeleton />
          </SectionCardSkeleton>

          {/* Unemployment skeleton */}
          <SectionCardSkeleton titleWidth="10rem">
            <div className="space-y-3">
              <SkeletonLine width="100%" height="2.25rem" style={{ borderRadius: '0.5rem' }} />
              <SkeletonLine width="100%" height="2.25rem" style={{ borderRadius: '0.5rem' }} />
              <SkeletonLine width="60%" height="2.25rem" style={{ borderRadius: '0.5rem' }} />
            </div>
          </SectionCardSkeleton>
        </div>

        <div className="space-y-5">
          {/* What-if skeleton */}
          <SectionCardSkeleton titleWidth="8rem">
            <div className="space-y-3">
              <SkeletonLine width="100%" height="2.25rem" style={{ borderRadius: '0.5rem' }} />
              <SkeletonLine width="100%" height="2.25rem" style={{ borderRadius: '0.5rem' }} />
              <SkeletonLine width="80%" height="2.25rem" style={{ borderRadius: '0.5rem' }} />
            </div>
          </SectionCardSkeleton>

          {/* Mini stats skeleton */}
          <div className="grid grid-cols-2 gap-3">
            <div className="theme-card rounded-xl border p-4">
              <SkeletonLine width="6rem" height="0.5rem" style={{ marginBottom: '0.5rem' }} />
              <SkeletonLine width="4rem" height="1.25rem" />
            </div>
            <div className="theme-card rounded-xl border p-4">
              <SkeletonLine width="5rem" height="0.5rem" style={{ marginBottom: '0.5rem' }} />
              <SkeletonLine width="4rem" height="1.25rem" />
            </div>
          </div>
        </div>
      </div>

      {/* Expenses skeleton */}
      <SectionCardSkeleton titleWidth="9rem">
        <StatRowSkeleton />
        <StatRowSkeleton />
        <StatRowSkeleton />
        <StatRowSkeleton />
      </SectionCardSkeleton>
    </main>
  )
}
