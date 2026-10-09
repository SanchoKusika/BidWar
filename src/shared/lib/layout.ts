import { createContext, useContext, useSyncExternalStore } from 'react';

/**
 * Which composition the screens are drawn in. One bundle serves the mini app
 * and the site (07 Экраны): inside Telegram and on a narrow browser the
 * screens are the mini app's, on a wide browser the desktop's. Pages keep one
 * logic and pick the screen by this value; sheets become centred dialogs.
 */
export type Layout = 'mobile' | 'desktop';

export const LayoutContext = createContext<Layout>('mobile');

export function useLayout(): Layout {
  return useContext(LayoutContext);
}

/** From here up a browser gets the desktop composition. */
export const DESKTOP_QUERY = '(min-width: 1024px)';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
