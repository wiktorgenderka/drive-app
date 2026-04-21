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
    socket.on('join-convoy', (data: { convoyId: string; userId: string; name?: string; avatarUrl?: string }) => {
      const { convoyId, userId, name, avatarUrl } = data;
      socket.join(`convoy:${convoyId}`);
      socket.to(`convoy:${convoyId}`).emit('convoy-update', {
        type: 'member-joined',
        member: {
          id: userId,
          userId,
          name: name ?? 'Unknown',
          avatarUrl,
          role: 'MEMBER',
          latitude: 0,
          longitude: 0,
          joinedAt: Date.now(),
          lastUpdated: Date.now(),
          isOnline: true,
        },
      });
    });

    // Leave convoy room
    socket.on('leave-convoy', (data: { convoyId: string; userId: string }) => {
      const { convoyId, userId } = data;
      socket.leave(`convoy:${convoyId}`);
      socket.to(`convoy:${convoyId}`).emit('convoy-update', {
        type: 'member-left',
        memberId: userId,
      });
    });

    // Location update broadcast to convoy
    socket.on('location-update', (data: {
      convoyId: string;
      memberId: string;
      latitude: number;
      longitude: number;
      heading?: number | null;
      speed?: number | null;
      name?: string;
      avatarUrl?: string;
    }) => {
      socket.to(`convoy:${data.convoyId}`).emit('location-update', {
        memberId: data.memberId,
        latitude: data.latitude,
        longitude: data.longitude,
        heading: data.heading ?? null,
        speed: data.speed ?? null,
        name: data.name,
        avatarUrl: data.avatarUrl,
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
