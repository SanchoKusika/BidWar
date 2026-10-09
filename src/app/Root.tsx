import { useState } from 'react';
import { getPlatform } from '@/shared/platform';
import { DESKTOP_QUERY, useMediaQuery } from '@/shared/lib/layout';
import { Shell } from './Shell';
import { WebShell } from './web/WebShell';

/**
 * Mini app or site. Inside Telegram it is always the mini app — even the
 * desktop Telegram client opens it in a phone-sized window. In a browser the
 * width decides: a phone gets the mini app's layout (07 Экраны), a wide
 * screen the desktop one. Crossing the breakpoint swaps the shell; the
 * shared query cache keeps the data, only screen state starts over.
 */
export function Root() {
  const [platform] = useState(getPlatform);
  const wide = useMediaQuery(DESKTOP_QUERY);
  return platform.name === 'web' && wide ? <WebShell /> : <Shell />;
}
