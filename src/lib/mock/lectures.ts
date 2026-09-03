/**
 * PLACEHOLDER DATA — NOT REAL UCLA LECTURE CONTENT.
 *
 * This fixture exists solely to give the Lectures template a realistic shape to
 * render. It is invented, obviously generic, and never presented as live data:
 * every item it produces carries `dataMode: 'placeholder'` and the UI labels
 * the whole section "Coming Soon".
 *
 * When the real Panopto integration lands, delete this file and nothing else in
 * the UI needs to change — see `src/lib/adapters/lectures.ts`.
 */

import type { LectureRecord } from '@/lib/adapters/panopto';

/** Dates are expressed as offsets so the fixture never goes stale. */
export const MOCK_LECTURES: LectureRecord[] = [
  {
    id: 'placeholder-1',
    title: 'Introduction to Computational Thinking',
    instructor: 'Instructor name',
    department: 'Computer Science',
    courseCode: 'Course 000',
    daysAgo: 1,
    durationSeconds: 50 * 60,
    accessStatus: 'restricted',
    thumbnailUrl: null,
  },
  {
    id: 'placeholder-2',
    title: 'Foundations of Molecular Biology',
    instructor: 'Instructor name',
    department: 'Life Sciences',
    courseCode: 'Course 000',
    daysAgo: 2,
    durationSeconds: 78 * 60,
    accessStatus: 'restricted',
    thumbnailUrl: null,
  },
  {
    id: 'placeholder-3',
    title: 'Public Lecture: Cities and Climate',
    instructor: 'Guest speaker',
    department: 'Public Affairs',
    courseCode: null,
    daysAgo: 4,
    durationSeconds: 62 * 60,
    accessStatus: 'public',
    thumbnailUrl: null,
  },
  {
    id: 'placeholder-4',
    title: 'Statistical Inference in Practice',
    instructor: 'Instructor name',
    department: 'Statistics & Data Science',
    courseCode: 'Course 000',
    daysAgo: 5,
    durationSeconds: 74 * 60,
    accessStatus: 'restricted',
    thumbnailUrl: null,
  },
  {
    id: 'placeholder-5',
    title: 'Survey of Modern Art History',
    instructor: 'Instructor name',
    department: 'Art History',
    courseCode: 'Course 000',
    daysAgo: 8,
    durationSeconds: 80 * 60,
    accessStatus: 'restricted',
    thumbnailUrl: null,
  },
  {
    id: 'placeholder-6',
    title: 'Seminar: Ethics of Emerging Technology',
    instructor: 'Instructor name',
    department: 'Philosophy',
    courseCode: 'Course 000',
    daysAgo: 11,
    durationSeconds: 55 * 60,
    accessStatus: 'public',
    thumbnailUrl: null,
  },
];
