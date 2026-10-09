import { useSession } from '@/entities/user';
import { Button } from '@/shared/ui/Button';
import { strings } from '@/shared/i18n/strings';
import styles from './AccountButton.module.css';

export interface AccountButtonProps {
  active: boolean;
  onOpen: () => void;
  onSignIn: () => void;
}

/**
 * The right edge of the top bar: the signed-in account and a way into the
 * profile, or the sign-in for a guest (and after a sign-in that failed).
 */
export function AccountButton({ active, onOpen, onSignIn }: AccountButtonProps) {
  const { status, displayName, avatarUrl } = useSession();

  if (status === 'loading') return <span className={styles.avatar} aria-busy="true" />;
  if (status !== 'ready') {
    return (
      <Button variant="primary" size="sm" icon="send" onClick={onSignIn}>
        {strings.web.signIn}
      </Button>
    );
  }

  const initials = (displayName ?? '?')
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      type="button"
      className={styles.avatar}
      data-active={active}
      onClick={onOpen}
      title={strings.web.profile}
      aria-label={strings.web.profile}
    >
      {avatarUrl ? <img src={avatarUrl} alt="" className={styles.image} /> : initials}
    </button>
  );
}
