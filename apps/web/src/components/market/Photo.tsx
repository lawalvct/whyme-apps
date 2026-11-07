import Image from 'next/image';
import { cn } from '@/components/ui/cn';

/**
 * A photo from the API. The API already serves sized WebP copies (thumb 320,
 * medium 800, large 1600), so Next's optimiser is skipped.
 */
export function Photo({
  src,
  alt,
  className,
  priority = false,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  if (!src) {
    return (
      <div className={cn('flex items-center justify-center bg-surface text-text-muted', className)}>
        <svg aria-hidden viewBox="0 0 24 24" className="size-10 fill-none stroke-current" strokeWidth={1.5}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="2" />
          <path d="M21 16l-5-5-8 8" />
        </svg>
      </div>
    );
  }
  return (
    <div className={cn('relative overflow-hidden bg-surface', className)}>
      <Image src={src} alt={alt} fill unoptimized priority={priority} sizes="(max-width: 640px) 100vw, 400px" className="object-cover" />
    </div>
  );
}
