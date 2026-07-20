import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    newUsers: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    tournamentsCreated: { type: Number, default: 0 },
    ocrScansProcessed: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
  },
  { timestamps: true }
);

analyticsSchema.index({ date: 1 }, { unique: true });

export default mongoose.model('Analytics', analyticsSchema);
