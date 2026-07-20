import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { isMemoryStore } from '../config/database.js';
import { memoryStore } from '../config/memoryStore.js';
import User from '../models/User.js';

export function signToken(userId) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' });
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(header.slice(7), config.jwtSecret);
    let user;
    if (isMemoryStore()) {
      user = memoryStore.findUserById(decoded.userId);
    } else {
      user = await User.findById(decoded.userId).select('-passwordHash');
    }
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function adminPinMiddleware(req, res, next) {
  const pin = req.headers['x-admin-pin'];
  if (pin !== config.adminPin) {
    return res.status(403).json({ error: 'Invalid admin PIN' });
  }
  next();
}

export async function tournamentOwnerMiddleware(req, res, next) {
  const { id } = req.params;
  let tournament;
  if (isMemoryStore()) {
    tournament = memoryStore.getTournament(id);
  } else {
    const Tournament = (await import('../models/Tournament.js')).default;
    tournament = await Tournament.findById(id);
  }
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
  const ownerId = tournament.ownerId?.toString?.() || tournament.ownerId;
  const userId = req.user._id?.toString?.() || req.user._id;
  if (ownerId !== userId) {
    return res.status(403).json({ error: 'Access denied: not your tournament' });
  }
  req.tournament = tournament;
  next();
}
