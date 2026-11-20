import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { reloadOnce } from './utils/lazy';

// Tệp JS cũ không còn (web vừa cập nhật): tự tải lại trang một lần thay vì để trang trắng
window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); reloadOnce(); });

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.onupdatefound = () => {
        const installingWorker = reg.installing;
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Có bản cập nhật mới, tự động reload trang để áp dụng
            window.location.reload();
          }
        };
      };
    });
  });
}
