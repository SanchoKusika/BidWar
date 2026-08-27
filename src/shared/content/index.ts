// Один источник продуктового копирайтинга для Mini App и веба: правила, юридические
// страницы и провайдеры оплаты обязаны читаться одинаково на обеих площадках.
export { brand } from './brand';
export { payments } from './payments';
export { rules } from './rules';
export { docs } from './docs';

export type { DocId } from './docs';
export type {
  Brand,
  DocBlock,
  DocPage,
  Fact,
  PaymentProvider,
  RuleExample,
  RuleSection,
} from './types';
