// One source of product copy for the Mini App and the web: rules, legal pages
// and payment providers must read the same on both.
//
// Functions go out, not objects: the texts exist in two languages and the
// language is picked at call time. An object built on import would stay in
// the language of the first launch after a switch (see `locale.ts`).
export { brand } from './brand';
export { getRules, getDocs, getPaymentMethods, getPaymentProviders } from './locale';
export { ruleHue, type RuleHue } from './ruleHue';

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
