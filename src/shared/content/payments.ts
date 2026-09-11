import { PREVIEW } from '@/shared/config/preview';
import type { Locale } from '@/shared/i18n/locale';
import type { PaymentProvider } from './types';

// Комиссии не указаны намеренно: фактические ставки известны только после
// подключения провайдера, а выдуманная цифра на странице оплаты — обещание.
//
// По той же причине в списке карт GlobalPay нет «Мир»: проводят они его или
// нет — открытый вопрос, а не факт. Появится в списке, когда подтвердится.
//
// Имена провайдеров и названия карт не переводятся ни на один язык: Uzcard и
// Humo так и называются везде. Переводится только то, что сказано словами, —
// «только сумы», «Россия и СНГ».
const DESC: Record<Locale, { globalpay: string; platega: string; mock: string }> = {
  EN: {
    globalpay: 'Uzcard, Humo, Visa, MC, UnionPay — Uzbekistan',
    platega: 'Mir, Visa, MC — Russia & CIS',
    mock: 'Confirms instantly — no money moves',
  },
  RU: {
    globalpay: 'Uzcard, Humo, Visa, MC, UnionPay — Узбекистан',
    platega: 'Мир, Visa, MC — Россия и СНГ',
    mock: 'Подтверждается мгновенно — деньги не двигаются',
  },
  UZ: {
    globalpay: "Uzcard, Humo, Visa, MC, UnionPay — O'zbekiston",
    platega: 'Mir, Visa, MC — Rossiya va MDH',
    mock: 'Darhol tasdiqlanadi — pul harakatlanmaydi',
  },
};

const UNIT: Record<Locale, { uzsOnly: string; rubOnly: string; uzs: string }> = {
  EN: { uzsOnly: 'UZS only', rubOnly: 'RUB only', uzs: 'UZS' },
  RU: { uzsOnly: 'только UZS', rubOnly: 'только RUB', uzs: 'UZS' },
  UZ: { uzsOnly: 'faqat UZS', rubOnly: 'faqat RUB', uzs: 'UZS' },
};

/**
 * Способы оплаты, доступные прямо сейчас. Непустой кортеж, а не просто массив:
 * платёжное окно обязано кого-то предложить по умолчанию, и это требование
 * продукта, а не удобство типов.
 *
 * Пока платежи идут через мок, показывать GlobalPay и Platega нельзя: имя
 * настоящего провайдера под мгновенным бесплатным подтверждением — прямая
 * неправда. Мок называет себя моком. Список меняется в Срезе 1.10.
 */
export function paymentMethods(locale: Locale): readonly [PaymentProvider, ...PaymentProvider[]] {
  const desc = DESC[locale];
  const unit = UNIT[locale];

  if (PREVIEW.mockPayments) {
    return [
      { id: 'mock', name: 'Test payment', icon: 'credit-card', desc: desc.mock, unit: unit.uzs },
    ];
  }

  return [
    {
      id: 'globalpay',
      name: 'GlobalPay',
      icon: 'credit-card',
      desc: desc.globalpay,
      unit: unit.uzsOnly,
    },
    { id: 'platega', name: 'Platega', icon: 'globe', desc: desc.platega, unit: unit.rubOnly },
  ];
}
