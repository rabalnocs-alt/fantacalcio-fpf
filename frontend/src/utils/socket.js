import { io } from 'socket.io-client';

const envUrl = import.meta.env.VITE_BACKEND_URL;
export const BACKEND_URL = (envUrl && !envUrl.includes('localhost')) 
  ? envUrl 
  : `http://${window.location.hostname}:3000`;

export const socket = io(BACKEND_URL);
