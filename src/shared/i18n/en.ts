/**
 * Английский словарь — он же эталон формы.
 *
 * Остальные языки описаны как частичные копии этого объекта: чего в них нет,
 * подставляется отсюда. Поэтому именно английский обязан быть полным, и
 * именно из него выводится тип `Strings`.
 *
 * Интерполяция — функциями, чтобы у переводчика был весь шаблон целиком, а не
 * склейка из кусков: порядок слов в узбекском и русском другой, и собирать
 * фразу из обрывков значит запретить перевод заранее.
 */

export const en = {
  /**
   * Строки, зашитые в компоненты дизайн-системы: подписи кнопок на карточке,
   * состояния задания, названия медалей. Лежат здесь по той же причине, что и
   * все остальные, — иначе переключение языка обходит их стороной.
   */
  card: {
    takeSpot: 'Take this spot',
    details: 'Details',
    verified: 'Verified',
    clicks: 'Clicks to the project',
    medalGold: 'Gold',
    medalSilver: 'Silver',
    medalBronze: 'Bronze',
    taskPending: 'Checking',
    taskDone: 'Done',
    taskLocked: 'Locked',
    amount: 'Amount',
    balance: 'Balance',
    /** Chip on your own row in the list. */
    you: 'YOU',
    /** Tooltip on the crown of a project leading its category. */
    catLeader: (category: string) => `Category leader · ${category}`,
    raise: 'Raise',
    attack: 'Attack',
    giveVotes: 'Give votes',
    /** Подпись к короне: сколько проект держит первое место. */
    tenure: (held: string) => `Holds first place · ${held}`,
  },

  /**
   * Categories. Their names live in the database in English, but that is not
   * user text: the list is fixed and seeded by the first migration. The screen
   * prints its own by `slug`; an unknown slug falls back to whatever the
   * database holds, so a category added later still shows up.
   */
  categories: {
    all: 'All',
    channels: 'Channels',
    bots: 'Bots',
    sites: 'Sites',
    business: 'Business',
    services: 'Services',
    profiles: 'Profiles',
  },

  /**
   * Short forms for thousands and millions. They end up inside the numbers of
   * both economies, which is why they live on their own: «12.5 mln» in a
   * Russian interface reads as a foreign language in the middle of its digits.
   */
  units: {
    thousand: 'K',
    million: 'mil',
  },

  /**
   * The own-position panel under the board header, and the numeric captions on
   * cards. One section because the same words appear in three places — the
   * panel, the project page and the stat block — and they must not drift.
   */
  own: {
    position: 'YOUR POSITION',
    bid: 'YOUR BID',
    votes: 'YOUR VOTES',
    bidShort: 'BID',
    votesShort: 'VOTES',
    noEntryPaid: 'No entry in the Paid Top yet',
    noEntryFree: 'No entry in the Free Top yet',
    addMine: 'Add my project',
    addMore: 'Add project',
  },

  /** Нижнее меню. Четыре вкладки, подписи короткие — места под ними нет. */
  tabs: {
    paid: 'Paid',
    free: 'Free',
    tasks: 'Tasks',
    profile: 'Profile',
  },

  common: {
    loading: 'Working out the numbers…',
    cancel: 'Cancel',
    back: 'Back',
    done: 'Done',
    continueToPayment: 'Continue to payment',
    /** Button that fills the amount field to its ceiling. */
    max: 'MAX',
  },

  /**
   * Единицы времени удержания первого места. Отдельно от `common`, потому что
   * их читает `shared/lib/format`, а не экран: сама длительность считается
   * там же, где форматируется.
   */
  duration: {
    justNow: 'just now',
    minutes: (value: number) => `${value} min`,
    hours: (value: number) => `${value} h`,
    daysHours: (days: number, hours: number) => `${days} d ${hours} h`,
    days: (value: number) => `${value} d`,
    /** Локаль дат: её выбирает словарь, иначе даты остались бы английскими. */
    dateLocale: 'en-GB',
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
    needsTelegram: 'Open the mini app inside Telegram to add a project',
  },

  raise: {
    title: 'Raise',
    // Чужой проект: заголовок обязан говорить, чья ставка вырастет, — иначе
    // «Raise» на чужой карточке читается как повышение своей.
    boostTitle: 'Raise this project',
    subtitle: (name: string, rank: number) => `${name} · now #${rank}`,
    amountLabel: 'Raise amount',
    amountError: (min: string) => `Minimum raise is ${min}`,
    bidNow: 'Your bid now',
    bidAfter: 'Your bid after',
    boostBidNow: 'Its bid now',
    boostBidAfter: 'Its bid after',
    boostNote:
      'You are paying for someone else’s position: the money goes to the platform, never to the owner, and the project climbs by the amount you pay. Your own bid does not change.',
    boostResultTitle: 'Project raised',
    boostResultNote: (name: string, amount: string, unit: string) =>
      `${amount} ${unit} went to ${name}. Its position updates for everyone right away.`,
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
    todayEmptyTitle: 'Nothing moved today',
    todayEmptyNote: 'No bid in this top changed in the last 24 hours.',
    justHappened: 'Just happened',
    /** Подпись яруса: «от 500 000 so'm» — цена входа в этот десяток. */
    tierFrom: (amount: string) => `from ${amount}`,
    /** Tier divider label. A reading aid over a long list, not a mechanic. */
    tier: (rank: number) => `Top ${rank}`,
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

  referral: {
    kicker: 'Invite friends, get votes',
    reward: (votes: string) => `+${votes} votes per friend`,
    invited: 'Invited',
    earned: 'Votes earned',
    share: 'Share in Telegram',
    copy: 'Copy',
    copied: 'Copied',
    copyAria: 'Copy the link',
  },

  tasks: {
    title: 'Tasks',
    meta: 'Complete tasks, get votes. Votes are not money.',
    yourVotes: 'YOUR VOTES',
    /**
     * Названия заданий приходят из базы по-английски: список у платформы
     * фиксированный, и строка задания — не пользовательский текст, а часть
     * продукта. Поэтому экран печатает свои подписи по типу задания, а из базы
     * берёт только число награды и состояние. Канал в подписи `subscribe` —
     * имя собственное, оно не переводится ни на каком языке.
     */
    visitTitle: 'Push a paid project',
    visitNote: 'Open projects from the Paid Top. One vote per project, ten a day.',
    referralTitle: 'Invite friends',
    referralNote:
      'Votes land when the friend finishes their first task, not when they open the app.',
    subscribeTitle: (channel: string) => `Subscribe to ${channel}`,
    subscribeNote: 'Stay subscribed to keep the votes.',
    daily: 'Daily',
    oneTime: 'One-time',
    emptyTitle: "That's everything for today",
    emptyNote: 'New tasks appear every day at 09:00.',
    notSubscribed:
      'Looks like you are not subscribed yet. We opened the channel — subscribe and tap again.',
    errorTitle: 'Tasks did not load',
    errorNote: 'The list is on the server, and it did not answer. Try again.',
    retry: 'Try again',
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
    // Чужой проект поднимают донатом, а не перебивают: своя ставка при этом не
    // меняется вовсе, и «Outbid» обещал бы не то действие.
    raiseThis: 'Raise this project',
    attack: 'Attack',
    giveVotes: 'Give votes',
    bidActivity: 'Bid activity',
    activityRaise: 'Raise',
    activityAttackIn: (target: string) => `Attack on ${target}`,
    activityAttackOut: 'Attacked',
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
    referralShareText:
      'Add your project to BidWar — the top where position is bought and votes are earned.',
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
    vibrationNote: 'A short buzz when a bid, attack or vote goes through',
    currency: 'Currency',
    currencyNote: 'Display only — every charge is made in UZS',
    compact: 'Compact amounts',
    compactNote: '12.5 mil instead of 12 500 000',

    notifications: 'Notifications',
    notificationsNote: 'Sent through the bot. Attack alerts are the only way to know you were hit.',
    attacked: 'I was attacked',
    lostPosition: 'I lost first place',
    votesDigest: 'Votes for my project',
    votesDigestNote: 'A digest, not one message per vote',
    referralAlert: 'My invite earned votes',
    saveFailed: 'Could not save the setting — try again',

    payments: 'Payments',
    paymentsNote:
      'No balance is kept for you: every raise, attack and opening bid is charged on the provider’s own page.',
    paymentMethods: 'Payment methods',
    paymentHistory: 'Payment history',

    account: 'Account',
    rules: 'Rules of the game',
    bot: 'Telegram bot',
    support: 'Support',
    terms: 'Terms & privacy',

    removeProjects: 'Delete my projects',
    removeProjectsNote: 'Deletes projects and payment history — a fresh account',
    removeTitle: 'Delete my projects?',
    removeBody:
      'Your projects, bids and the whole payment history are deleted for good, and your vote balance goes to zero. Nothing paid is refunded.',
    removeConfirm: 'Delete',
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
