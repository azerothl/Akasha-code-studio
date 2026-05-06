/**
 * Loading Skeleton Components
 * Provides visual feedback while content is loading
 */

export function CardSkeleton() {
  return (
    <div className="dashboard-card" style={{ opacity: 0.6, pointerEvents: 'none' }}>
      <div className="dashboard-card-header" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <div 
          className="skeleton"
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            opacity: 0.3,
          }}
        />
        <div 
          className="skeleton"
          style={{
            flex: 1,
            height: '1.2rem',
            borderRadius: '4px',
            opacity: 0.3,
          }}
        />
      </div>
      <div className="dashboard-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[1, 2, 3].map((i) => (
          <div 
            key={i}
            className="skeleton"
            style={{
              height: '1rem',
              borderRadius: '4px',
              opacity: 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeletons() {
  return (
    <div className="dashboard-grid">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function AccordionItemSkeleton() {
  return (
    <div className="accordion-item" style={{ opacity: 0.5 }}>
      <div 
        className="accordion-header skeleton"
        style={{
          height: '3rem',
          borderRadius: '4px',
          opacity: 0.3,
        }}
      />
    </div>
  );
}
