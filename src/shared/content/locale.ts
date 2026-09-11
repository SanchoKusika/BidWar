import { getSettings } from '@/shared/settings';
import type { Locale } from '@/shared/i18n/locale';
import type { DocPage, PaymentProvider, RuleSection } from './types';
import { rulesEn } from './rules.en';
import { rulesRu } from './rules.ru';
import { rulesUz } from './rules.uz';
import { docsEn, type DocId } from './docs.en';
import { docsRu } from './docs.ru';
import { docsUz } from './docs.uz';
import { paymentMethods, paymentProviders } from './payments';

/**
 * Правила и правовые страницы на языке интерфейса.
 *
 * Функции, а не константы, и это не стиль: словарь в `shared/i18n` читает язык
 * в момент обращения к строке, а модуль — в момент импорта. Экспортируй эти
 * тексты объектом, и после переключения языка на экране осталась бы вчерашняя
 * версия — ровно та ловушка, из-за которой `strings` пришлось делать прокси.
 *
 * Перевод частичным не бывает: правила и правовые страницы читают целиком, и
 * половина раздела на чужом языке хуже целиком чужого. Поэтому здесь не
 * «ключ не нашёлся — возьми английский», а честный выбор всего документа.
 */
const RULES: Record<Locale, readonly RuleSection[]> = {
  RU: rulesRu,
  UZ: rulesUz,
  EN: rulesEn,
};

const DOCS: Record<Locale, Record<DocId, DocPage>> = {
  RU: docsRu,
  UZ: docsUz,
  EN: docsEn,
};

export function getRules(): readonly RuleSection[] {
  return RULES[getSettings().language];
}

export function getDocs(): Record<DocId, DocPage> {
  return DOCS[getSettings().language];
}

/**
 * Способы оплаты. Названия провайдеров — имена собственные и не переводятся;
 * переводится только то, что рядом с ними написано словами.
 */
export function getPaymentMethods(): readonly [PaymentProvider, ...PaymentProvider[]] {
  return paymentMethods(getSettings().language);
}

/**
 * Провайдеры продукта — для строки «Способы оплаты» в настройках. Она говорит,
 * через кого платят вообще, и от сегодняшнего мока не зависит.
 */
export function getPaymentProviders(): readonly [PaymentProvider, ...PaymentProvider[]] {
  return paymentProviders(getSettings().language);
}
