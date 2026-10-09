import { createTelegramPlatform, getTelegramWebApp, isTelegramMiniApp } from './telegram';
import { createWebPlatform } from './web';
import type { Platform } from './types';

export type {
  ColorScheme,
  HapticKind,
  InvoiceStatus,
  Platform,
  PlatformName,
  SystemButton,
} from './types';
export { isTelegramMiniApp };
export { clearLogin, saveLogin, signInWithTelegram, storedLogin } from './webLogin';

let instance: Platform | null = null;

export function getPlatform(): Platform {
  if (instance) return instance;

  const tg = getTelegramWebApp();
  instance = tg && tg.initData ? createTelegramPlatform(tg) : createWebPlatform();
  return instance;
}
