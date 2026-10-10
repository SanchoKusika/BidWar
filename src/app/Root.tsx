import { useState } from 'react';
import { getPlatform } from '@/shared/platform';
import { DESKTOP_QUERY, useMediaQuery } from '@/shared/lib/layout';
import { Shell } from './Shell';
import { MobileWebShell } from './web/MobileWebShell';
import { WebShell } from './web/WebShell';

/**
 * Mini app or site. Inside Telegram it is always the mini app — even the
 * desktop Telegram client opens it in a phone-sized window. In a browser it
 * is the site, and the width picks its composition: a phone gets the mini
 * app's screens (07 Экраны), a wide screen the desktop ones. Both are the
 * site — real addresses and the site's sign-in — so crossing the breakpoint
 * stays on the same page; the shared query cache keeps the data.
 */
export function Root() {
  const [platform] = useState(getPlatform);
  const wide = useMediaQuery(DESKTOP_QUERY);
  if (platform.name === 'telegram') return <Shell />;
  return wide ? <WebShell /> : <MobileWebShell />;
}
