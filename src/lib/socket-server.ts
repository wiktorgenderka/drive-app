import type { Server as SocketIOServer } from 'socket.io';

declare global {
  // eslint-disable-next-line no-var
  var __socketIo: SocketIOServer | undefined;
}

export function getSocketServer(): SocketIOServer | undefined {
  return global.__socketIo;
}
