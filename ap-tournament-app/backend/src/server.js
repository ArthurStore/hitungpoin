import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { UPLOADS_DIR } from './config/upload.js';
import { initSocket } from './socket.js';
import { hydrateGeminiKeysFromEnv } from './config/settingsStore.js';
import authRoutes from './routes/authRoutes.js';
import tournamentRoutes from './routes/tournamentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import ocrRoutes from './routes/ocrRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

dotenv.config();
hydrateGeminiKeysFromEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : true;

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/api/uploads', express.static(UPLOADS_DIR));

app.get('/', (_req, res) => {
  res.json({
    app: 'AP (Arthur Points) API',
    version: '2.4.0',
    health: '/api/health',
    ocr: 'POST /api/ocr/scan (Gemini Vision)',
    admin: 'POST /api/admin/verify-pin (header: X-Admin-Pin)',
    realtime: 'socket.io leaderboard:update',
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'AP (Arthur Points)', version: '2.4.0', ocr: 'gemini-flash-latest' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/upload', uploadRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await connectDatabase();
  initSocket(server);
  const host = process.env.HOST || '0.0.0.0';
  server.listen(config.port, host, () => {
    console.log(`AP Tournament API on http://${host}:${config.port} (socket.io enabled)`);
  });
}

start();
