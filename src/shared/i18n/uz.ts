import type { PartialStrings } from './strings';

/**
 * Узбекский словарь, латиница.
 *
 * Тон тот же, что в английском и русском: коротко и без обещаний, которых
 * механика не выполняет. Обращение на «siz» — в отличие от русского «ты»:
 * по-узбекски «sen» в интерфейсе читается фамильярно, а не по-дружески.
 *
 * Правовые страницы и правила игры (`shared/content`) здесь не переводятся:
 * это не интерфейс, а тексты, за которые отвечает автор продукта.
 */
export const uz: PartialStrings = {
  card: {
    takeSpot: 'Bu joyni egallash',
    details: 'Batafsil',
    verified: 'Tekshirilgan',
    clicks: "Loyihaga o'tishlar",
    medalGold: 'Oltin',
    medalSilver: 'Kumush',
    medalBronze: 'Bronza',
    taskPending: 'Tekshirilmoqda',
    taskDone: 'Bajarildi',
    taskLocked: 'Yopiq',
    amount: 'Summa',
    balance: 'Balans',
    raise: "Ko'tarish",
    attack: 'Hujum qilish',
    giveVotes: 'Ovoz berish',
    tenure: (held: string) => `Birinchi o'rinni ushlab turibdi · ${held}`,
  },

  tabs: {
    paid: "To'lovli",
    free: 'Bepul',
    tasks: 'Topshiriqlar',
    profile: 'Profil',
  },

  duration: {
    justNow: 'hozirgina',
    minutes: (value: number) => `${value} daq`,
    hours: (value: number) => `${value} soat`,
    daysHours: (days: number, hours: number) => `${days} kun ${hours} soat`,
    days: (value: number) => `${value} kun`,
    dateLocale: 'uz-UZ',
  },

  common: {
    loading: 'Hisoblanmoqda…',
    cancel: 'Bekor qilish',
    back: 'Orqaga',
    done: 'Tayyor',
    continueToPayment: "To'lovga o'tish",
  },

  addProject: {
    title: "Loyiha qo'shish",
    subtitle: "Bitta havola yetarli — qolganini o'zimiz olamiz",
    linkLabel: 'LOYIHA HAVOLASI',
    linkPlaceholder: 't.me/kanalingiz yoki saytingiz.uz',
    destinationLabel: 'QAYERDA QATNASHADI',
    categoryLabel: 'TOIFA',
    free: { label: 'Bepul top', sub: 'Topshiriqlardan ovozlar' },
    paid: { label: "To'lovli top", sub: 'Pul stavkalari' },
    slotUsed: 'Joy allaqachon band',
    paidSoon: "To'lovlar bilan ochiladi",
    freeNote:
      "Bepul yozuv noldan boshlanadi. Uni topshiriqlardan olingan ovozlar ko'taradi — bepul topga pul kirmaydi.",
    openingBidLabel: 'Ochilish stavkasi',
    openingBidError: (min: string) => `Eng kam ochilish stavkasi — ${min}`,
    footnote:
      "Har akkauntga ko'pi bilan ikkita loyiha: biri to'lovli topda, biri bepulda. Havola bir xil bo'lishi mumkin — yozuvlar alohida raqobatlashadi.",
    submitFree: "Loyihani qo'shish",
    genericError: "Loyihani qo'shib bo'lmadi",
    needsTelegram: "Loyiha qo'shish uchun mini-ilovani Telegram ichida oching",
  },

  raise: {
    title: "Stavkani ko'tarish",
    boostTitle: "Bu loyihani ko'tarish",
    subtitle: (name: string, rank: number) => `${name} · hozir #${rank}`,
    amountLabel: "Ko'tarish summasi",
    amountError: (min: string) => `Eng kam ko'tarish — ${min}`,
    bidNow: 'Sizning stavkangiz hozir',
    bidAfter: 'Sizning stavkangiz keyin',
    boostBidNow: 'Uning stavkasi hozir',
    boostBidAfter: 'Uning stavkasi keyin',
    boostNote:
      "Siz begona pozitsiya uchun to'laysiz: pul egasiga emas, platformaga boradi, loyiha esa to'langan summaga ko'tariladi. Sizning stavkangiz o'zgarmaydi.",
    boostResultTitle: "Loyiha ko'tarildi",
    boostResultNote: (name: string, amount: string, unit: string) =>
      `${amount} ${unit} «${name}» loyihasiga o'tdi. Uning pozitsiyasi hamma uchun darhol yangilandi.`,
    projectedPosition: 'Kutilayotgan pozitsiya',
    note: "Keyingi ekranda bitta to'lov. Ko'tarish provayder to'lovni tasdiqlaganda amalga oshadi — sizning hisobingiz bizda saqlanmaydi.",
    resultTitle: "Stavka ko'tarildi",
    resultNote: (amount: string, unit: string) =>
      `${amount} ${unit} hisoblandi. Pozitsiya hamma uchun darhol yangilandi.`,
    openingResultTitle: "Siz to'lovli topdasiz",
    failed: "To'lov o'tmadi — hech narsa yechilmadi.",
    pendingConfirmation: "To'lov yaratildi, tasdiq kutilmoqda — hozircha ikkinchi marta to'lamang.",
    unknownOutcome:
      "Javob kelgunicha aloqa uzildi — to'lov o'tdimi yoki yo'qmi, bilmaymiz. Qayta to'lashdan oldin pozitsiyangizni tekshiring.",
  },

  attack: {
    title: 'Hujum',
    titleConfirm: 'Hujumni tasdiqlash',
    subtitle: (name: string, rank: number) => `${name} · #${rank}`,
    stepAmount: '1-QADAM · SUMMA',
    stepConfirm: '2-QADAM · TASDIQ',
    amountLabel: 'Hujum summasi',
    amountError: (min: string) => `Eng kam hujum — ${min}`,
    targetLimitError: (max: number) => `Bu raqib bo'yicha kunlik chek tugadi — ${max} dan ${max}`,
    dayLimitError: (max: number) => `Kunlik hujum cheki tugadi — ${max} dan ${max}`,
    effectsLabel: "BITTA TO'LOV, IKKITA TA'SIR",
    theirBid: 'Uning stavkasi',
    yourBid: 'Sizning stavkangiz',
    plainNote:
      "Siz unga emas, platformaga to'laysiz. Oradagi farq oddiy ko'tarishdan ikki barobar tez qisqaradi.",
    haircutNote: (pct: number, hours: number) =>
      `${hours} soat ichida shu raqibga takroriy hujum — sizga summaning ${pct}% i hisoblanadi, u baribir hammasini yo'qotadi.`,
    quota: (targetLeft: number, targetMax: number, dayLeft: number, dayMax: number) =>
      `Bugun bu raqibga ${targetMax} tadan ${targetLeft} hujum qoldi · umumiy ${dayMax} tadan ${dayLeft}`,
    review: 'Hujumni tekshirish',
    youPayPlatform: "Siz platformaga to'laysiz",
    rivalBid: (name: string) => `«${name}» stavkasi`,
    creditedToYou: 'Sizga hisoblanadi',
    creditedShare: (pct: number) => `summaning ${pct}% i`,
    gap: 'Oradagi farq',
    gapPassed: 'siz uni ortda qoldirasiz',
    floorReached: "Uning stavkasi allaqachon quyi chegarada — olib qo'yadigan narsa qolmadi.",
    quoteFailed: "Hujumni hisoblab bo'lmadi. Yana urinib ko'ring.",
    resultTitle: "Hujum o'tdi",
    resultNote: (damage: string, credited: string, unit: string) =>
      `Uning stavkasi ${damage} ${unit} yo'qotdi, sizniki ${credited} ${unit} ga oshdi.`,
    trimmedNote: (landed: string, floor: string) =>
      `${landed} gacha qisqartirildi — stavka ${floor} chegarasidan pastga tusha olmaydi. Faqat yetib borgan qismi yechiladi.`,
    warning: (name: string) =>
      `Bu haqiqiy pul va uni ortga qaytarib bo'lmaydi. «${name}» stavkasi to'lov tasdiqlangan zahoti tushadi.`,
  },

  vote: {
    title: 'Ovoz berish',
    subtitle: (name: string, rank: number) => `${name} · hozir #${rank}`,
    amountLabel: 'Nechta ovoz berasiz',
    balanceLabel: 'Sizda bor',
    amountError: "Sizda buncha ovoz yo'q",
    unit: 'ovoz',
    votesAfter: "Loyihada ovoz bo'ladi",
    youKeep: 'Sizda qoladi',
    keepValue: (votes: string) => `${votes} ovoz`,
    submit: (votes: string) => `${votes} ovoz berish`,
  },

  showcase: {
    paidTitle: "To'lovli top",
    freeTitle: 'Bepul top',
    yourVotes: 'SIZNING OVOZLARINGIZ',
    paidMeta: (count: number) => `${count} loyiha · pul ovozga aylanmaydi`,
    freeMeta: (count: number) => `${count} loyiha · ovoz pulga aylanmaydi`,
    paidRanking: "To'lovli reyting",
    freeRanking: 'Bepul reyting',
    inPlay: (total: string, unit: string) => `${total} ${unit} o'yinda`,
    allTime: 'Butun vaqt',
    today: 'Bir kunda',
    todayNote: (segment: 'paid' | 'free') =>
      `Bu yerda faqat oxirgi 24 soat hisoblanadi. Har bir ${segment === 'paid' ? 'stavka' : 'ovoz'} umumiy topda ham qoladi — hech narsa yo'qolmaydi, shunchaki kun qaytadan boshlanadi.`,
    todayEmptyTitle: 'Bugun hech narsa qimirlamadi',
    todayEmptyNote: "Bu topda oxirgi 24 soatda birorta stavka o'zgarmadi.",
    justHappened: 'Hozirgina',
    tierFrom: (amount: string) => `${amount} dan`,
    raiseMine: "O'z stavkamni ko'tarish",
    voteMine: "O'z loyihamga ovoz berish",
    entryHintPaid: (price: string) =>
      `Bu topdagi oxirgi pozitsiya ${price} turadi. Loyihangizni qo'shing va stavkalar bilan ko'tarilib boring.`,
    entryHintPaidUnknown: "Loyihangizni qo'shing va ochilish stavkasini qiling.",
    entryHintFree:
      "Bepul yozuv noldan boshlanadi. Ko'tarilish uchun ovozlarni topshiriqlar beradi.",
    holdFirstPaid: "Siz birinchi o'rindasiz. Har qanday ko'tarish farqni kengaytiradi.",
    holdFirstFree: "Siz birinchi o'rindasiz. Ovoz yig'ishda davom eting.",
    gapPaid: (amount: string, rival: string, rank: number) =>
      `#${rank} dagi «${rival}» ni ortda qoldirish uchun ${amount} ga ko'taring.`,
    gapFree: (amount: string, rival: string, rank: number) =>
      `#${rank} dagi «${rival}» ni ortda qoldirish uchun yana ${amount} ovoz kerak.`,
    loadMore: "Ko'proq ko'rsatish",
    errorTitle: "Topni yuklab bo'lmadi",
    errorNote: "Aloqani tekshiring va yana urinib ko'ring.",
    retry: "Yana urinib ko'rish",
    emptyPaidTitle: "Bu toifada hali stavkalar yo'q",
    emptyFreeTitle: "Bu yerda hali loyihalar yo'q",
    emptyPaidNote: "Birinchi stavkani qo'ying va birinchi o'rinni egallang.",
    emptyFreeNote: "Bu toifada ovoz yig'gan birinchi odam bo'ling.",
    signInFailed: "Kirib bo'lmadi",
    signInNote: 'Mini ilovani yopib, qaytadan oching.',
  },

  rules: {
    title: "O'yin qoidalari",
    meta: 'Mini ilovada ham, saytda ham bir xil.',
    askSupport: "Baribir tushunarsizmi? Qo'llab-quvvatlashdan so'rang",
    chip: 'Qoidalar',
  },

  docs: {
    tabs: {
      about: 'Loyiha haqida',
      support: "Qo'llab-quvvatlash",
      terms: 'Shartlar',
      privacy: 'Maxfiylik',
      bot: 'Bot',
    },
    openBot: (handle: string) => `${handle} ni ochish`,
  },

  referral: {
    kicker: "Do'stlaringizni taklif qiling, ovoz oling",
    reward: (votes: string) => `har bir do'st uchun +${votes} ovoz`,
    invited: 'Taklif qilingan',
    earned: 'Olingan ovozlar',
    share: 'Telegramda ulashish',
    copy: 'Nusxalash',
    copied: 'Nusxalandi',
    copyAria: 'Havoladan nusxa olish',
  },

  tasks: {
    title: 'Topshiriqlar',
    meta: 'Topshiriqlarni bajaring, ovoz oling. Ovoz — pul emas.',
    yourVotes: 'SIZNING OVOZLARINGIZ',
    visitTitle: "To'lovli loyihani qo'llab-quvvatlang",
    visitNote: "To'lovli topdagi loyihani oching. Har loyiha uchun kuniga bitta ovoz.",
    referralTitle: "Do'stlaringizni taklif qiling",
    referralNote:
      "Ovozlar do'stingiz birinchi topshiriqni bajarganda keladi, ilovani ochganda emas.",
    subscribeTitle: (channel: string) => `${channel} kanaliga obuna bo'ling`,
    subscribeNote: 'Ovozlar saqlanishi uchun obunada qoling.',
    daily: 'Har kuni',
    oneTime: 'Bir martalik',
    emptyTitle: 'Bugunga shu',
    emptyNote: "Yangi topshiriqlar har kuni soat 09:00 da paydo bo'ladi.",
    notSubscribed:
      "Siz hali obuna bo'lmaganga o'xshaysiz. Kanalni ochdik — obuna bo'ling va yana bosing.",
    errorTitle: 'Topshiriqlar yuklanmadi',
    errorNote: "Ro'yxat serverda va u javob bermadi. Yana urinib ko'ring.",
    retry: "Yana urinib ko'rish",
  },

  project: {
    boughtBy: (buyer: string, since: string) => `${buyer} sotib olgan · ${since} dan beri`,
    position: 'Pozitsiya',
    heldAt1: "Birinchi o'rinda",
    currentBid: 'Joriy stavka',
    votes: 'Ovozlar',
    clicks: "O'tishlar",
    verified: 'Tekshirilgan',
    yes: 'Ha',
    no: "Yo'q",
    open: (url: string) => `${url} ni ochish`,
    raiseMine: "O'z stavkamni ko'tarish",
    raiseThis: "Bu loyihani ko'tarish",
    attack: 'Hujum qilish',
    giveVotes: 'Ovoz berish',
    bidActivity: 'Stavka tarixi',
    activityRaise: "Ko'tarish",
    activityAttackIn: (target: string) => `«${target}» ga hujum`,
    activityAttackOut: 'Hujumga uchradi',
    voteActivity: 'Ovozlar tarixi',
    sameAccountFree: "O'sha akkaunt bepul topda",
    sameAccountPaid: "O'sha akkaunt to'lovli topda",
    noFreeEntry: "Bepul topda yozuv yo'q",
    noPaidEntry: "To'lovli topda yozuv yo'q",
    otherSlotNote: (buyer: string) =>
      `${buyer} faqat shu joyni band qilgan. Har akkauntda yana bittasi bor — har topda bittadan yozuv.`,
    rulesButton: "O'yin qoidalari",
  },

  profile: {
    title: 'Profil',
    meta: (name: string, username: string | null, joined: string) =>
      username ? `${name} · @${username} · ${joined} dan beri` : `${name} · ${joined} dan beri`,
    votesLabel: 'OVOZLAR',
    votesUnit: 'ovoz',
    earn: 'Ishlab olish',
    paidLabel: "BUTUN VAQT UCHUN TO'LANGAN",
    noWallet: "Hamyon yo'q — har bir stavka alohida to'lanadi.",
    refresh: 'Yangilash',
    myProjects: 'Mening loyihalarim',
    add: "Qo'shish",
    bothSlotsUsed: 'Ikkala joy ham band',
    noProjectsTitle: "Hali loyihalar yo'q",
    noProjectsNote: "Bitta havola yetarli — nom, tavsif va ko'rinishni o'zimiz o'qiymiz.",
    addProject: "Loyiha qo'shish",
    receipts: 'Cheklar',
    paidLast30: "30 kunda to'langan",
    noReceipts: "Hali to'lovlar yo'q. Ko'tarish, hujum yoki ochilish stavkasi shu yerda ko'rinadi.",
    receiptRaise: (project: string) => `Ko'tarish · ${project}`,
    receiptEntry: (project: string) => `Ochilish stavkasi · ${project}`,
    receiptAttack: (target: string) => `«${target}» ga hujum`,
    unknownProject: "o'chirilgan loyiha",
    referralShareText:
      "Loyihangizni BidWar ga qo'shing — bu yerda pozitsiya sotib olinadi, ovoz esa ishlab topiladi.",
  },

  settings: {
    appearance: "Ko'rinish",
    appearanceNote: "Til va mavzu botga ham, saytga ham qo'llaniladi.",
    language: 'Til',
    theme: 'Mavzu',
    themeNote: '«Avto» Telegram mavzusiga ergashadi',
    themeAuto: 'Avto',
    themeLight: "Yorug'",
    themeDark: "Qorong'i",
    vibration: 'Tebranish',
    vibrationNote: "Stavka, hujum yoki ovoz o'tganda qisqa javob",
    currency: 'Valyuta',
    currencyNote: "Faqat ko'rsatish uchun — yechim doim so'mda",
    compact: 'Ixcham summalar',
    compactNote: "12,5 mln — 12 500 000 o'rniga",

    notifications: 'Bildirishnomalar',
    notificationsNote:
      "Bot orqali keladi. Hujum haqida boshqa yo'l bilan bilib bo'lmaydi — faqat bildirishnomadan.",
    attacked: 'Menga hujum qilishdi',
    lostPosition: "Birinchi o'rinni yo'qotdim",
    votesDigest: 'Loyiham uchun ovozlar',
    votesDigestNote: 'Dayjest shaklida, har bir ovoz uchun alohida emas',
    referralAlert: 'Taklif qilganim ovoz keltirdi',
    saveFailed: "Sozlamani saqlab bo'lmadi — qayta urinib ko'ring",

    payments: "To'lovlar",
    paymentsNote:
      "Hisobingiz bizda saqlanmaydi: har bir ko'tarish, hujum va ochilish stavkasi provayder sahifasida yechiladi.",
    paymentMethods: "To'lov usullari",
    paymentHistory: "To'lovlar tarixi",

    account: 'Akkaunt',
    rules: "O'yin qoidalari",
    bot: 'Telegram bot',
    support: "Qo'llab-quvvatlash",
    terms: 'Shartlar va maxfiylik',

    removeProjects: 'Loyihalarimni olib tashlash',
    removeProjectsNote: "Ikkala joyni bo'shatadi — loyihalarni qaytadan qo'shsa bo'ladi",
    removeTitle: 'Loyihalaringiz olib tashlansinmi?',
    removeBody:
      "Yozuvlaringiz ikkala topdan ketadi va joylar bo'shaydi, ya'ni loyihalarni qaytadan qo'shsa bo'ladi. To'langan stavka qaytarilmaydi.",
    removeConfirm: 'Olib tashlash',
    removeCancel: 'Qoldirish',
    removeFailed: "Loyihalarni olib tashlab bo'lmadi — yana urinib ko'ring",
    removeDone: (count: number) =>
      count === 1 ? 'Bitta loyiha olib tashlandi' : `${count} ta loyiha olib tashlandi`,
    removeNothing: "Olib tashlashga narsa yo'q — hali loyihalaringiz yo'q",
  },

  pay: {
    titleAttack: "Hujum uchun to'lov",
    titleProject: "Ochilish stavkasi uchun to'lov",
    titleRaise: "Ko'tarish uchun to'lov",
    youPay: "TO'LANADI",
    methodLabel: "TO'LOV USULI",
    chargeNote: (provider: string, unit: string) => `${provider} ${unit} da yechadi.`,
    chargeNoteMock: "Sinov to'lovi shu yerda darhol tasdiqlanadi — alohida sahifasiz va yechimsiz.",
    attackWarning: (rival: string) =>
      `Yechim «${rival}» ga emas, platformaga boradi. Provayder tasdiqlagach, ortga qaytarib bo'lmaydi.`,
    submit: (amount: string, provider: string) => `${provider} orqali ${amount} to'lash`,
    footnote: (provider: string) =>
      `To'lov ${provider} ning himoyalangan sahifasida ochiladi va ${provider} uni tasdiqlaganda amalga oshadi. BidWar siz uchun hisob yuritmaydi — to'ldiradigan hamyon ham, bizda turgan pulingiz ham yo'q.`,
    footnoteMock:
      "Sinov to'lovining o'z himoyalangan sahifasi yo'q — u shu ekranda darhol tasdiqlanadi va haqiqiy pulni qimirlatmaydi. BidWar baribir siz uchun hisob yuritmaydi.",
  },
};
