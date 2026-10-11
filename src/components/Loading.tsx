export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div>
      <Skeleton className="aspect-[3/4] w-full" />
      <Skeleton className="mt-2 h-4 w-3/4 rounded" />
      <Skeleton className="mt-1 h-3 w-1/2 rounded" />
    </div>
  );
}

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';
  return (
    <svg className={`animate-spin ${s} text-brand-500`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/>
      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4z"/>
    </svg>
  );
}

export function Empty({ title, description, icon }: { title: string; description?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 text-ink-500 dark:text-ink-400">
      <div className="w-16 h-16 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center mb-4 text-ink-400">
        {icon || (
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
        )}
      </div>
      <div className="text-lg font-semibold text-ink-700 dark:text-ink-200">{title}</div>
      {description && <p className="mt-1 text-sm max-w-sm">{description}</p>}
    </div>
  );
}
