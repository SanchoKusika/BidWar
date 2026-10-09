/**
 * The colour of each rules section's icon. Kept apart from the texts, which
 * exist once per language: the hue is the same in all of them.
 *
 * Money, votes and attacks carry the economy colours they have everywhere
 * else; verification is blue like the «verified» badge; «money is final» is
 * amber, a warning; the project section stays neutral.
 */
export type RuleHue = 'paid' | 'free' | 'attack' | 'info' | 'warn' | 'neutral';

const RULE_HUE: Record<string, RuleHue> = {
  bidding: 'paid',
  votes: 'free',
  attacks: 'attack',
  verification: 'info',
  refunds: 'warn',
  projects: 'neutral',
};

export function ruleHue(id: string): RuleHue {
  return RULE_HUE[id] ?? 'neutral';
}
