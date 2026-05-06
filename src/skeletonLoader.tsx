/**
 * Loading Skeleton Components
 * Provides visual feedback while content is loading
 */

export function CardSkeleton() {
  return (
    <div className="dashboard-card" style={{ opacity: 0.6, pointerEvents: 'none' }}>
      <div className="dashboard-card-header" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <div 
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            background: 'linear-gradient(90deg, currentColor 25%, transparent 25%, transparent 50%, currentColor 50%, currentColor 75%, transparent 75%, transparent)',
            backgroundSize: '16px 16px',
            animation: 'shimmer 2s infinite',
            opacity: 0.3,
          }}
        />
        <div 
          style={{
            flex: 1,
            height: '1.2rem',
            borderRadius: '4px',
            background: 'linear-gradient(90deg, currentColor 25%, transparent 25%, transparent 50%, currentColor 50%, currentColor 75%, transparent 75%, transparent)',
            backgroundSize: '16px 16px',
            animation: 'shimmer 2s infinite',
            opacity: 0.3,
          }}
        />
      </div>
      <div className="dashboard-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[1, 2, 3].map((i) => (
          <div 
            key={i}
            style={{
              height: '1rem',
              borderRadius: '4px',
              background: 'linear-gradient(90deg, currentColor 25%, transparent 25%, transparent 50%, currentColor 50%, currentColor 75%, transparent 75%, transparent)',
              backgroundSize: '16px 16px',
              animation: 'shimmer 2s infinite',
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
        className="accordion-header"
        style={{
          background: 'linear-gradient(90deg, currentColor 25%, transparent 25%, transparent 50%, currentColor 50%, currentColor 75%, transparent 75%, transparent)',
          backgroundSize: '16px 16px',
          animation: 'shimmer 2s infinite',
          height: '3rem',
          borderRadius: '4px',
          opacity: 0.3,
        }}
      />
    </div>
  );
}

// CSS animation for shimmer effect
export const shimmerCSS = `
  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }

  .skeleton {
    animation: shimmer 2s infinite;
    background-color: rgba(139, 92, 246, 0.1);
    background-image: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0),
      rgba(255, 255, 255, 0.2),
      rgba(255, 255, 255, 0)
    );
    background-repeat: repeat-y;
    background-size: 50px 100%;
    background-position: -1000px 0;
  }
`;
