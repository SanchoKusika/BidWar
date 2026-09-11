// Один источник продуктового копирайтинга для Mini App и веба: правила,
// юридические страницы и провайдеры оплаты обязаны читаться одинаково на обеих
// площадках.
//
// Наружу уходят функции, а не объекты: тексты переведены на три языка, и язык
// выбирается в момент обращения. Объект, собранный при импорте, после
// переключения языка остался бы вчерашним (см. `locale.ts`).
export { brand } from './brand';
export { getRules, getDocs, getPaymentMethods, getPaymentProviders } from './locale';

export type { DocId } from './docs.en';
export type {
  Brand,
  DocBlock,
  DocPage,
  Fact,
  PaymentProvider,
  RuleExample,
  RuleSection,
} from './types';
