import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { connectDatabase } from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import tournamentRoutes from './routes/tournamentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import publicRoutes from './routes/publicRoutes.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'AP (Arthur Points)', version: '2.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await connectDatabase();
  app.listen(config.port, () => {
    console.log(`AP Tournament API on http://localhost:${config.port}`);
  });
}

start();
