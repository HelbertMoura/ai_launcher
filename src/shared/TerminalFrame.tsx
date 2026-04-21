import type { ReactNode } from 'react';
import './shared.css';

interface TerminalFrameProps {
  title?: string;
  badge?: ReactNode;
  children: ReactNode;
  raised?: boolean;
}

export function TerminalFrame({ title, badge, children, raised = false }: TerminalFrameProps) {
  return (
    <div className={`term-frame ${raised ? 'term-frame--raised' : ''}`}>
      {(title || badge) && (
        <div className="term-frame__header">
          {title && <span className="term-frame__title">{title}</span>}
          {badge && <span className="term-frame__badge">{badge}</span>}
        </div>
      )}
      <div className="term-frame__body">{children}</div>
    </div>
  );
}
