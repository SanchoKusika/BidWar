import type { PartialStrings } from './strings';

/**
 * Русский словарь.
 *
 * Тон тот же, что в английском: коротко, без рекламы и без обещаний, которых
 * механика не выполняет. Где в английском сказано «cannot be undone», по-русски
 * тоже сказано прямо — смягчать формулировки про необратимые списания нельзя.
 *
 * Правовые страницы и правила игры (`shared/content`) здесь не переводятся: это
 * не интерфейс, а тексты, за которые отвечает автор продукта. До их перевода
 * они показываются по-английски.
 */
export const ru: PartialStrings = {
  card: {
    takeSpot: 'Занять это место',
    details: 'Подробнее',
    verified: 'Проверен',
    clicks: 'Переходов на проект',
    medalGold: 'Золото',
    medalSilver: 'Серебро',
    medalBronze: 'Бронза',
    taskPending: 'Проверяем',
    taskDone: 'Готово',
    taskLocked: 'Закрыто',
    amount: 'Сумма',
    balance: 'Баланс',
    raise: 'Поднять',
    attack: 'Атаковать',
    giveVotes: 'Отдать голоса',
    tenure: (held: string) => `Держит первое место · ${held}`,
  },

  categories: {
    all: 'Все',
    channels: 'Каналы',
    bots: 'Боты',
    sites: 'Сайты',
    business: 'Бизнес',
    services: 'Услуги',
    profiles: 'Профили',
  },

  units: {
    thousand: 'тыс',
    million: 'млн',
  },

  tabs: {
    paid: 'Платный',
    free: 'Бесплатный',
    tasks: 'Задания',
    profile: 'Профиль',
  },

  duration: {
    justNow: 'только что',
    minutes: (value: number) => `${value} мин`,
    hours: (value: number) => `${value} ч`,
    daysHours: (days: number, hours: number) => `${days} дн ${hours} ч`,
    days: (value: number) => `${value} дн`,
    dateLocale: 'ru-RU',
  },

  common: {
    loading: 'Считаем…',
    cancel: 'Отмена',
    back: 'Назад',
    done: 'Готово',
    continueToPayment: 'Перейти к оплате',
  },

  addProject: {
    title: 'Добавить проект',
    subtitle: 'Хватит одной ссылки — остальное подтянем',
    linkLabel: 'ССЫЛКА НА ПРОЕКТ',
    linkPlaceholder: 't.me/вашканал или вашсайт.uz',
    destinationLabel: 'ГДЕ УЧАСТВУЕТ',
    categoryLabel: 'КАТЕГОРИЯ',
    free: { label: 'Бесплатный топ', sub: 'Голоса за задания' },
    paid: { label: 'Платный топ', sub: 'Денежные ставки' },
    slotUsed: 'Слот уже занят',
    paidSoon: 'Откроется с оплатой',
    freeNote:
      'Бесплатная запись начинается с нуля голосов. Поднимают её голосами за задания — деньги в бесплатный топ не заходят.',
    openingBidLabel: 'Открывающая ставка',
    openingBidError: (min: string) => `Минимальная открывающая ставка — ${min}`,
    footnote:
      'Не больше двух проектов на аккаунт: один в платном топе, один в бесплатном. Ссылка может быть одна и та же — записи соревнуются раздельно.',
    submitFree: 'Добавить проект',
    genericError: 'Не удалось добавить проект',
    needsTelegram: 'Открой мини-апп в Telegram, чтобы добавить проект',
  },

  raise: {
    title: 'Поднять ставку',
    boostTitle: 'Поднять этот проект',
    subtitle: (name: string, rank: number) => `${name} · сейчас #${rank}`,
    amountLabel: 'Сумма повышения',
    amountError: (min: string) => `Минимальное повышение — ${min}`,
    bidNow: 'Твоя ставка сейчас',
    bidAfter: 'Твоя ставка после',
    boostBidNow: 'Его ставка сейчас',
    boostBidAfter: 'Его ставка после',
    boostNote:
      'Ты платишь за чужую позицию: деньги идут площадке, а не владельцу, и проект поднимается на внесённую сумму. Твоя собственная ставка не меняется.',
    boostResultTitle: 'Проект поднят',
    boostResultNote: (name: string, amount: string, unit: string) =>
      `${amount} ${unit} ушли проекту «${name}». Его позиция обновилась у всех сразу.`,
    projectedPosition: 'Ожидаемая позиция',
    note: 'Одно списание на следующем экране. Повышение применится, когда провайдер подтвердит платёж, — баланс у нас не хранится.',
    resultTitle: 'Ставка поднята',
    resultNote: (amount: string, unit: string) =>
      `${amount} ${unit} зачислены. Позиция обновилась у всех сразу.`,
    openingResultTitle: 'Ты в платном топе',
    failed: 'Платёж не прошёл — ничего не списано.',
    pendingConfirmation: 'Платёж создан, ждём подтверждения — не плати второй раз.',
    unknownOutcome:
      'Связь оборвалась до ответа — мы не знаем, прошло списание или нет. Проверь свою позицию, прежде чем платить снова.',
  },

  attack: {
    title: 'Атака',
    titleConfirm: 'Подтвердить атаку',
    subtitle: (name: string, rank: number) => `${name} · #${rank}`,
    stepAmount: 'ШАГ 1 · СУММА',
    stepConfirm: 'ШАГ 2 · ПОДТВЕРЖДЕНИЕ',
    amountLabel: 'Сумма атаки',
    amountError: (min: string) => `Минимальная атака — ${min}`,
    targetLimitError: (max: number) =>
      `Дневной лимит по этому сопернику исчерпан — ${max} из ${max}`,
    dayLimitError: (max: number) => `Дневной лимит атак исчерпан — ${max} из ${max}`,
    effectsLabel: 'ОДИН ПЛАТЁЖ, ДВА ЭФФЕКТА',
    theirBid: 'Его ставка',
    yourBid: 'Твоя ставка',
    plainNote:
      'Ты платишь площадке, а не ему. Разрыв между вами сокращается вдвое быстрее, чем от обычного повышения.',
    haircutNote: (pct: number, hours: number) =>
      `Повторная атака по этому сопернику в течение ${hours} ч — тебе зачислится ${pct}% суммы, он всё равно потеряет её целиком.`,
    quota: (targetLeft: number, targetMax: number, dayLeft: number, dayMax: number) =>
      `Осталось атак на этого соперника сегодня: ${targetLeft} из ${targetMax} · всего ${dayLeft} из ${dayMax}`,
    review: 'Проверить атаку',
    youPayPlatform: 'Ты платишь площадке',
    rivalBid: (name: string) => `Ставка «${name}»`,
    creditedToYou: 'Зачислится тебе',
    creditedShare: (pct: number) => `${pct}% суммы`,
    gap: 'Разрыв между вами',
    gapPassed: 'ты обходишь его',
    floorReached: 'Его ставка уже на нижней границе — забирать больше нечего.',
    quoteFailed: 'Не удалось рассчитать атаку. Попробуй ещё раз.',
    resultTitle: 'Атака прошла',
    resultNote: (damage: string, credited: string, unit: string) =>
      `Его ставка потеряла ${damage} ${unit}, твоя выросла на ${credited} ${unit}.`,
    trimmedNote: (landed: string, floor: string) =>
      `Урезано до ${landed} — ставка не может опуститься ниже своей границы в ${floor}. Списывается только та часть, которая дошла.`,
    warning: (name: string) =>
      `Настоящие деньги, и отменить это нельзя. Ставка «${name}» упадёт в момент подтверждения платежа.`,
  },

  vote: {
    title: 'Отдать голоса',
    subtitle: (name: string, rank: number) => `${name} · сейчас #${rank}`,
    amountLabel: 'Сколько голосов отдать',
    balanceLabel: 'У тебя',
    amountError: 'Столько голосов у тебя нет',
    unit: 'голосов',
    votesAfter: 'Голосов у проекта станет',
    youKeep: 'Останется у тебя',
    keepValue: (votes: string) => `${votes} голосов`,
    submit: (votes: string) => `Отдать ${votes} голосов`,
  },

  showcase: {
    paidTitle: 'Платный топ',
    freeTitle: 'Бесплатный топ',
    yourVotes: 'ТВОИ ГОЛОСА',
    paidMeta: (count: number) => `${count} проектов · деньги не превращаются в голоса`,
    freeMeta: (count: number) => `${count} проектов · голоса не превращаются в деньги`,
    paidRanking: 'Платный рейтинг',
    freeRanking: 'Бесплатный рейтинг',
    inPlay: (total: string, unit: string) => `${total} ${unit} в игре`,
    allTime: 'За всё время',
    today: 'За сутки',
    todayNote: (segment: 'paid' | 'free') =>
      `Здесь считаются только последние 24 часа. ${segment === 'paid' ? 'Каждая ставка' : 'Каждый голос'} остаётся и в общем топе — ничего не теряется, просто сутки начинаются заново.`,
    todayEmptyTitle: 'За сутки ничего не сдвинулось',
    todayEmptyNote: 'Ни одна ставка в этом топе не менялась последние 24 часа.',
    justHappened: 'Только что',
    tierFrom: (amount: string) => `от ${amount}`,
    raiseMine: 'Поднять свою ставку',
    voteMine: 'Отдать голоса своему проекту',
    entryHintPaid: (price: string) =>
      `Последняя позиция в этом топе стоит ${price}. Добавь проект и поднимайся ставками.`,
    entryHintPaidUnknown: 'Добавь проект и сделай открывающую ставку.',
    entryHintFree: 'Бесплатная запись начинается с нуля голосов. Голоса на подъём дают задания.',
    holdFirstPaid: 'Ты держишь первое место. Любое повышение увеличивает отрыв.',
    holdFirstFree: 'Ты держишь первое место. Продолжай собирать голоса.',
    gapPaid: (amount: string, rival: string, rank: number) =>
      `Подними на ${amount}, чтобы обойти «${rival}» на #${rank}.`,
    gapFree: (amount: string, rival: string, rank: number) =>
      `Нужно ещё ${amount} голосов, чтобы обойти «${rival}» на #${rank}.`,
    loadMore: 'Показать ещё',
    errorTitle: 'Не удалось загрузить топ',
    errorNote: 'Проверь соединение и попробуй ещё раз.',
    retry: 'Попробовать ещё раз',
    emptyPaidTitle: 'В этой категории ещё нет ставок',
    emptyFreeTitle: 'Здесь пока нет проектов',
    emptyPaidNote: 'Сделай первую ставку и займи первое место.',
    emptyFreeNote: 'Стань первым, кто соберёт голоса в этой категории.',
    signInFailed: 'Не удалось войти',
    signInNote: 'Закрой мини-апп и открой его заново.',
  },

  rules: {
    title: 'Правила игры',
    meta: 'Одинаковы в мини-аппе и на сайте.',
    askSupport: 'Всё ещё непонятно? Спроси поддержку',
    chip: 'Правила',
  },

  docs: {
    tabs: {
      about: 'О проекте',
      support: 'Поддержка',
      terms: 'Условия',
      privacy: 'Приватность',
      bot: 'Бот',
    },
    openBot: (handle: string) => `Открыть ${handle}`,
  },

  referral: {
    kicker: 'Приглашай друзей, получай голоса',
    reward: (votes: string) => `+${votes} голосов за друга`,
    invited: 'Приглашено',
    earned: 'Голосов получено',
    share: 'Поделиться в Telegram',
    copy: 'Скопировать',
    copied: 'Скопировано',
    copyAria: 'Скопировать ссылку',
  },

  tasks: {
    title: 'Задания',
    meta: 'Выполняй задания, получай голоса. Голоса — не деньги.',
    yourVotes: 'ТВОИ ГОЛОСА',
    visitTitle: 'Подтолкни платный проект',
    visitNote: 'Открывай проекты из платного топа. Голос за проект, десять в сутки.',
    referralTitle: 'Приглашай друзей',
    referralNote:
      'Голоса приходят, когда друг выполнит первое задание, а не когда откроет приложение.',
    subscribeTitle: (channel: string) => `Подпишись на ${channel}`,
    subscribeNote: 'Оставайся подписанным, чтобы голоса не пропали.',
    daily: 'Каждый день',
    oneTime: 'Разовые',
    emptyTitle: 'На сегодня всё',
    emptyNote: 'Новые задания появляются каждый день в 09:00.',
    notSubscribed: 'Похоже, ты ещё не подписан. Мы открыли канал — подпишись и нажми снова.',
    errorTitle: 'Задания не загрузились',
    errorNote: 'Список лежит на сервере, и он не ответил. Попробуй ещё раз.',
    retry: 'Попробовать ещё раз',
  },

  project: {
    boughtBy: (buyer: string, since: string) => `купил ${buyer} · с ${since}`,
    position: 'Позиция',
    heldAt1: 'Держит первое место',
    currentBid: 'Текущая ставка',
    votes: 'Голоса',
    clicks: 'Переходы',
    verified: 'Проверен',
    yes: 'Да',
    no: 'Нет',
    open: (url: string) => `Открыть ${url}`,
    raiseMine: 'Поднять свою ставку',
    raiseThis: 'Поднять этот проект',
    attack: 'Атаковать',
    giveVotes: 'Отдать голоса',
    bidActivity: 'История ставки',
    activityRaise: 'Повышение',
    activityAttackIn: (target: string) => `Атака на «${target}»`,
    activityAttackOut: 'Атакован',
    voteActivity: 'История голосов',
    sameAccountFree: 'Тот же аккаунт в бесплатном топе',
    sameAccountPaid: 'Тот же аккаунт в платном топе',
    noFreeEntry: 'Записи в бесплатном топе нет',
    noPaidEntry: 'Записи в платном топе нет',
    otherSlotNote: (buyer: string) =>
      `${buyer} занимает только этот слот. У каждого аккаунта есть ещё один — по одной записи в каждом топе.`,
    rulesButton: 'Правила игры',
  },

  profile: {
    title: 'Профиль',
    meta: (name: string, username: string | null, joined: string) =>
      username ? `${name} · @${username} · с ${joined}` : `${name} · с ${joined}`,
    votesLabel: 'ГОЛОСА',
    votesUnit: 'голосов',
    earn: 'Заработать',
    paidLabel: 'ЗАПЛАЧЕНО ЗА ВСЁ ВРЕМЯ',
    noWallet: 'Кошелька нет — каждая ставка оплачивается отдельно.',
    refresh: 'Обновить',
    myProjects: 'Мои проекты',
    add: 'Добавить',
    bothSlotsUsed: 'Оба слота заняты',
    noProjectsTitle: 'Проектов пока нет',
    noProjectsNote: 'Хватит одной ссылки — имя, описание и превью прочитаем из неё.',
    addProject: 'Добавить проект',
    receipts: 'Чеки',
    paidLast30: 'Заплачено за 30 дней',
    noReceipts: 'Платежей пока нет. Повышение, атака или открывающая ставка появятся здесь.',
    receiptRaise: (project: string) => `Повышение · ${project}`,
    receiptEntry: (project: string) => `Открывающая ставка · ${project}`,
    receiptAttack: (target: string) => `Атака на «${target}»`,
    unknownProject: 'удалённый проект',
    referralShareText:
      'Добавь свой проект в BidWar — топ, где позицию покупают, а голоса зарабатывают.',
  },

  settings: {
    appearance: 'Оформление',
    appearanceNote: 'Язык и тема применяются и к боту, и к сайту.',
    language: 'Язык',
    theme: 'Тема',
    themeNote: '«Авто» следует за темой Telegram',
    themeAuto: 'Авто',
    themeLight: 'Светлая',
    themeDark: 'Тёмная',
    vibration: 'Вибрация',
    vibrationNote: 'Короткий отклик, когда ставка, атака или голос прошли',
    currency: 'Валюта',
    currencyNote: 'Только для показа — списывается всегда в сумах',
    compact: 'Компактные суммы',
    compactNote: '12,5 млн вместо 12 500 000',

    notifications: 'Уведомления',
    notificationsNote: 'Приходят через бота. Об атаке узнать иначе нельзя — только из уведомления.',
    attacked: 'Меня атаковали',
    lostPosition: 'Я потерял первое место',
    votesDigest: 'Голоса за мой проект',
    votesDigestNote: 'Дайджестом, а не по сообщению на голос',
    referralAlert: 'Приглашённый принёс голоса',
    saveFailed: 'Не удалось сохранить настройку — попробуй ещё раз',

    payments: 'Платежи',
    paymentsNote:
      'Баланс у нас не хранится: каждое повышение, атака и открывающая ставка списываются на странице провайдера.',
    paymentMethods: 'Способы оплаты',
    paymentHistory: 'История платежей',

    account: 'Аккаунт',
    rules: 'Правила игры',
    bot: 'Телеграм-бот',
    support: 'Поддержка',
    terms: 'Условия и приватность',

    removeProjects: 'Убрать мои проекты',
    removeProjectsNote: 'Освободит оба слота — проекты можно будет добавить заново',
    removeTitle: 'Убрать мои проекты?',
    removeBody:
      'Записи уйдут из обоих топов, слоты освободятся, и проекты можно будет добавить заново. Оплаченная ставка не возвращается.',
    removeConfirm: 'Убрать',
    removeCancel: 'Оставить',
    removeFailed: 'Не удалось убрать проекты — попробуй ещё раз',
    removeDone: (count: number) =>
      count === 1 ? 'Один проект убран' : `Проектов убрано: ${count}`,
    removeNothing: 'Убирать нечего — проектов пока нет',
  },

  pay: {
    titleAttack: 'Оплата атаки',
    titleProject: 'Оплата открывающей ставки',
    titleRaise: 'Оплата повышения',
    youPay: 'К ОПЛАТЕ',
    methodLabel: 'СПОСОБ ОПЛАТЫ',
    chargeNote: (provider: string, unit: string) => `${provider} списывает в ${unit}.`,
    chargeNoteMock:
      'Тестовый платёж подтверждается сразу здесь — без отдельной страницы и без списания.',
    attackWarning: (rival: string) =>
      `Списание идёт площадке, а не проекту «${rival}». После подтверждения провайдером отменить нельзя.`,
    submit: (amount: string, provider: string) => `Заплатить ${amount} через ${provider}`,
    footnote: (provider: string) =>
      `Оплата откроется на защищённой странице ${provider} и применится, когда ${provider} её подтвердит. Баланс BidWar для тебя не ведёт — пополнять нечего, и твоих денег у нас не лежит.`,
    footnoteMock:
      'У тестового платежа нет своей защищённой страницы — он подтверждается сразу на этом экране и не двигает настоящих денег. Баланс BidWar для тебя не ведёт в любом случае.',
  },
};
