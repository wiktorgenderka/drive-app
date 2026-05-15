// Custom Next.js server with Socket.IO
// Wymagany bo Next.js App Router nie wspiera Socket.IO natywnie

const { createServer } = require('http');
const next = require('next');
const { Server: SocketIOServer } = require('socket.io');
const pino = require('pino');
const compression = require('compression');

const log = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } },
  }),
});

// Validate required env vars on server start
const REQUIRED_ENV = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXT_PUBLIC_MAPBOX_TOKEN'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  log.error({ missing }, 'Missing required environment variables');
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const compress = compression();
  const httpServer = createServer((req, res) => {
    compress(req, res, () => handle(req, res));
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: dev ? '*' : (process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'),
      methods: ['GET', 'POST'],
    },
    path: '/api/socketio',
    maxHttpBufferSize: 1e6, // 1 MB max per Socket.IO message
  });

  // Make io accessible from Next.js API routes
  global.__socketIo = io;

  io.on('connection', (socket) => {
    log.debug({ socketId: socket.id }, 'Client connected');

    // Join personal room for targeted notifications
    socket.on('user-connect', ({ userId }) => {
      if (userId) {
        socket.join(`user:${userId}`);
        log.debug({ socketId: socket.id, userId }, 'Socket joined user room');
      }
    });

    // Join a convoy room for notifications only (no member-joined broadcast)
    socket.on('join-convoy-notify', ({ convoyId }) => {
      if (convoyId) socket.join(`convoy:${convoyId}`);
    });

    socket.on('join-convoy', (data) => {
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

    socket.on('leave-convoy', (data) => {
      const { convoyId, userId, name } = data;
      socket.leave(`convoy:${convoyId}`);
      socket.to(`convoy:${convoyId}`).emit('convoy-update', {
        type: 'member-left',
        memberId: userId,
        memberName: name ?? null,
      });
    });

    socket.on('location-update', (data) => {
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

    socket.on('new-report', (report) => {
      socket.broadcast.emit('new-report', report);
    });

    socket.on('report-vote', (data) => {
      socket.broadcast.emit('report-vote', data);
    });

    socket.on('fuel-price-update', (data) => {
      socket.broadcast.emit('fuel-price-update', data);
    });

    // Convoy shared destination - broadcast to all convoy members
    socket.on('convoy-destination-set', (data) => {
      const { convoyId, destLat, destLng, destName } = data;
      if (convoyId) {
        socket.to(`convoy:${convoyId}`).emit('convoy-destination-set', { convoyId, destLat, destLng, destName });
      }
    });

    // Convoy text chat message — echo to ALL in room (incl. sender for cross-socket delivery)
    socket.on('convoy-chat', (data) => {
      const { convoyId, userId, name, message, id } = data;
      if (convoyId && message) {
        io.to(`convoy:${convoyId}`).emit('convoy-chat', {
          id,
          convoyId,
          userId,
          name,
          message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Convoy message delete
    socket.on('convoy-message-delete', (data) => {
      const { convoyId, messageId } = data;
      if (convoyId && messageId) {
        io.to(`convoy:${convoyId}`).emit('convoy-message-delete', { messageId });
      }
    });

    // Convoy message edit
    socket.on('convoy-message-edit', (data) => {
      const { convoyId, messageId, newText } = data;
      if (convoyId && messageId && newText) {
        io.to(`convoy:${convoyId}`).emit('convoy-message-edit', { messageId, newText });
      }
    });

    // Convoy voice message — echo to ALL in room (incl. sender for cross-socket delivery)
    socket.on('convoy-voice', (data) => {
      const { convoyId, userId, name, audioData, mimeType, duration, id } = data;
      if (convoyId && audioData) {
        io.to(`convoy:${convoyId}`).emit('convoy-voice', {
          id,
          convoyId,
          userId,
          name,
          audioData,
          mimeType,
          duration,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on('disconnect', () => {
      log.debug({ socketId: socket.id }, 'Client disconnected');
    });
  });

  httpServer.listen(port, () => {
    log.info({ port, env: dev ? 'development' : process.env.NODE_ENV }, `Server listening at http://localhost:${port}`);
  });
});
