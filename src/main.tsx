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

// Enhanced checks for environments that don't support Service Workers
const isWebContainerEnvironment = () => {
  // Basic checks
  if (window.location.hostname.includes('stackblitz') ||
      window.location.href.includes('stackblitz.io') ||
      window.self !== window.top) {
    return true;
  }
  
  // Additional check for StackBlitz in iframes
  try {
    if (window.parent && window.parent.location.hostname.includes('stackblitz')) {
      return true;
    }
    
    // Check for StackBlitz preview iframe
    if (window.self.frameElement && window.self.frameElement.id === 'app-iframe') {
      return true;
    }
  } catch (e) {
    // If we get a SecurityError, we're likely in a sandboxed iframe (like StackBlitz)
    if (e instanceof DOMException && e.name === 'SecurityError') {
      return true;
    }
  }
  
  // Additional safety check: look for global WebContainer variables or objects
  if (typeof window.WebContainer !== 'undefined' || 
      typeof window.__WEBCONTAINER_API !== 'undefined' ||
      window.location.href.includes('webcontainer')) {
    return true;
  }
  
  return false;
};

// Only register service worker if the browser supports it and we're not in a WebContainer environment
if ('serviceWorker' in navigator && !isWebContainerEnvironment() && import.meta.env.PROD) {
  // Only register in production to avoid development issues
  navigator.serviceWorker.register('/ServiceWorker.js')
    .then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    })
    .catch(error => {
      console.error('ServiceWorker registration failed: ', error);
    });
}