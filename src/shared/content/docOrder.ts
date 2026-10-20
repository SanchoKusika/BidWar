import type { DocId } from './docs.en';

/**
 * Tab and footer order of the info pages, shared by the mini app and the site.
 * Kept out of the per-language files: the set of pages is the same in both.
 */
export const DOC_ORDER: readonly DocId[] = [
  'about',
  'tariffs',
  'support',
  'terms',
  'privacy',
  'bot',
];
