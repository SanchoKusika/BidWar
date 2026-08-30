import type { PaymentProvider } from './types';

// Комиссии не указаны намеренно: фактические ставки известны только после
// подключения провайдера, а выдуманная цифра на странице оплаты — обещание.
//
// По той же причине в списке карт GlobalPay нет «Мир»: проводят они его или
// нет — открытый вопрос, а не факт. Появится в списке, когда подтвердится.
// Непустой кортеж, а не просто массив: платёжное окно обязано кого-то
// предложить по умолчанию, и это требование продукта, а не удобство типов.
export const payments: readonly [PaymentProvider, ...PaymentProvider[]] = [
  {
    id: 'globalpay',
    name: 'GlobalPay',
    icon: 'credit-card',
    desc: 'Uzcard, Humo, Visa, MC, UnionPay — Uzbekistan',
    unit: 'UZS only',
  },
  {
    id: 'platega',
    name: 'Platega',
    icon: 'globe',
    desc: 'Mir, Visa, MC — Russia & CIS',
    unit: 'RUB only',
  },
];
