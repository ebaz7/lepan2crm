
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary'; // Import ErrorBoundary
import './index.css'; 
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { getServerHost } from './services/apiService';

// Expose libraries globally
(window as any).html2canvas = html2canvas;
(window as any).jspdf = { jsPDF };

// Intercept all relative fetch calls on native platforms to point to the correct server url
if (Capacitor.isNativePlatform()) {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      const host = getServerHost();
      const effectiveHost = host || 'https://dlkam.ir';
      const redirectedUrl = `${effectiveHost}${input}`;
      console.log(`[Capacitor Fetch Redirect] ${input} -> ${redirectedUrl}`);
      input = redirectedUrl;
    }
    return originalFetch.apply(this, [input, init]);
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Register Service Worker for PWA & Push Notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
