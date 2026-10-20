import type { DocPage } from './types';
import { brand } from './brand';

export const docsEn = {
  about: {
    icon: 'info',
    title: 'About BidWar',
    lead: 'A ranking you can buy your way up, run in the open. What the platform earns is published on this page.',
    facts: [
      ['Revenue source', 'Every payment'],
      ['Cut taken from your bid', 'None'],
      ['Bids by the operator', 'Never'],
    ],
    sections: [
      {
        h: 'What this is',
        p: 'Two rankings of projects — channels, bots, sites, businesses. One is ordered by money, the other by votes earned from tasks. A high position sends real traffic: the click counter on every row is the only promise we make.',
      },
      {
        h: 'Where your money goes',
        p: 'Every payment is our revenue — raises and attacks alike. What we never do is skim your bid: pay 1 000 ₽ and 1 000 ₽ lands on it, with no percentage taken off the top. The single exception is repeat attacks on the same rival, where part of the amount does not convert into your bid — deliberately, so that two people cannot trade attacks in a circle for free.',
      },
      {
        h: 'Why the numbers are public',
        p: 'A paid ranking only works if nobody suspects the operator of bidding in its own list. So we publish what we earn and how much traffic the board sent. If the ledger and the board ever disagree, tell support and we will explain it in public.',
      },
      {
        h: 'What we will never do',
        p: 'Sell votes, convert votes into money or money into votes, place bids on our own behalf, or reorder the list by hand. Rank is arithmetic, not editorial.',
      },
    ],
  },
  // The figures mirror app_config.paid_limits; the server enforces them, this
  // page only tells people. Change both together.
  tariffs: {
    icon: 'banknote',
    title: 'Tariffs',
    lead: 'What you pay and for what. All amounts are in roubles, 1 point = 1 ₽. The payment system fee is paid by the platform and is never added on top.',
    facts: [
      ['Currency', 'RUB'],
      ['Raise or opening bid', '300 – 10 000 ₽'],
      ['Attack', '50 – 10 000 ₽'],
    ],
    sections: [
      {
        h: 'Opening bid',
        p: 'To take a place in the Paid Top you pay an opening bid of 300 to 10 000 ₽. The whole amount becomes the project’s bid.',
      },
      {
        h: 'Raise',
        p: 'You can raise your own bid or put money into someone else’s with a payment of 300 to 10 000 ₽. A bid can grow past 10 000 ₽ through several payments. The whole amount goes into the bid.',
      },
      {
        h: 'Attack',
        p: 'An attack of 50 to 10 000 ₽ per payment lowers a rival’s bid and adds part of the amount to yours. The exact effect is shown before you pay; the details are in the rules.',
      },
      {
        h: 'How to pay',
        p: 'SBP (a QR code or a link from your bank app) and cryptocurrency. One payment is limited to 10 000 ₽.',
      },
      {
        h: 'What is not sold',
        p: 'Votes are earned by completing tasks in the Free Top and are never sold. Refunds are not provided.',
      },
    ],
  },
  support: {
    icon: 'life-buoy',
    title: 'Support',
    lead: 'One team, two languages, one queue. Payment problems jump the queue.',
    facts: [
      ['Email', brand.supportEmail],
      ['Response time', 'under 24 h'],
      ['Hours', '09:00 – 21:00 (MSK)'],
      ['Languages', 'RU · EN'],
    ],
    sections: [
      {
        h: 'Fastest route',
        p: `Write to ${brand.supportEmail}, or to the Telegram bot from the account that owns the project — there we already see your projects, bids and last payments.`,
      },
      {
        h: 'Payment problems',
        p: 'Send the payment id from Profile → Payment receipts. A Platega id is enough to trace a charge without any payment details.',
      },
      {
        h: 'Disputes between projects',
        p: 'Attacks are a mechanic, not a violation, and are never reversed. Impersonation, stolen previews and fake verification are — send the link and a screenshot.',
      },
    ],
  },
  terms: {
    icon: 'file-text',
    title: 'Terms of use',
    lead: 'Plain summary first, the legal text is sent by the bot on request.',
    facts: [
      ['Entries per account', '2'],
      ['Money account', 'None'],
      ['Votes ↔ money', 'Never'],
    ],
    sections: [
      {
        h: 'Two economies',
        p: 'The Paid Top runs on money, the Free Top runs on votes. The two never convert into each other in any direction. We hold no money account for you: nothing sits with us and nothing can be cashed out.',
      },
      {
        h: 'Your project',
        p: 'You confirm you own or represent the link you submit, and one account holds two entries at most — one per top. We may reject or remove projects that mislead, break local law, or copy another project’s identity.',
      },
      {
        h: 'Payments',
        p: 'Each raise, attack and opening bid is a separate charge in roubles processed by Platega. We store the payment id and amount, never payment credentials, and never a balance. Money is spent at the moment the provider confirms it. Refunds are not provided.',
      },
      {
        h: 'Prohibited',
        p: 'Automated vote farming, multiple accounts for one project, paid vote trading, and any attempt to buy votes for money.',
      },
      {
        h: 'Termination',
        p: 'You can delete your account at any time from Profile. Live bids are not returned on voluntary deletion.',
      },
    ],
  },
  privacy: {
    icon: 'lock',
    title: 'Privacy',
    lead: 'We keep the smallest set of data that lets a ranking be trusted.',
    facts: [
      ['Data region', 'Germany · Frankfurt'],
      ['Retention', '18 months'],
      ['Payment credentials stored', 'None'],
    ],
    sections: [
      {
        h: 'What we store',
        p: 'Telegram id and username, your project links, your vote balance, bids, attacks, votes, and payment ids from Platega.',
      },
      {
        h: 'What we never store',
        p: 'Card and wallet numbers, CVV, bank statements, your Telegram messages, or contact lists. Referral links carry a code, not your identity.',
      },
      {
        h: 'Who else sees it',
        p: 'Public: project name, link, position, bid or vote total, click count, verification badge. Private: your vote balance, payment receipts and settings.',
      },
      {
        h: 'Your rights',
        p: 'Ask the bot for an export or a deletion. Deletion removes the account and hides the projects; ledger rows stay for accounting in an anonymised form.',
      },
    ],
  },
  bot: {
    icon: 'send',
    title: 'Telegram bot',
    lead: 'The bot is the notification channel and the fastest way in. The mini app and the site show the same account.',
    facts: [
      ['Handle', '@bidwar_bot'],
      ['Alerts', 'Attacks · positions · tasks'],
      ['Login', 'Telegram'],
    ],
    sections: [
      {
        h: 'What it sends',
        p: 'You were attacked, you lost a position, a task was verified, a payment succeeded or failed. Each alert type is switchable in Profile → Notifications.',
      },
      {
        h: 'Commands',
        p: '/top — your positions · /votes — your vote balance · /raise — raise a bid · /tasks — today’s tasks · /support — open a ticket.',
      },
      {
        h: 'Mini app or site',
        p: 'Identical accounts and identical rules. The mini app opens inside Telegram; the site adds wider leaderboards and full project pages.',
      },
    ],
  },
} satisfies Record<string, DocPage>;

export type DocId = keyof typeof docsEn;

/** Tab and footer order, shared by the mini app and the site. */
export const DOC_ORDER: readonly DocId[] = [
  'about',
  'tariffs',
  'support',
  'terms',
  'privacy',
  'bot',
];
