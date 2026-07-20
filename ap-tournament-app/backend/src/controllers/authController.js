import bcrypt from 'bcryptjs';
import { isMemoryStore } from '../config/database.js';
import { memoryStore } from '../config/memoryStore.js';
import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase();

    if (isMemoryStore()) {
      if (memoryStore.findUserByEmail(normalizedEmail)) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = memoryStore.createUser({ name, email: normalizedEmail, passwordHash, role: 'organizer' });
      const token = signToken(user._id);
      return res.status(201).json({ token, user: sanitizeUser(user) });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: normalizedEmail, passwordHash });
    const token = signToken(user._id);
    res.status(201).json({ token, user: sanitizeUser(user.toObject()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    let user;
    if (isMemoryStore()) {
      user = memoryStore.findUserByEmail(email.toLowerCase());
    } else {
      user = await User.findOne({ email: email.toLowerCase() });
    }

    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const hash = user.passwordHash;
    const valid = await bcrypt.compare(password, hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user._id);
    res.json({ token, user: sanitizeUser(user.toObject?.() || user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function me(req, res) {
  res.json({ user: sanitizeUser(req.user.toObject?.() || req.user) });
}
