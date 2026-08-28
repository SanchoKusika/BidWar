import type { IconName } from '@/shared/ui/Icon';

/** Иконка плитки/чипа категории по slug — используется и в витрине, и в форме добавления. */
export const CATEGORY_ICON: Record<string, IconName> = {
  channels: 'send',
  bots: 'bot',
  sites: 'globe',
  business: 'briefcase',
  services: 'wrench',
};
