import type { Server as SocketIOServer } from 'socket.io';

declare global {
  // eslint-disable-next-line no-var
  var __socketIo: SocketIOServer | undefined;
}

export function getSocketServer(): SocketIOServer | undefined {
  if (!global.__socketIo) {
    console.warn('[socket-server] __socketIo is not set on global — notifications will not be delivered');
  }
  return global.__socketIo;
}
