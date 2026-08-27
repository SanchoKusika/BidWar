import type { PaymentProvider } from './types';

// Комиссии не указаны намеренно: фактические ставки известны только после
// подключения провайдера, а выдуманная цифра на странице оплаты — обещание.
export const payments: readonly PaymentProvider[] = [
  {
    id: 'globalpay',
    name: 'GlobalPay',
    icon: 'credit-card',
    desc: 'Uzcard, Humo, Visa, MC, UnionPay, Mir — Uzbekistan',
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
