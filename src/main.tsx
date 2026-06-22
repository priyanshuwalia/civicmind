/// <reference types="vite/client" />
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'leaflet/dist/leaflet.css';

// Intercept global fetch to inject VITE_API_URL base URL for api requests
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  const API_BASE = import.meta.env.VITE_API_URL || "";
  if (typeof input === "string" && input.startsWith("/api/")) {
    input = API_BASE + input;
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
