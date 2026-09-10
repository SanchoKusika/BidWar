/** Пара «подпись — значение» из таблиц фактов. */
export type Fact = readonly [label: string, value: string];

export interface PaymentProvider {
  id: string;
  name: string;
  /** Имя глифа в реестре иконок. */
  icon: string;
  desc: string;
  /** В каких валютах провайдер принимает оплату. */
  unit: string;
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
  city: string;
  year: number;
  /**
   * Редакция правовых страниц. Стоит рядом со ссылкой на них в настройках,
   * чтобы человек видел, на какую версию соглашался. Поднимать при каждом
   * изменении текста в `docs.ts` — число врёт ровно в тот день, когда текст
   * поменяли, а его забыли.
   */
  legalVersion: string;
}
