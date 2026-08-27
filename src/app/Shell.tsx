import { useEffect, useState } from 'react';
import { fetchHealth } from '@/shared/api';
import { getPlatform } from '@/shared/platform';
import { bindTheme } from './theme';
import styles from './Shell.module.css';

/**
 * Каркас. Экраны появятся в следующих срезах — пока проверяется, что
 * дизайн-система, слой platform и сборка работают вместе на обеих площадках.
 */
export function Shell() {
  const platform = getPlatform();
  const [scheme, setScheme] = useState(platform.getColorScheme());
  const [backend, setBackend] = useState('проверяем…');

  useEffect(() => {
    platform.ready();
    const unbindTheme = bindTheme(platform);
    const unsubscribe = platform.onColorSchemeChange(setScheme);
    return () => {
      unbindTheme();
      unsubscribe();
    };
  }, [platform]);

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((health) => !cancelled && setBackend(`ok · ${health.version}`))
      .catch(() => !cancelled && setBackend('нет связи'));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={styles.screen}>
      <section className={styles.card}>
        <h1 className={styles.wordmark}>
          Bid<span className={styles.wordmarkAccent}>War</span>
        </h1>
        <Row label="ПЛОЩАДКА" value={platform.name} />
        <Row label="ТЕМА" value={scheme} />
        <Row label="БЭКЕНД" value={backend} />
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}
