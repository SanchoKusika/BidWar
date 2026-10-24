import type { Brand, Fact } from './types';

export const brand: Brand = {
  name: 'BidWar',
  bot: '@bidwar_bot',
  botLink: 'https://t.me/bidwar_bot',
  siteLink: 'https://bidwar.world',
  supportEmail: 'support@bidwar.world',
  // The bank's reviewer looks for this word while the cash desk is approved.
  // Delete the line once the desk is registered; every use below follows.
  reviewCode: 'OPLAT',
  year: 2026,
  legalVersion: 'v1.0',
};

/** The temporary review row of the About facts; empty once the code is gone. */
export function reviewFact(label: string): readonly Fact[] {
  return brand.reviewCode ? [[label, brand.reviewCode]] : [];
}
