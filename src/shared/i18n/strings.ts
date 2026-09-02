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
    loading: 'Working out the numbers…',
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
    resultTitle: 'Bid raised',
    resultNote: (amount: string, unit: string) =>
      `${amount} ${unit} applied. The position updates for everyone right away.`,
    openingResultTitle: 'You are in the Paid Top',
    failed: 'The payment did not go through — nothing was charged.',
    // status: 'pending' — платёж создан, подтверждение ещё не пришло. Это не
    // отказ (у мока встречается только по команде stuck_pending; полноценная
    // шторка ожидания — Срез 1.10), и говорить «не прошёл» тут неверно
    // (находка «status: pending» финального ревью).
    pendingConfirmation: 'Payment created, waiting for confirmation — do not pay again yet.',
    // Соединение оборвалось ПОСЛЕ отправки запроса — мы не знаем, успел ли
    // сервер применить платёж до разрыва. «Ничего не списано» здесь была бы
    // ложью, которую нельзя проверить (находка I6 финального ревью).
    unknownOutcome:
      'Connection dropped before we heard back — we do not know if the charge went through. Check your position before paying again.',
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
    haircutNote: (pct: number, hours: number) =>
      `Repeat attack on this rival inside ${hours} h — you are credited ${pct}% of the amount, they still lose all of it.`,
    quota: (targetLeft: number, targetMax: number, dayLeft: number, dayMax: number) =>
      `${targetLeft} of ${targetMax} attacks left on this rival today · ${dayLeft} of ${dayMax} overall`,
    review: 'Review attack',
    youPayPlatform: 'You pay the platform',
    rivalBid: (name: string) => `${name}'s bid`,
    creditedToYou: 'Credited to you',
    creditedShare: (pct: number) => `${pct}% of the amount`,
    gap: 'Gap between you',
    gapPassed: 'you pass them',
    floorReached: 'Their bid is already at its floor — there is nothing left to take.',
    quoteFailed: 'Could not work out this attack. Try again.',
    resultTitle: 'Attack landed',
    resultNote: (damage: string, credited: string, unit: string) =>
      `Their bid lost ${damage} ${unit}, yours gained ${credited} ${unit}.`,
    trimmedNote: (landed: string, floor: string) =>
      `Trimmed to ${landed} — their bid cannot fall below its floor of ${floor}. You are charged only for the part that lands.`,
    // Про уведомление жертве здесь раньше стояло обещание («gets a bot alert
    // naming you and the amount») — бот ничего не рассылает, и это была
    // неправда в самом ответственном месте интерфейса. Вернуть строку можно
    // будет вместе с рассылкой бота, не раньше.
    warning: (name: string) =>
      `Real money, and it cannot be undone. ${name}'s bid drops the moment the payment clears.`,
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

  showcase: {
    paidTitle: 'Paid Top',
    freeTitle: 'Free Top',
    yourVotes: 'YOUR VOTES',
    paidMeta: (count: number) => `${count} projects · money never converts to votes`,
    freeMeta: (count: number) => `${count} projects · votes never convert to money`,
    paidRanking: 'Paid ranking',
    freeRanking: 'Free ranking',
    inPlay: (total: string, unit: string) => `${total} ${unit} in play`,
    allTime: 'All time',
    today: 'Today',
    todayNote: (segment: 'paid' | 'free') =>
      `Only the last 24 hours count here. Every ${segment === 'paid' ? 'bid' : 'vote'} also stays in the all-time top — nothing is lost, the day just resets.`,
    justHappened: 'Just happened',
    raiseMine: 'Raise my bid',
    voteMine: 'Give votes to my project',
    entryHintPaid: (price: string) =>
      `The last position in this top costs ${price}. Add your project, then bid your way up.`,
    entryHintPaidUnknown: 'Add your project and place the opening bid.',
    entryHintFree: 'A free entry starts at zero votes. Tasks give you the votes to climb.',
    holdFirstPaid: 'You hold position 1. Any raise widens the gap.',
    holdFirstFree: 'You hold position 1. Keep the votes coming.',
    gapPaid: (amount: string, rival: string, rank: number) =>
      `Raise by ${amount} to pass ${rival} at #${rank}.`,
    gapFree: (amount: string, rival: string, rank: number) =>
      `You need ${amount} more votes to pass ${rival} at #${rank}.`,
    loadMore: 'Show more',
    errorTitle: 'Could not load the board',
    errorNote: 'Check your connection and try again.',
    retry: 'Try again',
    emptyPaidTitle: 'No bids in this category yet',
    emptyFreeTitle: 'No projects here yet',
    emptyPaidNote: 'Place the first bid and take position 1.',
    emptyFreeNote: 'Be the first to collect votes in this category.',
    signInFailed: 'Could not sign in',
    signInNote: 'Try closing the mini app and opening it again.',
  },

  rules: {
    title: 'Rules of the game',
    meta: 'Identical in the mini app and on the site.',
    askSupport: 'Still unclear? Ask support',
    chip: 'Rules',
  },

  docs: {
    tabs: {
      about: 'About',
      support: 'Support',
      terms: 'Terms',
      privacy: 'Privacy',
      bot: 'Bot',
    },
    openBot: (handle: string) => `Open ${handle}`,
  },

  tasks: {
    title: 'Tasks',
    meta: 'Complete tasks, get votes. Votes are not money.',
    yourVotes: 'YOUR VOTES',
    daily: 'Daily',
    oneTime: 'One-time',
    emptyTitle: "That's everything for today",
    emptyNote: 'New tasks appear every day at 09:00.',
  },

  project: {
    boughtBy: (buyer: string, since: string) => `bought by ${buyer} · since ${since}`,
    position: 'Position',
    heldAt1: 'Time at #1',
    currentBid: 'Current bid',
    votes: 'Votes',
    clicks: 'Clicks',
    verified: 'Verified',
    yes: 'Yes',
    no: 'No',
    open: (url: string) => `Open ${url}`,
    raiseMine: 'Raise my bid',
    outbid: 'Outbid this project',
    attack: 'Attack',
    giveVotes: 'Give votes',
    bidActivity: 'Bid activity',
    voteActivity: 'Vote activity',
    sameAccountFree: 'Same account in the Free Top',
    sameAccountPaid: 'Same account in the Paid Top',
    noFreeEntry: 'No Free Top entry',
    noPaidEntry: 'No Paid Top entry',
    otherSlotNote: (buyer: string) =>
      `${buyer} uses only this slot. Every account may hold one more — one entry in each top.`,
    rulesButton: 'Rules of the game',
  },

  profile: {
    title: 'Profile',
    meta: (name: string, username: string | null, joined: string) =>
      username ? `${name} · @${username} · joined ${joined}` : `${name} · joined ${joined}`,
    votesLabel: 'VOTES',
    votesUnit: 'votes',
    earn: 'Earn',
    paidLabel: 'PAID, ALL TIME',
    noWallet: 'No wallet — each bid is its own card payment.',
    refresh: 'Refresh',
    myProjects: 'My projects',
    add: 'Add',
    bothSlotsUsed: 'Both slots in use',
    noProjectsTitle: 'No projects yet',
    noProjectsNote: 'One link is enough — we read the name, description and preview from it.',
    addProject: 'Add a project',
    receipts: 'Payment receipts',
    paidLast30: 'Paid in the last 30 days',
    noReceipts: 'No payments yet. Raise, attack or an opening bid will show up here.',
    receiptRaise: (project: string) => `Raise · ${project}`,
    receiptEntry: (project: string) => `Opening bid · ${project}`,
    receiptAttack: (target: string) => `Attack on ${target}`,
    unknownProject: 'a removed project',
  },

  settings: {
    appearance: 'Appearance',
    appearanceNote: 'Language and theme apply to the bot and the site too.',
    language: 'Language',
    theme: 'Theme',
    themeNote: 'Auto follows your Telegram theme',
    themeAuto: 'Auto',
    themeLight: 'Light',
    themeDark: 'Dark',
    vibration: 'Vibration',
    vibrationNote: 'Haptic feedback on bids and attacks',
    currency: 'Currency',
    currencyNote: 'Display only — every charge is made in UZS',
    compact: 'Compact amounts',
    compactNote: '12.5 mln instead of 12 500 000',

    notifications: 'Notifications',
    notificationsNote: 'Sent through the bot. Attack alerts are the only way to know you were hit.',
    attacked: 'I was attacked',
    lostPosition: 'I lost a position',
    newTasks: 'New tasks',
    newTasksNote: 'Daily at 09:00',

    payments: 'Payments',
    paymentsNote:
      'No balance is kept for you: every raise, attack and opening bid is charged on the provider’s own page.',
    confirmPayments: 'Confirm every payment',
    confirmPaymentsNote: 'Ask again before each card charge',
    paymentMethods: 'Payment methods',
    paymentHistory: 'Payment history',

    account: 'Account',
    rules: 'Rules of the game',
    bot: 'Telegram bot',
    support: 'Support',
    terms: 'Terms & privacy',
    logOut: 'Log out',
    deleteAccount: 'Delete account',

    removeProjects: 'Remove my projects',
    removeProjectsNote: 'Frees both slots — you can add projects again',
    removeTitle: 'Remove my projects?',
    removeBody:
      'Your entries leave both tops and the slots are freed, so you can add projects again. The paid bid is not refunded.',
    removeConfirm: 'Remove',
    removeCancel: 'Keep them',
    removeFailed: 'Could not remove the projects — try again',
    removeDone: (count: number) =>
      count === 1 ? 'One project removed' : `${count} projects removed`,
    removeNothing: 'Nothing to remove — you have no projects yet',
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
    // Мок — не hosted-провайдер со своей страницей: он подтверждает платёж
    // прямо внутри create-payment (Срез 1.5, находка «Сноски врут» финального
    // ревью). Отдельная копия для него — честная, а не общий шаблон с
    // подставленным именем 'Test payment'.
    chargeNoteMock: 'Test payment confirms instantly, right here — no separate page, no charge.',
    // Та же неправда про «бот пришлёт цели алерт», что чинили в attack.warning
    // (Срез 1.6) — здесь она пряталась вторым экземпляром, потому что до этого
    // среза Attack на Pay-шторку попасть не мог. Бот уведомлений не рассылает.
    attackWarning: (rival: string) =>
      `The charge goes to the platform, never to ${rival}. Once the provider confirms it, it cannot be undone.`,
    submit: (amount: string, provider: string) => `Pay ${amount} via ${provider}`,
    footnote: (provider: string) =>
      `The payment opens on ${provider}'s own secure page and applies when ${provider} confirms it. BidWar keeps no balance for you — there is no wallet to top up and nothing of yours sitting with us.`,
    footnoteMock:
      'Test payment has no secure page of its own — it confirms immediately, right on this screen, and moves no real money. BidWar keeps no balance for you either way.',
  },
} as const;
