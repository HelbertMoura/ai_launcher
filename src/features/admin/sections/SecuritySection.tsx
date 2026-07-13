import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { ConfirmDialog } from '../../../ui/ConfirmDialog';
import {
  disableTemporaryAdmin,
  enableTemporaryAdmin,
  EXECUTION_MODE_CHANGED_EVENT,
  getExecutionMode,
  setExecutionMode,
  type ExecutionMode,
  type PersistentExecutionMode,
} from '../../../domain/executionMode';
import { appendAuditEvent, clearAuditLog, readAuditLog, type AuditEvent } from '../../../lib/auditLog';
import { getActiveWorkspaceId } from '../../workspace/workspaceStore';
import './SecuritySection.css';

export function SecuritySection() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<ExecutionMode>(getExecutionMode);
  const [events, setEvents] = useState<AuditEvent[]>(readAuditLog);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const refresh = () => setMode(getExecutionMode());
    window.addEventListener(EXECUTION_MODE_CHANGED_EVENT, refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener(EXECUTION_MODE_CHANGED_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, []);

  const choosePersistent = (next: PersistentExecutionMode) => {
    setExecutionMode(next);
    appendAuditEvent({ action: 'security.mode.change', outcome: 'confirmed', mode: next, workspaceId: getActiveWorkspaceId() ?? undefined, detail: next });
    setMode(next);
    setEvents(readAuditLog());
  };

  const toggleAdmin = () => {
    if (mode === 'admin') {
      disableTemporaryAdmin();
      const next = getExecutionMode();
      appendAuditEvent({ action: 'security.admin.disable', outcome: 'confirmed', mode: next, workspaceId: getActiveWorkspaceId() ?? undefined });
      setMode(next);
    } else {
      enableTemporaryAdmin();
      appendAuditEvent({ action: 'security.admin.enable', outcome: 'confirmed', mode: 'admin', workspaceId: getActiveWorkspaceId() ?? undefined, detail: '15 minutes' });
      setMode('admin');
    }
    setEvents(readAuditLog());
  };

  return (
    <div className="cd-security">
      <div className="cd-admin-section__head">
        <div>
          <span className="cd-admin-section__eyebrow">{t('admin.security.eyebrow')}</span>
          <h2 className="cd-admin-section__title">{t('admin.security.title')}</h2>
          <p className="cd-admin-section__sub">{t('admin.security.subtitle')}</p>
        </div>
        <span className={`cd-security__current cd-security__current--${mode}`}>{t(`admin.security.modes.${mode}.name`)}</span>
      </div>

      <section className="cd-security__posture" aria-label={t('admin.security.postureLabel')}>
        <div>
          <span>{t('admin.security.postureEyebrow')}</span>
          <strong>{t(`admin.security.modes.${mode}.name`)}</strong>
          <small>{t(`admin.security.modes.${mode}.description`)}</small>
        </div>
        <div className="cd-security__guardrails">
          <div><strong>{t('admin.security.localOnly')}</strong><span>{t('admin.security.localOnlyHint')}</span></div>
          <div><strong>{t('admin.security.redacted')}</strong><span>{t('admin.security.redactedHint')}</span></div>
          <div><strong>{mode === 'admin' ? '15 min' : '—'}</strong><span>{t('admin.security.elevationWindow')}</span></div>
        </div>
      </section>

      <div className="cd-security__modes">
        {(['safe', 'standard'] as const).map((id) => (
          <Card key={id} className={`cd-security__mode${mode === id ? ' is-active' : ''}`}>
            <div>
              <span className={`cd-security__risk cd-security__risk--${id}`}>{t(`admin.security.modes.${id}.risk`)}</span>
              <strong>{t(`admin.security.modes.${id}.name`)}</strong>
              <p>{t(`admin.security.modes.${id}.description`)}</p>
            </div>
            <Button size="sm" variant={mode === id ? 'primary' : 'ghost'} onClick={() => choosePersistent(id)}>
              {mode === id ? t('admin.security.active') : t('admin.security.useMode')}
            </Button>
          </Card>
        ))}
        <Card className={`cd-security__mode cd-security__mode--admin${mode === 'admin' ? ' is-active' : ''}`}>
          <div>
            <span className="cd-security__risk cd-security__risk--admin">{t('admin.security.modes.admin.risk')}</span>
            <strong>{t('admin.security.modes.admin.name')}</strong>
            <p>{t('admin.security.modes.admin.description')}</p>
          </div>
          <Button size="sm" variant={mode === 'admin' ? 'danger' : 'ghost'} onClick={toggleAdmin}>
            {mode === 'admin' ? t('admin.security.disableAdmin') : t('admin.security.enableAdmin')}
          </Button>
        </Card>
      </div>

      <section className="cd-security__audit">
        <div className="cd-security__audit-head">
          <div><h3>{t('admin.security.auditTitle')}</h3><p>{t('admin.security.auditSubtitle')}</p></div>
          {events.length > 0 && <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>{t('admin.security.clearAudit')}</Button>}
        </div>
        {events.length === 0 ? <p className="cd-security__empty">{t('admin.security.auditEmpty')}</p> : (
          <ul className="cd-security__events">
            {events.slice(0, 20).map((event) => (
              <li key={event.id}>
                <span className={`cd-security__outcome cd-security__outcome--${event.outcome}`} aria-hidden />
                <div><strong>{event.action}</strong><small>{event.detail ?? event.outcome}</small></div>
                <time dateTime={event.at}>{new Date(event.at).toLocaleString(i18n.language)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={confirmClear}
        variant="danger"
        title={t('admin.security.clearAuditTitle')}
        message={t('admin.security.clearAuditMessage')}
        confirmLabel={t('admin.security.clearAuditConfirm')}
        onConfirm={() => { clearAuditLog(); setEvents([]); setConfirmClear(false); }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
