import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useI18n } from '../i18n/I18nProvider';
import { LOCALES } from '../i18n/strings';
import { useSession } from '../session/SessionProvider';
import { TRIP_SECTIONS } from './sections';
import { useTrip } from './useTrip';
import './trip.css';

/** Desktop chrome: a persistent sidebar plus the session controls. */
export function TripShell() {
  const { t, locale, setLocale } = useI18n();
  const { active, closeSession } = useSession();
  const { trip } = useTrip();
  const [confirmingClose, setConfirmingClose] = useState(false);

  const counts = trip?.counts;

  return (
    <div className="te-shell">
      <a className="te-skip-link" href="#te-main">
        {t('navHome')}
      </a>

      <nav className="te-sidebar" aria-label={t('appName')}>
        <div className="te-sidebar__brand">
          <span className="te-sidebar__logo" aria-hidden="true">
            ✈
          </span>
          <span className="te-sidebar__name">{t('appName')}</span>
        </div>

        <NavLink to="." end className="te-nav-item">
          <span className="te-nav-item__dot" style={{ background: 'var(--te-accent)' }} aria-hidden="true" />
          {t('navHome')}
        </NavLink>

        {TRIP_SECTIONS.map((section) => {
          const count = counts ? section.count(counts) : null;
          return (
            <NavLink to={section.path} className="te-nav-item" key={section.id}>
              <span
                className="te-nav-item__dot"
                style={{ background: section.color }}
                aria-hidden="true"
              />
              {t(section.labelKey)}
              {count ? <span className="te-nav-item__count">{count}</span> : null}
            </NavLink>
          );
        })}

        <div className="te-sidebar__footer">
          <div className="te-session-chip">
            <span aria-hidden="true">{active?.canEdit ? '✏️' : '👁️'}</span>
            <span>{active?.canEdit ? t('canEditBadge') : t('readOnly')}</span>
          </div>

          <div className="te-lang-switch" style={{ position: 'static', boxShadow: 'none' }}>
            {LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={locale === code}
                onClick={() => setLocale(code)}
              >
                {code === 'he' ? 'עברית' : 'EN'}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="te-button te-button--ghost"
            onClick={() => setConfirmingClose(true)}
          >
            {t('closeSession')}
          </button>
        </div>
      </nav>

      <main className="te-content" id="te-main">
        <Outlet />
      </main>

      {confirmingClose ? (
        <div
          className="te-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmingClose(false);
          }}
        >
          <div
            className="te-modal"
            role="alertdialog"
            aria-modal="true"
            aria-label={t('closeSession')}
            style={{ width: 'min(440px, 100%)' }}
          >
            <div className="te-modal__body">
              <p style={{ fontSize: 15, lineHeight: 1.55 }}>{t('closeSessionConfirm')}</p>
            </div>
            <div className="te-modal__footer">
              <button
                type="button"
                className="te-button te-button--ghost"
                onClick={() => setConfirmingClose(false)}
              >
                {t('cancel')}
              </button>
              <button type="button" className="te-button" onClick={() => void closeSession()}>
                {t('closeSession')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
