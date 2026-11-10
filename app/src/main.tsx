import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';
import './styles/index.css';
import './styles/themes/index.css';
import { applyStoredAppearance } from './lib/theme';

applyStoredAppearance();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
