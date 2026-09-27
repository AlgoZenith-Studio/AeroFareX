import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import './styles/landing.css';
import './styles/fares.css';
import { App } from './App';
import { FaresPage } from './pages/FaresPage';
import { AccountPage } from './pages/AccountPage';
import { UserAuthProvider } from './lib/userAuth';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <UserAuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/fares" element={<FaresPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="*" element={<App />} />
        </Routes>
      </UserAuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
