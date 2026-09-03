/* eslint-disable @next/next/no-img-element */
'use client';

import { useState } from 'react';

interface SmartImageProps {
  src: string | null;
  srcSet?: string;
  alt: string;
  /** Deterministic seed for the fallback pattern, so it never flickers. */
  seed: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  aspect?: string;
}

/**
 * Remote publisher images, rendered without `next/image`.
 *
 * The site is a static export, so Next.js image optimization is unavailable at
 * runtime; `next/image` would only add client JS and a config surface for zero
 * benefit. Instead we hot-link the publisher's own asset (rather than copying
 * it, which would be a stronger copyright claim), reserve space with a fixed
 * aspect ratio to avoid layout shift, lazy-load everything below the fold, and
 * fall back to a deterministic gradient when an image is missing or 404s.
 */
export function SmartImage({
  src,
  srcSet,
  alt,
  seed,
  className = '',
  sizes,
  priority = false,
  aspect = '16 / 9',
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  // Hash the seed to a stable hue so each story keeps the same placeholder.
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360;

  return (
    <div
      className={`relative overflow-hidden bg-[var(--bg-subtle)] ${className}`}
      style={{ aspectRatio: aspect }}
    >
      {showFallback ? (
        <div
          aria-hidden="true"
          className="size-full"
          style={{
            backgroundImage: `linear-gradient(135deg, hsl(${hash} 45% 82%), hsl(${(hash + 40) % 360} 55% 62%))`,
          }}
        />
      ) : (
        <img
          src={src}
          srcSet={srcSet}
          alt={alt}
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          fetchPriority={priority ? 'high' : 'auto'}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      )}
    </div>
  );
}
