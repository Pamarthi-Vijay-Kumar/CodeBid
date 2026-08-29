import { io } from 'socket.io-client';

let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    const url = import.meta.env.VITE_API_URL || undefined; // undefined -> same origin (dev proxy)
    socketInstance = io(url, {
      autoConnect: false,
      auth: { token: localStorage.getItem('codebid_token') || null },
    });
  }
  return socketInstance;
}
