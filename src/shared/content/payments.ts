import { PREVIEW } from '@/shared/config/preview';
import type { Locale } from '@/shared/i18n/locale';
import type { PaymentProvider } from './types';

// Fees are left out on purpose: the real rates are known only once the
// provider is connected, and a made-up number on a payment page is a promise.
//
// Platega is the only provider while the product is Russia-only. GlobalPay
// (Uzbekistan) lived next to it until the pivot — see the `archive/multi-market`
// tag. Only the methods its bank connected are named: cards are not among
// them, and a card logo on the payment sheet would promise a way that fails.
const DESC: Record<Locale, { platega: string; mock: string }> = {
  EN: {
    platega: 'SBP, crypto — Russia',
    mock: 'Confirms instantly — no money moves',
  },
  RU: {
    platega: 'СБП, криптовалюта — Россия',
    mock: 'Подтверждается мгновенно — деньги не двигаются',
  },
};

const UNIT: Record<Locale, { rubOnly: string; rub: string }> = {
  EN: { rubOnly: 'RUB only', rub: 'RUB' },
  RU: { rubOnly: 'только RUB', rub: 'RUB' },
};

/**
 * Провайдеры продукта — те, через кого платят по-настоящему.
 *
 * Этот список не зависит от мока: в настройках строка «Способы оплаты» — это
 * сведение о продукте, а не о сегодняшнем стенде, и «Test payment» в ней
 * означал бы, что площадка принимает тестовые платежи.
 */
export function paymentProviders(locale: Locale): readonly [PaymentProvider, ...PaymentProvider[]] {
  const desc = DESC[locale];
  const unit = UNIT[locale];

  return [
    {
      id: 'platega',
      name: 'Platega',
      icon: 'credit-card',
      desc: desc.platega,
      unit: unit.rubOnly,
      currency: 'RUB',
    },
  ];
}

/**
 * Payment methods available right now — what the payment sheet offers. A
 * non-empty tuple rather than an array: the sheet must have a default to
 * offer, and that is a product requirement, not a typing convenience.
 *
 * While payments go through the mock, Platega must not be shown here: a real
 * provider's name over an instant free confirmation is a plain lie. The mock
 * calls itself the mock. The list changes in slice 1.10.
 *
 * Until then a build without the mock shows Platega over a server that is
 * still the mock — honest only because `PREVIEW.paymentsStub` stops the sheet
 * from sending anything. The two flags go together.
 */
export function paymentMethods(locale: Locale): readonly [PaymentProvider, ...PaymentProvider[]] {
  if (!PREVIEW.mockPayments) return paymentProviders(locale);

  return [
    {
      id: 'mock',
      name: 'Test payment',
      icon: 'credit-card',
      desc: DESC[locale].mock,
      unit: UNIT[locale].rub,
      currency: 'RUB',
    },
  ];
}
