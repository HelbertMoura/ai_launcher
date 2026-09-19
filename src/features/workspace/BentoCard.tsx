interface BentoCardProps {
  area: string;
  title: string;
  meta?: string;
  onActivate?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Shell of the workspace bento grid cards (interactive when clickable). */
export function BentoCard({ area, title, meta, onActivate, children, footer }: BentoCardProps) {
  const interactive = Boolean(onActivate);
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onActivate) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  };
  return (
    <div
      className={`cd-ws-bento__card cd-ws-bento__card--${area}${interactive ? " cd-ws-bento__card--interactive" : ""}`}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onActivate : undefined}
      onKeyDown={interactive ? handleKey : undefined}
    >
      <div className="cd-ws-bento__head">
        <span className="cd-ws-bento__title">{title}</span>
        {meta && <span className="cd-ws-bento__meta">{meta}</span>}
      </div>
      <div className="cd-ws-bento__body">{children}</div>
      {footer && <div className="cd-ws-bento__foot">{footer}</div>}
    </div>
  );
}
