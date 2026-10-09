import { Button } from '@/shared/ui/Button';
import { KeyRow } from '@/shared/ui/KeyRow';
import { StatBlock } from '@/shared/ui/StatBlock';
import { ActivityFeed } from '@/shared/ui/ActivityFeed';
import { getRules } from '@/shared/content';
import { strings } from '@/shared/i18n/strings';
import { useSignIn } from '@/shared/lib/signIn';
import {
  ShowcaseBalance,
  ShowcaseCategories,
  ShowcaseFeed,
  ShowcaseOwn,
  ShowcaseRankingHead,
  type ShowcaseScreenProps,
} from '@/widgets/mobile/ShowcaseScreen';
import { metricOf, useShowcaseView } from '@/widgets/mobile/showcaseView';
import { PageBand, PageGrid, RailCard } from './Chrome';
import { SignInCard } from './SignIn';
import styles from './Showcase.module.css';

/** Facts from the rules shown in the rail — the same text the Rules page has. */
const RAIL_FACTS = 4;

/**
 * Paid and Free Top on the desktop site (ui_kits/web/Pages.jsx,
 * LeaderboardPage). Same props and the same blocks as the mini app's
 * screen: the band carries the board's numbers, the feed keeps tiles,
 * ranking and cards, the rail holds your position, the latest moves and
 * how this top works.
 *
 * What the kit had and the product does not, left out rather than faked:
 * paging by number (the feed loads by cursor — «load more»), the online
 * counter, a daily vote cap.
 */
export function DesktopShowcase(screenProps: ShowcaseScreenProps) {
  const signIn = useSignIn();
  // A guest sees the same buttons a signed-in stranger would — raise a row,
  // give votes, take a spot, add a project — and each one asks to sign in
  // instead of opening a payment that has no account behind it.
  const guest = screenProps.sessionStatus === 'guest' && signIn !== null;
  const props: ShowcaseScreenProps =
    guest && signIn
      ? {
          ...screenProps,
          onBoost: screenProps.segment === 'paid' ? () => signIn() : undefined,
          onVote: screenProps.segment === 'free' ? () => signIn() : undefined,
          onTakeSpot: () => signIn(),
          onAddProject: () => signIn(),
        }
      : screenProps;
  const view = useShowcaseView(props);
  const { segment, items, minStep, hasMore, activity, onOpenRules } = props;
  const part = { props, view };
  const paid = segment === 'paid';
  const s = strings.showcase;
  const w = strings.web;

  const top = items[0];
  const last = items.at(-1);
  // As in the feed: the entry price is honest only with the list loaded to the end.
  const entry = paid && !hasMore && last ? metricOf(last) + minStep : null;
  const rule = getRules().find((r) => r.id === (paid ? 'bidding' : 'votes'));

  return (
    <>
      <PageBand
        segment={segment}
        title={paid ? s.paidTitle : s.freeTitle}
        meta={view.meta}
        stat={
          <>
            {top && (
              <StatBlock
                segment={segment}
                value={metricOf(top)}
                label={paid ? w.topBid : w.topProject}
                size="md"
                compact
              />
            )}
            <StatBlock
              segment={segment}
              value={view.globalTotals.pool}
              label={paid ? w.moneyInPlay : w.votesInPlay}
              size="md"
              compact
            />
            {paid ? (
              entry !== null && (
                <StatBlock segment="paid" value={entry} label={w.entryFrom} size="lg" />
              )
            ) : (
              <ShowcaseBalance {...part} />
            )}
          </>
        }
      />

      <PageGrid
        rail={
          <>
            {guest && signIn ? (
              <SignInCard onSignIn={signIn} note={w.signInRail} compact />
            ) : (
              <ShowcaseOwn {...part} />
            )}
            {activity && activity.length > 0 && (
              <ActivityFeed max={5} title={s.justHappened} items={[...activity]} />
            )}
            {rule && (
              <RailCard title={paid ? w.howPaidWorks : w.howFreeWorks}>
                <div>
                  {rule.facts.slice(0, RAIL_FACTS).map(([label, value]) => (
                    <KeyRow key={label} label={label} value={value} />
                  ))}
                </div>
                <Button variant="secondary" size="md" block icon="gavel" onClick={onOpenRules}>
                  {w.readRules}
                </Button>
              </RailCard>
            )}
          </>
        }
      >
        <ShowcaseCategories {...part} className={styles.tiles} />
        <div className={styles.feedBlock}>
          <ShowcaseRankingHead {...part} />
          <ShowcaseFeed {...part} />
        </div>
      </PageGrid>
    </>
  );
}
