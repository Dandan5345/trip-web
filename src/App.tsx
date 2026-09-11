import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { useI18n } from './i18n/I18nProvider';
import { LOCALES } from './i18n/strings';
import { PairingScreen } from './pairing/PairingScreen';
import { SectionPlaceholder } from './routes/SectionPlaceholder';
import { useSession } from './session/SessionProvider';
import { TripHome } from './trip/TripHome';
import { TripShell } from './trip/TripShell';

/**
 * Two states, and nothing in between: either this browser is paired with one
 * trip, or it is showing the code that would pair it. There is no login, no
 * trip list, and no way to reach a second trip from here.
 */
export default function App() {
  const { status } = useSession();
  const location = useLocation();

  if (status !== 'active') {
    return (
      <>
        <LanguageSwitch />
        <PairingScreen />
      </>
    );
  }

  // A deep link that arrived before pairing (or /pair itself) lands on the
  // trip once the session is live.
  if (!location.pathname.startsWith('/trip')) {
    return <Navigate to="/trip" replace />;
  }

  return (
    <Routes>
      <Route path="/trip" element={<TripShell />}>
        <Route index element={<TripHome />} />
        <Route path=":section" element={<SectionPlaceholder />} />
      </Route>
      <Route path="*" element={<Navigate to="/trip" replace />} />
    </Routes>
  );
}

function LanguageSwitch() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="te-lang-switch">
      {LOCALES.map((code) => (
        <button key={code} type="button" aria-pressed={locale === code} onClick={() => setLocale(code)}>
          {code === 'he' ? 'עברית' : 'EN'}
        </button>
      ))}
    </div>
  );
}
