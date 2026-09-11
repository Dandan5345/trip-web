import { useEffect, useState } from 'react';

import { useI18n } from '../i18n/I18nProvider';
import { useSession } from '../session/SessionProvider';
import { formatPairingCode } from '../session/pairingCode';
import { formatCountdown } from '../trip/format';
import { QrCode } from './QrCode';
import './pairing.css';

/** The first and, until a phone approves, only screen. */
export function PairingScreen() {
  const { t } = useI18n();
  const { status, pending, errorCode, restart } = useSession();

  return (
    <main className="te-pair">
      <div className="te-pair__card">
        <section className="te-pair__intro">
          <div className="te-pair__brand">
            <span className="te-pair__logo" aria-hidden="true">
              ✈
            </span>
            <span className="te-pair__wordmark">{t('appName')}</span>
          </div>

          <h1 className="te-pair__title">{t('pairTitle')}</h1>
          <p className="te-pair__lede">{t('pairIntro')}</p>

          <ol className="te-pair__steps">
            <li>{t('pairStep1')}</li>
            <li>{t('pairStep2')}</li>
            <li>{t('pairStep3')}</li>
            <li>{t('pairStep4')}</li>
          </ol>

          <p className="te-pair__note">{t('pairSecurityNote')}</p>
        </section>

        <section className="te-pair__panel" aria-live="polite">
          {status === 'initialising' ? <PreparingState /> : null}
          {status === 'pending' && pending ? (
            <PendingState
              qrUrl={pending.qrUrl}
              code={pending.code}
              expiresAt={pending.expiresAt}
              onRestart={restart}
            />
          ) : null}
          {status === 'approving' ? <ApprovingState /> : null}
          {status === 'expired' ? (
            <SimpleState
              title={t('pairExpired')}
              body={t('pairSessionExpired')}
              actionLabel={t('pairNewCode')}
              onAction={restart}
            />
          ) : null}
          {status === 'revoked' ? (
            <SimpleState
              title={t('pairRevoked')}
              body={t('pairSessionExpired')}
              actionLabel={t('pairNewCode')}
              onAction={restart}
            />
          ) : null}
          {status === 'locked' ? (
            <SimpleState
              title={t('lockedTitle')}
              body={t('lockedBody')}
              actionLabel={t('reconnect')}
              onAction={restart}
            />
          ) : null}
          {status === 'error' ? (
            <SimpleState
              title={t('pairErrorTitle')}
              body={
                errorCode === 'anon-disabled'
                  ? t('pairAnonDisabled')
                  : errorCode === 'offline'
                    ? t('pairOffline')
                    : t('errorTitle')
              }
              actionLabel={t('pairRetry')}
              onAction={restart}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function PreparingState() {
  const { t } = useI18n();
  return (
    <div className="te-pair__state">
      <div className="te-skeleton" style={{ width: 236, height: 236, borderRadius: 18 }} />
      <div className="te-pair__status">
        <span className="te-pair__dot" aria-hidden="true" />
        {t('pairPreparing')}
      </div>
    </div>
  );
}

function ApprovingState() {
  const { t } = useI18n();
  return (
    <div className="te-pair__state">
      <div className="te-spinner" role="status" aria-label={t('pairApproved')} />
      <div className="te-pair__state-title">{t('pairApproved')}</div>
    </div>
  );
}

function PendingState({
  qrUrl,
  code,
  expiresAt,
  onRestart,
}: {
  qrUrl: string;
  code: string;
  expiresAt: Date;
  onRestart: () => void;
}) {
  const { t } = useI18n();
  const remaining = useCountdown(expiresAt);
  const urgent = remaining < 60_000;

  return (
    <>
      <div className="te-pair__qr-frame">
        <QrCode value={qrUrl} label={t('pairTitle')} />
      </div>

      <div className="te-pair__status">
        <span className="te-pair__dot" aria-hidden="true" />
        {t('pairWaiting')}
      </div>

      <div>
        <div className="te-pair__code-label">{t('pairCodeLabel')}</div>
        <div className="te-pair__code" aria-label={code.split('').join(' ')}>
          {formatPairingCode(code)}
        </div>
      </div>

      <div className={`te-pair__timer${urgent ? ' te-pair__timer--urgent' : ''}`}>
        {t('pairExpiresIn')} {formatCountdown(remaining)}
      </div>

      <button type="button" className="te-button te-button--ghost" onClick={onRestart}>
        {t('pairNewCode')}
      </button>
    </>
  );
}

function SimpleState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="te-pair__state">
      <div className="te-pair__state-title">{title}</div>
      <div className="te-pair__state-body">{body}</div>
      <button type="button" className="te-button" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}

/**
 * Milliseconds left until [target].
 *
 * Ticks a clock rather than a remaining value, so the countdown is derived
 * from the target on every render and a new target needs no reset.
 */
function useCountdown(target: Date): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return Math.max(0, target.getTime() - now);
}
