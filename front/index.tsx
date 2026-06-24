import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import { LanguageProvider } from './modules/core/contexts/LanguageContext';
import { ToastProvider } from './modules/core/contexts/ToastContext';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}
const root = ReactDOM.createRoot(rootElement);
// Error boundary básico
try {
  root.render(
    <React.StrictMode>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
        <BrowserRouter>
          <LanguageProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </LanguageProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </React.StrictMode>
  );
} catch (error) {
  root.render(
    <div style={{ padding: '20px', fontFamily: 'Arial', color: '#000' }}>
      <h1>Erro ao carregar aplicaçéo</h1>
      <p>Erro: {error instanceof Error ? error.message : String(error)}</p>
      <p>Stack: {error instanceof Error ? error.stack : 'N/A'}</p>
      <p>Verifique o console para mais detalhes.</p>
    </div>
  );
}