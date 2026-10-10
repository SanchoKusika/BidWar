import { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { KeyRow } from '@/shared/ui/KeyRow';
import { StatBlock } from '@/shared/ui/StatBlock';
import { ActivityFeed } from '@/shared/ui/ActivityFeed';
import { LiveCount } from '@/shared/ui/LiveCount';
import { useOnlineCount } from '@/shared/lib/online';
import { getRules, type Fact } from '@/shared/content';
import { strings } from '@/shared/i18n/strings';
import {
  ShowcaseBalance,
  ShowcaseCategories,
  ShowcaseFeed,
  ShowcaseOwn,
  type ShowcaseScreenProps,
} from '@/widgets/mobile/ShowcaseScreen';
import { ScopeToggle } from '@/widgets/mobile/ScopeToggle';
import {
  metricOf,
  useGuestActions,
  useShowcaseView,
  type ShowcaseView,
} from '@/widgets/mobile/showcaseView';
import { PageBand, PageGrid, RailCard } from './Chrome';
import styles from './Showcase.module.css';

/**
 * The rail's «how this top works»: the kit's four rows, taken from the rules
 * text so the numbers are the ones the Rules page states — the paid top's
 * minimum attack lives in the attacks section, not in bidding.
 */
function railFacts(paid: boolean): Fact[] {
  const rules = getRules();
  const section = (id: string) => rules.find((r) => r.id === id)?.facts ?? [];
  const bidding = section('bidding');
  const votes = section('votes');
  const picks: Array<Fact | undefined> = paid
    ? [bidding[0], bidding[1], section('attacks')[3], bidding[3]]
    : [votes[0], votes[1], votes[4], bidding[3]];
  return picks.filter((fact): fact is Fact => fact !== undefined);
}

/**
 * Category tiles as a carousel: five in view, arrows to scroll by a view.
 * The kit laid them in a grid; with seven tiles that wrapped into a second,
 * half-empty row.
 */
function CategoryCarousel({ props, view }: { props: ShowcaseScreenProps; view: ShowcaseView }) {
  const frame = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const track = frame.current?.firstElementChild;
    if (!(track instanceof HTMLElement)) return;
    const measure = () =>
      setEdges({
        start: track.scrollLeft <= 1,
        end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 1,
      });
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    track.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      track.removeEventListener('scroll', measure);
    };
  }, [props.categories.length, props.items.length]);

  const page = (direction: 1 | -1) => {
    const track = frame.current?.firstElementChild;
    if (track instanceof HTMLElement) {
      track.scrollBy({ left: direction * track.clientWidth, behavior: 'smooth' });
    }
  };

  return (
    <div className={styles.carousel} ref={frame}>
      <ShowcaseCategories
        props={props}
        view={view}
        className={styles.track}
        tileClassName={styles.tile}
      />
      {!edges.start && (
        <button
          type="button"
          className={styles.arrow}
          data-side="start"
          onClick={() => page(-1)}
          aria-label={strings.web.scrollBack}
        >
          <Icon name="chevron-left" size={18} />
        </button>
      )}
      {!edges.end && (
        <button
          type="button"
          className={styles.arrow}
          data-side="end"
          onClick={() => page(1)}
          aria-label={strings.web.scrollForward}
        >
          <Icon name="chevron-right" size={18} />
        </button>
      )}
    </div>
  );
}

/**
 * The line over the feed, as in the kit: which list, how many, how much is in
 * play, which clock — one line, with «all categories» to drop a filter and
 * the all-time / today switch on the right.
 */
function RankingHead({ props, view }: { props: ShowcaseScreenProps; view: ShowcaseView }) {
  const { segment, today, categoryId, onCategoryChange } = props;
  const w = strings.web;
  const count = view.todayScope ? view.rows.length : view.scopedTotals.count;

  return (
    <>
      <div className={styles.rankingHead}>
        <span className={styles.rankingLine}>
          <span className={styles.rankingTitle}>{view.scopeLabel}</span>
          <span>{w.projectsCount(count)}</span>
          <span className={styles.dot}>·</span>
          <span>
            {strings.showcase.inPlay(
              view.format(view.todayPool ?? view.scopedTotals.pool),
              view.unit,
            )}
          </span>
          <span className={styles.dot}>·</span>
          <span>{view.todayScope ? w.lastDay : w.allTimeLower}</span>
        </span>
        <span className={styles.rankingTools}>
          {categoryId !== null && (
            <button type="button" className={styles.clear} onClick={() => onCategoryChange(null)}>
              <Icon name="x" size={12} />
              {w.allCategories}
            </button>
          )}
          {today && (
            <ScopeToggle
              value={today.scope}
              onChange={today.onScopeChange}
              segment={segment}
              size="md"
            />
          )}
        </span>
      </div>
      {view.todayScope && (
        <span className={styles.todayNote}>{strings.showcase.todayNote(segment)}</span>
      )}
    </>
  );
}

/**
 * Paid and Free Top on the desktop site (ui_kits/web/Pages.jsx,
 * LeaderboardPage), on the mini app's props and blocks: the band carries the
 * board's numbers, the feed has the category carousel, the ranking line and
 * the cards, the rail holds your position, the latest moves and how this top
 * works.
 *
 * Left out of the kit because the product has no such thing: numbered paging
 * (the feed loads by cursor — «load more»), the online counter, a daily vote
 * cap.
 */
export function DesktopShowcase(screenProps: ShowcaseScreenProps) {
  const props = useGuestActions(screenProps);
  const view = useShowcaseView(props);
  const online = useOnlineCount();
  const { segment, items, minStep, hasMore, activity, onOpenRules } = props;
  const part = { props, view };
  const paid = segment === 'paid';
  const s = strings.showcase;
  const w = strings.web;

  const top = items[0];
  const last = items.at(-1);
  // As in the feed: the entry price is honest only with the list loaded to the end.
  const entry = paid && !hasMore && last ? metricOf(last) + minStep : null;

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
                <StatBlock segment="paid" value={entry} label={w.entryFrom} size="lg" compact />
              )
            ) : (
              <ShowcaseBalance {...part} size="lg" />
            )}
          </>
        }
      />

      <PageGrid
        rail={
          <>
            {/* For a guest — the sign-in, in the same slot. */}
            <ShowcaseOwn {...part} panelClassName={styles.ownPanel} />
            {activity && activity.length > 0 && (
              <ActivityFeed
                max={5}
                title={s.justHappened}
                items={[...activity]}
                // Who has BidWar open right now, as in the kit's rail.
                right={
                  online !== null ? (
                    <LiveCount value={online} label={w.online} size="sm" />
                  ) : undefined
                }
              />
            )}
            <RailCard title={paid ? w.howPaidWorks : w.howFreeWorks}>
              <div>
                {railFacts(paid).map(([label, value]) => (
                  <KeyRow key={label} label={label} value={value} />
                ))}
              </div>
              <Button variant="secondary" size="md" block icon="gavel" onClick={onOpenRules}>
                {w.readRules}
              </Button>
            </RailCard>
          </>
        }
      >
        <CategoryCarousel {...part} />
        <RankingHead {...part} />
        {/* Cards on the site carry the kit's larger inner padding. */}
        <ShowcaseFeed {...part} className={styles.feed} />
      </PageGrid>
    </>
  );
}
