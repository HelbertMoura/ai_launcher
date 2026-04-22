import "./StatusBar.css";

interface StatusBarProps {
  online: number;
  total: number;
  todaySpend: string;
  version: string;
}

export function StatusBar({ online, total, todaySpend, version }: StatusBarProps) {
  return (
    <footer className="cd-status">
      <span className="cd-status__cell">▎ {online}/{total} online</span>
      <span className="cd-status__cell cd-status__cell--accent">● ADMIN</span>
      <span className="cd-status__cell">{todaySpend} today</span>
      <span className="cd-status__cell cd-status__cell--muted">v{version}</span>
    </footer>
  );
}
