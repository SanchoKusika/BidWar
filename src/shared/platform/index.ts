import { createTelegramPlatform, getTelegramWebApp, isTelegramMiniApp } from './telegram';
import { createWebPlatform } from './web';
import type { Platform } from './types';

export type { ColorScheme, InvoiceStatus, Platform, PlatformName, SystemButton } from './types';
export { isTelegramMiniApp };

let instance: Platform | null = null;

export function getPlatform(): Platform {
  if (instance) return instance;

  const tg = getTelegramWebApp();
  instance = tg && tg.initData ? createTelegramPlatform(tg) : createWebPlatform();
  return instance;
}
