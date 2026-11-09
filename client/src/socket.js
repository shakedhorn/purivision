import { io } from 'socket.io-client';

// Determine the backend URL dynamically
// 1. Vite environment variable: VITE_BACKEND_URL (set on cloud hosting like Render/Railway/Vercel)
// 2. Localhost fallback when running locally (points to server on port 3001)
// 3. Otherwise use window.location.origin
const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `http://${window.location.hostname}:3001`;
  }
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';
};

export const BACKEND_URL = getBackendUrl();

export const socket = io(BACKEND_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling']
});
