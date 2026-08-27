import { io } from 'socket.io-client';

const URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : `http://${window.location.hostname}:3001`;
export const socket = io(URL);
