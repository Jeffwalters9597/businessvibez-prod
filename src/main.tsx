import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Only register service worker if the browser supports it and we're not in a WebContainer environment
if ('serviceWorker' in navigator && 
    !window.location.hostname.includes('stackblitz') && 
    !window.location.hostname.includes('localhost')) {
  // Register service worker directly
  navigator.serviceWorker.register('/ServiceWorker.js')
    .then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    })
    .catch(error => {
      console.error('ServiceWorker registration failed: ', error);
    });
}