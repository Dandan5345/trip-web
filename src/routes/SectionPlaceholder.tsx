import { Link, useParams } from 'react-router-dom';

import { useI18n } from '../i18n/I18nProvider';
import { findSection } from '../trip/sections';
import { useTrip } from '../trip/useTrip';
import '../trip/trip.css';

/**
 * A real page for a section that is not built yet.
 *
 * Every card on the home screen leads somewhere legible: the section's name,
 * the trip it belongs to, an honest "being built" line, and a way back. Never
 * a blank screen, a 404, or a button that does nothing.
 */
export function SectionPlaceholder() {
  const { t } = useI18n();
  const { section: sectionPath = '' } = useParams();
  const { trip } = useTrip();
  const section = findSection(sectionPath);

  if (!section) return <UnknownSection />;

  return (
    <div className="te-content__inner te-enter">
      <div className="te-placeholder">
        <span
          className="te-placeholder__icon"
          style={{ background: `color-mix(in srgb, ${section.color} 16%, transparent)` }}
          aria-hidden="true"
        >
          {section.icon}
        </span>
        <h1 className="te-placeholder__title">{t(section.labelKey)}</h1>
        {trip ? <div className="te-placeholder__trip">{trip.header.name}</div> : null}
        <p className="te-placeholder__body">
          <strong>{t('underConstruction')}</strong>
          <br />
          {t('underConstructionBody')}
        </p>
        <Link className="te-button" to="..">
          {t('backToTrip')}
        </Link>
      </div>
    </div>
  );
}

function UnknownSection() {
  const { t } = useI18n();
  const { trip } = useTrip();
  return (
    <div className="te-content__inner te-enter">
      <div className="te-placeholder">
        <span className="te-placeholder__icon" style={{ background: 'var(--te-accent-soft)' }} aria-hidden="true">
          🧭
        </span>
        <h1 className="te-placeholder__title">{t('underConstruction')}</h1>
        {trip ? <div className="te-placeholder__trip">{trip.header.name}</div> : null}
        <p className="te-placeholder__body">{t('underConstructionBody')}</p>
        <Link className="te-button" to="/trip">
          {t('backToTrip')}
        </Link>
      </div>
    </div>
  );
}
