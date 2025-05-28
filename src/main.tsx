import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Only register service worker if the browser supports it and we're not in a WebContainer environment
if ('serviceWorker' in navigator && 
    !window.location.hostname.includes('stackblitz') && 
    !window.location.hostname.includes('localhost')) {
  // Import and register service worker
  import('./ServiceWorker').then(({ register }) => {
    register();
  });
}