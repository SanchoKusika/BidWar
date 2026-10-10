import { Button } from './Button';
import { Icon } from './Icon';
import { strings } from '@/shared/i18n/strings';
import styles from './SignInCard.module.css';

/**
 * The invitation a guest sees where an action needs an account: the same
 * Telegram account as in the mini app, so projects, votes and payments are
 * already there. The site itself is open without it.
 */
export function SignInCard({
  onSignIn,
  note = strings.web.signInNote,
  compact = false,
}: {
  onSignIn: () => void;
  note?: string;
  compact?: boolean;
}) {
  return (
    <section className={styles.card} data-compact={compact}>
      <span className={styles.icon}>
        <Icon name="send" size={compact ? 18 : 22} />
      </span>
      <span className={styles.title}>{strings.web.signInTitle}</span>
      <span className={styles.note}>{note}</span>
      <Button
        variant="primary"
        size={compact ? 'md' : 'lg'}
        block={compact}
        icon="send"
        onClick={onSignIn}
      >
        {strings.web.signIn}
      </Button>
    </section>
  );
}
