/** Пара «подпись — значение» из таблиц фактов. */
export type Fact = readonly [label: string, value: string];

export interface PaymentProvider {
  id: string;
  name: string;
  /** Имя глифа в реестре иконок. */
  icon: string;
  desc: string;
  /** Badge text: which currencies the provider charges in («только RUB»). */
  unit: string;
  /**
   * Charge currency code. Separate from `unit`: that one is badge text and
   * differs between languages, while this code goes into a sentence
   * («Platega списывает в RUB»), where «в только RUB» would read as a typo.
   */
  currency: string;
  /** Проставляется, когда провайдер подключён и комиссия известна. */
  fee?: string;
}

export interface RuleExample {
  title: string;
  rows: readonly Fact[];
  note: string;
}

export interface RuleSection {
  id: string;
  icon: string;
  title: string;
  lead: string;
  facts: readonly Fact[];
  points: readonly string[];
  example?: RuleExample;
  /** `planned` — механика описана, но ещё не работает. */
  status?: 'live' | 'planned';
}

export interface DocBlock {
  h: string;
  p: string;
}

export interface DocPage {
  icon: string;
  title: string;
  lead: string;
  facts: readonly Fact[];
  sections: readonly DocBlock[];
}

export interface Brand {
  name: string;
  bot: string;
  botLink: string;
  /** The website, where Telegram sign-in is allowed (`app/web/siteHost.ts`). */
  siteLink: string;
  /** The contact the payment provider's bank asks for: a mailbox, not a group. */
  supportEmail: string;
  /** Temporary word the payment provider's bank asks to show during review. */
  reviewCode?: string;
  year: number;
  /**
   * The date of the current terms and privacy text, shown on both pages: the
   * provider's bank asks for it. Bump it with every change to that text — the
   * date lies exactly on the day the text changed and it was forgotten.
   */
  legalDate: string;
}
