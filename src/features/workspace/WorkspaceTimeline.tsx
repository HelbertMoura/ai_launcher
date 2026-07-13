import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TabId } from '../../app/layout/TabId';
import { Button } from '../../ui/Button';
import { getWorkspaceTimeline, type WorkspaceTimelineKind } from './workspaceActivityModel';

interface WorkspaceTimelineProps {
  workspaceId: string;
  directory: string;
  onNavigate?: (tab: TabId) => void;
  onOpenRunbook?: (runbookId: string) => void;
}

type Filter = 'all' | WorkspaceTimelineKind;
const FILTERS: Filter[] = ['all', 'session', 'runbook', 'mcp', 'security'];

export function WorkspaceTimeline({ workspaceId, directory, onNavigate, onOpenRunbook }: WorkspaceTimelineProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  const events = useMemo(() => getWorkspaceTimeline({ workspaceId, directory }), [directory, workspaceId]);
  const visible = filter === 'all' ? events : events.filter((event) => event.kind === filter);

  return (
    <section className="cd-ws-timeline">
      <header className="cd-ws-timeline__head">
        <div>
          <span className="cd-ws-timeline__eyebrow">{t('runbook.timeline.eyebrow')}</span>
          <h3>{t('runbook.timeline.title')}</h3>
          <p>{t('runbook.timeline.hint')}</p>
        </div>
        <div className="cd-ws-timeline__filters" role="group" aria-label={t('runbook.timeline.filters')}>
          {FILTERS.map((item) => (
            <button key={item} type="button" className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)}>
              {t(`runbook.timeline.filter.${item}`)}
            </button>
          ))}
        </div>
      </header>
      {visible.length === 0 ? <p className="cd-ws-timeline__empty">{t('runbook.timeline.empty')}</p> : (
        <ol className="cd-ws-timeline__list">
          {visible.slice(0, 30).map((event) => (
            <li key={event.id} className={`cd-ws-timeline__event cd-ws-timeline__event--${event.status}`}>
              <span className="cd-ws-timeline__rail" aria-hidden />
              <div className="cd-ws-timeline__content">
                <div><span className="cd-ws-timeline__kind">{t(`runbook.timeline.filter.${event.kind}`)}</span><time>{new Date(event.at).toLocaleString()}</time></div>
                <strong>{event.title}</strong>
                {event.detail && <small>{event.detail}</small>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => event.kind === 'runbook' && event.sourceId ? onOpenRunbook?.(event.sourceId) : onNavigate?.(event.sourceTab)}>
                {t('runbook.timeline.open')}
              </Button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
