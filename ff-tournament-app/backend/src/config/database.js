import mongoose from 'mongoose';
import { config } from './env.js';

let useMemoryStore = false;

export function isMemoryStore() {
  return useMemoryStore;
}

export async function connectDatabase() {
  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    });
    console.log('MongoDB connected');
    return true;
  } catch (err) {
    console.warn('MongoDB unavailable, using in-memory store:', err.message);
    useMemoryStore = true;
    return false;
  }
}
