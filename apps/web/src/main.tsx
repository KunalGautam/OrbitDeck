import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';
if (typeof window !== 'undefined' && !(window as any).CESIUM_BASE_URL) {
  (window as any).CESIUM_BASE_URL = '/cesium/';
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
