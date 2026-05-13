import { supabase } from './supabase';

/**
 * Generates an optimized image URL using Supabase's transformation service.
 * @param bucket The storage bucket name
 * @param path The file path within the bucket
 * @param options Transformation options (width, height, quality, format)
 */
export function getOptimizedImageUrl(
  bucket: string,
  path: string,
  options: { width?: number; height?: number; quality?: number; format?: 'webp' | 'origin' } = {}
) {
  const { width = 200, quality = 80, format = 'webp' } = options;

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path, {
      transform: {
        width,
        quality,
        format,
      },
    });

  return data.publicUrl;
}

/**
 * Returns a fallback placeholder image URL.
 */
export function getPlaceholderUrl() {
  return 'https://placehold.co/200x200?text=No+Image';
}
