import { Skeleton } from '@/components/ui/skeleton';

export function DetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" aria-busy>
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
