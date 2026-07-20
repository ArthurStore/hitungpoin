import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ap_tournament',
  jwtSecret: process.env.JWT_SECRET || 'ap-arthur-points-secret-change-in-production',
  adminPin: process.env.ADMIN_PIN || '1234',
  nodeEnv: process.env.NODE_ENV || 'development',
};
