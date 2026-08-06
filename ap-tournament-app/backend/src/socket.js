import http from 'http';
import { Server } from 'socket.io';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
        : true,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('join-tournament', (tournamentId) => {
      if (!tournamentId) return;
      socket.join(`tournament:${tournamentId}`);
    });

    socket.on('leave-tournament', (tournamentId) => {
      if (!tournamentId) return;
      socket.leave(`tournament:${tournamentId}`);
    });
  });

  return io;
}

export function getIO() {
  return io;
}

export function emitLeaderboardUpdate(tournamentId, payload) {
  if (!io || !tournamentId) return;
  io.to(`tournament:${tournamentId}`).emit('leaderboard:update', payload);
}
