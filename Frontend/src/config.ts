const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 
  (isLocalhost ? 'http://localhost:5000' : 'https://gridshare.onrender.com');

export const WS_BASE_URL = (import.meta.env.VITE_WS_BASE_URL as string) || 
  (isLocalhost ? 'ws://localhost:5000/ws' : 'wss://gridshare.onrender.com/ws');

