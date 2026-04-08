import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export function getSocketServer(httpServer?: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
    path: '/api/socketio',
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join convoy room
    socket.on('join-convoy', (convoyId: string) => {
      socket.join(`convoy:${convoyId}`);
      socket.to(`convoy:${convoyId}`).emit('member-joined', {
        socketId: socket.id,
        convoyId,
      });
    });

    // Leave convoy room
    socket.on('leave-convoy', (convoyId: string) => {
      socket.leave(`convoy:${convoyId}`);
      socket.to(`convoy:${convoyId}`).emit('member-left', {
        socketId: socket.id,
        convoyId,
      });
    });

    // Location update broadcast to convoy
    socket.on('location-update', (data: { convoyId: string; userId: string; latitude: number; longitude: number }) => {
      socket.to(`convoy:${data.convoyId}`).emit('location-update', {
        userId: data.userId,
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: new Date().toISOString(),
      });
    });

    // New report broadcast
    socket.on('new-report', (report) => {
      socket.broadcast.emit('new-report', report);
    });

    // Report vote
    socket.on('report-vote', (data) => {
      socket.broadcast.emit('report-vote', data);
    });

    // Fuel price update
    socket.on('fuel-price-update', (data) => {
      socket.broadcast.emit('fuel-price-update', data);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}
