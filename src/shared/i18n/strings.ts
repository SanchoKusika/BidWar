/**
 * Все пользовательские строки мини-аппа — из дизайн-кита
 * (design/ui_kits/mini_app/*.jsx), дословно и по-английски.
 *
 * Один файл вместо строк по месту: когда подключим RU/UZ/EN, переводится он, а
 * вёрстка не трогается вообще. Интерполяция — функциями, чтобы у переводчика
 * был весь шаблон целиком, а не склейка из кусков.
 */

export const strings = {
  common: {
    cancel: 'Cancel',
    back: 'Back',
    done: 'Done',
    continueToPayment: 'Continue to payment',
  },

  addProject: {
    title: 'Add a project',
    subtitle: 'One link is enough — we pull the rest',
    linkLabel: 'PROJECT LINK',
    linkPlaceholder: 't.me/yourchannel or yoursite.uz',
    destinationLabel: 'WHERE IT COMPETES',
    categoryLabel: 'CATEGORY',
    free: { label: 'Free Top', sub: 'Votes from tasks' },
    paid: { label: 'Paid Top', sub: 'Money bids' },
    slotUsed: 'Slot already used',
    // Paid Top открывается вместе с платёжным слоем (Срез 1.5) — до тех пор
    // карточка видна, но выбрать её нельзя.
    paidSoon: 'Opens with payments',
    freeNote:
      'A free entry starts at zero votes. You move it up with votes earned from tasks — no money enters the Free Top.',
    openingBidLabel: 'Opening bid',
    openingBidError: (min: string) => `Minimum opening bid is ${min}`,
    footnote:
      'Two projects per account at most — one in the Paid Top, one in the Free Top. The same link may hold both, and the two entries compete separately.',
    submitFree: 'Submit project',
    genericError: 'Could not add the project',
  },

  raise: {
    title: 'Raise',
    subtitle: (name: string, rank: number) => `${name} · now #${rank}`,
    amountLabel: 'Raise amount',
    amountError: (min: string) => `Minimum raise is ${min}`,
    bidNow: 'Your bid now',
    bidAfter: 'Your bid after',
    projectedPosition: 'Projected position',
    note: 'One charge on the next screen. The raise applies when the provider confirms the payment — no balance is kept for you.',
  },

  attack: {
    title: 'Attack',
    titleConfirm: 'Confirm attack',
    subtitle: (name: string, rank: number) => `${name} · #${rank}`,
    stepAmount: 'STEP 1 · AMOUNT',
    stepConfirm: 'STEP 2 · CONFIRM',
    amountLabel: 'Attack amount',
    amountError: (min: string) => `Minimum attack is ${min}`,
    targetLimitError: (max: number) => `Daily limit reached for this rival — ${max} of ${max} used`,
    dayLimitError: (max: number) => `Daily attack limit reached — ${max} of ${max} used`,
    effectsLabel: 'ONE PAYMENT, TWO EFFECTS',
    theirBid: 'Their bid',
    yourBid: 'Your bid',
    plainNote:
      'You pay the platform, not them. The gap between you closes twice as fast as a plain raise.',
    haircutNote: (pct: number) =>
      `Repeat attack on this rival inside 48 h — you are credited ${pct}% of the amount, they still lose all of it.`,
    quota: (targetLeft: number, targetMax: number, dayLeft: number, dayMax: number) =>
      `${targetLeft} of ${targetMax} attacks left on this rival today · ${dayLeft} of ${dayMax} overall`,
    review: 'Review attack',
    youPayPlatform: 'You pay the platform',
    rivalBid: (name: string) => `${name}'s bid`,
    creditedToYou: 'Credited to you',
    creditedShare: (pct: number) => `${pct}% of the amount`,
    gap: 'Gap between you',
    gapPassed: 'you pass them',
    trimmedNote: (landed: string, floor: string) =>
      `Trimmed to ${landed} — their bid cannot fall below its floor of ${floor}. You are charged only for the part that lands.`,
    warning: (name: string) =>
      `Real money, and it cannot be undone. ${name} gets a bot alert naming you and the amount.`,
  },

  vote: {
    title: 'Give votes',
    subtitle: (name: string, rank: number) => `${name} · now #${rank}`,
    amountLabel: 'Votes to give',
    balanceLabel: 'You have',
    amountError: 'You do not have that many votes',
    unit: 'votes',
    votesAfter: 'Their votes after',
    youKeep: 'You keep',
    keepValue: (votes: string) => `${votes} votes`,
    submit: (votes: string) => `Give ${votes} votes`,
  },

  pay: {
    titleAttack: 'Pay for the attack',
    titleProject: 'Pay the opening bid',
    titleRaise: 'Pay for the raise',
    youPay: 'YOU PAY',
    methodLabel: 'PAYMENT METHOD',
    // В ките эта строка называла Platega и Stripe поимённо; провайдеры с тех
    // пор сменились, поэтому валюта берётся из карточки самого провайдера.
    chargeNote: (provider: string, unit: string) => `${provider} charges in ${unit}.`,
    attackWarning: (rival: string) =>
      `The charge goes to the platform, never to ${rival}. Once the provider confirms it, it cannot be undone — and they get a bot alert naming you and the amount.`,
    submit: (amount: string, provider: string) => `Pay ${amount} via ${provider}`,
    footnote: (provider: string) =>
      `The payment opens on ${provider}'s own secure page and applies when ${provider} confirms it. BidWar keeps no balance for you — there is no wallet to top up and nothing of yours sitting with us.`,
  },
} as const;
