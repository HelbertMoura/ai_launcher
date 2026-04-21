import styles from './KeyCap.module.css';

interface KeyCapProps {
  keys: string[];
  dimmed?: boolean;
}

export function KeyCap({ keys, dimmed = false }: KeyCapProps) {
  return (
    <kbd className={`${styles.keycap} ${dimmed ? styles.dimmed : ''}`}>
      {keys.map((k, i) => (
        <span key={i} className={styles.key}>{k}</span>
      ))}
    </kbd>
  );
}
