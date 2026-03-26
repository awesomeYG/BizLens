"use client";

interface SkeletonCardProps {
  rows?: number;
  className?: string;
}

export function SkeletonCard({ rows = 3, className = "" }: SkeletonCardProps) {
  return (
    <div className={`glass-card rounded-2xl p-5 space-y-4 animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`bg-zinc-800 rounded ${
            i === 0 ? "h-4 w-24" : i === 1 ? "h-8 w-full" : "h-4 w-32"
          }`}
        />
      ))}
    </div>
  );
}

interface SkeletonGridProps {
  count?: number;
  columns?: 1 | 2 | 3;
}

export function SkeletonGrid({ count = 3, columns = 3 }: SkeletonGridProps) {
  const colClass =
    columns === 1 ? "grid-cols-1" : columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={`grid ${colClass} gap-5`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// Stat card skeleton for hero sections
export function SkeletonStatCard() {
  return (
    <div className="glass-card rounded-xl p-5 text-center animate-pulse">
      <div className="h-9 bg-zinc-800 rounded w-16 mx-auto mb-2" />
      <div className="h-3 bg-zinc-800 rounded w-12 mx-auto" />
    </div>
  );
}

// List item skeleton for notification history
export function SkeletonListItem() {
  return (
    <div className="glass-card rounded-2xl p-5 flex items-start gap-4 animate-pulse">
      <div className="w-10 h-10 bg-zinc-800 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-4 bg-zinc-800 rounded w-32" />
          <div className="h-4 bg-zinc-800 rounded w-16" />
        </div>
        <div className="h-3 bg-zinc-800 rounded w-full" />
        <div className="h-3 bg-zinc-800 rounded w-48" />
      </div>
    </div>
  );
}
