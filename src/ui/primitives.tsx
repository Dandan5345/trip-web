import type { ReactNode } from 'react';

import { useI18n } from '../i18n/I18nProvider';
import './ui.css';

export function Skeleton({ width, height = 16 }: { width?: string | number; height?: number }) {
  return (
    <div
      className="te-skeleton"
      aria-hidden="true"
      style={{ width: width ?? '100%', height }}
    />
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="te-empty">
      <div className="te-empty__title">{title}</div>
      {body ? <div style={{ fontSize: 13 }}>{body}</div> : null}
    </div>
  );
}

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning';
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={`te-notice${tone === 'warning' ? ' te-notice--warning' : ''}`} role="note">
      <div>
        {title ? <div className="te-notice__title">{title}</div> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

/** Marks a value this session is not allowed to decrypt. */
export function LockedBadge() {
  const { t } = useI18n();
  return (
    <span className="te-badge te-badge--locked">
      <span aria-hidden="true">🔒</span>
      {t('encryptedField')}
    </span>
  );
}

/** Marks data that lives only in the phone's secure storage. */
export function PhoneOnlyBadge() {
  const { t } = useI18n();
  return (
    <span className="te-badge te-badge--phone">
      <span aria-hidden="true">📱</span>
      {t('phoneOnlyTitle')}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 12, padding: 28 }}>
      <div className="te-spinner" role="status" aria-live="polite" aria-label={label ?? 'Loading'} />
      {label ? <div style={{ fontSize: 13.5, color: 'var(--te-muted)' }}>{label}</div> : null}
    </div>
  );
}
