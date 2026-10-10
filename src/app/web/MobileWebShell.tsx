import { useRef, useState } from 'react';
import { getPlatform } from '@/shared/platform';
import { SessionProvider } from '@/entities/user';
import { MobileFrame } from '../Shell';
import { useWebNavigation } from './navigation';
import { SiteSignIn } from './SiteSignIn';

/**
 * The site on a phone: the mini app's screens and tab bar, at the site's own
 * addresses and with its own sign-in. Before, a phone got the mini app whole
 * — no way to sign in, a link to /project/42 opened the paid top, and the
 * browser's back left the site from any screen.
 */
export function MobileWebShell() {
  const [platform] = useState(getPlatform);
  const scroller = useRef<HTMLElement>(null);
  const nav = useWebNavigation(scroller);

  return (
    <SessionProvider>
      <SiteSignIn>
        <MobileFrame platform={platform} nav={nav} scroller={scroller} />
      </SiteSignIn>
    </SessionProvider>
  );
}
