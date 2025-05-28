import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { Toaster } from 'react-hot-toast';
import { getDeviceInfo } from './mobile-fixes';

// Register service worker
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
  const deviceInfo = getDeviceInfo();
  console.log(`Device: ${deviceInfo.isMobile ? 'Mobile' : 'Desktop'}, OS: ${deviceInfo.os}, Browser: ${deviceInfo.browser}`);
};

logDeviceInfo();

// Customize session storage on mobile
if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
  // Force localStorage to be used even on private browsing mode
  try {
    localStorage.setItem('mobile_check', 'true');
    localStorage.removeItem('mobile_check');
    console.log('Local storage available on mobile');
  } catch (e) {
    console.log('Local storage not available, using memory storage fallback');
    // Create a polyfill for localStorage
    const memoryStorage: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        setItem: (key: string, value: string) => {
          memoryStorage[key] = value;
        },
        getItem: (key: string) => memoryStorage[key] || null,
        removeItem: (key: string) => {
          delete memoryStorage[key];
        },
        clear: () => {
          Object.keys(memoryStorage).forEach(key => {
            delete memoryStorage[key];
          });
        }
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-right" />
    </BrowserRouter>
  </StrictMode>
);