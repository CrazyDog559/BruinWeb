/** Neutral loading placeholder. Hidden from assistive tech; the live region announces state. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-md ${className}`} />;
}

/** Matches the footprint of a `StoryCard` so the layout does not jump. */
export function StoryCardSkeleton() {
  return (
    <div className="surface overflow-hidden rounded-[var(--radius-card)]">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
