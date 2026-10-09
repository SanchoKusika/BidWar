import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { KeyRow } from '@/shared/ui/KeyRow';
import { StatBlock } from '@/shared/ui/StatBlock';
import { TaskListItem, TaskListItemSkeleton } from '@/shared/ui/TaskListItem';
import { TASK_ICON, availableCount, splitTasks, taskCopy, type TaskItem } from '@/entities/task';
import { strings } from '@/shared/i18n/strings';
import { useSignIn } from '@/shared/lib/signIn';
import { useSession } from '@/entities/user';
import { SignInCard } from './SignIn';
import type { TasksScreenProps } from '@/widgets/mobile/TasksScreen';
import { FeedSection, PageBand, PageGrid, RailCard } from './Chrome';
import styles from './Tasks.module.css';

function Group({
  label,
  items,
  onTask,
}: {
  label: string;
  items: readonly TaskItem[];
  onTask: (task: TaskItem) => void;
}) {
  return (
    <FeedSection label={label}>
      <div className={styles.grid}>
        {items.map((task) => {
          const copy = taskCopy(task);
          return (
            <TaskListItem
              key={task.id}
              title={copy.title}
              subtitle={copy.note ?? undefined}
              reward={task.rewardVotes}
              icon={TASK_ICON[task.type]}
              state={task.state}
              progress={task.progress}
              onPress={() => onTask(task)}
            />
          );
        })}
      </div>
    </FeedSection>
  );
}

/**
 * Tasks on the desktop site (ui_kits/web/Pages.jsx, TasksPage), on the mini
 * app's props. The kit's «earned today» and «daily cap left» are left out —
 * the product has no daily vote cap and counts no such total; what the rail
 * shows instead is what can be done now and what a friend brings.
 */
export function DesktopTasks({
  tasks,
  voteBalance,
  loading = false,
  error = false,
  onRetry,
  notice,
  onTask,
  onRules,
}: TasksScreenProps) {
  const t = strings.tasks;
  const w = strings.web;
  const signIn = useSignIn();
  const { status } = useSession();
  const guest = status === 'guest' && signIn !== null;
  const { daily, oneTime } = splitTasks(tasks);
  const referral = tasks.find((task) => task.type === 'referral');

  return (
    <>
      <PageBand
        segment="free"
        title={t.title}
        meta={t.meta}
        stat={
          voteBalance !== null ? (
            <StatBlock
              segment="free"
              value={voteBalance}
              label={t.yourVotes}
              size="lg"
              showUnit={false}
            />
          ) : loading ? (
            <StatBlock
              segment="free"
              value={0}
              label={t.yourVotes}
              size="lg"
              showUnit={false}
              loading
            />
          ) : undefined
        }
      />

      <PageGrid
        rail={
          <>
            <RailCard title={w.today} footnote={t.emptyNote}>
              <div>
                <KeyRow
                  label={w.availableNow}
                  value={loading ? '—' : String(availableCount(tasks))}
                  strong
                  tone="free"
                />
              </div>
            </RailCard>
            {referral && (
              <RailCard title={w.referrals} footnote={t.referralNote}>
                <span className={styles.text}>{w.referralPitch(referral.rewardVotes)}</span>
                <Button
                  variant="free"
                  size="md"
                  block
                  icon="user-plus"
                  onClick={() => onTask(referral)}
                >
                  {w.inviteFriends}
                </Button>
              </RailCard>
            )}
            <RailCard title={w.voteRules}>
              <Button variant="secondary" size="md" block icon="gavel" onClick={onRules}>
                {w.readRules}
              </Button>
            </RailCard>
          </>
        }
      >
        {notice && <p className={styles.notice}>{notice}</p>}

        {daily.length > 0 && <Group label={t.daily} items={daily} onTask={onTask} />}
        {oneTime.length > 0 && <Group label={t.oneTime} items={oneTime} onTask={onTask} />}

        {tasks.length === 0 && loading && (
          <>
            <FeedSection label={t.daily}>
              <div className={styles.grid}>
                <TaskListItemSkeleton />
              </div>
            </FeedSection>
            <FeedSection label={t.oneTime}>
              <div className={styles.grid}>
                <TaskListItemSkeleton />
                <TaskListItemSkeleton />
              </div>
            </FeedSection>
          </>
        )}

        {guest && signIn && <SignInCard onSignIn={signIn} note={w.signInTasks} />}

        {!guest &&
          tasks.length === 0 &&
          !loading &&
          (error ? (
            <EmptyState
              icon="triangle-alert"
              segment="free"
              title={t.errorTitle}
              description={t.errorNote}
              actionLabel={onRetry ? t.retry : undefined}
              onAction={onRetry}
              compact
            />
          ) : (
            <EmptyState
              icon="clock"
              segment="free"
              title={t.emptyTitle}
              description={t.emptyNote}
              compact
            />
          ))}
      </PageGrid>
    </>
  );
}
