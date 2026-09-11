import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { I18nProvider } from './i18n/I18nProvider';
import { SessionProvider } from './session/SessionProvider';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

// GitHub Pages serves this project below /trip-web/. Vite replaces BASE_URL
// at build time, while local development and the old Firebase build keep '/'.
const routerBase =
  import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '');

createRoot(container).render(
  <StrictMode>
    <I18nProvider>
      <SessionProvider>
        <BrowserRouter basename={routerBase}>
          <App />
        </BrowserRouter>
      </SessionProvider>
    </I18nProvider>
  </StrictMode>,
);
