import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { AppRoutes } from './routes';
import { AuthSessionRefresher } from './components/layout/AuthSessionRefresher';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthSessionRefresher />
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>,
);
