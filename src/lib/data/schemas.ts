/**
 * Runtime schemas for everything we persist or replay.
 *
 * The adapters already validate what upstream sends them. These schemas guard a
 * different boundary: data coming back off disk, written by an earlier build
 * that may have run different code. Validating on the way in means a stale or
 * half-migrated artifact is discarded rather than rendered.
 */

import { z } from 'zod';

import { DATA_MODES, MEDIA_KINDS } from '@/lib/types/media';
import { MEAL_PERIODS } from '@/lib/types/dining';
import { LECTURE_FORMATS, LECTURE_MEDIA_TYPES } from '@/lib/types/lecture';
import { MENU_CATEGORY_KINDS } from '@/lib/config/dining-menu';

const isoish = z.string().min(4);

export const MediaImageSchema = z.object({
  src: z.string(),
  alt: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  srcSet: z.string().optional(),
});

export const MediaItemSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  kind: z.enum(MEDIA_KINDS),
  title: z.string().min(1),
  url: z.string().url(),
  publishedAt: isoish.nullable(),
  startsAt: isoish.nullable(),
  endsAt: isoish.nullable(),
  excerpt: z.string().nullable(),
  image: MediaImageSchema.nullable(),
  categories: z.array(z.string()),
  authors: z.array(z.string()),
  durationSeconds: z.number().nullable(),
  location: z.string().nullable(),
  badges: z.array(z.string()),
  attribution: z.string(),
  dataMode: z.enum(DATA_MODES),
});

export const MediaItemsSchema = z.array(MediaItemSchema);

const DiningMenuItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  station: z.string().nullable(),
  tags: z.array(z.string()),
  url: z.string().nullable(),
  category: z.enum(MENU_CATEGORY_KINDS),
  isMainCourse: z.boolean(),
  classifiedBy: z.enum(['station', 'dish-name', 'station-then-dish-name', 'default']),
});

export const DiningDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  venues: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1),
      kind: z.enum(['residential-restaurant', 'quick-service']),
      url: z.string(),
      location: z.string().nullable(),
      open: z.boolean(),
      hours: z.array(
        z.object({
          period: z.enum(MEAL_PERIODS),
          opens: z.string(),
          closes: z.string(),
        }),
      ),
      menus: z.array(
        z.object({
          period: z.enum(MEAL_PERIODS),
          items: z.array(DiningMenuItemSchema),
        }),
      ),
    }),
  ),
});

export const LectureSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  title: z.string().min(1),
  speaker: z.string().nullable(),
  speakerAffiliation: z.string().nullable(),
  department: z.string().nullable(),
  description: z.string().nullable(),
  series: z.string().nullable(),
  topics: z.array(z.string()),
  recordedAt: isoish.nullable(),
  publishedAt: isoish.nullable(),
  durationSeconds: z.number().nullable(),
  thumbnailUrl: z.string().nullable(),
  mediaType: z.enum(LECTURE_MEDIA_TYPES),
  format: z.enum(LECTURE_FORMATS),
  watchUrl: z.string().url(),
  embedUrl: z.string().nullable(),
  transcriptUrl: z.string().nullable(),
  mediaUrl: z.string().nullable(),
  sourceName: z.string(),
  sourceUrl: z.string(),
  retrievedAt: z.string(),
});

export const LectureCollectionSchema = z.object({
  lectures: z.array(LectureSchema),
  sources: z.array(
    z.object({
      sourceId: z.string(),
      status: z.enum(['ok', 'empty', 'error']),
      count: z.number(),
      error: z.string().optional(),
      retrievedAt: z.string(),
    }),
  ),
  generatedAt: z.string(),
});
