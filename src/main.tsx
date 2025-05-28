import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { Toaster } from 'react-hot-toast';

// Register service worker for better mobile experience
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/ServiceWorker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.error('ServiceWorker registration failed: ', error);
      });
  });
}

// Log device information for debugging
const logDeviceInfo = () => {
  const ua = navigator.userAgent;
  const browser = 
    ua.includes('Chrome') ? 'Chrome' :
    ua.includes('Firefox') ? 'Firefox' :
    ua.includes('Safari') && !ua.includes('Chrome') ? 'Safari' :
    ua.includes('Edge') ? 'Edge' :
    'Unknown';
  
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const os = 
    ua.includes('Android') ? 'Android' :
    ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod') ? 'iOS' :
    ua.includes('Windows') ? 'Windows' :
    ua.includes('Mac') ? 'Mac' :
    ua.includes('Linux') ? 'Linux' :
    'Unknown';
  
  console.log(`Device: ${isMobile ? 'Mobile' : 'Desktop'}, OS: ${os}, Browser: ${browser}`);
};

logDeviceInfo();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-right" />
    </BrowserRouter>
  </StrictMode>
);