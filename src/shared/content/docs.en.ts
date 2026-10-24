import type { DocPage } from './types';
import { brand, reviewFact } from './brand';

export const docsEn = {
  about: {
    icon: 'info',
    title: 'About BidWar',
    lead: 'A ranking you can buy your way up, run in the open. What the platform earns is published on this page.',
    facts: [
      ['Revenue source', 'Every payment'],
      ['Cut taken from your bid', 'None'],
      ['Bids by the operator', 'Never'],
      ...reviewFact('Review code'),
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
    lead: 'The user agreement of BidWar. The full text is below and is always available, no request needed.',
    facts: [
      ['Entries per account', '2'],
      ['Money balance', 'None'],
      ['Votes ↔ money', 'Never'],
      ['Refunds', 'Not provided'],
    ],
    sections: [
      {
        h: '1. General provisions',
        p: `1.1. This Agreement governs the use of BidWar: the Telegram Mini App ${brand.bot}, the site bidwar.world and the related pages (the Service), provided by the Administration. 1.2. Using the Service, including launching the bot, signing in with Telegram, paying and voting, means the user has read the Agreement and accepts it in full. 1.3. A user who does not agree must stop using the Service.`,
      },
      {
        h: '2. What the Service does',
        p: 'The Service runs two rankings of projects — channels, bots, sites, businesses. The Paid ranking is ordered by the amount of the bids: a place and a higher position in it is a digital promotion service. The Free ranking is ordered by votes earned by completing tasks. The Service does not guarantee any number of clicks, audience or financial result from a place in a ranking.',
      },
      {
        h: '3. Account and projects',
        p: '3.1. Sign-in is through Telegram. 3.2. One account holds two entries at most — one per ranking. 3.3. The user confirms they own the link they add or represent its owner. 3.4. The Administration may reject or remove a project that misleads, breaks the law or impersonates another brand.',
      },
      {
        h: '4. Payments',
        p: '4.1. An opening bid, a raise and an attack are each paid separately. Prices and limits are on the Tariffs page and are shown before payment. 4.2. Payment is accepted in roubles through the payment provider Platega; the payment methods are listed on the Tariffs page. 1 point equals 1 ₽. The provider fee is paid by the Service and is not added to the payment. 4.3. There is no money balance: a paid amount becomes the bid at once and counts as spent at the moment the provider confirms the payment. 4.4. The Service stores the payment id and the amount, not payment credentials.',
      },
      {
        h: '5. Refunds',
        p: '5.1. Refunds are not provided: a paid amount is not returned, in full or in part, including after leaving a ranking, being outbid, changing the link or deleting the project. 5.2. An attack cannot be withdrawn: the rival’s bid changes the moment the payment is confirmed. 5.3. The user undertakes not to dispute a payment through payment systems without first contacting support. A disputed payment may freeze the account until the provider decides.',
      },
      {
        h: '6. Votes',
        p: 'Votes are earned by tasks and spent on projects of the Free ranking. They are not money, are not sold, are not exchanged for money and cannot be withdrawn, and money does not turn into votes either.',
      },
      {
        h: '7. Prohibited',
        p: 'Automated vote farming, multiple accounts for one project, vote trading, any attempt to buy votes for money, using the Service for unlawful activity, interfering with its operation, copying and reselling its materials.',
      },
      {
        h: '8. Disclaimer and liability',
        p: '8.1. The Service is provided “as is”. Uninterrupted operation, absence of errors and fit to the user’s expectations are not guaranteed. 8.2. The Administration is not liable for indirect losses and lost profit, for the actions of third parties or for temporary technical failures. 8.3. The user takes placement and bidding decisions at their own risk and answers for the lawfulness of their project.',
      },
      {
        h: '9. Restricting access',
        p: 'The Administration may suspend or restrict access on a breach of the Agreement, on abuse, or when the law or the payment provider requires it. This does not release the user from obligations that arose earlier. Bids already placed are not returned.',
      },
      {
        h: '10. Changes to the terms',
        p: 'The Administration may amend the Agreement. The current version is published in the Service; continuing to use it means accepting the new version.',
      },
      {
        h: '11. Contacts',
        p: `Questions about the Agreement and payments: ${brand.supportEmail}, or the Telegram bot ${brand.bot}.`,
      },
    ],
  },
  privacy: {
    icon: 'lock',
    title: 'Privacy',
    lead: 'The privacy policy of BidWar. We keep the smallest set of data that lets a ranking be trusted.',
    facts: [
      ['Data region', 'Germany · Frankfurt'],
      ['Retention', '18 months'],
      ['Payment credentials stored', 'None'],
    ],
    sections: [
      {
        h: '1. General provisions',
        p: '1.1. This Policy describes what data BidWar receives and how it is used. 1.2. Using the Service means accepting the Policy. A user who does not agree must stop using the Service.',
      },
      {
        h: '2. What data we receive',
        p: '2.1. Telegram account data: the numeric id, username and name that Telegram passes on sign-in. 2.2. Data about use of the Service: the links of added projects, bids, attacks, votes, tasks, vote balance, settings and interface language. 2.3. Payment data limited to the payment number and amount reported by the provider Platega. 2.4. Technical data: IP address, device and browser in server logs. 2.5. We do not ask for passport data, documents or photos. We do not store card or wallet numbers, CVV, bank statements, your Telegram messages or contact lists.',
      },
      {
        h: '3. How we use data',
        p: 'To run the Service and the rankings, to accept and record payments, to contact the user (notifications, support), to protect against vote farming and abuse, and to improve the Service.',
      },
      {
        h: '4. What others can see',
        p: 'Public: project name, link, position, bid or vote count, click counter, verification mark. Private: your vote balance, receipts and settings. A referral link carries a code, not your identity.',
      },
      {
        h: '5. Disclosure to third parties',
        p: '5.1. We do not sell data. 5.2. Data goes only to: Telegram (sign-in and notifications), the payment provider Platega (payments), the hosting and infrastructure providers the Service runs on, and public authorities when the law requires it. 5.3. We do not receive data from payment systems and banks beyond the payment number and amount.',
      },
      {
        h: '6. Storage and protection',
        p: '6.1. Data is kept in a data centre in Germany (Frankfurt) for no longer than 18 months after the last activity, unless a longer period is needed for payment records. 6.2. We take reasonable protection measures, but absolute security of data over the internet cannot be guaranteed.',
      },
      {
        h: '7. User rights',
        p: `The user may ask for an export or deletion of their data from the bot ${brand.bot} or by email to ${brand.supportEmail}. Deletion removes the account and hides the projects; payment records stay in anonymised form.`,
      },
      {
        h: '8. Liability',
        p: 'Sending data over the internet always carries risk. The Administration is not liable for loss or disclosure of data caused by third parties or by the user.',
      },
      {
        h: '9. Changes and contacts',
        p: `The Administration may change the Policy; the current version is published in the Service. Contact for questions about data: ${brand.supportEmail}.`,
      },
    ],
  },
  bot: {
    icon: 'send',
    title: 'Telegram bot',
    lead: 'The bot is the notification channel and the fastest way in. The mini app and the site show the same account.',
    facts: [
      ['Handle', brand.bot],
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
